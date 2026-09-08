"""16-bosqich: yakuniy sayqal — keshlash, throttling, indekslar (CLAUDE.md 16)."""
from __future__ import annotations

import pytest
from django.core.cache import cache

from apps.reports.services import dashboard


@pytest.mark.django_db
def test_dashboard_is_cached_briefly(auth_api, van_stocked):
    first = dashboard()
    assert first["kpi"]["sales_count"] == 0

    # to'g'ridan-to'g'ri sotuv yaratamiz — kesh hali eski qiymatni beradi
    auth_api.post(
        "/api/v1/sales/",
        {
            "client": str(van_stocked["client"].id),
            "payment_type": "NAQD",
            "items": [
                {"product": str(van_stocked["product"].id), "quantity": "3",
                 "price": "27000"},
            ],
        },
        format="json",
    )
    assert dashboard()["kpi"]["sales_count"] == 0            # keshdan
    cache.clear()
    assert dashboard()["kpi"]["sales_count"] == 1            # yangi
    assert dashboard(use_cache=False)["kpi"]["sales_count"] == 1


def test_throttle_scopes_configured():
    from django.conf import settings

    rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
    assert {"anon", "user", "login", "ocr"} <= set(rates)


@pytest.mark.django_db
def test_report_index_present_on_sale():
    from apps.sales.models import Sale

    names = {idx.name for idx in Sale._meta.indexes}
    fieldsets = [tuple(idx.fields) for idx in Sale._meta.indexes]
    assert ("date", "status") in fieldsets
    assert names  # nomlangan indekslar bor
