"""Maosh modellari (CLAUDE.md 6 — Maosh [F3], 7.10–7.11, 12).

Payroll qayta hisoblanadi (DRAFT holатida). Tasdiqlangach o'zgarmaydi —
faqat SUPER_ADMIN qayta ochishi mumkin (AuditLog bilan).
"""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel

from .constants import CommissionRole, CommissionScope, PayrollStatus

_ZERO = Decimal("0")
_MONEY = {"max_digits": 14, "decimal_places": 2}
_PCT = {"max_digits": 5, "decimal_places": 2}


class CommissionRule(BaseModel):
    """Komissiya foizi qoidasi. Eng aniq qoida (scope) yutadi, keyin `priority`."""

    scope = models.CharField(
        _("qamrov"), max_length=12, choices=CommissionScope.choices,
        default=CommissionScope.GLOBAL, db_index=True,
    )
    target_id = models.UUIDField(
        _("obyekt ID"), null=True, blank=True,
        help_text=_("CATEGORY→kategoriya, PRODUCT→mahsulot, DISTRIBUTOR→foydalanuvchi"),
    )
    percent = models.DecimalField(
        _("foiz"), **_PCT, validators=[MinValueValidator(_ZERO)]
    )
    valid_from = models.DateField(_("amal qiladi (dan)"))
    valid_to = models.DateField(_("amal qiladi (gacha)"), null=True, blank=True)
    priority = models.IntegerField(
        _("ustuvorlik"), default=0,
        help_text=_("Bir xil qamrovda kattasi yutadi"),
    )
    is_active = models.BooleanField(_("faol"), default=True)
    note = models.CharField(_("izoh"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("komissiya qoidasi")
        verbose_name_plural = _("komissiya qoidalari")
        ordering = ("-priority", "-created_at")
        indexes = [
            models.Index(fields=["scope", "target_id", "is_active"]),
            models.Index(fields=["valid_from", "valid_to"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_scope_display()} · {self.percent}%"


class Payroll(BaseModel):
    """Bir tarqatuvchining bir oylik maoshi.

    final = base_salary + commission + bonus + reimbursement_expense
            − deduction_shortage − deduction_cash_diff − deduction_expense − advance
    """

    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payrolls",
        verbose_name=_("tarqatuvchi"),
    )
    period = models.DateField(
        _("davr"), help_text=_("oyning birinchi kuni (masalan 2026-09-01)")
    )

    total_sales = models.DecimalField(_("sotuv summasi"), **_MONEY, default=_ZERO)
    total_profit = models.DecimalField(_("sof foyda"), **_MONEY, default=_ZERO)
    commission_amount = models.DecimalField(
        _("komissiya (jami)"), **_MONEY, default=_ZERO
    )
    order_commission_amount = models.DecimalField(
        _("zakaz komissiyasi"), **_MONEY, default=_ZERO
    )
    delivery_commission_amount = models.DecimalField(
        _("yetkazish komissiyasi"), **_MONEY, default=_ZERO
    )
    base_salary = models.DecimalField(_("asosiy maosh"), **_MONEY, default=_ZERO)
    bonus = models.DecimalField(_("bonus"), **_MONEY, default=_ZERO)

    deduction_shortage = models.DecimalField(
        _("tovar kamomadi ushlanmasi"), **_MONEY, default=_ZERO
    )
    deduction_cash_diff = models.DecimalField(
        _("kassa farqi ushlanmasi"), **_MONEY, default=_ZERO
    )
    deduction_expense = models.DecimalField(
        _("xarajat ushlanmasi"), **_MONEY, default=_ZERO
    )
    reimbursement_expense = models.DecimalField(
        _("xarajat qaytarimi"), **_MONEY, default=_ZERO
    )
    advance = models.DecimalField(_("avans"), **_MONEY, default=_ZERO)

    final_amount = models.DecimalField(_("yakuniy summa"), **_MONEY, default=_ZERO)

    status = models.CharField(
        _("holat"), max_length=10, choices=PayrollStatus.choices,
        default=PayrollStatus.DRAFT, db_index=True,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name=_("kim tasdiqladi"),
    )
    approved_at = models.DateTimeField(_("tasdiqlangan vaqti"), null=True, blank=True)
    paid_at = models.DateTimeField(_("to'langan vaqti"), null=True, blank=True)
    company_expense = models.ForeignKey(
        "finance.CompanyExpense", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name=_("kompaniya xarajati"),
    )
    calculated_at = models.DateTimeField(_("hisoblangan vaqti"), null=True, blank=True)
    note = models.CharField(_("izoh"), max_length=500, blank=True)

    class Meta:
        verbose_name = _("maosh")
        verbose_name_plural = _("maoshlar")
        ordering = ("-period", "distributor__full_name")
        constraints = [
            models.UniqueConstraint(
                fields=["distributor", "period"], name="uniq_payroll_distributor_period"
            )
        ]
        indexes = [models.Index(fields=["status", "-period"])]

    def __str__(self) -> str:
        return f"{self.distributor.full_name} · {self.period:%Y-%m}"

    def recalc_final(self) -> Decimal:
        self.final_amount = (
            self.base_salary
            + self.commission_amount
            + self.bonus
            + self.reimbursement_expense
            - self.deduction_shortage
            - self.deduction_cash_diff
            - self.deduction_expense
            - self.advance
        )
        return self.final_amount

    @property
    def total_deductions(self) -> Decimal:
        return (
            self.deduction_shortage
            + self.deduction_cash_diff
            + self.deduction_expense
            + self.advance
        )


class PayrollDetail(BaseModel):
    """Qaysi sotuv qatoridan qancha komissiya (CLAUDE.md 6 PayrollDetail)."""

    payroll = models.ForeignKey(
        Payroll, on_delete=models.CASCADE, related_name="details",
        verbose_name=_("maosh"),
    )
    sale_item = models.ForeignKey(
        "sales.SaleItem", on_delete=models.PROTECT, related_name="payroll_details",
        verbose_name=_("sotuv qatori"),
    )
    role = models.CharField(
        _("ish turi"), max_length=10, choices=CommissionRole.choices,
        default=CommissionRole.DELIVERY, db_index=True,
    )
    beneficiary = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name=_("kimga"),
        help_text=_("Odatda payroll.distributor bilan bir xil"),
    )
    scope = models.CharField(
        _("qamrov (legacy)"), max_length=12, choices=CommissionScope.choices,
        blank=True, default="",
    )
    percent = models.DecimalField(_("foiz"), **_PCT, default=_ZERO)
    base_amount = models.DecimalField(_("asos summa"), **_MONEY, default=_ZERO)
    commission_amount = models.DecimalField(_("komissiya"), **_MONEY, default=_ZERO)

    class Meta:
        verbose_name = _("maosh tafsiloti")
        verbose_name_plural = _("maosh tafsilotlari")
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.percent}% × {self.base_amount} = {self.commission_amount}"


class Advance(BaseModel):
    """Avans — berilganda hamyonga ADVANCE(+) va kassadan chiqim yoziladi.

    Oy davomidagi avanslar o'sha oy Payroll'ida `advance` bo'lib ushlanadi.
    """

    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="advances",
        verbose_name=_("tarqatuvchi"),
    )
    date = models.DateField(_("sana"))
    amount = models.DecimalField(
        _("summa"), **_MONEY, validators=[MinValueValidator(Decimal("0.01"))]
    )
    note = models.CharField(_("izoh"), max_length=255, blank=True)

    payroll = models.ForeignKey(
        Payroll, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="advances", verbose_name=_("qaysi maoshda hisobga olindi"),
    )
    wallet_transaction_id = models.UUIDField(null=True, blank=True)
    cash_transaction_id = models.UUIDField(null=True, blank=True)

    class Meta:
        verbose_name = _("avans")
        verbose_name_plural = _("avanslar")
        ordering = ("-date", "-created_at")
        indexes = [models.Index(fields=["distributor", "-date"])]

    def __str__(self) -> str:
        return f"{self.distributor.full_name}: {self.amount} ({self.date})"
