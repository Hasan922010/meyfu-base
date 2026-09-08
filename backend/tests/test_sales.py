"""5-bosqich: Sotuv yadrosi + biznes qoidalari + offline (CLAUDE.md 5, 7, 4.6)."""
import uuid
from decimal import Decimal

import pytest

from apps.sales.models import Debt, Sale
from apps.warehouse.models import VanStock
from apps.warehouse.services.van import van_matches_loadings


def _sale_body(client, product, qty="10", price="27000", payment="NAQD", **extra):
    body = {
        "client": str(client.id),
        "payment_type": payment,
        "items": [{"product": str(product.id), "quantity": qty, "price": price}],
    }
    body.update(extra)
    return body


# ---------- Online sotuv ----------

@pytest.mark.django_db
def test_cash_sale_decrements_van_stock(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    resp = auth_api.post("/api/v1/sales/", _sale_body(client, product), format="json")
    assert resp.status_code == 201, resp.data
    d = resp.data["data"]
    assert d["number"].startswith("SOT-2026-")
    assert d["total_amount"] == "270000.00"
    assert d["debt_amount"] == "0.00"
    assert d["status"] == "COMPLETED"

    van = VanStock.objects.get(distributor=van_stocked["distributor"], product=product)
    assert van.quantity == Decimal("490.000")


@pytest.mark.django_db
def test_credit_sale_creates_debt(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    resp = auth_api.post(
        "/api/v1/sales/",
        _sale_body(client, product, payment="QARZ", due_date="2026-10-01"),
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["data"]["debt_amount"] == "270000.00"

    debt = Debt.objects.get(sale__id=resp.data["data"]["id"])
    assert debt.remaining == Decimal("270000.00")
    client.refresh_from_db()
    assert client.current_debt == Decimal("270000.00")


@pytest.mark.django_db
def test_card_sale_no_debt_no_wallet_cash(auth_api, van_stocked):
    """PLASTIK — to'liq to'langan, qarz yo'q, qo'ldagi naqdga TUSHMAYDI."""
    from apps.wallet.models import WalletTransaction

    client, product = van_stocked["client"], van_stocked["product"]
    resp = auth_api.post(
        "/api/v1/sales/",
        _sale_body(client, product, payment="PLASTIK"),
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["data"]["debt_amount"] == "0.00"
    assert resp.data["data"]["paid_amount"] == "270000.00"
    assert not WalletTransaction.objects.filter(
        reference_id=resp.data["data"]["id"], transaction_type="SALE_CASH"
    ).exists()


@pytest.mark.django_db
def test_mixed_sale_splits_cash_and_debt(auth_api, van_stocked):
    """ARALASH — naqd qismi qo'ldagi naqdga, qolgani qarzga."""
    from apps.wallet.models import WalletTransaction

    client, product = van_stocked["client"], van_stocked["product"]
    resp = auth_api.post(
        "/api/v1/sales/",
        _sale_body(
            client, product, payment="ARALASH", paid_amount="100000",
            due_date="2026-10-01",
        ),
        format="json",
    )
    assert resp.status_code == 201, resp.data
    d = resp.data["data"]
    assert d["paid_amount"] == "100000.00"
    assert d["debt_amount"] == "170000.00"

    debt = Debt.objects.get(sale__id=d["id"])
    assert debt.remaining == Decimal("170000.00")
    tx = WalletTransaction.objects.get(
        reference_id=d["id"], transaction_type="SALE_CASH"
    )
    assert tx.amount == Decimal("100000.00")


@pytest.mark.django_db
def test_price_below_min_rejected(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    # product.min_price = 24000
    resp = auth_api.post(
        "/api/v1/sales/", _sale_body(client, product, price="20000"), format="json"
    )
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "PRICE_BELOW_MINIMUM"
    assert not Sale.objects.exists()


@pytest.mark.django_db
def test_price_below_min_allowed_with_permission(auth_api, van_stocked, distributor):
    distributor.distributor_profile.can_sell_below_price = True
    distributor.distributor_profile.save()
    client, product = van_stocked["client"], van_stocked["product"]
    resp = auth_api.post(
        "/api/v1/sales/", _sale_body(client, product, price="20000"), format="json"
    )
    assert resp.status_code == 201
    assert resp.data["data"]["status"] == "FLAGGED"
    assert "PRICE_BELOW_MINIMUM" in resp.data["data"]["flag_reason"]


@pytest.mark.django_db
def test_insufficient_van_stock_rejected(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    resp = auth_api.post(
        "/api/v1/sales/", _sale_body(client, product, qty="9999"), format="json"
    )
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "INSUFFICIENT_STOCK"


@pytest.mark.django_db
def test_debt_limit_exceeded(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    client.debt_limit = Decimal("100000")
    client.save()
    body = _sale_body(client, product, qty="10", price="27000", payment="QARZ")

    blocked = auth_api.post("/api/v1/sales/", body, format="json")
    assert blocked.status_code == 409
    assert blocked.data["error"]["code"] == "DEBT_LIMIT_EXCEEDED"

    forced = auth_api.post("/api/v1/sales/?force=true", body, format="json")
    assert forced.status_code == 201
    assert forced.data["data"]["flagged"] is True


@pytest.mark.django_db
def test_blocked_client_credit_rejected(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    client.is_blocked = True
    client.save()
    resp = auth_api.post(
        "/api/v1/sales/", _sale_body(client, product, payment="QARZ"), format="json"
    )
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "CLIENT_BLOCKED"


@pytest.mark.django_db
def test_idempotent_client_uuid_online(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    cu = str(uuid.uuid4())
    body = _sale_body(client, product, client_uuid=cu)

    first = auth_api.post("/api/v1/sales/", body, format="json")
    assert first.status_code == 201
    second = auth_api.post("/api/v1/sales/", body, format="json")
    assert second.status_code == 200  # duplicate — jimgina qabul

    assert Sale.objects.filter(client_uuid=cu).count() == 1
    van = VanStock.objects.get(distributor=van_stocked["distributor"], product=product)
    assert van.quantity == Decimal("490.000")  # bir marta kamaydi


@pytest.mark.django_db
def test_cancel_sale_restores_stock_and_debt(auth_api, admin_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    sale = auth_api.post(
        "/api/v1/sales/", _sale_body(client, product, payment="QARZ"), format="json"
    ).data["data"]

    resp = admin_api.post(f"/api/v1/sales/{sale['id']}/cancel/", {}, format="json")
    assert resp.status_code == 200
    assert resp.data["data"]["status"] == "CANCELLED"

    van = VanStock.objects.get(distributor=van_stocked["distributor"], product=product)
    assert van.quantity == Decimal("500.000")
    client.refresh_from_db()
    assert client.current_debt == Decimal("0.00")
    assert not Debt.objects.filter(sale__id=sale["id"]).exists()


# ---------- Offline / bulk-sync (CLAUDE.md 4.6) ----------

@pytest.mark.django_db
def test_offline_acceptance_20_sales(auth_api, van_stocked):
    """4.6: 20 ta offline sotuv → bulk-sync → qayta yuborish → dublikat yo'q."""
    client, product = van_stocked["client"], van_stocked["product"]
    distributor = van_stocked["distributor"]

    operations = []
    for _i in range(20):
        cu = str(uuid.uuid4())
        operations.append({
            "type": "sale",
            "client_uuid": cu,
            "payload": {
                "client": str(client.id),
                "payment_type": "NAQD",
                "date": "2026-09-06",
                "device_time": "2026-09-06T09:15:00Z",
                "items": [
                    {"product": str(product.id), "quantity": "10", "price": "27000"}
                ],
            },
        })

    resp = auth_api.post(
        "/api/v1/sales/bulk-sync/", {"operations": operations}, format="json"
    )
    assert resp.status_code == 200, resp.data
    results = resp.data["data"]["results"]
    assert len(results) == 20
    assert all(r["status"] == "SENT" for r in results), results

    assert Sale.objects.filter(distributor=distributor).count() == 20
    van = VanStock.objects.get(distributor=distributor, product=product)
    assert van.quantity == Decimal("300.000")  # 500 - 20*10

    # Qayta yuborish — hammasi DUPLICATE, qoldiq o'zgarmaydi
    again = auth_api.post(
        "/api/v1/sales/bulk-sync/", {"operations": operations}, format="json"
    )
    assert all(r["status"] == "DUPLICATE" for r in again.data["data"]["results"])
    assert Sale.objects.filter(distributor=distributor).count() == 20
    van.refresh_from_db()
    assert van.quantity == Decimal("300.000")

    assert van_matches_loadings(distributor, product) is True


@pytest.mark.django_db
def test_bulk_sync_conflict_when_stock_short(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    distributor = van_stocked["distributor"]
    op = {
        "type": "sale",
        "client_uuid": str(uuid.uuid4()),
        "payload": {
            "client": str(client.id),
            "payment_type": "NAQD",
            "items": [
                {"product": str(product.id), "quantity": "600", "price": "27000"}
            ],
        },
    }
    resp = auth_api.post(
        "/api/v1/sales/bulk-sync/", {"operations": [op]}, format="json"
    )
    r = resp.data["data"]["results"][0]
    assert r["status"] == "CONFLICT"

    sale = Sale.objects.get(id=r["server_id"])
    assert sale.status == "CONFLICT"
    van = VanStock.objects.get(distributor=distributor, product=product)
    assert van.quantity == Decimal("500.000")  # tegilmadi


@pytest.mark.django_db
def test_debt_payment_bulk_sync_idempotent(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    sale = auth_api.post(
        "/api/v1/sales/",
        _sale_body(client, product, payment="QARZ"),
        format="json",
    ).data["data"]
    debt = Debt.objects.get(sale__id=sale["id"])

    cu = str(uuid.uuid4())
    op = {
        "type": "debt_payment",
        "client_uuid": cu,
        "payload": {"debt": str(debt.id), "amount": "100000", "payment_type": "NAQD"},
    }
    first = auth_api.post(
        "/api/v1/sales/bulk-sync/", {"operations": [op]}, format="json"
    )
    assert first.data["data"]["results"][0]["status"] == "SENT"
    second = auth_api.post(
        "/api/v1/sales/bulk-sync/", {"operations": [op]}, format="json"
    )
    assert second.data["data"]["results"][0]["status"] == "DUPLICATE"

    debt.refresh_from_db()
    assert debt.paid_amount == Decimal("100000.00")
    assert debt.status == "PARTIAL"
    client.refresh_from_db()
    assert client.current_debt == Decimal("170000.00")


@pytest.mark.django_db
def test_debt_payment_bulk_sync_overpay_clamped(auth_api, van_stocked):
    """Offline to'lov qarz qoldig'idan katta bo'lsa — FAILED emas, qoldiqqa
    moslashtiriladi (yo'qolgan pul bo'lmasin)."""
    client, product = van_stocked["client"], van_stocked["product"]
    sale = auth_api.post(
        "/api/v1/sales/", _sale_body(client, product, payment="QARZ"),
        format="json",
    ).data["data"]
    debt = Debt.objects.get(sale__id=sale["id"])  # qoldiq 270000

    op = {
        "type": "debt_payment",
        "client_uuid": str(uuid.uuid4()),
        "payload": {"debt": str(debt.id), "amount": "500000", "payment_type": "NAQD"},
    }
    resp = auth_api.post(
        "/api/v1/sales/bulk-sync/", {"operations": [op]}, format="json"
    )
    assert resp.data["data"]["results"][0]["status"] == "SENT"

    debt.refresh_from_db()
    assert debt.remaining == Decimal("0.00")
    assert debt.status == "PAID"


@pytest.mark.django_db
def test_sale_return_restocks_van(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    distributor = van_stocked["distributor"]
    auth_api.post("/api/v1/sales/", _sale_body(client, product, qty="10"), format="json")

    resp = auth_api.post(
        "/api/v1/sale-returns/",
        {
            "client": str(client.id),
            "reason": "MUDDAT",
            "restock": True,
            "items": [{"product": str(product.id), "quantity": "3", "price": "27000"}],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    van = VanStock.objects.get(distributor=distributor, product=product)
    assert van.quantity == Decimal("493.000")  # 500 - 10 + 3


@pytest.mark.django_db
def test_distributor_sees_only_own_sales(auth_api, van_stocked, routed_clients):
    client, product = van_stocked["client"], van_stocked["product"]
    auth_api.post("/api/v1/sales/", _sale_body(client, product), format="json")

    from tests.conftest import _bearer

    other = _bearer("+998905554433")
    assert other.get("/api/v1/sales/").data["data"]["count"] == 0
    assert auth_api.get("/api/v1/sales/").data["data"]["count"] == 1


@pytest.mark.django_db
def test_sale_to_other_route_client_rejected(auth_api, van_stocked, routed_clients):
    """Tarqatuvchi boshqa marshrutdagi mijozga sota olmaydi (online)."""
    resp = auth_api.post(
        "/api/v1/sales/",
        _sale_body(routed_clients["other_client"], van_stocked["product"]),
        format="json",
    )
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "CLIENT_NOT_ON_ROUTE"


@pytest.mark.django_db
def test_sale_to_other_route_client_offline_flagged(
    auth_api, van_stocked, routed_clients
):
    """Offline (bulk-sync) — rad etilmaydi, belgilanadi (CLAUDE.md 4.4)."""
    op = {
        "type": "sale",
        "client_uuid": str(uuid.uuid4()),
        "payload": {
            "client": str(routed_clients["other_client"].id),
            "payment_type": "NAQD",
            "items": [
                {"product": str(van_stocked["product"].id),
                 "quantity": "2", "price": "27000"}
            ],
        },
    }
    resp = auth_api.post(
        "/api/v1/sales/bulk-sync/", {"operations": [op]}, format="json"
    )
    assert resp.status_code == 200
    res = resp.data["data"]["results"][0]
    assert res["status"] in ("SENT", "CONFLICT")
    assert "CLIENT_NOT_ON_ROUTE" in res["flags"]


@pytest.mark.django_db
def test_debt_payment_other_route_rejected(auth_api, van_stocked, routed_clients):
    """Boshqa marshrutdagi qarzni undirib bo'lmaydi."""
    debt = Debt.objects.create(
        client=routed_clients["other_client"], amount=Decimal("100000"),
        created_by=routed_clients["other_distributor"],
    )
    debt.recalc()
    debt.save()

    resp = auth_api.post(
        "/api/v1/debt-payments/",
        {"debt": str(debt.id), "amount": "50000", "payment_type": "NAQD"},
        format="json",
    )
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "DEBT_NOT_ON_ROUTE"


@pytest.mark.django_db
def test_return_more_than_sold_rejected(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    auth_api.post("/api/v1/sales/", _sale_body(client, product, qty="5"), format="json")

    resp = auth_api.post(
        "/api/v1/sale-returns/",
        {
            "client": str(client.id), "reason": "MUDDAT", "restock": True,
            "items": [{"product": str(product.id), "quantity": "8", "price": "27000"}],
        },
        format="json",
    )
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "RETURN_EXCEEDS_SOLD"
