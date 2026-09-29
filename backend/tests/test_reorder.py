"""v5 C1: qoldiq prognozi va buyurtma tavsiyasi."""
from __future__ import annotations

from datetime import timedelta

import pytest

from apps.core.business_day import business_date
from apps.sales.models import Sale

URL = "/api/v1/reports/reorder/"


def _sell_yesterday(auth_api, client, product, qty: str) -> None:
    body = {
        "client": str(client.id), "payment_type": "NAQD",
        "items": [{"product": str(product.id), "quantity": qty, "price": "27000"}],
    }
    resp = auth_api.post("/api/v1/sales/", body, format="json")
    assert resp.status_code == 201, resp.data
    # bugungi sotuv o'rtachaga kirmaydi (kun tugamagan) — kechagi qilib qo'yamiz
    Sale.objects.filter(pk=resp.data["data"]["id"]).update(
        date=business_date() - timedelta(days=1)
    )


def _row(resp, sku: str) -> dict:
    return next(r for r in resp.data["data"]["rows"] if r["sku"] == sku)


@pytest.mark.django_db
def test_fast_selling_product_is_urgent(auth_api, manager_api, van_stocked):
    _sell_yesterday(auth_api, van_stocked["client"], van_stocked["product"], "490")

    resp = manager_api.get(URL, {"days": 7, "cover": 14})

    assert resp.status_code == 200
    row = _row(resp, "PWD-3KG")
    assert row["avg_daily"] == "70.00"  # 490 / 7
    assert row["on_vans"] == "10.000"
    assert row["status"] == "URGENT"
    assert row["suggested"] == "970.000"  # 70 × 14 − 10


@pytest.mark.django_db
def test_slow_product_is_ok(auth_api, manager_api, van_stocked):
    _sell_yesterday(auth_api, van_stocked["client"], van_stocked["product"], "7")

    row = _row(manager_api.get(URL, {"days": 7}), "PWD-3KG")

    assert row["status"] == "OK"
    assert row["suggested"] == "0.000"


@pytest.mark.django_db
def test_invalid_period_rejected(manager_api):
    assert manager_api.get(URL, {"days": 1000}).status_code == 409


@pytest.mark.django_db
def test_distributor_cannot_see_reorder(auth_api):
    assert auth_api.get(URL).status_code == 403
