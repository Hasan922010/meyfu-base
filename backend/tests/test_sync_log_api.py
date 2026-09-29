"""v5 B6: sinxronizatsiya jurnali API — filtrlar va ruxsatlar."""
from __future__ import annotations

import pytest

from apps.core.models import SyncLog

URL = "/api/v1/sync-logs/"


@pytest.fixture
def logs(distributor):
    ok = SyncLog.objects.create(user=distributor, device_id="tel-01", operations_count=12)
    bad = SyncLog.objects.create(user=distributor, device_id="tel-01", operations_count=3,
                                 conflicts_count=1)
    failed = SyncLog.objects.create(user=distributor, device_id="tel-02", operations_count=2,
                                    errors_count=2)
    return {"ok": ok, "bad": bad, "failed": failed}


def _ids(resp) -> set[str]:
    return {r["id"] for r in resp.data["data"]["results"]}


@pytest.mark.django_db
def test_lists_all_sync_logs(manager_api, logs):
    resp = manager_api.get(URL)

    assert resp.status_code == 200
    assert _ids(resp) == {str(x.id) for x in logs.values()}
    assert resp.data["data"]["results"][0]["user_name"] == "Test Tarqatuvchi"


@pytest.mark.django_db
def test_problems_filter_keeps_conflicts_and_errors(manager_api, logs):
    resp = manager_api.get(URL, {"problems": "true"})

    assert _ids(resp) == {str(logs["bad"].id), str(logs["failed"].id)}


@pytest.mark.django_db
def test_device_filter(manager_api, logs):
    resp = manager_api.get(URL, {"device_id": "tel-02"})

    assert _ids(resp) == {str(logs["failed"].id)}


@pytest.mark.django_db
def test_distributor_cannot_read_sync_logs(auth_api, logs):
    assert auth_api.get(URL).status_code == 403
