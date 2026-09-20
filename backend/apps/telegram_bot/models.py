"""Telegram bog'lash kodi va xabarlar jurnali (CLAUDE.md 15)."""
from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from cryptography.fernet import Fernet, InvalidToken

from apps.core.models import BaseModel

LINK_CODE_TTL = timedelta(minutes=10)


class TelegramBotCredential(BaseModel):
    """Bazadagi yagona, shifrlangan Telegram bot credential."""

    encrypted_token = models.TextField(_("shifrlangan token"))
    encrypted_webhook_secret = models.TextField(_("shifrlangan webhook siri"), blank=True)
    encryption_key_version = models.CharField(
        _("shifrlash kaliti versiyasi"), max_length=32, default="legacy",
    )
    bot_username = models.CharField(_("bot username"), max_length=64)

    class Meta:
        verbose_name = _("Telegram bot sozlamasi")
        verbose_name_plural = _("Telegram bot sozlamalari")

    @staticmethod
    def _cipher(secret: str) -> Fernet:
        digest = hashlib.sha256(secret.encode()).digest()
        return Fernet(base64.urlsafe_b64encode(digest))

    @classmethod
    def _keyring(cls) -> dict[str, str]:
        keys = dict(settings.TELEGRAM_CREDENTIAL_KEYS)
        keys.setdefault("legacy", settings.SECRET_KEY)
        return keys

    @classmethod
    def _current_key(cls) -> tuple[str, str]:
        version = settings.TELEGRAM_CREDENTIAL_KEY_VERSION
        try:
            return version, cls._keyring()[version]
        except KeyError as exc:
            raise ValueError(
                f"Telegram credential key version {version!r} is not configured"
            ) from exc

    @classmethod
    def _decrypt_value(cls, value: str, version: str) -> str:
        try:
            secret = cls._keyring()[version]
        except KeyError as exc:
            raise InvalidToken from exc
        return cls._cipher(secret).decrypt(value.encode()).decode()

    def _rotate_if_needed(self) -> None:
        current_version, current_secret = self._current_key()
        if self.encryption_key_version == current_version:
            return

        token = self._decrypt_value(
            self.encrypted_token, self.encryption_key_version
        )
        webhook_secret = (
            self._decrypt_value(
                self.encrypted_webhook_secret, self.encryption_key_version
            )
            if self.encrypted_webhook_secret
            else ""
        )
        cipher = self._cipher(current_secret)
        self.encrypted_token = cipher.encrypt(token.encode()).decode()
        self.encrypted_webhook_secret = (
            cipher.encrypt(webhook_secret.encode()).decode()
            if webhook_secret
            else ""
        )
        self.encryption_key_version = current_version
        if self.pk:
            self.save(
                update_fields=[
                    "encrypted_token",
                    "encrypted_webhook_secret",
                    "encryption_key_version",
                    "updated_at",
                ]
            )

    def set_token(self, token: str) -> None:
        version, secret = self._current_key()
        self.encrypted_token = self._cipher(secret).encrypt(token.encode()).decode()
        self.encryption_key_version = version

    def get_token(self) -> str:
        try:
            self._rotate_if_needed()
            return self._decrypt_value(
                self.encrypted_token, self.encryption_key_version
            )
        except (InvalidToken, ValueError):
            return ""

    def set_webhook_secret(self, secret: str) -> None:
        version, key = self._current_key()
        if self.encrypted_token and self.encryption_key_version != version:
            self._rotate_if_needed()
        self.encrypted_webhook_secret = self._cipher(key).encrypt(secret.encode()).decode()
        self.encryption_key_version = version

    def get_webhook_secret(self) -> str:
        if not self.encrypted_webhook_secret:
            return ""
        try:
            self._rotate_if_needed()
            return self._decrypt_value(
                self.encrypted_webhook_secret, self.encryption_key_version
            )
        except (InvalidToken, ValueError):
            return ""

    @classmethod
    def current(cls) -> TelegramBotCredential | None:
        return cls.objects.order_by("-updated_at").first()


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
