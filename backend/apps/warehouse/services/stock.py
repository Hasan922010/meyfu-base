"""Qoldiq harakati — service layer (CLAUDE.md 5.2, 7.8).

Barcha qoldiq o'zgarishlari SHU YERDAN o'tadi:
  - transaction.atomic() + select_for_update()
  - qoldiq hech qachon manfiy bo'lmaydi
  - har o'zgarish uchun append-only StockMovement yoziladi (balance_after bilan)
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from apps.catalog.models import Product
from apps.core.exceptions import InsufficientStock

from ..constants import MovementType
from ..models import Stock, StockMovement, Warehouse

_ZERO = Decimal("0")


def _qty(value: Decimal) -> str:
    """Xabar uchun miqdor: 1320.000 -> "1320", 2.500 -> "2.5"."""
    return format(value.normalize(), "f")


@transaction.atomic
def apply_movement(
    *,
    warehouse: Warehouse,
    product: Product,
    quantity: Decimal,
    movement_type: str,
    user=None,
    reference_type: str = "",
    reference_id: str = "",
    from_location: str = "",
    to_location: str = "",
    note: str = "",
) -> StockMovement:
    """Bitta ombor+mahsulot qoldig'ini `quantity` ga o'zgartiradi (ishorali).

    quantity > 0 — kirim, quantity < 0 — chiqim.
    """
    if quantity == _ZERO:
        raise ValueError("quantity 0 bo'lishi mumkin emas")

    stock, _created = Stock.objects.select_for_update().get_or_create(
        warehouse=warehouse,
        product=product,
        defaults={"quantity": _ZERO},
    )

    new_quantity = stock.quantity + quantity
    if new_quantity < _ZERO:
        raise InsufficientStock(
            message=(
                f"«{product.name}» — omborda faqat {_qty(stock.quantity)} "
                f"{product.unit.short_name} bor"
            ),
            details={
                "warehouse_id": str(warehouse.id),
                "product_id": str(product.id),
                "available": str(stock.quantity),
                "requested": str(-quantity),
            },
        )

    alert_level = Decimal(str(product.min_stock_alert or 0))
    was_above = stock.quantity > alert_level
    stock.quantity = new_quantity
    stock.save(update_fields=["quantity", "updated_at"])

    # Kam qoldiq ogohlantirishi — faqat chegaradan o'tganda (CLAUDE.md 11)
    if alert_level > _ZERO and new_quantity <= alert_level and was_above:
        from realtime.broadcast import broadcast

        payload = {
            "product_id": str(product.id), "product_name": product.name,
            "warehouse": warehouse.name, "quantity": str(new_quantity),
            "alert_level": str(product.min_stock_alert),
        }
        broadcast("admin_dashboard", "stock.low", payload)
        broadcast(f"warehouse_{warehouse.id}", "stock.low", payload)

    return StockMovement.objects.create(
        movement_type=movement_type,
        warehouse=warehouse,
        product=product,
        quantity=quantity,
        balance_after=new_quantity,
        from_location=from_location,
        to_location=to_location,
        reference_type=reference_type,
        reference_id=str(reference_id),
        user=user,
        note=note,
        created_by=user,
    )


@transaction.atomic
def transfer(
    *,
    product: Product,
    quantity: Decimal,
    source: Warehouse,
    target: Warehouse,
    user=None,
    note: str = "",
) -> tuple[StockMovement, StockMovement]:
    """Ikki ombor o'rtasida ko'chirish — ikkita jurnal yozuvi."""
    if quantity <= _ZERO:
        raise ValueError("quantity musbat bo'lishi kerak")

    out_mv = apply_movement(
        warehouse=source, product=product, quantity=-quantity,
        movement_type=MovementType.TRANSFER, user=user,
        from_location=source.name, to_location=target.name, note=note,
    )
    in_mv = apply_movement(
        warehouse=target, product=product, quantity=quantity,
        movement_type=MovementType.TRANSFER, user=user,
        from_location=source.name, to_location=target.name, note=note,
    )
    return out_mv, in_mv


@transaction.atomic
def reserve_stock(
    *, warehouse: Warehouse, product: Product, quantity: Decimal
) -> Stock:
    """Mavjud qoldiqdan `quantity` ni band qiladi (yuklama yuborilganda)."""
    if quantity <= _ZERO:
        raise ValueError("quantity musbat bo'lishi kerak")

    stock, _created = Stock.objects.select_for_update().get_or_create(
        warehouse=warehouse, product=product, defaults={"quantity": _ZERO}
    )
    if stock.available_quantity < quantity:
        raise InsufficientStock(
            message=(
                f"«{product.name}» — omborda {_qty(stock.available_quantity)} "
                f"{product.unit.short_name} bo'sh, {_qty(quantity)} so'ralgan"
            ),
            details={
                "available": str(stock.available_quantity),
                "requested": str(quantity),
            },
        )
    stock.reserved_quantity += quantity
    stock.save(update_fields=["reserved_quantity", "updated_at"])
    return stock


@transaction.atomic
def release_reservation(
    *, warehouse: Warehouse, product: Product, quantity: Decimal
) -> None:
    """Bandlashni bekor qiladi (yuklama tasdiqlanganda yoki bekor qilinganda)."""
    stock = (
        Stock.objects.select_for_update()
        .filter(warehouse=warehouse, product=product)
        .first()
    )
    if stock is None:
        return
    stock.reserved_quantity = max(_ZERO, stock.reserved_quantity - quantity)
    stock.save(update_fields=["reserved_quantity", "updated_at"])


def stock_matches_journal(warehouse: Warehouse, product: Product) -> bool:
    """5.2 butunlik: Stock.quantity == SUM(StockMovement.quantity)?"""
    from django.db.models import Sum

    journal = StockMovement.objects.filter(
        warehouse=warehouse, product=product
    ).aggregate(s=Sum("quantity"))["s"] or _ZERO
    current = Stock.objects.filter(
        warehouse=warehouse, product=product
    ).values_list("quantity", flat=True).first() or _ZERO
    return journal == current
