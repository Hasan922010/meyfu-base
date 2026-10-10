"""Zakaz oluvchi (ORDER_TAKER) — faqat buyurtma oladi (CLAUDE.md 2, 18).

Buyurtma yaratadi, o'z buyurtmalari va marshrutidagi mijozlarni ko'radi, o'z
maoshini ko'radi. Sotuv, hamyon, xarajat, yuklama, kun yopish, qarz — yopiq.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.orders.models import Order

User = get_user_model()


def _login(phone: str) -> APIClient:
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/login/", {"phone": phone, "password": "pass12345"}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['data']['access']}")
    return client


@pytest.fixture
def order_taker(db):
    from apps.users.models import DistributorProfile

    user = User.objects.create_user(
        phone="+998907001122", password="pass12345", full_name="Test Zakazchi",
        role="ORDER_TAKER",
    )
    DistributorProfile.objects.create(user=user, order_commission_percent="2")
    return user


@pytest.fixture
def taker_api(order_taker):
    return _login("+998907001122")


@pytest.fixture
def taker_route(order_taker, routed_clients):
    """Zakaz oluvchi tarqatuvchining marshrutiga biriktirilgan."""
    route = routed_clients["my_route"]
    route.order_taker = order_taker
    route.save(update_fields=["order_taker"])
    return routed_clients


def _order_body(client, product) -> dict:
    return {
        "client": str(client.id),
        "items": [{"product": str(product.id), "quantity": "5", "price": "27000"}],
        "payment_intent": "NAQD",
    }


@pytest.mark.django_db
def test_order_taker_creates_order_for_own_route_client(
    taker_api, order_taker, taker_route, catalog
):
    resp = taker_api.post(
        "/api/v1/orders/", _order_body(taker_route["my_client"], catalog["product"]),
        format="json",
    )

    assert resp.status_code == 201, resp.data
    assert Order.objects.get(pk=resp.data["data"]["id"]).taken_by == order_taker


@pytest.mark.django_db
def test_order_taker_cannot_take_order_on_behalf_of_someone_else(
    taker_api, order_taker, taker_route, catalog, distributor
):
    body = {
        **_order_body(taker_route["my_client"], catalog["product"]),
        "taken_by": str(distributor.id),
    }

    resp = taker_api.post("/api/v1/orders/", body, format="json")

    assert Order.objects.get(pk=resp.data["data"]["id"]).taken_by == order_taker


@pytest.mark.django_db
def test_order_taker_sees_only_own_orders(
    taker_api, auth_api, taker_route, catalog
):
    auth_api.post(
        "/api/v1/orders/", _order_body(taker_route["my_client"], catalog["product"]),
        format="json",
    )
    taker_api.post(
        "/api/v1/orders/", _order_body(taker_route["my_client"], catalog["product"]),
        format="json",
    )

    listed = taker_api.get("/api/v1/orders/")
    mine = taker_api.get("/api/v1/orders/my-to-take/")

    assert listed.data["data"]["count"] == 1
    assert len(mine.data["data"]) == 1


@pytest.mark.django_db
def test_order_taker_sees_only_own_route_clients(taker_api, taker_route):
    listed = taker_api.get("/api/v1/clients/")
    synced = taker_api.get("/api/v1/sync/clients/")

    names = {c["name"] for c in listed.data["data"]["results"]}
    assert names == {"Do'kon A"}
    assert {c["name"] for c in synced.data["data"]["clients"]} == {"Do'kon A"}


@pytest.mark.django_db
def test_order_taker_can_create_clients(taker_api, taker_route):
    resp = taker_api.post(
        "/api/v1/clients/",
        {"name": "Yangi", "route": str(taker_route["my_route"].id)},
        format="json",
    )
    assert resp.status_code == 201



@pytest.mark.django_db
@pytest.mark.parametrize(
    "method,url",
    [
        ("get", "/api/v1/sales/"),
        ("post", "/api/v1/sales/"),
        ("get", "/api/v1/wallet/my/"),
        ("get", "/api/v1/expenses/"),
        ("get", "/api/v1/loadings/my-today/"),
        ("get", "/api/v1/van-stock/my/"),
        ("get", "/api/v1/day-close/"),
        ("get", "/api/v1/debt-payments/"),
        ("get", "/api/v1/payrolls/"),
        ("get", "/api/v1/users/"),
        ("get", "/api/v1/orders/my-to-deliver/"),
        ("get", "/api/v1/orders/for-loading/"),
        ("post", "/api/v1/receipt-scan/"),
    ],
)
def test_order_taker_is_denied_outside_orders(taker_api, method, url):
    resp = getattr(taker_api, method)(url, {}, format="json")

    assert resp.status_code == 403, (url, resp.status_code)


@pytest.mark.django_db
def test_order_taker_can_view_stock_and_debts(taker_api):
    # Zakaz oluvchi ombor qoldig'i va o'z marshruti qarzdorlarini ko'ra oladi
    stock_resp = taker_api.get("/api/v1/stock/")
    assert stock_resp.status_code == 200

    debts_resp = taker_api.get("/api/v1/debts/")
    assert debts_resp.status_code == 200


@pytest.mark.django_db
def test_order_taker_cannot_fulfill_or_approve(
    taker_api, taker_route, catalog
):
    created = taker_api.post(
        "/api/v1/orders/", _order_body(taker_route["my_client"], catalog["product"]),
        format="json",
    )
    order_id = created.data["data"]["id"]

    approve = taker_api.post(f"/api/v1/orders/{order_id}/approve/")
    fulfill = taker_api.post(f"/api/v1/orders/{order_id}/fulfill/", {}, format="json")

    assert approve.status_code == 403
    assert fulfill.status_code == 403

    # Lekin o'zining yangi olgan buyurtmasini bekor qila oladi
    cancel_resp = taker_api.post(
        f"/api/v1/orders/{order_id}/cancel/",
        {"reason": "Mijoz rad etdi"},
        format="json",
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.data["data"]["status"] == "CANCELLED"


@pytest.mark.django_db
def test_order_taker_sees_own_payroll(taker_api):
    resp = taker_api.get("/api/v1/payrolls/my/")

    assert resp.status_code == 200, resp.data


@pytest.mark.django_db
def test_admin_creates_order_taker_and_assigns_route(admin_api, routed_clients):
    created = admin_api.post(
        "/api/v1/users/",
        {
            "phone": "+998907003344", "full_name": "Yangi Zakazchi",
            "role": "ORDER_TAKER", "password": "pass12345",
            "distributor_profile": {"order_commission_percent": "1.5"},
        },
        format="json",
    )
    assert created.status_code == 201, created.data
    taker_id = str(created.data["data"]["id"])

    route = routed_clients["my_route"]
    resp = admin_api.patch(
        f"/api/v1/routes/{route.id}/", {"order_taker": taker_id}, format="json"
    )

    assert resp.status_code == 200, resp.data
    assert str(resp.data["data"]["order_taker"]) == taker_id
    assert resp.data["data"]["order_taker_name"] == "Yangi Zakazchi"


@pytest.mark.django_db
def test_route_order_taker_must_have_order_taker_role(
    admin_api, routed_clients, manager
):
    route = routed_clients["my_route"]

    resp = admin_api.patch(
        f"/api/v1/routes/{route.id}/", {"order_taker": str(manager.id)}, format="json"
    )

    assert resp.status_code == 400


@pytest.mark.django_db
def test_order_taker_cannot_order_for_client_off_own_route(
    taker_api, taker_route, catalog
):
    from apps.clients.models import Client

    routeless = Client.objects.create(name="Marshrutsiz do'kon")

    other = taker_api.post(
        "/api/v1/orders/", _order_body(taker_route["other_client"], catalog["product"]),
        format="json",
    )
    no_route = taker_api.post(
        "/api/v1/orders/", _order_body(routeless, catalog["product"]), format="json"
    )

    assert other.status_code == 409
    assert other.data["error"]["code"] == "CLIENT_NOT_ON_ROUTE"
    assert no_route.status_code == 409
    assert not Order.objects.exists()
