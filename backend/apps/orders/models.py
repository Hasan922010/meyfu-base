"""Buyurtma (zakaz) modellari — v4 T1.

Oqim: DRAFT → PLACED → APPROVED → LOADED → DELIVERED / PARTIALLY_DELIVERED.
Yetkazishda har buyurtma uchun `sales.Sale` yaratiladi (`Sale.order`).
Zakazni olgan (`taken_by`) va yetkazgan (`Sale.distributor`) alohida komissiya oladi.
"""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.catalog.models import Product
from apps.clients.models import Client
from apps.core.models import BaseModel
from apps.sales.constants import PaymentType

from .constants import OrderStatus

_ZERO = Decimal("0")
_MONEY = {"max_digits": 14, "decimal_places": 2}
_QTY = {"max_digits": 14, "decimal_places": 3}


class Order(BaseModel):
    number = models.CharField(_("raqam"), max_length=32, unique=True, blank=True)
    date = models.DateField(_("sana"))
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name="orders",
        verbose_name=_("mijoz"),
    )
    taken_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="orders_taken", verbose_name=_("zakazni kim oldi"),
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="orders_to_deliver", verbose_name=_("yetkazuvchi"),
    )
    loading = models.ForeignKey(
        "warehouse.Loading", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="orders", verbose_name=_("yuklama"),
    )

    status = models.CharField(
        _("holat"), max_length=20, choices=OrderStatus.choices,
        default=OrderStatus.DRAFT, db_index=True,
    )
    payment_intent = models.CharField(
        _("to'lov niyati"), max_length=10, choices=PaymentType.choices, blank=True
    )
    desired_date = models.DateField(_("istalgan yetkazish sanasi"), null=True, blank=True)
    total_amount = models.DecimalField(_("umumiy summa"), **_MONEY, default=_ZERO)
    note = models.CharField(_("izoh"), max_length=500, blank=True)

    # Offline (CLAUDE.md 4.2, 7.9)
    client_uuid = models.UUIDField(
        _("mijoz tomonidagi UUID"), unique=True, null=True, blank=True
    )
    device_time = models.DateTimeField(_("qurilma vaqti"), null=True, blank=True)

    cancelled_at = models.DateTimeField(_("bekor qilingan vaqti"), null=True, blank=True)
    cancel_reason = models.CharField(_("bekor sababi"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("buyurtma")
        verbose_name_plural = _("buyurtmalar")
        ordering = ("-date", "-created_at")
        indexes = [
            models.Index(fields=["taken_by", "-date"]),
            models.Index(fields=["assigned_to", "-date"]),
            models.Index(fields=["status", "-date"]),
        ]

    def __str__(self) -> str:
        return self.number or f"Buyurtma {self.pk}"

    def recalc(self) -> None:
        agg = self.items.aggregate(s=models.Sum("amount"))
        self.total_amount = agg["s"] or _ZERO


class OrderItem(BaseModel):
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="items", verbose_name=_("buyurtma")
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="order_items",
        verbose_name=_("mahsulot"),
    )
    quantity = models.DecimalField(
        _("miqdor"), **_QTY, validators=[MinValueValidator(Decimal("0.001"))]
    )
    delivered_quantity = models.DecimalField(
        _("yetkazilgan miqdor"), **_QTY, default=_ZERO
    )
    price = models.DecimalField(
        _("narx"), **_MONEY, validators=[MinValueValidator(_ZERO)]
    )
    amount = models.DecimalField(_("summa"), **_MONEY, default=_ZERO)

    class Meta:
        verbose_name = _("buyurtma qatori")
        verbose_name_plural = _("buyurtma qatorlari")
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.product.sku} × {self.quantity}"

    def save(self, *args, **kwargs):
        self.amount = (self.quantity or _ZERO) * (self.price or _ZERO)
        super().save(*args, **kwargs)
