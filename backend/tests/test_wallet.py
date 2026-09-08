"""7-bosqich DoD: hamyon butunligi (balance == SUM(transactions))."""
from decimal import Decimal

import pytest

from apps.wallet.models import DistributorWallet, WalletTransaction
from apps.wallet.services import wallet_matches_ledger


def _sale(api, client, product, qty="10", price="27000", payment="NAQD", **extra):
    body = {
        "client": str(client.id),
        "payment_type": payment,
        "items": [{"product": str(product.id), "quantity": qty, "price": price}],
    }
    body.update(extra)
    return api.post("/api/v1/sales/", body, format="json")


@pytest.mark.django_db
def test_cash_sale_credits_wallet(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    distributor = van_stocked["distributor"]
    assert _sale(auth_api, client, product, "10", price="27000").status_code == 201

    wallet = DistributorWallet.objects.get(distributor=distributor)
    assert wallet.balance == Decimal("270000.00")
    tx = WalletTransaction.objects.get(wallet=wallet)
    assert tx.transaction_type == "SALE_CASH"
    assert tx.amount == Decimal("270000.00")
    assert tx.balance_after == Decimal("270000.00")
    assert wallet_matches_ledger(distributor) is True


@pytest.mark.django_db
def test_card_sale_does_not_credit_wallet(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    _sale(auth_api, client, product, "10", price="27000", payment="PLASTIK")
    assert not WalletTransaction.objects.exists()


@pytest.mark.django_db
def test_cash_debt_payment_credits_wallet(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    distributor = van_stocked["distributor"]
    sale = _sale(
        auth_api, client, product, "10", price="27000",
        payment="QARZ", due_date="2026-10-01",
    ).data["data"]

    from apps.sales.models import Debt

    debt = Debt.objects.get(sale__id=sale["id"])
    pay = auth_api.post(
        "/api/v1/debt-payments/",
        {"debt": str(debt.id), "amount": "100000", "payment_type": "NAQD"},
        format="json",
    )
    assert pay.status_code == 201

    wallet = DistributorWallet.objects.get(distributor=distributor)
    # QARZ sotuvda naqd 0 → faqat DEBT_COLLECTED
    assert wallet.balance == Decimal("100000.00")
    assert wallet.transactions.filter(transaction_type="DEBT_COLLECTED").exists()
    assert wallet_matches_ledger(distributor) is True


@pytest.mark.django_db
def test_cancel_sale_reverses_wallet(auth_api, admin_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    distributor = van_stocked["distributor"]
    sale = _sale(auth_api, client, product, "10", price="27000").data["data"]

    admin_api.post(f"/api/v1/sales/{sale['id']}/cancel/", {}, format="json")

    wallet = DistributorWallet.objects.get(distributor=distributor)
    assert wallet.balance == Decimal("0.00")
    assert wallet.transactions.count() == 2  # SALE_CASH + CORRECTION
    assert wallet.transactions.filter(transaction_type="CORRECTION").exists()
    assert wallet_matches_ledger(distributor) is True


@pytest.mark.django_db
def test_wallet_transaction_is_append_only(auth_api, van_stocked):
    from django.core.exceptions import ValidationError

    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", price="27000")
    tx = WalletTransaction.objects.first()
    tx.amount = Decimal("999")
    with pytest.raises(ValidationError):
        tx.save()


@pytest.mark.django_db
def test_wallet_my_endpoint(auth_api, van_stocked, expense_categories):
    client, product = van_stocked["client"], van_stocked["product"]
    _sale(auth_api, client, product, "10", price="27000")  # +270000

    # tasdiqlanmagan naqd xarajat — live_balance dan chiqadi
    auth_api.post(
        "/api/v1/expenses/",
        {"category": str(expense_categories["lunch"].id), "amount": "30000"},
        format="json",
    )

    resp = auth_api.get("/api/v1/wallet/my/")
    assert resp.status_code == 200
    d = resp.data["data"]
    assert d["balance"] == "270000.00"
    assert d["pending_expense_amount"] == "30000.00"
    assert d["live_balance"] == "240000.00"
