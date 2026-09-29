"""Boshlang'ich qoldiqlar — ro'yxatni avtomatik to'ldirish va ommaviy kiritish.

Har bo'lim uchun `opening-sheet` (joriy balanslar ro'yxati) va
`opening-balance/bulk` (yakuniy qoldiq kiritiladi, farqni server hisoblaydi,
hammasi yoki hech biri) endpointlari.
"""
from decimal import Decimal

import pytest

from apps.core.models import AuditLog
from apps.finance.services import get_account
from apps.warehouse.models import Stock, SupplierTransaction
from apps.warehouse.services import stock_matches_journal


def _sheet(api, url: str) -> dict:
    resp = api.get(url)
    assert resp.status_code == 200, resp.data
    return {str(row["id"]): row for row in resp.data["data"]}


# ------------------------------------------------------------------ Tovarlar


@pytest.mark.django_db
def test_stock_sheet_lists_all_active_products(manager_api, stocked):
    from apps.catalog.models import Product

    wh = stocked["warehouse"]
    extra = Product.objects.create(
        name="Sovun", sku="SOAP-1", category=stocked["category"], unit=stocked["unit"],
        cost_price="1000", wholesale_price="1200", retail_price="1500", min_price="1100",
    )

    rows = _sheet(manager_api, f"/api/v1/stock/opening-sheet/?warehouse={wh.id}")

    assert Decimal(rows[str(stocked["product"].id)]["current"]) == Decimal("500")
    assert Decimal(rows[str(extra.id)]["current"]) == Decimal("0")
    assert rows[str(extra.id)]["code"] == "SOAP-1"


@pytest.mark.django_db
def test_stock_bulk_sets_target_quantity(manager_api, stocked):
    wh, product = stocked["warehouse"], stocked["product"]

    resp = manager_api.post(
        "/api/v1/stock/opening-balance/bulk/",
        {"warehouse": str(wh.id), "rows": [{"id": str(product.id), "target": "450"}]},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    assert resp.data["data"] == {"applied": 1, "skipped": 0}
    assert Stock.objects.get(warehouse=wh, product=product).quantity == Decimal("450")
    assert stock_matches_journal(wh, product)


@pytest.mark.django_db
def test_bulk_resubmit_is_idempotent(manager_api, stocked):
    wh, product = stocked["warehouse"], stocked["product"]
    body = {"warehouse": str(wh.id), "rows": [{"id": str(product.id), "target": "450"}]}

    manager_api.post("/api/v1/stock/opening-balance/bulk/", body, format="json")
    resp = manager_api.post("/api/v1/stock/opening-balance/bulk/", body, format="json")

    assert resp.data["data"] == {"applied": 0, "skipped": 1}
    assert Stock.objects.get(warehouse=wh, product=product).quantity == Decimal("450")


@pytest.mark.django_db
def test_stock_bulk_rejects_negative_target(manager_api, stocked):
    resp = manager_api.post(
        "/api/v1/stock/opening-balance/bulk/",
        {
            "warehouse": str(stocked["warehouse"].id),
            "rows": [{"id": str(stocked["product"].id), "target": "-1"}],
        },
        format="json",
    )

    assert resp.status_code == 400


# --------------------------------------------------------------------- Kassa


@pytest.mark.django_db
def test_cash_sheet_and_bulk(admin_api):
    account = get_account()
    rows = _sheet(admin_api, "/api/v1/cash-transactions/opening-sheet/")
    assert Decimal(rows[str(account.id)]["current"]) == Decimal("0")

    resp = admin_api.post(
        "/api/v1/cash-transactions/opening-balance/bulk/",
        {"rows": [{"id": str(account.id), "target": "2500000"}], "note": "Boshlanish"},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    account.refresh_from_db()
    assert account.balance == Decimal("2500000")


@pytest.mark.django_db
def test_cash_bulk_super_admin_only(manager_api):
    resp = manager_api.post(
        "/api/v1/cash-transactions/opening-balance/bulk/",
        {"rows": [{"id": str(get_account().id), "target": "1"}]},
        format="json",
    )

    assert resp.status_code == 403


# ------------------------------------------------------------ Ta'minotchilar


@pytest.mark.django_db
def test_supplier_bulk_is_atomic(admin_api, warehouse):
    from apps.warehouse.models import Supplier

    good = warehouse["supplier"]
    other = Supplier.objects.create(name="Zavod B")

    resp = admin_api.post(
        "/api/v1/suppliers/opening-balance/bulk/",
        {
            "rows": [
                {"id": str(good.id), "target": "300000"},
                {"id": "00000000-0000-0000-0000-000000000000", "target": "1"},
                {"id": str(other.id), "target": "-50000"},
            ]
        },
        format="json",
    )

    assert resp.status_code == 400
    assert not SupplierTransaction.objects.exists()
    good.refresh_from_db()
    assert good.balance == Decimal("0")


@pytest.mark.django_db
def test_supplier_bulk_signed_target(admin_api, warehouse):
    supplier = warehouse["supplier"]
    rows = _sheet(admin_api, "/api/v1/suppliers/opening-sheet/")
    assert str(supplier.id) in rows

    resp = admin_api.post(
        "/api/v1/suppliers/opening-balance/bulk/",
        {"rows": [{"id": str(supplier.id), "target": "-50000"}]},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    supplier.refresh_from_db()
    assert supplier.balance == Decimal("-50000")


# ------------------------------------------------------------------ Mijozlar


@pytest.mark.django_db
def test_client_bulk_adds_opening_debt(manager_api, routed_clients):
    client = routed_clients["my_client"]
    rows = _sheet(manager_api, "/api/v1/clients/opening-sheet/")
    assert Decimal(rows[str(client.id)]["current"]) == Decimal("0")

    resp = manager_api.post(
        "/api/v1/clients/opening-balance/bulk/",
        {"rows": [{"id": str(client.id), "target": "150000"}]},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    client.refresh_from_db()
    assert client.current_debt == Decimal("150000")


@pytest.mark.django_db
def test_client_bulk_rejects_lowering_debt(manager_api, routed_clients):
    from apps.sales.services.debt import create_opening_debt

    client = routed_clients["my_client"]
    create_opening_debt(client=client, amount=Decimal("100000"))

    resp = manager_api.post(
        "/api/v1/clients/opening-balance/bulk/",
        {"rows": [{"id": str(client.id), "target": "40000"}]},
        format="json",
    )

    assert resp.status_code == 400
    client.refresh_from_db()
    assert client.current_debt == Decimal("100000")


# ------------------------------------------------------------------ Xodimlar


@pytest.mark.django_db
def test_wallet_sheet_lists_staff_and_bulk_sets_balance(admin_api, distributor):
    rows = _sheet(admin_api, "/api/v1/wallet/opening-sheet/")
    assert Decimal(rows[str(distributor.id)]["current"]) == Decimal("0")

    resp = admin_api.post(
        "/api/v1/wallet/opening-balance/bulk/",
        {"rows": [{"id": str(distributor.id), "target": "-20000"}]},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    rows = _sheet(admin_api, "/api/v1/wallet/opening-sheet/")
    assert Decimal(rows[str(distributor.id)]["current"]) == Decimal("-20000")
    assert AuditLog.objects.filter(action="opening_balance.bulk.wallet").exists()
