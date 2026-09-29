"""v5 C4: marshrutni optimallashtirish (eng yaqin qo'shni + 2-opt)."""
from __future__ import annotations

from decimal import Decimal

import pytest

from apps.clients.models import Client, Route
from apps.clients.route_optimize import _nearest_neighbour, _two_opt, path_km
from apps.core.models import AuditLog

# Chiziq bo'ylab 4 nuqta (sharqqa ~1.1 km dan), ataylab aralash tartibda yaratiladi
_LINE = {"A": "69.2000", "B": "69.2100", "C": "69.2200", "D": "69.2300"}


@pytest.fixture
def zigzag_route(db, distributor):
    route = Route.objects.create(name="Zigzag", distributor=distributor)
    for n, name in enumerate(["A", "C", "B", "D"], start=1):
        Client.objects.create(name=name, route=route, route_order=n,
                              latitude=Decimal("41.3000"), longitude=Decimal(_LINE[name]))
    Client.objects.create(name="Geosiz", route=route, route_order=5)
    return route


def test_two_opt_removes_crossing():
    points = [(0.0, 0.0), (0.0, 2.0), (0.0, 1.0), (0.0, 3.0)]

    order = _two_opt([0, 1, 2, 3], points)

    assert order == [0, 2, 1, 3]
    assert path_km([points[i] for i in order]) < path_km(points)


def test_nearest_neighbour_visits_all_once():
    points = [(0.0, 0.0), (0.0, 5.0), (0.0, 1.0), (0.0, 2.0)]

    assert sorted(_nearest_neighbour(points, 0)) == [0, 1, 2, 3]


@pytest.mark.django_db
def test_optimize_preview_shortens_route(manager_api, zigzag_route):
    resp = manager_api.get(f"/api/v1/routes/{zigzag_route.id}/optimize/")

    assert resp.status_code == 200
    data = resp.data["data"]
    assert [c["name"] for c in data["clients"]] == ["A", "B", "C", "D", "Geosiz"]
    assert data["km_after"] < data["km_before"]
    assert data["without_location"] == 1
    # taklif — hech narsa yozilmaydi
    assert Client.objects.get(name="C").route_order == 2


@pytest.mark.django_db
def test_reorder_saves_order_and_audits(manager_api, zigzag_route):
    ids = [str(Client.objects.get(name=n).id) for n in ["A", "B", "C", "D"]]

    resp = manager_api.post(f"/api/v1/routes/{zigzag_route.id}/reorder/",
                            {"clients": ids}, format="json")

    assert resp.status_code == 200
    assert [c.name for c in zigzag_route.clients.order_by("route_order")] == [
        "A", "B", "C", "D", "Geosiz"]
    assert AuditLog.objects.filter(action="route.reorder").exists()


@pytest.mark.django_db
def test_distributor_cannot_reorder(auth_api, zigzag_route):
    resp = auth_api.post(f"/api/v1/routes/{zigzag_route.id}/reorder/",
                         {"clients": []}, format="json")

    assert resp.status_code == 403
