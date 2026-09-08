"""9-bosqich: qarzdorlik + kassa + kompaniya xarajatlari + hisobotlar."""
import datetime
from decimal import Decimal

import pytest

from apps.finance.models import CashTransaction
from apps.finance.services import cash_matches_ledger, get_account


def _sale(api, client, product, qty="10", price="27000", payment="NAQD", **extra):
    body = {
        "client": str(client.id), "payment_type": payment,
        "items": [{"product": str(product.id), "quantity": qty, "price": price}],
    }
    body.update(extra)
    return api.post("/api/v1/sales/", body, format="json")


# ---------- Kassa ----------

@pytest.mark.django_db
def test_dayclose_feeds_company_cash(auth_api, admin_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    _sale(auth_api, client, product, "10", price="27000")  # 270000 naqd

    dc = auth_api.post(
        "/api/v1/day-close/submit/",
        {
            "warehouse": str(van_stocked["warehouse"].id),
            "cash_handed": "270000",
            "items": [
                {"product": str(product.id), "quantity": "490", "condition": "GOOD"}
            ],
        },
        format="json",
    ).data["data"]
    admin_api.post(f"/api/v1/day-close/{dc['id']}/confirm/")

    account = get_account()
    assert account.balance == Decimal("270000.00")
    tx = CashTransaction.objects.get(transaction_type="HANDOVER_IN")
    assert tx.amount == Decimal("270000.00")
    assert tx.counterparty == van_stocked["distributor"].full_name
    assert cash_matches_ledger() is True


@pytest.mark.django_db
def test_company_expense_from_cash(admin_api, van_stocked, auth_api):
    # kassaga pul kiritamiz
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", price="27000")
    dc = auth_api.post(
        "/api/v1/day-close/submit/",
        {"warehouse": str(van_stocked["warehouse"].id), "cash_handed": "270000",
         "items": [{"product": str(van_stocked["product"].id), "quantity": "490",
                    "condition": "GOOD"}]},
        format="json",
    ).data["data"]
    admin_api.post(f"/api/v1/day-close/{dc['id']}/confirm/")

    resp = admin_api.post(
        "/api/v1/company-expenses/",
        {"category": "RENT", "amount": "100000", "description": "Ijara",
         "paid_from_cash": True},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert get_account().balance == Decimal("170000.00")  # 270000 - 100000
    assert CashTransaction.objects.filter(
        transaction_type="COMPANY_EXPENSE"
    ).exists()
    assert cash_matches_ledger() is True


@pytest.mark.django_db
def test_company_expense_not_from_cash(admin_api):
    resp = admin_api.post(
        "/api/v1/company-expenses/",
        {"category": "SALARY", "amount": "5000000", "paid_from_cash": False},
        format="json",
    )
    assert resp.status_code == 201
    assert get_account().balance == Decimal("0.00")
    assert not CashTransaction.objects.exists()


@pytest.mark.django_db
def test_cash_transaction_append_only(admin_api, auth_api, van_stocked):
    from django.core.exceptions import ValidationError

    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", price="27000")
    dc = auth_api.post(
        "/api/v1/day-close/submit/",
        {"warehouse": str(van_stocked["warehouse"].id), "cash_handed": "270000",
         "items": [{"product": str(van_stocked["product"].id), "quantity": "490",
                    "condition": "GOOD"}]},
        format="json",
    ).data["data"]
    admin_api.post(f"/api/v1/day-close/{dc['id']}/confirm/")

    tx = CashTransaction.objects.first()
    tx.amount = Decimal("1")
    with pytest.raises(ValidationError):
        tx.save()


@pytest.mark.django_db
def test_manual_cash_deposit(admin_api):
    admin_api.post(
        "/api/v1/company-expenses/",
        {"category": "OTHER", "amount": "50000", "paid_from_cash": False},
        format="json",
    )
    resp = admin_api.post(
        "/api/v1/cash-transactions/",
        {"transaction_type": "OTHER_IN", "amount": "1000000",
         "counterparty": "Investor"},
        format="json",
    )
    assert resp.status_code == 201
    assert get_account().balance == Decimal("1000000.00")

    out = admin_api.post(
        "/api/v1/cash-transactions/",
        {"transaction_type": "BANK_DEPOSIT", "amount": "400000"},
        format="json",
    )
    assert out.status_code == 201
    assert get_account().balance == Decimal("600000.00")


@pytest.mark.django_db
def test_distributor_cannot_access_finance(auth_api):
    assert auth_api.get("/api/v1/cash-transactions/").status_code == 403
    assert auth_api.get("/api/v1/company-expenses/").status_code == 403


# ---------- Hisobotlar ----------

@pytest.mark.django_db
def test_debt_aging_report(manager_api, auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    from apps.sales.models import Debt

    # muddati o'tgan qarz
    _sale(auth_api, client, product, "10", price="27000",
          payment="QARZ", due_date="2026-09-06")
    Debt.objects.all().update(due_date=datetime.date(2026, 7, 1))  # ~67 kun

    resp = manager_api.get("/api/v1/reports/debt-aging/")
    assert resp.status_code == 200
    d = resp.data["data"]
    assert d["total_outstanding"] == "270000.00"
    assert d["overdue_total"] == "270000.00"
    assert d["buckets"]["d61_90"] == "270000.00"
    assert d["overdue_clients"][0]["client"] == "Do'kon A"
    assert d["overdue_clients"][0]["max_days"] >= 60


@pytest.mark.django_db
def test_profit_report(manager_api, admin_api, auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    # tannarx 20000, sotuv 27000 → foyda 7000/dona
    _sale(auth_api, client, product, "10", price="27000")

    admin_api.post(
        "/api/v1/company-expenses/",
        {"category": "RENT", "amount": "30000", "paid_from_cash": False},
        format="json",
    )

    resp = manager_api.get(
        "/api/v1/reports/profit/?date_from=2026-09-01&date_to=2026-09-30"
    )
    assert resp.status_code == 200
    d = resp.data["data"]
    assert d["revenue"] == "270000.00"
    assert d["gross_profit"] == "70000.00"        # 10 × 7000
    assert d["company_expenses"] == "30000.00"
    assert d["net_profit"] == "40000.00"          # 70000 - 0 - 30000


@pytest.mark.django_db
def test_expenses_report(
    manager_api, admin_api, auth_api, van_stocked, expense_categories
):
    exp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["fuel"].id), "amount": "50000",
         "payment_source": "CASH_ON_HAND"},
        format="json",
    ).data["data"]
    admin_api.post(f"/api/v1/expenses/{exp['id']}/approve/")

    resp = manager_api.get(
        "/api/v1/reports/expenses/?date_from=2026-09-01&date_to=2026-09-30"
    )
    assert resp.status_code == 200
    d = resp.data["data"]
    assert d["total"] == "50000.00"
    assert d["by_category"][0]["category"] == "Yoqilg'i"
    assert d["by_category"][0]["approved"] == "50000.00"


@pytest.mark.django_db
def test_overdue_task_notifies_distributor(auth_api, van_stocked, distributor):
    from apps.notifications.models import Notification
    from apps.sales.models import Debt
    from realtime.tasks import check_overdue_debts

    client, product = van_stocked["client"], van_stocked["product"]
    _sale(auth_api, client, product, "10", price="27000",
          payment="QARZ", due_date="2026-08-01")
    Debt.objects.all().update(due_date=datetime.date(2026, 8, 1))

    check_overdue_debts()

    assert Notification.objects.filter(
        user=distributor, type="debt.overdue"
    ).exists()
    assert Debt.objects.first().status == "OVERDUE"
