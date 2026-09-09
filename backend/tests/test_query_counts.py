"""ORM-001 — ro'yxat endpointlarida so'rovlar soni ma'lumot hajmiga bog'liq
bo'lmasligi kerak (N+1 regressiyasini ushlaydi).

`django_assert_max_num_queries` chegara qiymati ataylab bir oz bo'sh — maqsad
"qatorlar ko'paysa so'rovlar ko'paymasin" ekanini kafolatlash.
"""
from decimal import Decimal

import pytest


def _make_sales(api, van_stocked, count: int, payment: str = "NAQD") -> None:
    body = {
        "client": str(van_stocked["client"].id),
        "payment_type": payment,
        "items": [
            {
                "product": str(van_stocked["product"].id),
                "quantity": "1",
                "price": "27000",
            }
        ],
    }
    for _ in range(count):
        resp = api.post("/api/v1/sales/", body, format="json")
        assert resp.status_code == 201, resp.data


@pytest.mark.django_db
def test_sales_list_query_count_is_bounded(
    auth_api, van_stocked, django_assert_max_num_queries
):
    _make_sales(auth_api, van_stocked, 8)
    with django_assert_max_num_queries(15):
        resp = auth_api.get("/api/v1/sales/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_sales_list_does_not_scale_with_rows(auth_api, van_stocked):
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    _make_sales(auth_api, van_stocked, 3)
    with CaptureQueriesContext(connection) as few:
        auth_api.get("/api/v1/sales/")
    _make_sales(auth_api, van_stocked, 7)
    with CaptureQueriesContext(connection) as many:
        auth_api.get("/api/v1/sales/")
    # 3 vs 10 sotuv — so'rovlar soni deyarli o'zgarmasligi kerak
    assert len(many.captured_queries) <= len(few.captured_queries) + 2


@pytest.mark.django_db
def test_clients_list_query_count_is_bounded(
    admin_api, routed_clients, django_assert_max_num_queries
):
    from apps.clients.models import Client

    Client.objects.bulk_create(
        Client(name=f"Do'kon {i}", route=routed_clients["my_route"])
        for i in range(20)
    )
    with django_assert_max_num_queries(12):
        resp = admin_api.get("/api/v1/clients/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_van_stock_my_query_count_is_bounded(
    auth_api, van_stocked, catalog, django_assert_max_num_queries
):
    from apps.catalog.models import Product
    from apps.warehouse.models import VanStock

    for i in range(10):
        p = Product.objects.create(
            name=f"Mahsulot {i}", sku=f"SKU-{i}", category=catalog["category"],
            unit=catalog["unit"], cost_price="1000", wholesale_price="1500",
            retail_price="2000", min_price="1200",
        )
        VanStock.objects.create(
            distributor=van_stocked["distributor"], product=p, quantity=Decimal("5")
        )
    with django_assert_max_num_queries(15):
        resp = auth_api.get("/api/v1/van-stock/my/")
    assert resp.status_code == 200
    assert len(resp.data["data"]) >= 10  # 10+ mahsulot bitta so'rovda


@pytest.mark.django_db
def test_debts_list_query_count_is_bounded(
    auth_api, van_stocked, django_assert_max_num_queries
):
    _make_sales(auth_api, van_stocked, 6, payment="QARZ")
    with django_assert_max_num_queries(15):
        resp = auth_api.get("/api/v1/debts/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_dashboard_query_count_is_bounded(
    auth_api, admin_api, van_stocked, django_assert_max_num_queries
):
    _make_sales(auth_api, van_stocked, 5)
    with django_assert_max_num_queries(40):
        resp = admin_api.get("/api/v1/reports/dashboard/")
    assert resp.status_code == 200
