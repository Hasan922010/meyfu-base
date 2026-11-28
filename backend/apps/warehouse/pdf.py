"""Nakladnoy va yuklama PDF'lari — tovar rasmlari + kompaniya rekvizitlari + muhr.

v4 T3. `with_stamp=True` bo'lsa `CompanySettings.stamp` imzo zonasiga qo'yiladi.
Til: o'zbek. Shrift: DejaVuSans (kirill/lotin) — `apps/core/pdf.py`.
"""
from __future__ import annotations

import io
from decimal import Decimal
from xml.sax.saxutils import escape

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

from apps.core.formatting import number_to_words_uz
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
        "dist_bold": ParagraphStyle("db", fontName=bold, fontSize=11, leading=14,
                                   alignment=2, textColor=colors.HexColor("#0f172a")),
        "dist_phone": ParagraphStyle("dp", fontName=bold, fontSize=10, leading=13,
                                    alignment=2, textColor=colors.HexColor("#1e293b")),
    }


def _esc(value: object) -> str:
    return escape("" if value is None else str(value))


def _company_header(company: CompanySettings | None, st: dict) -> list:
    title_st = st.get("company_title", st["title"])
    if company is None:
        return [Paragraph("Kompaniya", title_st)]
    left = [Paragraph(_esc(company.name or "Kompaniya"), title_st)]
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
        left.append(Paragraph(_esc(" · ".join(meta)), st["small"]))

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
                     with_stamp: bool, left_label: str, right_label: str,
                     *, compact: bool = False) -> Table:
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
        [Paragraph(f"{_esc(left_label)}: _______________", st["n"]),
         Paragraph(f"{_esc(right_label)}: _______________", st["n"])],
        [Paragraph(f"({_esc(director)})" if director else "(F.I.SH.)", st["small"]),
         Paragraph("(F.I.SH.)", st["small"])],
    ]
    tbl = Table(rows, colWidths=[90 * mm, 90 * mm])
    style = [
        ("TOPPADDING", (0, 0), (-1, -1), 0 if compact else 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0 if compact else 2),
    ]
    tbl.setStyle(TableStyle(style))
    if stamp_flow:
        wrap = Table([[tbl, stamp_flow]], colWidths=[150 * mm, 30 * mm])
        wrap.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        return wrap
    return tbl


def _doc(
    buffer: io.BytesIO, title: str, *, top_margin: float = 14 * mm
) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=top_margin, bottomMargin=16 * mm, title=title,
    )


def _int_qty(val: Decimal) -> str:
    return str(int(round(val)))


def _product_unit_label(product) -> str:
    pack_qty = product.pack_quantity or Decimal("1")
    pack_type = (product.package_type or "").strip()
    if pack_qty > 1 and pack_type:
        return pack_type
    return product.unit.short_name


def _format_pack_qty(quantity: Decimal, product) -> str:
    return f"{_int_qty(quantity)} {_product_unit_label(product)}"


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
        _esc(f"NAKLADNOY № {purchase.invoice_number or purchase.number}"), st["title"]
    ))
    elements.append(Paragraph(
        _esc(
            f"Hujjat: {purchase.number} · Sana: {purchase.date:%d.%m.%Y} · "
            f"Yetkazib beruvchi: {purchase.supplier.name} · "
            f"Ombor: {purchase.warehouse.name}"
        ),
        st["small"],
    ))
    elements.append(Spacer(1, 3 * mm))

    header = ["№", "Rasm", "Nomi", "SKU", "Miqdor", "Narx", "Summa"]
    if not with_images:
        header.pop(1)
    data = [[Paragraph(h, st["h"]) for h in header]]

    items = list(purchase.items.select_related("product", "product__unit").all())
    for idx, item in enumerate(items, start=1):
        row = [
            Paragraph(str(idx), st["cell"]),
            Paragraph(_esc(item.product.name), st["cell"]),
            Paragraph(_esc(item.product.sku), st["cell"]),
            Paragraph(_esc(_format_pack_qty(item.quantity, item.product)), st["cellr"]),
            Paragraph(_esc(_money(item.cost_price)), st["cellr"]),
            Paragraph(_esc(_money(item.amount)), st["cellr"]),
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
    st = {
        k: ParagraphStyle(f"{s.name}_m", parent=s, fontSize=9, leading=11)
        for k, s in _styles().items()
    }
    st["company_title"] = ParagraphStyle(
        "company_title_m", parent=st["title"], fontSize=12, leading=14
    )
    st["th"] = ParagraphStyle("th_c", parent=st["h"], alignment=1)
    st["total_bold"] = ParagraphStyle(
        "total_b", parent=st["h"], alignment=2, fontSize=11, leading=13
    )
    company = CompanySettings.objects.order_by("created_at").first()
    buffer = io.BytesIO()
    doc = _doc(buffer, f"Yuklama {loading.number}", top_margin=5 * mm)

    elements: list = []
    elements += _company_header(company, st)

    # O'ng tomonda Tarqatuvchi ismi va telefon raqami qalin shriftda (qayta buyurtma uchun)
    dist_phone = getattr(loading.distributor, "phone", "") or ""
    left_header = [
        Paragraph(_esc(f"YUKLAMA № {loading.number}"), st["title"]),
        Spacer(1, 1.5 * mm),
        Paragraph(
            _esc(f"Sana: {loading.date:%d.%m.%Y} · Ombor: {loading.warehouse.name}"),
            st["small"],
        ),
    ]
    right_header = [
        Paragraph("TARQATUVCHI (BUYURTMA UCHUN):", st["small"]),
        Spacer(1, 1 * mm),
        Paragraph(_esc(loading.distributor.full_name), st["dist_bold"]),
    ]
    if dist_phone:
        right_header.append(Paragraph(_esc(f"Tel: {dist_phone}"), st["dist_phone"]))

    hdr_table = Table([[left_header, right_header]], colWidths=[105 * mm, 75 * mm])
    hdr_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ]))
    elements.append(hdr_table)

    header = ["№", "Nomi", "Miqdor", "Ichidagi soni", "Narx", "Dona narxi", "Summa"]
    data = [[Paragraph(h, st["th"]) for h in header]]
    for idx, item in enumerate(
        loading.items.select_related("product", "product__unit").all(), start=1
    ):
        pack_qty = item.product.pack_quantity or Decimal("1")
        unit_label = _product_unit_label(item.product)
        qty_label = f"{_int_qty(item.quantity)} {unit_label}"
        pack_info = _int_qty(pack_qty) if pack_qty > 1 else "1"
        unit_price = item.price / pack_qty if pack_qty > 0 else item.price
        data.append([
            Paragraph(str(idx), st["cell"]),
            Paragraph(_esc(item.product.name), st["cell"]),
            Paragraph(_esc(qty_label), st["cellr"]),
            Paragraph(_esc(pack_info), st["cellr"]),
            Paragraph(_esc(_money(item.price)), st["cellr"]),
            Paragraph(_esc(_money(unit_price)), st["cellr"]),
            Paragraph(_esc(_money(item.amount)), st["cellr"]),
        ])

    col_widths = [8 * mm, 52 * mm, 24 * mm, 22 * mm, 24 * mm, 24 * mm, 26 * mm]
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
    show_words = True if company is None else getattr(company, "loading_total_in_words", True)
    total_rows = [
        [
            Paragraph("Jami:", st["total_bold"]),
            Paragraph(f"{_money(loading.total_amount)} so'm", st["total_bold"]),
        ],
    ]
    if show_words:
        total_words = number_to_words_uz(loading.total_amount).capitalize()
        total_rows.append([
            Paragraph(
                f"({total_words} so'm)",
                ParagraphStyle("tw_r", parent=st["small"], alignment=2),
            ),
            "",
        ])
    total_tbl = Table(
        total_rows,
        colWidths=[135 * mm, 45 * mm],
        hAlign="RIGHT",
    )
    total_style = [
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]
    if show_words:
        total_style.extend([
            ("SPAN", (0, 1), (1, 1)),
            ("ALIGN", (0, 1), (1, 1), "RIGHT"),
        ])
    total_tbl.setStyle(TableStyle(total_style))
    elements.append(total_tbl)
    elements.append(Spacer(1, 5 * mm))
    client_names = list(
        dict.fromkeys(
            loading.orders.select_related("client")
            .order_by("created_at")
            .values_list("client__name", flat=True)
        )
    )
    receiver_label = ", ".join(client_names) if client_names else "Oldi (tarqatuvchi)"
    elements.append(_signature_block(
        st, company, with_stamp, loading.distributor.full_name, receiver_label,
        compact=True,
    ))

    doc.build(elements)
    return buffer.getvalue()
