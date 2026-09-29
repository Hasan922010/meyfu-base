"""v5 C2: mijoz bilan solishtirma dalolatnoma (akt-sverka)."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.core.business_day import business_date
from apps.sales.models import Debt


def _sell(auth_api, client, product, qty: str, payment: str = "NAQD") -> None:
    body = {
        "client": str(client.id), "payment_type": payment,
        "items": [{"product": str(product.id), "quantity": qty, "price": "27000"}],
    }
    if payment == "QARZ":
        body["due_date"] = "2026-12-01"
    assert auth_api.post("/api/v1/sales/", body, format="json").status_code == 201


def _login(phone: str) -> APIClient:
    client = APIClient()
    resp = client.post("/api/v1/auth/login/", {"phone": phone, "password": "pass12345"},
                       format="json")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return client


@pytest.fixture
def history(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    _sell(auth_api, client, product, "10")            # 270 000 naqd
    _sell(auth_api, client, product, "5", "QARZ")     # 135 000 qarzga
    debt = Debt.objects.get(client=client)
    resp = auth_api.post(
        "/api/v1/debt-payments/",
        {"debt": str(debt.id), "amount": "50000", "payment_type": "NAQD"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    return client


@pytest.mark.django_db
def test_statement_balance_matches_client_debt(manager_api, history):
    resp = manager_api.get(f"/api/v1/clients/{history.id}/statement/")

    assert resp.status_code == 200
    data = resp.data["data"]
    history.refresh_from_db()
    assert Decimal(data["closing_balance"]) == history.current_debt == Decimal("85000")
    assert Decimal(data["debit"]) == Decimal("405000")   # 270 000 + 135 000
    assert Decimal(data["credit"]) == Decimal("320000")  # 270 000 + 50 000
    assert len(data["rows"]) == 3


@pytest.mark.django_db
def test_statement_opening_balance_carries_earlier_period(manager_api, history):
    tomorrow = (business_date() + timedelta(days=1)).isoformat()

    resp = manager_api.get(
        f"/api/v1/clients/{history.id}/statement/",
        {"date_from": tomorrow, "date_to": tomorrow},
    )

    data = resp.data["data"]
    assert Decimal(data["opening_balance"]) == Decimal("85000")
    assert data["rows"] == []


@pytest.mark.django_db
def test_statement_pdf(manager_api, history):
    resp = manager_api.get(f"/api/v1/clients/{history.id}/statement/", {"fmt": "pdf"})

    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")


@pytest.mark.django_db
def test_other_distributor_cannot_read_statement(history, routed_clients):
    other = _login("+998905554433")  # routed_clients'dagi boshqa tarqatuvchi

    assert other.get(f"/api/v1/clients/{history.id}/statement/").status_code == 404
