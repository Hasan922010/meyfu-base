"""Kassa boshlang'ich qoldig'i — ro'yxat va ommaviy kiritish.

Hozircha tizimda bitta asosiy kassa bor (`get_account`), ro'yxat shu kassadan
iborat. Bir nechta kassa qo'shilsa — shu yerda kengaytiriladi.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from apps.core.services.opening import audit_bulk, bulk_result, plan_deltas, sheet_row

from ..constants import CashTxType
from ..models import CashAccount
from .cash import cash_apply, get_account

_ZERO = Decimal("0")


def cash_opening_sheet() -> list[dict]:
    account = get_account()
    return [sheet_row(id=account.id, name=account.name, current=account.balance)]


@transaction.atomic
def cash_opening_bulk(*, rows: list[dict], note: str, user) -> dict:
    account = CashAccount.objects.select_for_update().get(pk=get_account().pk)
    changes = plan_deltas(rows, {account.id: account.balance})
    for _account_id, delta in changes:
        if delta != _ZERO:
            cash_apply(
                transaction_type=CashTxType.OPENING_BALANCE, amount=delta,
                reference_type="opening_balance", note=note, user=user,
            )
    audit_bulk(user=user, kind="cash", note=note, changes=changes)
    return bulk_result(changes)
