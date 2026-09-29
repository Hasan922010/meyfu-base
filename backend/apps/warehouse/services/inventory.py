"""Inventarizatsiya — service layer (CLAUDE.md 5.1–5.3, 7.8).

To'ldirish: ombordagi barcha faol tovarlar (va qoldig'i bor nofaollar) joriy
qoldig'i bilan qatorga yoziladi. Tasdiqlash: sanalgan qatorlar bo'yicha farq
`apply_movement(ADJUSTMENT)` orqali yoziladi — qoldiq va jurnal mos qoladi.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.catalog.models import Product
from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog, DocumentSequence

from ..constants import InventoryStatus, MovementType
from ..models import InventoryCount, InventoryCountItem, Stock
from .stock import apply_movement

INVENTORY_PREFIX = "INV"
_ZERO = Decimal("0")


def assign_number(count: InventoryCount) -> str:
    """Hujjatga raqam beradi (agar bo'lmasa). atomic ichida chaqiring."""
    if not count.number:
        count.number = DocumentSequence.next_number(
            INVENTORY_PREFIX, year=count.date.year
        )
    return count.number


def lock_draft(count: InventoryCount) -> InventoryCount:
    """Hujjatni qulflaydi; qoralama bo'lmasa — tahrir rad etiladi. atomic ichida."""
    count = InventoryCount.objects.select_for_update().get(pk=count.pk)
    if count.status == InventoryStatus.CONFIRMED:
        raise BusinessError(
            message="Bu inventarizatsiya allaqachon tasdiqlangan.",
            code="ALREADY_CONFIRMED",
        )
    if count.status == InventoryStatus.CANCELLED:
        raise BusinessError(
            message="Bu inventarizatsiya bekor qilingan.", code="INVENTORY_CANCELLED"
        )
    return count


@transaction.atomic
def fill_inventory(count: InventoryCount, user=None) -> InventoryCount:
    """Qatorlarni joriy qoldiq bilan to'ldiradi yoki yangilaydi.

    Kiritilgan `actual_qty` saqlanadi — faqat hisobdagi qoldiq va tannarx
    yangilanadi, yangi tovarlar qo'shiladi.
    """
    count = lock_draft(count)
    stock_by_product = dict(
        Stock.objects.filter(warehouse=count.warehouse).values_list(
            "product_id", "quantity"
        )
    )
    with_stock = [pid for pid, qty in stock_by_product.items() if qty != _ZERO]
    products = Product.objects.filter(Q(is_active=True) | Q(id__in=with_stock))
    existing = {item.product_id: item for item in count.items.all()}

    to_create: list[InventoryCountItem] = []
    to_update: list[InventoryCountItem] = []
    for product in products:
        expected = stock_by_product.get(product.id, _ZERO)
        item = existing.get(product.id)
        if item is None:
            to_create.append(
                InventoryCountItem(
                    count=count, product=product, expected_qty=expected,
                    cost_price=product.cost_price, created_by=user,
                )
            )
        elif item.expected_qty != expected or item.cost_price != product.cost_price:
            item.expected_qty = expected
            item.cost_price = product.cost_price
            to_update.append(item)

    InventoryCountItem.objects.bulk_create(to_create)
    InventoryCountItem.objects.bulk_update(to_update, ["expected_qty", "cost_price"])
    return count


def _stale_rows(items: list[InventoryCountItem], current: dict) -> list[dict]:
    return [
        {
            "product_id": str(item.product_id),
            "product_name": item.product.name,
            "expected": str(item.expected_qty),
            "current": str(current.get(item.product_id, _ZERO)),
        }
        for item in items
        if current.get(item.product_id, _ZERO) != item.expected_qty
    ]


@transaction.atomic
def confirm_inventory(count: InventoryCount, user=None) -> InventoryCount:
    """Sanalgan qatorlar bo'yicha qoldiqni tuzatadi. Hammasi yoki hech biri."""
    count = lock_draft(count)
    items = list(
        count.items.filter(actual_qty__isnull=False).select_related(
            "product", "product__unit"
        )
    )
    if not items:
        raise BusinessError(
            message="Hali birorta tovar sanalmagan — haqiqiy qoldiqni kiriting.",
            code="EMPTY_INVENTORY",
        )

    current = dict(
        Stock.objects.select_for_update()
        .filter(warehouse=count.warehouse, product_id__in=[i.product_id for i in items])
        .values_list("product_id", "quantity")
    )
    stale = _stale_rows(items, current)
    if stale:
        raise BusinessError(
            message=(
                f"Sanash davomida {len(stale)} ta tovar qoldig'i o'zgardi. "
                "Hujjatni yangilab, qaytadan tasdiqlang."
            ),
            code="STALE_STOCK",
            details={"items": stale},
        )

    adjustments = []
    for item in items:
        delta = item.actual_qty - item.expected_qty
        if delta == _ZERO:
            continue
        apply_movement(
            warehouse=count.warehouse, product=item.product, quantity=delta,
            movement_type=MovementType.ADJUSTMENT, user=user,
            reference_type="inventory", reference_id=count.pk,
            note=f"Inventarizatsiya {count.number}",
        )
        adjustments.append({
            "product": str(item.product_id), "expected": str(item.expected_qty),
            "actual": str(item.actual_qty), "delta": str(delta),
        })

    count.status = InventoryStatus.CONFIRMED
    count.confirmed_at = timezone.now()
    count.confirmed_by = user
    count.save(update_fields=["status", "confirmed_at", "confirmed_by", "updated_at"])

    # CLAUDE.md 5.3 — qoldiq tuzatish majburiy audit qilinadi
    AuditLog.objects.create(
        user=user, action="inventory.confirm", model_name="InventoryCount",
        object_id=str(count.pk),
        changes={
            "number": count.number, "warehouse": str(count.warehouse_id),
            "adjustments": adjustments,
        },
    )
    return count


@transaction.atomic
def save_inventory_items(count: InventoryCount, rows: list[dict]) -> InventoryCount:
    """Haqiqiy qoldiq va izohlarni saqlaydi. Boshqa hujjat qatori — rad."""
    count = lock_draft(count)
    by_id = {row["id"]: row for row in rows}
    items = list(count.items.filter(pk__in=by_id))
    if len(items) != len(by_id):
        raise ValidationError(
            {"items": "Ba'zi qatorlar bu inventarizatsiyaga tegishli emas."}
        )
    for item in items:
        row = by_id[item.pk]
        item.actual_qty = row["actual_qty"]
        item.note = row.get("note", item.note)
    InventoryCountItem.objects.bulk_update(items, ["actual_qty", "note"])
    return count


@transaction.atomic
def cancel_inventory(count: InventoryCount, user=None) -> InventoryCount:
    count = lock_draft(count)
    count.status = InventoryStatus.CANCELLED
    count.save(update_fields=["status", "updated_at"])
    return count
