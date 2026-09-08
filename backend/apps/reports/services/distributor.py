"""360° xodim kartasi — agregatsiya (CLAUDE.md 10, 14).

`distributor_full` — bitta tarqatuvchining davr kesimidagi to'liq ko'rinishi:
sotuv, pul harakati, xarajat, qarzdorlik, mijozlar, mahsulotlar, qoldiq, maosh,
grafiklar. Har headline KPI oldingi davr bilan solishtiriladi (▲▼).

Natija `django.core.cache` da qisqa muddat (60 s) keshlanadi.
"""
from __future__ import annotations

from datetime import date as date_cls
from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db.models import Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce, ExtractHour
from django.utils import timezone

from apps.clients.models import Client, ClientVisit
from apps.dayclose.models import DayClose
from apps.expenses.models import DistributorExpense
from apps.orders.constants import OrderStatus
from apps.orders.models import Order
from apps.payroll.models import Payroll
from apps.payroll.services import month_bounds, resolve_two_stage
from apps.sales.models import Debt, DebtPayment, Sale, SaleItem, SaleReturn

_ZERO = Decimal("0")
_ACTIVE = ("COMPLETED", "FLAGGED")
_DEC = DecimalField(max_digits=16, decimal_places=2)
_CACHE_TTL = 60


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value in (None, ""):
        return _ZERO
    return Decimal(str(value))


def _m(value) -> str:
    return str(_d(value).quantize(Decimal("0.01")))


def _q(value) -> str:
    return str(_d(value).quantize(Decimal("0.001")))


def _sum(qs, field: str):
    return qs.aggregate(s=Coalesce(Sum(field), Value(_ZERO), output_field=_DEC))["s"]


def _pct_change(current: Decimal, previous: Decimal) -> float | None:
    if previous == _ZERO:
        return None
    return round(float((current - previous) / previous * 100), 1)


# --------------------------------------------------------------------------- #
#  Davr
# --------------------------------------------------------------------------- #
def resolve_period(
    preset: str | None,
    date_from: date_cls | None,
    date_to: date_cls | None,
) -> tuple[date_cls, date_cls, date_cls, date_cls, str]:
    """(start, end, prev_start, prev_end, label) qaytaradi."""
    today = timezone.localdate()

    if preset == "today":
        start = end = today
    elif preset == "yesterday":
        start = end = today - timedelta(days=1)
    elif preset == "week":
        start = today - timedelta(days=today.weekday())
        end = today
    elif preset == "month":
        start = today.replace(day=1)
        end = today
    elif preset == "last_month":
        first_this = today.replace(day=1)
        end = first_this - timedelta(days=1)
        start = end.replace(day=1)
    elif preset == "quarter":
        q = (today.month - 1) // 3
        start = date_cls(today.year, q * 3 + 1, 1)
        end = today
    elif preset == "year":
        start = date_cls(today.year, 1, 1)
        end = today
    else:  # custom
        start = date_from or today.replace(day=1)
        end = date_to or today

    span = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=span - 1)
    label = preset or "custom"
    return start, end, prev_start, prev_end, label


# --------------------------------------------------------------------------- #
#  Bloklar
# --------------------------------------------------------------------------- #
def _sales_raw(distributor, df, dt) -> dict:
    sales = Sale.objects.filter(
        distributor=distributor, date__gte=df, date__lte=dt, status__in=_ACTIVE
    )
    items = SaleItem.objects.filter(
        sale__distributor=distributor, sale__date__gte=df, sale__date__lte=dt,
        sale__status__in=_ACTIVE,
    )
    agg = sales.aggregate(
        total=Coalesce(Sum("total_amount"), Value(_ZERO), output_field=_DEC),
        cash=Coalesce(Sum("paid_amount"), Value(_ZERO), output_field=_DEC),
        debt=Coalesce(Sum("debt_amount"), Value(_ZERO), output_field=_DEC),
        count=Count("id"),
    )
    by_pay = {
        r["payment_type"]: r["s"]
        for r in sales.values("payment_type").annotate(
            s=Coalesce(Sum("total_amount"), Value(_ZERO), output_field=_DEC)
        )
    }
    returns = _sum(
        SaleReturn.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt
        ),
        "total_amount",
    )
    profit = _sum(items, "profit")
    qty = items.aggregate(
        s=Coalesce(Sum("quantity"), Value(_ZERO), output_field=_DEC)
    )["s"]
    count = agg["count"]
    return {
        "total_amount": agg["total"],
        "total_profit": profit,
        "sales_count": count,
        "avg_check": (agg["total"] / count) if count else _ZERO,
        "items_sold_qty": qty,
        "cash_amount": by_pay.get("NAQD", _ZERO),
        "card_amount": by_pay.get("PLASTIK", _ZERO),
        "transfer_amount": by_pay.get("OTKAZMA", _ZERO),
        "debt_amount": agg["debt"],
        "returns_amount": returns,
    }


def _money_raw(distributor, df, dt) -> dict:
    cash_collected = _sum(
        Sale.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt,
            status__in=_ACTIVE, payment_type__in=("NAQD", "ARALASH"),
        ),
        "paid_amount",
    )
    debt_collected = _sum(
        DebtPayment.objects.filter(
            collected_by=distributor, date__gte=df, date__lte=dt
        ),
        "amount",
    )
    expenses_total = _sum(
        DistributorExpense.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt, status="APPROVED"
        ),
        "amount",
    )
    closes = DayClose.objects.filter(
        distributor=distributor, date__gte=df, date__lte=dt, status="CLOSED"
    )
    handed = _sum(closes, "cash_handed_amount")
    cash_diff_total = _sum(closes, "cash_difference")
    shortage_days = closes.filter(cash_difference__lt=_ZERO).count()

    wallet_balance = _ZERO
    wallet = getattr(distributor, "wallet", None)
    if wallet is not None:
        wallet_balance = wallet.balance

    return {
        "cash_collected": cash_collected,
        "debt_collected": debt_collected,
        "expenses_total": expenses_total,
        "handed_to_cashier": handed,
        "wallet_balance": wallet_balance,
        "cash_differences_total": cash_diff_total,
        "shortage_days_count": shortage_days,
    }


def _expenses_block(distributor, df, dt) -> dict:
    qs = DistributorExpense.objects.filter(
        distributor=distributor, date__gte=df, date__lte=dt
    ).exclude(status="REJECTED")
    by_cat = list(
        qs.values("category__name")
        .annotate(total=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC))
        .order_by("-total")
    )
    fuel = qs.filter(fuel_log__isnull=False).aggregate(
        liters=Coalesce(Sum("fuel_log__liters"), Value(_ZERO), output_field=_DEC),
        amount=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC),
        price=Coalesce(
            Sum(F("fuel_log__liters") * F("fuel_log__price_per_liter")),
            Value(_ZERO), output_field=_DEC,
        ),
    )
    sales_total = _sum(
        Sale.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt, status__in=_ACTIVE
        ),
        "total_amount",
    )
    fuel_pct = (
        float(fuel["amount"] / sales_total * 100) if sales_total else 0.0
    )
    return {
        "total": _m(_sum(qs, "amount")),
        "by_category": [
            {"category": r["category__name"], "total": _m(r["total"])}
            for r in by_cat
        ],
        "pending_count": qs.filter(status="PENDING").count(),
        "rejected_amount": _m(
            _sum(
                DistributorExpense.objects.filter(
                    distributor=distributor, date__gte=df, date__lte=dt,
                    status="REJECTED",
                ),
                "amount",
            )
        ),
        "fuel": {
            "liters": _q(fuel["liters"]),
            "amount": _m(fuel["amount"]),
            "avg_price": _m(
                (fuel["price"] / fuel["liters"]) if fuel["liters"] else _ZERO
            ),
            "cost_per_sale_percent": round(fuel_pct, 2),
        },
    }


def _debts_block(distributor, df, dt) -> dict:
    given = _sum(
        Sale.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt,
            status__in=_ACTIVE,
        ),
        "debt_amount",
    )
    collected = _sum(
        DebtPayment.objects.filter(
            collected_by=distributor, date__gte=df, date__lte=dt
        ),
        "amount",
    )
    route_debts = Debt.objects.filter(
        client__route__distributor=distributor
    ).exclude(status="PAID")
    outstanding = _sum(route_debts, "remaining")
    today = timezone.localdate()
    overdue = route_debts.filter(due_date__lt=today)
    overdue_amount = _sum(overdue, "remaining")
    overdue_clients = overdue.values("client").distinct().count()
    collection_rate = (
        float(collected / given * 100) if given else None
    )
    return {
        "given_total": _m(given),
        "collected_total": _m(collected),
        "outstanding_total": _m(outstanding),
        "overdue_amount": _m(overdue_amount),
        "overdue_clients_count": overdue_clients,
        "collection_rate": (
            round(collection_rate, 1) if collection_rate is not None else None
        ),
    }


def _clients_block(distributor, df, dt) -> dict:
    visits = ClientVisit.objects.filter(
        distributor=distributor, checked_in_at__date__gte=df,
        checked_in_at__date__lte=dt,
    )
    visited = visits.values("client").distinct().count()
    no_sale = visits.filter(result="SOTUVSIZ").count()
    sold_to = (
        Sale.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt, status__in=_ACTIVE
        )
        .values("client")
        .distinct()
        .count()
    )
    new_clients = Client.objects.filter(
        created_by=distributor, created_at__date__gte=df, created_at__date__lte=dt
    ).count()
    top = list(
        Sale.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt, status__in=_ACTIVE
        )
        .values("client__name")
        .annotate(
            amount=Coalesce(Sum("total_amount"), Value(_ZERO), output_field=_DEC),
            count=Count("id"),
        )
        .order_by("-amount")[:10]
    )
    return {
        "visited_count": visited,
        "sold_to_count": sold_to,
        "new_clients": new_clients,
        "no_sale_visits": no_sale,
        "top_clients": [
            {"client": r["client__name"], "amount": _m(r["amount"]),
             "count": r["count"]}
            for r in top
        ],
    }


def _products_block(distributor, df, dt) -> dict:
    items = SaleItem.objects.filter(
        sale__distributor=distributor, sale__date__gte=df, sale__date__lte=dt,
        sale__status__in=_ACTIVE,
    )
    top = list(
        items.values("product__name")
        .annotate(
            qty=Coalesce(Sum("quantity"), Value(_ZERO), output_field=_DEC),
            amount=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC),
            profit=Coalesce(Sum("profit"), Value(_ZERO), output_field=_DEC),
        )
        .order_by("-amount")[:10]
    )
    cats = list(
        items.values("product__category__name")
        .annotate(amount=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC))
        .order_by("-amount")
    )
    return {
        "top_products": [
            {"product": r["product__name"], "quantity": _q(r["qty"]),
             "amount": _m(r["amount"]), "profit": _m(r["profit"])}
            for r in top
        ],
        "categories": [
            {"category": r["product__category__name"] or "—",
             "amount": _m(r["amount"])}
            for r in cats
        ],
    }


def _stock_block(distributor, df, dt) -> dict:
    from apps.warehouse.models import LoadingItem

    loaded = _sum(
        LoadingItem.objects.filter(
            loading__distributor=distributor, loading__date__gte=df,
            loading__date__lte=dt, loading__status__in=("CONFIRMED", "CLOSED"),
        ),
        "amount",
    )
    closes = DayClose.objects.filter(
        distributor=distributor, date__gte=df, date__lte=dt, status="CLOSED"
    )
    returned = _sum(closes, "returned_amount")
    shortage = _sum(
        closes.filter(stock_difference_amount__gt=_ZERO), "stock_difference_amount"
    )
    return {
        "loaded_amount": _m(loaded),
        "returned_amount": _m(returned),
        "shortage_amount": _m(shortage),
    }


def _payroll_block(distributor, df, dt) -> dict:
    """Davr oxirgi oyi uchun Payroll (bo'lsa) yoki taxminiy hisob."""
    period_start, _ = month_bounds(dt)
    payroll = Payroll.objects.filter(
        distributor=distributor, period=period_start
    ).first()
    if payroll:
        return {
            "period": str(period_start),
            "status": payroll.status,
            "commission_earned": _m(payroll.commission_amount),
            "order_commission": _m(payroll.order_commission_amount),
            "delivery_commission": _m(payroll.delivery_commission_amount),
            "base_salary": _m(payroll.base_salary),
            "bonus": _m(payroll.bonus),
            "deductions": {
                "shortage": _m(payroll.deduction_shortage),
                "cash_diff": _m(payroll.deduction_cash_diff),
                "expense": _m(payroll.deduction_expense),
            },
            "reimbursements": _m(payroll.reimbursement_expense),
            "advances": _m(payroll.advance),
            "estimated_total": _m(payroll.final_amount),
        }

    profile = getattr(distributor, "distributor_profile", None)
    base = _d(getattr(profile, "base_salary", _ZERO))
    order_pct, delivery_pct = resolve_two_stage(user=distributor)

    # DELIVERY — shu odam yetkazgan sotuvlar
    delivered_sales = _sum(
        SaleItem.objects.filter(
            sale__distributor=distributor,
            sale__date__gte=period_start, sale__date__lte=dt,
            sale__status__in=_ACTIVE,
        ),
        "amount",
    )
    # ORDER — shu odam zakazini olgan (Order'siz to'g'ridan-to'g'ri sotuv ham)
    order_sales = _sum(
        SaleItem.objects.filter(
            sale__date__gte=period_start, sale__date__lte=dt,
            sale__status__in=_ACTIVE,
        ).filter(
            Q(sale__order__taken_by=distributor)
            | Q(sale__order__isnull=True, sale__distributor=distributor)
        ),
        "amount",
    )
    order_c = (order_sales * order_pct / Decimal("100")).quantize(Decimal("0.01"))
    delivery_c = (
        delivered_sales * delivery_pct / Decimal("100")
    ).quantize(Decimal("0.01"))
    commission = order_c + delivery_c
    return {
        "period": str(period_start),
        "status": "ESTIMATE",
        "commission_earned": _m(commission),
        "order_commission": _m(order_c),
        "delivery_commission": _m(delivery_c),
        "base_salary": _m(base),
        "bonus": "0.00",
        "deductions": {"shortage": "0.00", "cash_diff": "0.00", "expense": "0.00"},
        "reimbursements": "0.00",
        "advances": "0.00",
        "estimated_total": _m(base + commission),
    }


def _orders_block(distributor, df, dt) -> dict:
    """Buyurtma oqimi (v4 T1) — zakaz olgani va yetkazgani bo'yicha."""
    taken = Order.objects.filter(
        taken_by=distributor, date__gte=df, date__lte=dt
    ).exclude(status=OrderStatus.CANCELLED)
    delivered = Order.objects.filter(
        assigned_to=distributor, date__gte=df, date__lte=dt,
        status__in=[OrderStatus.DELIVERED, OrderStatus.PARTIALLY_DELIVERED],
    )
    cancelled = Order.objects.filter(
        taken_by=distributor, date__gte=df, date__lte=dt,
        status=OrderStatus.CANCELLED,
    )
    pending = Order.objects.filter(
        assigned_to=distributor,
        status__in=[OrderStatus.APPROVED, OrderStatus.LOADED],
    )
    return {
        "taken_count": taken.count(),
        "taken_amount": _m(_sum(taken, "total_amount")),
        "delivered_count": delivered.count(),
        "delivered_amount": _m(_sum(delivered, "total_amount")),
        "cancelled_count": cancelled.count(),
        "pending_count": pending.count(),
    }


def _charts_block(distributor, df, dt) -> dict:
    sales = Sale.objects.filter(
        distributor=distributor, date__gte=df, date__lte=dt, status__in=_ACTIVE
    )
    daily = list(
        sales.values("date")
        .annotate(
            amount=Coalesce(Sum("total_amount"), Value(_ZERO), output_field=_DEC),
            count=Count("id"),
        )
        .order_by("date")
    )
    items = SaleItem.objects.filter(
        sale__distributor=distributor, sale__date__gte=df, sale__date__lte=dt,
        sale__status__in=_ACTIVE,
    )
    daily_profit = {
        r["sale__date"]: r["p"]
        for r in items.values("sale__date").annotate(
            p=Coalesce(Sum("profit"), Value(_ZERO), output_field=_DEC)
        )
    }
    daily_expense = {
        r["date"]: r["s"]
        for r in DistributorExpense.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt
        ).exclude(status="REJECTED").values("date").annotate(
            s=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC)
        )
    }
    payment_mix = list(
        sales.values("payment_type").annotate(
            amount=Coalesce(Sum("total_amount"), Value(_ZERO), output_field=_DEC)
        ).order_by("-amount")
    )
    hourly = list(
        sales.annotate(h=ExtractHour("created_at"))
        .values("h")
        .annotate(
            amount=Coalesce(Sum("total_amount"), Value(_ZERO), output_field=_DEC),
            count=Count("id"),
        )
        .order_by("h")
    )
    return {
        "daily_sales": [
            {
                "date": str(r["date"]),
                "amount": _m(r["amount"]),
                "count": r["count"],
                "profit": _m(daily_profit.get(r["date"], _ZERO)),
                "expense": _m(daily_expense.get(r["date"], _ZERO)),
            }
            for r in daily
        ],
        "payment_mix": [
            {"type": r["payment_type"], "amount": _m(r["amount"])}
            for r in payment_mix
        ],
        "hourly_activity": [
            {"hour": r["h"], "amount": _m(r["amount"]), "count": r["count"]}
            for r in hourly
        ],
    }


def distributor_timeline(distributor, df, dt) -> list[dict]:
    """Kunlik jurnal: yuklandi → sotildi → qaytdi → xarajat → topshirdi → farq."""
    from apps.warehouse.models import LoadingItem

    loaded = {
        r["loading__date"]: r["s"]
        for r in LoadingItem.objects.filter(
            loading__distributor=distributor, loading__date__gte=df,
            loading__date__lte=dt, loading__status__in=("CONFIRMED", "CLOSED"),
        ).values("loading__date").annotate(
            s=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC)
        )
    }
    sold = {
        r["date"]: (r["s"], r["c"])
        for r in Sale.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt, status__in=_ACTIVE
        ).values("date").annotate(
            s=Coalesce(Sum("total_amount"), Value(_ZERO), output_field=_DEC),
            c=Count("id"),
        )
    }
    returned = {
        r["date"]: r["s"]
        for r in SaleReturn.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt
        ).values("date").annotate(
            s=Coalesce(Sum("total_amount"), Value(_ZERO), output_field=_DEC)
        )
    }
    expense = {
        r["date"]: r["s"]
        for r in DistributorExpense.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt
        ).exclude(status="REJECTED").values("date").annotate(
            s=Coalesce(Sum("amount"), Value(_ZERO), output_field=_DEC)
        )
    }
    closes = {
        dc.date: dc
        for dc in DayClose.objects.filter(
            distributor=distributor, date__gte=df, date__lte=dt
        )
    }

    days = sorted(
        set(loaded) | set(sold) | set(returned) | set(expense) | set(closes)
    )
    rows = []
    for day in days:
        dc = closes.get(day)
        s_amount, s_count = sold.get(day, (_ZERO, 0))
        rows.append({
            "date": str(day),
            "loaded": _m(loaded.get(day, _ZERO)),
            "sold": _m(s_amount),
            "sales_count": s_count,
            "returned": _m(returned.get(day, _ZERO)),
            "cash": _m(dc.cash_handed_amount if dc else _ZERO),
            "expense": _m(expense.get(day, _ZERO)),
            "handed": _m(dc.cash_handed_amount if dc else _ZERO),
            "difference": _m(dc.cash_difference if dc else _ZERO),
            "status": dc.status if dc else "OPEN",
        })
    return rows


# --------------------------------------------------------------------------- #
#  Yig'ish
# --------------------------------------------------------------------------- #
def _serialize_sales(raw: dict, plan: Decimal) -> dict:
    completion = float(raw["total_amount"] / plan * 100) if plan else None
    return {
        "total_amount": _m(raw["total_amount"]),
        "total_profit": _m(raw["total_profit"]),
        "sales_count": raw["sales_count"],
        "avg_check": _m(raw["avg_check"]),
        "items_sold_qty": _q(raw["items_sold_qty"]),
        "cash_amount": _m(raw["cash_amount"]),
        "card_amount": _m(raw["card_amount"]),
        "transfer_amount": _m(raw["transfer_amount"]),
        "debt_amount": _m(raw["debt_amount"]),
        "plan": _m(plan),
        "plan_completion_percent": (
            round(completion, 1) if completion is not None else None
        ),
        "returns_amount": _m(raw["returns_amount"]),
    }


def _serialize_money(raw: dict) -> dict:
    return {
        "cash_collected": _m(raw["cash_collected"]),
        "debt_collected": _m(raw["debt_collected"]),
        "expenses_total": _m(raw["expenses_total"]),
        "handed_to_cashier": _m(raw["handed_to_cashier"]),
        "wallet_balance": _m(raw["wallet_balance"]),
        "cash_differences_total": _m(raw["cash_differences_total"]),
        "shortage_days_count": raw["shortage_days_count"],
    }


def _changes(cur_sales, prev_sales, cur_money, prev_money) -> dict:
    """Raw (Decimal) bloklar bo'yicha oldingi davrga nisbatan % o'zgarish."""
    return {
        "total_amount": _pct_change(
            cur_sales["total_amount"], prev_sales["total_amount"]
        ),
        "total_profit": _pct_change(
            cur_sales["total_profit"], prev_sales["total_profit"]
        ),
        "sales_count": _pct_change(
            Decimal(cur_sales["sales_count"]), Decimal(prev_sales["sales_count"])
        ),
        "avg_check": _pct_change(cur_sales["avg_check"], prev_sales["avg_check"]),
        "cash_collected": _pct_change(
            cur_money["cash_collected"], prev_money["cash_collected"]
        ),
        "debt_collected": _pct_change(
            cur_money["debt_collected"], prev_money["debt_collected"]
        ),
        "expenses_total": _pct_change(
            cur_money["expenses_total"], prev_money["expenses_total"]
        ),
    }


def _build_full(distributor, df, dt, prev_df, prev_dt, label) -> dict:
    profile = getattr(distributor, "distributor_profile", None)
    plan = _d(getattr(profile, "monthly_plan", _ZERO))

    cur_sales_raw = _sales_raw(distributor, df, dt)
    prev_sales_raw = _sales_raw(distributor, prev_df, prev_dt)
    cur_money_raw = _money_raw(distributor, df, dt)
    prev_money_raw = _money_raw(distributor, prev_df, prev_dt)

    route = getattr(distributor, "routes", None)
    route_name = ""
    if route is not None:
        first = distributor.routes.first()
        route_name = first.name if first else ""

    return {
        "distributor": {
            "id": str(distributor.id),
            "full_name": distributor.full_name,
            "phone": distributor.phone,
            "route": route_name,
            "hire_date": str(distributor.hire_date) if distributor.hire_date else None,
            "commission_percent": _m(
                getattr(profile, "commission_percent", _ZERO) or _ZERO
            ),
            "last_seen_at": (
                distributor.last_seen_at.isoformat()
                if distributor.last_seen_at else None
            ),
        },
        "period": {
            "preset": label,
            "date_from": str(df),
            "date_to": str(dt),
            "prev_from": str(prev_df),
            "prev_to": str(prev_dt),
        },
        "sales": _serialize_sales(cur_sales_raw, plan),
        "money": _serialize_money(cur_money_raw),
        "expenses": _expenses_block(distributor, df, dt),
        "debts": _debts_block(distributor, df, dt),
        "clients": _clients_block(distributor, df, dt),
        "products": _products_block(distributor, df, dt),
        "stock": _stock_block(distributor, df, dt),
        "orders": _orders_block(distributor, df, dt),
        "payroll": _payroll_block(distributor, df, dt),
        "charts": _charts_block(distributor, df, dt),
        "timeline": distributor_timeline(distributor, df, dt),
        "changes": _changes(
            cur_sales_raw, prev_sales_raw, cur_money_raw, prev_money_raw
        ),
    }


def distributor_full(
    distributor,
    *,
    preset: str | None = None,
    date_from: date_cls | None = None,
    date_to: date_cls | None = None,
    use_cache: bool = True,
) -> dict:
    df, dt, prev_df, prev_dt, label = resolve_period(preset, date_from, date_to)
    key = f"dist360:{distributor.id}:{df}:{dt}"
    if use_cache:
        cached = cache.get(key)
        if cached is not None:
            return cached
    data = _build_full(distributor, df, dt, prev_df, prev_dt, label)
    if use_cache:
        cache.set(key, data, _CACHE_TTL)
    return data


def distributor_comparison(
    *,
    preset: str | None = None,
    date_from: date_cls | None = None,
    date_to: date_cls | None = None,
) -> dict:
    from apps.users.constants import Role

    df, dt, _pf, _pt, label = resolve_period(preset, date_from, date_to)
    from django.contrib.auth import get_user_model

    User = get_user_model()
    distributors = User.objects.filter(role=Role.DISTRIBUTOR, is_active=True)

    rows = []
    for dist in distributors:
        s = _sales_raw(dist, df, dt)
        m = _money_raw(dist, df, dt)
        profile = getattr(dist, "distributor_profile", None)
        plan = _d(getattr(profile, "monthly_plan", _ZERO))
        rows.append({
            "id": str(dist.id),
            "full_name": dist.full_name,
            "sales": _m(s["total_amount"]),
            "profit": _m(s["total_profit"]),
            "sales_count": s["sales_count"],
            "avg_check": _m(s["avg_check"]),
            "cash_collected": _m(m["cash_collected"]),
            "expenses": _m(m["expenses_total"]),
            "shortage_days": m["shortage_days_count"],
            "plan": _m(plan),
            "plan_completion_percent": (
                round(float(s["total_amount"] / plan * 100), 1) if plan else None
            ),
        })
    rows.sort(key=lambda r: Decimal(r["sales"]), reverse=True)
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    return {
        "period": {"preset": label, "date_from": str(df), "date_to": str(dt)},
        "rows": rows,
    }


def distributor_rows_for_export(distributor, df, dt) -> list[list]:
    """360° kartaning kunlik jurnalini Excel qatorlariga."""
    header = ["Sana", "Yuklandi", "Sotildi", "Sotuvlar", "Qaytdi", "Xarajat",
              "Topshirdi", "Farq", "Holat"]
    rows = [header]
    for r in distributor_timeline(distributor, df, dt):
        rows.append([
            r["date"], float(r["loaded"]), float(r["sold"]), r["sales_count"],
            float(r["returned"]), float(r["expense"]), float(r["handed"]),
            float(r["difference"]), r["status"],
        ])
    return rows
