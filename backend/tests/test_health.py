import pytest


@pytest.mark.django_db
def test_health_endpoint_open_but_minimal_for_anon(api):
    """SEC-005: anonim faqat {success} oladi — infra tafsiloti yo'q."""
    resp = api.get("/api/v1/health/")
    assert resp.status_code in (200, 503)
    assert "success" in resp.data
    assert "data" not in resp.data


@pytest.mark.django_db
def test_health_full_detail_for_authenticated(auth_api):
    resp = auth_api.get("/api/v1/health/")
    assert resp.status_code in (200, 503)
    assert "checks" in resp.data["data"]
    assert "db" in resp.data["data"]["checks"]


@pytest.mark.django_db
def test_health_full_detail_with_token(api, settings):
    settings.HEALTH_DETAIL_TOKEN = "monitoring-secret-xyz"
    resp = api.get("/api/v1/health/", HTTP_X_HEALTH_TOKEN="monitoring-secret-xyz")
    assert "checks" in resp.data["data"]


@pytest.mark.django_db
def test_schema_available(api):
    resp = api.get("/api/schema/")
    assert resp.status_code == 200
