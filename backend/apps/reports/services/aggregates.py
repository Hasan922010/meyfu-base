"""Hisobot agregatlari (CLAUDE.md 10 — REPORTS)."""
from __future__ import annotations

from datetime import date as date_cls
from decimal import Decimal

from django.core.cache import cache
from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.clients.models import ClientVisit
from apps.expenses.models import DistributorExpense
from apps.finance.models import CompanyExpense
from apps.finance.services import get_account
from apps.sales.models import Debt, DebtPayment, Sale, SaleItem

_ZERO = Decimal("0")
_ACTIVE = ("COMPLETED", "FLAGGED")
_DEC = DecimalField(max_digits=16, decimal_places=2)
_DASHBOARD_TTL = 15  # soniya — WS tik (30 s) va bir nechta admin yuklamasi uchun


def _money(value) -> str:
    return str((value or _ZERO).quantize(Decimal("0.01")))


def _qty(value) -> str:
    return str((value or _ZERO).quantize(Decimal("0.001")))


def dashboard(*, day: date_cls | None = None, use_cache: bool = True) -> dict:
    day = day or timezone.localdate()

    cache_key = f"reports:dashboard:{day}"
    if use_cache:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

    data = _dashboard_compute(day)
    if use_cache:
        cache.set(cache_key, data, _DASHBOARD_TTL)
    return data


def _dashboard_compute(day: date_cls) -> dict:
    sales = Sale.objects.filter(date=day, status__in=_ACTIVE)
    items = SaleItem.objects.filter(sale__date=day, sale__status__in=_ACTIVE)

    agg = sales.aggregate(
        total=Coalesce(Sum("total_amount"), Value(_ZERO), output_field=_DEC),
        cash=Coalesce(Sum("paid_amount"), Value(_ZERO), output_field=_DEC),
        debt=Coalesce(Sum("debt_amount"), Value(_ZERO), output_field=_DEC),
        count=Count("id"),
    )
    profit = items.aggregate(
        p=Coalesce(Sum("profit"), Value(_ZERO), output_field=_DEC)
    )["p"]
    collected = DebtPayment.objects.filter(date=day).aggregate(
        s=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC)
    )["s"]

    top_products = list(
        items.values("product__name")
        .annotate(qty=Sum("quantity"), amount=Sum("amount"))
        .order_by("-amount")[:5]
    )
    by_distributor = list(
        sales.values("distributor__full_name")
        .annotate(amount=Sum("total_amount"), count=Count("id"))
        .order_by("-amount")
    )
    recent = list(
        sales.select_related("client", "distributor")
        .order_by("-created_at")[:10]
        .values("number", "client__name", "distributor__full_name",
                "total_amount", "payment_type", "flagged", "status")
    )

    return {
        "date": str(day),
        "kpi": {
            "sales_total": _money(agg["total"]),
            "profit": _money(profit),
            "cash_in": _money(agg["cash"]),
            "debt_given": _money(agg["debt"]),
            "debt_collected": _money(collected),
            "sales_count": agg["count"],
            "active_distributors": sales.values("distributor").distinct().count(),
            "outstanding_debt": _money(
                Debt.objects.exclude(status="PAID").aggregate(
                    s=Coalesce(Sum("remaining"), Value(_ZERO), output_field=_DEC)
                )["s"]
            ),
            "flagged_sales": sales.filter(flagged=True).count(),
            "visits": ClientVisit.objects.filter(checked_in_at__date=day).count(),
        },
        "top_products": [
            {"name": r["product__name"], "quantity": _qty(r["qty"]),
             "amount": _money(r["amount"])}
            for r in top_products
        ],
        "by_distributor": [
            {"name": r["distributor__full_name"], "amount": _money(r["amount"]),
             "count": r["count"]}
            for r in by_distributor
        ],
        "recent_sales": [
            {"number": r["number"], "client": r["client__name"],
             "distributor": r["distributor__full_name"],
             "amount": _money(r["total_amount"]), "payment_type": r["payment_type"],
             "flagged": r["flagged"], "status": r["status"]}
            for r in recent
        ],
    }


def sales_summary(*, date_from, date_to, group_by: str = "day") -> list[dict]:
    qs = Sale.objects.filter(
        date__gte=date_from, date__lte=date_to, status__in=_ACTIVE
    )

    if group_by == "distributor":
        key, label = "distributor__full_name", "distributor"
    elif group_by == "client":
        key, label = "client__name", "client"
    elif group_by == "product":
        rows = (
            SaleItem.objects.filter(
                sale__date__gte=date_from, sale__date__lte=date_to,
                sale__status__in=_ACTIVE,
            )
            .values("product__name")
            .annotate(quantity=Sum("quantity"), amount=Sum("amount"),
                      profit=Sum("profit"))
            .order_by("-amount")
        )
        return [
            {"product": r["product__name"], "quantity": _qty(r["quantity"]),
             "amount": _money(r["amount"]), "profit": _money(r["profit"])}
            for r in rows
        ]
    else:  # day
        rows = (
            qs.values("date")
            .annotate(amount=Sum("total_amount"), cash=Sum("paid_amount"),
                      debt=Sum("debt_amount"), count=Count("id"))
            .order_by("date")
        )
        return [
            {"day": str(r["date"]), "amount": _money(r["amount"]),
             "cash": _money(r["cash"]), "debt": _money(r["debt"]),
             "count": r["count"]}
            for r in rows
        ]

    rows = (
        qs.values(key)
        .annotate(amount=Sum("total_amount"), cash=Sum("paid_amount"),
                  debt=Sum("debt_amount"), count=Count("id"))
        .order_by("-amount")
    )
    return [
        {label: r[key], "amount": _money(r["amount"]), "cash": _money(r["cash"]),
         "debt": _money(r["debt"]), "count": r["count"]}
        for r in rows
    ]


def debt_aging() -> dict:
    """Qarzdorlik yoshi (CLAUDE.md 10, 13). Muddat bo'yicha guruhlar."""
    today = timezone.localdate()
    active = Debt.objects.exclude(status="PAID").select_related("client")

    buckets = {
        "current": _ZERO,       # muddati kelmagan / muddat yo'q
        "d1_30": _ZERO,
        "d31_60": _ZERO,
        "d61_90": _ZERO,
        "d90_plus": _ZERO,
    }
    total = _ZERO
    overdue_total = _ZERO
    overdue_clients: dict[str, dict] = {}

    for debt in active:
        rem = debt.remaining
        total += rem
        if debt.due_date is None or debt.due_date >= today:
            buckets["current"] += rem
            continue
        days = (today - debt.due_date).days
        overdue_total += rem
        if days <= 30:
            buckets["d1_30"] += rem
        elif days <= 60:
            buckets["d31_60"] += rem
        elif days <= 90:
            buckets["d61_90"] += rem
        else:
            buckets["d90_plus"] += rem

        c = overdue_clients.setdefault(str(debt.client_id), {
            "client": debt.client.name, "phone": debt.client.phone,
            "amount": _ZERO, "max_days": 0,
        })
        c["amount"] += rem
        c["max_days"] = max(c["max_days"], days)

    return {
        "as_of": str(today),
        "total_outstanding": _money(total),
        "overdue_total": _money(overdue_total),
        "buckets": {k: _money(v) for k, v in buckets.items()},
        "overdue_clients": sorted(
            (
                {**c, "amount": _money(c["amount"])}
                for c in overdue_clients.values()
            ),
            key=lambda x: x["max_days"], reverse=True,
        ),
    }


def profit_and_loss(*, date_from, date_to) -> dict:
    """Foyda-zarar (CLAUDE.md 13)."""
    sale_items = SaleItem.objects.filter(
        sale__date__gte=date_from, sale__date__lte=date_to,
        sale__status__in=_ACTIVE,
    )
    revenue = sale_items.aggregate(
        s=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC)
    )["s"]
    gross_profit = sale_items.aggregate(
        s=Coalesce(Sum("profit"), Value(_ZERO), output_field=_DEC)
    )["s"]

    distributor_exp = DistributorExpense.objects.filter(
        date__gte=date_from, date__lte=date_to, status="APPROVED",
    ).aggregate(s=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC))["s"]

    company_exp_qs = CompanyExpense.objects.filter(
        date__gte=date_from, date__lte=date_to
    )
    company_exp = company_exp_qs.aggregate(
        s=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC)
    )["s"]
    company_by_cat = list(
        company_exp_qs.values("category")
        .annotate(total=Sum("amount"))
        .order_by("-total")
    )

    net = gross_profit - distributor_exp - company_exp

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "revenue": _money(revenue),
        "gross_profit": _money(gross_profit),
        "distributor_expenses": _money(distributor_exp),
        "company_expenses": _money(company_exp),
        "company_expenses_by_category": [
            {"category": r["category"], "total": _money(r["total"])}
            for r in company_by_cat
        ],
        "net_profit": _money(net),
        "cash_balance": _money(get_account().balance),
    }


def expenses_report(*, date_from, date_to) -> dict:
    """Xarajatlar hisoboti (CLAUDE.md 10)."""
    dist_qs = DistributorExpense.objects.filter(
        date__gte=date_from, date__lte=date_to
    ).exclude(status="REJECTED")

    by_category = list(
        dist_qs.values("category__name")
        .annotate(
            total=Sum("amount"),
            approved=Sum("amount", filter=Q(status="APPROVED")),
        )
        .order_by("-total")
    )
    by_distributor = list(
        dist_qs.values("distributor__full_name")
        .annotate(total=Sum("amount"))
        .order_by("-total")
    )
    fuel = dist_qs.filter(fuel_log__isnull=False).aggregate(
        liters=Coalesce(Sum("fuel_log__liters"), Value(_ZERO),
                        output_field=_DEC),
        amount=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC),
    )

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "total": _money(
            dist_qs.aggregate(
                s=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC)
            )["s"]
        ),
        "pending_count": dist_qs.filter(status="PENDING").count(),
        "by_category": [
            {"category": r["category__name"], "total": _money(r["total"]),
             "approved": _money(r["approved"] or _ZERO)}
            for r in by_category
        ],
        "by_distributor": [
            {"distributor": r["distributor__full_name"],
             "total": _money(r["total"])}
            for r in by_distributor
        ],
        "fuel": {"liters": _qty(fuel["liters"]), "amount": _money(fuel["amount"])},
    }


def pnl_rows_for_export(payload: dict) -> list[list]:
    """Foyda-zarar hisobotini eksport uchun tekis qatorlarga aylantirish."""
    rows: list[list] = [["Ko'rsatkich", "Summa"]]
    rows.append(["Tushum", float(payload["revenue"])])
    rows.append(["Yalpi foyda", float(payload["gross_profit"])])
    rows.append(["Tarqatuvchi xarajatlari", -float(payload["distributor_expenses"])])
    rows.append(["Kompaniya xarajatlari", -float(payload["company_expenses"])])
    for r in payload.get("company_expenses_by_category", []):
        rows.append([f"  — {r['category']}", -float(r["total"])])
    rows.append(["Sof foyda", float(payload["net_profit"])])
    rows.append(["Kassa balansi", float(payload["cash_balance"])])
    return rows


def sales_rows_for_export(*, date_from, date_to) -> list[list]:
    """Excel eksporti uchun tekis qatorlar."""
    header = ["Raqam", "Sana", "Tarqatuvchi", "Mijoz", "To'lov", "Jami",
              "To'landi", "Qarz", "Holat"]
    rows = [header]
    qs = (
        Sale.objects.filter(date__gte=date_from, date__lte=date_to)
        .select_related("distributor", "client")
        .order_by("date", "number")
    )
    for s in qs:
        rows.append([
            s.number, str(s.date), s.distributor.full_name, s.client.name,
            s.get_payment_type_display(), float(s.total_amount),
            float(s.paid_amount), float(s.debt_amount), s.get_status_display(),
        ])
    return rows
