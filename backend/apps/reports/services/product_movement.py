"""Tovar harakati va sotuv turi (Oddiy sotuv vs Bepul Bonus) hisoboti.

Har bir tovar bo'yicha:
  - Pullik sotilgan miqdor va summa
  - Aksiya bo'yicha bepul berilgan bonus miqdor va uning tannarxi
  - Jami ombor/mashinadan chiqim (Sotuv + Bonus)
"""
from __future__ import annotations

from datetime import date as date_cls
from decimal import Decimal
from typing import Any

from django.db.models import Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce

from apps.catalog.models import Product
from apps.core.branch import NO_BRANCH
from apps.sales.models import SaleItem

_ZERO = Decimal("0")
_CENT = Decimal("0.01")
_QTY_DEC = Decimal("0.001")


def _money(val: Any) -> str:
    return str((val or _ZERO).quantize(_CENT))


def _qty(val: Any) -> str:
    return str((val or _ZERO).quantize(_QTY_DEC))


def product_movement_report(
    *,
    date_from: date_cls,
    date_to: date_cls,
    product_id: str | None = None,
    category_id: str | None = None,
    branch=None,
) -> dict[str, Any]:
    qs = SaleItem.objects.filter(
        sale__date__gte=date_from,
        sale__date__lte=date_to,
        sale__status__in=("COMPLETED", "FLAGGED"),
    )

    if branch and branch is not NO_BRANCH:
        qs = qs.filter(sale__branch=branch)
    if product_id:
        qs = qs.filter(product_id=product_id)
    if category_id:
        qs = qs.filter(product__category_id=category_id)

    # Mahsulot bo'yicha agregatsiya
    aggregated = (
        qs.values("product_id")
        .annotate(
            sold_qty=Coalesce(
                Sum("quantity", filter=Q(is_bonus=False)),
                Value(_ZERO),
                output_field=DecimalField(max_digits=16, decimal_places=3),
            ),
            sold_amount=Coalesce(
                Sum("amount", filter=Q(is_bonus=False)),
                Value(_ZERO),
                output_field=DecimalField(max_digits=16, decimal_places=2),
            ),
            bonus_qty=Coalesce(
                Sum("quantity", filter=Q(is_bonus=True)),
                Value(_ZERO),
                output_field=DecimalField(max_digits=16, decimal_places=3),
            ),
            bonus_cost=Coalesce(
                Sum(
                    F("quantity") * F("cost_price"),
                    filter=Q(is_bonus=True),
                ),
                Value(_ZERO),
                output_field=DecimalField(max_digits=16, decimal_places=2),
            ),
            total_sales_count=Count("sale_id", distinct=True),
        )
        .order_by("-sold_amount", "-sold_qty")
    )

    # Mahsulot ma'lumotlarini olish
    product_ids = [r["product_id"] for r in aggregated]
    products = {
        str(p.id): p
        for p in Product.objects.select_related("category", "unit").filter(id__in=product_ids)
    }

    rows: list[dict[str, Any]] = []
    total_sold_qty = _ZERO
    total_sold_amount = _ZERO
    total_bonus_qty = _ZERO
    total_bonus_cost = _ZERO
    total_movement_qty = _ZERO

    for r in aggregated:
        pid = str(r["product_id"])
        prod = products.get(pid)
        if not prod:
            continue

        s_qty = r["sold_qty"] or _ZERO
        s_amt = r["sold_amount"] or _ZERO
        b_qty = r["bonus_qty"] or _ZERO
        b_cost = r["bonus_cost"] or _ZERO
        tot_qty = s_qty + b_qty

        avg_price = (s_amt / s_qty).quantize(_CENT) if s_qty > _ZERO else _ZERO

        total_sold_qty += s_qty
        total_sold_amount += s_amt
        total_bonus_qty += b_qty
        total_bonus_cost += b_cost
        total_movement_qty += tot_qty

        rows.append({
            "product_id": pid,
            "product_name": prod.name,
            "product_sku": prod.sku,
            "category_name": prod.category.name if prod.category else "—",
            "unit": prod.unit.short_name if prod.unit else "dona",
            "has_bonus": prod.has_bonus,
            "bonus_trigger_qty": str(prod.bonus_trigger_qty or 0),
            "bonus_reward_qty": str(prod.bonus_reward_qty or 0),
            "sold_qty": _qty(s_qty),
            "sold_amount": _money(s_amt),
            "bonus_qty": _qty(b_qty),
            "bonus_cost": _money(b_cost),
            "total_qty": _qty(tot_qty),
            "avg_price": _money(avg_price),
            "sales_count": r["total_sales_count"],
        })

    bonus_ratio = (
        ((total_bonus_qty / total_movement_qty) * Decimal("100")).quantize(_CENT)
        if total_movement_qty > _ZERO
        else _ZERO
    )

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "rows": rows,
        "summary": {
            "total_products": len(rows),
            "total_sold_qty": _qty(total_sold_qty),
            "total_sold_amount": _money(total_sold_amount),
            "total_bonus_qty": _qty(total_bonus_qty),
            "total_bonus_cost": _money(total_bonus_cost),
            "total_movement_qty": _qty(total_movement_qty),
            "bonus_ratio_percent": str(bonus_ratio),
        },
    }


def product_movement_rows_for_export(data: dict[str, Any]) -> list[dict[str, Any]]:
    export_rows = []
    for r in data.get("rows", []):
        export_rows.append({
            "Mahsulot": r["product_name"],
            "Artikul (SKU)": r["product_sku"],
            "Kategoriya": r["category_name"],
            "Birlik": r["unit"],
            "Sotilgan (pullik)": r["sold_qty"],
            "Sotuv summasi (so'm)": r["sold_amount"],
            "Bonus berilgan (bepul)": r["bonus_qty"],
            "Bonus tannarxi (so'm)": r["bonus_cost"],
            "Jami chiqim": r["total_qty"],
            "O'rtacha narx": r["avg_price"],
            "Sotuvlar soni": r["sales_count"],
        })
    return export_rows

