"""Omborlar (filiallar) orasida ko'chirish — service layer (CLAUDE.md 5.1–5.3, 7.8).

DRAFT → SENT: manba ombordan TRANSFER chiqimi (qoldiq yetmasa — rad).
SENT → RECEIVED: qabul qilingan miqdor filialga TRANSFER kirimi.
SENT → CANCELLED: chiqim teskari TRANSFER yozuvi bilan qaytariladi.
Jurnal o'zgartirilmaydi — har qadam yangi harakat yozuvi.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog, DocumentSequence

from ..constants import MovementType, TransferStatus
from ..models import Transfer, TransferItem
from .stock import apply_movement

TRANSFER_PREFIX = "KCH"
_ZERO = Decimal("0")


def assign_number(transfer: Transfer) -> str:
    """Hujjatga raqam beradi (agar bo'lmasa). atomic ichida chaqiring."""
    if not transfer.number:
        transfer.number = DocumentSequence.next_number(
            TRANSFER_PREFIX, year=transfer.date.year
        )
    return transfer.number


def _lock(transfer: Transfer, expected: str, code: str, message: str) -> Transfer:
    transfer = Transfer.objects.select_for_update().get(pk=transfer.pk)
    if transfer.status != expected:
        raise BusinessError(message=message, code=code)
    return transfer


def _move(transfer: Transfer, item: TransferItem, *, warehouse, quantity, user,
          note: str) -> None:
    apply_movement(
        warehouse=warehouse, product=item.product, quantity=quantity,
        movement_type=MovementType.TRANSFER, user=user,
        reference_type="transfer", reference_id=transfer.pk,
        from_location=transfer.from_warehouse.name,
        to_location=transfer.to_warehouse.name,
        note=note,
    )


@transaction.atomic
def send_transfer(transfer: Transfer, user=None) -> Transfer:
    transfer = _lock(
        transfer, TransferStatus.DRAFT, "TRANSFER_NOT_DRAFT",
        "Faqat qoralama ko'chirishni yuborish mumkin.",
    )
    items = list(transfer.items.select_related("product", "product__unit"))
    if not items:
        raise BusinessError(
            message="Ko'chirishda kamida bitta tovar bo'lishi kerak.",
            code="EMPTY_TRANSFER",
        )
    for item in items:
        _move(transfer, item, warehouse=transfer.from_warehouse,
              quantity=-item.quantity, user=user,
              note=f"Ko'chirish {transfer.number} — yuborildi")
        item.cost_price = item.product.cost_price
    TransferItem.objects.bulk_update(items, ["cost_price"])

    transfer.status = TransferStatus.SENT
    transfer.sent_at = timezone.now()
    transfer.sent_by = user
    transfer.save(update_fields=["status", "sent_at", "sent_by", "updated_at"])
    AuditLog.objects.create(
        user=user, action="transfer.send", model_name="Transfer",
        object_id=str(transfer.pk),
        changes={"number": transfer.number, "items": len(items)},
    )
    return transfer


@transaction.atomic
def receive_transfer(
    transfer: Transfer, rows: list[dict], note: str = "", user=None
) -> Transfer:
    """Qabul qilish. `rows` — [{id, received_quantity}]; ko'rsatilmagan qator
    to'liq qabul qilingan hisoblanadi. Farq bo'lsa izoh majburiy."""
    transfer = _lock(
        transfer, TransferStatus.SENT, "TRANSFER_NOT_SENT",
        "Bu ko'chirish qabul qilish holatida emas.",
    )
    items = list(transfer.items.select_related("product", "product__unit"))
    by_id = {row["id"]: row["received_quantity"] for row in rows}
    unknown = set(by_id) - {item.pk for item in items}
    if unknown:
        raise ValidationError({"items": "Ba'zi qatorlar bu ko'chirishga tegishli emas."})

    for item in items:
        received = by_id.get(item.pk, item.quantity)
        if received > item.quantity:
            raise ValidationError({
                "items": f"«{item.product.name}» — jo'natilganidan ko'p qabul qilib "
                         "bo'lmaydi."
            })
        item.received_quantity = received
    if any(i.received_quantity != i.quantity for i in items) and not note.strip():
        raise ValidationError({"note": "Farq bor — sababini izohda yozing."})

    for item in items:
        if item.received_quantity > _ZERO:
            _move(transfer, item, warehouse=transfer.to_warehouse,
                  quantity=item.received_quantity, user=user,
                  note=f"Ko'chirish {transfer.number} — qabul qilindi")
    TransferItem.objects.bulk_update(items, ["received_quantity"])

    transfer.status = TransferStatus.RECEIVED
    transfer.received_at = timezone.now()
    transfer.received_by = user
    transfer.receive_note = note
    transfer.save(update_fields=[
        "status", "received_at", "received_by", "receive_note", "updated_at",
    ])
    AuditLog.objects.create(
        user=user, action="transfer.receive", model_name="Transfer",
        object_id=str(transfer.pk),
        changes={
            "number": transfer.number, "note": note,
            "differences": [
                {"product": str(i.product_id), "sent": str(i.quantity),
                 "received": str(i.received_quantity)}
                for i in items if i.received_quantity != i.quantity
            ],
        },
    )
    return transfer


@transaction.atomic
def cancel_transfer(transfer: Transfer, user=None) -> Transfer:
    transfer = Transfer.objects.select_for_update().get(pk=transfer.pk)
    if transfer.status not in (TransferStatus.DRAFT, TransferStatus.SENT):
        raise BusinessError(
            message="Qabul qilingan yoki bekor qilingan ko'chirishni bekor qilib "
                    "bo'lmaydi.",
            code="TRANSFER_NOT_CANCELLABLE",
        )
    if transfer.status == TransferStatus.SENT:
        for item in transfer.items.select_related("product", "product__unit"):
            _move(transfer, item, warehouse=transfer.from_warehouse,
                  quantity=item.quantity, user=user,
                  note=f"Ko'chirish {transfer.number} — bekor qilindi")
    transfer.status = TransferStatus.CANCELLED
    transfer.save(update_fields=["status", "updated_at"])
    AuditLog.objects.create(
        user=user, action="transfer.cancel", model_name="Transfer",
        object_id=str(transfer.pk), changes={"number": transfer.number},
    )
    return transfer
