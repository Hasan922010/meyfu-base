"""6-bosqich DoD: bir kun to'liq sikl — yuklash → sotuv → qaytarish → kun yopish."""
from decimal import Decimal

import pytest

from apps.warehouse.models import Loading, Stock, VanStock


def _sale(api, client, product, qty, price="27000", payment="NAQD"):
    return api.post(
        "/api/v1/sales/",
        {
            "client": str(client.id),
            "payment_type": payment,
            "items": [{"product": str(product.id), "quantity": qty, "price": price}],
        },
        format="json",
    )


@pytest.mark.django_db
def test_full_day_cycle(auth_api, admin_api, van_stocked):
    """yuklash → sotuv → qaytarish → kun yopish → tasdiq."""
    client = van_stocked["client"]
    product = van_stocked["product"]
    distributor = van_stocked["distributor"]
    warehouse = van_stocked["warehouse"]

    # --- SOTUV: 3 × 100 dona naqd = 8 100 000 ---
    for _ in range(3):
        assert _sale(auth_api, client, product, "100").status_code == 201

    # --- MIJOZ QAYTARISHI: 10 dona brak emas (restock) ---
    ret = auth_api.post(
        "/api/v1/sale-returns/",
        {
            "client": str(client.id), "reason": "MUDDAT", "restock": True,
            "items": [{"product": str(product.id), "quantity": "10", "price": "27000"}],
        },
        format="json",
    )
    assert ret.status_code == 201

    van = VanStock.objects.get(distributor=distributor, product=product)
    assert van.quantity == Decimal("210.000")  # 500 - 300 + 10

    # --- KUN YOPISH: my-today (jonli hisob) ---
    preview = auth_api.get("/api/v1/day-close/my-today/")
    assert preview.status_code == 200
    p = preview.data["data"]
    assert p["submitted"] is False
    assert p["sold_amount"] == "8100000.00"
    assert p["cash_sales_amount"] == "8100000.00"
    assert p["cash_expected"] == "8100000.00"
    assert p["sales_count"] == 3

    # --- SUBMIT: qolgan 210 dona qaytariladi, naqd to'liq topshiriladi ---
    submit = auth_api.post(
        "/api/v1/day-close/submit/",
        {
            "warehouse": str(warehouse.id),
            "cash_handed": "8100000",
            "items": [
                {"product": str(product.id), "quantity": "210", "condition": "GOOD"}
            ],
        },
        format="json",
    )
    assert submit.status_code == 201, submit.data
    dc = submit.data["data"]
    assert dc["status"] == "PENDING"
    assert dc["loaded_amount"] == "12500000.00"       # 500 × 25000
    assert dc["returned_amount"] == "5250000.00"      # 210 × 25000
    assert dc["cash_difference"] == "0.00"
    assert dc["stock_difference_qty"] == "0.000"      # 500 - 300 + 10 - 210 = 0
    assert dc["has_difference"] is False

    # --- ADMIN TASDIQLAYDI ---
    confirm = admin_api.post(f"/api/v1/day-close/{dc['id']}/confirm/")
    assert confirm.status_code == 200
    assert confirm.data["data"]["status"] == "CLOSED"
    assert confirm.data["data"]["closed_by"] is not None

    # ombor qoldig'iga 210 dona qaytdi
    wh_stock = Stock.objects.get(warehouse=warehouse, product=product)
    assert wh_stock.quantity == Decimal("210.000")   # 500 kirim - 500 yuklash + 210

    # mashina qoldig'i 0 ga tushdi
    van.refresh_from_db()
    assert van.quantity == Decimal("0.000")

    # yuklama yopildi
    assert Loading.objects.get(pk=van_stocked["loading"].id).status == "CLOSED"


@pytest.mark.django_db
def test_integrity_clean_after_day_close(auth_api, admin_api, van_stocked):
    """Kun yopish tasdiqlangandan keyin tungi butunlik tekshiruvi toza bo'lishi
    kerak: kunlik qaytarishlar mashinadan chiqadi va `van_expected_quantity`
    ularni hisobga oladi (CLAUDE.md 5.2, 15)."""
    from apps.core.services.integrity import run_integrity_check

    client, product = van_stocked["client"], van_stocked["product"]
    assert _sale(auth_api, client, product, "100").status_code == 201

    dc = auth_api.post(
        "/api/v1/day-close/submit/",
        {
            "warehouse": str(van_stocked["warehouse"].id),
            "cash_handed": "2700000",
            "items": [
                {"product": str(product.id), "quantity": "400", "condition": "GOOD"}
            ],
        },
        format="json",
    ).data["data"]
    assert admin_api.post(f"/api/v1/day-close/{dc['id']}/confirm/").status_code == 200

    result = run_integrity_check()
    assert result["ok"] is True, result["mismatches"]


@pytest.mark.django_db
def test_cash_shortage_flagged(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    _sale(auth_api, client, product, "10", price="27000")  # 270 000

    submit = auth_api.post(
        "/api/v1/day-close/submit/",
        {
            "warehouse": str(van_stocked["warehouse"].id),
            "cash_handed": "250000",  # 20 000 kam
            "items": [
                {"product": str(product.id), "quantity": "490", "condition": "GOOD"}
            ],
        },
        format="json",
    )
    assert submit.status_code == 201
    dc = submit.data["data"]
    assert dc["cash_difference"] == "-20000.00"       # kamomad
    assert dc["has_difference"] is True

    # farqli kunlar filtri
    admin_list = auth_api.get("/api/v1/day-close/?has_difference=true")
    assert admin_list.data["data"]["count"] == 1


@pytest.mark.django_db
def test_stock_shortage_detected(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    _sale(auth_api, client, product, "100")  # sotildi 100

    # 400 qolishi kerak, lekin 395 qaytaradi → 5 dona kamomad
    submit = auth_api.post(
        "/api/v1/day-close/submit/",
        {
            "warehouse": str(van_stocked["warehouse"].id),
            "cash_handed": "2700000",
            "items": [
                {"product": str(product.id), "quantity": "395", "condition": "GOOD"}
            ],
        },
        format="json",
    )
    dc = submit.data["data"]
    assert dc["stock_difference_qty"] == "5.000"


@pytest.mark.django_db
def test_cannot_submit_twice(auth_api, van_stocked):
    product = van_stocked["product"]
    body = {
        "warehouse": str(van_stocked["warehouse"].id),
        "cash_handed": "0",
        "items": [{"product": str(product.id), "quantity": "500", "condition": "GOOD"}],
    }
    first = auth_api.post("/api/v1/day-close/submit/", body, format="json")
    assert first.status_code == 201
    second = auth_api.post("/api/v1/day-close/submit/", body, format="json")
    assert second.status_code == 409
    assert second.data["error"]["code"] == "ALREADY_SUBMITTED"


@pytest.mark.django_db
def test_distributor_cannot_confirm(auth_api, van_stocked):
    product = van_stocked["product"]
    dc = auth_api.post(
        "/api/v1/day-close/submit/",
        {
            "warehouse": str(van_stocked["warehouse"].id),
            "cash_handed": "0",
            "items": [
                {"product": str(product.id), "quantity": "500", "condition": "GOOD"}
            ],
        },
        format="json",
    ).data["data"]
    resp = auth_api.post(f"/api/v1/day-close/{dc['id']}/confirm/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_damaged_goods_written_off(auth_api, admin_api, van_stocked):
    product = van_stocked["product"]
    warehouse = van_stocked["warehouse"]
    _sale(auth_api, van_stocked["client"], product, "100")

    dc = auth_api.post(
        "/api/v1/day-close/submit/",
        {
            "warehouse": str(warehouse.id),
            "cash_handed": "2700000",
            "items": [
                {"product": str(product.id), "quantity": "390", "condition": "GOOD"},
                {"product": str(product.id), "quantity": "10", "condition": "DAMAGED"},
            ],
        },
        format="json",
    ).data["data"]
    admin_api.post(f"/api/v1/day-close/{dc['id']}/confirm/")

    wh_stock = Stock.objects.get(warehouse=warehouse, product=product)
    # 500 kirim - 500 yuklash + 390 good + (10 return - 10 writeoff) = 390
    assert wh_stock.quantity == Decimal("390.000")
