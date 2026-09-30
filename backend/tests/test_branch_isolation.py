"""Filiallarni ajratish: har filial o'z xodimlari, savdosi va kassasi bilan ishlaydi,
boshqa filial ma'lumotini ko'rmaydi. Markaz (filialsiz xodimlar) hammasini ko'radi.
"""
from __future__ import annotations

from datetime import date
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


# ------------------------------------------------------------------ filial narxi (A7)


def test_branch_price_overrides_catalog_for_branch_staff(world, catalog, admin_api):
    product = catalog["product"]
    resp = admin_api.post("/api/v1/branch-prices/", {
        "branch": str(world["a"]["branch"].pk), "product": str(product.pk),
        "wholesale_price": "26000", "retail_price": "30000", "min_price": "25500",
    }, format="json")
    assert resp.status_code == 201, resp.data

    api_a = _login(world["a"]["manager"].phone)
    api_b = _login(world["b"]["manager"].phone)
    row_a = api_a.get(f"/api/v1/products/{product.pk}/").data["data"]
    row_b = api_b.get(f"/api/v1/products/{product.pk}/").data["data"]

    assert row_a["wholesale_price"] == "26000.00"
    assert row_b["wholesale_price"] == "25000.00"


def test_branch_min_price_applies_to_branch_distributor(world, catalog):
    from apps.catalog.models import BranchPrice
    from apps.catalog.pricing import price_for
    from apps.core.branch import staff_branch

    BranchPrice.objects.create(
        branch=world["a"]["branch"], product=catalog["product"],
        wholesale_price=Decimal("26000"), retail_price=Decimal("30000"),
        min_price=Decimal("25500"),
    )

    branch = staff_branch(world["a"]["distributor"])
    assert price_for(catalog["product"], branch).min_price == Decimal("25500")
    assert price_for(catalog["product"], None).min_price == Decimal("24000")


def test_branch_manager_cannot_set_branch_price(world, catalog):
    api = _login(world["a"]["manager"].phone)

    resp = api.post("/api/v1/branch-prices/", {
        "branch": str(world["a"]["branch"].pk), "product": str(catalog["product"].pk),
        "wholesale_price": "1", "retail_price": "1", "min_price": "1",
    }, format="json")

    assert resp.status_code == 403


# ------------------------------------------------------------------ solishtirish (A5, A6)


def _transfer(source, target, product, qty: str, cost: str):
    from apps.warehouse.models import Transfer, TransferItem

    transfer = Transfer.objects.create(
        number=f"KCH-T-{source.name[:3]}-{target.name[:3]}", date="2026-09-29",
        from_warehouse=source, to_warehouse=target, status="RECEIVED",
    )
    TransferItem.objects.create(
        transfer=transfer, product=product, quantity=Decimal(qty),
        received_quantity=Decimal(qty), cost_price=Decimal(cost),
    )


def test_branch_comparison_and_settlement(world, catalog):
    from apps.finance.services import cash_apply
    from apps.finance.services.cash import transfer_to_center

    center = Warehouse.objects.create(name="Markaz ombori")
    _transfer(center, world["a"]["branch"], catalog["product"], "10", "20000")  # 200 000
    _transfer(world["a"]["branch"], center, catalog["product"], "2", "20000")   # 40 000
    cash_apply(transaction_type="OTHER_IN", amount=Decimal("100000"),
               branch=world["a"]["branch"])
    transfer_to_center(branch=world["a"]["branch"], amount=Decimal("60000"))

    api = _login(world["central"].phone)
    rows = api.get("/api/v1/reports/branches/comparison/",
                   {"preset": "custom", "date_from": "2026-09-01",
                    "date_to": "2026-09-30"}).data["data"]["rows"]

    row_a = next(r for r in rows if r["name"] == "Filial A")
    assert len(rows) == 2
    assert row_a["sales_total"] == "100000.00"
    assert row_a["settlement"] == {
        "goods_from_center": "200000.00", "goods_to_center": "40000.00",
        "cash_to_center": "60000.00", "balance": "100000.00",
    }


def test_branch_manager_sees_only_own_comparison_row(world):
    api = _login(world["a"]["manager"].phone)

    rows = api.get("/api/v1/reports/branches/comparison/").data["data"]["rows"]

    assert [r["name"] for r in rows] == ["Filial A"]


# ------------------------------------------------------------------ Telegram xulosa (A4)


def test_branch_daily_summary_counts_only_own_sales(world):
    from apps.telegram_bot.services.digest import build_today_summary

    text = build_today_summary(day=date(2026, 9, 29), branch=world["a"]["branch"])

    assert "Filial A" in text
    assert "(1 ta)" in text  # B filial sotuvi qo'shilmaydi


# ------------------------------------------------------------------ boshlang'ich qoldiq (A3)


def test_branch_opening_sheets_are_scoped(world):
    api = _login(world["a"]["manager"].phone)

    clients = api.get("/api/v1/clients/opening-sheet/").data["data"]
    cash = api.get("/api/v1/cash-transactions/opening-sheet/").data["data"]

    assert [c["id"] for c in clients] == [str(world["a"]["client"].pk)]
    assert cash[0]["name"] == "Filial A kassasi"


def test_branch_cannot_set_opening_debt_for_other_branch_client(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.post("/api/v1/clients/opening-balance/bulk/", {
        "rows": [{"id": str(world["b"]["client"].pk), "target": "9000"}], "note": "x",
    }, format="json")

    assert resp.status_code == 400
    world["b"]["client"].refresh_from_db()
    assert world["b"]["client"].current_debt == Decimal("0")


def test_branch_cash_opening_goes_to_branch_account(world):
    api = _login(world["a"]["manager"].phone)
    account_id = api.get("/api/v1/cash-transactions/opening-sheet/").data["data"][0]["id"]

    resp = api.post("/api/v1/cash-transactions/opening-balance/bulk/", {
        "rows": [{"id": account_id, "target": "300000"}], "note": "Ochilish",
    }, format="json")

    assert resp.status_code == 200, resp.data
    assert CashAccount.objects.get(branch=world["a"]["branch"]).balance == Decimal("300000")
    assert not CashAccount.objects.filter(branch__isnull=True, balance__gt=0).exists()


# ------------------------------------------------------------------ inkassatsiya (A1)


def test_branch_hands_cash_to_center(world):
    from apps.finance.services import cash_apply

    cash_apply(transaction_type="OTHER_IN", amount=Decimal("70000"),
               branch=world["a"]["branch"])
    api = _login(world["a"]["manager"].phone)

    resp = api.post("/api/v1/cash-transactions/to-center/",
                    {"amount": "50000", "note": "Haftalik"}, format="json")

    assert resp.status_code == 201, resp.data
    assert CashAccount.objects.get(branch=world["a"]["branch"]).balance == Decimal("20000")
    assert CashAccount.objects.get(branch__isnull=True).balance == Decimal("50000")


def test_branch_cannot_hand_more_than_cash_on_hand(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.post("/api/v1/cash-transactions/to-center/",
                    {"amount": "1000"}, format="json")

    assert resp.status_code == 409  # BusinessError — biznes qoidasi (kassa yetmaydi)
    assert CashTransaction.objects.count() == 0


# ------------------------------------------------------------------ marshrutni o'tkazish (A8)


def test_central_moves_route_to_branch_with_its_clients(world):
    route = Route.objects.create(name="Markaz marshruti")
    client = Client.objects.create(name="Markaz do'koni", route=route)
    api = _login(world["central"].phone)

    resp = api.patch(f"/api/v1/routes/{route.pk}/",
                     {"branch": str(world["a"]["branch"].pk)}, format="json")

    assert resp.status_code == 200, resp.data
    client.refresh_from_db()
    assert client.branch_id == world["a"]["branch"].pk


# ------------------------------------------------------------------ hujjat filiali (A2)


def test_sale_keeps_branch_after_distributor_moves(world):
    dist = world["a"]["distributor"]
    sale = world["a"]["sale"]
    assert sale.branch_id == world["a"]["branch"].pk  # yaratilishda muhrlangan

    dist.warehouse = world["b"]["branch"]
    dist.save(update_fields=["warehouse"])

    api_a = _login(world["a"]["manager"].phone)
    api_b = _login(world["b"]["manager"].phone)
    assert str(sale.pk) in _ids(api_a.get("/api/v1/sales/"))
    assert str(sale.pk) not in _ids(api_b.get("/api/v1/sales/"))


# ------------------------------------------------------------------ bildirishnoma


def test_branch_notification_reaches_only_own_branch_manager(world):
    from apps.notifications.models import Notification
    from apps.notifications.services import notify_admins

    notify_admins(title="Farq bor", branch=world["a"]["branch"])

    assert Notification.objects.filter(user=world["a"]["manager"]).count() == 1
    assert Notification.objects.filter(user=world["b"]["manager"]).count() == 0
    assert Notification.objects.filter(user=world["central"]).count() == 1


# ------------------------------------------------------------------ sinxronizatsiya jurnali (B6)


def test_bulk_sync_writes_sync_log(world):
    from apps.core.models import SyncLog

    api = _login(world["a"]["distributor"].phone)
    resp = api.post("/api/v1/sales/bulk-sync/", {"operations": []}, format="json",
                    HTTP_X_DEVICE_ID="tel-01")

    assert resp.status_code == 200, resp.data
    log = SyncLog.objects.get(user=world["a"]["distributor"])
    assert log.device_id == "tel-01"
    assert log.operations_count == 0


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


# ------------------------------------------------ audit SEC-107 (2026-09-30)

def test_branch_manager_cannot_mint_opening_balance_or_commission(world):
    api = _login(world["a"]["manager"].phone)

    resp = api.post("/api/v1/users/", {
        "phone": "+998904440022", "full_name": "Soxta", "role": "DISTRIBUTOR",
        "password": "Kuchli.Parol123", "opening_balance": "10000000",
        "distributor_profile": {"commission_percent": "50"},
    }, format="json")

    assert resp.status_code == 400
    assert not User.objects.filter(phone="+998904440022").exists()


def test_branch_manager_can_edit_staff_without_touching_pay(world):
    api = _login(world["a"]["manager"].phone)
    dist = world["a"]["distributor"]

    resp = api.patch(f"/api/v1/users/{dist.pk}/", {
        "full_name": "Yangi ism",
        "distributor_profile": {"vehicle_number": "01A777AA",
                                "commission_percent": "0"},  # o'zgarmagan
    }, format="json")

    assert resp.status_code == 200, resp.data


# ------------------------------------------------ audit SEC-111 (2026-09-30)

def test_branch_manager_cannot_patch_loading_to_other_branch(world, catalog):
    from apps.warehouse.models import Loading

    a, b = world["a"], world["b"]
    loading = Loading.objects.create(
        date=date.today(), distributor=a["distributor"],
        warehouse=a["branch"],
    )
    api = _login(a["manager"].phone)

    resp = api.patch(f"/api/v1/loadings/{loading.pk}/", {
        "distributor": str(b["distributor"].pk),
    }, format="json")

    assert resp.status_code == 400
    loading.refresh_from_db()
    assert loading.distributor_id == a["distributor"].pk


def test_branch_manager_cannot_patch_loading_warehouse_to_other_branch(world, catalog):
    from apps.warehouse.models import Loading

    a, b = world["a"], world["b"]
    loading = Loading.objects.create(
        date=date.today(), distributor=a["distributor"],
        warehouse=a["branch"],
    )
    api = _login(a["manager"].phone)

    resp = api.patch(f"/api/v1/loadings/{loading.pk}/", {
        "warehouse": str(b["branch"].pk),
    }, format="json")

    assert resp.status_code == 400
