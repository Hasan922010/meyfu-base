"""2-bosqich DoD: tovar kirim qilinadi, qoldiq to'g'ri, StockMovement o'chirilmaydi."""
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.core.exceptions import InsufficientStock
from apps.warehouse.constants import MovementType
from apps.warehouse.models import Stock, StockMovement
from apps.warehouse.services import apply_movement, stock_matches_journal


def _purchase_payload(warehouse, supplier, product, qty="100", price="20000"):
    return {
        "supplier": str(supplier.id),
        "warehouse": str(warehouse.id),
        "invoice_number": "INV-001",
        "date": "2026-09-01",
        "items": [
            {"product": str(product.id), "quantity": qty, "cost_price": price}
        ],
    }


@pytest.mark.django_db
def test_purchase_without_invoice_number(manager_api, catalog, warehouse):
    """Nakladnoy raqamisiz ham qabul yaratiladi (ixtiyoriy maydon)."""
    wh, sup, prod = warehouse["warehouse"], warehouse["supplier"], catalog["product"]
    payload = _purchase_payload(wh, sup, prod)
    del payload["invoice_number"]
    resp = manager_api.post("/api/v1/purchases/", payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["data"]["invoice_number"] == ""


@pytest.mark.django_db
def test_purchase_confirm_increases_stock(manager_api, catalog, warehouse):
    wh, sup, prod = warehouse["warehouse"], warehouse["supplier"], catalog["product"]

    created = manager_api.post(
        "/api/v1/purchases/", _purchase_payload(wh, sup, prod), format="json"
    )
    assert created.status_code == 201, created.data
    purchase_id = created.data["data"]["id"]
    assert created.data["data"]["number"].startswith("KIR-2026-")
    assert created.data["data"]["total_amount"] == "2000000.00"

    confirmed = manager_api.post(f"/api/v1/purchases/{purchase_id}/confirm/")
    assert confirmed.status_code == 200, confirmed.data
    assert confirmed.data["data"]["status"] == "CONFIRMED"

    stock = Stock.objects.get(warehouse=wh, product=prod)
    assert stock.quantity == Decimal("100.000")

    mv = StockMovement.objects.get(warehouse=wh, product=prod)
    assert mv.movement_type == MovementType.IN_PURCHASE
    assert mv.quantity == Decimal("100.000")
    assert mv.balance_after == Decimal("100.000")


@pytest.mark.django_db
def test_stock_matches_journal(catalog, warehouse, manager):
    wh, prod = warehouse["warehouse"], catalog["product"]
    apply_movement(warehouse=wh, product=prod, quantity=Decimal("50"),
                   movement_type=MovementType.IN_PURCHASE, user=manager)
    apply_movement(warehouse=wh, product=prod, quantity=Decimal("-20"),
                   movement_type=MovementType.OUT_SALE, user=manager)
    apply_movement(warehouse=wh, product=prod, quantity=Decimal("5"),
                   movement_type=MovementType.IN_RETURN, user=manager)

    stock = Stock.objects.get(warehouse=wh, product=prod)
    assert stock.quantity == Decimal("35.000")
    assert stock_matches_journal(wh, prod) is True


@pytest.mark.django_db
def test_stock_cannot_go_negative(catalog, warehouse, manager):
    wh, prod = warehouse["warehouse"], catalog["product"]
    apply_movement(warehouse=wh, product=prod, quantity=Decimal("10"),
                   movement_type=MovementType.IN_PURCHASE, user=manager)
    with pytest.raises(InsufficientStock):
        apply_movement(warehouse=wh, product=prod, quantity=Decimal("-11"),
                       movement_type=MovementType.OUT_SALE, user=manager)
    # jurnal ham, qoldiq ham o'zgarmagan
    assert Stock.objects.get(warehouse=wh, product=prod).quantity == Decimal("10.000")
    assert StockMovement.objects.filter(warehouse=wh, product=prod).count() == 1


@pytest.mark.django_db
def test_stock_movement_is_append_only(catalog, warehouse, manager):
    wh, prod = warehouse["warehouse"], catalog["product"]
    mv = apply_movement(warehouse=wh, product=prod, quantity=Decimal("10"),
                        movement_type=MovementType.IN_PURCHASE, user=manager)
    mv.quantity = Decimal("999")
    with pytest.raises(ValidationError):
        mv.save()
    with pytest.raises(ValidationError):
        mv.delete()


@pytest.mark.django_db
def test_duplicate_invoice_rejected(manager_api, catalog, warehouse):
    wh, sup, prod = warehouse["warehouse"], warehouse["supplier"], catalog["product"]
    first = manager_api.post(
        "/api/v1/purchases/", _purchase_payload(wh, sup, prod), format="json"
    )
    assert first.status_code == 201
    second = manager_api.post(
        "/api/v1/purchases/", _purchase_payload(wh, sup, prod), format="json"
    )
    assert second.status_code == 400


@pytest.mark.django_db
def test_confirmed_purchase_cannot_be_reconfirmed(manager_api, catalog, warehouse):
    wh, sup, prod = warehouse["warehouse"], warehouse["supplier"], catalog["product"]
    created = manager_api.post(
        "/api/v1/purchases/", _purchase_payload(wh, sup, prod), format="json"
    )
    pid = created.data["data"]["id"]
    manager_api.post(f"/api/v1/purchases/{pid}/confirm/")
    again = manager_api.post(f"/api/v1/purchases/{pid}/confirm/")
    assert again.status_code == 409
    assert again.data["error"]["code"] == "ALREADY_CONFIRMED"


@pytest.mark.django_db
def test_purchase_updates_product_cost_and_price_history(manager_api, catalog, warehouse):
    wh, sup, prod = warehouse["warehouse"], warehouse["supplier"], catalog["product"]
    created = manager_api.post(
        "/api/v1/purchases/",
        _purchase_payload(wh, sup, prod, price="22000"),
        format="json",
    )
    pid = created.data["data"]["id"]
    manager_api.post(f"/api/v1/purchases/{pid}/confirm/")

    prod.refresh_from_db()
    assert prod.cost_price == Decimal("22000.00")
    assert prod.price_history.count() == 1
