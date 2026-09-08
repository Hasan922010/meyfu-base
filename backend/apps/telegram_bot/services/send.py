"""Telegram xabar yuborish — yuqori daraja (CLAUDE.md 15)."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q

from apps.users.constants import Role

from ..client import send_message
from ..models import TelegramMessageLog

_ADMIN_ROLES = [Role.SUPER_ADMIN, Role.MANAGER]


def tg_send(user, text: str, *, buttons=None) -> bool:
    """Faqat Telegram'ga bog'langan foydalanuvchiga yuboradi."""
    chat_id = getattr(user, "telegram_chat_id", "")
    if not chat_id:
        return False
    ok = send_message(chat_id, text, buttons=buttons)
    TelegramMessageLog.objects.create(
        chat_id=str(chat_id), user=user, direction="out", text=text, ok=ok,
    )
    return ok


def tg_send_chat(chat_id: str | int, text: str, *, buttons=None) -> bool:
    ok = send_message(chat_id, text, buttons=buttons)
    TelegramMessageLog.objects.create(
        chat_id=str(chat_id), direction="out", text=text, ok=ok,
    )
    return ok


def tg_send_admins(text: str, *, buttons=None) -> int:
    User = get_user_model()
    admins = User.objects.filter(is_active=True).exclude(
        telegram_chat_id=""
    ).filter(Q(role__in=_ADMIN_ROLES) | Q(is_superuser=True))
    sent = 0
    for admin in admins:
        if tg_send(admin, text, buttons=buttons):
            sent += 1
    return sent
