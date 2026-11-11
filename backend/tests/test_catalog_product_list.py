
import pytest


@pytest.mark.django_db
def test_product_list_includes_aggregated_stock(manager_api, stocked):
    response = manager_api.get("/api/v1/products/")
    assert response.status_code == 200, response.data
    row = response.data["data"]["results"][0]
    assert row["total_stock"] == "500.000"
    assert row["reserved_stock"] == "0.000"
    assert row["available_stock"] == "500.000"
    assert row["stock_status"] == "ok"


@pytest.mark.django_db
def test_product_list_filters_and_ordering(manager_api, catalog, warehouse):
    from apps.catalog.models import Product
    from apps.warehouse.models import Stock

    low = Product.objects.create(
        name="Low item", sku="LOW-1", category=catalog["category"],
        brand=catalog["brand"], unit=catalog["unit"], retail_price="100",
        min_stock_alert="5",
    )
    Stock.objects.create(
        warehouse=warehouse["warehouse"], product=low, quantity="2",
    )
    response = manager_api.get(
        "/api/v1/products/",
        {
            "category": str(catalog["category"].id),
            "warehouse": str(warehouse["warehouse"].id),
            "stock_status": "low",
            "retail_price_min": "99",
            "retail_price_max": "101",
            "ordering": "-available_stock",
        },
    )
    assert response.status_code == 200, response.data
    rows = response.data["data"]["results"]
    assert [row["sku"] for row in rows] == ["LOW-1"]
    assert rows[0]["stock_status"] == "low"


@pytest.mark.django_db
def test_product_list_search_and_price_ordering(manager_api, catalog):
    from apps.catalog.models import Product

    Product.objects.create(
        name="Alpha", sku="A-1", category=catalog["category"],
        unit=catalog["unit"], retail_price="100",
    )
    response = manager_api.get(
        "/api/v1/products/", {"search": "A-1", "ordering": "retail_price"}
    )
    assert response.status_code == 200
    assert [row["sku"] for row in response.data["data"]["results"]] == ["A-1"]


@pytest.mark.django_db
def test_product_bulk_actions_and_permissions(manager_api, auth_api, catalog):
    from apps.catalog.models import Product

    other = Product.objects.create(
        name="Other", sku="OTHER-1", category=catalog["category"],
        unit=catalog["unit"],
    )
    denied = auth_api.post(
        "/api/v1/products/bulk/",
        {"ids": [str(other.id)], "action": "activate"},
        format="json",
    )
    assert denied.status_code == 403
    response = manager_api.post(
        "/api/v1/products/bulk/",
        {"ids": [str(catalog["product"].id), str(other.id)], "action": "deactivate"},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["data"]["updated"] == 2
    assert Product.objects.filter(id__in=[catalog["product"].id, other.id], is_active=False).count() == 2


@pytest.mark.django_db
def test_product_bulk_validation_limits_batch(manager_api, catalog):
    response = manager_api.post(
        "/api/v1/products/bulk/",
        {"ids": [str(catalog["product"].id)] * 101, "action": "activate"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_product_bulk_soft_delete_uses_project_convention(manager_api, catalog):
    response = manager_api.post(
        "/api/v1/products/bulk/",
        {"ids": [str(catalog["product"].id)], "action": "delete"},
        format="json",
    )
    assert response.status_code == 200
    assert not type(catalog["product"]).objects.filter(pk=catalog["product"].id).exists()
    assert type(catalog["product"]).all_objects.get(pk=catalog["product"].id).is_deleted is True


@pytest.mark.django_db
def test_product_csv_export_reuses_filters(manager_api, stocked):
    response = manager_api.get(
        "/api/v1/products/export/?stock_status=ok&ordering=-retail_price"
    )
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    assert response.content.startswith(b"\xef\xbb\xbf")
    body = response.content.decode("utf-8-sig")
    assert "total_stock" in body
    assert "PWD-3KG" in body