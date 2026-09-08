"""11-bosqich: Naklit OCR — skan, moslashtirish, tekshirish, tasdiqlash, metrikalar."""
import io
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.catalog.models import ProductAlias
from apps.ocr.models import InvoiceScan, InvoiceScanLine
from apps.ocr.services.matching import match_line
from apps.warehouse.models import Purchase, Stock


def _jpeg() -> SimpleUploadedFile:
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), "white").save(buf, format="JPEG")
    return SimpleUploadedFile("nakl.jpg", buf.getvalue(), content_type="image/jpeg")


def _upload(api, warehouse, supplier=None, images=1):
    payload = {"warehouse": str(warehouse.id), "scan_type": "INVOICE"}
    if supplier:
        payload["supplier"] = str(supplier.id)
    payload["images"] = [_jpeg() for _ in range(images)]
    return api.post("/api/v1/invoice-scans/", payload, format="multipart")


@pytest.mark.django_db
def test_upload_and_process(manager_api, catalog, warehouse):
    resp = _upload(manager_api, warehouse["warehouse"], warehouse["supplier"])
    assert resp.status_code == 201, resp.data
    d = resp.data["data"]
    assert d["status"] == "NEEDS_REVIEW"
    assert d["provider"] == "mock"
    assert d["detected_invoice_number"] == "MOCK-0001"
    assert len(d["lines"]) == 2

    # 1-qator katalogdagi "Test kukun 3kg" bilan mos
    line1 = next(x for x in d["lines"] if "kukun" in x["raw_name"])
    assert line1["match_status"] == "EXACT"
    assert line1["final_product"] is not None

    # 2-qator — topilmadi
    line2 = next(x for x in d["lines"] if "XYZ" in x["raw_name"])
    assert line2["match_status"] in ("NEW", "UNMATCHED")
    assert line2["final_product"] is None
    assert line2["low_confidence"] is True


@pytest.mark.django_db
def test_edit_line_marks_corrected(manager_api, catalog, warehouse):
    scan_id = _upload(
        manager_api, warehouse["warehouse"], warehouse["supplier"]
    ).data["data"]["id"]
    line = InvoiceScanLine.objects.get(scan_id=scan_id, raw_name__icontains="XYZ")

    resp = manager_api.patch(
        f"/api/v1/invoice-scans/{scan_id}/lines/{line.id}/",
        {"final_product": str(catalog["product"].id), "final_quantity": "10",
         "final_price": "5000"},
        format="json",
    )
    assert resp.status_code == 200
    line.refresh_from_db()
    assert line.was_corrected is True
    assert line.final_product_id == catalog["product"].id


@pytest.mark.django_db
def test_confirm_creates_purchase_and_learns_alias(manager_api, catalog, warehouse):
    scan_id = _upload(
        manager_api, warehouse["warehouse"], warehouse["supplier"]
    ).data["data"]["id"]

    # XYZ qatorini katalogга bog'laymiz
    xyz = InvoiceScanLine.objects.get(scan_id=scan_id, raw_name__icontains="XYZ")
    manager_api.patch(
        f"/api/v1/invoice-scans/{scan_id}/lines/{xyz.id}/",
        {"final_product": str(catalog["product"].id), "final_quantity": "10",
         "final_price": "5000"},
        format="json",
    )

    resp = manager_api.post(f"/api/v1/invoice-scans/{scan_id}/confirm/")
    assert resp.status_code == 200, resp.data
    assert resp.data["data"]["status"] == "CONFIRMED"

    purchase = Purchase.objects.get(invoice_scan__id=scan_id)
    assert purchase.source == "SCAN"
    assert purchase.status == "CONFIRMED"

    # qoldiq oshdi (kukun: 50 EXACT + XYZ 10 tuzatilgan → 60)
    stock = Stock.objects.get(
        warehouse=warehouse["warehouse"], product=catalog["product"]
    )
    assert stock.quantity == Decimal("60.000")

    # tuzatilgan nom alias sifatida saqlandi (tizim o'rgandi)
    assert ProductAlias.objects.filter(
        product=catalog["product"], alias_text="Nomalum tovar XYZ"
    ).exists()


@pytest.mark.django_db
def test_learned_alias_matches_next_time(manager_api, catalog, warehouse):
    ProductAlias.objects.create(
        product=catalog["product"], alias_text="Nomalum tovar XYZ",
        supplier=warehouse["supplier"],
    )
    product, conf, status = match_line(
        "Nomalum tovar XYZ", supplier_id=warehouse["supplier"].id
    )
    assert product == catalog["product"]
    assert status == "EXACT"
    assert conf == 100


@pytest.mark.django_db
def test_fuzzy_match(catalog, warehouse):
    # "Test kukun 3 kg" ~ "Test kukun 3kg"
    product, conf, status = match_line("Test kukun 3 kg")
    assert product == catalog["product"]
    assert status in ("EXACT", "FUZZY")


@pytest.mark.django_db
def test_confirm_without_supplier_rejected(manager_api, catalog, warehouse):
    scan_id = _upload(manager_api, warehouse["warehouse"]).data["data"]["id"]
    resp = manager_api.post(f"/api/v1/invoice-scans/{scan_id}/confirm/")
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "SUPPLIER_REQUIRED"


@pytest.mark.django_db
def test_confirm_no_usable_lines_rejected(manager_api, warehouse):
    # katalog fixture yo'q → hech qanday qator mos kelmaydi
    scan_id = _upload(
        manager_api, warehouse["warehouse"], warehouse["supplier"]
    ).data["data"]["id"]
    resp = manager_api.post(f"/api/v1/invoice-scans/{scan_id}/confirm/")
    assert resp.status_code == 409
    assert resp.data["error"]["code"] == "NO_USABLE_LINES"


@pytest.mark.django_db
def test_duplicate_image_uses_cache(manager_api, catalog, warehouse):
    # 1-skan tasdiqlanadi (ai_response saqlanadi)
    first = _upload(
        manager_api, warehouse["warehouse"], warehouse["supplier"]
    ).data["data"]["id"]
    xyz = InvoiceScanLine.objects.get(scan_id=first, raw_name__icontains="XYZ")
    manager_api.patch(
        f"/api/v1/invoice-scans/{first}/lines/{xyz.id}/",
        {"final_product": str(catalog["product"].id), "final_quantity": "10",
         "final_price": "5000"},
        format="json",
    )
    manager_api.post(f"/api/v1/invoice-scans/{first}/confirm/")

    # bir xil rasm → keshdan (mock baribir bir xil, lekin hash yo'li ishlaydi)
    second = _upload(manager_api, warehouse["warehouse"], warehouse["supplier"])
    assert second.data["data"]["status"] == "NEEDS_REVIEW"
    s2 = InvoiceScan.objects.get(pk=second.data["data"]["id"])
    s1 = InvoiceScan.objects.get(pk=first)
    assert s2.image_hash == s1.image_hash


@pytest.mark.django_db
def test_cost_limit_blocks(manager_api, catalog, warehouse, settings):
    settings.OCR_DAILY_COST_LIMIT_USD = 0.0  # darhol oshgan
    resp = _upload(manager_api, warehouse["warehouse"], warehouse["supplier"])
    assert resp.data["data"]["status"] == "FAILED"
    assert "limit" in resp.data["data"]["error_message"].lower()

    from apps.notifications.models import Notification

    assert Notification.objects.filter(title__icontains="OCR").exists()


@pytest.mark.django_db
def test_metrics_endpoint(manager_api, catalog, warehouse):
    scan_id = _upload(
        manager_api, warehouse["warehouse"], warehouse["supplier"]
    ).data["data"]["id"]
    xyz = InvoiceScanLine.objects.get(scan_id=scan_id, raw_name__icontains="XYZ")
    manager_api.patch(
        f"/api/v1/invoice-scans/{scan_id}/lines/{xyz.id}/",
        {"final_product": str(catalog["product"].id), "final_quantity": "10",
         "final_price": "5000"},
        format="json",
    )
    manager_api.post(f"/api/v1/invoice-scans/{scan_id}/confirm/")

    resp = manager_api.get("/api/v1/invoice-scans/metrics/")
    assert resp.status_code == 200
    m = resp.data["data"]
    assert m["scans_confirmed"] == 1
    assert m["total_lines"] == 2
    # 1 EXACT tuzatilmagan / 2 jami → 50%
    assert m["line_accuracy_pct"] == 50.0
    assert m["correction_rate_pct"] == 50.0
    assert m["decision"] == "INSUFFICIENT_DATA"  # < 20 naklit


@pytest.mark.django_db
def test_receipt_scan(auth_api):
    buf = io.BytesIO()
    Image.new("RGB", (30, 30), "white").save(buf, format="JPEG")
    img = SimpleUploadedFile("chek.jpg", buf.getvalue(), content_type="image/jpeg")

    resp = auth_api.post("/api/v1/receipt-scan/", {"image": img}, format="multipart")
    assert resp.status_code in (200, 201)
    assert resp.data["data"]["provider"] == "mock"
    assert resp.data["data"]["total"] == "1050000"


@pytest.mark.django_db
def test_distributor_cannot_list_scans(auth_api):
    assert auth_api.get("/api/v1/invoice-scans/").status_code == 403
