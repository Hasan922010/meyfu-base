"""Real-time broadcast — service layer (CLAUDE.md 11).

Eventlar signal'dan emas, service layer'dan yuboriladi.
MVP: funksiya mavjud, lekin hech qayerda majburiy chaqirilmaydi.
"""
from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger("apps.realtime")


ADMIN_GROUP = "admin_dashboard"


def admin_branch_group(branch_id) -> str:
    return f"{ADMIN_GROUP}_{branch_id}"


def broadcast_admin(branch_id, event: str, payload: dict[str, Any]) -> None:
    """Admin paneli eventi: markaz hammasini oladi, filial xodimi faqat o'z
    filialinikini (audit SEC-116). `branch_id` — None bo'lsa faqat markaz."""
    broadcast(ADMIN_GROUP, event, payload)
    if branch_id:
        broadcast(admin_branch_group(branch_id), event, payload)


def broadcast(group: str, event: str, payload: dict[str, Any]) -> None:
    """Guruhga event yuborish. Xato bo'lsa — jimgina log (ilova to'xtamasin)."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            group,
            {"type": "broadcast.message", "event": event, "payload": payload},
        )
    except Exception:  # noqa: BLE001 — real-time hech qachon oqimni buzmasin
        logger.warning("broadcast muvaffaqiyatsiz: %s/%s", group, event, exc_info=True)
