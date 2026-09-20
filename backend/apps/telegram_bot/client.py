"""Telegram Bot API mijozi (CLAUDE.md 15).

Token bo'lmasa — barcha yuborishlar no-op (dev/test). Xatolar jimgina log qilinadi
— Telegram hech qachon biznes oqimni buzmaydi.
"""
from __future__ import annotations

import logging
import re
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger("apps.telegram_bot")
# Telegram tokeni API URL ichida bo'ladi; httpx INFO logi URL'ni oshkor qilmasin.
logging.getLogger("httpx").setLevel(logging.WARNING)

_API = "https://api.telegram.org/bot{token}/{method}"
_TOKEN_RE = re.compile(r"^\d{6,12}:[A-Za-z0-9_-]{20,}$")
_METHODS = frozenset({
    "getMe", "sendMessage", "answerCallbackQuery", "editMessageReplyMarkup",
    "setWebhook", "deleteWebhook",
})


def get_token() -> str:
    from .models import TelegramBotCredential

    credential = TelegramBotCredential.current()
    if credential:
        token = credential.get_token()
        if token:
            return token
    return settings.TELEGRAM_BOT_TOKEN


def get_bot_username() -> str:
    from .models import TelegramBotCredential

    credential = TelegramBotCredential.current()
    return credential.bot_username if credential else settings.TELEGRAM_BOT_USERNAME


def get_webhook_secret() -> str:
    from .models import TelegramBotCredential

    credential = TelegramBotCredential.current()
    if credential:
        secret = credential.get_webhook_secret()
        if secret:
            return secret
    return settings.TELEGRAM_WEBHOOK_SECRET


def is_enabled() -> bool:
    return bool(get_token())


def _call(
    method: str,
    payload: dict[str, Any],
    *,
    token: str | None = None,
) -> dict[str, Any] | None:
    bot_token = token or get_token()
    if not bot_token or not _TOKEN_RE.fullmatch(bot_token) or method not in _METHODS:
        return None
    # The token and method have both passed strict Telegram-format and
    # allow-list validation above; the host is a fixed Telegram API origin.
    url = _API.format(token=bot_token, method=method)  # nosemgrep: python.django.net.tainted-django-http-request-httpx.tainted-django-http-request-httpx
    try:
        resp = httpx.post(  # nosemgrep
            url,  # nosemgrep: python.django.net.tainted-django-http-request-httpx.tainted-django-http-request-httpx
            json=payload, timeout=10.0
        )
        data = resp.json()
        if not data.get("ok"):
            logger.warning("Telegram %s xato: %s", method, data.get("description"))
            return None
        return data.get("result")
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Telegram %s so'rovi muvaffaqiyatsiz (%s)",
            method,
            type(exc).__name__,
        )
        return None


def get_me(token: str) -> dict[str, Any] | None:
    return _call("getMe", {}, token=token)


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


def set_webhook(
    url: str,
    *,
    token: str | None = None,
    secret_token: str | None = None,
) -> bool:
    payload: dict[str, Any] = {
        "url": url,
        "allowed_updates": ["message", "callback_query"],
    }
    # Telegram bu tokenni har so'rovda `X-Telegram-Bot-Api-Secret-Token` sarlavhasida
    # qaytaradi — sirni URL'dan tashqari yo'l bilan ham tekshirish mumkin (SEC-004).
    webhook_secret = secret_token or get_webhook_secret()
    if webhook_secret:
        payload["secret_token"] = webhook_secret
    return _call("setWebhook", payload, token=token) is not None


def delete_webhook(token: str) -> bool:
    return _call("deleteWebhook", {"drop_pending_updates": False}, token=token) is not None
