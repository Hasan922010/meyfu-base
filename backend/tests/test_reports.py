"""6-bosqich: asosiy hisobotlar + Excel eksport."""
import pytest


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
def test_dashboard_kpi(auth_api, manager_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    _sale(auth_api, client, product, "10", price="27000")
    _sale(auth_api, client, product, "5", price="27000", payment="QARZ")

    resp = manager_api.get("/api/v1/reports/dashboard/")
    assert resp.status_code == 200
    kpi = resp.data["data"]["kpi"]
    assert kpi["sales_total"] == "405000.00"  # 270000 + 135000
    assert kpi["cash_in"] == "270000.00"
    assert kpi["debt_given"] == "135000.00"
    assert kpi["sales_count"] == 2
    assert len(resp.data["data"]["top_products"]) == 1


@pytest.mark.django_db
def test_dashboard_forbidden_for_distributor(auth_api):
    assert auth_api.get("/api/v1/reports/dashboard/").status_code == 403


@pytest.mark.django_db
def test_sales_summary_group_by(manager_api, auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    _sale(auth_api, client, product, "10")

    by_day = manager_api.get("/api/v1/reports/sales-summary/?group_by=day")
    assert by_day.status_code == 200
    assert len(by_day.data["data"]["rows"]) == 1

    by_prod = manager_api.get("/api/v1/reports/sales-summary/?group_by=product")
    assert by_prod.data["data"]["rows"][0]["product"] == "Test kukun 3kg"

    by_dist = manager_api.get("/api/v1/reports/sales-summary/?group_by=distributor")
    assert by_dist.data["data"]["rows"][0]["amount"] == "270000.00"


@pytest.mark.django_db
def test_excel_export(manager_api, auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    _sale(auth_api, client, product, "10")

    resp = manager_api.get("/api/v1/reports/export/?type=sales")
    assert resp.status_code == 200
    assert resp["Content-Type"] == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert resp["Content-Disposition"].startswith("attachment;")
    assert resp.content[:2] == b"PK"  # xlsx = zip
