"""14-bosqich: hisobot konstruktori, ABC tahlil, PDF/Excel eksport
(CLAUDE.md 10, 14, 18)."""
from __future__ import annotations

import pytest

from apps.reports.services import abc_analysis, report_query


def _sale(api, client, product, qty="10", price="27000", payment="NAQD"):
    return api.post(
        "/api/v1/sales/",
        {
            "client": str(client.id),
            "payment_type": payment,
            "items": [{"product": str(product.id), "quantity": qty, "price": price}],
        },
        format="json",
    )


@pytest.fixture
def two_products(van_stocked):
    """van_stocked'ga qo'shimcha ikkinchi mahsulot — omborda + mashinada."""
    from decimal import Decimal

    from apps.catalog.models import Product
    from apps.warehouse.constants import MovementType
    from apps.warehouse.models import Loading, LoadingItem
    from apps.warehouse.services import (
        apply_movement,
        confirm_loading,
        send_loading,
    )
    from apps.warehouse.services.loading import assign_number

    p2 = Product.objects.create(
        name="Yuvish geli 1L", sku="GEL-1L", category=van_stocked["category"],
        brand=van_stocked["brand"], unit=van_stocked["unit"],
        cost_price="15000", wholesale_price="20000", retail_price="24000",
        min_price="18000",
    )
    apply_movement(
        warehouse=van_stocked["warehouse"], product=Product.objects.get(pk=p2.pk),
        quantity=Decimal("500"), movement_type=MovementType.IN_PURCHASE,
    )
    loading = Loading.objects.create(
        date=van_stocked["loading"].date,
        distributor=van_stocked["distributor"],
        warehouse=van_stocked["warehouse"],
    )
    LoadingItem.objects.create(
        loading=loading, product=Product.objects.get(pk=p2.pk),
        quantity=Decimal("100"), price=Decimal("20000"),
        amount=Decimal("2000000"),
    )
    assign_number(loading)
    loading.recalc_total()
    loading.save()
    send_loading(loading)
    confirm_loading(loading, user=van_stocked["distributor"])
    return Product.objects.get(pk=p2.pk)


# --------------------------------------------------------------------------- #
#  Konstruktor
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_report_query_by_product(auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", price="27000")
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "5", price="27000")

    result = report_query(
        dimension="product",
        date_from=van_stocked["loading"].date,
        date_to=van_stocked["loading"].date,
    )
    assert result["key"] == "product"
    assert len(result["rows"]) == 1
    row = result["rows"][0]
    assert row["amount"] == "405000.00"
    assert row["count"] == 2
    assert row["margin_percent"] == pytest.approx(25.9, abs=0.2)
    assert result["totals"]["amount"] == "405000.00"


@pytest.mark.django_db
def test_report_query_filter_by_payment_type(auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", payment="NAQD")
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "3", payment="QARZ")

    only_cash = report_query(
        dimension="product",
        date_from=van_stocked["loading"].date,
        date_to=van_stocked["loading"].date,
        filters={"payment_type": "NAQD"},
    )
    assert only_cash["totals"]["count"] == 1
    assert only_cash["rows"][0]["amount"] == "270000.00"


@pytest.mark.django_db
def test_report_query_api_and_rejects_bad_dimension(manager_api, auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10")
    ok = manager_api.get("/api/v1/reports/query/?dimension=distributor")
    assert ok.status_code == 200
    assert ok.data["data"]["rows"][0]["distributor"] == "Test Tarqatuvchi"

    bad = manager_api.get("/api/v1/reports/query/?dimension=galaxy")
    assert bad.status_code == 400


@pytest.mark.django_db
def test_report_query_forbidden_for_distributor(auth_api):
    assert auth_api.get(
        "/api/v1/reports/query/?dimension=product"
    ).status_code == 403


# --------------------------------------------------------------------------- #
#  ABC
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_abc_classes(auth_api, van_stocked, two_products):
    client = van_stocked["client"]
    # A: katta aylanma
    _sale(auth_api, client, van_stocked["product"], "40", price="27000")  # 1 080 000
    # C: kichik
    _sale(auth_api, client, two_products, "1", price="20000")  # 20 000

    result = abc_analysis(
        dimension="product",
        date_from=van_stocked["loading"].date,
        date_to=van_stocked["loading"].date,
    )
    by_name = {r["product"]: r for r in result["rows"]}
    assert by_name["Test kukun 3kg"]["abc_class"] == "A"
    assert by_name["Yuvish geli 1L"]["abc_class"] == "C"
    assert result["rows"][-1]["cumulative_percent"] == pytest.approx(100.0, abs=0.1)
    a_summary = next(s for s in result["summary"] if s["abc_class"] == "A")
    assert a_summary["count"] == 1


@pytest.mark.django_db
def test_abc_api(manager_api, auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10")
    resp = manager_api.get("/api/v1/reports/abc/?dimension=product")
    assert resp.status_code == 200
    assert len(resp.data["data"]["summary"]) == 3


# --------------------------------------------------------------------------- #
#  Eksport — Excel + PDF
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_export_query_xlsx_and_pdf(manager_api, auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10")

    xlsx = manager_api.get(
        "/api/v1/reports/export/?type=query&dimension=product&fmt=xlsx"
    )
    assert xlsx.status_code == 200
    assert xlsx.content[:2] == b"PK"

    pdf = manager_api.get(
        "/api/v1/reports/export/?type=query&dimension=product&fmt=pdf"
    )
    assert pdf.status_code == 200
    assert pdf["Content-Type"] == "application/pdf"
    assert pdf.content[:4] == b"%PDF"


@pytest.mark.django_db
def test_export_abc_pdf(manager_api, auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10")
    pdf = manager_api.get("/api/v1/reports/export/?type=abc&fmt=pdf")
    assert pdf.status_code == 200
    assert pdf.content[:4] == b"%PDF"


@pytest.mark.django_db
def test_export_pnl_xlsx_and_pdf(manager_api, auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10")

    xlsx = manager_api.get("/api/v1/reports/export/?type=pnl&fmt=xlsx")
    assert xlsx.status_code == 200
    assert xlsx.content[:2] == b"PK"

    pdf = manager_api.get("/api/v1/reports/export/?type=pnl&fmt=pdf")
    assert pdf.status_code == 200
    assert pdf.content[:4] == b"%PDF"
