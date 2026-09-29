"""v5 B2: tarqatuvchilar xaritasi — faqat tashrif/sotuv nuqtalari."""
from __future__ import annotations

from decimal import Decimal

import pytest
from django.utils import timezone

from apps.clients.models import ClientVisit

URL = "/api/v1/reports/distributor-locations/"


@pytest.mark.django_db
def test_latest_visit_point_is_shown(manager_api, distributor, routed_clients):
    ClientVisit.objects.create(
        distributor=distributor, client=routed_clients["my_client"],
        checked_in_at=timezone.now(), latitude=Decimal("41.311100"),
        longitude=Decimal("69.279700"), created_by=distributor,
    )

    rows = manager_api.get(URL).data["data"]["rows"]

    mine = next(r for r in rows if r["id"] == str(distributor.id))
    assert mine["latitude"].startswith("41.3111")
    assert mine["place"] == "Tashrif: Do'kon A"


@pytest.mark.django_db
def test_distributor_without_points_has_no_location(manager_api, distributor):
    rows = manager_api.get(URL).data["data"]["rows"]

    mine = next(r for r in rows if r["id"] == str(distributor.id))
    assert mine["latitude"] is None


@pytest.mark.django_db
def test_distributor_cannot_see_map(auth_api):
    assert auth_api.get(URL).status_code == 403
