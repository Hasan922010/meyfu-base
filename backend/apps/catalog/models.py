"""Katalog modellari (CLAUDE.md 6 — Katalog [MVP])."""
from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel

_ZERO = Decimal("0")
_MONEY = {"max_digits": 14, "decimal_places": 2}
_QTY = {"max_digits": 14, "decimal_places": 3}


class Category(BaseModel):
    name = models.CharField(_("nomi"), max_length=128)
    parent = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True,
        related_name="children", verbose_name=_("bo'lim"),
    )
    is_active = models.BooleanField(_("faol"), default=True)

    class Meta:
        verbose_name = _("kategoriya")
        verbose_name_plural = _("kategoriyalar")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Brand(BaseModel):
    name = models.CharField(_("nomi"), max_length=128, unique=True)
    is_active = models.BooleanField(_("faol"), default=True)

    class Meta:
        verbose_name = _("brend")
        verbose_name_plural = _("brendlar")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Unit(BaseModel):
    name = models.CharField(_("nomi"), max_length=64, unique=True)
    short_name = models.CharField(_("qisqa nomi"), max_length=16)

    class Meta:
        verbose_name = _("o'lchov birligi")
        verbose_name_plural = _("o'lchov birliklari")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.short_name


class Product(BaseModel):
    name = models.CharField(_("nomi"), max_length=255)
    sku = models.CharField(_("artikul (SKU)"), max_length=64, unique=True)
    barcode = models.CharField(
        _("shtrix-kod"), max_length=64, blank=True, db_index=True
    )
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="products",
        verbose_name=_("kategoriya"),
    )
    brand = models.ForeignKey(
        Brand, on_delete=models.PROTECT, null=True, blank=True,
        related_name="products", verbose_name=_("brend"),
    )
    unit = models.ForeignKey(
        Unit, on_delete=models.PROTECT, related_name="products",
        verbose_name=_("o'lchov birligi"),
    )
    image = models.ImageField(
        _("rasm"), upload_to="products/", null=True, blank=True
    )

    cost_price = models.DecimalField(
        _("tannarx"), **_MONEY, default=_ZERO,
        validators=[MinValueValidator(_ZERO)],
    )
    wholesale_price = models.DecimalField(
        _("optom narx"), **_MONEY, default=_ZERO,
        validators=[MinValueValidator(_ZERO)],
    )
    retail_price = models.DecimalField(
        _("chakana narx"), **_MONEY, default=_ZERO,
        validators=[MinValueValidator(_ZERO)],
    )
    min_price = models.DecimalField(
        _("minimal narx"), **_MONEY, default=_ZERO,
        validators=[MinValueValidator(_ZERO)],
    )

    pack_quantity = models.DecimalField(
        _("qadoqdagi soni"), **_QTY, default=Decimal("1"),
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    commission_percent = models.DecimalField(
        _("komissiya foizi"), max_digits=5, decimal_places=2, default=_ZERO,
        validators=[MinValueValidator(_ZERO)],
    )
    min_stock_alert = models.DecimalField(
        _("kam qoldiq ogohlantirishi"), **_QTY, default=_ZERO,
        validators=[MinValueValidator(_ZERO)],
    )
    is_active = models.BooleanField(_("faol"), default=True, db_index=True)

    PRICE_FIELDS = (
        "cost_price", "wholesale_price", "retail_price",
        "min_price", "commission_percent",
    )

    class Meta:
        verbose_name = _("mahsulot")
        verbose_name_plural = _("mahsulotlar")
        ordering = ("name",)
        indexes = [models.Index(fields=["is_active", "name"])]

    def __str__(self) -> str:
        return f"{self.name} ({self.sku})"


class ProductImage(BaseModel):
    """Mahsulot rasmlari galereyasi (v4 T2 — adashib ketmaslik uchun).

    `is_primary=True` bo'lgan rasm `Product.image` bilan sinxronlanadi (backward compat).
    Har mahsulotda bittadan ortiq asosiy rasm bo'lmaydi (unique constraint).
    """

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="images",
        verbose_name=_("mahsulot"),
    )
    image = models.ImageField(_("rasm"), upload_to="products/gallery/")
    thumbnail = models.ImageField(
        _("eskiz"), upload_to="products/gallery/thumb/", null=True, blank=True
    )
    sort_order = models.PositiveIntegerField(_("tartib"), default=0)
    is_primary = models.BooleanField(_("asosiy"), default=False)

    class Meta:
        verbose_name = _("mahsulot rasmi")
        verbose_name_plural = _("mahsulot rasmlari")
        ordering = ("sort_order", "created_at")
        constraints = [
            models.UniqueConstraint(
                fields=["product"],
                condition=Q(is_primary=True, is_deleted=False),
                name="uniq_primary_image_per_product",
            )
        ]

    def __str__(self) -> str:
        return f"{self.product.sku} rasm #{self.sort_order}"


class ProductPrice(BaseModel):
    """Narx tarixi (CLAUDE.md 6). Har narx o'zgarishida yangi yozuv."""

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="price_history",
        verbose_name=_("mahsulot"),
    )
    cost_price = models.DecimalField(_("tannarx"), **_MONEY)
    wholesale_price = models.DecimalField(_("optom narx"), **_MONEY)
    retail_price = models.DecimalField(_("chakana narx"), **_MONEY)
    min_price = models.DecimalField(_("minimal narx"), **_MONEY)
    effective_from = models.DateTimeField(_("amal qila boshlagan sana"))
    reason = models.CharField(_("sababi"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("narx tarixi")
        verbose_name_plural = _("narx tarixi")
        ordering = ("-effective_from",)

    def __str__(self) -> str:
        return f"{self.product.sku} @ {self.effective_from:%Y-%m-%d}"


class ProductAlias(BaseModel):
    """Naklit skanida uchraydigan nomlar (CLAUDE.md 6, 9 — OCR o'rganishi)."""

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="aliases",
        verbose_name=_("mahsulot"),
    )
    alias_text = models.CharField(_("nom"), max_length=255)
    supplier = models.ForeignKey(
        "warehouse.Supplier", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="product_aliases", verbose_name=_("yetkazib beruvchi"),
    )
    hit_count = models.PositiveIntegerField(_("ishlatilgan"), default=1)

    class Meta:
        verbose_name = _("mahsulot nomi (alias)")
        verbose_name_plural = _("mahsulot nomlari (alias)")
        ordering = ("-hit_count",)
        constraints = [
            models.UniqueConstraint(
                fields=["product", "alias_text", "supplier"],
                name="uniq_alias_product_text_supplier",
            )
        ]

    def __str__(self) -> str:
        return f"{self.alias_text} → {self.product.sku}"
