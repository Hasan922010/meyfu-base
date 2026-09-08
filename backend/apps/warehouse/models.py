"""Ombor modellari (CLAUDE.md 6 — Ombor [MVP], 5.1/5.2 jurnallar)."""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.catalog.models import Product
from apps.core.models import AppendOnlyModel, BaseModel

from .constants import (
    LoadingStatus,
    MovementType,
    PurchaseSource,
    PurchaseStatus,
)

_ZERO = Decimal("0")
_MONEY = {"max_digits": 14, "decimal_places": 2}
_QTY = {"max_digits": 14, "decimal_places": 3}


class Warehouse(BaseModel):
    name = models.CharField(_("nomi"), max_length=128)
    address = models.CharField(_("manzil"), max_length=255, blank=True)
    is_active = models.BooleanField(_("faol"), default=True)

    class Meta:
        verbose_name = _("ombor")
        verbose_name_plural = _("omborlar")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Supplier(BaseModel):
    name = models.CharField(_("nomi"), max_length=255)
    phone = models.CharField(_("telefon"), max_length=20, blank=True)
    inn = models.CharField(_("INN / STIR"), max_length=20, blank=True)
    address = models.CharField(_("manzil"), max_length=255, blank=True)
    note = models.CharField(_("izoh"), max_length=255, blank=True)
    is_active = models.BooleanField(_("faol"), default=True)

    class Meta:
        verbose_name = _("yetkazib beruvchi")
        verbose_name_plural = _("yetkazib beruvchilar")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Stock(BaseModel):
    """Ombordagi joriy qoldiq. Denormalized — haqiqat manbai StockMovement (5.2)."""

    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name="stocks",
        verbose_name=_("ombor"),
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="stocks",
        verbose_name=_("mahsulot"),
    )
    quantity = models.DecimalField(_("qoldiq"), **_QTY, default=_ZERO)
    reserved_quantity = models.DecimalField(
        _("band qilingan"), **_QTY, default=_ZERO
    )

    class Meta:
        verbose_name = _("qoldiq")
        verbose_name_plural = _("qoldiqlar")
        constraints = [
            models.UniqueConstraint(
                fields=["warehouse", "product"], name="uniq_stock_warehouse_product"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=0), name="stock_quantity_non_negative"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product.sku} @ {self.warehouse.name}: {self.quantity}"

    @property
    def available_quantity(self) -> Decimal:
        return self.quantity - self.reserved_quantity


class StockMovement(AppendOnlyModel):
    """Tovar harakati jurnali — append-only (CLAUDE.md 5.1).

    `quantity` ishorali: musbat = kirim, manfiy = chiqim.
    Har ombor+mahsulot uchun: Stock.quantity == SUM(StockMovement.quantity).
    """

    movement_type = models.CharField(
        _("turi"), max_length=16, choices=MovementType.choices, db_index=True
    )
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name="movements",
        verbose_name=_("ombor"),
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="movements",
        verbose_name=_("mahsulot"),
    )
    quantity = models.DecimalField(_("miqdor (ishorali)"), **_QTY)
    balance_after = models.DecimalField(_("harakatdan keyingi qoldiq"), **_QTY)

    from_location = models.CharField(_("qayerdan"), max_length=128, blank=True)
    to_location = models.CharField(_("qayerga"), max_length=128, blank=True)

    reference_type = models.CharField(_("havola turi"), max_length=32, blank=True)
    reference_id = models.CharField(_("havola ID"), max_length=64, blank=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="stock_movements", verbose_name=_("kim"),
    )
    note = models.CharField(_("izoh"), max_length=255, blank=True)

    class Meta(AppendOnlyModel.Meta):
        verbose_name = _("tovar harakati")
        verbose_name_plural = _("tovar harakati jurnali")
        indexes = [
            models.Index(fields=["warehouse", "product", "-created_at"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_movement_type_display()} {self.product.sku} {self.quantity:+}"


class Purchase(BaseModel):
    """Yetkazib beruvchidan tovar qabuli (CLAUDE.md 6, 7.12)."""

    number = models.CharField(_("raqam"), max_length=32, unique=True, blank=True)
    supplier = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, related_name="purchases",
        verbose_name=_("yetkazib beruvchi"),
    )
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name="purchases",
        verbose_name=_("ombor"),
    )
    invoice_number = models.CharField(_("nakladnoy raqami"), max_length=64, blank=True)
    date = models.DateField(_("sana"))

    total_amount = models.DecimalField(
        _("umumiy summa"), **_MONEY, default=_ZERO,
        validators=[MinValueValidator(_ZERO)],
    )
    paid_amount = models.DecimalField(
        _("to'langan"), **_MONEY, default=_ZERO,
        validators=[MinValueValidator(_ZERO)],
    )
    debt_amount = models.DecimalField(_("qarz"), **_MONEY, default=_ZERO)

    source = models.CharField(
        _("manba"), max_length=8, choices=PurchaseSource.choices,
        default=PurchaseSource.MANUAL,
    )
    status = models.CharField(
        _("holat"), max_length=10, choices=PurchaseStatus.choices,
        default=PurchaseStatus.DRAFT, db_index=True,
    )
    confirmed_at = models.DateTimeField(_("tasdiqlangan vaqti"), null=True, blank=True)
    note = models.CharField(_("izoh"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("tovar qabuli")
        verbose_name_plural = _("tovar qabullari")
        ordering = ("-date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=["supplier", "invoice_number"],
                condition=~models.Q(invoice_number=""),
                name="uniq_purchase_supplier_invoice",
            )
        ]

    def __str__(self) -> str:
        return self.number or f"Qabul {self.pk}"

    def recalc_totals(self) -> None:
        agg = self.items.aggregate(s=models.Sum("amount"))
        self.total_amount = agg["s"] or _ZERO
        self.debt_amount = self.total_amount - self.paid_amount


class PurchaseItem(BaseModel):
    purchase = models.ForeignKey(
        Purchase, on_delete=models.CASCADE, related_name="items",
        verbose_name=_("qabul"),
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="purchase_items",
        verbose_name=_("mahsulot"),
    )
    quantity = models.DecimalField(
        _("miqdor"), **_QTY, validators=[MinValueValidator(Decimal("0.001"))]
    )
    cost_price = models.DecimalField(
        _("dona narxi"), **_MONEY, validators=[MinValueValidator(_ZERO)]
    )
    amount = models.DecimalField(_("summa"), **_MONEY, default=_ZERO)

    class Meta:
        verbose_name = _("qabul qatori")
        verbose_name_plural = _("qabul qatorlari")
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.product.sku} × {self.quantity}"

    def save(self, *args, **kwargs):
        self.amount = (self.quantity or _ZERO) * (self.cost_price or _ZERO)
        super().save(*args, **kwargs)


class VanStock(BaseModel):
    """Tarqatuvchi mashinasidagi qoldiq (CLAUDE.md 6, 5.2).

    quantity == (tasdiqlangan yuklamalar) − (sotuvlar) − (qaytarishlar).
    """

    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="van_stocks",
        verbose_name=_("tarqatuvchi"),
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="van_stocks",
        verbose_name=_("mahsulot"),
    )
    quantity = models.DecimalField(_("qoldiq"), **_QTY, default=_ZERO)

    class Meta:
        verbose_name = _("mashina qoldig'i")
        verbose_name_plural = _("mashina qoldiqlari")
        ordering = ("product__name",)
        constraints = [
            models.UniqueConstraint(
                fields=["distributor", "product"],
                name="uniq_vanstock_distributor_product",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=0),
                name="vanstock_quantity_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product.sku} @ {self.distributor.full_name}: {self.quantity}"


class Loading(BaseModel):
    """Ombordan tarqatuvchiga yuklash (CLAUDE.md 1, 6)."""

    number = models.CharField(_("raqam"), max_length=32, unique=True, blank=True)
    date = models.DateField(_("sana"))
    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="loadings",
        verbose_name=_("tarqatuvchi"),
    )
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name="loadings",
        verbose_name=_("ombor"),
    )
    status = models.CharField(
        _("holat"), max_length=10, choices=LoadingStatus.choices,
        default=LoadingStatus.DRAFT, db_index=True,
    )
    total_amount = models.DecimalField(_("umumiy summa"), **_MONEY, default=_ZERO)
    sent_at = models.DateTimeField(_("yuborilgan vaqti"), null=True, blank=True)
    confirmed_at = models.DateTimeField(_("tasdiqlangan vaqti"), null=True, blank=True)
    note = models.CharField(_("izoh"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("yuklama")
        verbose_name_plural = _("yuklamalar")
        ordering = ("-date", "-created_at")
        indexes = [models.Index(fields=["distributor", "-date"])]

    def __str__(self) -> str:
        return self.number or f"Yuklama {self.pk}"

    def recalc_total(self) -> None:
        agg = self.items.aggregate(s=models.Sum("amount"))
        self.total_amount = agg["s"] or _ZERO


class LoadingItem(BaseModel):
    loading = models.ForeignKey(
        Loading, on_delete=models.CASCADE, related_name="items",
        verbose_name=_("yuklama"),
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="loading_items",
        verbose_name=_("mahsulot"),
    )
    quantity = models.DecimalField(
        _("miqdor"), **_QTY, validators=[MinValueValidator(Decimal("0.001"))]
    )
    price = models.DecimalField(
        _("narx"), **_MONEY, validators=[MinValueValidator(_ZERO)]
    )
    amount = models.DecimalField(_("summa"), **_MONEY, default=_ZERO)

    class Meta:
        verbose_name = _("yuklama qatori")
        verbose_name_plural = _("yuklama qatorlari")
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.product.sku} × {self.quantity}"

    def save(self, *args, **kwargs):
        self.amount = (self.quantity or _ZERO) * (self.price or _ZERO)
        super().save(*args, **kwargs)
