"""Audit №2 (2026-09-30) regressiya testlari — docs/AUDIT_REPORT_2026-09-30.md."""
import uuid
from decimal import Decimal

import pytest

from apps.sales.models import Sale
from apps.warehouse.models import VanStock

SYNC_URL = "/api/v1/sales/bulk-sync/"


def _sync_sale(api, client, product, **item):
    op = {
        "type": "sale",
        "client_uuid": str(uuid.uuid4()),
        "payload": {
            "client": str(client.id),
            "payment_type": "NAQD",
            "items": [{"product": str(product.id), **item}],
        },
    }
    resp = api.post(SYNC_URL, {"operations": [op]}, format="json")
    assert resp.status_code == 200
    return resp.data["data"]["results"][0]


def _van_qty(distributor, product) -> Decimal:
    return VanStock.objects.get(distributor=distributor, product=product).quantity


# ---------- SEC-101: sync orqali manfiy miqdor ----------

@pytest.mark.django_db
def test_sync_sale_negative_quantity_rejected_and_van_unchanged(auth_api, van_stocked):
    product, client = van_stocked["product"], van_stocked["client"]
    before = _van_qty(van_stocked["distributor"], product)

    result = _sync_sale(auth_api, client, product, quantity="-50", price="27000")

    assert result["status"] == "FAILED"
    assert result["error"]["code"] == "INVALID_QUANTITY"
    assert _van_qty(van_stocked["distributor"], product) == before
    assert not Sale.objects.exists()


@pytest.mark.django_db
def test_sync_sale_negative_price_rejected(auth_api, van_stocked):
    result = _sync_sale(auth_api, van_stocked["client"], van_stocked["product"],
                        quantity="1", price="-1000")
    assert result["error"]["code"] == "INVALID_PRICE"


@pytest.mark.django_db
def test_sync_expense_negative_amount_rejected(auth_api, van_stocked, expense_categories):
    op = {
        "type": "expense", "client_uuid": str(uuid.uuid4()),
        "payload": {"category": str(expense_categories["fuel"].id), "amount": "-45000",
                    "payment_source": "CASH_ON_HAND", "description": "x"},
    }
    resp = auth_api.post(SYNC_URL, {"operations": [op]}, format="json")
    assert resp.data["data"]["results"][0]["error"]["code"] == "INVALID_AMOUNT"


# ---------- SEC-102: chegirma bilan min narxni aylanib o'tish ----------

@pytest.mark.django_db
def test_discount_percent_over_100_rejected(auth_api, van_stocked):
    result = _sync_sale(auth_api, van_stocked["client"], van_stocked["product"],
                        quantity="1", price="27000", discount_percent="150")
    assert result["error"]["code"] == "INVALID_DISCOUNT"


@pytest.mark.django_db
def test_discount_below_min_price_rejected_online(auth_api, van_stocked):
    # min_price=24000; 27000 × (1 − 50%) = 13500 < 24000
    resp = auth_api.post("/api/v1/sales/", {
        "client": str(van_stocked["client"].id), "payment_type": "NAQD",
        "items": [{"product": str(van_stocked["product"].id), "quantity": "1",
                   "price": "27000", "discount_percent": "50"}],
    }, format="json")
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "PRICE_BELOW_MINIMUM"


@pytest.mark.django_db
def test_sale_level_discount_below_min_rejected(auth_api, van_stocked):
    resp = auth_api.post("/api/v1/sales/", {
        "client": str(van_stocked["client"].id), "payment_type": "NAQD",
        "items": [{"product": str(van_stocked["product"].id), "quantity": "2",
                   "price": "27000"}],
        "discount_amount": "50000",
    }, format="json")
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "PRICE_BELOW_MINIMUM"


@pytest.mark.django_db
def test_serializer_rejects_discount_over_100(auth_api, van_stocked):
    resp = auth_api.post("/api/v1/sales/", {
        "client": str(van_stocked["client"].id), "payment_type": "NAQD",
        "items": [{"product": str(van_stocked["product"].id), "quantity": "1",
                   "price": "27000", "discount_percent": "101"}],
    }, format="json")
    assert resp.status_code == 400


# ---------- BE-115: bir mahsulot ikki qatorda ----------

@pytest.mark.django_db
def test_duplicate_lines_checked_against_total_quantity(auth_api, van_stocked):
    product = van_stocked["product"]
    resp = auth_api.post("/api/v1/sales/", {
        "client": str(van_stocked["client"].id), "payment_type": "NAQD",
        "items": [
            {"product": str(product.id), "quantity": "300", "price": "27000"},
            {"product": str(product.id), "quantity": "300", "price": "27000"},
        ],
    }, format="json")
    assert resp.status_code == 409
    assert resp.data["error"]["details"]["requested"] == "600.000"
