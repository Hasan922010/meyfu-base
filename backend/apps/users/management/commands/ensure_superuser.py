"""Env asosida SUPER_ADMIN yaratish (docker entrypoint uchun)."""
from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Env asosida superuser yaratadi (mavjud bo'lmasa)."

    def handle(self, *args, **options) -> None:
        phone = os.environ.get("DJANGO_SUPERUSER_PHONE", "+998900000000")
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "admin12345")
        full_name = os.environ.get("DJANGO_SUPERUSER_NAME", "Bosh admin")

        normalized = User.normalize_phone(phone)
        if User.objects.filter(phone=normalized).exists():
            self.stdout.write(f"Superuser allaqachon mavjud: {normalized}")
            return

        User.objects.create_superuser(
            phone=normalized, password=password, full_name=full_name
        )
        self.stdout.write(self.style.SUCCESS(f"Superuser yaratildi: {normalized}"))
