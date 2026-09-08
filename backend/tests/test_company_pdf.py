"""v4 T3 — kompaniya rekvizitlari, muhr, nakladnoy/yuklama PDF."""
from __future__ import annotations

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.core.models import CompanySettings


def _png(name: str = "stamp.png") -> SimpleUploadedFile:
    buf = io.BytesIO()
    Image.new("RGBA", (200, 200), (255, 0, 0, 120)).save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def _make_purchase(api, warehouse, product):
    payload = {
        "supplier": str(warehouse["supplier"].id),
        "warehouse": str(warehouse["warehouse"].id),
        "invoice_number": "NKL-77",
        "date": "2026-09-01",
        "items": [{"product": str(product.id), "quantity": "12", "cost_price": "20000"}],
    }
    resp = api.post("/api/v1/purchases/", payload, format="json")
    assert resp.status_code == 201, resp.data
    return resp.data["data"]["id"]


# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_company_settings_read_and_update(admin_api, manager_api):
    get = manager_api.get("/api/v1/company-settings/")
    assert get.status_code == 200

    patch = admin_api.patch(
        "/api/v1/company-settings/",
        {"name": "MeyFu Distribution", "inn": "301234567", "phone": "+998901234567"},
        format="json",
    )
    assert patch.status_code == 200, patch.data
    assert patch.data["data"]["name"] == "MeyFu Distribution"
    assert CompanySettings.objects.count() == 1  # singleton


@pytest.mark.django_db
def test_company_settings_update_forbidden_for_manager(manager_api):
    resp = manager_api.patch(
        "/api/v1/company-settings/", {"name": "x"}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_company_public_returns_stamp_data_uri(admin_api, auth_api):
    admin_api.patch(
        "/api/v1/company-settings/",
        {"name": "MeyFu", "stamp": _png()},
        format="multipart",
    )
    resp = auth_api.get("/api/v1/company/public/")
    assert resp.status_code == 200
    assert resp.data["data"]["name"] == "MeyFu"
    assert resp.data["data"]["stamp"].startswith("data:image/png;base64,")


@pytest.mark.django_db
def test_purchase_pdf_plain_and_stamped(manager_api, admin_api, catalog, warehouse):
    pid = _make_purchase(manager_api, warehouse, catalog["product"])

    plain = manager_api.get(f"/api/v1/purchases/{pid}/pdf/")
    assert plain.status_code == 200
    assert plain["Content-Type"] == "application/pdf"
    assert plain.content[:4] == b"%PDF"

    # muhr yo'q — stamp=1 baribir crash bermaydi
    stamped = manager_api.get(f"/api/v1/purchases/{pid}/pdf/?stamp=1")
    assert stamped.status_code == 200
    assert stamped.content[:4] == b"%PDF"

    admin_api.patch(
        "/api/v1/company-settings/",
        {"name": "MeyFu", "stamp": _png()},
        format="multipart",
    )
    with_stamp = manager_api.get(f"/api/v1/purchases/{pid}/pdf/?stamp=1")
    assert with_stamp.status_code == 200
    assert len(with_stamp.content) > len(plain.content)


@pytest.mark.django_db
def test_purchase_pdf_with_product_image(manager_api, catalog, warehouse):
    buf = io.BytesIO()
    Image.new("RGB", (600, 600), "green").save(buf, format="JPEG")
    manager_api.post(
        f"/api/v1/products/{catalog['product'].id}/images/",
        {"images": [SimpleUploadedFile("g.jpg", buf.getvalue(),
                                       content_type="image/jpeg")]},
        format="multipart",
    )
    pid = _make_purchase(manager_api, warehouse, catalog["product"])
    resp = manager_api.get(f"/api/v1/purchases/{pid}/pdf/")
    assert resp.status_code == 200
    assert resp.content[:4] == b"%PDF"


@pytest.mark.django_db
def test_loading_pdf(manager_api, van_stocked):
    loading = van_stocked["loading"]
    resp = manager_api.get(f"/api/v1/loadings/{loading.id}/pdf/?stamp=0")
    assert resp.status_code == 200
    assert resp.content[:4] == b"%PDF"


@pytest.mark.django_db
def test_distributor_cannot_get_purchase_pdf(auth_api, manager_api, catalog, warehouse):
    pid = _make_purchase(manager_api, warehouse, catalog["product"])
    resp = auth_api.get(f"/api/v1/purchases/{pid}/pdf/")
    assert resp.status_code in (403, 404)
