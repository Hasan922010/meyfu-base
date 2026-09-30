"""Filiallar va ko'chirish hujjati (CLAUDE.md 5.1–5.3, 7.8).

Ko'chirish ikki bosqichli: yuborilganda manba ombordan chiqadi (tovar "yo'lda"),
filial qabul qilganda qabul qilingan miqdor kirim bo'ladi. Filial omborchisi
faqat o'z filialini ko'radi.
"""
import re
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core.models import AuditLog
from apps.warehouse.constants import MovementType
from apps.warehouse.models import Stock, StockMovement, Transfer, Warehouse
from apps.warehouse.services import stock_matches_journal

User = get_user_model()
URL = "/api/v1/transfers/"


def _login(phone: str) -> APIClient:
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/login/", {"phone": phone, "password": "pass12345"}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return client


@pytest.fixture
def branch(db):
    return Warehouse.objects.create(name="Samarqand filiali", is_branch=True)


@pytest.fixture
def other_branch(db):
    return Warehouse.objects.create(name="Buxoro filiali", is_branch=True)


@pytest.fixture
def branch_keeper(branch):
    User.objects.create_user(
        phone="+998907300001", password="pass12345", full_name="Filial Omborchi",
        role="WAREHOUSE", warehouse=branch,
    )
    return _login("+998907300001")


@pytest.fixture
def other_keeper(other_branch):
    User.objects.create_user(
        phone="+998907300002", password="pass12345", full_name="Boshqa Omborchi",
        role="WAREHOUSE", warehouse=other_branch,
    )
    return _login("+998907300002")


def _create(api, source, target, product, qty="100") -> dict:
    resp = api.post(
        URL,
        {
            "from_warehouse": str(source.id), "to_warehouse": str(target.id),
            "date": "2026-09-29",
            "items": [{"product": str(product.id), "quantity": qty}],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    return resp.data["data"]


def _receive(api, data: dict, qty: str, note: str = ""):
    item = data["items"][0]
    return api.post(
        f"{URL}{data['id']}/receive/",
        {"items": [{"id": str(item["id"]), "received_quantity": qty}], "note": note},
        format="json",
    )


# ------------------------------------------------------------------ Filial


@pytest.mark.django_db
def test_admin_marks_warehouse_as_branch_with_manager(admin_api, manager):
    resp = admin_api.post(
        "/api/v1/warehouses/",
        {"name": "Andijon filiali", "is_branch": True, "manager": str(manager.id),
         "phone": "+998901234567"},
        format="json",
    )

    assert resp.status_code == 201, resp.data
    assert resp.data["data"]["is_branch"] is True
    assert resp.data["data"]["manager_name"] == manager.full_name


@pytest.mark.django_db
def test_staff_can_be_assigned_to_branch(admin_api, branch):
    resp = admin_api.post(
        "/api/v1/users/",
        {"phone": "+998907300009", "full_name": "Yangi Omborchi", "role": "WAREHOUSE",
         "password": "pass12345", "warehouse": str(branch.id)},
        format="json",
    )

    assert resp.status_code == 201, resp.data
    assert User.objects.get(phone="+998907300009").warehouse == branch
    assert resp.data["data"]["warehouse_name"] == branch.name


# ------------------------------------------------------------------ Ko'chirish


@pytest.mark.django_db
def test_send_moves_stock_out_of_source_only(manager_api, stocked, branch):
    source, product = stocked["warehouse"], stocked["product"]
    data = _create(manager_api, source, branch, product)
    assert re.match(r"KCH-\d{4}-", data["number"])

    resp = manager_api.post(f"{URL}{data['id']}/send/")

    assert resp.status_code == 200, resp.data
    assert resp.data["data"]["status"] == "SENT"
    assert Stock.objects.get(warehouse=source, product=product).quantity == Decimal("400")
    assert not Stock.objects.filter(warehouse=branch, product=product).exists()
    mv = StockMovement.objects.get(movement_type=MovementType.TRANSFER)
    assert mv.quantity == Decimal("-100")
    assert mv.reference_type == "transfer"
    assert stock_matches_journal(source, product)


@pytest.mark.django_db
def test_send_rejects_insufficient_stock(manager_api, stocked, branch):
    data = _create(manager_api, stocked["warehouse"], branch, stocked["product"], "900")

    resp = manager_api.post(f"{URL}{data['id']}/send/")

    assert resp.status_code == 409
    assert Transfer.objects.get(pk=data["id"]).status == "DRAFT"


@pytest.mark.django_db
def test_same_source_and_target_rejected(manager_api, stocked):
    wh = stocked["warehouse"]
    resp = manager_api.post(
        URL,
        {"from_warehouse": str(wh.id), "to_warehouse": str(wh.id), "date": "2026-09-29",
         "items": [{"product": str(stocked["product"].id), "quantity": "1"}]},
        format="json",
    )

    assert resp.status_code == 400


@pytest.mark.django_db
def test_branch_keeper_receives_full_quantity(
    manager_api, branch_keeper, stocked, branch
):
    product = stocked["product"]
    data = _create(manager_api, stocked["warehouse"], branch, product)
    manager_api.post(f"{URL}{data['id']}/send/")

    resp = _receive(branch_keeper, data, "100")

    assert resp.status_code == 200, resp.data
    assert resp.data["data"]["status"] == "RECEIVED"
    assert Stock.objects.get(warehouse=branch, product=product).quantity == Decimal("100")
    assert stock_matches_journal(branch, product)
    assert AuditLog.objects.filter(action="transfer.receive").exists()


@pytest.mark.django_db
def test_partial_receive_requires_note_and_keeps_difference(
    manager_api, branch_keeper, stocked, branch
):
    product = stocked["product"]
    data = _create(manager_api, stocked["warehouse"], branch, product)
    manager_api.post(f"{URL}{data['id']}/send/")

    without_note = _receive(branch_keeper, data, "95")
    with_note = _receive(branch_keeper, data, "95", note="5 dona yo'lda shikastlangan")

    assert without_note.status_code == 400
    assert with_note.status_code == 200, with_note.data
    assert Stock.objects.get(warehouse=branch, product=product).quantity == Decimal("95")
    item = with_note.data["data"]["items"][0]
    assert Decimal(item["difference"]) == Decimal("-5")


@pytest.mark.django_db
def test_receive_cannot_exceed_sent(manager_api, branch_keeper, stocked, branch):
    data = _create(manager_api, stocked["warehouse"], branch, stocked["product"])
    manager_api.post(f"{URL}{data['id']}/send/")

    resp = _receive(branch_keeper, data, "101", note="ko'p")

    assert resp.status_code == 400


@pytest.mark.django_db
def test_receive_only_once(manager_api, branch_keeper, stocked, branch):
    data = _create(manager_api, stocked["warehouse"], branch, stocked["product"])
    manager_api.post(f"{URL}{data['id']}/send/")
    _receive(branch_keeper, data, "100")

    again = _receive(branch_keeper, data, "100")

    assert again.status_code == 409
    assert again.data["error"]["code"] == "TRANSFER_NOT_SENT"


@pytest.mark.django_db
def test_cancel_sent_returns_stock_to_source(manager_api, stocked, branch):
    source, product = stocked["warehouse"], stocked["product"]
    data = _create(manager_api, source, branch, product)
    manager_api.post(f"{URL}{data['id']}/send/")

    resp = manager_api.post(f"{URL}{data['id']}/cancel/")

    assert resp.status_code == 200, resp.data
    assert resp.data["data"]["status"] == "CANCELLED"
    assert Stock.objects.get(warehouse=source, product=product).quantity == Decimal("500")
    assert stock_matches_journal(source, product)


@pytest.mark.django_db
def test_received_transfer_cannot_be_cancelled(
    manager_api, branch_keeper, stocked, branch
):
    data = _create(manager_api, stocked["warehouse"], branch, stocked["product"])
    manager_api.post(f"{URL}{data['id']}/send/")
    _receive(branch_keeper, data, "100")

    resp = manager_api.post(f"{URL}{data['id']}/cancel/")

    assert resp.status_code == 409


# ------------------------------------------------------------------ Ruxsatlar


@pytest.mark.django_db
def test_other_branch_keeper_cannot_see_or_receive(
    manager_api, other_keeper, stocked, branch
):
    data = _create(manager_api, stocked["warehouse"], branch, stocked["product"])
    manager_api.post(f"{URL}{data['id']}/send/")

    listed = other_keeper.get(URL)
    received = _receive(other_keeper, data, "100")

    assert listed.data["data"]["count"] == 0
    assert received.status_code == 404


@pytest.mark.django_db
def test_branch_keeper_sees_only_own_branch_stock(branch_keeper, stocked, branch):
    resp = branch_keeper.get("/api/v1/stock/")

    assert resp.data["data"]["count"] == 0


@pytest.mark.django_db
def test_branch_keeper_cannot_send_from_other_warehouse(branch_keeper, stocked, branch):
    resp = branch_keeper.post(
        URL,
        {"from_warehouse": str(stocked["warehouse"].id), "to_warehouse": str(branch.id),
         "date": "2026-09-29",
         "items": [{"product": str(stocked["product"].id), "quantity": "1"}]},
        format="json",
    )

    assert resp.status_code == 400


@pytest.mark.django_db
def test_distributor_has_no_access_to_transfers(auth_api):
    assert auth_api.get(URL).status_code == 403
