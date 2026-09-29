"""Filiallarni ajratish: har filial o'z xodimlari, savdosi va kassasi bilan ishlaydi,
boshqa filial ma'lumotini ko'rmaydi. Markaz (filialsiz xodimlar) hammasini ko'radi.
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.clients.models import Client, Route
from apps.finance.models import CashAccount, CashTransaction
from apps.sales.models import Debt, Sale
from apps.warehouse.models import Warehouse

User = get_user_model()
PASSWORD = "pass12345"


def _login(phone: str) -> APIClient:
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/login/", {"phone": phone, "password": PASSWORD}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return client


def _user(phone: str, role: str, branch: Warehouse | None, name: str):
    return User.objects.create_user(
        phone=phone, password=PASSWORD, full_name=name, role=role, warehouse=branch,
    )


def _sale(distributor, client, number: str, amount: str = "100000") -> Sale:
    return Sale.objects.create(
        number=number, date="2026-09-29", distributor=distributor, client=client,
        payment_type="NAQD", total_amount=Decimal(amount), paid_amount=Decimal(amount),
    )


def _ids(resp) -> set[str]:
    return {row["id"] for row in resp.data["data"]["results"]}


@pytest.fixture
def world(db, catalog):
    """Ikki filial (A, B) — har birida rahbar, tarqatuvchi, marshrut, mijoz, sotuv."""
    branch_a = Warehouse.objects.create(name="Filial A", is_branch=True)
    branch_b = Warehouse.objects.create(name="Filial B", is_branch=True)
    data: dict = {"a": {"branch": branch_a}, "b": {"branch": branch_b}}
    for key, branch, n in (("a", branch_a, "1"), ("b", branch_b, "2")):
        manager = _user(f"+99890100000{n}", "BRANCH_MANAGER", branch, f"Rahbar {key}")
        dist = _user(f"+99890200000{n}", "DISTRIBUTOR", branch, f"Tarqatuvchi {key}")
        route = Route.objects.create(name=f"Marshrut {key}", distributor=dist,
                                     branch=branch)
        client = Client.objects.create(name=f"Do'kon {key}", route=route, branch=branch)
        sale = _sale(dist, client, f"SOT-2026-0000{n}")
        debt = Debt.objects.create(client=client, sale=sale, amount=Decimal("5000"),
                                   remaining=Decimal("5000"))
        data[key].update(manager=manager, distributor=dist, route=route,
                         client=client, sale=sale, debt=debt)
    data["central"] = _user("+998903000000", "MANAGER", None, "Markaz menejeri")
    return data


# ------------------------------------------------------------------ ko'rish


def test_branch_manager_sees_only_own_sales(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.get("/api/v1/sales/")

    assert resp.status_code == 200
    assert _ids(resp) == {str(world["a"]["sale"].pk)}


def test_branch_manager_cannot_open_other_branch_sale(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.get(f"/api/v1/sales/{world['b']['sale'].pk}/")

    assert resp.status_code == 404


def test_central_manager_sees_all_branches(world):
    api = _login(world["central"].phone)

    resp = api.get("/api/v1/sales/")

    assert _ids(resp) == {str(world["a"]["sale"].pk), str(world["b"]["sale"].pk)}


def test_branch_manager_sees_only_own_clients_routes_debts(world):
    api = _login(world["a"]["manager"].phone)

    assert _ids(api.get("/api/v1/clients/")) == {str(world["a"]["client"].pk)}
    assert _ids(api.get("/api/v1/routes/")) == {str(world["a"]["route"].pk)}
    assert _ids(api.get("/api/v1/debts/")) == {str(world["a"]["debt"].pk)}


def test_branch_manager_sees_only_own_staff(world):
    api = _login(world["a"]["manager"].phone)

    ids = _ids(api.get("/api/v1/users/"))

    assert ids == {str(world["a"]["manager"].pk), str(world["a"]["distributor"].pk)}


def test_branch_report_list_shows_only_own_branch(world):
    api = _login(world["a"]["manager"].phone)

    rows = api.get("/api/v1/reports/branches/").data["data"]

    assert [r["id"] for r in rows] == [str(world["a"]["branch"].pk)]


def test_branch_manager_cannot_open_other_branch_report(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.get(f"/api/v1/reports/branches/{world['b']['branch'].pk}/cards/")

    assert resp.status_code == 404


def test_sales_summary_is_scoped_to_branch(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.get("/api/v1/reports/sales-summary/",
                   {"group_by": "distributor", "date_from": "2026-09-01",
                    "date_to": "2026-09-30"})

    names = {row["distributor"] for row in resp.data["data"]["rows"]}
    assert names == {"Tarqatuvchi a"}


def test_dashboard_is_scoped_to_branch(world):
    api = _login(world["a"]["manager"].phone)

    kpi = api.get("/api/v1/reports/dashboard/", {"date": "2026-09-29"}).data["data"]["kpi"]

    assert kpi["sales_total"] == "100000.00"
    assert kpi["sales_count"] == 1
    assert kpi["outstanding_debt"] == "5000.00"


# ------------------------------------------------------------------ xodim qo'shish


def test_branch_manager_adds_staff_to_own_branch(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.post("/api/v1/users/", {
        "phone": "+998904440011", "full_name": "Yangi tarqatuvchi",
        "role": "DISTRIBUTOR", "password": "Kuchli.Parol123",
        "warehouse": str(world["b"]["branch"].pk),  # boshqa filial — e'tiborsiz
    }, format="json")

    assert resp.status_code == 201, resp.data
    created = User.objects.get(phone="+998904440011")
    assert created.warehouse_id == world["a"]["branch"].pk


@pytest.mark.parametrize("role", ["MANAGER", "SUPER_ADMIN", "BRANCH_MANAGER"])
def test_branch_manager_cannot_create_senior_roles(world, role):
    api = _login(world["a"]["manager"].phone)

    resp = api.post("/api/v1/users/", {
        "phone": "+998904440022", "full_name": "X", "role": role,
        "password": "Kuchli.Parol123",
    }, format="json")

    assert resp.status_code == 400
    assert not User.objects.filter(phone="+998904440022").exists()


def test_branch_manager_cannot_promote_own_staff(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.patch(f"/api/v1/users/{world['a']['distributor'].pk}/",
                     {"role": "MANAGER"}, format="json")

    assert resp.status_code == 400


def test_branch_manager_cannot_edit_other_branch_staff(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.patch(f"/api/v1/users/{world['b']['distributor'].pk}/",
                     {"full_name": "Buzildi"}, format="json")

    assert resp.status_code == 404


# ------------------------------------------------------------------ mijoz / marshrut


def test_branch_manager_client_is_created_in_own_branch(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.post("/api/v1/clients/", {
        "name": "Yangi do'kon", "route": str(world["a"]["route"].pk),
    }, format="json")

    assert resp.status_code == 201, resp.data
    assert Client.objects.get(name="Yangi do'kon").branch_id == world["a"]["branch"].pk


def test_branch_manager_cannot_use_other_branch_route(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.post("/api/v1/clients/", {
        "name": "Begona", "route": str(world["b"]["route"].pk),
    }, format="json")

    assert resp.status_code == 400


# ------------------------------------------------------------------ markaz huquqlari


def test_branch_manager_cannot_change_catalog(world, catalog):
    api = _login(world["a"]["manager"].phone)

    resp = api.patch(f"/api/v1/products/{catalog['product'].pk}/",
                     {"wholesale_price": "1"}, format="json")

    assert resp.status_code == 403


def test_branch_manager_can_read_catalog(world):
    api = _login(world["a"]["manager"].phone)

    assert api.get("/api/v1/products/").status_code == 200


# ------------------------------------------------------------------ bildirishnoma


def test_branch_notification_reaches_only_own_branch_manager(world):
    from apps.notifications.models import Notification
    from apps.notifications.services import notify_admins

    notify_admins(title="Farq bor", branch=world["a"]["branch"])

    assert Notification.objects.filter(user=world["a"]["manager"]).count() == 1
    assert Notification.objects.filter(user=world["b"]["manager"]).count() == 0
    assert Notification.objects.filter(user=world["central"]).count() == 1


# ------------------------------------------------------------------ kassa


def test_branch_cash_is_separate_from_central(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.post("/api/v1/cash-transactions/", {
        "transaction_type": "OTHER_IN", "amount": "70000", "note": "Kirim",
    }, format="json")

    assert resp.status_code == 201, resp.data
    account = CashAccount.objects.get(branch=world["a"]["branch"])
    assert account.balance == Decimal("70000")
    assert not CashAccount.objects.filter(branch__isnull=True,
                                          balance__gt=0).exists()


def test_branch_manager_sees_only_own_cash_transactions(world):
    from apps.finance.services import cash_apply

    cash_apply(transaction_type="OTHER_IN", amount=Decimal("1000"),
               branch=world["b"]["branch"])
    api = _login(world["a"]["manager"].phone)

    resp = api.get("/api/v1/cash-transactions/")

    assert resp.status_code == 200
    assert resp.data["data"]["results"] == []
    assert CashTransaction.objects.count() == 1
