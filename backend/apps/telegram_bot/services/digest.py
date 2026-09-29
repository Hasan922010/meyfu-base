"""Kunlik xulosa va eslatmalar (CLAUDE.md 15)."""
from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.core.business_day import business_date
from apps.users.constants import Role

from .send import tg_send, tg_send_admins

_ADMIN_ROLES = [Role.SUPER_ADMIN, Role.MANAGER]


def _fmt(n) -> str:
    return f"{float(n):,.0f}".replace(",", " ")


def build_today_summary(day=None, branch=None) -> str:
    """Kunlik xulosa; `branch` — faqat shu filial bo'yicha (filial rahbari uchun)."""
    from apps.reports.services import dashboard

    day = day or business_date()
    d = dashboard(day=day, branch=branch.pk if branch else None)
    k = d["kpi"]
    title = f" · {branch.name}" if branch else ""
    lines = [
        f"<b>📊 Bugungi hisobot{title} · {day:%d.%m.%Y}</b>",
        "",
        f"Savdo: <b>{_fmt(k['sales_total'])}</b> so'm  ({k['sales_count']} ta)",
        f"Sof foyda: {_fmt(k['profit'])} so'm",
        f"Naqd tushdi: {_fmt(k['cash_in'])} so'm",
        f"Qarzga berildi: {_fmt(k['debt_given'])} so'm",
        f"Qarz undirildi: {_fmt(k['debt_collected'])} so'm",
        f"Umumiy qarzdorlik: {_fmt(k['outstanding_debt'])} so'm",
    ]
    if k["flagged_sales"]:
        lines.append(f"⚠️ Belgilangan sotuvlar: {k['flagged_sales']}")

    orders = _orders_today(day, branch)
    if orders["total"]:
        lines.append("")
        lines.append(
            f"<b>Buyurtmalar:</b> {orders['placed']} yangi · "
            f"{orders['approved']} tasdiqlangan · {orders['delivered']} yetkazilgan"
            + (f" · {orders['cancelled']} bekor" if orders["cancelled"] else "")
        )

    if d["by_distributor"]:
        lines.append("")
        lines.append("<b>Tarqatuvchilar:</b>")
        for row in d["by_distributor"]:
            lines.append(f"• {row['name']}: {_fmt(row['amount'])} ({row['count']})")
    return "\n".join(lines)


def _orders_today(day, branch=None) -> dict:
    from apps.orders.constants import OrderStatus
    from apps.orders.models import Order

    qs = Order.objects.filter(date=day)
    if branch is not None:
        qs = qs.filter(client__branch=branch)
    return {
        "total": qs.count(),
        "placed": qs.filter(status=OrderStatus.PLACED).count(),
        "approved": qs.filter(status=OrderStatus.APPROVED).count(),
        "delivered": qs.filter(
            status__in=[OrderStatus.DELIVERED, OrderStatus.PARTIALLY_DELIVERED]
        ).count(),
        "cancelled": qs.filter(status=OrderStatus.CANCELLED).count(),
    }


def build_overdue_summary(branch=None) -> str:
    from apps.reports.services import debt_aging

    a = debt_aging(branch=branch.pk if branch else None)
    lines = [
        f"<b>💳 Muddati o'tgan qarzlar</b>  ({a['as_of']})",
        f"Jami: <b>{_fmt(a['overdue_total'])}</b> so'm",
        "",
    ]
    if not a["overdue_clients"]:
        lines.append("Muddati o'tgan qarz yo'q ✅")
    for c in a["overdue_clients"][:20]:
        lines.append(f"• {c['client']} — {_fmt(c['amount'])} ({c['max_days']} kun)")
    return "\n".join(lines)


def send_daily_digest() -> int:
    """Har kuni 20:00 — markaz rahbarlariga butun kompaniya bo'yicha, har filial
    rahbariga faqat o'z filiali bo'yicha kunlik xulosa."""
    User = get_user_model()
    sent = tg_send_admins(build_today_summary())
    managers = (
        User.objects.filter(role=Role.BRANCH_MANAGER, is_active=True,
                            warehouse__is_branch=True)
        .exclude(telegram_chat_id="").select_related("warehouse")
    )
    summaries: dict = {}
    for manager in managers:
        branch = manager.warehouse
        if branch.pk not in summaries:
            summaries[branch.pk] = build_today_summary(branch=branch)
        if tg_send(manager, summaries[branch.pk]):
            sent += 1
    return sent


def send_morning_loading_reminder() -> int:
    """Ertalab — bugungi tasdiqlangan yuklamasi bor tarqatuvchilarga."""
    from apps.warehouse.models import Loading

    today = business_date()
    sent = 0
    loadings = Loading.objects.filter(
        date=today, status__in=["CONFIRMED", "SENT"],
    ).select_related("distributor")
    seen: set = set()
    for loading in loadings:
        if loading.distributor_id in seen:
            continue
        seen.add(loading.distributor_id)
        if tg_send(
            loading.distributor,
            f"🌅 Xayrli tong! Bugungi yuklamangiz tayyor: {loading.number}",
        ):
            sent += 1
    return sent


def send_evening_dayclose_reminder() -> int:
    """Kechqurun — kun yopmagan tarqatuvchilarga eslatma."""
    from apps.dayclose.models import DayClose
    from apps.warehouse.models import Loading

    User = get_user_model()
    today = business_date()

    active_distributor_ids = set(
        Loading.objects.filter(
            date=today, status__in=["CONFIRMED", "CLOSED"]
        ).values_list("distributor_id", flat=True)
    )
    closed_ids = set(
        DayClose.objects.filter(date=today).values_list("distributor_id", flat=True)
    )
    pending = active_distributor_ids - closed_ids

    sent = 0
    for user in User.objects.filter(
        id__in=pending, is_active=True
    ).exclude(telegram_chat_id=""):
        if tg_send(
            user,
            "🌙 Kun hali yopilmagan. Iltimos, ilovada kunni yoping.",
        ):
            sent += 1
    return sent
