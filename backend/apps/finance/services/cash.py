"""Kassa — service layer (CLAUDE.md 5.2, 6).

balance == SUM(CashTransaction.amount)   (butunlik sharti)
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from ..constants import NEGATIVE_CASH_TYPES, POSITIVE_CASH_TYPES
from ..models import CashAccount, CashTransaction

_ZERO = Decimal("0")
DEFAULT_ACCOUNT_NAME = "Asosiy kassa"


def get_account() -> CashAccount:
    account, _created = CashAccount.objects.get_or_create(
        name=DEFAULT_ACCOUNT_NAME, defaults={"balance": _ZERO}
    )
    return account


@transaction.atomic
def cash_apply(
    *,
    transaction_type: str,
    amount: Decimal,
    date=None,
    counterparty: str = "",
    reference_type: str = "",
    reference_id: str = "",
    note: str = "",
    user=None,
) -> CashTransaction:
    """Kassa balansini `amount` ga o'zgartiradi (ishorali kiritiladi)."""
    if amount == _ZERO:
        raise ValueError("amount 0 bo'lishi mumkin emas")
    if transaction_type in POSITIVE_CASH_TYPES and amount < _ZERO:
        raise ValueError(f"{transaction_type} uchun amount musbat bo'lishi kerak")
    if transaction_type in NEGATIVE_CASH_TYPES and amount > _ZERO:
        raise ValueError(f"{transaction_type} uchun amount manfiy bo'lishi kerak")

    account = CashAccount.objects.select_for_update().get(pk=get_account().pk)
    new_balance = account.balance + amount
    account.balance = new_balance
    account.save(update_fields=["balance", "updated_at"])

    return CashTransaction.objects.create(
        account=account,
        date=date or timezone.localdate(),
        transaction_type=transaction_type,
        amount=amount,
        balance_after=new_balance,
        counterparty=counterparty,
        reference_type=reference_type,
        reference_id=str(reference_id),
        note=note,
        created_by=user,
    )


def cash_matches_ledger() -> bool:
    account = get_account()
    total = account.transactions.aggregate(s=Sum("amount"))["s"] or _ZERO
    return account.balance == total
