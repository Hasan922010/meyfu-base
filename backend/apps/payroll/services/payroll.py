"""Maosh hisoblash / tasdiqlash / to'lash (CLAUDE.md 6, 7.10–7.11, 12, 18).

- `calculate_payroll` — idempotent, faqat DRAFT holatida qayta hisoblaydi.
- Ushlanmalar (kamomad, kassa farqi) faqat sozlama yoqilgan bo'lsa avtomatik
  tushadi (`payroll.auto_deduct_shortage`), aks holda admin qo'lda kiritadi.
- `pay_payroll` — kassadan chiqim (CompanyExpense SALARY) + avanslarni bog'lash.
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date as date_cls
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog, Setting
from apps.dayclose.constants import DayCloseStatus
from apps.dayclose.models import DayClose
from apps.expenses.constants import ExpenseStatus, PaymentSource
from apps.expenses.models import DistributorExpense
from apps.finance.constants import CompanyExpenseCategory
from apps.sales.models import SaleItem

from ..constants import SETTING_AUTO_DEDUCT, CommissionRole, PayrollStatus
from ..models import Advance, Payroll, PayrollDetail
from .commission import resolve_two_stage

_ZERO = Decimal("0")
_CENT = Decimal("0.01")
_ACTIVE_SALE = ("COMPLETED", "FLAGGED")


@dataclass
class PayrollComponents:
    total_sales: Decimal = _ZERO
    total_profit: Decimal = _ZERO
    commission_amount: Decimal = _ZERO
    order_commission_amount: Decimal = _ZERO
    delivery_commission_amount: Decimal = _ZERO


def month_bounds(any_day: date_cls) -> tuple[date_cls, date_cls]:
    start = any_day.replace(day=1)
    last = calendar.monthrange(any_day.year, any_day.month)[1]
    return start, any_day.replace(day=last)


def _commission_rows(distributor, date_from, date_to):
    """Ikki bosqichli komissiya (v4 T1).

    DELIVERY: `sale.distributor == distributor` bo'lgan qatorlar.
    ORDER:    zakazni shu odam olgan qatorlar —
              `sale.order.taken_by == distributor` yoki (Order'siz to'g'ridan-to'g'ri
              sotuvda) `sale.distributor == distributor`.
    Bir odam ham zakaz olib, ham yetkazgan bo'lsa — ikkala komissiyani ham oladi
    (ikkita alohida PayrollDetail).
    total_sales / total_profit — faqat DELIVERY tomonidan (ikki marta sanamaslik uchun).
    """
    base_qs = (
        SaleItem.objects.filter(
            sale__date__gte=date_from,
            sale__date__lte=date_to,
            sale__status__in=_ACTIVE_SALE,
        )
        .select_related("product", "sale", "sale__order")
        .order_by("sale__date", "created_at")
    )
    order_pct, delivery_pct = resolve_two_stage(user=distributor)

    comp = PayrollComponents()
    details: list[PayrollDetail] = []

    for item in base_qs.filter(sale__distributor=distributor):
        comp.total_sales += item.amount
        comp.total_profit += item.profit
        if delivery_pct <= _ZERO:
            continue
        commission = (item.amount * delivery_pct / Decimal("100")).quantize(_CENT)
        comp.delivery_commission_amount += commission
        details.append(
            PayrollDetail(
                sale_item=item, role=CommissionRole.DELIVERY,
                beneficiary=distributor, percent=delivery_pct,
                base_amount=item.amount, commission_amount=commission,
            )
        )

    if order_pct > _ZERO:
        order_items = base_qs.filter(
            Q(sale__order__taken_by=distributor)
            | Q(sale__order__isnull=True, sale__distributor=distributor)
        )
        for item in order_items:
            commission = (item.amount * order_pct / Decimal("100")).quantize(_CENT)
            comp.order_commission_amount += commission
            details.append(
                PayrollDetail(
                    sale_item=item, role=CommissionRole.ORDER,
                    beneficiary=distributor, percent=order_pct,
                    base_amount=item.amount, commission_amount=commission,
                )
            )

    comp.commission_amount = (
        comp.order_commission_amount + comp.delivery_commission_amount
    )
    return comp, details


def _deductions_and_reimbursements(distributor, date_from, date_to, *, auto_deduct):
    result = {
        "deduction_shortage": _ZERO,
        "deduction_cash_diff": _ZERO,
        "deduction_expense": _ZERO,
        "reimbursement_expense": _ZERO,
    }

    if auto_deduct:
        closes = DayClose.objects.filter(
            distributor=distributor, date__gte=date_from, date__lte=date_to,
            status=DayCloseStatus.CLOSED,
        )
        for dc in closes:
            if dc.cash_difference < _ZERO:
                result["deduction_cash_diff"] += -dc.cash_difference
            if dc.stock_difference_amount > _ZERO:
                result["deduction_shortage"] += dc.stock_difference_amount

    approved = DistributorExpense.objects.filter(
        distributor=distributor, date__gte=date_from, date__lte=date_to,
        status=ExpenseStatus.APPROVED,
    )
    # Tarqatuvchi shaxsiy pulidan to'lagan (kompaniya qoplaydi) → qaytarim
    result["reimbursement_expense"] = approved.filter(
        payment_source=PaymentSource.OWN_MONEY
    ).aggregate(s=Sum("amount"))["s"] or _ZERO
    # expenses_covered_by=SALARY (is_deductible) → maoshdan ushlanadi
    result["deduction_expense"] = approved.filter(
        is_deductible=True
    ).aggregate(s=Sum("amount"))["s"] or _ZERO

    return result


@transaction.atomic
def calculate_payroll(*, distributor, period: date_cls, user=None) -> Payroll:
    date_from, date_to = month_bounds(period)
    period_start = date_from

    payroll = (
        Payroll.objects.select_for_update()
        .filter(distributor=distributor, period=period_start)
        .first()
    )
    if payroll and payroll.status != PayrollStatus.DRAFT:
        raise BusinessError(
            message="Bu davr maoshi allaqachon tasdiqlangan — qayta hisoblab bo'lmaydi.",
            code="PAYROLL_LOCKED",
        )

    profile = getattr(distributor, "distributor_profile", None)
    base_salary = getattr(profile, "base_salary", _ZERO) or _ZERO

    comp, details = _commission_rows(distributor, date_from, date_to)
    auto_deduct = bool(Setting.get(SETTING_AUTO_DEDUCT, False))
    adj = _deductions_and_reimbursements(
        distributor, date_from, date_to, auto_deduct=auto_deduct
    )
    advance_total = Advance.objects.filter(
        distributor=distributor, date__gte=date_from, date__lte=date_to,
    ).aggregate(s=Sum("amount"))["s"] or _ZERO

    if payroll is None:
        payroll = Payroll(distributor=distributor, period=period_start,
                          created_by=user)

    payroll.total_sales = comp.total_sales
    payroll.total_profit = comp.total_profit
    payroll.commission_amount = comp.commission_amount
    payroll.order_commission_amount = comp.order_commission_amount
    payroll.delivery_commission_amount = comp.delivery_commission_amount
    payroll.base_salary = base_salary
    payroll.deduction_shortage = adj["deduction_shortage"]
    payroll.deduction_cash_diff = adj["deduction_cash_diff"]
    payroll.deduction_expense = adj["deduction_expense"]
    payroll.reimbursement_expense = adj["reimbursement_expense"]
    payroll.advance = advance_total
    # bonus qo'lda kiritiladi — mavjud qiymatni saqlaymiz
    payroll.recalc_final()
    payroll.calculated_at = timezone.now()
    payroll.save()

    payroll.details.all().delete()
    for detail in details:
        detail.payroll = payroll
        detail.created_by = user
    PayrollDetail.objects.bulk_create(details)

    AuditLog.objects.create(
        user=user, action="payroll.calculated", model_name="Payroll",
        object_id=str(payroll.id),
        changes={
            "period": str(period_start),
            "commission": str(comp.commission_amount),
            "final": str(payroll.final_amount),
            "auto_deduct": auto_deduct,
        },
    )
    return payroll


@transaction.atomic
def set_manual_fields(
    payroll: Payroll, *, user=None, **fields
) -> Payroll:
    """Admin qo'lda tuzatadigan maydonlar (bonus, ushlanmalar, izoh)."""
    payroll = Payroll.objects.select_for_update().get(pk=payroll.pk)
    if payroll.status != PayrollStatus.DRAFT:
        raise BusinessError(
            message="Faqat qoralama holatidagi maoshni tahrirlash mumkin.",
            code="PAYROLL_LOCKED",
        )
    allowed = {
        "bonus", "deduction_shortage", "deduction_cash_diff",
        "deduction_expense", "reimbursement_expense", "note",
    }
    changes = {}
    for key, value in fields.items():
        if key in allowed and value is not None:
            changes[key] = {"old": str(getattr(payroll, key)), "new": str(value)}
            setattr(payroll, key, value)
    payroll.recalc_final()
    payroll.save()
    if changes:
        AuditLog.objects.create(
            user=user, action="payroll.edited", model_name="Payroll",
            object_id=str(payroll.id), changes=changes,
        )
    return payroll


@transaction.atomic
def approve_payroll(payroll: Payroll, *, user=None) -> Payroll:
    payroll = Payroll.objects.select_for_update().get(pk=payroll.pk)
    if payroll.status != PayrollStatus.DRAFT:
        raise BusinessError(
            message="Faqat qoralama holatidagi maoshni tasdiqlash mumkin.",
            code="INVALID_STATE",
        )
    payroll.status = PayrollStatus.APPROVED
    payroll.approved_by = user
    payroll.approved_at = timezone.now()
    payroll.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    AuditLog.objects.create(
        user=user, action="payroll.approved", model_name="Payroll",
        object_id=str(payroll.id), changes={"final": str(payroll.final_amount)},
    )
    from apps.notifications.services import notify

    notify(
        payroll.distributor, type="payroll.approved",
        title="Maoshingiz tasdiqlandi",
        body=f"{payroll.period:%Y-%m} · {payroll.final_amount} so'm",
        data={"payroll_id": str(payroll.id)},
    )
    return payroll


@transaction.atomic
def pay_payroll(payroll: Payroll, *, user=None, paid_from_cash: bool = True) -> Payroll:
    payroll = Payroll.objects.select_for_update().get(pk=payroll.pk)
    if payroll.status != PayrollStatus.APPROVED:
        raise BusinessError(
            message="Faqat tasdiqlangan maoshni to'lash mumkin.",
            code="INVALID_STATE",
        )

    from apps.finance.services.company_expense import create_company_expense

    expense = create_company_expense(
        category=CompanyExpenseCategory.SALARY,
        amount=payroll.final_amount,
        date=timezone.localdate(),
        description=(
            f"{payroll.distributor.full_name} · {payroll.period:%Y-%m}"
        ),
        paid_from_cash=paid_from_cash,
        user=user,
    )

    payroll.status = PayrollStatus.PAID
    payroll.paid_at = timezone.now()
    payroll.company_expense = expense
    payroll.save(update_fields=["status", "paid_at", "company_expense", "updated_at"])

    # Oy avanslarini shu maoshga bog'laymiz
    date_from, date_to = month_bounds(payroll.period)
    Advance.objects.filter(
        distributor=payroll.distributor, date__gte=date_from, date__lte=date_to,
        payroll__isnull=True,
    ).update(payroll=payroll)

    AuditLog.objects.create(
        user=user, action="payroll.paid", model_name="Payroll",
        object_id=str(payroll.id),
        changes={"final": str(payroll.final_amount),
                 "company_expense": str(expense.id)},
    )
    from apps.notifications.services import notify

    notify(
        payroll.distributor, type="payroll.paid",
        title="Maosh to'landi",
        body=f"{payroll.period:%Y-%m} · {payroll.final_amount} so'm",
        data={"payroll_id": str(payroll.id)},
    )
    return payroll


def payroll_matches_formula(payroll: Payroll) -> bool:
    """final_amount komponentlar yig'indisiga tengmi?"""
    expected = (
        payroll.base_salary + payroll.commission_amount + payroll.bonus
        + payroll.reimbursement_expense
        - payroll.deduction_shortage - payroll.deduction_cash_diff
        - payroll.deduction_expense - payroll.advance
    )
    return expected == payroll.final_amount
