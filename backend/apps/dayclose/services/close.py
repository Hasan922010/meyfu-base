"""Kun yopish — submit va confirm (CLAUDE.md 1, 5, 7.7)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog, DocumentSequence
from apps.wallet.constants import TransactionType
from apps.wallet.services import get_or_create_wallet, wallet_apply
from apps.warehouse.constants import LoadingStatus, MovementType
from apps.warehouse.models import Loading, VanStock, Warehouse
from apps.warehouse.services.stock import apply_movement

from ..constants import DayCloseStatus, ItemCondition
from ..models import CashHandover, DailyReturn, DailyReturnItem, DayClose
from .snapshot import build_snapshot

_ZERO = Decimal("0")
RETURN_PREFIX = "QQ"


@dataclass
class ReturnRow:
    product: object
    quantity: Decimal
    condition: str = ItemCondition.GOOD


@transaction.atomic
def submit_day_close(
    *,
    distributor,
    date,
    warehouse: Warehouse,
    return_rows: list[ReturnRow],
    cash_handed: Decimal,
    note: str = "",
) -> DayClose:
    if DayClose.objects.filter(distributor=distributor, date=date).exists():
        raise BusinessError(
            message="Bu kun allaqachon yopilgan yoki tasdiq kutmoqda.",
            code="ALREADY_SUBMITTED",
        )

    day_close = DayClose(
        date=date, distributor=distributor, status=DayCloseStatus.PENDING,
        note=note, created_by=distributor,
    )
    day_close.save()

    # DailyReturn
    dr = DailyReturn.objects.create(
        number=DocumentSequence.next_number(RETURN_PREFIX, year=date.year),
        date=date, distributor=distributor, warehouse=warehouse,
        day_close=day_close, created_by=distributor,
    )
    total = _ZERO
    items = []
    for row in return_rows:
        price = row.product.wholesale_price
        amount = row.quantity * price
        total += amount
        items.append(DailyReturnItem(
            daily_return=dr, product=row.product, quantity=row.quantity,
            condition=row.condition, price=price, amount=amount,
            created_by=distributor,
        ))
    DailyReturnItem.objects.bulk_create(items)
    dr.total_amount = total
    dr.save(update_fields=["total_amount", "updated_at"])

    # CashHandover
    if cash_handed and cash_handed > _ZERO:
        CashHandover.objects.create(
            date=date, distributor=distributor, day_close=day_close,
            amount=cash_handed, created_by=distributor,
        )

    _fill_snapshot(day_close, distributor, date, return_rows, cash_handed)

    from apps.notifications.services import notify_admins
    from realtime.broadcast import broadcast

    broadcast("admin_dashboard", "dayclose.submitted", {
        "day_close_id": str(day_close.id),
        "distributor": distributor.full_name,
        "date": str(date),
        "cash_difference": str(day_close.cash_difference),
        "stock_difference_qty": str(day_close.stock_difference_qty),
    })
    if day_close.has_difference:
        broadcast("admin_dashboard", "cash.difference", {
            "day_close_id": str(day_close.id),
            "distributor": distributor.full_name,
            "cash_difference": str(day_close.cash_difference),
        })
        notify_admins(
            type="cash.difference",
            title="Kun yopishda farq bor",
            body=(f"{distributor.full_name} · {date} · kassa farqi "
                  f"{day_close.cash_difference} · tovar farqi "
                  f"{day_close.stock_difference_qty}"),
            data={"day_close_id": str(day_close.id)},
        )
    else:
        notify_admins(
            type="dayclose.submitted",
            title="Kun yopish yuborildi",
            body=f"{distributor.full_name} · {date} — tasdiqlash kutilmoqda",
            data={"day_close_id": str(day_close.id)},
        )
    return day_close


def _fill_snapshot(day_close, distributor, date, return_rows, cash_handed) -> None:
    snap = build_snapshot(
        distributor, date,
        daily_return_items=[
            {"product": r.product, "quantity": r.quantity} for r in return_rows
        ],
    )
    day_close.loaded_amount = snap.loaded_amount
    day_close.sold_amount = snap.sold_amount
    day_close.returned_amount = snap.returned_amount
    day_close.stock_difference_qty = snap.stock_difference_qty
    day_close.stock_difference_amount = snap.stock_difference_amount
    day_close.cash_sales_amount = snap.cash_sales_amount
    day_close.debt_collected_amount = snap.debt_collected_amount
    day_close.expense_amount = snap.expense_amount
    day_close.expense_approved_amount = snap.expense_approved_amount
    day_close.cash_expected = snap.cash_expected
    day_close.wallet_balance_end = snap.wallet_balance_end
    day_close.cash_handed_amount = cash_handed or _ZERO
    day_close.cash_difference = (cash_handed or _ZERO) - snap.cash_expected
    day_close.debt_given_amount = snap.debt_given_amount
    day_close.sales_count = snap.sales_count
    day_close.visits_count = snap.visits_count
    day_close.new_clients_count = snap.new_clients_count
    day_close.save()


@transaction.atomic
def confirm_day_close(day_close: DayClose, user=None) -> DayClose:
    day_close = DayClose.objects.select_for_update().get(pk=day_close.pk)
    if day_close.status == DayCloseStatus.CLOSED:
        raise BusinessError(message="Kun allaqachon yopilgan.", code="ALREADY_CLOSED")

    for dr in day_close.daily_returns.all():
        for item in dr.items.select_related("product"):
            _settle_van(day_close.distributor, item.product, item.quantity)
            apply_movement(
                warehouse=dr.warehouse, product=item.product,
                quantity=item.quantity, movement_type=MovementType.IN_RETURN,
                user=user, reference_type="daily_return", reference_id=dr.pk,
                from_location=f"Mashina: {day_close.distributor.full_name}",
                to_location=dr.warehouse.name,
            )
            if item.condition != ItemCondition.GOOD:
                apply_movement(
                    warehouse=dr.warehouse, product=item.product,
                    quantity=-item.quantity, movement_type=MovementType.WRITE_OFF,
                    user=user, reference_type="daily_return", reference_id=dr.pk,
                    note=f"Holati: {item.get_condition_display()}",
                )

    # kun xarajatlarini shu kun yopishga bog'laymiz
    from apps.expenses.models import DistributorExpense

    DistributorExpense.objects.filter(
        distributor=day_close.distributor, date=day_close.date, day_close__isnull=True
    ).update(day_close=day_close)

    # topshirishlarni tasdiqlash: hamyondan chiqim (HANDOVER) + kassaga kirim
    from apps.finance.constants import CashTxType
    from apps.finance.services import cash_apply

    for handover in day_close.cash_handovers.filter(confirmed=False):
        if handover.amount > _ZERO:
            wallet_apply(
                distributor=day_close.distributor,
                transaction_type=TransactionType.HANDOVER,
                amount=-handover.amount,
                date=day_close.date,
                reference_type="cash_handover",
                reference_id=handover.id,
                note=f"Kassaga topshirildi {day_close.date}",
                user=user,
            )
            cash_apply(
                transaction_type=CashTxType.HANDOVER_IN,
                amount=handover.amount,
                date=day_close.date,
                counterparty=day_close.distributor.full_name,
                reference_type="cash_handover",
                reference_id=handover.id,
                note=f"Kun yopish {day_close.date}",
                user=user,
            )
        handover.confirmed = True
        handover.received_by = user
        handover.save(update_fields=["confirmed", "received_by", "updated_at"])

    # o'sha kunning yuklamalarini yopish
    Loading.objects.filter(
        distributor=day_close.distributor, date=day_close.date,
        status=LoadingStatus.CONFIRMED,
    ).update(status=LoadingStatus.CLOSED)

    day_close.wallet_balance_end = get_or_create_wallet(day_close.distributor).balance
    day_close.status = DayCloseStatus.CLOSED
    day_close.closed_by = user
    day_close.closed_at = timezone.now()
    day_close.save(update_fields=["status", "closed_by", "closed_at",
                                  "wallet_balance_end", "updated_at"])

    AuditLog.objects.create(
        user=user, action="dayclose.confirmed", model_name="DayClose",
        object_id=str(day_close.id),
        changes={
            "date": str(day_close.date),
            "cash_difference": str(day_close.cash_difference),
            "stock_difference_qty": str(day_close.stock_difference_qty),
        },
    )
    return day_close


def _settle_van(distributor, product, quantity: Decimal) -> None:
    """Mashina qoldig'ini kamaytiradi (0 dan pastga tushmaydi)."""
    vs = (
        VanStock.objects.select_for_update()
        .filter(distributor=distributor, product=product)
        .first()
    )
    if vs is None:
        return
    vs.quantity = max(_ZERO, vs.quantity - quantity)
    vs.save(update_fields=["quantity", "updated_at"])
