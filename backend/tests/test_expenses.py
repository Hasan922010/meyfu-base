"""7-bosqich: xarajat oqimi + hamyonga ta'siri + kun yopish formulasi."""
import uuid
from decimal import Decimal

import pytest

from apps.expenses.models import DistributorExpense
from apps.wallet.models import DistributorWallet
from apps.wallet.services import wallet_matches_ledger


def _sale(api, client, product, qty="10", price="27000", payment="NAQD"):
    return api.post(
        "/api/v1/sales/",
        {
            "client": str(client.id),
            "payment_type": payment,
            "items": [{"product": str(product.id), "quantity": qty, "price": price}],
        },
        format="json",
    )


@pytest.mark.django_db
def test_expense_starts_pending(auth_api, van_stocked, expense_categories):
    resp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["lunch"].id), "amount": "25000",
         "description": "Tushlik"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["data"]["status"] == "PENDING"
    assert not DistributorWallet.objects.filter(
        distributor=van_stocked["distributor"]
    ).exists() or DistributorWallet.objects.get(
        distributor=van_stocked["distributor"]
    ).balance == Decimal("0")


@pytest.mark.django_db
def test_receipt_required_rejected(auth_api, van_stocked, expense_categories):
    resp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["repair"].id), "amount": "50000"},
        format="json",
    )
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "RECEIPT_REQUIRED"


@pytest.mark.django_db
def test_daily_limit_exceeded_flag(auth_api, van_stocked, expense_categories):
    # limit 200000
    first = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["fuel"].id), "amount": "150000"},
        format="json",
    )
    assert first.data["data"]["over_limit"] is False
    second = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["fuel"].id), "amount": "100000"},
        format="json",
    )
    assert second.data["data"]["over_limit"] is True


@pytest.mark.django_db
def test_distributor_daily_total_limit_flags(auth_api, van_stocked, expense_categories):
    """Kategoriya limiti bo'lmasa ham, profil `daily_expense_limit` oshsa PENDING+flag."""
    profile = van_stocked["distributor"].distributor_profile
    profile.daily_expense_limit = Decimal("100000")
    profile.save()

    first = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["lunch"].id), "amount": "70000"},
        format="json",
    )
    assert first.data["data"]["over_limit"] is False

    second = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["lunch"].id), "amount": "40000"},
        format="json",
    )
    assert second.data["data"]["over_limit"] is True
    assert second.data["data"]["status"] == "PENDING"


@pytest.mark.django_db
def test_approve_cash_expense_debits_wallet(
    auth_api, admin_api, van_stocked, expense_categories
):
    client, product = van_stocked["client"], van_stocked["product"]
    distributor = van_stocked["distributor"]
    _sale(auth_api, client, product, "10", price="27000")  # wallet +270000

    exp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["fuel"].id), "amount": "80000",
         "payment_source": "CASH_ON_HAND"},
        format="json",
    ).data["data"]

    approve = admin_api.post(f"/api/v1/expenses/{exp['id']}/approve/")
    assert approve.status_code == 200
    assert approve.data["data"]["status"] == "APPROVED"

    wallet = DistributorWallet.objects.get(distributor=distributor)
    assert wallet.balance == Decimal("190000.00")  # 270000 - 80000
    assert wallet.transactions.filter(transaction_type="EXPENSE").exists()
    assert wallet_matches_ledger(distributor) is True


@pytest.mark.django_db
def test_own_money_expense_no_wallet_impact(
    auth_api, admin_api, van_stocked, expense_categories
):
    distributor = van_stocked["distributor"]
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", price="27000")

    exp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["fuel"].id), "amount": "80000",
         "payment_source": "OWN_MONEY"},
        format="json",
    ).data["data"]
    admin_api.post(f"/api/v1/expenses/{exp['id']}/approve/")

    wallet = DistributorWallet.objects.get(distributor=distributor)
    assert wallet.balance == Decimal("270000.00")  # o'zgarmadi


@pytest.mark.django_db
def test_reject_approved_expense_reverses_wallet(
    auth_api, admin_api, van_stocked, expense_categories
):
    distributor = van_stocked["distributor"]
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", price="27000")
    exp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["fuel"].id), "amount": "80000"},
        format="json",
    ).data["data"]
    admin_api.post(f"/api/v1/expenses/{exp['id']}/approve/")

    reject = admin_api.post(
        f"/api/v1/expenses/{exp['id']}/reject/",
        {"reason": "Chek yo'q"}, format="json",
    )
    assert reject.status_code == 200

    wallet = DistributorWallet.objects.get(distributor=distributor)
    assert wallet.balance == Decimal("270000.00")
    assert wallet_matches_ledger(distributor) is True


@pytest.mark.django_db
def test_approve_reject_cycle_keeps_wallet_consistent(
    auth_api, admin_api, van_stocked, expense_categories
):
    """approve → reject → approve → reject ketma-ketligida hamyon balansi
    jurnal bilan mos qolishi kerak (teskari yozuv ikki marta qo'llanmaydi)."""
    distributor = van_stocked["distributor"]
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", price="27000")
    exp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["fuel"].id), "amount": "80000"},
        format="json",
    ).data["data"]

    for _ in range(2):
        assert admin_api.post(
            f"/api/v1/expenses/{exp['id']}/approve/"
        ).status_code == 200
        assert admin_api.post(
            f"/api/v1/expenses/{exp['id']}/reject/", {"reason": "x"}, format="json"
        ).status_code == 200

    wallet = DistributorWallet.objects.get(distributor=distributor)
    assert wallet_matches_ledger(distributor) is True
    assert wallet.balance == Decimal("270000.00")


@pytest.mark.django_db
def test_distributor_cannot_approve(auth_api, van_stocked, expense_categories):
    exp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["lunch"].id), "amount": "20000"},
        format="json",
    ).data["data"]
    assert auth_api.post(f"/api/v1/expenses/{exp['id']}/approve/").status_code == 403


@pytest.mark.django_db
def test_expense_offline_bulk_sync(auth_api, van_stocked, expense_categories):
    cu = str(uuid.uuid4())
    op = {
        "type": "expense",
        "client_uuid": cu,
        "payload": {
            "category": str(expense_categories["fuel"].id),
            "amount": "45000",
            "payment_source": "CASH_ON_HAND",
            "description": "Benzin",
        },
    }
    first = auth_api.post(
        "/api/v1/sales/bulk-sync/", {"operations": [op]}, format="json"
    )
    assert first.data["data"]["results"][0]["status"] == "SENT"
    second = auth_api.post(
        "/api/v1/sales/bulk-sync/", {"operations": [op]}, format="json"
    )
    assert second.data["data"]["results"][0]["status"] == "DUPLICATE"
    assert DistributorExpense.objects.filter(client_uuid=cu).count() == 1


@pytest.mark.django_db
def test_dayclose_formula_with_expenses(
    auth_api, admin_api, van_stocked, expense_categories
):
    """CLAUDE.md 6: cash_expected = cash_sales + debt_collected − approved(CASH)."""
    client, product = van_stocked["client"], van_stocked["product"]
    distributor = van_stocked["distributor"]

    _sale(auth_api, client, product, "10", price="27000")  # cash_sales 270000

    exp = auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["fuel"].id), "amount": "50000",
         "payment_source": "CASH_ON_HAND"},
        format="json",
    ).data["data"]
    admin_api.post(f"/api/v1/expenses/{exp['id']}/approve/")

    preview = auth_api.get("/api/v1/day-close/my-today/").data["data"]
    assert preview["cash_sales_amount"] == "270000.00"
    assert preview["expense_approved_amount"] == "50000.00"
    assert preview["cash_expected"] == "220000.00"  # 270000 - 50000

    submit = auth_api.post(
        "/api/v1/day-close/submit/",
        {
            "warehouse": str(van_stocked["warehouse"].id),
            "cash_handed": "220000",
            "items": [
                {"product": str(product.id), "quantity": "490", "condition": "GOOD"}
            ],
        },
        format="json",
    )
    dc = submit.data["data"]
    assert dc["expense_amount"] == "50000.00"
    assert dc["cash_expected"] == "220000.00"
    assert dc["cash_difference"] == "0.00"

    # tasdiqdan keyin hamyondan HANDOVER chiqadi
    admin_api.post(f"/api/v1/day-close/{dc['id']}/confirm/")
    wallet = DistributorWallet.objects.get(distributor=distributor)
    # 270000 (sale) - 50000 (expense) - 220000 (handover) = 0
    assert wallet.balance == Decimal("0.00")
    assert wallet_matches_ledger(distributor) is True
