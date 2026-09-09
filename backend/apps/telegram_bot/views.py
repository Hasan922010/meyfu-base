from __future__ import annotations

import hmac

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.response import ok

from .client import is_enabled
from .models import TelegramLinkCode
from .services.webhook import handle_update


def _ct_equal(candidate: str, expected: str) -> bool:
    try:
        return hmac.compare_digest(candidate, expected)
    except TypeError:  # ASCII bo'lmagan str — mos emas
        return False


def _secret_ok(request: Request, path_secret: str) -> bool:
    """Yo'ldagi kalit YOKI `X-Telegram-Bot-Api-Secret-Token` sarlavhasi mos kelsa.

    `hmac.compare_digest` — constant-time (audit SEC-004/SEC-006). Kalit sozlanmagan
    bo'lsa (bo'sh) — hech kim o'ta olmaydi.
    """
    expected = settings.TELEGRAM_WEBHOOK_SECRET or ""
    if not expected:
        return False
    header_secret = request.META.get("HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN", "")
    return _ct_equal(path_secret, expected) or _ct_equal(header_secret, expected)


class TelegramWebhookView(APIView):
    """Telegram update'larni qabul qiladi. Yo'l ichidagi maxfiy kalit va/yoki
    `X-Telegram-Bot-Api-Secret-Token` sarlavhasi bilan himoyalangan."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def post(self, request: Request, secret: str) -> Response:
        if not _secret_ok(request, secret):
            return Response(status=403)
        try:
            handle_update(request.data)
        except Exception:  # noqa: BLE001
            pass
        return Response({"ok": True})


class TelegramLinkView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Telegram bog'lash kodini olish", request=None,
                   responses={200: dict})
    def post(self, request: Request) -> Response:
        link = TelegramLinkCode.issue(request.user)
        username = settings.TELEGRAM_BOT_USERNAME
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
            "bot_username": settings.TELEGRAM_BOT_USERNAME,
        })


class TelegramUnlinkView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Telegram akkauntdan uzish", request=None,
                   responses={200: dict})
    def post(self, request: Request) -> Response:
        request.user.telegram_chat_id = ""
        request.user.save(update_fields=["telegram_chat_id", "updated_at"])
        return ok({"linked": False})
