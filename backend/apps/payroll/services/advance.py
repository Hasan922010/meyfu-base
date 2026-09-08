"""Avans berish — hamyonga ADVANCE(+), kassadan chiqim (CLAUDE.md 6 Advance)."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.core.models import AuditLog
from apps.finance.constants import CashTxType
from apps.wallet.constants import TransactionType
from apps.wallet.services import wallet_apply

from ..models import Advance

_ZERO = Decimal("0")


@transaction.atomic
def create_advance(*, distributor, amount: Decimal, date=None, note: str = "", user=None):
    date = date or timezone.localdate()
    if amount <= _ZERO:
        raise ValueError("amount musbat bo'lishi kerak")

    advance = Advance.objects.create(
        distributor=distributor, date=date, amount=amount, note=note,
        created_by=user,
    )

    wtx = wallet_apply(
        distributor=distributor,
        transaction_type=TransactionType.ADVANCE,
        amount=amount,
        date=date,
        reference_type="advance",
        reference_id=advance.id,
        note=f"Avans: {note}"[:255],
        user=user,
    )

    from apps.finance.services.cash import cash_apply

    ctx = cash_apply(
        transaction_type=CashTxType.OTHER_OUT,
        amount=-amount,
        date=date,
        counterparty=distributor.full_name,
        reference_type="advance",
        reference_id=advance.id,
        note=f"Avans: {distributor.full_name}"[:255],
        user=user,
    )

    advance.wallet_transaction_id = wtx.id
    advance.cash_transaction_id = ctx.id
    advance.save(update_fields=["wallet_transaction_id", "cash_transaction_id",
                                "updated_at"])

    AuditLog.objects.create(
        user=user, action="advance.created", model_name="Advance",
        object_id=str(advance.id),
        changes={"distributor": distributor.full_name, "amount": str(amount)},
    )
    from apps.notifications.services import notify

    notify(
        distributor, type="advance.created", title="Avans berildi",
        body=f"{amount} so'm", data={"advance_id": str(advance.id)},
    )
    return advance
