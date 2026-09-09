"""Env asosida SUPER_ADMIN yaratish (docker entrypoint uchun).

Xavfsizlik (audit SEC-002): standart parol YO'Q.
  - `DJANGO_SUPERUSER_PHONE` va `DJANGO_SUPERUSER_PASSWORD` ikkalasi ham bo'sh →
    hech narsa qilinmaydi (entrypoint har bo'shatishda chaqiradi — idempotent).
  - Faqat bittasi berilgan → xato (noto'g'ri sozlama).
  - Parol Django validatorlaridan o'tishi shart.
"""
from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = "Env asosida superuser yaratadi (mavjud bo'lmasa). Standart parol yo'q."

    def handle(self, *args, **options) -> None:
        phone = os.environ.get("DJANGO_SUPERUSER_PHONE", "").strip()
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
        full_name = os.environ.get("DJANGO_SUPERUSER_NAME", "Bosh admin").strip()

        if not phone and not password:
            self.stdout.write(
                "DJANGO_SUPERUSER_PHONE/PASSWORD berilmagan — superuser yaratish "
                "o'tkazib yuborildi."
            )
            return
        if not phone or not password:
            raise CommandError(
                "DJANGO_SUPERUSER_PHONE va DJANGO_SUPERUSER_PASSWORD ikkalasi ham "
                "berilishi kerak (yoki ikkalasi ham bo'sh bo'lsin)."
            )

        normalized = User.normalize_phone(phone)
        if User.objects.filter(phone=normalized).exists():
            self.stdout.write(f"Superuser allaqachon mavjud: {normalized}")
            return

        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError(
                "DJANGO_SUPERUSER_PASSWORD yetarlicha kuchli emas: "
                + "; ".join(exc.messages)
            ) from exc

        User.objects.create_superuser(
            phone=normalized, password=password, full_name=full_name or "Bosh admin"
        )
        self.stdout.write(self.style.SUCCESS(f"Superuser yaratildi: {normalized}"))
