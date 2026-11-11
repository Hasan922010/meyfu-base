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
    from openpyxl import load_workbook

    resp = manager_api.get("/api/v1/products/import-template/")

    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("application/vnd.openxml")
    wb = load_workbook(io.BytesIO(resp.content))
    ws = wb.active
    headers = [c for c in next(ws.iter_rows(values_only=True))]
    assert "tannarx" in headers
    assert "farqni kuzatish" in headers
    assert "zakaz komissiyasi" in headers
    assert "tarqatish komissiyasi" in headers
    assert "bonus" in headers
    assert "qadoq turi" in headers
    assert "kam qoldiq" in headers
    assert "faol" in headers
    assert "optom narx" not in headers

    # Shablonni to'g'ridan-to'g'ri import qilish ham to'liq ishlashi kerak
    f = SimpleUploadedFile(
        "mahsulot-shablon.xlsx",
        resp.content,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    imp = manager_api.post(URL, {"file": f, "dry_run": "false"}, format="multipart")
    assert imp.status_code == 200
    data = imp.json()["data"]
    assert data["errors"] == 0, data
    assert data["created"] == 1
    p = Product.objects.get(sku="ARL-3")
    assert p.cost_price == Decimal("95000")
    assert p.track_variance is False
    assert p.order_commission_rate == Decimal("1")
    assert p.delivery_commission_rate == Decimal("2")
    assert p.has_bonus is True
    assert p.bonus_trigger_qty == Decimal("10")
    assert p.bonus_reward_qty == Decimal("1")
    assert p.package_type == "qop"
    assert p.pack_quantity == Decimal("4")
    assert p.min_stock_alert == Decimal("10")
    assert p.is_active is True

    # Qayta import o'zgarishsiz SKIP qaytaradi
    f2 = SimpleUploadedFile(
        "mahsulot-shablon.xlsx",
        resp.content,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    again = manager_api.post(URL, {"file": f2, "dry_run": "false"}, format="multipart")
    assert again.json()["data"]["unchanged"] == 1


@pytest.mark.django_db
def test_bonus_product_sku_cross_reference_and_validation(admin_api):
    header = [
        "nomi", "artikul", "kategoriya", "birlik", "tannarx",
        "bonus", "bonus sharti", "bonus soni", "bonus tovar", "faol",
    ]
    rows = [
        header,
        ["Katta Paket", "BIG-1", "Kukunlar", "dona", 50000, "ha", 5, 1, "GIFT-1", "yo'q"],
        ["Sovg'a Sovun", "GIFT-1", "Sovun", "dona", 5000, "yo'q", 0, 0, "", "ha"],
    ]
    data = _post(admin_api, rows, dry_run=False).json()["data"]
    assert data["errors"] == 0, data
    assert data["created"] == 2
    big = Product.objects.get(sku="BIG-1")
    gift = Product.objects.get(sku="GIFT-1")
    assert big.bonus_product_id == gift.id
    assert big.is_active is False

    # Noto'g'ri bonus sharti -> xato
    bad_rows = [
        header,
        ["Xato Bonus", "ERR-B", "Kukunlar", "dona", 10000, "ha", 0, 1, "", "ha"],
    ]
    bad = _post(admin_api, bad_rows, dry_run=True).json()["data"]
    assert bad["errors"] == 1


@pytest.mark.django_db
def test_product_import_bonus_clear_preserve_and_commissions(admin_api, manager_api):
    # 1. Bonus tovarli mahsulot yaratish
    create_header = [
        "nomi", "artikul", "kategoriya", "birlik", "tannarx",
        "zakaz komissiyasi", "tarqatish komissiyasi",
        "bonus", "bonus sharti", "bonus soni", "bonus tovar",
    ]
    create_rows = [
        create_header,
        ["Sovg'a", "GFT-1", "Kukunlar", "dona", 5000, 1, 2, "yo'q", 0, 0, ""],
        ["Asosiy", "MAIN-1", "Kukunlar", "dona", 20000, 1, 2, "ha", 5, 1, "GFT-1"],
    ]
    assert _post(admin_api, create_rows, dry_run=False).json()["data"]["errors"] == 0
    main = Product.objects.get(sku="MAIN-1")
    gift = Product.objects.get(sku="GFT-1")
    assert main.bonus_product_id == gift.id

    # 2. Bonus tovar ustunisiz yangilash -> bonus_product saqlanib qoladi
    no_bonus_col = [["nomi", "artikul"], ["Asosiy Yangi", "MAIN-1"]]
    assert _post(admin_api, no_bonus_col, dry_run=False).json()["data"]["updated"] == 1
    main.refresh_from_db()
    assert main.bonus_product_id == gift.id

    # 3. Bonus tovar ustunini bo'sh qoldirish -> o'z mahsulotiga (None) qaytadi
    clear_bonus_col = [["nomi", "artikul", "bonus tovar"], ["Asosiy Yangi", "MAIN-1", ""]]
    assert _post(admin_api, clear_bonus_col, dry_run=False).json()["data"]["updated"] == 1
    main.refresh_from_db()
    assert main.bonus_product_id is None

    # 4. Komissiya foizini SUPER_ADMIN o'zgartira oladi, MANAGER esa rad etiladi
    comm_rows = [
        ["nomi", "artikul", "zakaz komissiyasi", "tarqatish komissiyasi"],
        ["Asosiy Yangi", "MAIN-1", 3.5, 4.5],
    ]
    assert _post(manager_api, comm_rows, dry_run=True).json()["data"]["errors"] == 1
    assert _post(admin_api, comm_rows, dry_run=False).json()["data"]["updated"] == 1
    main.refresh_from_db()
    assert main.order_commission_rate == Decimal("3.50")
    assert main.delivery_commission_rate == Decimal("4.50")
