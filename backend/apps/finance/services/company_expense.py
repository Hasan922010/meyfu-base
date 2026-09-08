"""Kompaniya xarajati — service layer."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from ..constants import CashTxType
from ..models import CompanyExpense
from .cash import cash_apply

_ZERO = Decimal("0")


@transaction.atomic
def create_company_expense(
    *,
    category: str,
    amount: Decimal,
    date=None,
    description: str = "",
    paid_from_cash: bool = True,
    receipt_image=None,
    user=None,
) -> CompanyExpense:
    from django.utils import timezone

    expense = CompanyExpense.objects.create(
        category=category, amount=amount, date=date or timezone.localdate(),
        description=description, paid_from_cash=paid_from_cash,
        receipt_image=receipt_image, created_by=user,
    )

    if paid_from_cash:
        tx = cash_apply(
            transaction_type=CashTxType.COMPANY_EXPENSE,
            amount=-amount,
            date=expense.date,
            reference_type="company_expense",
            reference_id=expense.id,
            note=f"{expense.get_category_display()}: {description}"[:255],
            user=user,
        )
        expense.cash_transaction = tx
        expense.save(update_fields=["cash_transaction", "updated_at"])

    return expense
