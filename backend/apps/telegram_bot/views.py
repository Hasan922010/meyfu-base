from __future__ import annotations

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


class TelegramWebhookView(APIView):
    """Telegram update'larni qabul qiladi. Yo'l ichida maxfiy kalit bilan himoyalangan."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def post(self, request: Request, secret: str) -> Response:
        if secret != settings.TELEGRAM_WEBHOOK_SECRET:
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
