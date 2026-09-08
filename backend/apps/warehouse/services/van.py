"""Mashina qoldig'i (VanStock) — service layer (CLAUDE.md 5.2)."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from apps.catalog.models import Product
from apps.core.exceptions import InsufficientStock

from ..constants import LoadingStatus
from ..models import LoadingItem, VanStock

_ZERO = Decimal("0")


@transaction.atomic
def van_apply(*, distributor, product: Product, quantity: Decimal) -> VanStock:
    """VanStock qoldig'ini `quantity` ga o'zgartiradi (ishorali). Manfiy — chiqim."""
    if quantity == _ZERO:
        raise ValueError("quantity 0 bo'lishi mumkin emas")

    vs, _created = VanStock.objects.select_for_update().get_or_create(
        distributor=distributor, product=product, defaults={"quantity": _ZERO}
    )
    new_quantity = vs.quantity + quantity
    if new_quantity < _ZERO:
        raise InsufficientStock(
            message=(
                f"Mashinada «{product.name}» faqat {vs.quantity} "
                f"{product.unit.short_name} bor"
            ),
            details={"available": str(vs.quantity), "requested": str(-quantity)},
        )
    vs.quantity = new_quantity
    vs.save(update_fields=["quantity", "updated_at"])
    return vs


def van_expected_quantity(distributor, product: Product) -> Decimal:
    """5.2: kutilgan mashina qoldig'i = tasdiqlangan yuklamalar − sotuv + qaytarish.

    CONFLICT holatidagi sotuvlar hisobga olinmaydi (admin hal qilmaguncha).
    Yopilgan kun yopishdagi kunlik qaytarishlar mashinadan chiqadi
    (`_settle_van`), shuning uchun ular ham ayiriladi.
    """
    loaded = LoadingItem.objects.filter(
        loading__distributor=distributor,
        loading__status__in=[LoadingStatus.CONFIRMED, LoadingStatus.CLOSED],
        product=product,
    ).aggregate(s=Sum("quantity"))["s"] or _ZERO

    try:
        from apps.sales.models import SaleItem, SaleReturnItem

        sold = SaleItem.objects.filter(
            sale__distributor=distributor,
            sale__status__in=["COMPLETED", "FLAGGED"],
            product=product,
        ).aggregate(s=Sum("quantity"))["s"] or _ZERO
        returned = SaleReturnItem.objects.filter(
            sale_return__distributor=distributor,
            sale_return__restock=True,
            product=product,
        ).aggregate(s=Sum("quantity"))["s"] or _ZERO
    except Exception:  # noqa: BLE001 — sales app hali migratsiya qilinmagan bo'lishi mumkin
        sold = returned = _ZERO

    try:
        from apps.dayclose.constants import DayCloseStatus
        from apps.dayclose.models import DailyReturnItem

        daily_returned = DailyReturnItem.objects.filter(
            daily_return__distributor=distributor,
            daily_return__day_close__status=DayCloseStatus.CLOSED,
            product=product,
        ).aggregate(s=Sum("quantity"))["s"] or _ZERO
    except Exception:  # noqa: BLE001 — dayclose app hali migratsiya qilinmagan bo'lishi mumkin
        daily_returned = _ZERO

    return loaded - sold + returned - daily_returned


def van_matches_loadings(distributor, product: Product) -> bool:
    """5.2 butunlik: VanStock == van_expected_quantity?"""
    current = (
        VanStock.objects.filter(distributor=distributor, product=product)
        .values_list("quantity", flat=True)
        .first()
        or _ZERO
    )
    return current == van_expected_quantity(distributor, product)
