"""v5 B1: mahsulotlarni Excel'dan import qilish."""
from __future__ import annotations

import io
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook

from apps.catalog.models import Product, ProductPrice
from apps.core.models import AuditLog

URL = "/api/v1/products/import/"
HEADER = ["artikul", "nomi", "kategoriya", "birlik", "optom narx", "chakana narx",
          "minimal narx"]


def _xlsx(rows: list[list]) -> SimpleUploadedFile:
    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return SimpleUploadedFile(
        "products.xlsx", buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def _post(client, rows: list[list], dry_run: bool):
    return client.post(
        URL, {"file": _xlsx(rows), "dry_run": "true" if dry_run else "false"},
        format="multipart",
    )


@pytest.mark.django_db
def test_dry_run_writes_nothing(manager_api):
    resp = _post(manager_api, [HEADER, ["NEW-1", "Fairy 1L", "Idish", "dona", 15000,
                                        18000, 14000]], dry_run=True)

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["created"] == 1 and data["errors"] == 0
    assert not Product.objects.filter(sku="NEW-1").exists()


@pytest.mark.django_db
def test_import_creates_product_and_lookups(manager_api):
    resp = _post(manager_api, [HEADER, ["NEW-1", "Fairy 1L", "Idish", "litr", 15000,
                                        18000, 14000]], dry_run=False)

    assert resp.status_code == 200
    product = Product.objects.get(sku="NEW-1")
    assert product.category.name == "Idish"
    assert product.unit.name == "litr"
    assert product.wholesale_price == Decimal("15000")
    assert AuditLog.objects.filter(action="product.import").exists()


@pytest.mark.django_db
def test_row_error_rolls_back_whole_file(manager_api):
    rows = [HEADER,
            ["OK-1", "Yaxshi", "Idish", "dona", 1000, 1200, 900],
            ["BAD-1", "Yomon", "Idish", "dona", "abc", 1200, 900]]

    data = _post(manager_api, rows, dry_run=False).json()["data"]

    assert data["errors"] == 1
    assert data["rows"][1]["action"] == "ERROR"
    assert not Product.objects.filter(sku="OK-1").exists()


@pytest.mark.django_db
def test_manager_cannot_change_existing_price(manager_api, catalog):
    rows = [HEADER, ["PWD-3KG", "Test kukun 3kg", "", "", 99999, 28000, 24000]]

    data = _post(manager_api, rows, dry_run=False).json()["data"]

    assert data["errors"] == 1
    catalog["product"].refresh_from_db()
    assert catalog["product"].wholesale_price == Decimal("25000")


@pytest.mark.django_db
def test_super_admin_price_change_is_logged(admin_api, catalog):
    rows = [HEADER, ["PWD-3KG", "Test kukun 3kg", "", "", 26000, 28000, 24000]]

    data = _post(admin_api, rows, dry_run=False).json()["data"]

    assert data["updated"] == 1
    catalog["product"].refresh_from_db()
    assert catalog["product"].wholesale_price == Decimal("26000")
    assert ProductPrice.objects.filter(product=catalog["product"]).count() == 1
    log = AuditLog.objects.get(action="product.import")
    assert log.changes["price_changes"][0]["sku"] == "PWD-3KG"


@pytest.mark.django_db
def test_duplicate_sku_in_file_is_error(manager_api):
    rows = [HEADER,
            ["DUP", "A", "Idish", "dona", 1, 2, 1],
            ["DUP", "B", "Idish", "dona", 1, 2, 1]]

    data = _post(manager_api, rows, dry_run=True).json()["data"]

    assert data["errors"] == 1


@pytest.mark.django_db
def test_missing_required_columns(manager_api):
    resp = _post(manager_api, [["nomi"], ["Faqat nom"]], dry_run=True)

    assert resp.status_code == 409


@pytest.mark.django_db
def test_distributor_cannot_import(auth_api):
    resp = _post(auth_api, [HEADER], dry_run=True)

    assert resp.status_code == 403


@pytest.mark.django_db
def test_template_download(manager_api):
    resp = manager_api.get("/api/v1/products/import-template/")

    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("application/vnd.openxml")
