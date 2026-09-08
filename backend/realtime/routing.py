"""WebSocket marshrutlari (CLAUDE.md 11).

Eslatma: WebSocket uzilsa ham ilova ishlashi shart — real-time faqat qulaylik.
"""
from django.urls import path

from .consumers import EventConsumer

websocket_urlpatterns = [
    path("ws/events/", EventConsumer.as_asgi()),
]
