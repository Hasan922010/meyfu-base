"""Ta'minotchi balansi — service layer (CLAUDE.md 5.2, 6 — Boshlang'ich qoldiqlar).

balance == SUM(SupplierTransaction.amount)   (butunlik sharti)
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from ..models import Supplier, SupplierTransaction

_ZERO = Decimal("0")


@transaction.atomic
def supplier_apply(
    *,
    supplier: Supplier,
    transaction_type: str,
    amount: Decimal,
    date=None,
    note: str = "",
    user=None,
) -> SupplierTransaction:
    """Ta'minotchi balansini `amount` ga o'zgartiradi (ishorali kiritiladi)."""
    if amount == _ZERO:
        raise ValueError("amount 0 bo'lishi mumkin emas")

    supplier = Supplier.objects.select_for_update().get(pk=supplier.pk)
    new_balance = supplier.balance + amount
    supplier.balance = new_balance
    supplier.save(update_fields=["balance", "updated_at"])

    return SupplierTransaction.objects.create(
        supplier=supplier,
        date=date or timezone.localdate(),
        transaction_type=transaction_type,
        amount=amount,
        balance_after=new_balance,
        note=note,
        created_by=user,
    )


def supplier_balance_matches_ledger(supplier: Supplier) -> bool:
    total = supplier.transactions.aggregate(s=Sum("amount"))["s"] or _ZERO
    return supplier.balance == total
