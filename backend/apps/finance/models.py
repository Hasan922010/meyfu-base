"""Moliya modellari (CLAUDE.md 6 — CashTransaction, CompanyExpense [F2])."""
from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import AppendOnlyModel, BaseModel

from .constants import CashTxType, CompanyExpenseCategory

_ZERO = Decimal("0")
_MONEY = {"max_digits": 16, "decimal_places": 2}


class CashAccount(BaseModel):
    """Kompaniya kassasi. Odatda bitta ('Asosiy kassa')."""

    name = models.CharField(_("nomi"), max_length=128, unique=True)
    balance = models.DecimalField(_("balans"), **_MONEY, default=_ZERO)
    is_active = models.BooleanField(_("faol"), default=True)

    class Meta:
        verbose_name = _("kassa")
        verbose_name_plural = _("kassalar")
        ordering = ("name",)

    def __str__(self) -> str:
        return f"{self.name}: {self.balance}"


class CashTransaction(AppendOnlyModel):
    """Kassa jurnali — append-only. `amount` ishorali (CLAUDE.md 5.1)."""

    account = models.ForeignKey(
        CashAccount, on_delete=models.PROTECT, related_name="transactions",
        verbose_name=_("kassa"),
    )
    date = models.DateField(_("sana"))
    transaction_type = models.CharField(
        _("turi"), max_length=20, choices=CashTxType.choices, db_index=True
    )
    amount = models.DecimalField(_("summa (ishorali)"), **_MONEY)
    balance_after = models.DecimalField(_("keyingi balans"), **_MONEY)

    counterparty = models.CharField(_("kontragent"), max_length=255, blank=True)
    reference_type = models.CharField(_("havola turi"), max_length=32, blank=True)
    reference_id = models.CharField(_("havola ID"), max_length=64, blank=True)
    note = models.CharField(_("izoh"), max_length=255, blank=True)

    class Meta(AppendOnlyModel.Meta):
        verbose_name = _("kassa tranzaksiyasi")
        verbose_name_plural = _("kassa tranzaksiyalari")
        indexes = [
            models.Index(fields=["account", "-created_at"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_transaction_type_display()} {self.amount:+}"


class CompanyExpense(BaseModel):
    date = models.DateField(_("sana"))
    category = models.CharField(
        _("kategoriya"), max_length=16, choices=CompanyExpenseCategory.choices,
        default=CompanyExpenseCategory.OTHER,
    )
    amount = models.DecimalField(
        _("summa"), **_MONEY, validators=[MinValueValidator(Decimal("0.01"))]
    )
    description = models.CharField(_("izoh"), max_length=500, blank=True)
    paid_from_cash = models.BooleanField(
        _("kassadan to'landimi"), default=True,
        help_text=_("True bo'lsa kassa balansidan chiqadi"),
    )
    receipt_image = models.ImageField(
        _("hujjat"), upload_to="company_receipts/", null=True, blank=True
    )
    cash_transaction = models.OneToOneField(
        CashTransaction, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="company_expense", verbose_name=_("kassa yozuvi"),
    )

    class Meta:
        verbose_name = _("kompaniya xarajati")
        verbose_name_plural = _("kompaniya xarajatlari")
        ordering = ("-date", "-created_at")
        indexes = [models.Index(fields=["category", "-date"])]

    def __str__(self) -> str:
        return f"{self.get_category_display()}: {self.amount}"
