"""Offline outbox → server (CLAUDE.md 4.2, 10 — /sales/bulk-sync/).

Kirish:  operations: [{type, client_uuid, payload}]
Chiqish: results:    [{client_uuid, status, server_id?, error?, data?}]

Statuslar: SENT | DUPLICATE | CONFLICT | FAILED
Har operatsiya alohida tranzaksiyada — bittasi yiqilsa boshqalari o'tadi.
"""
from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime

from apps.catalog.models import Product
from apps.clients.models import Client, ClientVisit
from apps.core.exceptions import BusinessError
from apps.expenses.models import ExpenseCategory
from apps.expenses.services import create_expense
from apps.orders.models import Order

from ..constants import SaleStatus
from ..models import Debt
from .debt import collect_debt_payment
from .sale import SaleLine, create_sale
from .sale_return import ReturnLine, create_sale_return

logger = logging.getLogger("apps.sales")

SyncOp = dict[str, Any]


def _dec(value, default="0") -> Decimal:
    try:
        return Decimal(str(value if value not in (None, "") else default))
    except (InvalidOperation, TypeError) as exc:
        raise BusinessError(
            message=f"Noto'g'ri son: {value!r}", code="BAD_NUMBER"
        ) from exc


def process_operations(operations: list[SyncOp], *, user) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for op in operations:
        client_uuid = op.get("client_uuid")
        op_type = op.get("type")
        try:
            with transaction.atomic():
                handler = _HANDLERS.get(op_type)
                if handler is None:
                    raise BusinessError(
                        message=f"Noma'lum operatsiya turi: {op_type}",
                        code="UNKNOWN_OP_TYPE",
                    )
                results.append(handler(op.get("payload") or {}, client_uuid, user))
        except BusinessError as exc:
            results.append({
                "client_uuid": client_uuid, "status": "FAILED",
                "error": {"code": exc.code, "message": str(exc.detail)},
            })
        except ObjectDoesNotExist as exc:
            results.append({
                "client_uuid": client_uuid, "status": "FAILED",
                "error": {"code": "NOT_FOUND", "message": str(exc)},
            })
        except Exception:  # noqa: BLE001
            logger.exception("bulk-sync operatsiyasi yiqildi: %s", client_uuid)
            results.append({
                "client_uuid": client_uuid, "status": "FAILED",
                "error": {"code": "INTERNAL", "message": "Ichki xatolik"},
            })
    return results


def _handle_sale(payload: dict, client_uuid: str | None, user) -> dict[str, Any]:
    client = Client.objects.get(pk=payload["client"])
    products = {
        str(p.id): p
        for p in Product.objects.select_related("unit").filter(
            id__in=[row["product"] for row in payload.get("items", [])]
        )
    }
    lines = [
        SaleLine(
            product=products[str(row["product"])],
            quantity=_dec(row["quantity"]),
            price=_dec(row["price"]),
            discount_percent=_dec(row.get("discount_percent", 0)),
        )
        for row in payload.get("items", [])
    ]
    result = create_sale(
        distributor=user,
        client=client,
        payment_type=payload["payment_type"],
        lines=lines,
        date=parse_date(payload["date"]) if payload.get("date") else None,
        paid_amount=_dec(payload["paid_amount"]) if payload.get("paid_amount") else None,
        due_date=parse_date(payload["due_date"]) if payload.get("due_date") else None,
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
        note=payload.get("note", ""),
        client_uuid=client_uuid,
        device_time=(
            parse_datetime(payload["device_time"])
            if payload.get("device_time") else None
        ),
        strict=False,
    )
    status = (
        "DUPLICATE" if result.duplicate
        else "CONFLICT" if result.sale.status == SaleStatus.CONFLICT
        else "SENT"
    )
    return {
        "client_uuid": client_uuid, "status": status,
        "server_id": str(result.sale.id), "number": result.sale.number,
        "flags": result.flags,
        "sale_status": result.sale.status,
    }


def _handle_debt_payment(payload: dict, client_uuid: str | None, user) -> dict[str, Any]:
    debt = Debt.objects.get(pk=payload["debt"])
    res = collect_debt_payment(
        debt=debt,
        amount=_dec(payload["amount"]),
        collected_by=user,
        payment_type=payload.get("payment_type", "NAQD"),
        date=parse_date(payload["date"]) if payload.get("date") else None,
        strict=False,
        client_uuid=client_uuid,
        device_time=(
            parse_datetime(payload["device_time"])
            if payload.get("device_time") else None
        ),
        note=payload.get("note", ""),
    )
    return {
        "client_uuid": client_uuid,
        "status": "DUPLICATE" if res.duplicate else "SENT",
        "server_id": str(res.payment.id),
    }


def _handle_return(payload: dict, client_uuid: str | None, user) -> dict[str, Any]:
    client = Client.objects.get(pk=payload["client"])
    products = {
        str(p.id): p
        for p in Product.objects.filter(
            id__in=[row["product"] for row in payload.get("items", [])]
        )
    }
    lines = [
        ReturnLine(
            product=products[str(row["product"])],
            quantity=_dec(row["quantity"]),
            price=_dec(row.get("price", 0)),
        )
        for row in payload.get("items", [])
    ]
    res = create_sale_return(
        distributor=user, client=client, reason=payload["reason"], lines=lines,
        restock=payload.get("restock", True),
        date=parse_date(payload["date"]) if payload.get("date") else None,
        note=payload.get("note", ""),
        client_uuid=client_uuid,
    )
    return {
        "client_uuid": client_uuid,
        "status": "DUPLICATE" if res.duplicate else "SENT",
        "server_id": str(res.sale_return.id),
    }


def _handle_visit(payload: dict, client_uuid: str | None, user) -> dict[str, Any]:
    if client_uuid and ClientVisit.objects.filter(client_uuid=client_uuid).exists():
        obj = ClientVisit.objects.get(client_uuid=client_uuid)
        return {"client_uuid": client_uuid, "status": "DUPLICATE",
                "server_id": str(obj.id)}
    client = Client.objects.get(pk=payload["client"])
    visit = ClientVisit.objects.create(
        distributor=user, client=client, result=payload["result"],
        checked_in_at=parse_datetime(payload["checked_in_at"])
        if payload.get("checked_in_at") else None,
        latitude=payload.get("latitude"), longitude=payload.get("longitude"),
        note=payload.get("note", ""), client_uuid=client_uuid or None,
        created_by=user,
    )
    if visit.checked_in_at is None:
        from django.utils import timezone

        visit.checked_in_at = timezone.now()
        visit.save(update_fields=["checked_in_at"])
    return {"client_uuid": client_uuid, "status": "SENT", "server_id": str(visit.id)}


def _handle_expense(payload: dict, client_uuid: str | None, user) -> dict[str, Any]:
    category = ExpenseCategory.objects.get(pk=payload["category"])
    res = create_expense(
        distributor=user,
        category=category,
        amount=_dec(payload["amount"]),
        payment_source=payload.get("payment_source", "CASH_ON_HAND"),
        date=parse_date(payload["date"]) if payload.get("date") else None,
        description=payload.get("description", ""),
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
        fuel=payload.get("fuel"),
        client_uuid=client_uuid,
        device_time=(
            parse_datetime(payload["device_time"])
            if payload.get("device_time") else None
        ),
    )
    return {
        "client_uuid": client_uuid,
        "status": "DUPLICATE" if res.duplicate else "SENT",
        "server_id": str(res.expense.id),
        "over_limit": res.over_limit,
    }


def _handle_order_create(payload: dict, client_uuid: str | None, user) -> dict[str, Any]:
    from apps.orders.services import OrderLine, create_order

    client = Client.objects.get(pk=payload["client"])
    products = {
        str(p.id): p
        for p in Product.objects.select_related("unit").filter(
            id__in=[row["product"] for row in payload.get("items", [])]
        )
    }
    lines = [
        OrderLine(
            product=products[str(row["product"])],
            quantity=_dec(row["quantity"]),
            price=_dec(row["price"]),
        )
        for row in payload.get("items", [])
    ]
    result = create_order(
        client=client,
        taken_by=user,
        lines=lines,
        date=parse_date(payload["date"]) if payload.get("date") else None,
        payment_intent=payload.get("payment_intent", ""),
        desired_date=(
            parse_date(payload["desired_date"]) if payload.get("desired_date") else None
        ),
        note=payload.get("note", ""),
        place=payload.get("place", True),
        client_uuid=client_uuid,
        device_time=(
            parse_datetime(payload["device_time"])
            if payload.get("device_time") else None
        ),
        user=user,
    )
    return {
        "client_uuid": client_uuid,
        "status": "DUPLICATE" if result.duplicate else "SENT",
        "server_id": str(result.order.id),
        "number": result.order.number,
    }


def _handle_order_fulfill(payload: dict, client_uuid: str | None, user) -> dict[str, Any]:
    from apps.orders.services.order import FulfillLine, fulfill_order

    order = Order.objects.get(pk=payload["order"])
    by_id = {str(it.id): it for it in order.items.all()}
    fulfill_lines = [
        FulfillLine(
            item=by_id[str(row["item"])],
            delivered_quantity=_dec(row["delivered_quantity"]),
            price=_dec(row["price"]) if row.get("price") not in (None, "") else None,
        )
        for row in payload.get("lines", [])
        if str(row["item"]) in by_id
    ]
    result = fulfill_order(
        order,
        fulfill_lines,
        distributor=user,
        payment_type=payload.get("payment_type") or None,
        paid_amount=_dec(payload["paid_amount"]) if payload.get("paid_amount") else None,
        due_date=parse_date(payload["due_date"]) if payload.get("due_date") else None,
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
        note=payload.get("note", ""),
        client_uuid=client_uuid,
        device_time=(
            parse_datetime(payload["device_time"])
            if payload.get("device_time") else None
        ),
        strict=False,
        user=user,
    )
    status = (
        "DUPLICATE" if result.duplicate
        else "CONFLICT" if result.sale.status == SaleStatus.CONFLICT
        else "SENT"
    )
    return {
        "client_uuid": client_uuid, "status": status,
        "server_id": str(result.sale.id), "number": result.sale.number,
        "flags": result.flags, "sale_status": result.sale.status,
    }


_HANDLERS = {
    "sale": _handle_sale,
    "debt_payment": _handle_debt_payment,
    "sale_return": _handle_return,
    "visit": _handle_visit,
    "expense": _handle_expense,
    "order_create": _handle_order_create,
    "order_fulfill": _handle_order_fulfill,
}
