"""Telegram webhook manzilini o'rnatadi.

Foydalanish:
    python manage.py set_telegram_webhook https://api.example.com
"""
from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.telegram_bot.client import is_enabled, set_webhook


class Command(BaseCommand):
    help = "Telegram bot webhook manzilini o'rnatadi."

    def add_arguments(self, parser) -> None:
        parser.add_argument("base_url", help="Masalan: https://api.example.com")

    def handle(self, *args, **options) -> None:
        if not is_enabled():
            raise CommandError("TELEGRAM_BOT_TOKEN o'rnatilmagan.")
        base = options["base_url"].rstrip("/")
        url = f"{base}/api/v1/telegram/webhook/{settings.TELEGRAM_WEBHOOK_SECRET}/"
        if set_webhook(url):
            self.stdout.write(self.style.SUCCESS(f"Webhook o'rnatildi: {url}"))
        else:
            raise CommandError("Webhook o'rnatilmadi (loglarni tekshiring).")
