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


@transaction.atomic
def transfer_to_center(*, branch, amount: Decimal, note: str = "", user=None):
    """Filial kassasidan markaz kassasiga pul topshirish (inkassatsiya).

    Ikki append-only yozuv bitta tranzaksiyada: filialdan chiqim va markazga kirim,
    umumiy `reference_id` bilan. Kassada yo'q pulni topshirib bo'lmaydi.
    """
    import uuid

    from apps.core.exceptions import BusinessError
    from apps.core.models import AuditLog

    from ..constants import CashTxType

    if amount <= _ZERO:
        raise BusinessError(message="Summa musbat bo'lishi kerak.", code="INVALID_AMOUNT")
    account = CashAccount.objects.select_for_update().get(pk=get_account(branch).pk)
    if amount > account.balance:
        raise BusinessError(
            message=f"Filial kassasida {account.balance:,.0f} so'm bor — "
                    "shundan ko'p topshirib bo'lmaydi.".replace(",", " "),
            code="INSUFFICIENT_CASH",
        )
    ref = uuid.uuid4()
    text = note or f"{branch.name} → markaz"
    out = cash_apply(
        transaction_type=CashTxType.BRANCH_OUT, amount=-amount, counterparty="Markaz",
        reference_type="branch_cash_transfer", reference_id=ref, note=text,
        user=user, branch=branch,
    )
    cash_apply(
        transaction_type=CashTxType.CENTER_IN, amount=amount, counterparty=branch.name,
        reference_type="branch_cash_transfer", reference_id=ref, note=text, user=user,
    )
    AuditLog.objects.create(
        user=user, action="cash.branch_to_center", model_name="CashTransaction",
        object_id=str(out.pk),
        changes={"branch": branch.name, "amount": str(amount), "note": note},
    )
    return out


def cash_matches_ledger() -> bool:
    """Har bir kassa (markaz va filiallar) balansi o'z jurnali yig'indisiga teng."""
    get_account()  # markaz kassasi har doim mavjud bo'lsin
    for account in CashAccount.objects.all():
        total = account.transactions.aggregate(s=Sum("amount"))["s"] or _ZERO
        if account.balance != total:
            return False
    return True
