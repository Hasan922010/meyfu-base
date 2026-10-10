"""Rollar ruxsatlari kengaytirilishi bo'yicha integratsion testlar."""
import pytest
from rest_framework.test import APIClient

from apps.catalog.models import Product
from apps.clients.models import Client, Route
from apps.users.constants import Role
from apps.warehouse.models import Warehouse


@pytest.fixture
def make_staff(db, django_user_model):
    def _create(role: str, phone: str = "998901234567", warehouse=None):
        return django_user_model.objects.create_user(
            phone=phone,
            password="pass1234",
            full_name=f"User {role}",
            role=role,
            warehouse=warehouse,
        )
    return _create


@pytest.fixture
def api_client():
    def _client_for(user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c
    return _client_for


@pytest.mark.django_db
def test_order_taker_and_distributor_can_update_client_operational_fields(
    make_staff, api_client
):
    branch_wh = Warehouse.objects.create(name="Filial Ombor", is_active=True, is_branch=True)
    taker = make_staff(Role.ORDER_TAKER, phone="998901111111", warehouse=branch_wh)
    route = Route.objects.create(name="Marshrut 1", branch=branch_wh, order_taker=taker)
    client = Client.objects.create(
        name="Do'kon A",
        phone="998901110001",
        route=route,
        branch=branch_wh,
        debt_limit=1000000,
        is_blocked=False,
    )

    client_api = api_client(taker)

    # 1. Operatsion maydonlarni (telefon, GPS, address) yangilashga ruxsat bor
    resp = client_api.patch(
        f"/api/v1/clients/{client.id}/",
        {"phone": "998909999999", "latitude": "41.3111", "longitude": "69.2405", "address": "Maktab yonida"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    client.refresh_from_db()
    assert client.phone == "+998909999999"
    assert client.address == "Maktab yonida"

    # 2. Moliyaviy maydonlarni (debt_limit, is_blocked) o'zgartirish rad etiladi
    resp_restricted = client_api.patch(
        f"/api/v1/clients/{client.id}/",
        {"debt_limit": 50000000},
        format="json",
    )
    assert resp_restricted.status_code == 403
    assert resp_restricted.data["error"]["code"] == "PERMISSION_DENIED"

    # 3. Mijozni o'chirish rad etiladi
    resp_delete = client_api.delete(f"/api/v1/clients/{client.id}/")
    assert resp_delete.status_code == 403


@pytest.mark.django_db
def test_order_taker_can_record_visit_on_own_route(make_staff, api_client):
    branch_wh = Warehouse.objects.create(name="Filial Ombor 2", is_active=True, is_branch=True)
    taker = make_staff(Role.ORDER_TAKER, phone="998902222222", warehouse=branch_wh)
    other_taker = make_staff(Role.ORDER_TAKER, phone="998903333333", warehouse=branch_wh)
    route = Route.objects.create(name="Marshrut 2", branch=branch_wh, order_taker=taker)
    client = Client.objects.create(name="Do'kon B", phone="998902220002", route=route, branch=branch_wh)

    # O'z marshruti mijozi — muvaffaqiyatli
    taker_client = api_client(taker)
    resp = taker_client.post(
        "/api/v1/client-visits/",
        {
            "client": str(client.id),
            "latitude": "41.3100",
            "longitude": "69.2400",
            "result": "SOTUV",
            "note": "Zakaz olindi",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data

    # Boshqa zakaz oluvchi kelsa — rad etiladi
    other_client = api_client(other_taker)
    resp_other = other_client.post(
        "/api/v1/client-visits/",
        {
            "client": str(client.id),
            "latitude": "41.3100",
            "longitude": "69.2400",
            "result": "YOPIQ",
        },
        format="json",
    )
    assert resp_other.status_code == 403


@pytest.mark.django_db
def test_branch_manager_cannot_set_branch_price(make_staff, api_client):
    from apps.catalog.models import Category, Unit

    branch_wh = Warehouse.objects.create(name="Samarqand Filial", is_active=True, is_branch=True)
    bm = make_staff(Role.BRANCH_MANAGER, phone="998904444444", warehouse=branch_wh)
    category = Category.objects.create(name="Ichimliklar")
    unit = Unit.objects.create(name="dona", short_name="dona")
    product = Product.objects.create(
        category=category, unit=unit, sku="PRD-01", name="Mahsulot 1",
        cost_price=10000, wholesale_price=12000, retail_price=15000,
    )

    bm_client = api_client(bm)

    # Narx belgilash — faqat SUPER_ADMIN (CLAUDE.md 2), filial boshqaruvchisiga 403
    resp = bm_client.post(
        "/api/v1/branch-prices/",
        {
            "branch": str(branch_wh.id),
            "product": str(product.id),
            "wholesale_price": 13000,
            "retail_price": 16000,
            "min_price": 11000,
        },
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_accountant_can_enter_opening_balances(make_staff, api_client):
    branch_wh = Warehouse.objects.create(name="Markaz Ombor", is_active=True, is_branch=False)
    accountant = make_staff(Role.ACCOUNTANT, phone="998905555555")

    acc_client = api_client(accountant)

    # 1. Kassa boshlang'ich qoldig'i
    resp_cash = acc_client.post(
        "/api/v1/cash-transactions/opening-balance/",
        {"amount": 5000000, "note": "Boshlang'ich kassa"},
        format="json",
    )
    assert resp_cash.status_code == 201, resp_cash.data

    # 2. Mijoz boshlang'ich qarzi
    client = Client.objects.create(name="Eski Mijoz", phone="998905550005", branch=branch_wh)
    resp_client_debt = acc_client.post(
        "/api/v1/clients/opening-balance/",
        {"client": str(client.id), "amount": 1200000, "note": "Eski qarz"},
        format="json",
    )
    assert resp_client_debt.status_code == 201, resp_client_debt.data
