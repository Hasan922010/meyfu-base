"""1C uchun fayl eksporti — XML yoki CSV (v5: C6).

To'g'ridan-to'g'ri 1C API ulanishi yo'q: buxgalter faylni yuklab, 1C'ga
"Universal ma'lumot almashinuvi" / qayta ishlash orqali import qiladi.
Hujjatlar: sotuvlar (qatorlari bilan), mijozdan qaytarishlar, qarz to'lovlari.
Bekor qilingan va ziddiyatdagi sotuvlar kirmaydi.
"""
from __future__ import annotations

import csv
import io
from datetime import date as date_cls
from xml.etree import ElementTree as ET

from django.utils import timezone

from apps.core.models import CompanySettings
from apps.sales.models import DebtPayment, Sale, SaleReturn

from .aggregates import in_branch

_ACTIVE = ("COMPLETED", "FLAGGED")
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")
CSV_HEADER = [
    "doc_type", "number", "date", "client_id", "client", "client_inn",
    "product_sku", "product", "quantity", "price", "amount", "payment_type",
]


def _documents(date_from: date_cls, date_to: date_cls, branch):
    period = {"date__gte": date_from, "date__lte": date_to}
    sales = in_branch(Sale.objects.filter(status__in=_ACTIVE, **period), branch, "branch")
    returns = in_branch(SaleReturn.objects.filter(**period), branch, "branch")
    payments = in_branch(DebtPayment.objects.filter(**period), branch, "debt__client__branch")
    return (
        sales.select_related("client").prefetch_related("items__product")
        .order_by("date", "number"),
        returns.select_related("client").prefetch_related("items__product")
        .order_by("date", "number"),
        payments.select_related("debt__client").order_by("date", "created_at"),
    )


def _set(el: ET.Element, **attrs) -> ET.Element:
    for key, value in attrs.items():
        el.set(key, "" if value is None else str(value))
    return el


def export_1c_xml(*, date_from: date_cls, date_to: date_cls, branch=None) -> bytes:
    sales, returns, payments = _documents(date_from, date_to, branch)
    company = CompanySettings.load()
    root = _set(ET.Element("Exchange"), version="1.0", created=timezone.now().isoformat(),
                date_from=date_from.isoformat(), date_to=date_to.isoformat())
    _set(ET.SubElement(root, "Company"), name=company.legal_name or company.name,
         inn=company.inn)
    clients: dict = {}
    products: dict = {}
    docs = ET.Element("Documents")

    for doc_tag, rows in (("Sale", sales), ("Return", returns)):
        for doc in rows:
            clients[doc.client_id] = doc.client
            el = _set(ET.SubElement(docs, doc_tag), id=doc.id, number=doc.number,
                      date=doc.date.isoformat(), client=doc.client_id,
                      total=doc.total_amount)
            if doc_tag == "Sale":
                _set(el, payment_type=doc.payment_type, paid=doc.paid_amount,
                     debt=doc.debt_amount)
            else:
                _set(el, reason=doc.reason, restock=int(doc.restock))
            for item in doc.items.all():
                products[item.product_id] = item.product
                _set(ET.SubElement(el, "Item"), product=item.product_id,
                     quantity=item.quantity, price=item.price, amount=item.amount)
    for pay in payments:
        clients[pay.debt.client_id] = pay.debt.client
        _set(ET.SubElement(docs, "Payment"), id=pay.id, date=pay.date.isoformat(),
             client=pay.debt.client_id, amount=pay.amount, payment_type=pay.payment_type)

    catalog = ET.SubElement(root, "Catalog")
    for p in products.values():
        _set(ET.SubElement(catalog, "Product"), id=p.id, sku=p.sku, name=p.name,
             barcode=p.barcode)
    counterparties = ET.SubElement(root, "Clients")
    for c in clients.values():
        _set(ET.SubElement(counterparties, "Client"), id=c.id, name=c.name, inn=c.inn,
             phone=c.phone, address=c.address)
    root.append(docs)
    ET.indent(root)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _safe(value) -> str:
    """CSV injection himoyasi: Excel formulasi sifatida bajarilmasin."""
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(_FORMULA_START) else text


def export_1c_csv(*, date_from: date_cls, date_to: date_cls, branch=None) -> bytes:
    sales, returns, payments = _documents(date_from, date_to, branch)
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(CSV_HEADER)
    for doc_type, rows in (("SALE", sales), ("RETURN", returns)):
        for doc in rows:
            payment = getattr(doc, "payment_type", "")
            for item in doc.items.all():
                writer.writerow([
                    doc_type, doc.number, doc.date.isoformat(), doc.client_id,
                    _safe(doc.client.name), _safe(doc.client.inn), _safe(item.product.sku),
                    _safe(item.product.name), item.quantity, item.price, item.amount, payment,
                ])
    for pay in payments:
        client = pay.debt.client
        writer.writerow(["PAYMENT", "", pay.date.isoformat(), client.id, _safe(client.name),
                         _safe(client.inn), "", "", "", "", pay.amount, pay.payment_type])
    # BOM — Excel/1C kirill va o'zbekcha harflarni to'g'ri ochishi uchun
    return ("﻿" + buf.getvalue()).encode("utf-8")
