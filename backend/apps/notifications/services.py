"""Bildirishnoma yaratish + real-time yuborish (CLAUDE.md 11)."""
from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from apps.users.constants import Role
from realtime.broadcast import broadcast

from .models import Notification

_ADMIN_ROLES = [Role.SUPER_ADMIN, Role.MANAGER]


def notify(
    user,
    *,
    type: str = "general",
    title: str,
    body: str = "",
    data: dict[str, Any] | None = None,
    tg_buttons: list | None = None,
) -> Notification:
    """DB'ga bildirishnoma yozadi, `notification.new` eventini va (bog'langan bo'lsa)
    Telegram xabarini yuboradi. Barchasi best-effort — DB yozuvi baribir saqlanadi.
    """
    notification = Notification.objects.create(
        user=user, type=type, title=title, body=body, data=data or {},
    )
    broadcast(
        f"user_{user.id}",
        "notification.new",
        {
            "id": str(notification.id),
            "type": type,
            "title": title,
            "body": body,
            "data": data or {},
            "created_at": notification.created_at.isoformat(),
        },
    )
    if getattr(user, "telegram_chat_id", ""):
        try:
            from apps.telegram_bot.services.send import tg_send

            text = f"<b>{title}</b>\n{body}" if body else f"<b>{title}</b>"
            tg_send(user, text, buttons=tg_buttons)
        except Exception:  # noqa: BLE001
            pass
    return notification


def notify_admins(
    *, type: str = "general", title: str, body: str = "",
    data: dict[str, Any] | None = None,
    tg_buttons: list | None = None,
) -> None:
    """Barcha faol SUPER_ADMIN/MANAGER larga bildirishnoma."""
    from django.db.models import Q

    User = get_user_model()
    admins = User.objects.filter(is_active=True).filter(
        Q(role__in=_ADMIN_ROLES) | Q(is_superuser=True)
    )
    for admin in admins:
        notify(admin, type=type, title=title, body=body, data=data,
               tg_buttons=tg_buttons)
