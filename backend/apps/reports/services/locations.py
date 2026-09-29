"""Tarqatuvchilarning bugungi oxirgi joylashuvi — xarita uchun (v5: B2).

CLAUDE.md 8: GPS kun bo'yi kuzatilmaydi. Bu yerda faqat tashrif (check-in) va
sotuv paytida yozilgan nuqtalar ishlatiladi — alohida kuzatuv yo'q.
"""
from __future__ import annotations

from datetime import date as date_cls

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum

from apps.clients.models import ClientVisit
from apps.core.business_day import business_date
from apps.sales.models import Sale
from apps.users.constants import Role

_ACTIVE = ("COMPLETED", "FLAGGED")


def _distributors(branch):
    qs = get_user_model().objects.filter(role=Role.DISTRIBUTOR, is_active=True)
    if branch is None:
        return qs.filter(Q(warehouse__isnull=True) | Q(warehouse__is_branch=False))
    return qs.filter(warehouse_id=branch)


def distributor_locations(*, day: date_cls | None = None, branch=None) -> dict:
    day = day or business_date()
    people = {u.id: u for u in _distributors(branch)}
    latest: dict = {}

    visits = ClientVisit.objects.filter(
        distributor_id__in=people, checked_in_at__date=day,
        latitude__isnull=False, longitude__isnull=False,
    ).select_related("client").order_by("checked_in_at")
    for v in visits:
        latest[v.distributor_id] = (v.checked_in_at, v.latitude, v.longitude,
                                    f"Tashrif: {v.client.name}")

    sales = Sale.objects.filter(
        distributor_id__in=people, date=day, status__in=_ACTIVE,
        latitude__isnull=False, longitude__isnull=False,
    ).select_related("client").order_by("created_at")
    for s in sales:
        current = latest.get(s.distributor_id)
        if current is None or s.created_at >= current[0]:
            latest[s.distributor_id] = (s.created_at, s.latitude, s.longitude,
                                        f"Sotuv: {s.client.name}")

    totals = {
        r["distributor"]: r for r in Sale.objects.filter(
            distributor_id__in=people, date=day, status__in=_ACTIVE,
        ).values("distributor").annotate(count=Count("id"), amount=Sum("total_amount"))
    }
    rows = []
    for uid, user in people.items():
        point = latest.get(uid)
        total = totals.get(uid, {})
        rows.append({
            "id": str(uid), "name": user.full_name,
            "latitude": str(point[1]) if point else None,
            "longitude": str(point[2]) if point else None,
            "at": point[0].isoformat() if point else None,
            "place": point[3] if point else None,
            "sales_count": total.get("count", 0),
            "sales_amount": str(total.get("amount") or 0),
        })
    rows.sort(key=lambda r: r["name"])
    return {"date": day.isoformat(), "rows": rows}
