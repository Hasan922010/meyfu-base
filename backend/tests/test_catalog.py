import pytest

from apps.catalog.models import Product


@pytest.mark.django_db
def test_manager_can_create_product(manager_api, catalog):
    payload = {
        "name": "Yangi shampun",
        "sku": "SHMP-1",
        "category": str(catalog["category"].id),
        "unit": str(catalog["unit"].id),
        "retail_price": "15000",
        "min_price": "12000",
    }
    resp = manager_api.post("/api/v1/products/", payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["success"] is True
    assert Product.objects.filter(sku="SHMP-1").exists()


@pytest.mark.django_db
def test_distributor_cannot_create_product(auth_api, catalog):
    resp = auth_api.post(
        "/api/v1/products/",
        {"name": "x", "sku": "x", "category": str(catalog["category"].id),
         "unit": str(catalog["unit"].id)},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_manager_cannot_change_price_fields(manager_api, catalog):
    pid = catalog["product"].id
    resp = manager_api.patch(
        f"/api/v1/products/{pid}/", {"cost_price": "99999"}, format="json"
    )
    assert resp.status_code == 400
    catalog["product"].refresh_from_db()
    assert str(catalog["product"].cost_price) == "20000.00"


@pytest.mark.django_db
def test_admin_can_change_price_fields(admin_api, catalog):
    pid = catalog["product"].id
    resp = admin_api.patch(
        f"/api/v1/products/{pid}/", {"min_price": "26000"}, format="json"
    )
    assert resp.status_code == 200
    catalog["product"].refresh_from_db()
    assert str(catalog["product"].min_price) == "26000.00"


@pytest.mark.django_db
def test_product_search(manager_api, catalog):
    resp = manager_api.get("/api/v1/products/search/?q=kukun")
    assert resp.status_code == 200
    skus = [p["sku"] for p in resp.data["data"]]
    assert "PWD-3KG" in skus


@pytest.mark.django_db
def test_catalog_sync_delta(manager_api, catalog):
    from django.utils import timezone

    full = manager_api.get("/api/v1/sync/catalog/")
    assert full.status_code == 200
    assert full.data["data"]["count"] == 1

    since = timezone.now().isoformat()
    delta = manager_api.get("/api/v1/sync/catalog/", {"since": since})
    assert delta.status_code == 200, delta.data
    assert delta.data["data"]["count"] == 0


@pytest.mark.django_db
def test_create_rejects_min_price_above_retail(manager_api, catalog):
    payload = {
        "name": "Meyfu 300",
        "sku": "MEY-300",
        "category": str(catalog["category"].id),
        "unit": str(catalog["unit"].id),
        "retail_price": "5000",
        "min_price": "51000",
    }
    resp = manager_api.post("/api/v1/products/", payload, format="json")
    assert resp.status_code == 400
    assert "min_price" in str(resp.data)
    assert not Product.objects.filter(sku="MEY-300").exists()


@pytest.mark.django_db
def test_patch_checks_min_price_against_stored_retail(admin_api, catalog):
    product = catalog["product"]
    product.refresh_from_db()
    too_high = str(product.retail_price + 1)
    resp = admin_api.patch(
        f"/api/v1/products/{product.id}/", {"min_price": too_high}, format="json"
    )
    assert resp.status_code == 400
    product.refresh_from_db()
    assert product.min_price <= product.retail_price


@pytest.mark.django_db
def test_product_search_by_category_and_brand_and_q(manager_api, catalog):
    # Search by category name
    resp_cat = manager_api.get("/api/v1/products/?search=Kir yuvish")
    assert resp_cat.status_code == 200
    assert resp_cat.data["data"]["count"] == 1
    assert resp_cat.data["data"]["results"][0]["sku"] == "PWD-3KG"

    # Search by brand name
    resp_b = manager_api.get("/api/v1/products/?search=Test Brand")
    assert resp_b.status_code == 200
    assert resp_b.data["data"]["count"] == 1

    # Search by q param
    resp_q = manager_api.get("/api/v1/products/?q=kukun")
    assert resp_q.status_code == 200
    assert resp_q.data["data"]["count"] == 1

    # Search with no match
    resp_nomatch = manager_api.get("/api/v1/products/?search=topilmaydigan_narsa")
    assert resp_nomatch.status_code == 200
    assert resp_nomatch.data["data"]["count"] == 0


@pytest.mark.django_db
def test_product_export_permissions_formula_escape_and_branch_scope(
    admin_api, auth_api, catalog
):
    from decimal import Decimal

    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    from apps.catalog.models import BranchPrice
    from apps.users.constants import Role
    from apps.warehouse.constants import MovementType
    from apps.warehouse.models import Warehouse
    from apps.warehouse.services import apply_movement

    User = get_user_model()
    branch_a = Warehouse.objects.create(name="Filial A", is_branch=True)
    branch_b = Warehouse.objects.create(name="Filial B", is_branch=True)

    # Formula inyeksiyasini tekshirish uchun maxsus nom va SKU
    formula_prod = Product.objects.create(
        name="=SUM(A1)",
        sku="+CMD-1",
        category=catalog["category"],
        unit=catalog["unit"],
        cost_price=Decimal("10000"),
        wholesale_price=Decimal("15000"),
        retail_price=Decimal("18000"),
        min_price=Decimal("12000"),
    )
    apply_movement(
        warehouse=branch_a,
        product=formula_prod,
        quantity=Decimal("12"),
        movement_type=MovementType.IN_PURCHASE,
    )
    apply_movement(
        warehouse=branch_b,
        product=formula_prod,
        quantity=Decimal("99"),
        movement_type=MovementType.IN_PURCHASE,
    )
    BranchPrice.objects.create(
        branch=branch_a,
        product=formula_prod,
        wholesale_price=Decimal("17500"),
        retail_price=Decimal("20000"),
        min_price=Decimal("14000"),
    )

    # Tarqatuvchi eksport qila olmaydi
    assert auth_api.get("/api/v1/products/export/").status_code == 403

    # Markaziy buxgalter eksport qila oladi va CSV formula belgilari ekranlanadi
    accountant = User.objects.create_user(
        phone="+998901239988",
        password="pass12345",
        full_name="Buxgalter",
        role=Role.ACCOUNTANT,
    )
    acc_api = APIClient()
    acc_api.force_authenticate(user=accountant)
    acc_resp = acc_api.get("/api/v1/products/export/")
    assert acc_resp.status_code == 200
    csv_text = acc_resp.content.decode("utf-8")
    assert "'=SUM(A1)" in csv_text
    assert "'+CMD-1" in csv_text

    # Filial rahbari faqat o'z filiali narxi va ombor qoldig'ini eksportda va stock endpointida ko'radi
    import csv
    import io

    bm = User.objects.create_user(
        phone="+998901239977",
        password="pass12345",
        full_name="Filial A Rahbar",
        role=Role.BRANCH_MANAGER,
        warehouse=branch_a,
    )
    bm_api = APIClient()
    bm_api.force_authenticate(user=bm)
    bm_export = bm_api.get("/api/v1/products/export/")
    assert bm_export.status_code == 200
    bm_csv = bm_export.content.decode("utf-8").lstrip("\ufeff")
    rows = list(csv.DictReader(io.StringIO(bm_csv)))
    formula_row = next(r for r in rows if r["id"] == str(formula_prod.id))
    assert Decimal(formula_row["wholesale_price"]) == Decimal("17500")
    assert Decimal(formula_row["total_stock"]) == Decimal("12")
    assert Decimal(formula_row["available_stock"]) == Decimal("12")

    stock_resp = bm_api.get(f"/api/v1/products/{formula_prod.id}/stock/")
    assert stock_resp.status_code == 200
    wh_ids = [w["warehouse_id"] for w in stock_resp.data["data"]["by_warehouse"]]
    assert wh_ids == [str(branch_a.id)]
    assert Decimal(stock_resp.data["data"]["total"]) == Decimal("12")


