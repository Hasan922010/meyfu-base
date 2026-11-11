from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.catalog.models import Category, Product, Unit
from apps.clients.models import Client
from apps.orders.services import OrderLine, create_order, fulfill_order
from apps.orders.services.order import FulfillLine
from apps.reports.services.product_movement import product_movement_report
from apps.sales.models import Sale
from apps.sales.services import SaleLine, create_sale
from apps.users.constants import Role
from apps.warehouse.models import VanStock

User = get_user_model()


@pytest.fixture
def manager_user(db):
    return User.objects.create_user(
        phone="+998901110001",
        full_name="Boshqaruvchi",
        role=Role.MANAGER,
        password="password123",
    )


@pytest.fixture
def distributor_user(db):
    return User.objects.create_user(
        phone="+998901110002",
        full_name="Haydovchi Aziz",
        role=Role.DISTRIBUTOR,
        password="password123",
    )


@pytest.fixture
def base_data(db, distributor_user):
    cat = Category.objects.create(name="Kimyoviy Vositalar")
    unit = Unit.objects.create(name="Dona", short_name="dona")

    p_bonus = Product.objects.create(
        name="Sovun 100g",
        sku="SOV-100",
        category=cat,
        unit=unit,
        cost_price=Decimal("4000"),
        wholesale_price=Decimal("6000"),
        min_price=Decimal("5000"),
    )

    p_main = Product.objects.create(
        name="Bio Kukun 3kg",
        sku="BIO-3KG",
        category=cat,
        unit=unit,
        cost_price=Decimal("18000"),
        wholesale_price=Decimal("25000"),
        min_price=Decimal("22000"),
        has_bonus=True,
        bonus_trigger_qty=Decimal("10"),
        bonus_reward_qty=Decimal("1"),
        bonus_product=p_bonus,
    )

    client = Client.objects.create(
        name="Samarqand Darvoza Do‘koni",
        owner_name="Alisher",
        phone="+998901234567",
        address="Toshkent",
    )

    # Van stock qo'shamiz
    VanStock.objects.create(
        distributor=distributor_user,
        product=p_main,
        quantity=Decimal("50"),
    )
    VanStock.objects.create(
        distributor=distributor_user,
        product=p_bonus,
        quantity=Decimal("20"),
    )

    return {
        "cat": cat,
        "unit": unit,
        "p_main": p_main,
        "p_bonus": p_bonus,
        "client": client,
        "distributor": distributor_user,
    }


@pytest.mark.django_db
def test_sale_with_bonus_line_deducts_van_stock_and_records_correctly(base_data):
    p_main = base_data["p_main"]
    p_bonus = base_data["p_bonus"]
    client = base_data["client"]
    distributor = base_data["distributor"]

    # 10 ta p_main sotildi + 1 ta p_bonus bepul berildi
    lines = [
        SaleLine(product=p_main, quantity=Decimal("10"), price=Decimal("25000"), is_bonus=False),
        SaleLine(product=p_bonus, quantity=Decimal("1"), price=Decimal("0"), is_bonus=True),
    ]

    res = create_sale(
        distributor=distributor,
        client=client,
        payment_type="NAQD",
        lines=lines,
        strict=True,
    )

    assert res.created is True
    sale = res.sale
    assert sale.total_amount == Decimal("250000.00")  # 10 * 25000, bonus 0 so'm
    assert sale.flagged is False  # 0 so'mlik bonus min_price qoidasini buzmaydi

    # VanStock tekshiruvi: ikkala tovar ham mashinadan ayirilishi shart!
    vs_main = VanStock.objects.get(distributor=distributor, product=p_main)
    vs_bonus = VanStock.objects.get(distributor=distributor, product=p_bonus)
    assert vs_main.quantity == Decimal("40")   # 50 - 10
    assert vs_bonus.quantity == Decimal("19")  # 20 - 1

    # SaleItem tekshiruvi
    items = list(sale.items.order_by("created_at"))
    assert len(items) == 2
    assert items[0].is_bonus is False
    assert items[0].quantity == Decimal("10")
    assert items[0].amount == Decimal("250000.00")

    assert items[1].is_bonus is True
    assert items[1].quantity == Decimal("1")
    assert items[1].price == Decimal("0")
    assert items[1].amount == Decimal("0")


@pytest.mark.django_db
def test_order_creation_and_fulfillment_with_bonus(base_data):
    p_main = base_data["p_main"]
    p_bonus = base_data["p_bonus"]
    client = base_data["client"]
    distributor = base_data["distributor"]

    order_lines = [
        OrderLine(product=p_main, quantity=Decimal("10"), price=Decimal("25000"), is_bonus=False),
        OrderLine(product=p_bonus, quantity=Decimal("1"), price=Decimal("0"), is_bonus=True),
    ]

    res = create_order(
        client=client,
        taken_by=distributor,
        lines=order_lines,
    )
    order = res.order
    assert order.total_amount == Decimal("250000.00")
    order_items = list(order.items.order_by("created_at"))
    assert order_items[0].is_bonus is False
    assert order_items[1].is_bonus is True

    # Yetkazish (Fulfill) — avval buyurtma tasdiqlanadi
    order.status = "APPROVED"
    order.save(update_fields=["status"])
    fulfill_lines = [
        FulfillLine(item=order_items[0], delivered_quantity=Decimal("10")),
        FulfillLine(item=order_items[1], delivered_quantity=Decimal("1")),
    ]
    f_res = fulfill_order(order, fulfill_lines, distributor=distributor, payment_type="NAQD")
    assert f_res.created is True

    # Sotuvdagi bonus bayrog'i tekshiruvi
    sale = Sale.objects.get(order=order)
    sale_items = list(sale.items.order_by("created_at"))
    assert sale_items[0].is_bonus is False
    assert sale_items[1].is_bonus is True
    assert sale_items[1].price == Decimal("0")


@pytest.mark.django_db
def test_product_movement_report(base_data, api, manager_user):
    p_main = base_data["p_main"]
    p_bonus = base_data["p_bonus"]
    client = base_data["client"]
    distributor = base_data["distributor"]

    # 1. Sotuv yaratamiz: 20 ta asosiy tovar + 2 ta bonus tovar
    lines = [
        SaleLine(product=p_main, quantity=Decimal("20"), price=Decimal("25000"), is_bonus=False),
        SaleLine(product=p_bonus, quantity=Decimal("2"), price=Decimal("0"), is_bonus=True),
    ]
    create_sale(
        distributor=distributor,
        client=client,
        payment_type="NAQD",
        lines=lines,
    )

    today = timezone.now().date()
    report = product_movement_report(date_from=today, date_to=today)

    assert report["summary"]["total_products"] == 2
    assert report["summary"]["total_sold_qty"] == "20.000"
    assert report["summary"]["total_sold_amount"] == "500000.00"
    assert report["summary"]["total_bonus_qty"] == "2.000"
    # 2 dona bonus * 4000 tannarx = 8000.00
    assert report["summary"]["total_bonus_cost"] == "8000.00"
    assert report["summary"]["total_movement_qty"] == "22.000"

    # API orqali chaqirish
    api.force_authenticate(user=manager_user)
    resp = api.get(
        f"/api/v1/reports/product-movement/?date_from={today.isoformat()}&date_to={today.isoformat()}"
    )
    assert resp.status_code == 200
    res_data = resp.json()["data"]
    assert res_data["summary"]["total_sold_qty"] == "20.000"
    assert res_data["summary"]["total_bonus_qty"] == "2.000"


@pytest.mark.django_db
def test_product_movement_export_xlsx_and_branch_filename(base_data, api, manager_user):
    import io

    from openpyxl import load_workbook

    from apps.warehouse.models import Warehouse

    p_main = base_data["p_main"]
    p_bonus = base_data["p_bonus"]
    client = base_data["client"]
    distributor = base_data["distributor"]

    create_sale(
        distributor=distributor,
        client=client,
        payment_type="NAQD",
        lines=[
            SaleLine(product=p_main, quantity=Decimal("10"), price=Decimal("25000"), is_bonus=False),
            SaleLine(product=p_bonus, quantity=Decimal("1"), price=Decimal("0"), is_bonus=True),
        ],
    )
    today = timezone.now().date().isoformat()

    api.force_authenticate(user=manager_user)
    resp = api.get(
        f"/api/v1/reports/product-movement/export/?date_from={today}&date_to={today}"
    )
    assert resp.status_code == 200
    assert (
        resp["Content-Type"]
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert resp["Content-Disposition"].startswith('attachment; filename="tovar-harakati-')

    wb = load_workbook(io.BytesIO(resp.content))
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    assert rows[0][0] == "Mahsulot"
    assert rows[0][4] == "Sotilgan (pullik)"
    assert rows[0][6] == "Bonus berilgan (bepul)"
    names = {row[0] for row in rows[1:]}
    assert names == {"Bio Kukun 3kg", "Sovun 100g"}

    # Filial rahbari — fayl nomiga filial nomi tushadi
    branch = Warehouse.objects.create(name="Samarqand Filial", is_branch=True)
    branch_manager = User.objects.create_user(
        phone="+998901119988",
        full_name="Samarqand Rahbar",
        role=Role.BRANCH_MANAGER,
        warehouse=branch,
        password="password123",
    )
    api.force_authenticate(user=branch_manager)
    branch_resp = api.get(
        f"/api/v1/reports/product-movement/export/?date_from={today}&date_to={today}"
    )
    assert branch_resp.status_code == 200
    assert "-Samarqand_Filial-" in branch_resp["Content-Disposition"]

