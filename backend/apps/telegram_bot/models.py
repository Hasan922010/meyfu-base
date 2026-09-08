"""Telegram bog'lash kodi va xabarlar jurnali (CLAUDE.md 15)."""
from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel

LINK_CODE_TTL = timedelta(minutes=10)


class TelegramLinkCode(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="telegram_link_codes", verbose_name=_("foydalanuvchi"),
    )
    code = models.CharField(_("kod"), max_length=8, unique=True, db_index=True)
    expires_at = models.DateTimeField(_("amal qilish muddati"))
    used_at = models.DateTimeField(_("ishlatilgan vaqti"), null=True, blank=True)

    class Meta:
        verbose_name = _("Telegram bog'lash kodi")
        verbose_name_plural = _("Telegram bog'lash kodlari")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.user_id}: {self.code}"

    @property
    def is_valid(self) -> bool:
        return self.used_at is None and timezone.now() < self.expires_at

    @classmethod
    def issue(cls, user) -> TelegramLinkCode:
        cls.objects.filter(user=user, used_at__isnull=True).update(
            expires_at=timezone.now()
        )
        code = f"{secrets.randbelow(900000) + 100000}"
        return cls.objects.create(
            user=user, code=code,
            expires_at=timezone.now() + LINK_CODE_TTL,
            created_by=user,
        )


class TelegramMessageLog(BaseModel):
    chat_id = models.CharField(_("chat ID"), max_length=64)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+",
    )
    direction = models.CharField(
        _("yo'nalish"), max_length=3,
        choices=[("in", "in"), ("out", "out")], default="out",
    )
    text = models.TextField(_("matn"), blank=True)
    ok = models.BooleanField(_("muvaffaqiyatli"), default=True)
    error = models.CharField(_("xato"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("Telegram xabar")
        verbose_name_plural = _("Telegram xabarlar")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.direction} {self.chat_id}"
