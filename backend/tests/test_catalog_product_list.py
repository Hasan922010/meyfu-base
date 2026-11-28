
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
def test_product_xlsx_export_reuses_filters_and_sorts_by_category_then_name(manager_api, stocked, catalog):
    import io

    from openpyxl import load_workbook

    from apps.catalog.models import Category, Product

    cat_a = Category.objects.create(name="AAA Kategoriya")
    Product.objects.create(
        name="Zaytun",
        sku="ZAY-1",
        barcode="999001",
        category=cat_a,
        unit=catalog["unit"],
        cost_price="10000",
        wholesale_price="12000",
        retail_price="15000",
        min_price="11000",
    )
    Product.objects.create(
        name="Anor",
        sku="ANR-1",
        barcode="999002",
        category=cat_a,
        unit=catalog["unit"],
        cost_price="10000",
        wholesale_price="12000",
        retail_price="15000",
        min_price="11000",
    )

    response = manager_api.get("/api/v1/products/export/")
    assert response.status_code == 200
    assert response["Content-Type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.content[:2] == b"PK"

    wb = load_workbook(io.BytesIO(response.content))
    ws = wb.active
    assert ws.freeze_panes == "A2"
    rows = list(ws.iter_rows(values_only=True))
    cat_names = [(r[1], r[2]) for r in rows[1:]]
    assert cat_names.index(("AAA Kategoriya", "Anor")) < cat_names.index(("AAA Kategoriya", "Zaytun"))

    filtered = manager_api.get(
        "/api/v1/products/export/?stock_status=ok&ordering=-retail_price"
    )
    assert filtered.status_code == 200
    wb_f = load_workbook(io.BytesIO(filtered.content))
    skus = [r[3] for r in list(wb_f.active.iter_rows(values_only=True))[1:]]
    assert "PWD-3KG" in skus


@pytest.mark.django_db
def test_product_warehouse_assignment_and_filtering(manager_api, catalog, warehouse):
    """Har bir mahsulot omborga biriktiriladi va ombor bo'yicha ajratiladi."""
    from apps.catalog.models import Product
    from apps.warehouse.models import Warehouse

    wh1 = warehouse["warehouse"]
    wh2 = Warehouse.objects.create(name="Ikkinchi ombor", address="Toshkent 2")

    p1 = Product.objects.create(
        name="Choy 100g",
        sku="CHOY-100",
        category=catalog["category"],
        unit=catalog["unit"],
        retail_price="10000",
        warehouse=wh1,
    )
    p2 = Product.objects.create(
        name="Kofe 50g",
        sku="KOFE-50",
        category=catalog["category"],
        unit=catalog["unit"],
        retail_price="20000",
    )

    r_unassigned = manager_api.get("/api/v1/products/", {"unassigned": "true"})
    assert r_unassigned.status_code == 200
    unassigned_skus = [row["sku"] for row in r_unassigned.data["data"]["results"]]
    assert "KOFE-50" in unassigned_skus
    assert "CHOY-100" not in unassigned_skus

    r_assign = manager_api.post(
        "/api/v1/products/assign-warehouse/",
        {"ids": [str(p2.id)], "warehouse": str(wh2.id)},
        format="json",
    )
    assert r_assign.status_code == 200, r_assign.data
    assert r_assign.data["data"]["updated"] == 1
    assert r_assign.data["data"]["warehouse_name"] == "Ikkinchi ombor"

    p2.refresh_from_db()
    assert p2.warehouse_id == wh2.id

    r_wh1 = manager_api.get("/api/v1/products/", {"warehouse": str(wh1.id)})
    assert [row["sku"] for row in r_wh1.data["data"]["results"]] == ["CHOY-100"]

    r_wh2 = manager_api.get("/api/v1/products/", {"warehouse": str(wh2.id)})
    assert [row["sku"] for row in r_wh2.data["data"]["results"]] == ["KOFE-50"]
    assert r_wh2.data["data"]["results"][0]["warehouse_name"] == "Ikkinchi ombor"

    p1.refresh_from_db()
    assert p1.warehouse_id == wh1.id
