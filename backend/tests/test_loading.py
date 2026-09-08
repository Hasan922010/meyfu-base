"""4-bosqich: Yuklash → mobil tasdiqlash → VanStock. Atomik + testlar."""
from decimal import Decimal

import pytest

from apps.core.exceptions import InsufficientStock
from apps.warehouse.constants import MovementType
from apps.warehouse.models import Loading, Stock, StockMovement, VanStock
from apps.warehouse.services import (
    confirm_loading,
    send_loading,
    stock_matches_journal,
    van_matches_loadings,
)


def _loading_payload(distributor, warehouse, product, qty="100"):
    return {
        "date": "2026-09-06",
        "distributor": str(distributor.id),
        "warehouse": str(warehouse.id),
        "items": [{"product": str(product.id), "quantity": qty, "price": "25000"}],
    }


def _make_loading(distributor, warehouse, product, qty="100"):
    from django.utils import timezone

    loading = Loading.objects.create(
        date=timezone.localdate(), distributor=distributor, warehouse=warehouse,
    )
    from apps.warehouse.models import LoadingItem

    LoadingItem.objects.create(
        loading=loading, product=product, quantity=Decimal(qty), price=Decimal("25000"),
        amount=Decimal(qty) * Decimal("25000"),
    )
    from apps.warehouse.services.loading import assign_number

    assign_number(loading)
    loading.recalc_total()
    loading.save()
    return loading


@pytest.mark.django_db
def test_warehouse_creates_and_sends_loading(manager_api, stocked, distributor):
    wh, prod = stocked["warehouse"], stocked["product"]
    created = manager_api.post(
        "/api/v1/loadings/", _loading_payload(distributor, wh, prod), format="json"
    )
    assert created.status_code == 201, created.data
    lid = created.data["data"]["id"]
    assert created.data["data"]["number"].startswith("YK-2026-")
    assert created.data["data"]["total_amount"] == "2500000.00"

    sent = manager_api.post(f"/api/v1/loadings/{lid}/send/")
    assert sent.status_code == 200
    assert sent.data["data"]["status"] == "SENT"

    stock = Stock.objects.get(warehouse=wh, product=prod)
    assert stock.quantity == Decimal("500.000")
    assert stock.reserved_quantity == Decimal("100.000")
    assert stock.available_quantity == Decimal("400.000")


@pytest.mark.django_db
def test_send_insufficient_stock_rejected(manager_api, stocked, distributor):
    wh, prod = stocked["warehouse"], stocked["product"]
    loading = _make_loading(distributor, wh, prod, qty="600")
    with pytest.raises(InsufficientStock):
        send_loading(loading)
    assert Stock.objects.get(warehouse=wh, product=prod).reserved_quantity == Decimal("0")


@pytest.mark.django_db
def test_distributor_confirms_loading(auth_api, stocked, distributor):
    wh, prod = stocked["warehouse"], stocked["product"]
    loading = _make_loading(distributor, wh, prod)
    send_loading(loading)

    resp = auth_api.post(f"/api/v1/loadings/{loading.id}/confirm/")
    assert resp.status_code == 200, resp.data
    assert resp.data["data"]["status"] == "CONFIRMED"

    stock = Stock.objects.get(warehouse=wh, product=prod)
    assert stock.quantity == Decimal("400.000")
    assert stock.reserved_quantity == Decimal("0.000")

    van = VanStock.objects.get(distributor=distributor, product=prod)
    assert van.quantity == Decimal("100.000")

    mv = StockMovement.objects.get(
        warehouse=wh, product=prod, movement_type=MovementType.OUT_LOADING
    )
    assert mv.quantity == Decimal("-100.000")
    assert mv.balance_after == Decimal("400.000")
    assert mv.reference_type == "loading"

    assert stock_matches_journal(wh, prod) is True
    assert van_matches_loadings(distributor, prod) is True


@pytest.mark.django_db
def test_foreign_distributor_cannot_confirm(stocked, distributor, routed_clients):
    wh, prod = stocked["warehouse"], stocked["product"]
    loading = _make_loading(distributor, wh, prod)
    send_loading(loading)

    from tests.conftest import _bearer

    other = _bearer("+998905554433")  # routed_clients.other_distributor
    resp = other.post(f"/api/v1/loadings/{loading.id}/confirm/")
    assert resp.status_code in (403, 404)  # ko'rish doirasidan tashqarida


@pytest.mark.django_db
def test_confirm_requires_sent_status(stocked, distributor):
    wh, prod = stocked["warehouse"], stocked["product"]
    loading = _make_loading(distributor, wh, prod)  # DRAFT
    from apps.core.exceptions import BusinessError

    with pytest.raises(BusinessError):
        confirm_loading(loading)


@pytest.mark.django_db
def test_cancel_sent_loading_releases_reservation(manager_api, stocked, distributor):
    wh, prod = stocked["warehouse"], stocked["product"]
    loading = _make_loading(distributor, wh, prod)
    send_loading(loading)
    stock = Stock.objects.get(warehouse=wh, product=prod)
    assert stock.reserved_quantity == Decimal("100.000")

    resp = manager_api.post(f"/api/v1/loadings/{loading.id}/cancel/")
    assert resp.status_code == 200
    loading.refresh_from_db()
    assert loading.status == "DRAFT"
    stock.refresh_from_db()
    assert stock.reserved_quantity == Decimal("0.000")


@pytest.mark.django_db
def test_van_stock_my_and_my_today(auth_api, stocked, distributor):
    wh, prod = stocked["warehouse"], stocked["product"]
    loading = _make_loading(distributor, wh, prod)
    send_loading(loading)
    confirm_loading(loading, user=distributor)

    van = auth_api.get("/api/v1/van-stock/my/")
    assert van.status_code == 200
    assert van.data["data"][0]["quantity"] == "100.000"
    assert van.data["data"][0]["product_sku"] == "PWD-3KG"

    today = auth_api.get("/api/v1/loadings/my-today/")
    assert today.status_code == 200
    assert len(today.data["data"]) == 1


@pytest.mark.django_db
def test_distributor_sees_only_own_loadings(
    auth_api, stocked, distributor, routed_clients
):
    wh, prod = stocked["warehouse"], stocked["product"]
    _make_loading(distributor, wh, prod)
    _make_loading(routed_clients["other_distributor"], wh, prod)

    resp = auth_api.get("/api/v1/loadings/")
    assert resp.data["data"]["count"] == 1
