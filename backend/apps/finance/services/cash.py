"""Kassa — service layer (CLAUDE.md 5.2, 6).

balance == SUM(CashTransaction.amount)   (butunlik sharti)
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from apps.core.business_day import business_date

from ..constants import NEGATIVE_CASH_TYPES, POSITIVE_CASH_TYPES
from ..models import CashAccount, CashTransaction

_ZERO = Decimal("0")
DEFAULT_ACCOUNT_NAME = "Asosiy kassa"


def get_account(branch=None) -> CashAccount:
    """Markaz kassasi (`branch=None`) yoki filial kassasi (kerak bo'lsa yaratiladi)."""
    if branch is None:
        account, _created = CashAccount.objects.get_or_create(
            name=DEFAULT_ACCOUNT_NAME, branch=None, defaults={"balance": _ZERO}
        )
        return account
    account, _created = CashAccount.objects.get_or_create(
        branch=branch,
        defaults={"name": f"{branch.name} kassasi", "balance": _ZERO},
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
    branch=None,
) -> CashTransaction:
    """Kassa balansini `amount` ga o'zgartiradi (ishorali kiritiladi).

    `branch` — filial kassasi; `None` — markaz kassasi.
    """
    if amount == _ZERO:
        raise ValueError("amount 0 bo'lishi mumkin emas")
    if transaction_type in POSITIVE_CASH_TYPES and amount < _ZERO:
        raise ValueError(f"{transaction_type} uchun amount musbat bo'lishi kerak")
    if transaction_type in NEGATIVE_CASH_TYPES and amount > _ZERO:
        raise ValueError(f"{transaction_type} uchun amount manfiy bo'lishi kerak")

    account = CashAccount.objects.select_for_update().get(pk=get_account(branch).pk)
    new_balance = account.balance + amount
    account.balance = new_balance
    account.save(update_fields=["balance", "updated_at"])

    return CashTransaction.objects.create(
        account=account,
        date=date or business_date(),
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
    """Har bir kassa (markaz va filiallar) balansi o'z jurnali yig'indisiga teng."""
    get_account()  # markaz kassasi har doim mavjud bo'lsin
    for account in CashAccount.objects.all():
        total = account.transactions.aggregate(s=Sum("amount"))["s"] or _ZERO
        if account.balance != total:
            return False
    return True
