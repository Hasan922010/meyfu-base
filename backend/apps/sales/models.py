"""Sotuv, qaytarish va qarzdorlik modellari (CLAUDE.md 6 — [MVP])."""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.catalog.models import Product
from apps.clients.models import Client
from apps.core.models import BaseModel

from .constants import (
    DebtStatus,
    PaymentType,
    ReturnReason,
    SaleStatus,
)

_ZERO = Decimal("0")
_MONEY = {"max_digits": 14, "decimal_places": 2}
_QTY = {"max_digits": 14, "decimal_places": 3}
_GEO = {"max_digits": 9, "decimal_places": 6, "null": True, "blank": True}


class Sale(BaseModel):
    number = models.CharField(_("raqam"), max_length=32, unique=True, blank=True)
    date = models.DateField(_("sana"))
    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sales",
        verbose_name=_("tarqatuvchi"),
    )
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name="sales",
        verbose_name=_("mijoz"),
    )
    order = models.ForeignKey(
        "orders.Order", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="sales", verbose_name=_("buyurtma"),
    )
    payment_type = models.CharField(
        _("to'lov turi"), max_length=10, choices=PaymentType.choices
    )

    total_amount = models.DecimalField(_("umumiy summa"), **_MONEY, default=_ZERO)
    discount_amount = models.DecimalField(_("chegirma"), **_MONEY, default=_ZERO)
    paid_amount = models.DecimalField(_("to'langan"), **_MONEY, default=_ZERO)
    debt_amount = models.DecimalField(_("qarz"), **_MONEY, default=_ZERO)
    due_date = models.DateField(_("qarz muddati"), null=True, blank=True)

    status = models.CharField(
        _("holat"), max_length=10, choices=SaleStatus.choices,
        default=SaleStatus.COMPLETED, db_index=True,
    )
    flagged = models.BooleanField(_("belgilangan"), default=False, db_index=True)
    flag_reason = models.CharField(_("belgilash sababi"), max_length=255, blank=True)

    latitude = models.DecimalField(_("kenglik"), **_GEO)
    longitude = models.DecimalField(_("uzunlik"), **_GEO)

    # Offline (CLAUDE.md 4.2, 7.9)
    client_uuid = models.UUIDField(
        _("mijoz tomonidagi UUID"), unique=True, null=True, blank=True
    )
    is_synced = models.BooleanField(_("sinxronlangan"), default=True)
    device_time = models.DateTimeField(_("qurilma vaqti"), null=True, blank=True)

    note = models.CharField(_("izoh"), max_length=500, blank=True)
    signature_image = models.ImageField(
        _("imzo"), upload_to="signatures/", null=True, blank=True
    )
    cancelled_at = models.DateTimeField(_("bekor qilingan vaqti"), null=True, blank=True)

    class Meta:
        verbose_name = _("sotuv")
        verbose_name_plural = _("sotuvlar")
        ordering = ("-date", "-created_at")
        indexes = [
            models.Index(fields=["distributor", "-date"]),
            models.Index(fields=["client", "-date"]),
            models.Index(fields=["status", "flagged"]),
            # hisobotlar: sana oralig'i + holat bo'yicha (CLAUDE.md 16)
            models.Index(fields=["date", "status"]),
        ]

    def __str__(self) -> str:
        return self.number or f"Sotuv {self.pk}"

    def recalc(self) -> None:
        agg = self.items.aggregate(s=models.Sum("amount"))
        self.total_amount = (agg["s"] or _ZERO) - self.discount_amount

    @property
    def order_taker(self):
        """Zakazni kim olgan — Order bo'lsa uning egasi, bo'lmasa yetkazuvchining o'zi."""
        if self.order_id:
            return self.order.taken_by
        return self.distributor


class SaleItem(BaseModel):
    sale = models.ForeignKey(
        Sale, on_delete=models.CASCADE, related_name="items", verbose_name=_("sotuv")
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="sale_items",
        verbose_name=_("mahsulot"),
    )
    quantity = models.DecimalField(
        _("miqdor"), **_QTY, validators=[MinValueValidator(Decimal("0.001"))]
    )
    price = models.DecimalField(
        _("narx"), **_MONEY, validators=[MinValueValidator(_ZERO)]
    )
    cost_price = models.DecimalField(_("tannarx (snapshot)"), **_MONEY, default=_ZERO)
    discount_percent = models.DecimalField(
        _("chegirma %"), max_digits=5, decimal_places=2, default=_ZERO
    )
    amount = models.DecimalField(_("summa"), **_MONEY, default=_ZERO)
    profit = models.DecimalField(_("foyda"), **_MONEY, default=_ZERO)
    below_min_price = models.BooleanField(_("minimal narxdan past"), default=False)

    class Meta:
        verbose_name = _("sotuv qatori")
        verbose_name_plural = _("sotuv qatorlari")
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.product.sku} × {self.quantity}"

    def compute(self) -> None:
        gross = (self.quantity or _ZERO) * (self.price or _ZERO)
        self.amount = gross * (Decimal("1") - (self.discount_percent or _ZERO) / 100)
        self.profit = self.amount - (self.quantity or _ZERO) * (self.cost_price or _ZERO)


class SaleReturn(BaseModel):
    number = models.CharField(_("raqam"), max_length=32, unique=True, blank=True)
    date = models.DateField(_("sana"))
    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sale_returns",
        verbose_name=_("tarqatuvchi"),
    )
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name="sale_returns",
        verbose_name=_("mijoz"),
    )
    sale = models.ForeignKey(
        Sale, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="returns", verbose_name=_("asl sotuv"),
    )
    reason = models.CharField(
        _("sababi"), max_length=16, choices=ReturnReason.choices
    )
    restock = models.BooleanField(
        _("mashina qoldig'iga qaytsinmi"), default=True,
        help_text=_("Brak odatda qaytmaydi"),
    )
    total_amount = models.DecimalField(_("summa"), **_MONEY, default=_ZERO)
    note = models.CharField(_("izoh"), max_length=500, blank=True)

    client_uuid = models.UUIDField(unique=True, null=True, blank=True)
    device_time = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = _("sotuv qaytarishi")
        verbose_name_plural = _("sotuv qaytarishlari")
        ordering = ("-date", "-created_at")

    def __str__(self) -> str:
        return self.number or f"Qaytarish {self.pk}"


class SaleReturnItem(BaseModel):
    sale_return = models.ForeignKey(
        SaleReturn, on_delete=models.CASCADE, related_name="items",
        verbose_name=_("qaytarish"),
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="return_items",
        verbose_name=_("mahsulot"),
    )
    quantity = models.DecimalField(
        _("miqdor"), **_QTY, validators=[MinValueValidator(Decimal("0.001"))]
    )
    price = models.DecimalField(_("narx"), **_MONEY, default=_ZERO)
    amount = models.DecimalField(_("summa"), **_MONEY, default=_ZERO)

    class Meta:
        verbose_name = _("qaytarish qatori")
        verbose_name_plural = _("qaytarish qatorlari")
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.product.sku} × {self.quantity}"


class Debt(BaseModel):
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name="debts", verbose_name=_("mijoz")
    )
    sale = models.OneToOneField(
        Sale, on_delete=models.CASCADE, null=True, blank=True,
        related_name="debt", verbose_name=_("sotuv"),
    )
    amount = models.DecimalField(_("summa"), **_MONEY)
    paid_amount = models.DecimalField(_("to'langan"), **_MONEY, default=_ZERO)
    remaining = models.DecimalField(_("qoldiq"), **_MONEY, default=_ZERO)
    due_date = models.DateField(_("muddat"), null=True, blank=True)
    status = models.CharField(
        _("holat"), max_length=10, choices=DebtStatus.choices,
        default=DebtStatus.ACTIVE, db_index=True,
    )

    class Meta:
        verbose_name = _("qarz")
        verbose_name_plural = _("qarzlar")
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["client", "status"])]

    def __str__(self) -> str:
        return f"{self.client.name}: {self.remaining}"

    def recalc(self) -> None:
        self.remaining = self.amount - self.paid_amount
        if self.remaining <= _ZERO:
            self.status = DebtStatus.PAID
        elif self.paid_amount > _ZERO:
            self.status = DebtStatus.PARTIAL
        else:
            self.status = DebtStatus.ACTIVE


class DebtPayment(BaseModel):
    debt = models.ForeignKey(
        Debt, on_delete=models.PROTECT, related_name="payments", verbose_name=_("qarz")
    )
    amount = models.DecimalField(
        _("summa"), **_MONEY, validators=[MinValueValidator(Decimal("0.01"))]
    )
    payment_type = models.CharField(
        _("to'lov turi"), max_length=10, choices=PaymentType.choices,
        default=PaymentType.CASH,
    )
    collected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="debt_payments", verbose_name=_("kim yig'di"),
    )
    date = models.DateField(_("sana"))

    client_uuid = models.UUIDField(unique=True, null=True, blank=True)
    device_time = models.DateTimeField(null=True, blank=True)
    note = models.CharField(_("izoh"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("qarz to'lovi")
        verbose_name_plural = _("qarz to'lovlari")
        ordering = ("-date", "-created_at")
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["collected_by", "-date"]),
        ]

    def __str__(self) -> str:
        return f"{self.debt.client.name}: +{self.amount}"
