"""Kun yopish uchun agregatlar (CLAUDE.md 6 — formulalar).

    cash_expected    = cash_sales + debt_collected − approved_expenses(CASH)   [F2]
    cash_difference  = cash_handed − cash_expected            (manfiy = kamomad)
    stock_difference = loaded_qty − sold_qty − returned_qty
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from django.db.models import Sum

from apps.clients.models import ClientVisit
from apps.expenses.models import DistributorExpense
from apps.sales.models import DebtPayment, Sale, SaleItem, SaleReturnItem
from apps.wallet.services import get_or_create_wallet
from apps.warehouse.models import LoadingItem

_ZERO = Decimal("0")
_CASH_TYPES = ("NAQD", "ARALASH")
_ACTIVE_SALE = ("COMPLETED", "FLAGGED")


@dataclass
class ProductDiff:
    product_id: str
    product_name: str
    loaded: Decimal
    sold: Decimal
    sale_returned: Decimal
    daily_returned: Decimal
    price: Decimal

    @property
    def difference(self) -> Decimal:
        # kutilgan qaytish − haqiqiy qaytish (musbat = kamomad)
        return (self.loaded - self.sold + self.sale_returned) - self.daily_returned

    @property
    def difference_amount(self) -> Decimal:
        return self.difference * self.price


@dataclass
class DayCloseSnapshot:
    loaded_amount: Decimal = _ZERO
    sold_amount: Decimal = _ZERO
    returned_amount: Decimal = _ZERO
    stock_difference_qty: Decimal = _ZERO
    stock_difference_amount: Decimal = _ZERO
    cash_sales_amount: Decimal = _ZERO
    debt_collected_amount: Decimal = _ZERO
    expense_amount: Decimal = _ZERO
    expense_approved_amount: Decimal = _ZERO
    cash_expected: Decimal = _ZERO
    wallet_balance_end: Decimal = _ZERO
    debt_given_amount: Decimal = _ZERO
    sales_count: int = 0
    visits_count: int = 0
    new_clients_count: int = 0
    product_diffs: list[ProductDiff] = field(default_factory=list)


def _sum(qs, field_name: str = "quantity") -> Decimal:
    return qs.aggregate(s=Sum(field_name))["s"] or _ZERO


def build_snapshot(distributor, date, *, daily_return_items=None) -> DayCloseSnapshot:
    """`daily_return_items`: [{"product": <Product>, "quantity": Decimal}] — hali
    saqlanmagan qaytarishlar (submit paytida). None bo'lsa DB'dagilar olinadi.
    """
    snap = DayCloseSnapshot()

    loading_items = LoadingItem.objects.filter(
        loading__distributor=distributor,
        loading__date=date,
        loading__status__in=["CONFIRMED", "CLOSED"],
    ).select_related("product")
    sale_items = SaleItem.objects.filter(
        sale__distributor=distributor, sale__date=date,
        sale__status__in=_ACTIVE_SALE,
    ).select_related("product")
    sale_return_items = SaleReturnItem.objects.filter(
        sale_return__distributor=distributor, sale_return__date=date,
        sale_return__restock=True,
    ).select_related("product")

    snap.loaded_amount = _sum(loading_items, "amount")
    snap.sold_amount = (
        Sale.objects.filter(
            distributor=distributor, date=date, status__in=_ACTIVE_SALE
        ).aggregate(s=Sum("total_amount"))["s"] or _ZERO
    )
    snap.sales_count = Sale.objects.filter(
        distributor=distributor, date=date, status__in=_ACTIVE_SALE
    ).count()

    snap.cash_sales_amount = (
        Sale.objects.filter(
            distributor=distributor, date=date, status__in=_ACTIVE_SALE,
            payment_type__in=_CASH_TYPES,
        ).aggregate(s=Sum("paid_amount"))["s"] or _ZERO
    )
    snap.debt_given_amount = (
        Sale.objects.filter(
            distributor=distributor, date=date, status__in=_ACTIVE_SALE
        ).aggregate(s=Sum("debt_amount"))["s"] or _ZERO
    )
    snap.debt_collected_amount = (
        DebtPayment.objects.filter(
            collected_by=distributor, date=date, payment_type="NAQD"
        ).aggregate(s=Sum("amount"))["s"] or _ZERO
    )

    day_expenses = DistributorExpense.objects.filter(
        distributor=distributor, date=date
    ).exclude(status="REJECTED")
    snap.expense_amount = (
        day_expenses.aggregate(s=Sum("amount"))["s"] or _ZERO
    )
    snap.expense_approved_amount = (
        day_expenses.filter(
            status="APPROVED", payment_source="CASH_ON_HAND"
        ).aggregate(s=Sum("amount"))["s"] or _ZERO
    )

    # CLAUDE.md 6 formula: cash_expected = naqd sotuv + undirilgan qarz
    #                                       − tasdiqlangan qo'ldagi-naqd xarajatlar
    snap.cash_expected = (
        snap.cash_sales_amount
        + snap.debt_collected_amount
        - snap.expense_approved_amount
    )
    snap.wallet_balance_end = get_or_create_wallet(distributor).balance

    snap.visits_count = ClientVisit.objects.filter(
        distributor=distributor, checked_in_at__date=date
    ).count()
    snap.new_clients_count = 0  # yangi mijoz — 3-fazada aniqlashtiriladi

    # --- per-product tovar farqi ---
    by_product: dict[str, ProductDiff] = {}

    def _row(product):
        pid = str(product.id)
        if pid not in by_product:
            by_product[pid] = ProductDiff(
                product_id=pid, product_name=product.name,
                loaded=_ZERO, sold=_ZERO, sale_returned=_ZERO, daily_returned=_ZERO,
                price=product.wholesale_price,
            )
        return by_product[pid]

    for it in loading_items:
        _row(it.product).loaded += it.quantity
    for it in sale_items:
        _row(it.product).sold += it.quantity
    for it in sale_return_items:
        _row(it.product).sale_returned += it.quantity

    if daily_return_items is None:
        from ..models import DailyReturnItem

        for it in DailyReturnItem.objects.filter(
            daily_return__distributor=distributor, daily_return__date=date
        ).select_related("product"):
            r = _row(it.product)
            r.daily_returned += it.quantity
        returned_amount = _ZERO
        from ..models import DailyReturn

        returned_amount = (
            DailyReturn.objects.filter(distributor=distributor, date=date)
            .aggregate(s=Sum("total_amount"))["s"] or _ZERO
        )
    else:
        returned_amount = _ZERO
        for row in daily_return_items:
            r = _row(row["product"])
            r.daily_returned += row["quantity"]
            returned_amount += row["quantity"] * row["product"].wholesale_price

    snap.returned_amount = returned_amount
    snap.product_diffs = list(by_product.values())
    snap.stock_difference_qty = sum(
        (d.difference for d in snap.product_diffs), start=_ZERO
    )
    snap.stock_difference_amount = sum(
        (d.difference_amount for d in snap.product_diffs), start=_ZERO
    )
    return snap
