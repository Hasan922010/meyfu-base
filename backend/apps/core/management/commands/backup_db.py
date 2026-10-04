"""Ma'lumotlar bazasini zaxiralash (backup) boshqaruv komandasi.

Foydalanish:
    python manage.py backup_db
    python manage.py backup_db --format=json
    python manage.py backup_db --format=sql --note="Relizdan oldingi zaxira"
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.core.services.backup import create_backup


class Command(BaseCommand):
    help = "Ma'lumotlar bazasini zaxiralash (Backup creation)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--format",
            choices=["auto", "sql", "json", "sqlite"],
            default="auto",
            help="Zaxira formati: auto (default), sql, json, sqlite",
        )
        parser.add_argument(
            "--note",
            type=str,
            default="",
            help="Zaxira uchun qo'shimcha izoh",
        )
        parser.add_argument(
            "--safety",
            action="store_true",
            help="Himoya zaxirasi sifatida belgilash (avtomatik rotatsiyada o'chirilmaydi)",
        )

    def handle(self, *args, **options):
        format_type = options["format"]
        note = options["note"]
        is_safety = options["safety"]

        self.stdout.write(self.style.NOTICE(f"Zaxira yaratilmoqda (format: {format_type})..."))

        try:
            result = create_backup(
                format_type=format_type,
                note=note,
                is_safety=is_safety,
            )
            filename = result.get("filename")
            size_mb = result.get("size_mb")
            fmt = result.get("format")
            sha = result.get("checksum_sha256", "")[:12]

            self.stdout.write(
                self.style.SUCCESS(
                    f"[OK] Zaxira muvaffaqiyatli yaratildi!\n"
                    f"     Fayl:    {filename}\n"
                    f"     Hajmi:   {size_mb} MB\n"
                    f"     Format:  {fmt}\n"
                    f"     SHA-256: {sha}..."
                )
            )
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"[X] Xatolik: {exc}"))
            raise SystemExit(1) from exc
