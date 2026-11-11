"""5-bosqich: Sotuv yadrosi + biznes qoidalari + offline (CLAUDE.md 5, 7, 4.6)."""
import re
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
    assert re.match(r"SOT-\d{4}-", d["number"])
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


@pytest.mark.django_db
def test_return_other_route_client_rejected(auth_api, van_stocked, routed_clients):
    """H1 regressiya: tarqatuvchi begona marshrut mijozidan qaytarish qabul
    qila olmaydi — aks holda o'z mashina qoldig'ini soxta qaytarish bilan
    shishira olardi (create_sale / debt-payment bilan bir xil himoya)."""
    resp = auth_api.post(
        "/api/v1/sale-returns/",
        {
            "client": str(routed_clients["other_client"].id),
            "reason": "MUDDAT",
            "restock": True,
            "items": [
                {"product": str(van_stocked["product"].id),
                 "quantity": "1", "price": "27000"}
            ],
        },
        format="json",
    )
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "CLIENT_NOT_ON_ROUTE"


@pytest.mark.django_db
def test_warehouse_can_make_sale_and_distribution(van_stocked):
    """Omborchi tarqatish/sotuv qila olishi tekshiruvi."""
    from rest_framework.test import APIClient

    from apps.users.models import User
    from apps.warehouse.models import VanStock

    wh_user = User.objects.create_user(
        phone="+998909990002", password="pass12345", full_name="Omborchi Tarqatuvchi",
        role="WAREHOUSE",
    )
    product = van_stocked["product"]
    client = van_stocked["client"]
    VanStock.objects.create(distributor=wh_user, product=product, quantity=Decimal("50"))

    wh_api = APIClient()
    wh_api.force_authenticate(user=wh_user)

    resp = wh_api.post(
        "/api/v1/sales/",
        {
            "client": str(client.id),
            "payment_type": "NAQD",
            "items": [{"product": str(product.id), "quantity": "5", "price": "25000"}],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    sale_data = resp.data["data"]
    assert sale_data["distributor_name"] == "Omborchi Tarqatuvchi"
    assert sale_data["total_amount"] == "125000.00"

    # Bugungi sotuvlari ro'yxatini ko'ra oladi
    resp_today = wh_api.get("/api/v1/sales/my-today/")
    assert resp_today.status_code == 200
    assert len(resp_today.data["data"]) >= 1


@pytest.mark.django_db
def test_bulk_sync_visit_enforces_scope_and_ownership(auth_api, van_stocked, routed_clients):
    from apps.clients.models import Client
    from apps.warehouse.models import Warehouse

    dist = van_stocked["distributor"]
    own_direct = Client.objects.create(name="Shaxsiy Mijoz", assigned_to=dist)
    branch = Warehouse.objects.create(name="Boshqa Filial", is_branch=True)
    branch_client = Client.objects.create(name="Filial Mijoz", branch=branch, assigned_to=dist)

    ops = [
        {"type": "visit", "client_uuid": str(uuid.uuid4()), "payload": {"client": str(routed_clients["other_client"].id), "result": "SOTUV"}},
        {"type": "visit", "client_uuid": str(uuid.uuid4()), "payload": {"client": str(branch_client.id), "result": "SOTUV"}},
        {"type": "visit", "client_uuid": str(uuid.uuid4()), "payload": {"client": str(own_direct.id), "result": "SOTUVSIZ"}},
    ]
    resp = auth_api.post("/api/v1/sales/bulk-sync/", {"operations": ops}, format="json")
    assert resp.status_code == 200, resp.data
    results = resp.data["data"]["results"]
    assert results[0]["status"] == "FAILED"
    assert results[0]["error"]["code"] == "CLIENT_NOT_ON_ROUTE"
    assert results[1]["status"] == "FAILED"
    assert results[1]["error"]["code"] == "BRANCH_MISMATCH"
    assert results[2]["status"] == "SENT"


@pytest.mark.django_db
def test_debts_and_payments_expose_and_search_by_client_phone(
    auth_api, manager_api, van_stocked, routed_clients
):
    from apps.clients.models import Client

    dist = van_stocked["distributor"]
    product = van_stocked["product"]
    c1 = Client.objects.create(
        name="Bir Xil Do'kon",
        phone="+998901110001",
        debt_limit="1000000",
        assigned_to=dist,
        route=routed_clients["my_route"],
    )
    c2 = Client.objects.create(
        name="Bir Xil Do'kon",
        phone="+998902220002",
        debt_limit="1000000",
        assigned_to=dist,
        route=routed_clients["my_route"],
    )

    assert auth_api.post(
        "/api/v1/sales/",
        {
            "client": str(c1.id),
            "payment_type": "QARZ",
            "due_date": "2026-12-01",
            "items": [{"product": str(product.id), "quantity": "2", "price": "25000"}],
        },
        format="json",
    ).status_code == 201
    assert auth_api.post(
        "/api/v1/sales/",
        {
            "client": str(c2.id),
            "payment_type": "QARZ",
            "due_date": "2026-12-01",
            "items": [{"product": str(product.id), "quantity": "3", "price": "25000"}],
        },
        format="json",
    ).status_code == 201

    debts_resp = manager_api.get("/api/v1/debts/", {"search": "902220002"})
    assert debts_resp.status_code == 200
    results = debts_resp.json()["data"]["results"]
    assert len(results) == 1
    assert results[0]["client"] == str(c2.id)
    assert results[0]["client_phone"] == "+998902220002"

    my_resp = auth_api.get("/api/v1/debts/my/")
    assert my_resp.status_code == 200
    phones = {d["client_phone"] for d in my_resp.data["data"]}
    assert {"+998901110001", "+998902220002"} <= phones

    debt_c2 = Debt.objects.get(client=c2)
    pay = auth_api.post(
        "/api/v1/debt-payments/",
        {"debt": str(debt_c2.id), "amount": "25000", "payment_type": "NAQD"},
        format="json",
    )
    assert pay.status_code == 201
    assert pay.data["data"]["client_phone"] == "+998902220002"

    pay_list = manager_api.get("/api/v1/debt-payments/", {"search": "902220002"})
    assert pay_list.status_code == 200
    pay_rows = pay_list.data["data"]["results"]
    assert len(pay_rows) == 1
    assert pay_rows[0]["client_phone"] == "+998902220002"


@pytest.mark.django_db
def test_cancel_sale_blocked_when_linked_or_unlinked_return_exists(
    auth_api, manager_api, van_stocked
):
    from apps.clients.models import Client

    client, product = van_stocked["client"], van_stocked["product"]
    distributor = van_stocked["distributor"]

    sale1 = auth_api.post(
        "/api/v1/sales/", _sale_body(client, product, qty="10"), format="json"
    ).data["data"]
    ret1 = auth_api.post(
        "/api/v1/sale-returns/",
        {
            "client": str(client.id),
            "sale": sale1["id"],
            "reason": "MUDDAT",
            "restock": True,
            "items": [{"product": str(product.id), "quantity": "4", "price": "27000"}],
        },
        format="json",
    )
    assert ret1.status_code == 201

    cancel1 = manager_api.post(f"/api/v1/sales/{sale1['id']}/cancel/", {}, format="json")
    assert cancel1.status_code == 409
    assert cancel1.data["error"]["code"] == "SALE_HAS_RETURNS"
    assert VanStock.objects.get(distributor=distributor, product=product).quantity == Decimal(
        "494.000"
    )

    # Bog'lanmagan (sale=None) qaytarish ham shu mahsulotdagi yagona sotuvni bekor qilishni to'xtatadi
    client2 = Client.objects.create(
        name="Boshqa Do'kon 2", phone="+998903334455", assigned_to=distributor
    )
    sale2 = auth_api.post(
        "/api/v1/sales/", _sale_body(client2, product, qty="6"), format="json"
    ).data["data"]
    ret2 = auth_api.post(
        "/api/v1/sale-returns/",
        {
            "client": str(client2.id),
            "reason": "BRAK",
            "restock": True,
            "items": [{"product": str(product.id), "quantity": "2", "price": "27000"}],
        },
        format="json",
    )
    assert ret2.status_code == 201
    cancel2 = manager_api.post(f"/api/v1/sales/{sale2['id']}/cancel/", {}, format="json")
    assert cancel2.status_code == 409
    assert cancel2.data["error"]["code"] == "SALE_HAS_RETURNS"


@pytest.mark.django_db
def test_van_expected_quantity_excludes_cancelled_sale_return(auth_api, van_stocked):
    from apps.warehouse.services.van import van_expected_quantity

    client, product = van_stocked["client"], van_stocked["product"]
    distributor = van_stocked["distributor"]

    sale = auth_api.post(
        "/api/v1/sales/", _sale_body(client, product, qty="10"), format="json"
    ).data["data"]
    ret = auth_api.post(
        "/api/v1/sale-returns/",
        {
            "client": str(client.id),
            "sale": sale["id"],
            "reason": "MUDDAT",
            "restock": True,
            "items": [{"product": str(product.id), "quantity": "3", "price": "27000"}],
        },
        format="json",
    )
    assert ret.status_code == 201
    assert van_expected_quantity(distributor, product) == Decimal("493.000")

    # Bekor qilingan sotuvga bog'liq qaytarish kutilgan qoldiqqa qo'shilmaydi
    Sale.objects.filter(pk=sale["id"]).update(status="CANCELLED")
    assert van_expected_quantity(distributor, product) == Decimal("500.000")


@pytest.mark.django_db
def test_warehouse_role_permissions_and_self_only_isolation(van_stocked, expense_categories):
    from rest_framework.test import APIClient

    from apps.users.models import User

    product = van_stocked["product"]
    client = van_stocked["client"]
    wh1 = User.objects.create_user(
        phone="+998908880001", password="pass12345", full_name="Omborchi 1", role="WAREHOUSE"
    )
    wh2 = User.objects.create_user(
        phone="+998908880002", password="pass12345", full_name="Omborchi 2", role="WAREHOUSE"
    )
    VanStock.objects.create(distributor=wh1, product=product, quantity=Decimal("40"))
    VanStock.objects.create(distributor=wh2, product=product, quantity=Decimal("40"))

    api1, api2 = APIClient(), APIClient()
    api1.force_authenticate(user=wh1)
    api2.force_authenticate(user=wh2)

    # Omborchida sukut bo'yicha can_record_expenses=False -> 403 qaytaradi
    assert (
        api1.post(
            "/api/v1/expenses/",
            {
                "category": str(expense_categories["lunch"].id),
                "amount": "15000",
                "payment_source": "CASH_ON_HAND",
            },
            format="json",
        ).status_code
        == 403
    )

    # Admin can_record_expenses yoqqanda xarajat ham yozadi va self-only ajratiladi
    for wh in (wh1, wh2):
        wh.can_record_expenses = True
        wh.save(update_fields=["can_record_expenses"])

    for api_c in (api1, api2):
        sale_resp = api_c.post(
            "/api/v1/sales/",
            _sale_body(client, product, qty="5", payment="QARZ", due_date="2026-12-01"),
            format="json",
        )
        assert sale_resp.status_code == 201
        debt = Debt.objects.get(sale_id=sale_resp.data["data"]["id"])
        assert (
            api_c.post(
                "/api/v1/debt-payments/",
                {"debt": str(debt.id), "amount": "10000", "payment_type": "NAQD"},
                format="json",
            ).status_code
            == 201
        )
        assert (
            api_c.post(
                "/api/v1/sale-returns/",
                {
                    "client": str(client.id),
                    "reason": "MUDDAT",
                    "restock": True,
                    "items": [{"product": str(product.id), "quantity": "1", "price": "27000"}],
                },
                format="json",
            ).status_code
            == 201
        )
        assert (
            api_c.post(
                "/api/v1/expenses/",
                {
                    "category": str(expense_categories["lunch"].id),
                    "amount": "15000",
                    "payment_source": "CASH_ON_HAND",
                },
                format="json",
            ).status_code
            == 201
        )
        assert (
            api_c.post(
                "/api/v1/day-close/submit/",
                {
                    "warehouse": str(van_stocked["warehouse"].id),
                    "items": [],
                    "cash_handed": "0",
                },
                format="json",
            ).status_code
            == 201
        )

    assert api1.get("/api/v1/sales/").data["data"]["count"] == 1
    assert api1.get("/api/v1/debt-payments/").data["data"]["count"] == 1
    assert api1.get("/api/v1/sale-returns/").data["data"]["count"] == 1
    assert api1.get("/api/v1/expenses/").data["data"]["count"] == 1
    assert api1.get("/api/v1/wallet/").data["data"]["count"] == 1
    assert api1.get("/api/v1/day-close/").data["data"]["count"] == 1
    assert str(api1.get("/api/v1/sales/").data["data"]["results"][0]["distributor"]) == str(wh1.id)


@pytest.mark.django_db
def test_bulk_sync_enforces_granular_permissions(auth_api, van_stocked, expense_categories):
    dist = van_stocked["distributor"]
    dist.can_make_sales = False
    dist.can_record_expenses = False
    dist.can_take_orders = False
    dist.save(update_fields=["can_make_sales", "can_record_expenses", "can_take_orders"])

    ops = [
        {
            "type": "sale",
            "client_uuid": str(uuid.uuid4()),
            "payload": {
                "client": str(van_stocked["client"].id),
                "payment_type": "NAQD",
                "items": [{"product": str(van_stocked["product"].id), "quantity": "1", "price": "27000"}],
            },
        },
        {
            "type": "expense",
            "client_uuid": str(uuid.uuid4()),
            "payload": {
                "category": str(expense_categories["lunch"].id),
                "amount": "15000",
                "payment_source": "CASH_ON_HAND",
            },
        },
        {
            "type": "order_create",
            "client_uuid": str(uuid.uuid4()),
            "payload": {
                "client": str(van_stocked["client"].id),
                "payment_intent": "NAQD",
                "items": [{"product": str(van_stocked["product"].id), "quantity": "1", "price": "27000"}],
            },
        },
        {
            "type": "sale_return",
            "client_uuid": str(uuid.uuid4()),
            "payload": {
                "client": str(van_stocked["client"].id),
                "reason": "MUDDAT",
                "restock": True,
                "items": [{"product": str(van_stocked["product"].id), "quantity": "1", "price": "27000"}],
            },
        },
    ]
    resp = auth_api.post("/api/v1/sales/bulk-sync/", {"operations": ops}, format="json")
    assert resp.status_code == 200
    codes = [r["error"]["code"] for r in resp.data["data"]["results"]]
    assert all(r["status"] == "FAILED" for r in resp.data["data"]["results"])
    assert codes == [
        "SALES_FORBIDDEN",
        "EXPENSE_RECORDING_FORBIDDEN",
        "ORDER_TAKING_FORBIDDEN",
        "SALES_FORBIDDEN",
    ]

