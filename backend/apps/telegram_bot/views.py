from __future__ import annotations

import hmac
import logging
import re
import secrets

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsSuperAdmin
from apps.core.response import ok

from .client import (
    delete_webhook,
    get_bot_username,
    get_me,
    get_webhook_secret,
    is_enabled,
    set_webhook,
)
from .models import TelegramBotCredential, TelegramLinkCode
from .services.webhook import handle_update

logger = logging.getLogger("apps.telegram_bot")


def _ct_equal(candidate: str, expected: str) -> bool:
    try:
        return hmac.compare_digest(candidate, expected)
    except TypeError:  # ASCII bo'lmagan str — mos emas
        return False


def _secret_ok(request: Request, path_secret: str = "") -> bool:
    """Faqat `X-Telegram-Bot-Api-Secret-Token` sarlavhasi mos kelsa.

    `hmac.compare_digest` — constant-time (audit SEC-004/SEC-006). Kalit sozlanmagan
    bo'lsa (bo'sh) — hech kim o'ta olmaydi.
    """
    expected = get_webhook_secret() or ""
    if not expected:
        return False
    header_secret = request.META.get("HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN", "")
    # Legacy URL secrets are accepted only as an additional check. This keeps
    # the URL route backwards-compatible without allowing secrets in URLs to
    # replace Telegram's header (which is not exposed in proxy logs/history).
    if path_secret and not header_secret:
        # URL-secret routes are legacy aliases; never authenticate from a URL
        # alone because URLs can be logged by proxies and clients.
        return False
    return _ct_equal(header_secret, expected)


class TelegramWebhookView(APIView):
    """Telegram update'larni qabul qiladi. Yo'l ichidagi maxfiy kalit va/yoki
    `X-Telegram-Bot-Api-Secret-Token` sarlavhasi bilan himoyalangan."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def post(self, request: Request, secret: str = "") -> Response:
        if not _secret_ok(request, secret):
            return Response(status=403)
        try:
            handle_update(request.data)
        except Exception:  # noqa: BLE001
            logger.exception("Telegram webhook update processing failed")
            return Response({"ok": False}, status=503)
        return Response({"ok": True})


class TelegramLinkView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Telegram bog'lash kodini olish", request=None,
                   responses={200: dict})
    def post(self, request: Request) -> Response:
        link = TelegramLinkCode.issue(request.user)
        username = get_bot_username()
        return ok({
            "code": link.code,
            "expires_at": link.expires_at.isoformat(),
            "deep_link": f"https://t.me/{username}?start={link.code}",
            "bot_username": username,
            "enabled": is_enabled(),
        })


class TelegramStatusView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Telegram bog'lanish holati", request=None,
                   responses={200: dict})
    def get(self, request: Request) -> Response:
        return ok({
            "linked": bool(request.user.telegram_chat_id),
            "enabled": is_enabled(),
            "bot_username": get_bot_username(),
        })


class TelegramBotConfigView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    _TOKEN_RE = re.compile(r"^\d{6,12}:[A-Za-z0-9_-]{20,}$")

    @extend_schema(summary="Telegram bot sozlamasi", request=None, responses={200: dict})
    def get(self, request: Request) -> Response:
        credential = TelegramBotCredential.current()
        return ok({
            "configured": is_enabled(),
            "bot_username": get_bot_username() if is_enabled() else "",
            "managed_in_profile": credential is not None,
            "updated_at": credential.updated_at.isoformat() if credential else None,
        })

    @extend_schema(summary="Telegram bot tokenini ulash", responses={200: dict})
    def post(self, request: Request) -> Response:
        token = str(request.data.get("token", "")).strip()
        if not self._TOKEN_RE.fullmatch(token):
            return Response(
                {"success": False, "error": {
                    "code": "INVALID_TOKEN_FORMAT",
                    "message": "Telegram bot token formati noto'g'ri.",
                }},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bot = get_me(token)
        username = str((bot or {}).get("username", "")).strip()
        if not username:
            return Response(
                {"success": False, "error": {
                    "code": "INVALID_TELEGRAM_TOKEN",
                    "message": "Telegram tokenni tasdiqlamadi.",
                }},
                status=status.HTTP_400_BAD_REQUEST,
            )

        credential = TelegramBotCredential.current()
        webhook_secret = (
            credential.get_webhook_secret() if credential else ""
        ) or secrets.token_urlsafe(32)
        base_url = request.build_absolute_uri("/").rstrip("/")
        webhook_url = f"{base_url}/api/v1/telegram/webhook/"
        if not set_webhook(
            webhook_url,
            token=token,
            secret_token=webhook_secret,
        ):
            return Response(
                {"success": False, "error": {
                    "code": "WEBHOOK_SETUP_FAILED",
                    "message": "Telegram webhookini o'rnatib bo'lmadi.",
                }},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_token = credential.get_token() if credential else ""
        try:
            with transaction.atomic():
                credential = credential or TelegramBotCredential(created_by=request.user)
                credential.set_token(token)
                credential.set_webhook_secret(webhook_secret)
                credential.bot_username = username
                credential.save()
                if old_token and old_token != token and not delete_webhook(old_token):
                    raise RuntimeError("old webhook could not be disabled")
        except Exception:  # noqa: BLE001
            delete_webhook(token)
            if old_token and old_token != token:
                set_webhook(
                    webhook_url,
                    token=old_token,
                    secret_token=webhook_secret,
                )
            return Response(
                {"success": False, "error": {
                    "code": "BOT_ROTATION_FAILED",
                    "message": "Bot tokenini xavfsiz almashtirib bo'lmadi.",
                }},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return ok({
            "configured": True,
            "bot_username": username,
            "managed_in_profile": True,
            "updated_at": credential.updated_at.isoformat(),
        })

    put = post


class TelegramUnlinkView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Telegram akkauntdan uzish", request=None,
                   responses={200: dict})
    def post(self, request: Request) -> Response:
        request.user.telegram_chat_id = ""
        request.user.save(update_fields=["telegram_chat_id", "updated_at"])
        return ok({"linked": False})
