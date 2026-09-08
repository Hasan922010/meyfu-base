"""ABC tahlil (Pareto) — mahsulot yoki mijoz bo'yicha (CLAUDE.md 14).

A: birinchi 80% aylanma · B: keyingi 15% · C: qolgan 5%.
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

_DIMS = {
    "product": ("product__name", "product"),
    "client": ("sale__client__name", "client"),
    "category": ("product__category__name", "category"),
}

_A_CUT = Decimal("80")
_B_CUT = Decimal("95")


def _money(v) -> str:
    return str((v or _ZERO).quantize(Decimal("0.01")))


def abc_analysis(
    *, dimension: str = "product", date_from: date_cls, date_to: date_cls
) -> dict:
    if dimension not in _DIMS:
        raise BusinessError(
            message=f"ABC uchun noma'lum o'lcham: {dimension}",
            code="INVALID_DIMENSION", status_code=400,
        )
    lookup, key = _DIMS[dimension]

    rows = list(
        SaleItem.objects.filter(
            sale__date__gte=date_from, sale__date__lte=date_to,
            sale__status__in=_ACTIVE,
        )
        .values(lookup)
        .annotate(
            amount=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC),
            profit=Coalesce(Sum("profit"), Value(_ZERO), output_field=_DEC),
            qty=Coalesce(Sum("quantity"), Value(_ZERO), output_field=_DEC),
            count=Count("sale_id", distinct=True),
        )
        .order_by("-amount")
    )

    grand_total = sum((r["amount"] for r in rows), _ZERO)
    classes = {"A": 0, "B": 0, "C": 0}
    class_amount = {"A": _ZERO, "B": _ZERO, "C": _ZERO}
    cumulative = _ZERO
    out = []
    for r in rows:
        # sinf shu qatordan OLDINGI jami ulush bo'yicha — eng yirigi doim A
        cum_before = (cumulative / grand_total * 100) if grand_total else _ZERO
        cumulative += r["amount"]
        cum_pct = (cumulative / grand_total * 100) if grand_total else _ZERO
        if cum_before < _A_CUT:
            cls = "A"
        elif cum_before < _B_CUT:
            cls = "B"
        else:
            cls = "C"
        classes[cls] += 1
        class_amount[cls] += r["amount"]
        out.append({
            key: r[lookup] or "—",
            "amount": _money(r["amount"]),
            "profit": _money(r["profit"]),
            "share_percent": (
                round(float(r["amount"] / grand_total * 100), 2)
                if grand_total else 0.0
            ),
            "cumulative_percent": round(float(cum_pct), 2),
            "abc_class": cls,
        })

    return {
        "dimension": dimension,
        "key": key,
        "date_from": str(date_from),
        "date_to": str(date_to),
        "grand_total": _money(grand_total),
        "summary": [
            {
                "abc_class": c,
                "count": classes[c],
                "amount": _money(class_amount[c]),
                "amount_percent": (
                    round(float(class_amount[c] / grand_total * 100), 1)
                    if grand_total else 0.0
                ),
            }
            for c in ("A", "B", "C")
        ],
        "rows": out,
    }


def abc_rows_for_export(payload: dict) -> list[list]:
    key = payload["key"]
    header = [key.capitalize(), "Summa", "Foyda", "Ulush %", "Jami %", "Sinf"]
    rows: list[list] = [header]
    for r in payload["rows"]:
        rows.append([
            r[key], float(r["amount"]), float(r["profit"]),
            r["share_percent"], r["cumulative_percent"], r["abc_class"],
        ])
    return rows
