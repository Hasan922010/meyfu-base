"""Mijozlar boshlang'ich qarzi + bazada yo'q mijozlarni Excel'dan import qilish testlari."""
from __future__ import annotations

import io
import json
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook, load_workbook

from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.sales.models import Debt

TEMPLATE_URL = "/api/v1/clients/opening-import-template/"
IMPORT_URL = "/api/v1/clients/opening-balance/import/"


def _xlsx(rows: list[list], name: str = "clients.xlsx") -> SimpleUploadedFile:
    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return SimpleUploadedFile(
        name,
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@pytest.mark.django_db
def test_client_opening_import_template_and_inspect(manager_api):
    tpl = manager_api.get(TEMPLATE_URL)
    assert tpl.status_code == 200
    assert tpl["Content-Type"].startswith("application/vnd.openxml")
    wb = load_workbook(io.BytesIO(tpl.content))
    headers = list(next(wb.active.iter_rows(values_only=True)))
    assert "do'kon nomi" in headers
    assert "xodim" in headers
    assert "boshlang'ich qarz" in headers

    # Tartibsiz/boshqa nomli ustunlar bilan fayl inspect
    file = _xlsx([
        ["Summa", "Kimga tegishli", "Magazin", "Tel"],
        [1500000, "Test Tarqatuvchi", "Yangi Market", "+998901234567"],
    ])
    resp = manager_api.post(
        IMPORT_URL,
        {"file": file, "mode": "inspect"},
        format="multipart",
    )
    assert resp.status_code == 200, resp.data
    data = resp.json()["data"]
    assert data["total_rows"] == 1
    assert data["headers"] == ["Summa", "Kimga tegishli", "Magazin", "Tel"]
    assert data["auto_mapping"]["amount"] == 0
    assert data["auto_mapping"]["phone"] == 3


@pytest.mark.django_db
def test_client_opening_import_auto_creates_missing_clients_and_maps_columns(
    manager_api, distributor, routed_clients
):
    existing = routed_clients["my_client"]  # Do'kon A, current_debt = 0, phone=+998911112233
    other = routed_clients["other_distributor"]

    rows = [
        # Maxsus ustun tartibi: [Qarz, Xodim, Mijoz, Tel, Manzil, Izoh]
        ["Kolonna A", "Kolonna B", "Kolonna C", "Kolonna D", "Kolonna E", "Kolonna F"],
        [750000, distributor.full_name, "Yangi Omad", "90 777 11 22", "Chilonzor 9", "2026 qarz"],
        [0, other.phone, "Qarzsiz Yangi", "", "Yunusobod", ""],
        [250000, "", "Do'kon A", "+998911112233", "", "Avvalgi qarz"],
    ]
    mapping = json.dumps({
        "amount": 0,
        "assigned_to": 1,
        "name": 2,
        "phone": 3,
        "address": 4,
        "note": 5,
    })

    # 1. dry_run=true -> hech narsa yozilmaydi
    dry = manager_api.post(
        IMPORT_URL,
        {
            "file": _xlsx(rows),
            "mapping": mapping,
            "auto_create_missing": "true",
            "dry_run": "true",
        },
        format="multipart",
    )
    assert dry.status_code == 200, dry.data
    dry_data = dry.json()["data"]
    assert dry_data["errors"] == 0, dry_data
    assert dry_data["created_clients"] == 2
    assert dry_data["existing_clients"] == 1
    assert dry_data["debts_applied"] == 2
    assert not Client.objects.filter(name="Yangi Omad").exists()

    # 2. dry_run=false -> yaratiladi va qarz yoziladi
    apply_resp = manager_api.post(
        IMPORT_URL,
        {
            "file": _xlsx(rows),
            "mapping": mapping,
            "default_assigned_to": str(distributor.id),
            "auto_create_missing": "true",
            "dry_run": "false",
        },
        format="multipart",
    )
    assert apply_resp.status_code == 200, apply_resp.data
    apply_data = apply_resp.json()["data"]
    assert apply_data["errors"] == 0
    assert apply_data["created_clients"] == 2
    assert apply_data["debts_applied"] == 2

    yangi = Client.objects.get(name="Yangi Omad")
    assert yangi.assigned_to_id == distributor.id
    assert yangi.phone == "+998907771122"
    assert yangi.address == "Chilonzor 9"
    assert yangi.current_debt == Decimal("750000.00")
    assert Debt.objects.filter(client=yangi, sale__isnull=True, amount=Decimal("750000")).exists()

    qarzsiz = Client.objects.get(name="Qarzsiz Yangi")
    assert qarzsiz.assigned_to_id == other.id
    assert qarzsiz.current_debt == Decimal("0.00")
    assert not Debt.objects.filter(client=qarzsiz).exists()

    existing.refresh_from_db()
    assert existing.current_debt == Decimal("250000.00")
    assert AuditLog.objects.filter(action="client.opening_import").exists()


@pytest.mark.django_db
def test_client_opening_import_rejects_errors_and_rolls_back(
    manager_api, distributor, routed_clients
):
    existing = routed_clients["my_client"]
    existing.current_debt = Decimal("300000")
    existing.save(update_fields=["current_debt"])

    rows = [
        ["Do'kon", "Xodim", "Qarz"],
        ["Yaxshi Yangi", distributor.full_name, 100000],
        ["Do'kon A", "", 100000],  # 100k < 300k -> xato!
        ["Xodim Xato", "Bunday Xodim Yo'q", 50000],
    ]
    mapping = json.dumps({"name": 0, "assigned_to": 1, "amount": 2})

    resp = manager_api.post(
        IMPORT_URL,
        {
            "file": _xlsx(rows),
            "mapping": mapping,
            "auto_create_missing": "true",
            "dry_run": "false",
        },
        format="multipart",
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["errors"] == 2
    assert not Client.objects.filter(name="Yaxshi Yangi").exists()
    existing.refresh_from_db()
    assert existing.current_debt == Decimal("300000.00")


@pytest.mark.django_db
def test_client_opening_import_missing_not_auto_created_when_disabled(manager_api):
    rows = [
        ["Do'kon", "Qarz"],
        ["Yo'q Do'kon", 100000],
    ]
    mapping = json.dumps({"name": 0, "amount": 1})
    resp = manager_api.post(
        IMPORT_URL,
        {
            "file": _xlsx(rows),
            "mapping": mapping,
            "auto_create_missing": "false",
            "dry_run": "true",
        },
        format="multipart",
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["errors"] == 1


@pytest.mark.django_db
def test_client_opening_import_forbidden_for_distributor(auth_api):
    resp = auth_api.post(
        IMPORT_URL,
        {"file": _xlsx([["Do'kon", "Qarz"]]), "mode": "inspect"},
        format="multipart",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_client_opening_import_branch_manager_isolation():
    from rest_framework.test import APIClient
    from apps.users.models import User
    from apps.warehouse.models import Warehouse

    branch_a = Warehouse.objects.create(name="Filial A", is_branch=True)
    branch_b = Warehouse.objects.create(name="Filial B", is_branch=True)
    mgr_a = User.objects.create_user(
        phone="+998901001122", password="p", full_name="Filial A Rahbar", role="BRANCH_MANAGER", warehouse=branch_a
    )
    dist_a = User.objects.create_user(
        phone="+998901003344", password="p", full_name="Agent A", role="DISTRIBUTOR", warehouse=branch_a
    )
    dist_b = User.objects.create_user(
        phone="+998901005566", password="p", full_name="Agent B", role="DISTRIBUTOR", warehouse=branch_b
    )

    api = APIClient()
    api.force_authenticate(user=mgr_a)
    mapping = json.dumps({"name": 0, "assigned_to": 1, "amount": 2, "route": 3})

    # Boshqa filial xodimini tanlashga urinish -> xato
    bad_rows = [
        ["Mijoz", "Xodim", "Qarz", "Marshrut"],
        ["Filial A Do'koni", dist_b.full_name, 50000, "Shimol"],
    ]
    bad = api.post(
        IMPORT_URL,
        {"file": _xlsx(bad_rows), "mapping": mapping, "dry_run": "false"},
        format="multipart",
    )
    assert bad.status_code == 200
    assert bad.json()["data"]["errors"] == 1
    assert not Client.objects.filter(name="Filial A Do'koni").exists()

    # O'z filiali xodimi bilan -> mijoz va marshrut Filial A ga bog'lanadi
    good_rows = [
        ["Mijoz", "Xodim", "Qarz", "Marshrut"],
        ["Filial A Do'koni", dist_a.full_name, 200000, "Shimol"],
    ]
    good = api.post(
        IMPORT_URL,
        {"file": _xlsx(good_rows), "mapping": mapping, "dry_run": "false"},
        format="multipart",
    )
    assert good.status_code == 200
    assert good.json()["data"]["errors"] == 0
    created = Client.objects.get(name="Filial A Do'koni")
    assert created.branch_id == branch_a.id
    assert created.assigned_to_id == dist_a.id
    assert created.route is not None and created.route.branch_id == branch_a.id
    assert created.current_debt == Decimal("200000.00")


@pytest.mark.django_db
def test_client_opening_import_rejects_phone_collision_with_different_name(
    manager_api, routed_clients
):
    existing = routed_clients["my_client"]  # Do'kon A, phone=+998911112233
    rows = [
        ["Do'kon", "Telefon", "Qarz"],
        ["Boshqa Yangi Market", existing.phone, 500000],
    ]
    mapping = json.dumps({"name": 0, "phone": 1, "amount": 2})

    resp = manager_api.post(
        IMPORT_URL,
        {"file": _xlsx(rows), "mapping": mapping, "dry_run": "false"},
        format="multipart",
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["errors"] == 1
    assert data["rows"][0]["action"] == "ERROR"
    existing.refresh_from_db()
    assert existing.current_debt == Decimal("0.00")


@pytest.mark.django_db
def test_client_opening_import_central_propagates_staff_branch_and_rejects_mismatch(admin_api):
    from apps.clients.models import Route
    from apps.users.models import User
    from apps.warehouse.models import Warehouse

    branch_a = Warehouse.objects.create(name="Markazdan Filial A", is_branch=True)
    branch_b = Warehouse.objects.create(name="Markazdan Filial B", is_branch=True)
    dist_a = User.objects.create_user(
        phone="+998902220001", password="p", full_name="Agent A Markaz",
        role="DISTRIBUTOR", warehouse=branch_a,
    )
    Route.objects.create(name="Janub B", branch=branch_b)
    mapping = json.dumps({"name": 0, "assigned_to": 1, "amount": 2, "route": 3})

    # Mos marshrut + xodim -> client va yangi marshrut Filial A ni oladi
    ok_rows = [
        ["Mijoz", "Xodim", "Qarz", "Marshrut"],
        ["Markaz Filial Do'kon", dist_a.full_name, 120000, "Shimol A"],
    ]
    ok_resp = admin_api.post(
        IMPORT_URL,
        {"file": _xlsx(ok_rows), "mapping": mapping, "dry_run": "false"},
        format="multipart",
    )
    assert ok_resp.status_code == 200
    assert ok_resp.json()["data"]["errors"] == 0
    created = Client.objects.get(name="Markaz Filial Do'kon")
    assert created.branch_id == branch_a.id
    assert created.route is not None and created.route.branch_id == branch_a.id

    # Aralash filial marshruti va xodimi -> xato
    bad_rows = [
        ["Mijoz", "Xodim", "Qarz", "Marshrut"],
        ["Xato Filial Do'kon", dist_a.full_name, 120000, "Janub B"],
    ]
    bad_resp = admin_api.post(
        IMPORT_URL,
        {"file": _xlsx(bad_rows), "mapping": mapping, "dry_run": "false"},
        format="multipart",
    )
    assert bad_resp.status_code == 200
    assert bad_resp.json()["data"]["errors"] == 1
    assert not Client.objects.filter(name="Xato Filial Do'kon").exists()


@pytest.mark.django_db
def test_client_opening_import_accountant_forbidden():
    from rest_framework.test import APIClient
    from apps.users.models import User

    acc = User.objects.create_user(
        phone="+998902220099", password="p", full_name="Buxgalter Test", role="ACCOUNTANT"
    )
    acc_api = APIClient()
    acc_api.force_authenticate(user=acc)

    assert acc_api.get(TEMPLATE_URL).status_code == 403
    assert acc_api.post(
        IMPORT_URL, {"file": _xlsx([["Do'kon", "Qarz"]]), "mode": "inspect"}, format="multipart"
    ).status_code == 403


@pytest.mark.django_db
def test_client_opening_import_rechecks_locked_debt_on_apply(
    manager_api, routed_clients, monkeypatch
):
    from apps.clients import opening_import

    existing = routed_clients["my_client"]
    orig_client_index = opening_import._ClientIndex

    def index_then_bump(*args, **kwargs):
        idx = orig_client_index(*args, **kwargs)
        # Reja tuzilgach, lekin yozish/qulflashdan oldin parallel qarz tushganini simulyatsiya qilamiz
        Client.objects.filter(pk=existing.pk).update(current_debt=Decimal("100000"))
        return idx

    monkeypatch.setattr(opening_import, "_ClientIndex", index_then_bump)

    rows = [
        ["Do'kon", "Qarz"],
        ["Do'kon A", 250000],
    ]
    mapping = json.dumps({"name": 0, "amount": 1})
    resp = manager_api.post(
        IMPORT_URL,
        {"file": _xlsx(rows), "mapping": mapping, "dry_run": "false"},
        format="multipart",
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["errors"] == 0
    # 250k - 100k = 150k qo'shiladi -> jami 250k bo'ladi (ikki barobar 350k emas!)
    existing.refresh_from_db()
    assert existing.current_debt == Decimal("250000.00")
