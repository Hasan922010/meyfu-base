import pytest


@pytest.mark.django_db
def test_health_endpoint_open_but_minimal_for_anon(api):
    """SEC-005: anonim faqat {success} oladi — infra tafsiloti yo'q."""
    resp = api.get("/api/v1/health/")
    assert resp.status_code in (200, 503)
    assert "success" in resp.data
    assert "data" not in resp.data


@pytest.mark.django_db
def test_health_full_detail_for_admin(admin_api):
    resp = admin_api.get("/api/v1/health/")
    assert resp.status_code in (200, 503)
    assert "checks" in resp.data["data"]
    assert "db" in resp.data["data"]["checks"]


@pytest.mark.django_db
def test_health_full_detail_with_token(api, settings):
    settings.HEALTH_DETAIL_TOKEN = "monitoring-secret-xyz"
    resp = api.get("/api/v1/health/", HTTP_X_HEALTH_TOKEN="monitoring-secret-xyz")
    assert "checks" in resp.data["data"]


@pytest.mark.django_db
def test_health_deep_is_protected(api, monkeypatch):
    monkeypatch.setattr(
        "apps.core.views.health_checks",
        lambda **_: {"healthy": True, "checks": {"db": {"ok": True}}},
    )
    resp = api.get("/api/v1/health/?deep=1")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_schema_available(api):
    resp = api.get("/api/schema/")
    # Test settings may be production-like; preview exposes the schema while
    # production correctly redirects anonymous callers to staff login.
    assert resp.status_code in (200, 302)
