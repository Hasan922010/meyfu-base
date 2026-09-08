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
