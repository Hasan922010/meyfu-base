"""Filiallar kesimidagi solishtirish va markaz bilan hisob-kitob (v5: A5, A6).

Davr ko'rsatkichlari — hujjatdagi muhrlangan `branch` bo'yicha (A2).
Hisob-kitob — butun tarix bo'yicha: markazdan olingan tovar (qabul qilingan
miqdor × jo'natilgan paytdagi tannarx) − markazga qaytarilgan tovar − markazga
topshirilgan pul. Musbat qoldiq — filial markazga shuncha qarzdor.
"""
from __future__ import annotations

from datetime import date as date_cls
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.db.models.functions import Coalesce

from apps.expenses.models import DistributorExpense
from apps.finance.constants import CashTxType
from apps.finance.models import CashAccount, CashTransaction, CompanyExpense
from apps.sales.models import Debt, Sale, SaleItem
from apps.warehouse.constants import TransferStatus
from apps.warehouse.models import TransferItem, Warehouse

_ZERO = Decimal("0")
_DEC = DecimalField(max_digits=20, decimal_places=2)
_ACTIVE = ("COMPLETED", "FLAGGED")


def _money(value) -> str:
    return str((value or _ZERO).quantize(Decimal("0.01")))


def _sum(qs, field: str) -> Decimal:
    return qs.aggregate(s=Coalesce(Sum(field), Value(_ZERO), output_field=_DEC))["s"]


def _goods_value(qs) -> Decimal:
    value = ExpressionWrapper(F("received_quantity") * F("cost_price"), output_field=_DEC)
    return qs.aggregate(s=Coalesce(Sum(value), Value(_ZERO), output_field=_DEC))["s"]


def _received_items(branch):
    return TransferItem.objects.filter(
        transfer__status=TransferStatus.RECEIVED, received_quantity__isnull=False,
    ).filter(Q(transfer__to_warehouse=branch) | Q(transfer__from_warehouse=branch))


def settlement(branch: Warehouse) -> dict:
    """Filial ↔ markaz hisob-kitobi (butun tarix)."""
    items = _received_items(branch)
    from_center = _goods_value(items.filter(
        transfer__to_warehouse=branch, transfer__from_warehouse__is_branch=False,
    ))
    to_center = _goods_value(items.filter(
        transfer__from_warehouse=branch, transfer__to_warehouse__is_branch=False,
    ))
    cash_to_center = -_sum(
        CashTransaction.objects.filter(
            account__branch=branch, transaction_type=CashTxType.BRANCH_OUT,
        ),
        "amount",
    )
    return {
        "goods_from_center": _money(from_center),
        "goods_to_center": _money(to_center),
        "cash_to_center": _money(cash_to_center),
        "balance": _money(from_center - to_center - cash_to_center),
    }


def _row(branch: Warehouse, start: date_cls, end: date_cls) -> dict:
    sales = Sale.objects.filter(
        branch=branch, date__gte=start, date__lte=end, status__in=_ACTIVE,
    )
    items = SaleItem.objects.filter(sale__in=sales)
    dist_exp = _sum(DistributorExpense.objects.filter(
        branch=branch, date__gte=start, date__lte=end, status="APPROVED",
    ), "amount")
    company_exp = _sum(CompanyExpense.objects.filter(
        branch=branch, date__gte=start, date__lte=end,
    ), "amount")
    gross = _sum(items, "profit")
    account = CashAccount.objects.filter(branch=branch).first()
    agg = sales.aggregate(
        total=Coalesce(Sum("total_amount"), Value(_ZERO), output_field=_DEC),
        count=Count("id"),
        distributors=Count("distributor", distinct=True),
    )
    return {
        "id": str(branch.pk),
        "name": branch.name,
        "manager_name": branch.manager.full_name if branch.manager else None,
        "sales_total": _money(agg["total"]),
        "sales_count": agg["count"],
        "active_distributors": agg["distributors"],
        "gross_profit": _money(gross),
        "expenses": _money(dist_exp + company_exp),
        "net_profit": _money(gross - dist_exp - company_exp),
        "outstanding_debt": _money(_sum(
            Debt.objects.filter(client__branch=branch).exclude(status="PAID"), "remaining",
        )),
        "cash_balance": _money(account.balance if account else _ZERO),
        "settlement": settlement(branch),
    }


def branch_comparison(start: date_cls, end: date_cls, branch_ids=None) -> dict:
    """Barcha faol filiallar (yoki `branch_ids`) — davr bo'yicha yonma-yon."""
    branches = Warehouse.objects.filter(is_branch=True, is_active=True).select_related(
        "manager"
    ).order_by("name")
    if branch_ids is not None:
        branches = branches.filter(pk__in=branch_ids)
    rows = [_row(b, start, end) for b in branches]
    rows.sort(key=lambda r: Decimal(r["sales_total"]), reverse=True)
    return {"date_from": str(start), "date_to": str(end), "rows": rows}


def comparison_rows_for_export(payload: dict) -> list[list]:
    header = ["Filial", "Savdo", "Sotuvlar", "Yalpi foyda", "Xarajat", "Sof foyda",
              "Qarzdorlik", "Kassa", "Markazdan tovar", "Markazga tovar",
              "Markazga pul", "Hisob-kitob qoldig'i"]
    body = [
        [r["name"], float(r["sales_total"]), r["sales_count"], float(r["gross_profit"]),
         float(r["expenses"]), float(r["net_profit"]), float(r["outstanding_debt"]),
         float(r["cash_balance"]), float(r["settlement"]["goods_from_center"]),
         float(r["settlement"]["goods_to_center"]), float(r["settlement"]["cash_to_center"]),
         float(r["settlement"]["balance"])]
        for r in payload["rows"]
    ]
    return [header, *body]
