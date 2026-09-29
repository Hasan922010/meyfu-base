"""Inventarizatsiya hujjati (CLAUDE.md 5.1–5.3, 7.8).

Hujjat ombordagi barcha tovarlar bilan avtomatik to'ldiriladi, haqiqiy qoldiq
kiritiladi, tasdiqlanganda farq append-only `ADJUSTMENT` harakati bilan yoziladi.
"""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core.models import AuditLog
from apps.warehouse.constants import MovementType
from apps.warehouse.models import InventoryCount, Stock, StockMovement
from apps.warehouse.services import apply_movement, stock_matches_journal

URL = "/api/v1/inventory-counts/"


@pytest.fixture
def product(stocked):
    """Omborda 500 dona bor mahsulot."""
    return stocked["product"]


@pytest.fixture
def second_product(catalog):
    from apps.catalog.models import Product

    return Product.objects.create(
        name="Test gel 1L", sku="GEL-1L", category=catalog["category"],
        unit=catalog["unit"], cost_price="15000", wholesale_price="18000",
        retail_price="20000", min_price="17000",
    )


@pytest.fixture
def warehouse_api(db):
    get_user_model().objects.create_user(
        phone="+998905554433", password="pass12345", full_name="Test Omborchi",
        role="WAREHOUSE",
    )
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/login/", {"phone": "+998905554433", "password": "pass12345"},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return client


def _create(api, warehouse) -> dict:
    resp = api.post(
        URL, {"warehouse": str(warehouse.id), "date": "2026-09-29"}, format="json"
    )
    assert resp.status_code == 201, resp.data
    return resp.data["data"]


def _item(data: dict, product) -> dict:
    return next(row for row in data["items"] if str(row["product"]) == str(product.id))


def _set_actual(api, count_id: str, rows: list[tuple[str, str | None]]):
    return api.patch(
        f"{URL}{count_id}/items/",
        {"items": [{"id": item_id, "actual_qty": qty} for item_id, qty in rows]},
        format="json",
    )


@pytest.mark.django_db
def test_create_autofills_all_active_products_with_live_stock(
    manager_api, product, second_product, warehouse
):
    data = _create(manager_api, warehouse["warehouse"])

    assert data["number"].startswith("INV-2026-")
    assert data["status"] == "DRAFT"
    assert {str(row["product"]) for row in data["items"]} == {
        str(product.id), str(second_product.id)
    }
    assert Decimal(_item(data, product)["expected_qty"]) == Decimal("500")
    # Omborda qatori yo'q tovar ham 0 bilan chiqadi
    assert Decimal(_item(data, second_product)["expected_qty"]) == Decimal("0")
    assert _item(data, product)["actual_qty"] is None


@pytest.mark.django_db
def test_confirm_writes_adjustment_for_difference_only(
    manager_api, product, second_product, warehouse
):
    wh = warehouse["warehouse"]
    data = _create(manager_api, wh)
    resp = _set_actual(
        manager_api, data["id"],
        [(_item(data, product)["id"], "480"), (_item(data, second_product)["id"], "0")],
    )
    assert resp.status_code == 200, resp.data

    resp = manager_api.post(f"{URL}{data['id']}/confirm/")
    assert resp.status_code == 200, resp.data
    assert resp.data["data"]["status"] == "CONFIRMED"

    assert Stock.objects.get(warehouse=wh, product=product).quantity == Decimal("480")
    adjustments = StockMovement.objects.filter(movement_type=MovementType.ADJUSTMENT)
    # second_product: 0 == 0 — farq yo'q, harakat yozilmaydi
    assert adjustments.count() == 1
    mv = adjustments.get()
    assert mv.quantity == Decimal("-20")
    assert mv.reference_type == "inventory"
    assert mv.reference_id == str(data["id"])
    assert stock_matches_journal(wh, product)


@pytest.mark.django_db
def test_confirm_surplus_creates_stock_row(manager_api, second_product, warehouse):
    wh = warehouse["warehouse"]
    data = _create(manager_api, wh)
    _set_actual(manager_api, data["id"], [(_item(data, second_product)["id"], "12")])

    resp = manager_api.post(f"{URL}{data['id']}/confirm/")

    assert resp.status_code == 200, resp.data
    stock = Stock.objects.get(warehouse=wh, product=second_product)
    assert stock.quantity == Decimal("12")


@pytest.mark.django_db
def test_uncounted_rows_are_skipped(manager_api, product, second_product, warehouse):
    wh = warehouse["warehouse"]
    data = _create(manager_api, wh)
    _set_actual(manager_api, data["id"], [(_item(data, second_product)["id"], "3")])

    resp = manager_api.post(f"{URL}{data['id']}/confirm/")

    assert resp.status_code == 200, resp.data
    # product sanalmagan — qoldig'i o'zgarmaydi
    assert Stock.objects.get(warehouse=wh, product=product).quantity == Decimal("500")


@pytest.mark.django_db
def test_confirm_without_counted_rows_is_rejected(manager_api, product, warehouse):
    data = _create(manager_api, warehouse["warehouse"])

    resp = manager_api.post(f"{URL}{data['id']}/confirm/")

    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "EMPTY_INVENTORY"


@pytest.mark.django_db
def test_confirm_rejects_stale_stock_then_fill_refreshes(
    manager_api, manager, product, warehouse
):
    wh = warehouse["warehouse"]
    data = _create(manager_api, wh)
    _set_actual(manager_api, data["id"], [(_item(data, product)["id"], "480")])
    # Sanash davomida 30 dona chiqib ketdi
    apply_movement(
        warehouse=wh, product=product, quantity=Decimal("-30"),
        movement_type=MovementType.OUT_LOADING, user=manager,
    )

    resp = manager_api.post(f"{URL}{data['id']}/confirm/")
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "STALE_STOCK"
    assert Stock.objects.get(warehouse=wh, product=product).quantity == Decimal("470")

    resp = manager_api.post(f"{URL}{data['id']}/fill/")
    assert resp.status_code == 200, resp.data
    refreshed = _item(resp.data["data"], product)
    assert Decimal(refreshed["expected_qty"]) == Decimal("470")
    # Kiritilgan haqiqiy qoldiq saqlanib qoladi
    assert Decimal(refreshed["actual_qty"]) == Decimal("480")

    resp = manager_api.post(f"{URL}{data['id']}/confirm/")
    assert resp.status_code == 200, resp.data
    assert Stock.objects.get(warehouse=wh, product=product).quantity == Decimal("480")


@pytest.mark.django_db
def test_confirmed_inventory_is_locked(manager_api, product, warehouse):
    data = _create(manager_api, warehouse["warehouse"])
    item_id = _item(data, product)["id"]
    _set_actual(manager_api, data["id"], [(item_id, "490")])
    manager_api.post(f"{URL}{data['id']}/confirm/")

    again = manager_api.post(f"{URL}{data['id']}/confirm/")
    edit = _set_actual(manager_api, data["id"], [(item_id, "1")])

    assert again.status_code == 409
    assert again.data["error"]["code"] == "ALREADY_CONFIRMED"
    assert edit.status_code == 409
    adjustments = StockMovement.objects.filter(movement_type=MovementType.ADJUSTMENT)
    assert adjustments.count() == 1


@pytest.mark.django_db
def test_negative_actual_qty_rejected(manager_api, product, warehouse):
    data = _create(manager_api, warehouse["warehouse"])

    resp = _set_actual(manager_api, data["id"], [(_item(data, product)["id"], "-1")])

    assert resp.status_code == 400


@pytest.mark.django_db
def test_items_from_other_count_rejected(manager_api, product, warehouse):
    first = _create(manager_api, warehouse["warehouse"])
    second = _create(manager_api, warehouse["warehouse"])

    resp = _set_actual(manager_api, second["id"], [(_item(first, product)["id"], "1")])

    assert resp.status_code == 400


@pytest.mark.django_db
def test_confirm_writes_audit_log(manager_api, product, warehouse):
    data = _create(manager_api, warehouse["warehouse"])
    _set_actual(manager_api, data["id"], [(_item(data, product)["id"], "505")])

    manager_api.post(f"{URL}{data['id']}/confirm/")

    log = AuditLog.objects.get(action="inventory.confirm", object_id=str(data["id"]))
    assert Decimal(log.changes["adjustments"][0]["delta"]) == Decimal("5")


@pytest.mark.django_db
def test_cancel_draft(manager_api, product, warehouse):
    data = _create(manager_api, warehouse["warehouse"])

    resp = manager_api.post(f"{URL}{data['id']}/cancel/")

    assert resp.status_code == 200, resp.data
    assert InventoryCount.objects.get(pk=data["id"]).status == "CANCELLED"


@pytest.mark.django_db
def test_warehouse_role_counts_but_cannot_confirm(warehouse_api, product, warehouse):
    data = _create(warehouse_api, warehouse["warehouse"])

    edit = _set_actual(warehouse_api, data["id"], [(_item(data, product)["id"], "499")])
    confirm = warehouse_api.post(f"{URL}{data['id']}/confirm/")

    assert edit.status_code == 200, edit.data
    assert confirm.status_code == 403


@pytest.mark.django_db
def test_distributor_has_no_access(auth_api, warehouse):
    assert auth_api.get(URL).status_code == 403


@pytest.mark.django_db
def test_list_shows_summary(manager_api, product, second_product, warehouse):
    data = _create(manager_api, warehouse["warehouse"])
    _set_actual(manager_api, data["id"], [(_item(data, product)["id"], "490")])

    resp = manager_api.get(URL)

    row = resp.data["data"]["results"][0]
    assert row["items_count"] == 2
    assert row["counted_count"] == 1
    # 10 dona × 20 000 tannarx
    assert Decimal(row["difference_amount"]) == Decimal("-200000")


@pytest.mark.django_db
def test_draft_date_cannot_move_to_another_year(manager_api, product, warehouse):
    data = _create(manager_api, warehouse["warehouse"])

    url = f"{URL}{data['id']}/"

    other_year = manager_api.patch(url, {"date": "2027-01-02"}, format="json")
    same_year = manager_api.patch(url, {"date": "2026-09-30"}, format="json")

    assert other_year.status_code == 400
    assert same_year.status_code == 200, same_year.data


@pytest.mark.django_db
def test_admin_cannot_delete_confirmed_inventory(
    manager_api, admin_user, product, warehouse
):
    from django.contrib.admin.sites import site
    from django.test import RequestFactory

    draft = _create(manager_api, warehouse["warehouse"])
    confirmed = _create(manager_api, warehouse["warehouse"])
    item_id = _item(confirmed, product)["id"]
    _set_actual(manager_api, confirmed["id"], [(item_id, "499")])
    manager_api.post(f"{URL}{confirmed['id']}/confirm/")
    model_admin = site._registry[InventoryCount]
    request = RequestFactory().get("/")
    request.user = admin_user

    draft_obj = InventoryCount.objects.get(pk=draft["id"])
    confirmed_obj = InventoryCount.objects.get(pk=confirmed["id"])

    assert model_admin.has_delete_permission(request, draft_obj)
    assert not model_admin.has_delete_permission(request, confirmed_obj)
    # Ro'yxatdagi ommaviy o'chirish tasdiqlanganlarni ham qamrab olardi
    assert not model_admin.has_delete_permission(request)
