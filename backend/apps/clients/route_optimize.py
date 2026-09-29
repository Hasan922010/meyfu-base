"""Marshrutni optimallashtirish (v5: C4) — eng yaqin qo'shni + 2-opt.

Tashqi xizmat (Google/OSRM) ishlatilmaydi: masofa — to'g'ri chiziq (haversine).
Shahar ichida bu yo'l masofasiga yaqin tartib beradi va internet/pul talab qilmaydi.
Koordinatasi yo'q mijozlar oxirida, eski tartibida qoladi.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from django.db import transaction

from apps.core.models import AuditLog

from .models import Client, Route

_EARTH_KM = 6371.0
_MAX_2OPT_ROUNDS = 50


@dataclass(frozen=True)
class Stop:
    client: Client
    lat: float
    lng: float


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2)
    return 2 * _EARTH_KM * math.asin(math.sqrt(h))


def path_km(points: list[tuple[float, float]]) -> float:
    return sum(haversine_km(points[i], points[i + 1]) for i in range(len(points) - 1))


def _nearest_neighbour(points: list[tuple[float, float]], start: int) -> list[int]:
    order, left = [start], set(range(len(points))) - {start}
    while left:
        last = points[order[-1]]
        nxt = min(left, key=lambda i: haversine_km(last, points[i]))
        order.append(nxt)
        left.remove(nxt)
    return order


def _two_opt(order: list[int], points: list[tuple[float, float]]) -> list[int]:
    """Ochiq yo'l uchun 2-opt: kesishgan qirralarni teskari aylantiradi."""
    best = order[:]
    for _ in range(_MAX_2OPT_ROUNDS):
        improved = False
        for i in range(1, len(best) - 1):
            for k in range(i + 1, len(best)):
                a, b = points[best[i - 1]], points[best[i]]
                c = points[best[k]]
                d = points[best[k + 1]] if k + 1 < len(best) else None
                before = haversine_km(a, b) + (haversine_km(c, d) if d else 0.0)
                after = haversine_km(a, c) + (haversine_km(b, d) if d else 0.0)
                if after < before - 1e-9:
                    best[i:k + 1] = reversed(best[i:k + 1])
                    improved = True
        if not improved:
            break
    return best


def optimize_route(
    route: Route, *, start: tuple[float, float] | None = None,
) -> dict:
    """Taklif qilingan tartib (yozmaydi). `start` — ombor/boshlanish nuqtasi."""
    clients = list(route.clients.order_by("route_order", "name"))
    stops = [Stop(c, float(c.latitude), float(c.longitude)) for c in clients
             if c.latitude is not None and c.longitude is not None]
    no_geo = [c for c in clients if c.latitude is None or c.longitude is None]

    points = [(s.lat, s.lng) for s in stops]
    offset = 0
    if start is not None:
        points = [start, *points]
        offset = 1
    current = list(range(len(points)))
    if len(points) > 1:
        ordered = _two_opt(_nearest_neighbour(points, 0), points)
    else:
        ordered = current
    visit = [i - offset for i in ordered if i >= offset]

    result = [stops[i].client for i in visit] + no_geo
    return {
        "route": str(route.id),
        "km_before": round(path_km(points), 2),
        "km_after": round(path_km([points[i] for i in ordered]), 2),
        "without_location": len(no_geo),
        "clients": [
            {"id": str(c.id), "name": c.name, "address": c.address, "order": n,
             "latitude": str(c.latitude) if c.latitude is not None else None,
             "longitude": str(c.longitude) if c.longitude is not None else None}
            for n, c in enumerate(result, start=1)
        ],
    }


@transaction.atomic
def apply_route_order(route: Route, client_ids: list[str], *, user) -> int:
    """Tartibni saqlaydi. Faqat shu marshrut mijozlari; ro'yxatda yo'qlari oxirida."""
    clients = {str(c.id): c for c in route.clients.select_for_update()}
    ordered = [cid for cid in client_ids if cid in clients]
    ordered += sorted(set(clients) - set(ordered), key=lambda cid: clients[cid].name)
    for n, cid in enumerate(ordered, start=1):
        Client.objects.filter(pk=cid).update(route_order=n)
    AuditLog.objects.create(
        user=user, action="route.reorder", model_name="Route", object_id=str(route.id),
        changes={"clients": len(ordered)},
    )
    return len(ordered)
