"""Filial hisoboti — kartalar, batafsil faoliyat va hujjatlar (Filiallar bo'limi)."""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.warehouse.models import Warehouse

User = get_user_model()
BASE = "/api/v1/reports/branches/"
PERIOD = "?preset=custom&date_from=2020-01-01&date_to=2099-12-31"


@pytest.fixture
def branch(db):
    return Warehouse.objects.create(name="Samarqand filiali", is_branch=True)


def _card(data: dict, kind: str) -> dict:
    return next(c for c in data["cards"] if c["kind"] == kind)


def _transfer(api, source, target, product, qty="100") -> dict:
    resp = api.post(
        "/api/v1/transfers/",
        {"from_warehouse": str(source.id), "to_warehouse": str(target.id),
         "date": "2026-09-29", "items": [{"product": str(product.id), "quantity": qty}]},
        format="json",
    )
    data = resp.data["data"]
    api.post(f"/api/v1/transfers/{data['id']}/send/")
    return data


def _receive(api, data: dict, qty: str, note: str = "") -> None:
    api.post(
        f"/api/v1/transfers/{data['id']}/receive/",
        {"items": [{"id": str(data["items"][0]["id"]), "received_quantity": qty}],
         "note": note},
        format="json",
    )


@pytest.mark.django_db
def test_in_transit_card_before_receive(manager_api, stocked, branch):
    _transfer(manager_api, stocked["warehouse"], branch, stocked["product"])

    resp = manager_api.get(f"{BASE}{branch.id}/cards/{PERIOD}")

    assert resp.status_code == 200, resp.data
    transit = _card(resp.data["data"], "in_transit")
    assert transit["count"] == 1
    assert Decimal(transit["quantity"]) == Decimal("100")


@pytest.mark.django_db
def test_cards_after_receive(manager_api, stocked, branch):
    data = _transfer(manager_api, stocked["warehouse"], branch, stocked["product"])
    _receive(manager_api, data, "95", note="5 dona shikast")

    branch_cards = manager_api.get(f"{BASE}{branch.id}/cards/{PERIOD}").data["data"]
    main_cards = manager_api.get(
        f"{BASE}{stocked['warehouse'].id}/cards/{PERIOD}"
    ).data["data"]

    incoming = _card(branch_cards, "transfers_in")
    assert incoming["count"] == 1
    assert Decimal(incoming["quantity"]) == Decimal("95")
    # 95 dona × 20 000 tannarx
    assert Decimal(incoming["amount"]) == Decimal("1900000")
    assert Decimal(_card(branch_cards, "stock")["quantity"]) == Decimal("95")
    assert _card(branch_cards, "in_transit")["count"] == 0
    assert Decimal(_card(main_cards, "transfers_out")["quantity"]) == Decimal("-100")
    assert Decimal(_card(main_cards, "purchases")["quantity"]) == Decimal("500")


@pytest.mark.django_db
def test_activity_rows_link_documents(manager_api, stocked, branch):
    data = _transfer(manager_api, stocked["warehouse"], branch, stocked["product"])
    _receive(manager_api, data, "100")

    resp = manager_api.get(f"{BASE}{branch.id}/activity/{PERIOD}&kind=transfers_in")

    assert resp.status_code == 200, resp.data
    rows = resp.data["data"]["rows"]
    assert len(rows) == 1
    assert rows[0]["document"]["type"] == "transfer"
    assert rows[0]["document"]["number"] == data["number"]
    assert str(rows[0]["document"]["id"]) == str(data["id"])
    assert rows[0]["product_name"] == stocked["product"].name


@pytest.mark.django_db
def test_stock_activity_lists_current_stock(manager_api, stocked):
    resp = manager_api.get(f"{BASE}{stocked['warehouse'].id}/activity/?kind=stock")

    rows = resp.data["data"]["rows"]
    assert len(rows) == 1
    assert Decimal(rows[0]["quantity"]) == Decimal("500")
    assert Decimal(rows[0]["amount"]) == Decimal("10000000")


@pytest.mark.django_db
def test_unknown_kind_rejected(manager_api, stocked):
    resp = manager_api.get(f"{BASE}{stocked['warehouse'].id}/activity/?kind=nimadir")

    assert resp.status_code == 400


@pytest.mark.django_db
def test_branch_list_shows_stock_value(manager_api, stocked, branch):
    resp = manager_api.get(BASE)

    assert resp.status_code == 200
    rows = {r["name"]: r for r in resp.data["data"]}
    assert Decimal(rows["Markaziy ombor"]["stock_amount"]) == Decimal("10000000")
    assert rows["Samarqand filiali"]["is_branch"] is True


@pytest.mark.django_db
def test_export_activity_to_excel(manager_api, stocked):
    resp = manager_api.get(
        f"/api/v1/reports/export/?type=branch&branch={stocked['warehouse'].id}"
        f"&kind=purchases&preset=year&fmt=xlsx"
    )

    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("application/vnd.openxmlformats")


@pytest.mark.django_db
def test_branch_keeper_sees_only_own_branch(stocked, branch):
    User.objects.create_user(
        phone="+998907300011", password="pass12345", full_name="Filial Omborchi",
        role="WAREHOUSE", warehouse=branch,
    )
    api = APIClient()
    token = api.post(
        "/api/v1/auth/login/", {"phone": "+998907300011", "password": "pass12345"},
        format="json",
    ).data["data"]["access"]
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    own = api.get(f"{BASE}{branch.id}/cards/")
    other = api.get(f"{BASE}{stocked['warehouse'].id}/cards/")
    listed = api.get(BASE)

    assert own.status_code == 200
    assert other.status_code == 404
    assert [r["name"] for r in listed.data["data"]] == ["Samarqand filiali"]


@pytest.mark.django_db
def test_distributor_cannot_open_branch_reports(auth_api, stocked):
    assert auth_api.get(BASE).status_code == 403


@pytest.mark.django_db
def test_activity_query_count_does_not_grow_with_rows(
    manager_api, manager, stocked, django_assert_max_num_queries
):
    from apps.warehouse.constants import MovementType
    from apps.warehouse.services import apply_movement

    wh = stocked["warehouse"]
    for _ in range(30):
        apply_movement(
            warehouse=wh, product=stocked["product"], quantity=Decimal("1"),
            movement_type=MovementType.IN_PURCHASE, user=manager,
        )

    with django_assert_max_num_queries(12):
        resp = manager_api.get(f"{BASE}{wh.id}/activity/{PERIOD}&kind=purchases")

    assert len(resp.data["data"]["rows"]) == 31
