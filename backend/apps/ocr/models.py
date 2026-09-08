"""Naklit skanerlash modellari (CLAUDE.md 6 — Naklit skanerlash [F2], §9)."""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.catalog.models import Product
from apps.core.models import BaseModel
from apps.warehouse.models import Purchase, Supplier, Warehouse

from .constants import MatchStatus, OcrProvider, ScanStatus, ScanType

_ZERO = Decimal("0")
_MONEY = {"max_digits": 14, "decimal_places": 2}
_QTY = {"max_digits": 14, "decimal_places": 3}


class InvoiceScan(BaseModel):
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="invoice_scans", verbose_name=_("kim yukladi"),
    )
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name="invoice_scans",
        verbose_name=_("ombor"),
    )
    supplier = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="invoice_scans", verbose_name=_("yetkazib beruvchi"),
    )
    scan_type = models.CharField(
        _("turi"), max_length=10, choices=ScanType.choices,
        default=ScanType.INVOICE,
    )
    status = models.CharField(
        _("holat"), max_length=14, choices=ScanStatus.choices,
        default=ScanStatus.UPLOADED, db_index=True,
    )

    detected_invoice_number = models.CharField(
        _("aniqlangan raqam"), max_length=64, blank=True
    )
    detected_date = models.DateField(_("aniqlangan sana"), null=True, blank=True)
    detected_total = models.DecimalField(
        _("aniqlangan jami"), **_MONEY, null=True, blank=True
    )
    detected_supplier_name = models.CharField(
        _("aniqlangan yetkazuvchi"), max_length=255, blank=True
    )

    raw_text = models.TextField(_("xom matn"), blank=True)
    ai_response = models.JSONField(_("AI javobi"), default=dict, blank=True)
    confidence = models.DecimalField(
        _("ishonch"), max_digits=4, decimal_places=3, default=_ZERO
    )
    provider = models.CharField(
        _("provayder"), max_length=12, choices=OcrProvider.choices, blank=True
    )
    image_hash = models.CharField(
        _("rasm hashi"), max_length=64, blank=True, db_index=True
    )

    tokens_used = models.PositiveIntegerField(_("tokenlar"), default=0)
    cost_usd = models.DecimalField(
        _("xarajat (USD)"), max_digits=8, decimal_places=5, default=_ZERO
    )
    processing_time_ms = models.PositiveIntegerField(_("vaqt (ms)"), default=0)
    error_message = models.CharField(_("xato"), max_length=500, blank=True)

    purchase = models.OneToOneField(
        Purchase, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="invoice_scan", verbose_name=_("qabul"),
    )
    confirmed_at = models.DateTimeField(_("tasdiqlangan vaqti"), null=True, blank=True)

    class Meta:
        verbose_name = _("naklit skani")
        verbose_name_plural = _("naklit skanlari")
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self) -> str:
        return f"Skan {self.detected_invoice_number or self.pk} ({self.status})"

    @property
    def line_count(self) -> int:
        return self.lines.count()


class InvoiceScanPage(BaseModel):
    scan = models.ForeignKey(
        InvoiceScan, on_delete=models.CASCADE, related_name="pages",
        verbose_name=_("skan"),
    )
    image = models.ImageField(_("rasm"), upload_to="invoice_scans/")
    processed_image = models.ImageField(
        _("qayta ishlangan rasm"), upload_to="invoice_scans/processed/",
        null=True, blank=True,
    )
    page_number = models.PositiveIntegerField(_("varaq raqami"), default=1)

    class Meta:
        verbose_name = _("skan varag'i")
        verbose_name_plural = _("skan varaqlari")
        ordering = ("page_number",)

    def __str__(self) -> str:
        return f"{self.scan_id} · varaq {self.page_number}"


class InvoiceScanLine(BaseModel):
    scan = models.ForeignKey(
        InvoiceScan, on_delete=models.CASCADE, related_name="lines",
        verbose_name=_("skan"),
    )
    line_number = models.PositiveIntegerField(_("qator raqami"), default=1)

    raw_name = models.CharField(_("nomi (xom)"), max_length=500, blank=True)
    raw_quantity = models.CharField(_("miqdor (xom)"), max_length=64, blank=True)
    raw_unit = models.CharField(_("birlik (xom)"), max_length=64, blank=True)
    raw_price = models.CharField(_("narx (xom)"), max_length=64, blank=True)
    raw_amount = models.CharField(_("summa (xom)"), max_length=64, blank=True)

    matched_product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name=_("topilgan mahsulot"),
    )
    match_confidence = models.PositiveIntegerField(_("moslik %"), default=0)
    match_status = models.CharField(
        _("moslik holati"), max_length=10, choices=MatchStatus.choices,
        default=MatchStatus.UNMATCHED,
    )

    final_product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+", verbose_name=_("yakuniy mahsulot"),
    )
    final_quantity = models.DecimalField(
        _("yakuniy miqdor"), **_QTY, null=True, blank=True
    )
    final_price = models.DecimalField(
        _("yakuniy narx"), **_MONEY, null=True, blank=True
    )
    low_confidence = models.BooleanField(_("past ishonch"), default=False)
    was_corrected = models.BooleanField(_("tuzatilgan"), default=False)
    is_confirmed = models.BooleanField(_("tasdiqlangan"), default=False)

    class Meta:
        verbose_name = _("skan qatori")
        verbose_name_plural = _("skan qatorlari")
        ordering = ("line_number",)

    def __str__(self) -> str:
        return f"{self.line_number}. {self.raw_name}"
