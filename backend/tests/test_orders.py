"""v4 T1 — Buyurtma (zakaz) oqimi va ikki bosqichli maosh.

Qamrov: idempotentlik, fulfill → Sale, qisman yetkazish, order/delivery komissiyasi,
legacy fallback, bekor qilish, rol ruxsatlari.
"""
from __future__ import annotations

import datetime
from decimal import Decimal

import pytest

from apps.orders.constants import OrderStatus
from apps.orders.models import Order
from apps.orders.services import (
    OrderLine,
    approve_order,
    create_order,
    fulfill_order,
)
from apps.orders.services.order import FulfillLine
from apps.payroll.services import calculate_payroll, payroll_matches_formula

PERIOD = datetime.date(2026, 9, 1)
DAY = datetime.date(2026, 9, 10)


@pytest.fixture
def agent(db):
    """Zakaz oluvchi — order foizi 4%, yetkazish foizi 0."""
    from apps.users.models import DistributorProfile, User

    user = User.objects.create_user(
        phone="+998901230000", password="pass12345", full_name="Zakaz Agenti",
        role="DISTRIBUTOR",
    )
    DistributorProfile.objects.create(
        user=user, order_commission_percent="4", delivery_commission_percent="0",
    )
    return user


@pytest.fixture
def deliverer(distributor):
    """van_stocked ichidagi tarqatuvchi — yetkazish 3%, zakaz 1%."""
    p = distributor.distributor_profile
    p.commission_percent = Decimal("0")
    p.order_commission_percent = Decimal("1")
    p.delivery_commission_percent = Decimal("3")
    p.save()
    return distributor


def _product(product):
    from apps.catalog.models import Product

    return Product.objects.select_related("category", "unit").get(pk=product.pk)


def _make_order(client, taken_by, product, qty="10", price="27000", day=DAY):
    return create_order(
        client=client, taken_by=taken_by,
        lines=[OrderLine(product=_product(product), quantity=Decimal(qty),
                         price=Decimal(price))],
        date=day, payment_intent="NAQD", place=True,
    ).order


# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_order_is_idempotent(agent, van_stocked):
    uuid = "11111111-1111-1111-1111-111111111111"
    kw = dict(
        client=van_stocked["client"], taken_by=agent,
        lines=[OrderLine(product=_product(van_stocked["product"]),
                         quantity=Decimal("5"), price=Decimal("27000"))],
        date=DAY, client_uuid=uuid,
    )
    first = create_order(**kw)
    assert first.created and not first.duplicate
    for _ in range(4):
        again = create_order(**kw)
        assert again.duplicate and again.order.id == first.order.id
    assert Order.objects.filter(client_uuid=uuid).count() == 1


@pytest.mark.django_db
def test_fulfill_creates_linked_sale_and_reduces_van_stock(agent, deliverer,
                                                           van_stocked):
    from apps.warehouse.models import VanStock

    order = _make_order(van_stocked["client"], agent, van_stocked["product"], qty="10")
    approve_order(order)

    before = VanStock.objects.get(
        distributor=deliverer, product=van_stocked["product"]
    ).quantity
    result = fulfill_order(
        order,
        [FulfillLine(item=order.items.first(), delivered_quantity=Decimal("10"))],
        distributor=deliverer, payment_type="NAQD",
    )
    order.refresh_from_db()
    after = VanStock.objects.get(
        distributor=deliverer, product=van_stocked["product"]
    ).quantity

    assert result.sale.order_id == order.id
    assert result.sale.distributor_id == deliverer.id
    assert before - after == Decimal("10")
    assert order.status == OrderStatus.DELIVERED
    assert order.items.first().delivered_quantity == Decimal("10")


@pytest.mark.django_db
def test_partial_delivery(agent, deliverer, van_stocked):
    order = _make_order(van_stocked["client"], agent, van_stocked["product"], qty="10")
    approve_order(order)
    fulfill_order(
        order,
        [FulfillLine(item=order.items.first(), delivered_quantity=Decimal("6"))],
        distributor=deliverer, payment_type="NAQD",
    )
    order.refresh_from_db()
    assert order.status == OrderStatus.PARTIALLY_DELIVERED
    assert order.items.first().delivered_quantity == Decimal("6")


@pytest.mark.django_db
def test_two_stage_commission_split(agent, deliverer, van_stocked):
    """agent zakaz oldi (4%), deliverer yetkazdi (3%). 270 000 so'mlik sotuv."""
    order = _make_order(van_stocked["client"], agent, van_stocked["product"],
                        qty="10", price="27000")
    approve_order(order)
    fulfill_order(
        order,
        [FulfillLine(item=order.items.first(), delivered_quantity=Decimal("10"))],
        distributor=deliverer, payment_type="NAQD",
    )

    agent_pr = calculate_payroll(distributor=agent, period=PERIOD)
    assert agent_pr.order_commission_amount == Decimal("10800.00")   # 4% × 270 000
    assert agent_pr.delivery_commission_amount == Decimal("0.00")
    assert agent_pr.commission_amount == Decimal("10800.00")
    assert agent_pr.details.filter(role="ORDER").count() == 1
    assert payroll_matches_formula(agent_pr)

    deliv_pr = calculate_payroll(distributor=deliverer, period=PERIOD)
    assert deliv_pr.delivery_commission_amount == Decimal("8100.00")  # 3% × 270 000
    assert deliv_pr.order_commission_amount == Decimal("0.00")        # zakazni agent oldi
    assert deliv_pr.total_sales == Decimal("270000.00")
    assert payroll_matches_formula(deliv_pr)


@pytest.mark.django_db
def test_direct_sale_pays_both_stages_to_seller(deliverer, van_stocked):
    """Order'siz sotuv — sotuvchi ham zakaz (1%), ham yetkazish (3%) foizini oladi."""
    from apps.sales.services.sale import SaleLine, create_sale

    create_sale(
        distributor=deliverer, client=van_stocked["client"], payment_type="NAQD",
        lines=[SaleLine(product=_product(van_stocked["product"]),
                        quantity=Decimal("10"), price=Decimal("27000"))],
        date=DAY,
    )
    pr = calculate_payroll(distributor=deliverer, period=PERIOD)
    assert pr.order_commission_amount == Decimal("2700.00")     # 1%
    assert pr.delivery_commission_amount == Decimal("8100.00")  # 3%
    assert pr.commission_amount == Decimal("10800.00")
    assert payroll_matches_formula(pr)


@pytest.mark.django_db
def test_legacy_single_percent_still_works(distributor, van_stocked):
    """Yangi foizlar 0, eski commission_percent=5 → faqat yetkazishga qo'llanadi."""
    from apps.sales.services.sale import SaleLine, create_sale

    p = distributor.distributor_profile
    p.commission_percent = Decimal("5")
    p.order_commission_percent = Decimal("0")
    p.delivery_commission_percent = Decimal("0")
    p.save()

    create_sale(
        distributor=distributor, client=van_stocked["client"], payment_type="NAQD",
        lines=[SaleLine(product=_product(van_stocked["product"]),
                        quantity=Decimal("10"), price=Decimal("27000"))],
        date=DAY,
    )
    pr = calculate_payroll(distributor=distributor, period=PERIOD)
    assert pr.delivery_commission_amount == Decimal("13500.00")  # 5% × 270 000
    assert pr.order_commission_amount == Decimal("0.00")
    assert payroll_matches_formula(pr)


@pytest.mark.django_db
def test_cancelled_order_earns_no_commission(agent, deliverer, van_stocked):
    from apps.orders.services import cancel_order

    order = _make_order(van_stocked["client"], agent, van_stocked["product"])
    approve_order(order)
    cancel_order(order, reason="mijoz rad etdi")
    order.refresh_from_db()
    assert order.status == OrderStatus.CANCELLED

    pr = calculate_payroll(distributor=agent, period=PERIOD)
    assert pr.commission_amount == Decimal("0.00")


@pytest.mark.django_db
def test_cannot_cancel_after_sale(agent, deliverer, van_stocked):
    from apps.core.exceptions import BusinessError
    from apps.orders.services import cancel_order

    order = _make_order(van_stocked["client"], agent, van_stocked["product"])
    approve_order(order)
    fulfill_order(
        order,
        [FulfillLine(item=order.items.first(), delivered_quantity=Decimal("10"))],
        distributor=deliverer, payment_type="NAQD",
    )
    with pytest.raises(BusinessError):
        cancel_order(order, reason="kech")


# --------------------------------------------------------------------------- #
#  API + rol ruxsatlari
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_distributor_sees_only_related_orders(auth_api, agent, van_stocked,
                                              routed_clients):
    """auth_api = van_stocked tarqatuvchisi. agent olgan buyurtmani ko'rmasligi kerak."""
    _make_order(routed_clients["other_client"], agent, van_stocked["product"])
    resp = auth_api.get("/api/v1/orders/")
    assert resp.status_code == 200
    assert resp.data["data"]["count"] == 0


@pytest.mark.django_db
def test_order_create_and_fulfill_via_api(admin_api, auth_api, agent, deliverer,
                                          van_stocked):
    product = _product(van_stocked["product"])
    create = auth_api.post(
        "/api/v1/orders/",
        {
            "client": str(van_stocked["client"].id),
            "taken_by": str(agent.id),
            "items": [{"product": str(product.id), "quantity": "10", "price": "27000"}],
            "payment_intent": "NAQD",
        },
        format="json",
    )
    assert create.status_code == 201, create.data
    order_id = create.data["data"]["id"]

    admin_api.post(f"/api/v1/orders/{order_id}/approve/")

    order = Order.objects.get(pk=order_id)
    ff = auth_api.post(
        f"/api/v1/orders/{order_id}/fulfill/",
        {
            "lines": [
                {"item": str(order.items.first().id), "delivered_quantity": "10"}
            ],
            "distributor": str(deliverer.id),
            "payment_type": "NAQD",
        },
        format="json",
    )
    assert ff.status_code == 201, ff.data
    assert str(ff.data["data"]["sale"]["order"]) == str(order_id)


# --------------------------------------------------------------------------- #
#  v4-5 integratsiya — 360°, integrity, telegram
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_360_card_has_orders_and_commission_split(admin_api, agent, deliverer,
                                                  van_stocked):
    from django.utils import timezone

    today = timezone.localdate()
    period_start = today.replace(day=1)
    order = _make_order(van_stocked["client"], agent, van_stocked["product"],
                        qty="10", price="27000", day=today)
    approve_order(order)
    fulfill_order(
        order,
        [FulfillLine(item=order.items.first(), delivered_quantity=Decimal("10"))],
        distributor=deliverer, payment_type="NAQD",
    )
    calculate_payroll(distributor=deliverer, period=period_start)

    resp = admin_api.get(
        f"/api/v1/reports/distributor/{deliverer.id}/full/?preset=month"
    )
    assert resp.status_code == 200, resp.data
    data = resp.data["data"]
    assert "orders" in data
    assert data["orders"]["delivered_count"] == 1
    assert data["payroll"]["delivery_commission"] == "8100.00"
    assert data["payroll"]["order_commission"] == "0.00"

    agent_card = admin_api.get(
        f"/api/v1/reports/distributor/{agent.id}/full/?preset=month"
    )
    assert agent_card.data["data"]["orders"]["taken_count"] == 1


@pytest.mark.django_db
def test_order_total_integrity_check_and_fix(agent, van_stocked):
    from apps.core.services.integrity import (
        apply_integrity_fix,
        run_integrity_check,
    )

    order = _make_order(van_stocked["client"], agent, van_stocked["product"])
    Order.objects.filter(pk=order.pk).update(total_amount=Decimal("999999"))

    result = run_integrity_check()
    order_mm = [m for m in result["mismatches"] if m["kind"] == "order_total"]
    assert len(order_mm) == 1
    apply_integrity_fix(order_mm[0])

    order.refresh_from_db()
    assert order.total_amount == Decimal("270000.00")  # 10 × 27000
    assert run_integrity_check()["ok"]


@pytest.mark.django_db
def test_telegram_digest_includes_orders(agent, van_stocked):
    from apps.telegram_bot.services.digest import build_today_summary

    order = _make_order(van_stocked["client"], agent, van_stocked["product"])
    approve_order(order)
    text = build_today_summary(day=DAY)
    assert "Buyurtmalar:" in text


# --------------------------------------------------------------------------- #
#  Offline outbox (bulk-sync)
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_offline_order_create_and_fulfill(auth_api, deliverer, van_stocked):
    product = _product(van_stocked["product"])
    uuid = "22222222-2222-2222-2222-222222222222"
    resp = auth_api.post(
        "/api/v1/sales/bulk-sync/",
        {"operations": [{
            "type": "order_create", "client_uuid": uuid,
            "payload": {
                "client": str(van_stocked["client"].id),
                "payment_intent": "NAQD",
                "items": [{"product": str(product.id), "quantity": "10",
                           "price": "27000"}],
            },
        }]},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    r0 = resp.data["data"]["results"][0]
    assert r0["status"] == "SENT"
    order_id = r0["server_id"]

    # dublikat — jimgina DUPLICATE
    dup = auth_api.post(
        "/api/v1/sales/bulk-sync/",
        {"operations": [{"type": "order_create", "client_uuid": uuid,
                         "payload": {"client": str(van_stocked["client"].id),
                                     "items": []}}]},
        format="json",
    )
    assert dup.data["data"]["results"][0]["status"] == "DUPLICATE"
    assert Order.objects.filter(client_uuid=uuid).count() == 1

    order = Order.objects.get(pk=order_id)
    approve_order(order)

    sale_uuid = "33333333-3333-3333-3333-333333333333"
    ff = auth_api.post(
        "/api/v1/sales/bulk-sync/",
        {"operations": [{
            "type": "order_fulfill", "client_uuid": sale_uuid,
            "payload": {
                "order": order_id,
                "payment_type": "NAQD",
                "lines": [{"item": str(order.items.first().id),
                           "delivered_quantity": "10"}],
            },
        }]},
        format="json",
    )
    assert ff.status_code == 200, ff.data
    assert ff.data["data"]["results"][0]["status"] == "SENT"
    order.refresh_from_db()
    assert order.status == OrderStatus.DELIVERED
