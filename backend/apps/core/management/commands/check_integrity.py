"""Butunlik tekshiruvi — qo'lda ishga tushirish (CLAUDE.md 5.2, 15).

    python manage.py check_integrity                # faqat hisobot
    python manage.py check_integrity --fix-dry-run  # nima tuzatilishini ko'rsatadi
    python manage.py check_integrity --fix          # denormalized qiymatlarni moslaydi

Farq topilsa exit code 1 (cron/monitoring uchun).
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.core.services.integrity import apply_integrity_fix, run_integrity_check


class Command(BaseCommand):
    help = "Balans = jurnal yig'indisi ekanini tekshiradi (CLAUDE.md 5.2)."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--fix-dry-run", action="store_true",
            help="Har bir farq uchun tuzatish rejasini ko'rsatadi (o'zgartirmaydi).",
        )
        parser.add_argument(
            "--fix", action="store_true",
            help="Denormalized qiymatni jurnal yig'indisiga moslaydi.",
        )

    def handle(self, *args, **opts) -> None:
        result = run_integrity_check()
        counts = result["counts"]
        self.stdout.write(
            f"Tekshirildi: {counts['wallets']} hamyon, {counts['stocks']} ombor "
            f"qoldig'i, {counts['van_stocks']} mashina qoldig'i, "
            f"{counts.get('orders', 0)} buyurtma, kassa."
        )

        if result["ok"]:
            self.stdout.write(self.style.SUCCESS("[OK] Butunlik joyida - farq yo'q."))
            return

        self.stdout.write(
            self.style.ERROR(f"[XATO] {result['mismatch_count']} ta farq topildi:")
        )
        for m in result["mismatches"]:
            self.stdout.write(
                f"  - {m['label']}: saqlangan {m['stored']} != jurnal {m['ledger']} "
                f"(farq {m['diff']})"
            )
            if opts["fix_dry_run"] and not opts["fix"]:
                self.stdout.write(
                    f"      -> tuzatish: {m['stored']} -> {m['ledger']}"
                )

        if opts["fix"]:
            for m in result["mismatches"]:
                apply_integrity_fix(m)
            self.stdout.write(self.style.SUCCESS(
                f"{result['mismatch_count']} ta qiymat jurnalga moslandi."
            ))
            return

        raise SystemExit(1)
