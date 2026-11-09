"""Tannarx va sotuv narxi farqi (Kamomad / Ortiqcha) hisoboti.

Tovarlar profilida belgilangan tovarlar (yoki barcha tovarlar) bo'yicha
belgilangan tannarxdan qimmat yoki arzon sotilgan operatsiyalar tahlili.
Ustunlar: Sana, Tovar nomi, Soni, Narxi, Summa, Kamomad, Ortiqcha.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.core.branch import NO_BRANCH
from apps.sales.models import SaleItem

_ZERO = Decimal("0")
_CENT = Decimal("0.01")


def price_variance_report(
    *,
    date_from,
    date_to,
    product_id: str | None = None,
    all_products: bool = False,
    branch=None,
) -> dict[str, Any]:
    qs = (
        SaleItem.objects.filter(
            sale__date__gte=date_from,
            sale__date__lte=date_to,
            sale__status__in=("COMPLETED", "FLAGGED"),
        )
        .select_related("sale", "product", "product__unit", "sale__distributor")
        .order_by("-sale__date", "-created_at")
    )

    if branch and branch is not NO_BRANCH:
        qs = qs.filter(sale__branch=branch)

    if product_id:
        qs = qs.filter(product_id=product_id)
    elif not all_products:
        # Faqat tovar profilida "tannarxdan farqni hisobotda kuzatish" (track_variance) yoqilgan tovarlar
        qs = qs.filter(product__track_variance=True)

    rows: list[dict[str, Any]] = []
    total_qty = _ZERO
    total_amount = _ZERO
    total_cost = _ZERO
    total_kamomad = _ZERO
    total_ortiqcha = _ZERO

    for item in qs:
        qty = item.quantity or _ZERO
        unit_price = item.price or _ZERO
        amount = item.amount or (qty * unit_price)
        cost_price = item.cost_price or item.product.cost_price or _ZERO
        cost_amount = (qty * cost_price).quantize(_CENT)

        # Farq: agar sotuv summasi tannarxdan kam bo'lsa -> Kamomad (zarar)
        # agar sotuv summasi tannarxdan ko'p bo'lsa -> Ortiqcha (marja/foyda)
        diff = amount - cost_amount
        if diff < _ZERO:
            kamomad = (-diff).quantize(_CENT)
            ortiqcha = _ZERO
        else:
            kamomad = _ZERO
            ortiqcha = diff.quantize(_CENT)

        total_qty += qty
        total_amount += amount
        total_cost += cost_amount
        total_kamomad += kamomad
        total_ortiqcha += ortiqcha

        rows.append({
            "id": str(item.id),
            "sale_id": str(item.sale_id),
            "date": item.sale.date.isoformat(),
            "product_id": str(item.product_id),
            "product_name": item.product.name,
            "product_sku": item.product.sku,
            "unit": item.product.unit.short_name if item.product.unit else "",
            "quantity": str(qty),
            "cost_price": str(cost_price),
            "price": str(unit_price),
            "amount": str(amount),
            "cost_amount": str(cost_amount),
            "kamomad": str(kamomad),
            "ortiqcha": str(ortiqcha),
            "distributor_name": item.sale.distributor.full_name,
        })

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "rows": rows,
        "summary": {
            "total_items": len(rows),
            "total_quantity": str(total_qty),
            "total_amount": str(total_amount.quantize(_CENT)),
            "total_cost": str(total_cost.quantize(_CENT)),
            "total_kamomad": str(total_kamomad.quantize(_CENT)),
            "total_ortiqcha": str(total_ortiqcha.quantize(_CENT)),
            "net_difference": str((total_ortiqcha - total_kamomad).quantize(_CENT)),
        },
    }

