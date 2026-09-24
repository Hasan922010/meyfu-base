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


def test_throttled_login_message_is_localized():
    """Login `10/min` limitiga tegilganda DRF standart inglizcha xabari
    o'rniga o'zbekcha, kutish vaqti bilan xabar qaytishi kerak (CLAUDE.md 20)."""
    from apps.core.exceptions import api_exception_handler
    from rest_framework.exceptions import Throttled

    response = api_exception_handler(Throttled(wait=42), {})

    assert response.status_code == 429
    assert response.data["success"] is False
    assert response.data["error"]["code"] == "THROTTLED"
    assert "42" in response.data["error"]["message"]
    assert "throttled" not in response.data["error"]["message"].lower()


@pytest.mark.django_db
def test_report_index_present_on_sale():
    from apps.sales.models import Sale

    names = {idx.name for idx in Sale._meta.indexes}
    fieldsets = [tuple(idx.fields) for idx in Sale._meta.indexes]
    assert ("date", "status") in fieldsets
    assert names  # nomlangan indekslar bor


def _raised_validation_response(serializer):
    """Berilgan serializer `is_valid(raise_exception=True)` chaqirganda
    ko'tarilgan DRF ValidationError'ni `api_exception_handler` orqali o'tkazadi."""
    from apps.core.exceptions import api_exception_handler
    from rest_framework.exceptions import ValidationError as DRFValidationError

    try:
        serializer.is_valid(raise_exception=True)
    except DRFValidationError as exc:
        response = api_exception_handler(exc, {"view": None})
        assert response is not None
        return response.data
    raise AssertionError("serializer noto'g'ri bo'lishi kutilgan edi")


def test_drf_required_and_max_length_messages_are_uzbek():
    """CLAUDE.md 20: barcha forma xatolari o'zbekcha bo'lishi kerak — bu DRF'ning
    o'z (built-in) 'required'/'max_length' xabarlariga ham tegishli."""
    from rest_framework import serializers

    class _Probe(serializers.Serializer):
        name = serializers.CharField(max_length=3, allow_blank=False)
        age = serializers.IntegerField()

    data = _raised_validation_response(_Probe(data={"name": "toolong"}))

    assert data["success"] is False
    messages = data["error"]["details"]
    assert messages["age"][0] == "Ushbu maydon to'ldirilishi shart."
    assert messages["name"][0] == "Bu maydon 3 ta belgidan oshmasligi kerak."


def test_drf_blank_and_choice_messages_are_uzbek():
    from rest_framework import serializers

    class _Probe(serializers.Serializer):
        note = serializers.CharField(allow_blank=False, required=False)
        kind = serializers.ChoiceField(choices=["A", "B"])

    data = _raised_validation_response(_Probe(data={"note": "", "kind": "ZZZ"}))
    messages = data["error"]["details"]

    assert messages["note"][0] == "Bu maydon bo'sh bo'lishi mumkin emas."
    assert messages["kind"][0] == '"ZZZ" — yaroqli tanlov emas.'


@pytest.mark.django_db
def test_permission_denied_message_is_uzbek(auth_api, catalog):
    """Audit K3: rol ruxsat bermaganda inglizcha DRF matni chiqmasin."""
    resp = auth_api.post(
        "/api/v1/products/",
        {"name": "x", "sku": "x", "category": str(catalog["category"].id),
         "unit": str(catalog["unit"].id)},
        format="json",
    )
    assert resp.status_code == 403
    message = resp.data["error"]["message"]
    assert "permission" not in message.lower()
    assert "rolingiz" in message
