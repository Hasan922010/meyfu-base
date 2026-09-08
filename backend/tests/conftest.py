from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture(autouse=True)
def _clear_cache():
    """Har test o'z holatidan boshlansin — hisobot keshlari testlar orasida
    oqib ketmasin (dashboard 15 s, distributor_full 60 s)."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture
def distributor(db):
    from apps.users.models import DistributorProfile

    user = User.objects.create_user(
        phone="+998901112233", password="pass12345", full_name="Test Tarqatuvchi",
        role="DISTRIBUTOR",
    )
    DistributorProfile.objects.create(user=user, commission_percent="5")
    return user


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        phone="+998900000000", password="admin12345", full_name="Test Admin",
    )


@pytest.fixture
def manager(db):
    return User.objects.create_user(
        phone="+998907778899", password="pass12345", full_name="Test Menejer",
        role="MANAGER",
    )


def _bearer(phone: str, password: str = "pass12345") -> APIClient:
    """Har chaqiruvda alohida klient — kredensiallar aralashmasligi uchun."""
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/login/",
        {"phone": phone, "password": password},
        format="json",
    )
    token = resp.data["data"]["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def auth_api(distributor):
    return _bearer("+998901112233")


@pytest.fixture
def admin_api(admin_user):
    return _bearer("+998900000000", password="admin12345")


@pytest.fixture
def manager_api(manager):
    return _bearer("+998907778899")


@pytest.fixture
def catalog(db):
    """Bitta mahsulot + kerakli bog'liqliklar."""
    from apps.catalog.models import Brand, Category, Product, Unit

    category = Category.objects.create(name="Kir yuvish kukunlari")
    brand = Brand.objects.create(name="Test Brand")
    unit = Unit.objects.create(name="Dona", short_name="dona")
    product = Product.objects.create(
        name="Test kukun 3kg", sku="PWD-3KG", category=category, brand=brand,
        unit=unit, cost_price="20000", wholesale_price="25000",
        retail_price="28000", min_price="24000",
    )
    return {
        "category": category, "brand": brand, "unit": unit, "product": product,
    }


@pytest.fixture
def warehouse(db):
    from apps.warehouse.models import Supplier, Warehouse

    return {
        "warehouse": Warehouse.objects.create(name="Markaziy ombor"),
        "supplier": Supplier.objects.create(name="Zavod A"),
    }


@pytest.fixture
def stocked(db, catalog, warehouse, manager):
    """Omborda 500 dona qoldiq bo'lgan mahsulot."""
    from decimal import Decimal

    from apps.warehouse.constants import MovementType
    from apps.warehouse.services import apply_movement

    apply_movement(
        warehouse=warehouse["warehouse"],
        product=catalog["product"],
        quantity=Decimal("500"),
        movement_type=MovementType.IN_PURCHASE,
        user=manager,
    )
    return {**catalog, **warehouse}


@pytest.fixture
def expense_categories(db):
    from apps.expenses.models import ExpenseCategory

    return {
        "fuel": ExpenseCategory.objects.create(
            name="Yoqilg'i", icon="⛽", daily_limit="200000", paid_by="COMPANY",
        ),
        "lunch": ExpenseCategory.objects.create(
            name="Tushlik", icon="🍽", requires_receipt=False, paid_by="COMPANY",
        ),
        "repair": ExpenseCategory.objects.create(
            name="Ta'mirlash", icon="🔧", requires_receipt=True, paid_by="COMPANY",
        ),
    }


@pytest.fixture
def van_stocked(db, stocked, distributor, routed_clients):
    """Tarqatuvchida 500 dona mashina qoldig'i (yuklama tasdiqlangan) +
    marshrutdagi mijoz."""
    from decimal import Decimal

    from django.utils import timezone

    from apps.warehouse.models import Loading, LoadingItem
    from apps.warehouse.services import confirm_loading, send_loading
    from apps.warehouse.services.loading import assign_number

    loading = Loading.objects.create(
        date=timezone.localdate(),
        distributor=distributor,
        warehouse=stocked["warehouse"],
    )
    LoadingItem.objects.create(
        loading=loading, product=stocked["product"],
        quantity=Decimal("500"), price=Decimal("25000"),
        amount=Decimal("12500000"),
    )
    assign_number(loading)
    loading.recalc_total()
    loading.save()
    send_loading(loading)
    confirm_loading(loading, user=distributor)

    return {
        **stocked,
        "distributor": distributor,
        "client": routed_clients["my_client"],
        "loading": loading,
    }


@pytest.fixture
def routed_clients(db, distributor):
    """distributor uchun marshrut + mijoz, va boshqa tarqatuvchi uchun ham."""
    from apps.clients.models import Client, Route

    other = User.objects.create_user(
        phone="+998905554433", password="pass12345", full_name="Boshqa Tarqatuvchi",
        role="DISTRIBUTOR",
    )
    my_route = Route.objects.create(
        name="Chilonzor", distributor=distributor, days_of_week=[1, 3, 5]
    )
    other_route = Route.objects.create(name="Yunusobod", distributor=other)

    my_client = Client.objects.create(
        name="Do'kon A", route=my_route, phone="+998911112233", debt_limit="1000000"
    )
    other_client = Client.objects.create(name="Do'kon B", route=other_route)

    return {
        "other_distributor": other,
        "my_route": my_route,
        "other_route": other_route,
        "my_client": my_client,
        "other_client": other_client,
    }
