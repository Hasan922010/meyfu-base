"""Granular staff feature flags and permissions unit tests."""
from __future__ import annotations

from decimal import Decimal
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.catalog.models import Category, Product, Unit
from apps.clients.models import Client, Route
from apps.core.business_day import business_date
from apps.expenses.models import ExpenseCategory
from apps.orders.models import Order
from apps.sales.constants import PaymentType
from apps.sales.models import Debt, Sale
from apps.sales.services import SaleLine, create_sale
from apps.users.constants import Role
from apps.users.models import DistributorProfile
from apps.warehouse.models import Purchase, Stock, Supplier, VanStock, Warehouse

User = get_user_model()


@pytest.fixture
def permissions_setup(db):
    wh = Warehouse.objects.create(name="Asosiy Ombor")
    sup = Supplier.objects.create(name="Ta'minotchi 1")
    unit = Unit.objects.create(name="Dona", short_name="dona")
    cat = Category.objects.create(name="Ichimliklar")
    prod = Product.objects.create(
        name="Cola 1.5L",
        sku="COLA-15",
        unit=unit,
        category=cat,
        retail_price=Decimal("12000"),
        wholesale_price=Decimal("11000"),
        cost_price=Decimal("9000"),
    )
    Stock.objects.create(warehouse=wh, product=prod, quantity=Decimal("100"))

    route = Route.objects.create(name="Chilonzor")
    client = Client.objects.create(
        name="Test Do'kon",
        phone="+998901234567",
        route=route,
        debt_limit=Decimal("10000000"),
    )

    exp_cat = ExpenseCategory.objects.create(name="Benzin")

    return {
        "warehouse": wh,
        "supplier": sup,
        "product": prod,
        "client": client,
        "route": route,
        "expense_category": exp_cat,
    }


@pytest.mark.django_db
def test_user_role_default_permissions():
    """Yangi xodim yaratilganda roliga mos birlamchi ruxsatlar to'g'ri o'rnatiladi."""
    dist = User.objects.create_user(
        phone="+998901000001", password="testpass123", full_name="Dist 1", role=Role.DISTRIBUTOR
    )
    assert dist.can_make_sales is True
    assert dist.can_sell_on_debt is True
    assert dist.can_collect_debts is True
    assert dist.can_see_warehouse_stock is True
    assert dist.can_receive_stock is False
    assert dist.can_take_orders is True

    agent = User.objects.create_user(
        phone="+998901000002", password="testpass123", full_name="Agent 1", role=Role.ORDER_TAKER
    )
    assert agent.can_take_orders is True
    assert agent.can_see_warehouse_stock is True
    assert agent.can_make_sales is False
    assert agent.can_receive_stock is False

    wh_user = User.objects.create_user(
        phone="+998901000003", password="testpass123", full_name="Omborchi 1", role=Role.WAREHOUSE
    )
    assert wh_user.can_receive_stock is True
    assert wh_user.can_see_warehouse_stock is True
    assert wh_user.can_scan_invoices is True
    assert wh_user.can_take_orders is True
    assert wh_user.can_make_sales is True


@pytest.mark.django_db
def test_admin_updates_staff_permissions_via_api(admin_api):
    """Superuser xodimning ruxsatlarini PATCH orqali alohida o'zgartira oladi."""
    user = User.objects.create_user(
        phone="+998901000004", password="testpass123", full_name="Xodim 4", role=Role.ORDER_TAKER
    )
    assert user.can_make_sales is False
    assert user.can_receive_stock is False

    resp = admin_api.patch(
        f"/api/v1/users/{user.id}/",
        {
            "can_make_sales": True,
            "can_receive_stock": True,
            "can_sell_on_debt": True,
        },
        format="json",
    )
    assert resp.status_code == 200, resp.data
    data = resp.data["data"]
    assert data["can_make_sales"] is True
    assert data["can_receive_stock"] is True
    assert data["can_sell_on_debt"] is True
    assert data["permissions"]["can_make_sales"] is True
    assert data["permissions"]["can_receive_stock"] is True

    user.refresh_from_db()
    assert user.can_make_sales is True
    assert user.can_receive_stock is True
    assert user.can_sell_on_debt is True


@pytest.mark.django_db
def test_order_taking_permission_enforcement(permissions_setup):
    """can_take_orders=False bo'lsa buyurtma yaratish bloklanadi (403)."""
    user = User.objects.create_user(
        phone="+998901000005", password="testpass123", full_name="User 5", role=Role.ORDER_TAKER
    )
    route = permissions_setup["route"]
    route.order_taker = user
    route.save()

    user.can_take_orders = False
    user.save()

    client_api = APIClient()
    login_resp = client_api.post(
        "/api/v1/auth/login/",
        {"phone": "+998901000005", "password": "testpass123"},
        format="json",
    )
    token = login_resp.data["data"]["access"]
    client_api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    p = permissions_setup["product"]
    c = permissions_setup["client"]
    resp = client_api.post(
        "/api/v1/orders/",
        {
            "client": str(c.id),
            "taken_by": str(user.id),
            "payment_intent": "NAQD",
            "items": [{"product": str(p.id), "quantity": "5", "price": "12000"}],
        },
        format="json",
    )
    assert resp.status_code == 403
    assert resp.data["error"]["code"] == "ORDER_TAKING_FORBIDDEN"

    # Ruxsat berilganda muvaffaqiyatli o'tadi
    user.can_take_orders = True
    user.save()
    resp2 = client_api.post(
        "/api/v1/orders/",
        {
            "client": str(c.id),
            "taken_by": str(user.id),
            "payment_intent": "NAQD",
            "items": [{"product": str(p.id), "quantity": "5", "price": "12000"}],
        },
        format="json",
    )
    assert resp2.status_code == 201


@pytest.mark.django_db
def test_sales_and_debt_sale_permission_enforcement(permissions_setup):
    """can_make_sales va can_sell_on_debt ruxsatlari to'g'ri tekshiriladi."""
    dist = User.objects.create_user(
        phone="+998901000006", password="testpass123", full_name="Dist 6", role=Role.DISTRIBUTOR
    )
    DistributorProfile.objects.create(user=dist, commission_percent="5")
    p = permissions_setup["product"]
    c = permissions_setup["client"]

    VanStock.objects.create(distributor=dist, product=p, quantity=Decimal("50"))

    client_api = APIClient()
    login_resp = client_api.post(
        "/api/v1/auth/login/",
        {"phone": "+998901000006", "password": "testpass123"},
        format="json",
    )
    token = login_resp.data["data"]["access"]
    client_api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    # 1. can_make_sales=False -> 403 SALES_FORBIDDEN
    dist.can_make_sales = False
    dist.save()

    resp = client_api.post(
        "/api/v1/sales/",
        {
            "client": str(c.id),
            "payment_type": "NAQD",
            "items": [{"product": str(p.id), "quantity": "2", "price": "12000"}],
        },
        format="json",
    )
    assert resp.status_code == 403
    assert resp.data["error"]["code"] == "SALES_FORBIDDEN"

    # 2. can_make_sales=True, lekin can_sell_on_debt=False
    dist.can_make_sales = True
    dist.can_sell_on_debt = False
    dist.save()

    # Qarzga sotish taqiqlanadi
    resp_debt = client_api.post(
        "/api/v1/sales/",
        {
            "client": str(c.id),
            "payment_type": "QARZ",
            "due_date": "2026-12-01",
            "items": [{"product": str(p.id), "quantity": "2", "price": "12000"}],
        },
        format="json",
    )
    assert resp_debt.status_code == 403
    assert resp_debt.data["error"]["code"] == "DEBT_SALE_FORBIDDEN"

    # Naqdga sotish ruxsat etiladi
    resp_cash = client_api.post(
        "/api/v1/sales/",
        {
            "client": str(c.id),
            "payment_type": "NAQD",
            "items": [{"product": str(p.id), "quantity": "2", "price": "12000"}],
        },
        format="json",
    )
    assert resp_cash.status_code == 201


@pytest.mark.django_db
def test_debt_collection_permission_enforcement(permissions_setup):
    """can_collect_debts=False bo'lsa qarz undirish bloklanadi."""
    dist = User.objects.create_user(
        phone="+998901000007", password="testpass123", full_name="Dist 7", role=Role.DISTRIBUTOR
    )
    DistributorProfile.objects.create(user=dist, commission_percent="5")
    p = permissions_setup["product"]
    c = permissions_setup["client"]
    VanStock.objects.create(distributor=dist, product=p, quantity=Decimal("50"))

    # Avval bitta qarz yaratamiz
    sale_res = create_sale(
        distributor=dist,
        client=c,
        payment_type=PaymentType.DEBT,
        lines=[SaleLine(product=p, quantity=Decimal("2"), price=Decimal("12000"))],
        due_date="2026-12-01",
        date=business_date(),
    )
    debt = Debt.objects.get(sale=sale_res.sale)

    client_api = APIClient()
    login_resp = client_api.post(
        "/api/v1/auth/login/",
        {"phone": "+998901000007", "password": "testpass123"},
        format="json",
    )
    token = login_resp.data["data"]["access"]
    client_api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    # can_collect_debts=False
    dist.can_collect_debts = False
    dist.save()

    resp = client_api.post(
        "/api/v1/debt-payments/",
        {
            "debt": str(debt.id),
            "amount": "10000",
            "payment_type": "NAQD",
        },
        format="json",
    )
    assert resp.status_code == 403
    assert resp.data["error"]["code"] == "DEBT_COLLECTION_FORBIDDEN"


@pytest.mark.django_db
def test_receive_stock_permission_enforcement(permissions_setup):
    """can_receive_stock=False bo'lsa tovar kirim qilish bloklanadi."""
    wh_user = User.objects.create_user(
        phone="+998901000008", password="testpass123", full_name="Ombor 8", role=Role.WAREHOUSE
    )
    wh = permissions_setup["warehouse"]
    sup = permissions_setup["supplier"]
    wh_user.warehouse = wh
    wh_user.can_receive_stock = False
    wh_user.save()

    client_api = APIClient()
    login_resp = client_api.post(
        "/api/v1/auth/login/",
        {"phone": "+998901000008", "password": "testpass123"},
        format="json",
    )
    token = login_resp.data["data"]["access"]
    client_api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    p = permissions_setup["product"]
    resp = client_api.post(
        "/api/v1/purchases/",
        {
            "warehouse": str(wh.id),
            "supplier": str(sup.id),
            "invoice_number": "INV-100",
            "items": [{"product": str(p.id), "quantity": "10", "cost_price": "8000"}],
        },
        format="json",
    )
    assert resp.status_code == 403
    assert resp.data["error"]["code"] == "RECEIVE_STOCK_FORBIDDEN"


@pytest.mark.django_db
def test_expense_recording_permission_enforcement(permissions_setup):
    """can_record_expenses=False bo'lsa xarajat kiritish bloklanadi."""
    dist = User.objects.create_user(
        phone="+998901000009", password="testpass123", full_name="Dist 9", role=Role.DISTRIBUTOR
    )
    DistributorProfile.objects.create(user=dist, commission_percent="5")
    dist.can_record_expenses = False
    dist.save()

    client_api = APIClient()
    login_resp = client_api.post(
        "/api/v1/auth/login/",
        {"phone": "+998901000009", "password": "testpass123"},
        format="json",
    )
    token = login_resp.data["data"]["access"]
    client_api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    resp = client_api.post(
        "/api/v1/expenses/",
        {
            "category": str(permissions_setup["expense_category"].id),
            "amount": "50000",
            "payment_source": "CASH",
            "description": "Benzin",
        },
        format="json",
    )
    assert resp.status_code == 403
    assert resp.data["error"]["code"] == "EXPENSE_RECORDING_FORBIDDEN"
