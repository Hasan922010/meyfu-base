"""Kechki qaytarish hujjati — faqat o'qish (filial hisobotidagi hujjat oynasi uchun).

Tarqatuvchi faqat o'z qaytarishini, filialga biriktirilgan omborchi faqat o'z
omboriga tushgan qaytarishni ko'radi (CLAUDE.md 18 — rol ruxsatlari).
"""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.dayclose.models import DailyReturn, DailyReturnItem
from apps.warehouse.models import Warehouse

URL = "/api/v1/daily-returns/"


def _login(phone: str) -> APIClient:
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/login/", {"phone": phone, "password": "pass12345"}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return client


@pytest.fixture
def daily_return(stocked, distributor):
    ret = DailyReturn.objects.create(
        number="QT-2026-00001", date="2026-09-29", distributor=distributor,
        warehouse=stocked["warehouse"], total_amount=Decimal("50000"),
        note="Kechki qaytarish",
    )
    DailyReturnItem.objects.create(
        daily_return=ret, product=stocked["product"], quantity=Decimal("2"),
        condition="DAMAGED", price=Decimal("25000"), amount=Decimal("50000"),
    )
    return ret


def _warehouse_keeper(phone: str, warehouse: Warehouse | None) -> APIClient:
    get_user_model().objects.create_user(
        phone=phone, password="pass12345", full_name="Filial Omborchi",
        role="WAREHOUSE", warehouse=warehouse,
    )
    return _login(phone)


def test_admin_reads_daily_return_with_items(admin_api, daily_return):
    resp = admin_api.get(f"{URL}{daily_return.pk}/")

    assert resp.status_code == 200
    data = resp.data["data"]
    assert data["number"] == "QT-2026-00001"
    assert data["warehouse_name"] == "Markaziy ombor"
    assert data["distributor_name"] == "Test Tarqatuvchi"
    assert data["items"][0]["product_name"] == "Test kukun 3kg"
    assert data["items"][0]["condition"] == "DAMAGED"


def test_distributor_cannot_read_other_distributors_return(daily_return, routed_clients):
    other = _login("+998905554433")  # routed_clients'dagi boshqa tarqatuvchi

    assert other.get(f"{URL}{daily_return.pk}/").status_code == 404


def test_distributor_reads_own_return(auth_api, daily_return):
    assert auth_api.get(f"{URL}{daily_return.pk}/").status_code == 200


def test_branch_keeper_sees_only_own_warehouse_returns(daily_return):
    branch = Warehouse.objects.create(name="Chilonzor filiali", is_branch=True)
    keeper = _warehouse_keeper("+998906667788", branch)

    assert keeper.get(f"{URL}{daily_return.pk}/").status_code == 404


def test_central_keeper_sees_returns_of_own_warehouse(daily_return):
    keeper = _warehouse_keeper("+998906667799", daily_return.warehouse)

    assert keeper.get(f"{URL}{daily_return.pk}/").status_code == 200


def test_daily_returns_are_read_only(admin_api, daily_return):
    resp = admin_api.patch(f"{URL}{daily_return.pk}/", {"note": "x"}, format="json")

    assert resp.status_code == 405
