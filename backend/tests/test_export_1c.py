"""v5 C6: 1C uchun XML/CSV eksport."""
from __future__ import annotations

from xml.etree import ElementTree as ET

import pytest

from apps.core.models import AuditLog

URL = "/api/v1/reports/export-1c/"


@pytest.fixture
def sold(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    client.name = "=HYPERLINK(\"x\")"
    client.save(update_fields=["name"])
    body = {
        "client": str(client.id), "payment_type": "NAQD",
        "items": [{"product": str(product.id), "quantity": "3", "price": "27000"}],
    }
    assert auth_api.post("/api/v1/sales/", body, format="json").status_code == 201
    return van_stocked


@pytest.mark.django_db
def test_xml_export_contains_sale_and_catalog(manager_api, sold):
    resp = manager_api.get(URL, {"fmt": "xml"})

    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("application/xml")
    root = ET.fromstring(resp.content)
    sale = root.find("Documents/Sale")
    assert sale is not None and sale.get("total") == "81000.00"
    assert sale.find("Item").get("quantity") == "3.000"
    assert root.find("Catalog/Product").get("sku") == "PWD-3KG"
    assert AuditLog.objects.filter(action="export.1c").exists()


@pytest.mark.django_db
def test_csv_export_rows_and_formula_guard(manager_api, sold):
    resp = manager_api.get(URL, {"fmt": "csv"})

    text = resp.content.decode("utf-8-sig")
    lines = text.strip().splitlines()
    assert lines[0].startswith("doc_type;number;date")
    assert lines[1].startswith("SALE;SOT-")
    # mijoz nomi formula sifatida bajarilmasin
    assert "'=HYPERLINK" in lines[1]
    assert ";=HYPERLINK" not in lines[1] and ';"=HYPERLINK' not in lines[1]


@pytest.mark.django_db
def test_invalid_format_rejected(manager_api):
    assert manager_api.get(URL, {"fmt": "pdf"}).status_code == 400


@pytest.mark.django_db
def test_distributor_cannot_export(auth_api):
    assert auth_api.get(URL).status_code == 403
