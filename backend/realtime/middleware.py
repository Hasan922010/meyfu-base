"""WebSocket authentication (CLAUDE.md 11).

New clients use a short-lived one-time ``?ticket=...`` issued over authenticated
HTTPS. The legacy ``?token=...`` access-token contract is retained only as a
bounded compatibility fallback while older clients migrate. Neither credential
must be included in request/access logs.
"""
from __future__ import annotations

import hashlib
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import transaction
from django.conf import settings
from django.utils import timezone


@database_sync_to_async
def _get_user(token: str):
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import AccessToken

    User = get_user_model()
    try:
        access = AccessToken(token)
        if access.get("token_type") != "access":
            return AnonymousUser()
        return User.objects.filter(pk=access["user_id"], is_active=True).first() \
            or AnonymousUser()
    except (TokenError, KeyError, TypeError, ValueError, AttributeError):
        return AnonymousUser()


@database_sync_to_async
def _consume_ticket(raw_ticket: str):
    from apps.users.models import WebSocketTicket

    token_hash = hashlib.sha256(raw_ticket.encode()).hexdigest()
    with transaction.atomic():
        ticket = (
            WebSocketTicket.objects.select_for_update()
            .select_related("user")
            .filter(token_hash=token_hash)
            .first()
        )
        if not ticket or not ticket.is_usable:
            return AnonymousUser()
        ticket.used_at = timezone.now()
        ticket.save(update_fields=["used_at"])
        return ticket.user if ticket.user.is_active else AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode(errors="ignore"))
        ticket = (query.get("ticket") or [None])[0]
        token = (query.get("token") or [None])[0]
        # Prefer the one-time ticket. Legacy JWT fallback is only considered
        # when no ticket is supplied, preventing downgrade via a bad ticket.
        if ticket:
            scope["user"] = await _consume_ticket(ticket)
        elif token and settings.WS_LEGACY_QUERY_TOKEN_ENABLED:
            scope["user"] = await _get_user(token) if token else AnonymousUser()
        else:
            scope["user"] = AnonymousUser()
        return await super().__call__(scope, receive, send)
