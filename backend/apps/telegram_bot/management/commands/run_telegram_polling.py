"""Telegram botni long-polling rejimida ishga tushiradi (lokal ishlab chiqish uchun).

Webhook faqat public HTTPS manzil bo'lganda ishlaydi. Lokal muhitda buning
o'rniga shu buyruqni ishga tushiring:

    python manage.py run_telegram_polling

Buyruq getUpdates orqali update'larni oladi va webhook bilan bir xil
`handle_update` funksiyasiga uzatadi. Webhook o'rnatilgan bo'lsa — avtomatik
o'chiradi (Telegram bir vaqtda ikkalasiga ruxsat bermaydi).
"""
from __future__ import annotations

import time

import httpx
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.telegram_bot.client import is_enabled
from apps.telegram_bot.services.webhook import handle_update

_API = "https://api.telegram.org/bot{token}/{method}"


class Command(BaseCommand):
    help = "Telegram botni long-polling rejimida ishga tushiradi (lokal dev)."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--timeout", type=int, default=30,
            help="getUpdates long-poll timeout (soniya).",
        )

    def handle(self, *args, **options) -> None:
        if not is_enabled():
            raise CommandError("TELEGRAM_BOT_TOKEN o'rnatilmagan (.env ni tekshiring).")

        token = settings.TELEGRAM_BOT_TOKEN
        timeout = options["timeout"]

        self._call(token, "deleteWebhook", {"drop_pending_updates": False})
        me = self._call(token, "getMe", {})
        if not me:
            raise CommandError("getMe muvaffaqiyatsiz — token noto'g'ri yoki internet yo'q.")
        self.stdout.write(self.style.SUCCESS(
            f"@{me['username']} polling rejimida ishga tushdi. To'xtatish: Ctrl+C"
        ))

        offset = 0
        while True:
            try:
                result = self._call(token, "getUpdates", {
                    "offset": offset,
                    "timeout": timeout,
                    "allowed_updates": ["message", "callback_query"],
                }, http_timeout=timeout + 10)
            except KeyboardInterrupt:
                self.stdout.write("\nTo'xtatildi.")
                return
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(f"getUpdates xato: {exc}. 5s dan keyin qayta urinish.")
                time.sleep(5)
                continue

            for update in result or []:
                offset = update["update_id"] + 1
                self.stdout.write(f"  update {update['update_id']}")
                handle_update(update)

    def _call(self, token: str, method: str, payload: dict, *, http_timeout: float = 15.0):
        url = _API.format(token=token, method=method)
        resp = httpx.post(url, json=payload, timeout=http_timeout)
        data = resp.json()
        if not data.get("ok"):
            self.stderr.write(f"Telegram {method}: {data.get('description')}")
            return None
        return data.get("result")
