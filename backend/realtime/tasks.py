"""Real-time davriy vazifalar (CLAUDE.md 11)."""
from __future__ import annotations

from celery import shared_task

from .broadcast import broadcast


@shared_task(ignore_result=True)
def dashboard_tick() -> None:
    """Har 30 soniyada admin panelga yangi KPI yuboradi."""
    from apps.reports.services import dashboard

    try:
        data = dashboard()
    except Exception:  # noqa: BLE001 — tick hech qachon crash bo'lmasin
        return
    broadcast("admin_dashboard", "dashboard.tick", {"kpi": data["kpi"]})


@shared_task(ignore_result=True)
def check_overdue_debts() -> None:
    """Muddati o'tgan qarzlarni belgilaydi + eslatma yuboradi (CLAUDE.md 11, 13)."""
    from django.utils import timezone

    from apps.notifications.services import notify, notify_admins
    from apps.sales.models import Debt

    today = timezone.localdate()
    newly = list(
        Debt.objects.filter(
            due_date__lt=today, status__in=["ACTIVE", "PARTIAL"]
        ).select_related("client", "client__route", "client__route__distributor")
    )
    if not newly:
        return

    Debt.objects.filter(pk__in=[d.pk for d in newly]).update(status="OVERDUE")
    broadcast("admin_dashboard", "debt.overdue", {"count": len(newly)})
    notify_admins(
        type="debt.overdue",
        title="Muddati o'tgan qarzlar",
        body=f"{len(newly)} ta qarz muddati o'tdi",
    )

    # Har marshrut tarqatuvchisiga o'z mijozlari bo'yicha eslatma
    by_distributor: dict = {}
    for debt in newly:
        route = getattr(debt.client, "route", None)
        dist = getattr(route, "distributor", None) if route else None
        if dist is not None:
            by_distributor.setdefault(dist, []).append(debt)

    for dist, debts in by_distributor.items():
        total = sum((d.remaining for d in debts), start=0)
        notify(
            dist, type="debt.overdue",
            title="Marshrutingizda muddati o'tgan qarzlar",
            body=f"{len(debts)} ta mijoz · jami {total} so'm — undirish kerak",
        )
