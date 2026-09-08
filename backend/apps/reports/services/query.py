"""Hisobot konstruktori — moslashuvchan agregatsiya (CLAUDE.md 13, 14).

Bitta o'lcham (dimension) bo'yicha guruhlash + filtrlar. Metriklar: summa, foyda,
margin %, miqdor, sotuvlar soni. Barchasi SaleItem darajasida (foyda snapshot bilan).
"""
from __future__ import annotations

from datetime import date as date_cls
from decimal import Decimal

from django.db.models import Count, DecimalField, Sum, Value
from django.db.models.functions import Coalesce

from apps.core.exceptions import BusinessError
from apps.sales.models import SaleItem

_ZERO = Decimal("0")
_DEC = DecimalField(max_digits=18, decimal_places=2)
_ACTIVE = ("COMPLETED", "FLAGGED")

# dimension -> (ORM lookup, javob kaliti)
DIMENSIONS: dict[str, tuple[str, str]] = {
    "day": ("sale__date", "day"),
    "distributor": ("sale__distributor__full_name", "distributor"),
    "product": ("product__name", "product"),
    "category": ("product__category__name", "category"),
    "client": ("sale__client__name", "client"),
    "route": ("sale__client__route__name", "route"),
    "payment_type": ("sale__payment_type", "payment_type"),
}

FILTERS: dict[str, str] = {
    "distributor": "sale__distributor_id",
    "product": "product_id",
    "category": "product__category_id",
    "client": "sale__client_id",
    "route": "sale__client__route_id",
    "payment_type": "sale__payment_type",
}


def _money(v) -> str:
    return str((v or _ZERO).quantize(Decimal("0.01")))


def _qty(v) -> str:
    return str((v or _ZERO).quantize(Decimal("0.001")))


def report_query(
    *,
    dimension: str,
    date_from: date_cls,
    date_to: date_cls,
    filters: dict | None = None,
    limit: int = 500,
) -> dict:
    if dimension not in DIMENSIONS:
        raise BusinessError(
            message=f"Noma'lum o'lcham: {dimension}",
            code="INVALID_DIMENSION", status_code=400,
        )

    lookup, key = DIMENSIONS[dimension]
    qs = SaleItem.objects.filter(
        sale__date__gte=date_from,
        sale__date__lte=date_to,
        sale__status__in=_ACTIVE,
    )
    for name, value in (filters or {}).items():
        if value and name in FILTERS:
            qs = qs.filter(**{FILTERS[name]: value})

    rows_qs = (
        qs.values(lookup)
        .annotate(
            amount=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC),
            profit=Coalesce(Sum("profit"), Value(_ZERO), output_field=_DEC),
            qty=Coalesce(Sum("quantity"), Value(_ZERO), output_field=_DEC),
            count=Count("sale_id", distinct=True),
        )
        .order_by("-amount")[:limit]
    )

    rows = []
    total_amount = _ZERO
    total_profit = _ZERO
    total_qty = _ZERO
    total_count = 0
    for r in rows_qs:
        label = r[lookup]
        if dimension == "day":
            label = str(label)
        rows.append({
            key: label if label is not None else "—",
            "amount": _money(r["amount"]),
            "profit": _money(r["profit"]),
            "qty": _qty(r["qty"]),
            "count": r["count"],
            "margin_percent": (
                round(float(r["profit"] / r["amount"] * 100), 1)
                if r["amount"] else 0.0
            ),
        })
        total_amount += r["amount"]
        total_profit += r["profit"]
        total_qty += r["qty"]
        total_count += r["count"]

    return {
        "dimension": dimension,
        "date_from": str(date_from),
        "date_to": str(date_to),
        "key": key,
        "rows": rows,
        "totals": {
            "amount": _money(total_amount),
            "profit": _money(total_profit),
            "qty": _qty(total_qty),
            "count": total_count,
            "margin_percent": (
                round(float(total_profit / total_amount * 100), 1)
                if total_amount else 0.0
            ),
        },
    }


def report_query_rows_for_export(payload: dict) -> list[list]:
    key = payload["key"]
    header = [key.capitalize(), "Summa", "Foyda", "Margin %", "Miqdor", "Sotuvlar"]
    rows: list[list] = [header]
    for r in payload["rows"]:
        rows.append([
            r[key], float(r["amount"]), float(r["profit"]),
            r["margin_percent"], float(r["qty"]), r["count"],
        ])
    t = payload["totals"]
    rows.append([
        "JAMI", float(t["amount"]), float(t["profit"]),
        t["margin_percent"], float(t["qty"]), t["count"],
    ])
    return rows
