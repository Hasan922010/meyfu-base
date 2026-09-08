"""Hamyon modellari (CLAUDE.md 6 — Hamyon [F2], 5.1/5.2)."""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import AppendOnlyModel, BaseModel

from .constants import TransactionType

_ZERO = Decimal("0")
_MONEY = {"max_digits": 14, "decimal_places": 2}


class DistributorWallet(BaseModel):
    """Denormalized balans — haqiqat manbai WalletTransaction (CLAUDE.md 5.2)."""

    distributor = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet",
        verbose_name=_("tarqatuvchi"),
    )
    balance = models.DecimalField(_("balans"), **_MONEY, default=_ZERO)

    class Meta:
        verbose_name = _("hamyon")
        verbose_name_plural = _("hamyonlar")

    def __str__(self) -> str:
        return f"{self.distributor.full_name}: {self.balance}"


class WalletTransaction(AppendOnlyModel):
    """Hamyon jurnali — append-only. `amount` ishorali (CLAUDE.md 5.1)."""

    wallet = models.ForeignKey(
        DistributorWallet, on_delete=models.PROTECT, related_name="transactions",
        verbose_name=_("hamyon"),
    )
    date = models.DateField(_("sana"))
    transaction_type = models.CharField(
        _("turi"), max_length=16, choices=TransactionType.choices, db_index=True
    )
    amount = models.DecimalField(_("summa (ishorali)"), **_MONEY)
    balance_after = models.DecimalField(_("keyingi balans"), **_MONEY)

    reference_type = models.CharField(_("havola turi"), max_length=32, blank=True)
    reference_id = models.CharField(_("havola ID"), max_length=64, blank=True)
    note = models.CharField(_("izoh"), max_length=255, blank=True)

    class Meta(AppendOnlyModel.Meta):
        verbose_name = _("hamyon tranzaksiyasi")
        verbose_name_plural = _("hamyon tranzaksiyalari")
        indexes = [
            models.Index(fields=["wallet", "-created_at"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_transaction_type_display()} {self.amount:+}"
