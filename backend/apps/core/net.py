"""Mijoz IP manzili — audit jurnali uchun (CLAUDE.md 5.3)."""
from __future__ import annotations

from rest_framework.throttling import BaseThrottle


def client_ip(request) -> str | None:
    """`REST_FRAMEWORK["NUM_PROXIES"]` ni hisobga olgan holda mijoz IP'si.

    nginx ortida `REMOTE_ADDR` doim proxy konteyneri bo'ladi; DRF throttle
    bilan bir xil manba ishlatiladi (audit SEC-104).
    """
    return BaseThrottle().get_ident(request) or None
