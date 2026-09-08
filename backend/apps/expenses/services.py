"""Xarajat — service layer (CLAUDE.md 7.5, 5, 4.2)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog
from apps.wallet.constants import TransactionType
from apps.wallet.services import reverse_reference, wallet_apply
from realtime.broadcast import broadcast

from .constants import ExpenseStatus, PaymentSource
from .models import DistributorExpense, ExpenseCategory, FuelLog

_ZERO = Decimal("0")


@dataclass
class ExpenseResult:
    expense: DistributorExpense
    created: bool = True
    duplicate: bool = False
    over_limit: bool = False


@transaction.atomic
def create_expense(
    *,
    distributor,
    category: ExpenseCategory,
    amount: Decimal,
    payment_source: str = PaymentSource.CASH_ON_HAND,
    date=None,
    description: str = "",
    latitude=None,
    longitude=None,
    receipt_image=None,
    fuel: dict | None = None,
    client_uuid: str | None = None,
    device_time=None,
) -> ExpenseResult:
    date = date or timezone.localdate()

    if client_uuid:
        existing = DistributorExpense.objects.filter(client_uuid=client_uuid).first()
        if existing:
            return ExpenseResult(expense=existing, created=False, duplicate=True)

    if category.requires_receipt and receipt_image is None and not (
        client_uuid  # offline — rasm keyinroq media_queue orqali keladi
    ):
        raise BusinessError(
            message=f"«{category.name}» uchun chek rasmi majburiy.",
            code="RECEIPT_REQUIRED",
        )

    profile = getattr(distributor, "distributor_profile", None)

    # kunlik limit tekshiruvi (CLAUDE.md 7.5)
    over_limit = False
    day_qs = DistributorExpense.objects.filter(
        distributor=distributor, date=date,
    ).exclude(status=ExpenseStatus.REJECTED)

    if category.daily_limit and category.daily_limit > _ZERO:
        spent = day_qs.filter(category=category).aggregate(
            s=Sum("amount")
        )["s"] or _ZERO
        if spent + amount > category.daily_limit:
            over_limit = True

    # tarqatuvchining barcha kategoriyalar bo'yicha kunlik umumiy limiti
    daily_cap = getattr(profile, "daily_expense_limit", _ZERO) or _ZERO
    if daily_cap > _ZERO:
        spent_all = day_qs.aggregate(s=Sum("amount"))["s"] or _ZERO
        if spent_all + amount > daily_cap:
            over_limit = True

    is_deductible = bool(
        profile and getattr(profile, "expenses_covered_by", "COMPANY") == "SALARY"
    )

    expense = DistributorExpense.objects.create(
        distributor=distributor, date=date, category=category, amount=amount,
        description=description, payment_source=payment_source,
        latitude=latitude, longitude=longitude,
        receipt_image=receipt_image, is_deductible=is_deductible,
        status=ExpenseStatus.PENDING,
        client_uuid=client_uuid or None, device_time=device_time,
        created_by=distributor,
    )

    if fuel:
        FuelLog.objects.create(
            expense=expense,
            liters=fuel["liters"],
            price_per_liter=fuel["price_per_liter"],
            odometer=fuel.get("odometer"),
            station_name=fuel.get("station_name", ""),
        )

    AuditLog.objects.create(
        user=distributor, action="expense.created", model_name="DistributorExpense",
        object_id=str(expense.id),
        changes={"amount": str(amount), "category": category.name,
                 "over_limit": over_limit},
    )
    from apps.notifications.services import notify_admins

    if over_limit:
        broadcast("admin_dashboard", "expense.limit_exceeded", {
            "expense_id": str(expense.id), "distributor": distributor.full_name,
            "amount": str(amount), "category": category.name,
        })
        _limit_txt = (
            f"kategoriya limiti: {category.daily_limit}"
            if category.daily_limit and category.daily_limit > _ZERO
            else f"kunlik umumiy limit: {daily_cap}"
        )
        notify_admins(
            type="expense.limit_exceeded",
            title="Xarajat limiti oshdi",
            body=(f"{distributor.full_name} · {category.name} · {amount} so'm "
                  f"({_limit_txt})"),
            data={"expense_id": str(expense.id)},
            tg_buttons=[[
                {"text": "✅ Tasdiqlash",
                 "callback_data": f"exp_approve:{expense.id}"},
                {"text": "❌ Rad etish",
                 "callback_data": f"exp_reject:{expense.id}"},
            ]],
        )
    else:
        broadcast("admin_dashboard", "expense.created", {
            "expense_id": str(expense.id), "distributor": distributor.full_name,
            "amount": str(amount),
        })

    return ExpenseResult(expense=expense, created=True, over_limit=over_limit)


@transaction.atomic
def approve_expense(expense: DistributorExpense, user=None) -> DistributorExpense:
    expense = DistributorExpense.objects.select_for_update().get(pk=expense.pk)
    if expense.status == ExpenseStatus.APPROVED:
        raise BusinessError(message="Xarajat allaqachon tasdiqlangan.",
                            code="ALREADY_APPROVED")

    expense.status = ExpenseStatus.APPROVED
    expense.approved_by = user
    expense.approved_at = timezone.now()
    expense.reject_reason = ""
    expense.save(update_fields=["status", "approved_by", "approved_at",
                                "reject_reason", "updated_at"])

    if expense.affects_wallet:
        wallet_apply(
            distributor=expense.distributor,
            transaction_type=TransactionType.EXPENSE,
            amount=-expense.amount,
            date=expense.date,
            reference_type="expense",
            reference_id=expense.id,
            note=f"{expense.category.name}: {expense.description}"[:255],
            user=user,
        )

    from apps.notifications.services import notify

    broadcast(f"distributor_{expense.distributor_id}", "expense.approved", {
        "expense_id": str(expense.id), "amount": str(expense.amount),
    })
    notify(
        expense.distributor, type="expense.approved",
        title="Xarajat tasdiqlandi",
        body=f"{expense.category.name} · {expense.amount} so'm",
        data={"expense_id": str(expense.id)},
    )
    return expense


@transaction.atomic
def reject_expense(
    expense: DistributorExpense, user=None, reason: str = ""
) -> DistributorExpense:
    expense = DistributorExpense.objects.select_for_update().get(pk=expense.pk)
    was_approved = expense.status == ExpenseStatus.APPROVED

    expense.status = ExpenseStatus.REJECTED
    expense.reject_reason = reason
    expense.approved_by = user
    expense.approved_at = timezone.now()
    expense.save(update_fields=["status", "reject_reason", "approved_by",
                                "approved_at", "updated_at"])

    if was_approved and expense.affects_wallet:
        reverse_reference(
            distributor=expense.distributor,
            reference_type="expense", reference_id=expense.id, user=user,
            note="Xarajat rad etildi",
        )

    from apps.notifications.services import notify

    broadcast(f"distributor_{expense.distributor_id}", "expense.rejected", {
        "expense_id": str(expense.id), "reason": reason,
    })
    notify(
        expense.distributor, type="expense.rejected",
        title="Xarajat rad etildi",
        body=f"{expense.category.name} · {expense.amount} so'm. Sabab: {reason}",
        data={"expense_id": str(expense.id)},
    )
    return expense
