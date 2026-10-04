"""Zaxiradan ma'lumotlar bazasini tiklash (Restore) boshqaruv komandasi.

Foydalanish:
    python manage.py restore_db db_20261004_120000.sql.gz
    python manage.py restore_db --latest
    python manage.py restore_db --latest --noinput
"""
from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from apps.core.services.backup import list_backups, restore_backup


class Command(BaseCommand):
    help = "Zaxira nusxasidan ma'lumotlarni tiklash (Restore from backup)"

    def add_arguments(self, parser):
        parser.add_argument(
            "filename",
            nargs="?",
            type=str,
            default=None,
            help="Tiklanadigan zaxira fayli nomi",
        )
        parser.add_argument(
            "--latest",
            action="store_true",
            help="Eng oxirgi mavjud zaxiradan tiklash",
        )
        parser.add_argument(
            "--noinput",
            "--no-input",
            action="store_true",
            help="Foydalanuvchi tasdig'ini so'ramasdan bajarish",
        )
        parser.add_argument(
            "--no-safety",
            action="store_true",
            help="Tiklashdan oldingi avtomatik himoya nusxasini yaratmaslik (tavsiya etilmaydi)",
        )

    def handle(self, *args, **options):
        filename = options["filename"]
        use_latest = options["latest"]
        noinput = options["noinput"]
        no_safety = options["no_safety"]

        if use_latest:
            backups = list_backups()
            if not backups:
                raise CommandError("Zaxiralar topilmadi")
            filename = backups[0]["filename"]

        if not filename:
            raise CommandError("Tiklanadigan fayl nomini ko'rsating yoki --latest parametrini bering")

        if not noinput:
            self.stdout.write(
                self.style.WARNING(
                    f"[!] DIQQAT: Bazadagi ma'lumotlar '{filename}' zaxirasi bilan almashtiriladi!\n"
                    f"    Tiklashdan oldin avtomatik himoya nusxasi yaratiladi."
                )
            )
            confirm = input("Davom etishni tasdiqlaysizmi? (ha/yo'q): ").strip().lower()
            if confirm not in ("ha", "yes", "y"):
                self.stdout.write(self.style.NOTICE("Tiklash bekor qilindi."))
                return

        self.stdout.write(self.style.NOTICE(f"'{filename}' faylidan tiklanmoqda..."))

        try:
            result = restore_backup(
                filename,
                create_safety=not no_safety,
            )
            safety = result.get("safety_backup")
            integrity = result.get("integrity", {})

            self.stdout.write(
                self.style.SUCCESS(
                    f"[OK] Baza muvaffaqiyatli tiklandi!\n"
                    f"     Tiklangan fayl: {filename}\n"
                    f"     Himoya nusxasi: {safety or 'yaratilmadi'}\n"
                    f"     Butunlik:       {'Mos (OK)' if integrity.get('ok') else 'Farqlar bor'}"
                )
            )
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"[X] Tiklashda xatolik: {exc}"))
            raise SystemExit(1) from exc
