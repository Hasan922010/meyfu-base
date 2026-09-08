"""Bildirishnoma modeli (CLAUDE.md 6 — Tizim [MVP])."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel


class NotificationType(models.TextChoices):
    SALE_FLAGGED = "sale.flagged", _("Belgilangan sotuv")
    EXPENSE_LIMIT = "expense.limit_exceeded", _("Xarajat limiti oshdi")
    EXPENSE_APPROVED = "expense.approved", _("Xarajat tasdiqlandi")
    EXPENSE_REJECTED = "expense.rejected", _("Xarajat rad etildi")
    CASH_DIFFERENCE = "cash.difference", _("Kassa farqi")
    STOCK_LOW = "stock.low", _("Kam qoldiq")
    LOADING_CONFIRMED = "loading.confirmed", _("Yuklama tasdiqlandi")
    DAYCLOSE_SUBMITTED = "dayclose.submitted", _("Kun yopish yuborildi")
    DEBT_OVERDUE = "debt.overdue", _("Qarz muddati o'tdi")
    SYNC_CONFLICT = "sync.conflict", _("Sinxronizatsiya ziddiyati")
    GENERAL = "general", _("Umumiy")


class Notification(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="notifications", verbose_name=_("foydalanuvchi"),
    )
    type = models.CharField(
        _("turi"), max_length=32, choices=NotificationType.choices,
        default=NotificationType.GENERAL, db_index=True,
    )
    title = models.CharField(_("sarlavha"), max_length=255)
    body = models.CharField(_("matn"), max_length=1000, blank=True)
    data = models.JSONField(_("qo'shimcha ma'lumot"), default=dict, blank=True)
    is_read = models.BooleanField(_("o'qilgan"), default=False, db_index=True)
    read_at = models.DateTimeField(_("o'qilgan vaqti"), null=True, blank=True)

    class Meta:
        verbose_name = _("bildirishnoma")
        verbose_name_plural = _("bildirishnomalar")
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["user", "is_read", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.user_id}: {self.title}"
