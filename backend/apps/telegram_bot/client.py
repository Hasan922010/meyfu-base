"""Telegram Bot API mijozi (CLAUDE.md 15).

Token bo'lmasa — barcha yuborishlar no-op (dev/test). Xatolar jimgina log qilinadi
— Telegram hech qachon biznes oqimni buzmaydi.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger("apps.telegram_bot")

_API = "https://api.telegram.org/bot{token}/{method}"


def is_enabled() -> bool:
    return bool(settings.TELEGRAM_BOT_TOKEN)


def _call(method: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    if not is_enabled():
        return None
    url = _API.format(token=settings.TELEGRAM_BOT_TOKEN, method=method)
    try:
        resp = httpx.post(url, json=payload, timeout=10.0)
        data = resp.json()
        if not data.get("ok"):
            logger.warning("Telegram %s xato: %s", method, data.get("description"))
            return None
        return data.get("result")
    except Exception:  # noqa: BLE001
        logger.warning("Telegram %s so'rovi muvaffaqiyatsiz", method, exc_info=True)
        return None


def send_message(
    chat_id: str | int,
    text: str,
    *,
    buttons: list[list[dict[str, str]]] | None = None,
) -> bool:
    """`buttons`: [[{"text": "...", "callback_data": "..."}]]"""
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if buttons:
        payload["reply_markup"] = {"inline_keyboard": buttons}
    return _call("sendMessage", payload) is not None


def answer_callback_query(callback_query_id: str, text: str = "") -> None:
    _call("answerCallbackQuery", {"callback_query_id": callback_query_id, "text": text})


def edit_message_reply_markup(chat_id: str | int, message_id: int) -> None:
    _call("editMessageReplyMarkup", {"chat_id": chat_id, "message_id": message_id,
                                     "reply_markup": {"inline_keyboard": []}})


def set_webhook(url: str) -> bool:
    return _call("setWebhook", {"url": url,
                                "allowed_updates": ["message", "callback_query"]}) \
        is not None
