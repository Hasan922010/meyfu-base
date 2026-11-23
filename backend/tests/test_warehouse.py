"""2-bosqich DoD: tovar kirim qilinadi, qoldiq to'g'ri, StockMovement o'chirilmaydi."""
import re
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.core.exceptions import InsufficientStock
from apps.warehouse.constants import MovementType
from apps.warehouse.models import Stock, StockMovement
from apps.warehouse.services import apply_movement, stock_matches_journal


def _purchase_payload(warehouse, supplier, product, qty="100", price="20000"):
    return {
        "supplier": str(supplier.id),
        "warehouse": str(warehouse.id),
        "invoice_number": "INV-001",
        "date": "2026-09-01",
        "items": [
            {"product": str(product.id), "quantity": qty, "cost_price": price}
        ],
    }


@pytest.mark.django_db
def test_product_create_with_initial_stock(manager_api, catalog, warehouse):
    """CLAUDE.md 6 — Ombor: mahsulot yaratishda boshlang'ich qoldiq kiritilsa
    Stock va (append-only) StockMovement OPENING_BALANCE bilan yoziladi."""
    wh = warehouse["warehouse"]
    payload = {
        "name": "Yangi kukun 5kg", "sku": "PWD-5KG",
        "category": str(catalog["category"].id), "unit": str(catalog["unit"].id),
        "cost_price": "30000", "wholesale_price": "35000",
        "retail_price": "39000", "min_price": "33000",
        "initial_stock_warehouse": str(wh.id), "initial_stock_quantity": "50",
    }
    resp = manager_api.post("/api/v1/products/", payload, format="json")
    assert resp.status_code == 201, resp.data
    product_id = resp.data["data"]["id"]

    stock = Stock.objects.get(warehouse=wh, product_id=product_id)
    assert stock.quantity == Decimal("50")
    movement = StockMovement.objects.get(
        warehouse=wh, product_id=product_id, movement_type=MovementType.OPENING_BALANCE
    )
    assert movement.quantity == Decimal("50")
    assert movement.balance_after == Decimal("50")


@pytest.mark.django_db
def test_product_create_without_initial_stock_has_no_movement(manager_api, catalog):
    """Boshlang'ich qoldiq kiritilmasa hech qanday harakat yozilmaydi."""
    payload = {
        "name": "Boshqa mahsulot", "sku": "SKU-XYZ",
        "category": str(catalog["category"].id), "unit": str(catalog["unit"].id),
        "cost_price": "1000", "wholesale_price": "1200",
        "retail_price": "1500", "min_price": "1100",
    }
    resp = manager_api.post("/api/v1/products/", payload, format="json")
    assert resp.status_code == 201, resp.data
    assert not StockMovement.objects.filter(product_id=resp.data["data"]["id"]).exists()


@pytest.mark.django_db
def test_stock_opening_balance_for_existing_product(manager_api, catalog, warehouse):
    """CLAUDE.md 6 — Boshlang'ich qoldiqlar: mavjud mahsulot uchun ham (yaratish
    oqimidan mustaqil) boshlang'ich qoldiq kiritish mumkin."""
    wh, prod = warehouse["warehouse"], catalog["product"]
    resp = manager_api.post(
        "/api/v1/stock/opening-balance/",
        {"product": str(prod.id), "warehouse": str(wh.id), "quantity": "40"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    stock = Stock.objects.get(warehouse=wh, product=prod)
    assert stock.quantity == Decimal("40")
    assert stock_matches_journal(wh, prod)


@pytest.mark.django_db
def test_supplier_opening_balance_super_admin_only(admin_api, manager_api, warehouse):
    from apps.warehouse.models import Supplier
    from apps.warehouse.services import supplier_balance_matches_ledger

    supplier = warehouse["supplier"]
    resp = manager_api.post(
        "/api/v1/suppliers/opening-balance/",
        {"supplier": str(supplier.id), "amount": "-1500000", "note": "Boshlang'ich qarz"},
        format="json",
    )
    assert resp.status_code == 403

    ok_resp = admin_api.post(
        "/api/v1/suppliers/opening-balance/",
        {"supplier": str(supplier.id), "amount": "-1500000", "note": "Boshlang'ich qarz"},
        format="json",
    )
    assert ok_resp.status_code == 201, ok_resp.data
    supplier = Supplier.objects.get(pk=supplier.pk)
    assert supplier.balance == Decimal("-1500000.00")
    assert supplier_balance_matches_ledger(supplier) is True


@pytest.mark.django_db
def test_purchase_without_invoice_number(manager_api, catalog, warehouse):
    """Nakladnoy raqamisiz ham qabul yaratiladi (ixtiyoriy maydon)."""
    wh, sup, prod = warehouse["warehouse"], warehouse["supplier"], catalog["product"]
    payload = _purchase_payload(wh, sup, prod)
    del payload["invoice_number"]
    resp = manager_api.post("/api/v1/purchases/", payload, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["data"]["invoice_number"] == ""


@pytest.mark.django_db
def test_purchase_confirm_increases_stock(manager_api, catalog, warehouse):
    wh, sup, prod = warehouse["warehouse"], warehouse["supplier"], catalog["product"]

    created = manager_api.post(
        "/api/v1/purchases/", _purchase_payload(wh, sup, prod), format="json"
    )
    assert created.status_code == 201, created.data
    purchase_id = created.data["data"]["id"]
    assert re.match(r"KIR-\d{4}-", created.data["data"]["number"])
    assert created.data["data"]["total_amount"] == "2000000.00"

    confirmed = manager_api.post(f"/api/v1/purchases/{purchase_id}/confirm/")
    assert confirmed.status_code == 200, confirmed.data
    assert confirmed.data["data"]["status"] == "CONFIRMED"

    stock = Stock.objects.get(warehouse=wh, product=prod)
    assert stock.quantity == Decimal("100.000")

    mv = StockMovement.objects.get(warehouse=wh, product=prod)
    assert mv.movement_type == MovementType.IN_PURCHASE
    assert mv.quantity == Decimal("100.000")
    assert mv.balance_after == Decimal("100.000")


@pytest.mark.django_db
def test_stock_matches_journal(catalog, warehouse, manager):
    wh, prod = warehouse["warehouse"], catalog["product"]
    apply_movement(warehouse=wh, product=prod, quantity=Decimal("50"),
                   movement_type=MovementType.IN_PURCHASE, user=manager)
    apply_movement(warehouse=wh, product=prod, quantity=Decimal("-20"),
                   movement_type=MovementType.OUT_SALE, user=manager)
    apply_movement(warehouse=wh, product=prod, quantity=Decimal("5"),
                   movement_type=MovementType.IN_RETURN, user=manager)

    stock = Stock.objects.get(warehouse=wh, product=prod)
    assert stock.quantity == Decimal("35.000")
    assert stock_matches_journal(wh, prod) is True


@pytest.mark.django_db
def test_stock_cannot_go_negative(catalog, warehouse, manager):
    wh, prod = warehouse["warehouse"], catalog["product"]
    apply_movement(warehouse=wh, product=prod, quantity=Decimal("10"),
                   movement_type=MovementType.IN_PURCHASE, user=manager)
    with pytest.raises(InsufficientStock):
        apply_movement(warehouse=wh, product=prod, quantity=Decimal("-11"),
                       movement_type=MovementType.OUT_SALE, user=manager)
    # jurnal ham, qoldiq ham o'zgarmagan
    assert Stock.objects.get(warehouse=wh, product=prod).quantity == Decimal("10.000")
    assert StockMovement.objects.filter(warehouse=wh, product=prod).count() == 1


@pytest.mark.django_db
def test_stock_movement_is_append_only(catalog, warehouse, manager):
    wh, prod = warehouse["warehouse"], catalog["product"]
    mv = apply_movement(warehouse=wh, product=prod, quantity=Decimal("10"),
                        movement_type=MovementType.IN_PURCHASE, user=manager)
    mv.quantity = Decimal("999")
    with pytest.raises(ValidationError):
        mv.save()
    with pytest.raises(ValidationError):
        mv.delete()


@pytest.mark.django_db
def test_duplicate_invoice_rejected(manager_api, catalog, warehouse):
    wh, sup, prod = warehouse["warehouse"], warehouse["supplier"], catalog["product"]
    first = manager_api.post(
        "/api/v1/purchases/", _purchase_payload(wh, sup, prod), format="json"
    )
    assert first.status_code == 201
    second = manager_api.post(
        "/api/v1/purchases/", _purchase_payload(wh, sup, prod), format="json"
    )
    assert second.status_code == 400


@pytest.mark.django_db
def test_confirmed_purchase_cannot_be_reconfirmed(manager_api, catalog, warehouse):
    wh, sup, prod = warehouse["warehouse"], warehouse["supplier"], catalog["product"]
    created = manager_api.post(
        "/api/v1/purchases/", _purchase_payload(wh, sup, prod), format="json"
    )
    pid = created.data["data"]["id"]
    manager_api.post(f"/api/v1/purchases/{pid}/confirm/")
    again = manager_api.post(f"/api/v1/purchases/{pid}/confirm/")
    assert again.status_code == 409
    assert again.data["error"]["code"] == "ALREADY_CONFIRMED"


@pytest.mark.django_db
def test_purchase_updates_product_cost_and_price_history(manager_api, catalog, warehouse):
    wh, sup, prod = warehouse["warehouse"], warehouse["supplier"], catalog["product"]
    created = manager_api.post(
        "/api/v1/purchases/",
        _purchase_payload(wh, sup, prod, price="22000"),
        format="json",
    )
    pid = created.data["data"]["id"]
    manager_api.post(f"/api/v1/purchases/{pid}/confirm/")

    prod.refresh_from_db()
    assert prod.cost_price == Decimal("22000.00")
    assert prod.price_history.count() == 1


@pytest.mark.django_db
def test_reserve_error_names_product_and_plain_quantities(stocked):
    """Audit K5: xabarda mahsulot nomi, miqdorlar ortiqcha kasr nolsiz."""
    from decimal import Decimal

    from apps.core.exceptions import InsufficientStock
    from apps.warehouse.services import reserve_stock

    product, warehouse = stocked["product"], stocked["warehouse"]
    with pytest.raises(InsufficientStock) as exc:
        reserve_stock(warehouse=warehouse, product=product, quantity=Decimal("999999"))

    message = str(exc.value.detail)
    assert product.name in message
    assert "999999" in message
    assert ".000" not in message


@pytest.mark.django_db
def test_stock_list_includes_unit_and_low_level(manager_api, stocked):
    """Audit m9: telefondagi qoldiq ro'yxati birlik va kam qoldiq chegarasini ko'rsata olsin."""
    resp = manager_api.get("/api/v1/stock/")
    assert resp.status_code == 200
    row = resp.data["data"]["results"][0]
    product = stocked["product"]
    product.refresh_from_db()
    assert row["product_unit"] == product.unit.short_name
    assert row["min_stock_alert"] is not None


@pytest.mark.django_db
def test_stock_list_has_stable_order(manager_api, stocked):
    """Tartibsiz sahifalash sahifalar orasida qatorlarni takrorlashi/yo'qotishi mumkin."""
    import warnings

    from django.core.paginator import UnorderedObjectListWarning

    with warnings.catch_warnings():
        warnings.simplefilter("error", UnorderedObjectListWarning)
        resp = manager_api.get("/api/v1/stock/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_admin_lock_opening_balance_blocks_further_changes(manager_api, warehouse, catalog):
    wh, prod = warehouse["warehouse"], catalog["product"]
    # 1. Boshlang'ich qoldiq kiritamiz
    resp = manager_api.post(
        "/api/v1/stock/opening-balance/",
        {"warehouse": str(wh.id), "product": str(prod.id), "quantity": "100"},
        format="json",
    )
    assert resp.status_code == 201

    # 2. Admin boshlang'ich qoldiqni tasdiqlaydi va qulflaydi
    lock_resp = manager_api.post(
        "/api/v1/stock/lock-opening/",
        {"warehouse": str(wh.id)},
        format="json",
    )
    assert lock_resp.status_code == 200
    assert lock_resp.data["data"]["is_opening_locked"] is True

    # 3. Tasdiqlangandan keyin qayta kiritish yoki o'zgartirish urinishi bloklanadi (409)
    blocked_resp = manager_api.post(
        "/api/v1/stock/opening-balance/",
        {"warehouse": str(wh.id), "product": str(prod.id), "quantity": "150"},
        format="json",
    )
    assert blocked_resp.status_code == 409
    assert blocked_resp.data["error"]["code"] == "OPENING_LOCKED"


@pytest.mark.django_db
def test_loading_pdf_renders_with_order_client_and_pack_units(admin_api, van_stocked):
    """Yuklama PDF qadoq/dona ko'rinishida va bog'langan buyurtma mijoz nomi bilan generatsiya bo'ladi."""
    from apps.core.formatting import number_to_words_uz
    from apps.orders.models import Order
    from apps.warehouse.models import Loading
    from apps.warehouse.pdf import loading_to_pdf

    assert number_to_words_uz(1250000) == "bir million ikki yuz ellik ming"

    product = van_stocked["product"]
    product.pack_quantity = Decimal("12")
    product.package_type = "qop"
    product.save(update_fields=["pack_quantity", "package_type"])

    loading = Loading.objects.filter(distributor=van_stocked["distributor"]).first()
    assert loading is not None
    Order.objects.create(
        number="BUY-TEST-1",
        date=loading.date,
        client=van_stocked["client"],
        taken_by=van_stocked["distributor"],
        assigned_to=van_stocked["distributor"],
        loading=loading,
        status="LOADED",
    )

    pdf_bytes = loading_to_pdf(loading, with_stamp=False)
    assert pdf_bytes.startswith(b"%PDF-")

    from apps.core.models import CompanySettings

    CompanySettings.objects.create(name="Meyfu", loading_total_in_words=False)
    pdf_no_words = loading_to_pdf(loading, with_stamp=False)
    assert pdf_no_words.startswith(b"%PDF-")


@pytest.mark.django_db
def test_purchase_to_pdf_formats_pack_qty(van_stocked):
    """Kirim nakladnoy PDF da qadoqli mahsulot miqdori qop/quti da formatlanadi."""
    from apps.warehouse.models import Purchase, PurchaseItem, Supplier
    from apps.warehouse.pdf import _format_pack_qty, purchase_to_pdf

    product = van_stocked["product"]
    product.pack_quantity = Decimal("12")
    product.package_type = "qop"
    product.save(update_fields=["pack_quantity", "package_type"])

    assert _format_pack_qty(Decimal("2"), product) == "2 qop"
    product.package_type = ""
    product.save(update_fields=["package_type"])
    assert _format_pack_qty(Decimal("5"), product) == f"5 {product.unit.short_name}"
    product.package_type = "qop"
    product.save(update_fields=["package_type"])

    supplier = Supplier.objects.create(name="Test Ta'minotchi", phone="+998901230000")
    purchase = Purchase.objects.create(
        number="KIR-TEST-1",
        date=van_stocked["warehouse"].created_at.date(),
        supplier=supplier,
        warehouse=van_stocked["warehouse"],
        created_by=van_stocked["distributor"],
    )
    PurchaseItem.objects.create(
        purchase=purchase,
        product=product,
        quantity=Decimal("24"),
        cost_price=Decimal("10000"),
        amount=Decimal("240000"),
    )

    pdf_bytes = purchase_to_pdf(purchase, with_stamp=False, with_images=False)
    assert pdf_bytes.startswith(b"%PDF-")


@pytest.mark.django_db
def test_warehouse_pdf_escapes_xml_special_chars(van_stocked):
    """Mijoz, xodim yoki mahsulot nomidagi XML belgilari PDF yaratishni buzmaydi."""
    from apps.warehouse.models import Loading, LoadingItem
    from apps.warehouse.pdf import loading_to_pdf

    product = van_stocked["product"]
    product.name = "Coca <Cola> & \"Zero\" '1L'"
    product.save(update_fields=["name"])

    dist = van_stocked["distributor"]
    dist.full_name = "Ali <Vali> & Co"
    dist.save(update_fields=["full_name"])

    loading = Loading.objects.create(
        number="YUK-ESC-1",
        date=van_stocked["warehouse"].created_at.date(),
        warehouse=van_stocked["warehouse"],
        distributor=dist,
        created_by=dist,
    )
    LoadingItem.objects.create(
        loading=loading,
        product=product,
        quantity=Decimal("2"),
        price=Decimal("10000"),
        amount=Decimal("20000"),
    )

    pdf_bytes = loading_to_pdf(loading, with_stamp=False)
    assert pdf_bytes.startswith(b"%PDF-")


@pytest.mark.django_db
def test_convert_warehouse_history_to_packages_is_idempotent(van_stocked):
    """Eski dona harakatlari qadoqqa o'girilib, qoldiq qayta hisoblanadi va ikki marta ishlasa ham buzilmaydi."""
    from apps.warehouse.constants import MovementType
    from apps.warehouse.models import Stock, StockMovement, VanStock
    from apps.warehouse.services.stock import (
        apply_movement,
        convert_product_prices_to_packages,
        convert_warehouse_history_to_packages,
    )

    product = van_stocked["product"]
    product.pack_quantity = Decimal("10")
    product.package_type = "qop"
    product.cost_price = Decimal("5000")
    product.wholesale_price = Decimal("6000")
    product.save(update_fields=["pack_quantity", "package_type", "cost_price", "wholesale_price"])

    wh = van_stocked["warehouse"]
    apply_movement(
        warehouse=wh, product=product, quantity=Decimal("200"),
        movement_type=MovementType.IN_PURCHASE, user=van_stocked["distributor"],
    )

    res1 = convert_warehouse_history_to_packages()
    assert res1["products"] >= 1

    st = Stock.objects.get(warehouse=wh, product=product)
    assert st.quantity == Decimal("20.000")
    vs = VanStock.objects.get(distributor=van_stocked["distributor"], product=product)
    assert vs.quantity == Decimal("50.000")
    last_mv = StockMovement.objects.filter(warehouse=wh, product=product).order_by("created_at", "pk").last()
    assert last_mv is not None and last_mv.balance_after == st.quantity

    # Ikkinchi marta chaqirilsa idempotent -> qayta bo'lmaydi
    res2 = convert_warehouse_history_to_packages()
    assert res2["products"] == 0
    st.refresh_from_db()
    assert st.quantity == Decimal("20.000")

    assert convert_product_prices_to_packages() >= 1
    product.refresh_from_db()
    assert product.cost_price == Decimal("50000.00")
    assert product.wholesale_price == Decimal("60000.00")
    assert convert_product_prices_to_packages() == 0


@pytest.mark.django_db
def test_stock_summary_per_warehouse(auth_api, van_stocked):
    """Har bir ombor bo'yicha jami qoldiq va tovar summasi to'g'ri hisoblanadi."""
    from apps.warehouse.constants import MovementType
    from apps.warehouse.models import Warehouse
    from apps.warehouse.services.stock import apply_movement

    wh2 = Warehouse.objects.create(name="Filial ombor")
    product = van_stocked["product"]
    product.cost_price = Decimal("20000.00")
    product.save(update_fields=["cost_price"])

    apply_movement(
        warehouse=wh2, product=product, quantity=Decimal("5"),
        movement_type=MovementType.IN_PURCHASE, user=van_stocked["distributor"],
    )

    resp = auth_api.get("/api/v1/stock/summary/")
    assert resp.status_code == 200
    data = resp.data["data"]
    by_wh = {w["warehouse"]: w for w in data["warehouses"]}
    assert Decimal(by_wh[str(wh2.id)]["total_quantity"]) == Decimal("5.000")
    assert Decimal(by_wh[str(wh2.id)]["total_value"]) == Decimal("100000.00")
    assert Decimal(data["total_value"]) >= Decimal("100000.00")
