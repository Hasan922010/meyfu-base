from decimal import Decimal
import pytest
from django.utils import timezone

from apps.catalog.models import Product, Category, Unit
from apps.clients.models import Client, Route
from apps.reports.services.price_variance import price_variance_report
from apps.sales.constants import PaymentType
from apps.sales.services.sale import SaleLine, create_sale
from apps.users.constants import Role
from apps.users.models import User
from apps.warehouse.models import Warehouse, StockMovement


@pytest.mark.django_db
def test_price_variance_report_calculation():
    admin = User.objects.create(phone="+998901234567", role=Role.SUPER_ADMIN.value)
    dist = User.objects.create(phone="+998907654321", role=Role.DISTRIBUTOR.value, full_name="Sardor")
    cat = Category.objects.create(name="Sovunlar")
    unit = Unit.objects.create(name="dona", short_name="dona")
    wh = Warehouse.objects.create(name="Markaziy ombor")

    # P1: faqat tannarx belgilangan, qolgan narxlar 0
    p1 = Product.objects.create(
        name="Kir sovun 200g",
        sku="SOAP-1",
        category=cat,
        unit=unit,
        cost_price=Decimal("10000"),
        wholesale_price=Decimal("0"),
        retail_price=Decimal("0"),
        min_price=Decimal("0"),
        track_variance=True,
    )

    route = Route.objects.create(name="Marshrut 1", distributor=dist)
    client = Client.objects.create(name="Mijoz 1", route=route)

    # Initial stock for distributor van
    from apps.warehouse.services.van import van_apply
    van_apply(distributor=dist, product=p1, quantity=Decimal("100"))

    # Sale 1: Sold at 8,000 (below cost 10,000) -> 2,000 * 5 = 10,000 Kamomad
    today = timezone.now().date()
    create_sale(
        distributor=dist,
        client=client,
        payment_type=PaymentType.CASH,
        lines=[SaleLine(product=p1, quantity=Decimal("5"), price=Decimal("8000"))],
        date=today,
    )

    # Sale 2: Sold at 13,000 (above cost 10,000) -> 3,000 * 4 = 12,000 Ortiqcha
    create_sale(
        distributor=dist,
        client=client,
        payment_type=PaymentType.CASH,
        lines=[SaleLine(product=p1, quantity=Decimal("4"), price=Decimal("13000"))],
        date=today,
    )

    rep = price_variance_report(date_from=today, date_to=today)
    assert len(rep["rows"]) == 2

    summary = rep["summary"]
    # 5*8000 + 4*13000 = 40000 + 52000 = 92000
    assert Decimal(summary["total_amount"]) == Decimal("92000.00")
    # (5+4)*10000 = 90000
    assert Decimal(summary["total_cost"]) == Decimal("90000.00")
    # Kamomad: (10000 - 8000) * 5 = 10000
    assert Decimal(summary["total_kamomad"]) == Decimal("10000.00")
    # Ortiqcha: (13000 - 10000) * 4 = 12000
    assert Decimal(summary["total_ortiqcha"]) == Decimal("12000.00")
    # Net: 12000 - 10000 = 2000
    assert Decimal(summary["net_difference"]) == Decimal("2000.00")
