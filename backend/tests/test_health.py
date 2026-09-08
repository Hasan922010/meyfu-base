import pytest


@pytest.mark.django_db
def test_health_endpoint_open(api):
    resp = api.get("/api/v1/health/")
    assert resp.status_code in (200, 503)
    assert "checks" in resp.data["data"]
    assert "db" in resp.data["data"]["checks"]


@pytest.mark.django_db
def test_schema_available(api):
    resp = api.get("/api/schema/")
    assert resp.status_code == 200
