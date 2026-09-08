"""Kun yopish modellari (CLAUDE.md 6 — Kun yopish [MVP])."""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.catalog.models import Product
from apps.core.models import BaseModel
from apps.warehouse.models import Warehouse

from .constants import DayCloseStatus, ItemCondition

_ZERO = Decimal("0")
_MONEY = {"max_digits": 14, "decimal_places": 2}
_QTY = {"max_digits": 14, "decimal_places": 3}


class DayClose(BaseModel):
    date = models.DateField(_("sana"))
    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="day_closes",
        verbose_name=_("tarqatuvchi"),
    )
    status = models.CharField(
        _("holat"), max_length=10, choices=DayCloseStatus.choices,
        default=DayCloseStatus.PENDING, db_index=True,
    )

    # [tovar]
    loaded_amount = models.DecimalField(_("yuklangan"), **_MONEY, default=_ZERO)
    sold_amount = models.DecimalField(_("sotilgan"), **_MONEY, default=_ZERO)
    returned_amount = models.DecimalField(_("qaytarilgan"), **_MONEY, default=_ZERO)
    stock_difference_qty = models.DecimalField(
        _("tovar farqi (dona)"), **_QTY, default=_ZERO
    )
    stock_difference_amount = models.DecimalField(
        _("tovar farqi (summa)"), **_MONEY, default=_ZERO
    )

    # [pul]
    cash_sales_amount = models.DecimalField(_("naqd sotuv"), **_MONEY, default=_ZERO)
    debt_collected_amount = models.DecimalField(
        _("undirilgan qarz"), **_MONEY, default=_ZERO
    )
    expense_amount = models.DecimalField(
        _("xarajat (jami)"), **_MONEY, default=_ZERO
    )
    expense_approved_amount = models.DecimalField(
        _("tasdiqlangan xarajat (qo'ldagi naqd)"), **_MONEY, default=_ZERO
    )
    cash_expected = models.DecimalField(_("kutilgan naqd"), **_MONEY, default=_ZERO)
    cash_handed_amount = models.DecimalField(
        _("topshirilgan naqd"), **_MONEY, default=_ZERO
    )
    cash_difference = models.DecimalField(
        _("kassa farqi"), **_MONEY, default=_ZERO,
        help_text=_("manfiy = kamomad"),
    )
    wallet_balance_end = models.DecimalField(
        _("kun oxiridagi hamyon balansi"), **_MONEY, default=_ZERO
    )

    # [boshqa]
    debt_given_amount = models.DecimalField(
        _("qarzga berilgan"), **_MONEY, default=_ZERO
    )
    sales_count = models.PositiveIntegerField(_("sotuvlar soni"), default=0)
    visits_count = models.PositiveIntegerField(_("tashriflar soni"), default=0)
    new_clients_count = models.PositiveIntegerField(_("yangi mijozlar"), default=0)

    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name=_("kim yopdi"),
    )
    closed_at = models.DateTimeField(_("yopilgan vaqti"), null=True, blank=True)
    note = models.CharField(_("izoh"), max_length=500, blank=True)

    class Meta:
        verbose_name = _("kun yopish")
        verbose_name_plural = _("kun yopishlar")
        ordering = ("-date",)
        constraints = [
            models.UniqueConstraint(
                fields=["distributor", "date"], name="uniq_dayclose_distributor_date"
            )
        ]
        indexes = [models.Index(fields=["status", "-date"])]

    def __str__(self) -> str:
        return f"{self.distributor.full_name} · {self.date}"

    @property
    def has_difference(self) -> bool:
        return self.cash_difference != _ZERO or self.stock_difference_qty != _ZERO


class DailyReturn(BaseModel):
    number = models.CharField(_("raqam"), max_length=32, unique=True, blank=True)
    date = models.DateField(_("sana"))
    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="daily_returns", verbose_name=_("tarqatuvchi"),
    )
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name="daily_returns",
        verbose_name=_("ombor"),
    )
    day_close = models.ForeignKey(
        DayClose, on_delete=models.CASCADE, null=True, blank=True,
        related_name="daily_returns", verbose_name=_("kun yopish"),
    )
    total_amount = models.DecimalField(_("summa"), **_MONEY, default=_ZERO)
    note = models.CharField(_("izoh"), max_length=500, blank=True)

    class Meta:
        verbose_name = _("kunlik qaytarish")
        verbose_name_plural = _("kunlik qaytarishlar")
        ordering = ("-date",)

    def __str__(self) -> str:
        return self.number or f"Qaytarish {self.pk}"


class DailyReturnItem(BaseModel):
    daily_return = models.ForeignKey(
        DailyReturn, on_delete=models.CASCADE, related_name="items",
        verbose_name=_("qaytarish"),
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="daily_return_items",
        verbose_name=_("mahsulot"),
    )
    quantity = models.DecimalField(
        _("miqdor"), **_QTY, validators=[MinValueValidator(Decimal("0.001"))]
    )
    condition = models.CharField(
        _("holati"), max_length=10, choices=ItemCondition.choices,
        default=ItemCondition.GOOD,
    )
    price = models.DecimalField(_("narx"), **_MONEY, default=_ZERO)
    amount = models.DecimalField(_("summa"), **_MONEY, default=_ZERO)

    class Meta:
        verbose_name = _("qaytarish qatori")
        verbose_name_plural = _("qaytarish qatorlari")
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.product.sku} × {self.quantity} ({self.condition})"


class CashHandover(BaseModel):
    date = models.DateField(_("sana"))
    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="cash_handovers", verbose_name=_("tarqatuvchi"),
    )
    day_close = models.ForeignKey(
        DayClose, on_delete=models.CASCADE, null=True, blank=True,
        related_name="cash_handovers", verbose_name=_("kun yopish"),
    )
    amount = models.DecimalField(
        _("summa"), **_MONEY, validators=[MinValueValidator(_ZERO)]
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name=_("kim qabul qildi"),
    )
    confirmed = models.BooleanField(_("tasdiqlangan"), default=False)
    photo = models.ImageField(_("rasm"), upload_to="handovers/", null=True, blank=True)
    note = models.CharField(_("izoh"), max_length=500, blank=True)

    class Meta:
        verbose_name = _("kassaga topshirish")
        verbose_name_plural = _("kassaga topshirishlar")
        ordering = ("-date",)

    def __str__(self) -> str:
        return f"{self.distributor.full_name}: {self.amount}"
