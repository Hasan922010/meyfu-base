"""Nakladnoy va yuklama PDF'lari — tovar rasmlari + kompaniya rekvizitlari + muhr.

v4 T3. `with_stamp=True` bo'lsa `CompanySettings.stamp` imzo zonasiga qo'yiladi.
Til: o'zbek. Shrift: DejaVuSans (kirill/lotin) — `apps/core/pdf.py`.
"""
from __future__ import annotations

import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from apps.core.models import CompanySettings
from apps.core.pdf import fitted_image_buffer, register_fonts

_ZERO = Decimal("0")
_ROW_IMG_MM = 13


def _money(value) -> str:
    try:
        n = Decimal(value or 0)
    except (TypeError, ValueError):
        return "0"
    return f"{n:,.0f}".replace(",", " ")


def _styles() -> dict[str, ParagraphStyle]:
    font = register_fonts()
    bold = "DejaVuSans-Bold" if font != "Helvetica" else "Helvetica-Bold"
    return {
        "title": ParagraphStyle("t", fontName=bold, fontSize=15, leading=18),
        "h": ParagraphStyle("h", fontName=bold, fontSize=9, leading=12),
        "n": ParagraphStyle("n", fontName=font, fontSize=8.5, leading=11),
        "small": ParagraphStyle("s", fontName=font, fontSize=7.5, leading=9,
                                textColor=colors.HexColor("#475569")),
        "cell": ParagraphStyle("c", fontName=font, fontSize=8, leading=10),
        "cellr": ParagraphStyle("cr", fontName=font, fontSize=8, leading=10,
                                alignment=2),
    }


def _company_header(company: CompanySettings | None, st: dict) -> list:
    if company is None:
        return [Paragraph("Kompaniya", st["title"])]
    left = [Paragraph(company.name or "Kompaniya", st["title"])]
    meta = []
    if company.legal_name:
        meta.append(company.legal_name)
    if company.inn:
        meta.append(f"STIR: {company.inn}")
    if company.address:
        meta.append(company.address)
    if company.phone:
        meta.append(f"Tel: {company.phone}")
    if meta:
        left.append(Paragraph(" · ".join(meta), st["small"]))

    logo_reader = fitted_image_buffer(company.logo, box_px=240)
    logo_cell = ""
    if logo_reader is not None:
        img = Image(logo_reader, width=28 * mm, height=28 * mm, kind="proportional")
        img.hAlign = "RIGHT"
        logo_cell = img

    tbl = Table([[left, logo_cell]], colWidths=[135 * mm, 45 * mm])
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    return [tbl]


def _signature_block(st: dict, company: CompanySettings | None,
                     with_stamp: bool, left_label: str, right_label: str) -> Table:
    stamp_flow = ""
    if with_stamp and company is not None and company.stamp:
        reader = fitted_image_buffer(company.stamp, box_px=360)
        if reader is not None:
            stamp_flow = Image(reader, width=34 * mm, height=34 * mm,
                               kind="proportional")

    director = ""
    if company is not None and company.director_name:
        director = company.director_name

    rows = [
        [Paragraph(f"{left_label}: _______________", st["n"]),
         Paragraph(f"{right_label}: _______________", st["n"])],
        [Paragraph(f"({director})" if director else "(F.I.SH.)", st["small"]),
         Paragraph("(F.I.SH.)", st["small"])],
    ]
    tbl = Table(rows, colWidths=[90 * mm, 90 * mm])
    style = [
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]
    tbl.setStyle(TableStyle(style))
    if stamp_flow:
        wrap = Table([[tbl, stamp_flow]], colWidths=[150 * mm, 30 * mm])
        wrap.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        return wrap
    return tbl


def _doc(buffer: io.BytesIO, title: str) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=14 * mm, bottomMargin=16 * mm, title=title,
    )


def purchase_to_pdf(purchase, *, with_stamp: bool = False,
                    with_images: bool = True) -> bytes:
    st = _styles()
    company = CompanySettings.objects.order_by("created_at").first()
    buffer = io.BytesIO()
    doc = _doc(buffer, f"Nakladnoy {purchase.number}")

    elements: list = []
    elements += _company_header(company, st)
    elements.append(Spacer(1, 4 * mm))
    elements.append(Paragraph(
        f"NAKLADNOY № {purchase.invoice_number or purchase.number}", st["title"]
    ))
    elements.append(Paragraph(
        f"Hujjat: {purchase.number} · Sana: {purchase.date:%d.%m.%Y} · "
        f"Yetkazib beruvchi: {purchase.supplier.name} · "
        f"Ombor: {purchase.warehouse.name}",
        st["small"],
    ))
    elements.append(Spacer(1, 3 * mm))

    header = ["№", "Rasm", "Nomi", "SKU", "Miqdor", "Dona narxi", "Summa"]
    if not with_images:
        header.pop(1)
    data = [[Paragraph(h, st["h"]) for h in header]]

    items = list(purchase.items.select_related("product").all())
    for idx, item in enumerate(items, start=1):
        row = [
            Paragraph(str(idx), st["cell"]),
            Paragraph(item.product.name, st["cell"]),
            Paragraph(item.product.sku, st["cell"]),
            Paragraph(f"{item.quantity:g} {item.product.unit.short_name}", st["cellr"]),
            Paragraph(_money(item.cost_price), st["cellr"]),
            Paragraph(_money(item.amount), st["cellr"]),
        ]
        if with_images:
            reader = fitted_image_buffer(
                getattr(item.product, "image", None), box_px=140
            )
            img_cell = ""
            if reader is not None:
                img_cell = Image(reader, width=_ROW_IMG_MM * mm,
                                 height=_ROW_IMG_MM * mm, kind="proportional")
            row.insert(1, img_cell)
        data.append(row)

    col_widths = (
        [9 * mm, _ROW_IMG_MM * mm + 3 * mm, 58 * mm, 24 * mm, 22 * mm, 25 * mm, 26 * mm]
        if with_images
        else [10 * mm, 72 * mm, 28 * mm, 24 * mm, 26 * mm, 28 * mm]
    )
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 3 * mm))

    totals = [
        ["Jami summa:", _money(purchase.total_amount)],
        ["To'langan:", _money(purchase.paid_amount)],
        ["Qarz:", _money(purchase.debt_amount)],
    ]
    ttbl = Table(
        [[Paragraph(a, st["h"]), Paragraph(b, st["cellr"])] for a, b in totals],
        colWidths=[40 * mm, 35 * mm], hAlign="RIGHT",
    )
    elements.append(ttbl)
    elements.append(Spacer(1, 10 * mm))
    elements.append(_signature_block(
        st, company, with_stamp, "Topshirdi", "Qabul qildi"
    ))

    doc.build(elements)
    return buffer.getvalue()


def loading_to_pdf(loading, *, with_stamp: bool = False,
                   with_images: bool = True) -> bytes:
    st = _styles()
    company = CompanySettings.objects.order_by("created_at").first()
    buffer = io.BytesIO()
    doc = _doc(buffer, f"Yuklama {loading.number}")

    elements: list = []
    elements += _company_header(company, st)
    elements.append(Spacer(1, 4 * mm))
    elements.append(Paragraph(f"YUKLAMA № {loading.number}", st["title"]))
    elements.append(Paragraph(
        f"Sana: {loading.date:%d.%m.%Y} · Tarqatuvchi: {loading.distributor.full_name}"
        f" · Ombor: {loading.warehouse.name}",
        st["small"],
    ))
    elements.append(Spacer(1, 3 * mm))

    header = ["№", "Rasm", "Nomi", "SKU", "Miqdor", "Narx", "Summa"]
    if not with_images:
        header.pop(1)
    data = [[Paragraph(h, st["h"]) for h in header]]
    for idx, item in enumerate(
        loading.items.select_related("product").all(), start=1
    ):
        row = [
            Paragraph(str(idx), st["cell"]),
            Paragraph(item.product.name, st["cell"]),
            Paragraph(item.product.sku, st["cell"]),
            Paragraph(f"{item.quantity:g} {item.product.unit.short_name}", st["cellr"]),
            Paragraph(_money(item.price), st["cellr"]),
            Paragraph(_money(item.amount), st["cellr"]),
        ]
        if with_images:
            reader = fitted_image_buffer(
                getattr(item.product, "image", None), box_px=140
            )
            row.insert(1, Image(reader, width=_ROW_IMG_MM * mm,
                                height=_ROW_IMG_MM * mm, kind="proportional")
                       if reader is not None else "")
        data.append(row)

    col_widths = (
        [9 * mm, _ROW_IMG_MM * mm + 3 * mm, 58 * mm, 24 * mm, 22 * mm, 25 * mm, 26 * mm]
        if with_images
        else [10 * mm, 72 * mm, 28 * mm, 24 * mm, 26 * mm, 28 * mm]
    )
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 3 * mm))
    elements.append(Table(
        [[Paragraph("Jami:", st["h"]),
          Paragraph(_money(loading.total_amount), st["cellr"])]],
        colWidths=[40 * mm, 35 * mm], hAlign="RIGHT",
    ))
    elements.append(Spacer(1, 10 * mm))
    elements.append(_signature_block(
        st, company, with_stamp, "Berdi (ombor)", "Oldi (tarqatuvchi)"
    ))

    doc.build(elements)
    return buffer.getvalue()
