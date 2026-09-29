"""Mijoz bilan solishtirma dalolatnoma — akt-sverka (v5: C2).

Balans manbai — qarz jurnali (Debt + DebtPayment), mijozning `current_debt`i bilan bir xil:
  debet  = sotuv summasi (yoki boshlang'ich qarz)
  kredit = sotuvda to'langani + keyingi qarz to'lovlari
  saldo  = boshlang'ich saldo + debet − kredit
To'liq naqd sotuv ham ko'rinadi (debet = kredit, saldoga ta'sir qilmaydi).
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date as date_cls
from decimal import Decimal
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.core.models import CompanySettings
from apps.sales.models import Debt, DebtPayment, Sale

from .models import Client

_ZERO = Decimal("0")
_ACTIVE = ("COMPLETED", "FLAGGED")


@dataclass(frozen=True)
class Entry:
    date: date_cls
    document: str
    description: str
    debit: Decimal
    credit: Decimal


def _debt_date(debt: Debt) -> date_cls:
    return debt.sale.date if debt.sale_id else timezone.localdate(debt.created_at)


def _entries(client: Client) -> list[Entry]:
    entries: list[Entry] = []
    debts = Debt.objects.filter(client=client).select_related("sale")
    debt_sale_ids = set()
    for debt in debts:
        if debt.sale_id:
            debt_sale_ids.add(debt.sale_id)
            sale = debt.sale
            entries.append(Entry(
                sale.date, sale.number, "Sotuv (qarzga)",
                sale.total_amount, sale.total_amount - debt.amount,
            ))
        else:
            entries.append(Entry(
                _debt_date(debt), "", "Boshlang'ich qarz", debt.amount, _ZERO,
            ))
    cash_sales = Sale.objects.filter(client=client, status__in=_ACTIVE).exclude(
        id__in=debt_sale_ids
    )
    for sale in cash_sales:
        entries.append(Entry(sale.date, sale.number, "Sotuv (to'langan)",
                             sale.total_amount, sale.total_amount))
    payments = DebtPayment.objects.filter(debt__client=client)
    for pay in payments:
        entries.append(Entry(pay.date, "", f"Qarz to'lovi ({pay.get_payment_type_display()})",
                             _ZERO, pay.amount))
    entries.sort(key=lambda e: (e.date, e.document))
    return entries


def client_statement(client: Client, *, date_from: date_cls, date_to: date_cls) -> dict:
    entries = _entries(client)
    opening = sum((e.debit - e.credit for e in entries if e.date < date_from), _ZERO)
    period = [e for e in entries if date_from <= e.date <= date_to]
    debit = sum((e.debit for e in period), _ZERO)
    credit = sum((e.credit for e in period), _ZERO)
    balance = opening
    rows = []
    for e in period:
        balance += e.debit - e.credit
        rows.append({
            "date": e.date.isoformat(), "document": e.document,
            "description": e.description, "debit": str(e.debit),
            "credit": str(e.credit), "balance": str(balance),
        })
    return {
        "client": {"id": str(client.id), "name": client.name, "phone": client.phone},
        "date_from": date_from.isoformat(), "date_to": date_to.isoformat(),
        "opening_balance": str(opening), "debit": str(debit), "credit": str(credit),
        "closing_balance": str(opening + debit - credit),
        "rows": rows,
    }


def _fmt(value: str) -> str:
    return f"{Decimal(value):,.2f}".replace(",", " ")


def _ddmmyyyy(iso: str) -> str:
    return date_cls.fromisoformat(iso).strftime("%d.%m.%Y")


def statement_pdf(data: dict) -> bytes:
    company = CompanySettings.load()
    # Paragraph XML sifatida o'qiydi — nomlardagi & < > buzmasin
    company_name = escape(company.legal_name or company.name or "Kompaniya")
    client_name = escape(data["client"]["name"])
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm, title="Akt-sverka",
    )
    styles = getSampleStyleSheet()
    period = f"{_ddmmyyyy(data['date_from'])} - {_ddmmyyyy(data['date_to'])}"
    elements = [
        Paragraph("Solishtirma dalolatnoma (akt-sverka)", styles["Title"]),
        Paragraph(f"{company_name} va {client_name}", styles["Heading3"]),
        Paragraph(f"Davr: {period}", styles["Normal"]),
        Spacer(1, 5 * mm),
    ]
    table_rows = [["Sana", "Hujjat", "Mazmuni", "Debet", "Kredit", "Saldo"],
                  ["", "", "Boshlang'ich saldo", "", "", _fmt(data["opening_balance"])]]
    for r in data["rows"]:
        table_rows.append([_ddmmyyyy(r["date"]), r["document"], r["description"],
                           _fmt(r["debit"]), _fmt(r["credit"]), _fmt(r["balance"])])
    table_rows.append(["", "", "Jami aylanma", _fmt(data["debit"]), _fmt(data["credit"]), ""])
    table_rows.append(["", "", "Yakuniy saldo", "", "", _fmt(data["closing_balance"])])
    table = Table(table_rows, repeatRows=1,
                  colWidths=[22 * mm, 30 * mm, 50 * mm, 26 * mm, 26 * mm, 26 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -2), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
    ]))
    closing = Decimal(data["closing_balance"])
    if closing > _ZERO:
        summary = f"{client_name} qarzi: {_fmt(data['closing_balance'])} so'm."
    elif closing < _ZERO:
        summary = f"{company_name} qarzi (ortiqcha to'lov): {_fmt(str(-closing))} so'm."
    else:
        summary = "O'zaro qarzdorlik yo'q."
    elements += [
        table, Spacer(1, 6 * mm), Paragraph(summary, styles["Normal"]), Spacer(1, 14 * mm),
        Table([[f"{company_name}", data["client"]["name"]],
               ["_______________ (imzo)", "_______________ (imzo)"]],
              colWidths=[90 * mm, 90 * mm]),
    ]
    doc.build(elements)
    return buffer.getvalue()
