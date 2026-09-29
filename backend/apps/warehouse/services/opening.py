"""Tovar va ta'minotchi boshlang'ich qoldiqlari — ro'yxat va ommaviy kiritish."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Q, QuerySet

from apps.catalog.models import Product
from apps.core.services.opening import audit_bulk, bulk_result, plan_deltas, sheet_row

from ..constants import MovementType, SupplierTxType
from ..models import Stock, Supplier, Warehouse
from .stock import apply_movement
from .supplier_balance import supplier_apply

_ZERO = Decimal("0")
DEFAULT_NOTE = "Boshlang'ich qoldiq (ro'yxat)"


def _stock_products(warehouse: Warehouse) -> QuerySet[Product]:
    """Faol tovarlar + qoldig'i bor nofaollar (ularni ham tuzatish mumkin bo'lsin)."""
    with_stock = Stock.objects.filter(warehouse=warehouse).exclude(quantity=_ZERO)
    return Product.objects.filter(
        Q(is_active=True) | Q(id__in=with_stock.values("product_id"))
    ).order_by("name", "pk")


def stock_opening_sheet(warehouse: Warehouse) -> list[dict]:
    current = dict(
        Stock.objects.filter(warehouse=warehouse).values_list("product_id", "quantity")
    )
    return [
        sheet_row(id=p.id, name=p.name, code=p.sku, current=current.get(p.id, _ZERO))
        for p in _stock_products(warehouse)
    ]


@transaction.atomic
def stock_opening_bulk(
    *, warehouse: Warehouse, rows: list[dict], note: str, user
) -> dict:
    products = {
        p.id: p
        for p in _stock_products(warehouse).filter(id__in=[row["id"] for row in rows])
    }
    current = dict.fromkeys(products, _ZERO)
    current.update(
        Stock.objects.select_for_update()
        .filter(warehouse=warehouse, product_id__in=products)
        .values_list("product_id", "quantity")
    )
    changes = plan_deltas(rows, current)
    for product_id, delta in changes:
        if delta != _ZERO:
            apply_movement(
                warehouse=warehouse, product=products[product_id], quantity=delta,
                movement_type=MovementType.OPENING_BALANCE, user=user,
                note=note or DEFAULT_NOTE,
            )
    audit_bulk(user=user, kind="stock", note=note, changes=changes)
    return bulk_result(changes)


def supplier_opening_sheet() -> list[dict]:
    return [
        sheet_row(id=s.id, name=s.name, code=s.phone, current=s.balance)
        for s in Supplier.objects.filter(is_active=True).order_by("name", "pk")
    ]


@transaction.atomic
def supplier_opening_bulk(*, rows: list[dict], note: str, user) -> dict:
    suppliers = {
        s.id: s
        for s in Supplier.objects.select_for_update().filter(
            is_active=True, id__in=[row["id"] for row in rows]
        )
    }
    changes = plan_deltas(rows, {pk: s.balance for pk, s in suppliers.items()})
    for supplier_id, delta in changes:
        if delta != _ZERO:
            supplier_apply(
                supplier=suppliers[supplier_id],
                transaction_type=SupplierTxType.OPENING_BALANCE,
                amount=delta, note=note or DEFAULT_NOTE, user=user,
            )
    audit_bulk(user=user, kind="supplier", note=note, changes=changes)
    return bulk_result(changes)
