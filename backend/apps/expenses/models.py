"""Xarajat modellari (CLAUDE.md 6 — Xarajat [F2])."""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel
from apps.dayclose.models import DayClose

from .constants import ExpenseStatus, PaidBy, PaymentSource

_ZERO = Decimal("0")
_MONEY = {"max_digits": 14, "decimal_places": 2}
_GEO = {"max_digits": 9, "decimal_places": 6, "null": True, "blank": True}


class ExpenseCategory(BaseModel):
    name = models.CharField(_("nomi"), max_length=128, unique=True)
    icon = models.CharField(_("ikonka"), max_length=32, blank=True)
    color = models.CharField(_("rang"), max_length=16, blank=True)
    requires_receipt = models.BooleanField(_("chek majburiy"), default=False)
    daily_limit = models.DecimalField(
        _("kunlik limit"), **_MONEY, default=_ZERO,
        help_text=_("0 = limitsiz"),
    )
    paid_by = models.CharField(
        _("kim to'laydi"), max_length=12, choices=PaidBy.choices,
        default=PaidBy.COMPANY,
    )
    is_active = models.BooleanField(_("faol"), default=True)

    class Meta:
        verbose_name = _("xarajat kategoriyasi")
        verbose_name_plural = _("xarajat kategoriyalari")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class DistributorExpense(BaseModel):
    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="expenses",
        verbose_name=_("tarqatuvchi"),
    )
    date = models.DateField(_("sana"))
    category = models.ForeignKey(
        ExpenseCategory, on_delete=models.PROTECT, related_name="expenses",
        verbose_name=_("kategoriya"),
    )
    amount = models.DecimalField(
        _("summa"), **_MONEY, validators=[MinValueValidator(Decimal("0.01"))]
    )
    description = models.CharField(_("izoh"), max_length=500, blank=True)
    receipt_image = models.ImageField(
        _("chek rasmi"), upload_to="receipts/", null=True, blank=True
    )
    receipt_scan_data = models.JSONField(
        _("chek OCR ma'lumoti"), default=dict, blank=True
    )
    latitude = models.DecimalField(_("kenglik"), **_GEO)
    longitude = models.DecimalField(_("uzunlik"), **_GEO)

    payment_source = models.CharField(
        _("to'lov manbai"), max_length=16, choices=PaymentSource.choices,
        default=PaymentSource.CASH_ON_HAND,
    )
    status = models.CharField(
        _("holat"), max_length=10, choices=ExpenseStatus.choices,
        default=ExpenseStatus.PENDING, db_index=True,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name=_("kim tasdiqladi"),
    )
    approved_at = models.DateTimeField(_("tasdiqlangan vaqti"), null=True, blank=True)
    reject_reason = models.CharField(_("rad sababi"), max_length=255, blank=True)
    is_deductible = models.BooleanField(
        _("maoshdan ushlanadimi"), default=False,
        help_text=_("expenses_covered_by=SALARY bo'lsa"),
    )

    day_close = models.ForeignKey(
        DayClose, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="expenses", verbose_name=_("kun yopish"),
    )

    # Offline (CLAUDE.md 4.2)
    client_uuid = models.UUIDField(unique=True, null=True, blank=True)
    is_synced = models.BooleanField(_("sinxronlangan"), default=True)
    device_time = models.DateTimeField(_("qurilma vaqti"), null=True, blank=True)

    class Meta:
        verbose_name = _("xarajat")
        verbose_name_plural = _("xarajatlar")
        ordering = ("-date", "-created_at")
        indexes = [
            models.Index(fields=["distributor", "-date"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.category.name}: {self.amount}"

    @property
    def affects_wallet(self) -> bool:
        return self.payment_source == PaymentSource.CASH_ON_HAND


class FuelLog(BaseModel):
    expense = models.OneToOneField(
        DistributorExpense, on_delete=models.CASCADE, related_name="fuel_log",
        verbose_name=_("xarajat"),
    )
    liters = models.DecimalField(_("litr"), max_digits=8, decimal_places=2)
    price_per_liter = models.DecimalField(_("litr narxi"), **_MONEY)
    odometer = models.PositiveIntegerField(_("odometr"), null=True, blank=True)
    station_name = models.CharField(_("shoxobcha"), max_length=128, blank=True)

    class Meta:
        verbose_name = _("yoqilg'i jurnali")
        verbose_name_plural = _("yoqilg'i jurnallari")

    def __str__(self) -> str:
        return f"{self.liters} l @ {self.price_per_liter}"
