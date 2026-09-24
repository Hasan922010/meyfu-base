"""UX audit N1: ish kuni 06:00 da boshlanadi (CLAUDE.md 5.4, BUSINESS_DAY_START_HOUR)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from django.test import override_settings

from apps.core.business_day import business_date

TASHKENT = ZoneInfo("Asia/Tashkent")
UTC = ZoneInfo("UTC")


@pytest.mark.parametrize(
    ("moment", "expected"),
    [
        # 04:46 Toshkent — hali kechagi ish kuni
        (datetime(2026, 9, 24, 4, 46, tzinfo=TASHKENT), date(2026, 9, 23)),
        # 05:59 — hali kechagi
        (datetime(2026, 9, 24, 5, 59, tzinfo=TASHKENT), date(2026, 9, 23)),
        # 06:00 — yangi ish kuni
        (datetime(2026, 9, 24, 6, 0, tzinfo=TASHKENT), date(2026, 9, 24)),
        # kechki 23:30 — o'sha kun
        (datetime(2026, 9, 24, 23, 30, tzinfo=TASHKENT), date(2026, 9, 24)),
        # UTC da berilsa ham Toshkent bo'yicha: 23.09 23:44 UTC = 24.09 04:44 Toshkent
        (datetime(2026, 9, 23, 23, 44, tzinfo=UTC), date(2026, 9, 23)),
        # 24.09 01:30 UTC = 06:30 Toshkent — yangi ish kuni
        (datetime(2026, 9, 24, 1, 30, tzinfo=UTC), date(2026, 9, 24)),
    ],
)
def test_business_date_uses_six_am_cutoff_in_tashkent(moment, expected):
    assert business_date(moment) == expected


@override_settings(BUSINESS_DAY_START_HOUR=0)
def test_business_date_zero_hour_is_calendar_date():
    moment = datetime(2026, 9, 24, 4, 46, tzinfo=TASHKENT)
    assert business_date(moment) == date(2026, 9, 24)


@pytest.mark.django_db
def test_sale_before_six_lands_on_previous_business_day_and_in_day_close(
    auth_api, van_stocked, monkeypatch
):
    """04:46 dagi naqd sotuv kechagi ish kuniga tushadi va kun yopishida ko'rinadi."""
    early = datetime(2026, 9, 24, 4, 46, tzinfo=TASHKENT)
    monkeypatch.setattr("django.utils.timezone.now", lambda: early)

    client, product = van_stocked["client"], van_stocked["product"]
    resp = auth_api.post(
        "/api/v1/sales/",
        {
            "client": str(client.id),
            "payment_type": "NAQD",
            "items": [{"product": str(product.id), "quantity": "10", "price": "27000"}],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["data"]["date"] == "2026-09-23"

    today = auth_api.get("/api/v1/day-close/my-today/")
    assert today.data["data"]["date"] == "2026-09-23"
    assert today.data["data"]["cash_sales_amount"] == "270000.00"
