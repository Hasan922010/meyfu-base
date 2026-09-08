from django.urls import path

from .views import (
    TelegramLinkView,
    TelegramStatusView,
    TelegramUnlinkView,
    TelegramWebhookView,
)

urlpatterns = [
    path("telegram/webhook/<str:secret>/", TelegramWebhookView.as_view(),
         name="telegram-webhook"),
    path("telegram/link/", TelegramLinkView.as_view(), name="telegram-link"),
    path("telegram/status/", TelegramStatusView.as_view(), name="telegram-status"),
    path("telegram/unlink/", TelegramUnlinkView.as_view(), name="telegram-unlink"),
]
