"""Dev uchun boshlang'ich ma'lumot: o'lchov birliklari, kategoriya, ombor, brend.

Ishlab chiqarish `seed_demo` (16-bosqich) dan farqli — bu faqat minimal karkas.
Idempotent: qayta ishga tushirsa dublikat yaratmaydi.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Katalog va ombor uchun minimal boshlang'ich ma'lumot yaratadi."

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        from apps.catalog.models import Brand, Category, Unit
        from apps.warehouse.models import Supplier, Warehouse

        units = [("Dona", "dona"), ("Kilogramm", "kg"), ("Litr", "l"),
                 ("Quti", "quti")]
        for name, short in units:
            Unit.objects.get_or_create(name=name, defaults={"short_name": short})

        categories = ["Kir yuvish kukunlari", "Gellar", "Sovunlar", "Shampunlar",
                      "Yuvish vositalari"]
        for name in categories:
            Category.objects.get_or_create(name=name)

        for name in ["Global Chem", "Barf", "Bahor"]:
            Brand.objects.get_or_create(name=name)

        Warehouse.objects.get_or_create(name="Markaziy ombor")
        Supplier.objects.get_or_create(name="Zavod #1")

        from apps.expenses.models import ExpenseCategory

        expense_cats = [
            ("Yoqilg'i", "⛽", False), ("Tushlik", "🍽", False),
            ("Mashina yuvish", "🚿", False), ("Ta'mirlash", "🔧", True),
            ("Parkovka", "🅿️", False), ("Aloqa", "📱", False),
        ]
        for name, icon, receipt in expense_cats:
            ExpenseCategory.objects.get_or_create(
                name=name, defaults={"icon": icon, "requires_receipt": receipt},
            )

        self.stdout.write(self.style.SUCCESS(
            f"Tayyor: {Unit.objects.count()} birlik, "
            f"{Category.objects.count()} kategoriya, "
            f"{Warehouse.objects.count()} ombor, "
            f"{Supplier.objects.count()} yetkazib beruvchi, "
            f"{ExpenseCategory.objects.count()} xarajat kategoriyasi."
        ))
