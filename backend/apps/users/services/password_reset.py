"""Parolni Telegram kodi orqali tiklash.

Oqim: telefon → Telegram'ga 6 xonali kod → kod + yangi parol.
Javoblar hisob bor-yo'qligini oshkor qilmaydi; kodning o'zi hech qayerda
(baza, Telegram jurnali) ochiq saqlanmaydi.
"""
from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

from apps.core.models import AuditLog
from apps.telegram_bot.client import send_message
from apps.telegram_bot.models import TelegramMessageLog
from apps.users.models import PasswordResetCode

CODE_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
_HMAC_SALT = "apps.users.password_reset"

User = get_user_model()


def _hash(user_id, code: str) -> str:
    return salted_hmac(_HMAC_SALT, f"{user_id}:{code}", algorithm="sha256").hexdigest()


def _find_user(phone: str):
    return (
        User.objects.filter(
            phone=User.normalize_phone(phone), is_active=True, is_deleted=False
        )
        .exclude(telegram_chat_id="")
        .first()
    )


def request_code(phone: str) -> None:
    """Telegram'ga bog'langan faol xodimga kod yuboradi, aks holda jim."""
    user = _find_user(phone)
    if user is None:
        return
    now = timezone.now()
    open_codes = user.password_reset_codes.filter(used_at__isnull=True, expires_at__gt=now)
    if open_codes.filter(created_at__gt=now - RESEND_COOLDOWN).exists():
        return

    code = f"{secrets.randbelow(10**6):06d}"
    open_codes.update(expires_at=now)  # eski kodlar endi yaroqsiz
    reset = PasswordResetCode.objects.create(
        user=user, code_hash=_hash(user.pk, code), expires_at=now + CODE_TTL
    )
    minutes = int(CODE_TTL.total_seconds() // 60)
    delivered = send_message(
        user.telegram_chat_id,
        f"Parolni tiklash kodi: <b>{code}</b>\n"
        f"Kod {minutes} daqiqa amal qiladi. Siz so'ramagan bo'lsangiz, "
        f"bu xabarni e'tiborsiz qoldiring.",
    )
    TelegramMessageLog.objects.create(
        chat_id=str(user.telegram_chat_id), user=user, direction="out",
        text="Parolni tiklash kodi yuborildi (kod yashirilgan)", ok=delivered,
    )
    if not delivered:
        # Yetib bormagan kod kutish vaqtini band qilmasin — darhol qayta so'rash mumkin
        PasswordResetCode.objects.filter(pk=reset.pk).update(expires_at=now)


def confirm_code(
    phone: str, code: str, new_password: str, *, ip: str | None, user_agent: str
) -> bool:
    """Kod to'g'ri bo'lsa parolni almashtiradi va barcha sessiyalarni yopadi."""
    user = _find_user(phone)
    if user is None:
        return False
    with transaction.atomic():
        reset = (
            user.password_reset_codes.select_for_update()
            .filter(used_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if reset is None or not reset.is_usable:
            return False
        if not constant_time_compare(_hash(user.pk, code), reset.code_hash):
            reset.attempts += 1
            reset.save(update_fields=["attempts"])
            return False

        reset.used_at = timezone.now()
        reset.save(update_fields=["used_at"])
        user.set_password(new_password)
        user.save(update_fields=["password", "updated_at"])
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
        AuditLog.objects.create(
            user=user,
            action="user.password_reset",
            model_name="users.User",
            object_id=str(user.pk),
            changes={"via": "telegram_code"},
            ip=ip,
            user_agent=user_agent[:255],
        )
    return True
