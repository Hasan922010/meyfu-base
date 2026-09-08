"""13-bosqich: 360° xodim kartasi — agregatsiya, davr, solishtirish, ruxsatlar
(CLAUDE.md 10, 14, 18)."""
from __future__ import annotations

import datetime
from decimal import Decimal

import pytest

from apps.reports.services import distributor_full, resolve_period


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


# --------------------------------------------------------------------------- #
#  Davr
# --------------------------------------------------------------------------- #
def test_resolve_period_month_vs_prev():
    start, end, prev_start, prev_end, label = resolve_period("month", None, None)
    assert start.day == 1
    assert label == "month"
    assert prev_end == start - datetime.timedelta(days=1)
    assert (end - start).days == (prev_end - prev_start).days  # teng oynalar


def test_resolve_period_custom():
    start, end, *_ = resolve_period(
        "custom", datetime.date(2026, 3, 1), datetime.date(2026, 3, 15)
    )
    assert (start, end) == (datetime.date(2026, 3, 1), datetime.date(2026, 3, 15))


# --------------------------------------------------------------------------- #
#  Agregatsiya
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_full_card_structure_and_totals(auth_api, van_stocked):
    client, product = van_stocked["client"], van_stocked["product"]
    _sale(auth_api, client, product, "10", price="27000")
    _sale(auth_api, client, product, "5", price="27000", payment="QARZ")

    data = distributor_full(
        van_stocked["distributor"], preset="month", use_cache=False
    )

    for key in (
        "distributor", "period", "sales", "money", "expenses", "debts",
        "clients", "products", "stock", "payroll", "charts", "timeline", "changes",
    ):
        assert key in data, key

    assert data["sales"]["total_amount"] == "405000.00"
    assert data["sales"]["cash_amount"] == "270000.00"
    assert data["sales"]["debt_amount"] == "135000.00"
    assert data["sales"]["sales_count"] == 2
    assert data["sales"]["avg_check"] == "202500.00"
    assert data["money"]["cash_collected"] == "270000.00"
    assert len(data["products"]["top_products"]) == 1
    assert data["charts"]["daily_sales"][0]["count"] == 2


@pytest.mark.django_db
def test_payroll_block_uses_estimate_when_no_payroll(auth_api, van_stocked):
    profile = van_stocked["distributor"].distributor_profile
    profile.base_salary = Decimal("2000000")
    profile.commission_percent = Decimal("10")
    profile.save()
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", price="30000")

    data = distributor_full(
        van_stocked["distributor"], preset="month", use_cache=False
    )
    assert data["payroll"]["status"] == "ESTIMATE"
    assert data["payroll"]["commission_earned"] == "30000.00"  # 10% × 300 000
    assert data["payroll"]["estimated_total"] == "2030000.00"


@pytest.mark.django_db
def test_changes_vs_previous_period(auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", price="27000")
    data = distributor_full(
        van_stocked["distributor"], preset="month", use_cache=False
    )
    # oldingi oy sotuvsiz → o'zgarish None (0 dan bo'linmaydi)
    assert data["changes"]["total_amount"] is None


# --------------------------------------------------------------------------- #
#  API + ruxsatlar
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_manager_can_view_any_distributor(manager_api, auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10")
    resp = manager_api.get(
        f"/api/v1/reports/distributor/{van_stocked['distributor'].id}/full/?preset=month"
    )
    assert resp.status_code == 200
    assert resp.data["data"]["sales"]["sales_count"] == 1


@pytest.mark.django_db
def test_distributor_sees_only_own_card(auth_api, van_stocked, routed_clients):
    own = auth_api.get(
        f"/api/v1/reports/distributor/{van_stocked['distributor'].id}/full/"
    )
    assert own.status_code == 200

    other_id = routed_clients["other_distributor"].id
    forbidden = auth_api.get(f"/api/v1/reports/distributor/{other_id}/full/")
    assert forbidden.status_code == 403


@pytest.mark.django_db
def test_comparison_ranks_by_sales(manager_api, auth_api, van_stocked, routed_clients):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10", price="27000")

    resp = manager_api.get("/api/v1/reports/distributor-comparison/?preset=month")
    assert resp.status_code == 200
    rows = resp.data["data"]["rows"]
    assert rows[0]["rank"] == 1
    assert rows[0]["full_name"] == "Test Tarqatuvchi"
    assert rows[0]["sales"] == "270000.00"
    # ikkinchi tarqatuvchi sotuvsiz — ro'yxatda bor, past o'rinda
    assert any(r["full_name"] == "Boshqa Tarqatuvchi" for r in rows)


@pytest.mark.django_db
def test_timeline_endpoint(manager_api, auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10")
    resp = manager_api.get(
        f"/api/v1/reports/distributor/{van_stocked['distributor'].id}/timeline/?preset=month"
    )
    assert resp.status_code == 200
    rows = resp.data["data"]["rows"]
    assert len(rows) >= 1
    assert rows[0]["sales_count"] == 1


@pytest.mark.django_db
def test_distributor_excel_export(manager_api, auth_api, van_stocked):
    _sale(auth_api, van_stocked["client"], van_stocked["product"], "10")
    resp = manager_api.get(
        f"/api/v1/reports/export/?type=distributor"
        f"&distributor={van_stocked['distributor'].id}&preset=month"
    )
    assert resp.status_code == 200
    assert resp.content[:2] == b"PK"
