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
    from collections import defaultdict

    from django.contrib.auth import get_user_model
    from django.db.models import Q

    from apps.core.business_day import business_date
    from apps.notifications.services import notify
    from apps.sales.models import Debt
    from apps.users.constants import Role

    from .broadcast import ADMIN_GROUP, admin_branch_group

    today = business_date()
    newly = list(
        Debt.objects.filter(
            due_date__lt=today, status__in=["ACTIVE", "PARTIAL"]
        ).select_related(
            "client",
            "client__branch",
            "client__assigned_to",
            "client__route",
            "client__route__distributor",
        )
    )
    if not newly:
        return

    Debt.objects.filter(pk__in=[d.pk for d in newly]).update(status="OVERDUE")

    by_branch: dict = defaultdict(list)
    for debt in newly:
        by_branch[debt.client.branch_id].append(debt)

    # Markaz adminlari barcha muddati o'tgan qarzlarni bitta xabar sifatida oladi;
    # filial rahbarlari esa faqat o'z filialidagi qarzlarni oladi.
    broadcast(ADMIN_GROUP, "debt.overdue", {"count": len(newly)})
    for branch_id, branch_debts in by_branch.items():
        if branch_id:
            broadcast(
                admin_branch_group(branch_id),
                "debt.overdue",
                {"count": len(branch_debts)},
            )

    User = get_user_model()
    central_admins = User.objects.filter(is_active=True).filter(
        Q(role__in=(Role.SUPER_ADMIN, Role.MANAGER)) | Q(is_superuser=True)
    )
    for admin in central_admins:
        notify(
            admin,
            type="debt.overdue",
            title="Muddati o'tgan qarzlar",
            body=f"{len(newly)} ta qarz muddati o'tdi",
        )

    branch_ids = [bid for bid in by_branch if bid is not None]
    if branch_ids:
        branch_managers = User.objects.filter(
            is_active=True, role=Role.BRANCH_MANAGER, warehouse_id__in=branch_ids
        )
        for manager in branch_managers:
            branch_debts = by_branch.get(manager.warehouse_id, [])
            if branch_debts:
                notify(
                    manager,
                    type="debt.overdue",
                    title="Muddati o'tgan qarzlar",
                    body=f"{len(branch_debts)} ta qarz muddati o'tdi",
                )

    # Har mijozning mas'ul xodimiga (yoki marshrut tarqatuvchisiga) eslatma
    by_distributor: dict = {}
    for debt in newly:
        route = getattr(debt.client, "route", None)
        dist = getattr(debt.client, "assigned_to", None) or (
            getattr(route, "distributor", None) if route else None
        )
        if dist is not None:
            by_distributor.setdefault(dist, []).append(debt)

    for dist, debts in by_distributor.items():
        total = sum((d.remaining for d in debts), start=0)
        notify(
            dist, type="debt.overdue",
            title="Marshrutingizda muddati o'tgan qarzlar",
            body=f"{len(debts)} ta mijoz · jami {total} so'm — undirish kerak",
        )
