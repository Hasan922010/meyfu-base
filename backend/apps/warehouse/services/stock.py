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
        from realtime.broadcast import broadcast, broadcast_admin

        payload = {
            "product_id": str(product.id), "product_name": product.name,
            "warehouse": warehouse.name, "quantity": str(new_quantity),
            "alert_level": str(product.min_stock_alert),
        }
        broadcast_admin(warehouse.id if warehouse.is_branch else None, "stock.low", payload)
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


@transaction.atomic
def convert_warehouse_history_to_packages() -> dict[str, int]:
    """pack_quantity > 1 bo'lgan mahsulotlar uchun eski dona harakatlarini qadoqqa o'girib, qoldiqni qayta hisoblaydi."""
    from django.db.models import Sum

    from apps.core.models import AuditLog
    from apps.orders.models import OrderItem
    from apps.sales.models import SaleItem

    from ..models import (
        InventoryCountItem,
        LoadingItem,
        PurchaseItem,
        TransferItem,
        VanStock,
    )

    done_ids = set(
        AuditLog.objects.filter(action="stock.converted_to_packages")
        .values_list("object_id", flat=True)
    )
    products = Product.objects.select_for_update().filter(pack_quantity__gt=Decimal("1"))
    converted = 0
    movements_updated = 0

    for product in products:
        if str(product.id) in done_ids:
            continue
        pack_qty = product.pack_quantity
        q3 = Decimal("0.001")
        m2 = Decimal("0.01")

        # 1. StockMovement va balance_after ni ombor bo'yicha ketma-ket qayta hisoblash
        by_wh: dict = {}
        for mv in StockMovement.objects.filter(product=product).order_by("warehouse_id", "created_at", "pk"):
            new_q = (mv.quantity / pack_qty).quantize(q3)
            bal = by_wh.get(mv.warehouse_id, _ZERO) + new_q
            by_wh[mv.warehouse_id] = bal
            StockMovement.objects.filter(pk=mv.pk).update(quantity=new_q, balance_after=bal)
            movements_updated += 1

        # 2. Hujjat qatorlari (kirim, buyurtma, sotuv, yuklama, ko'chirish, inventarizatsiya)
        for it in PurchaseItem.objects.filter(product=product):
            PurchaseItem.objects.filter(pk=it.pk).update(
                quantity=max((it.quantity / pack_qty).quantize(q3), q3),
                cost_price=(it.cost_price * pack_qty).quantize(m2),
            )
        for it in OrderItem.objects.filter(product=product):
            OrderItem.objects.filter(pk=it.pk).update(
                quantity=(it.quantity / pack_qty).quantize(q3),
                delivered_quantity=(it.delivered_quantity / pack_qty).quantize(q3),
                reserved_quantity=(it.reserved_quantity / pack_qty).quantize(q3),
                price=(it.price * pack_qty).quantize(m2),
            )
        for it in SaleItem.objects.filter(product=product):
            SaleItem.objects.filter(pk=it.pk).update(
                quantity=(it.quantity / pack_qty).quantize(q3),
                price=(it.price * pack_qty).quantize(m2),
                cost_price=(it.cost_price * pack_qty).quantize(m2),
            )
        for it in LoadingItem.objects.filter(product=product):
            LoadingItem.objects.filter(pk=it.pk).update(
                quantity=(it.quantity / pack_qty).quantize(q3),
                price=(it.price * pack_qty).quantize(m2),
            )
        for it in TransferItem.objects.filter(product=product):
            upd = {"quantity": (it.quantity / pack_qty).quantize(q3)}
            if it.received_quantity is not None:
                upd["received_quantity"] = (it.received_quantity / pack_qty).quantize(q3)
            TransferItem.objects.filter(pk=it.pk).update(**upd)
        for it in InventoryCountItem.objects.filter(product=product):
            upd = {"system_quantity": (it.system_quantity / pack_qty).quantize(q3)}
            if it.actual_quantity is not None:
                upd["actual_quantity"] = (it.actual_quantity / pack_qty).quantize(q3)
            if it.difference is not None:
                upd["difference"] = (it.difference / pack_qty).quantize(q3)
            InventoryCountItem.objects.filter(pk=it.pk).update(**upd)

        # 3. Stock va VanStock qoldiqlarini qayta hisoblash
        for st in Stock.objects.select_for_update().filter(product=product):
            total_q = (
                StockMovement.objects.filter(warehouse_id=st.warehouse_id, product=product)
                .aggregate(s=Sum("quantity"))["s"]
                or _ZERO
            )
            st.quantity = max(total_q, _ZERO)
            st.reserved_quantity = max((st.reserved_quantity / pack_qty).quantize(q3), _ZERO)
            st.save(update_fields=["quantity", "reserved_quantity", "updated_at"])

        for vs in VanStock.objects.select_for_update().filter(product=product):
            vs.quantity = max((vs.quantity / pack_qty).quantize(q3), _ZERO)
            vs.save(update_fields=["quantity", "updated_at"])

        AuditLog.objects.create(
            action="stock.converted_to_packages",
            model_name="Product",
            object_id=str(product.id),
            changes={"pack_quantity": str(pack_qty)},
        )
        converted += 1

    return {"products": converted, "movements": movements_updated}
