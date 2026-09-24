"""Jadvallar: har bir ustun bo'yicha server tomonida saralash va asosiy filtrlar.

DRF OrderingFilter ruxsat etilmagan maydonni jimgina e'tiborsiz qoldiradi — shuning
uchun bu testlar status 200 ni emas, haqiqiy tartibni tekshiradi.
"""
import pytest

from apps.clients.models import Client


def _sale(api, client, product, qty, date=None):
    body = {
        "client": str(client.id),
        "payment_type": "NAQD",
        "items": [{"product": str(product.id), "quantity": qty, "price": "27000"}],
    }
    if date:
        body["date"] = date
    resp = api.post("/api/v1/sales/", body, format="json")
    assert resp.status_code == 201, resp.data
    return resp.data["data"]


def _column(resp, key):
    assert resp.status_code == 200, resp.data
    return [row[key] for row in resp.data["data"]["results"]]


@pytest.mark.django_db
def test_sales_sort_by_client_and_number_and_filter_by_date(
    auth_api, manager_api, van_stocked
):
    a = van_stocked["client"]  # "Do'kon A"
    anor = Client.objects.create(name="Anor", route=a.route)
    _sale(auth_api, a, van_stocked["product"], "1", date="2026-09-01")
    _sale(auth_api, anor, van_stocked["product"], "2", date="2026-09-10")

    by_client = manager_api.get("/api/v1/sales/?ordering=client__name")
    assert _column(by_client, "client_name") == ["Anor", "Do'kon A"]
    by_client_desc = manager_api.get("/api/v1/sales/?ordering=-client__name")
    assert _column(by_client_desc, "client_name") == ["Do'kon A", "Anor"]

    by_number = manager_api.get("/api/v1/sales/?ordering=number")
    numbers = _column(by_number, "number")
    assert numbers == sorted(numbers)

    in_range = manager_api.get("/api/v1/sales/?date__gte=2026-09-05&date__lte=2026-09-30")
    assert _column(in_range, "client_name") == ["Anor"]


@pytest.mark.django_db
def test_clients_sort_by_route_and_owner(manager_api, routed_clients):
    by_route = manager_api.get("/api/v1/clients/?ordering=route__name")
    assert _column(by_route, "name") == ["Do'kon A", "Do'kon B"]  # Chilonzor < Yunusobod
    by_route_desc = manager_api.get("/api/v1/clients/?ordering=-route__name")
    assert _column(by_route_desc, "name") == ["Do'kon B", "Do'kon A"]
