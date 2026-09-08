"""To'liq demo ma'lumot — brauzerda sinov / pilot uchun.

    python manage.py seed_demo

Idempotent emas — bo'sh bazada ishlating (yoki `--fresh`).
"""
from __future__ import annotations

import datetime
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

PHONE_ADMIN = "+998900000000"
PHONE_MANAGER = "+998901000000"
PHONE_WAREHOUSE = "+998902000000"
PHONE_DIST = "+998903000000"
PW = "demo12345"
ADMIN_PW = "Hasanali.0220"


class Command(BaseCommand):
    help = "To'liq demo dataset yaratadi (sinov uchun)."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--fresh", action="store_true",
                            help="Avval demo foydalanuvchilarni o'chirish")

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        from apps.catalog.models import Brand, Category, Product, Unit
        from apps.clients.models import Client, Route
        from apps.expenses.models import ExpenseCategory
        from apps.users.models import DistributorProfile, User
        from apps.warehouse.constants import MovementType
        from apps.warehouse.models import (
            Loading,
            LoadingItem,
            Supplier,
            Warehouse,
        )
        from apps.warehouse.services import (
            apply_movement,
            confirm_loading,
            send_loading,
        )
        from apps.warehouse.services.loading import assign_number

        if options["fresh"]:
            User.objects.filter(phone__in=[
                PHONE_MANAGER, PHONE_WAREHOUSE, PHONE_DIST
            ]).delete()

        # --- foydalanuvchilar ---
        admin, _ = User.objects.get_or_create(
            phone=PHONE_ADMIN,
            defaults={"full_name": "Bosh admin", "role": "SUPER_ADMIN",
                      "is_staff": True, "is_superuser": True},
        )
        admin.set_password(ADMIN_PW)
        admin.save()

        self._user(User, PHONE_MANAGER, "Malika Menejer", "MANAGER")
        warehouse_user = self._user(User, PHONE_WAREHOUSE, "Olim Omborchi",
                                    "WAREHOUSE")
        dist = self._user(User, PHONE_DIST, "Sardor Tarqatuvchi", "DISTRIBUTOR")
        DistributorProfile.objects.get_or_create(
            user=dist,
            defaults={"base_salary": "3000000", "commission_percent": "5",
                      "monthly_plan": "50000000", "debt_limit": "2000000",
                      "daily_expense_limit": "300000"},
        )

        # --- katalog ---
        unit_dona, _ = Unit.objects.get_or_create(
            name="Dona", defaults={"short_name": "dona"})
        unit_kg, _ = Unit.objects.get_or_create(
            name="Kilogramm", defaults={"short_name": "kg"})
        cat_kukun, _ = Category.objects.get_or_create(name="Kir yuvish kukunlari")
        cat_gel, _ = Category.objects.get_or_create(name="Gellar")
        cat_sovun, _ = Category.objects.get_or_create(name="Sovunlar")
        brand, _ = Brand.objects.get_or_create(name="Global Chem")

        products_spec = [
            ("Bio kukun 3kg", "BIO-3KG", cat_kukun, "22000", "26000", "30000",
             "25000"),
            ("Bio kukun 6kg", "BIO-6KG", cat_kukun, "40000", "47000", "54000",
             "45000"),
            ("Yuvish geli 1L", "GEL-1L", cat_gel, "18000", "22000", "26000",
             "21000"),
            ("Kir sovuni 200g", "SOAP-200", cat_sovun, "3000", "4000", "5000",
             "3800"),
            ("Idish yuvish geli 500ml", "DISH-500", cat_gel, "12000", "15000",
             "18000", "14000"),
        ]
        products = []
        for name, sku, cat, cost, ws, rt, mn in products_spec:
            p, _ = Product.objects.get_or_create(
                sku=sku,
                defaults={
                    "name": name, "category": cat, "brand": brand,
                    "unit": unit_dona, "cost_price": cost,
                    "wholesale_price": ws, "retail_price": rt, "min_price": mn,
                    "min_stock_alert": "20",
                },
            )
            products.append(p)
        # defaults string bo'lishi mumkin — bazadan qayta o'qiymiz
        products = list(
            Product.objects.filter(
                sku__in=[s[1] for s in products_spec]
            ).select_related("unit")
        )

        # --- ombor + qoldiq ---
        warehouse, _ = Warehouse.objects.get_or_create(name="Markaziy ombor")
        supplier, _ = Supplier.objects.get_or_create(
            name="Global Chem zavodi", defaults={"phone": "+998712000000"})
        for p in products:
            apply_movement(
                warehouse=warehouse, product=p, quantity=Decimal("500"),
                movement_type=MovementType.IN_PURCHASE, user=admin,
                note="Demo boshlang'ich qoldiq",
            )

        # --- marshrut + mijozlar ---
        route, _ = Route.objects.get_or_create(
            name="Chilonzor marshruti",
            defaults={"distributor": dist, "days_of_week": [1, 2, 3, 4, 5]},
        )
        route.distributor = dist
        route.save()
        client_names = [
            ("Baraka do'koni", "Zafar aka", "1000000"),
            ("Oila market", "Nodira opa", "1500000"),
            ("Yangi hayot", "Bekzod", "800000"),
            ("Salom savdo", "Gulnora", "1200000"),
            ("Dilnoza market", "Dilnoza", "600000"),
        ]
        for name, owner, limit in client_names:
            Client.objects.get_or_create(
                name=name, route=route,
                defaults={"owner_name": owner, "phone": "+99893" + name[:7],
                          "debt_limit": limit, "address": "Chilonzor tumani"},
            )

        # --- xarajat kategoriyalari ---
        for cname, icon, receipt in [
            ("Yoqilg'i", "⛽", False), ("Tushlik", "🍽", False),
            ("Mashina yuvish", "🚿", False), ("Ta'mirlash", "🔧", True),
            ("Parkovka", "🅿️", False), ("Aloqa", "📱", False),
        ]:
            ExpenseCategory.objects.get_or_create(
                name=cname, defaults={"icon": icon, "requires_receipt": receipt,
                                      "daily_limit": "150000"},
            )

        # --- bugungi yuklama (tasdiqlangan) ---
        loading = Loading.objects.create(
            date=datetime.date.today(), distributor=dist, warehouse=warehouse,
            created_by=warehouse_user,
        )
        for p in products[:4]:
            LoadingItem.objects.create(
                loading=loading, product=p, quantity=Decimal("60"),
                price=p.wholesale_price, amount=Decimal("60") * p.wholesale_price,
            )
        assign_number(loading)
        loading.recalc_total()
        loading.save()
        send_loading(loading, user=warehouse_user)
        confirm_loading(loading, user=dist)

        sales_made = self._history(dist, route, products[:4])

        self.stdout.write(self.style.SUCCESS(
            "\n=== DEMO TAYYOR ===\n"
            f"  SUPER_ADMIN : {PHONE_ADMIN} / {PW}\n"
            f"  MANAGER     : {PHONE_MANAGER} / {PW}\n"
            f"  WAREHOUSE   : {PHONE_WAREHOUSE} / {PW}\n"
            f"  DISTRIBUTOR : {PHONE_DIST} / {PW}\n"
            f"  {len(products)} mahsulot, {len(client_names)} mijoz, "
            f"1 marshrut, tasdiqlangan yuklama {loading.number}\n"
            f"  {sales_made} ta demo sotuv (oxirgi 5 kun) + qarz to'lovi + xarajat\n"
        ))

    def _history(self, dist, route, products) -> int:
        """Oxirgi 5 kunlik sotuv/qarz/xarajat — dashboard va 360° karta bo'sh
        ko'rinmasligi uchun. Har biri alohida wrap — biri buzilsa qolgani davom etadi."""
        import random

        from apps.clients.models import Client
        from apps.expenses.constants import PaymentSource
        from apps.expenses.models import ExpenseCategory
        from apps.expenses.services import approve_expense, create_expense
        from apps.sales.constants import PaymentType
        from apps.sales.models import Debt
        from apps.sales.services.debt import collect_debt_payment
        from apps.sales.services.sale import SaleLine, create_sale

        rng = random.Random(42)
        clients = list(Client.objects.filter(route=route)[:4])
        if not clients or not products:
            return 0

        made = 0
        for days_ago in range(5, -1, -1):  # 5 kun oldindan bugungacha
            day = datetime.date.today() - datetime.timedelta(days=days_ago)
            for client in clients[: rng.randint(2, 4)]:
                lines = [
                    SaleLine(
                        product=p, quantity=Decimal(rng.randint(2, 6)),
                        price=p.wholesale_price,
                    )
                    for p in rng.sample(products, rng.randint(1, 2))
                ]
                pay = rng.choice(
                    [PaymentType.CASH, PaymentType.CASH, PaymentType.CARD,
                     PaymentType.DEBT]
                )
                try:
                    res = create_sale(
                        distributor=dist, client=client, payment_type=pay,
                        lines=lines, date=day,
                        due_date=day + datetime.timedelta(days=14)
                        if pay == PaymentType.DEBT else None,
                    )
                    if res.created:
                        made += 1
                except Exception as exc:  # noqa: BLE001
                    self.stderr.write(f"  demo sotuv o'tkazib yuborildi: {exc}")

        # bitta qarzni qisman to'lash
        debt = Debt.objects.filter(
            sale__distributor=dist, status__in=["ACTIVE", "PARTIAL"]
        ).first()
        if debt:
            try:
                collect_debt_payment(
                    debt=debt, amount=debt.remaining / 2, collected_by=dist,
                    date=datetime.date.today() - datetime.timedelta(days=1),
                )
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(f"  demo qarz to'lovi o'tkazib yuborildi: {exc}")

        # bir nechta xarajat (yoqilg'i + tushlik), biri tasdiqlangan
        fuel = ExpenseCategory.objects.filter(name="Yoqilg'i").first()
        lunch = ExpenseCategory.objects.filter(name="Tushlik").first()
        for cat, amount, dago in [(fuel, "80000", 3), (fuel, "90000", 1),
                                  (lunch, "25000", 2)]:
            if cat is None:
                continue
            try:
                r = create_expense(
                    distributor=dist, category=cat, amount=Decimal(amount),
                    payment_source=PaymentSource.CASH_ON_HAND,
                    date=datetime.date.today() - datetime.timedelta(days=dago),
                    description="Demo xarajat",
                )
                if dago != 1:
                    approve_expense(r.expense, user=dist)
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(f"  demo xarajat o'tkazib yuborildi: {exc}")

        return made

    @staticmethod
    def _user(model, phone, name, role):
        user, _ = model.objects.get_or_create(
            phone=phone, defaults={"full_name": name, "role": role},
        )
        user.set_password(PW)
        user.full_name = name
        user.role = role
        user.save()
        return user
