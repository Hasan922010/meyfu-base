"""Buyurtma tavsiyasi / qoldiq prognozi (v5: C1).

Oddiy, tushunarli algoritm (murakkab ML emas):
  o'rtacha kunlik sotuv = oxirgi `days` kundagi sotilgan miqdor / days
  mavjud               = ombor qoldig'i + mashinalardagi qoldiq
  necha kunga yetadi    = mavjud / o'rtacha kunlik sotuv
  tavsiya              = o'rtacha × cover_days − mavjud  (qadoqqa yaxlitlanadi)
Kam qoldiq chegarasi (`min_stock_alert`) ham hisobga olinadi.

Filial — o'z sotuvi va o'z qoldig'i; markaz — filialsiz sotuv va markaz omborlari.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import ROUND_CEILING, Decimal

from django.db.models import Q, Sum

from apps.catalog.models import Product
from apps.core.business_day import business_date
from apps.core.exceptions import BusinessError
from apps.sales.models import SaleItem
from apps.warehouse.models import Stock, VanStock

_ZERO = Decimal("0")
_ACTIVE = ("COMPLETED", "FLAGGED")
URGENT_DAYS = Decimal("3")  # yetkazib berish odatda 1–3 kun


def _bounded(value: int, low: int, high: int, name: str) -> int:
    if not low <= value <= high:
        raise BusinessError(
            message=f"«{name}» {low} dan {high} gacha bo'lsin.", code="INVALID_PARAM",
        )
    return value


def _sum_by_product(qs, field: str = "quantity") -> dict:
    return {r["product"]: r["s"] or _ZERO
            for r in qs.values("product").annotate(s=Sum(field))}


def _qty(value: Decimal) -> str:
    return str(Decimal(value).quantize(Decimal("0.001")))


def _round_up(quantity: Decimal, pack: Decimal) -> Decimal:
    if quantity <= _ZERO:
        return _ZERO
    pack = pack if pack and pack > _ZERO else Decimal("1")
    return (quantity / pack).to_integral_value(rounding=ROUND_CEILING) * pack


def _status(days_left: Decimal | None, cover_days: int, below_min: bool) -> str:
    if days_left is not None and days_left < URGENT_DAYS:
        return "URGENT"
    if below_min or (days_left is not None and days_left < cover_days):
        return "SOON"
    return "OK"


def reorder_suggestions(*, branch=None, days: int = 28, cover_days: int = 14) -> dict:
    days = _bounded(days, 7, 180, "days")
    cover_days = _bounded(cover_days, 1, 90, "cover")
    today = business_date()
    since = today - timedelta(days=days)

    sales = SaleItem.objects.filter(
        sale__status__in=_ACTIVE, sale__date__gte=since, sale__date__lt=today,
    )
    stock = Stock.objects.all()
    van = VanStock.objects.filter(quantity__gt=0)
    if branch is None:
        sales = sales.filter(sale__branch__isnull=True)
        stock = stock.filter(warehouse__is_branch=False)
        van = van.filter(Q(distributor__warehouse__isnull=True)
                         | Q(distributor__warehouse__is_branch=False))
    else:
        sales = sales.filter(sale__branch=branch)
        stock = stock.filter(warehouse_id=branch)
        van = van.filter(distributor__warehouse_id=branch)

    sold = _sum_by_product(sales)
    in_stock = _sum_by_product(stock)
    on_vans = _sum_by_product(van)
    ids = set(sold) | set(in_stock) | set(on_vans)
    products = Product.objects.filter(Q(id__in=ids) | Q(min_stock_alert__gt=0),
                                      is_active=True)

    rows = []
    for p in products:
        avg = sold.get(p.id, _ZERO) / days
        available = in_stock.get(p.id, _ZERO) + on_vans.get(p.id, _ZERO)
        below_min = p.min_stock_alert > _ZERO and available < p.min_stock_alert
        if avg <= _ZERO and not below_min:
            continue
        days_left = (available / avg).quantize(Decimal("0.1")) if avg > _ZERO else None
        need = max(avg * cover_days - available, p.min_stock_alert - available, _ZERO)
        rows.append({
            "product": str(p.id), "name": p.name, "sku": p.sku,
            "avg_daily": str(avg.quantize(Decimal("0.01"))),
            "stock": _qty(in_stock.get(p.id, _ZERO)),
            "on_vans": _qty(on_vans.get(p.id, _ZERO)),
            "days_left": str(days_left) if days_left is not None else None,
            "suggested": _qty(_round_up(need, p.pack_quantity)),
            "status": _status(days_left, cover_days, below_min),
        })

    order = {"URGENT": 0, "SOON": 1, "OK": 2}
    rows.sort(key=lambda r: (order[r["status"]],
                             Decimal(r["days_left"]) if r["days_left"] else Decimal("0")))
    return {"days": days, "cover_days": cover_days, "since": since.isoformat(),
            "rows": rows}
