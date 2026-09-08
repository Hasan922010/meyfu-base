"""Sotuv — service layer (CLAUDE.md 5, 7, 4.4).

Biznes qoidalari:
  7.1  narx < min_price → rad (yoki can_sell_below_price bo'lsa flag)
  7.2  VanStock yetarliligi
  7.3  qarz limiti (online — rad/override; offline — flag bilan qabul)
  7.4  bloklangan mijoz → faqat naqd
  7.8  transaction.atomic() + select_for_update(), manfiy qoldiq yo'q
  7.9  client_uuid idempotent
  7.10 har SaleItem'da cost_price snapshot
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.clients.models import Client
from apps.core.exceptions import BusinessError, InsufficientStock
from apps.core.models import AuditLog, DocumentSequence
from apps.wallet.constants import TransactionType
from apps.wallet.services import reverse_reference, wallet_apply
from apps.warehouse.models import VanStock
from apps.warehouse.services.van import van_apply
from realtime.broadcast import broadcast

from ..constants import PaymentType, SaleStatus
from ..models import Debt, Sale, SaleItem

_CASH_PAYMENTS = {PaymentType.CASH, PaymentType.MIXED}

logger = logging.getLogger("apps.sales")

SALE_PREFIX = "SOT"
_ZERO = Decimal("0")
_CREDIT_TYPES = {PaymentType.DEBT, PaymentType.MIXED}


@dataclass
class SaleLine:
    product: object
    quantity: Decimal
    price: Decimal
    discount_percent: Decimal = _ZERO


@dataclass
class SaleResult:
    sale: Sale
    created: bool = True
    duplicate: bool = False
    flags: list[str] = field(default_factory=list)


def _next_number(date) -> str:
    return DocumentSequence.next_number(SALE_PREFIX, year=date.year)


def _off_route(distributor, client) -> bool:
    """Tarqatuvchi shu mijozga sotish/undirish huquqiga ega emasmi?

    Faqat DISTRIBUTOR roli cheklanadi. Mijoz marshrutga biriktirilmagan bo'lsa
    (`route` = None) — aniqlab bo'lmaydi, ruxsat beriladi.
    """
    from apps.users.constants import Role

    if getattr(distributor, "role", None) != Role.DISTRIBUTOR:
        return False
    if getattr(distributor, "is_superuser", False):
        return False
    route_owner_id = (
        client.route.distributor_id if getattr(client, "route_id", None) else None
    )
    return route_owner_id is not None and route_owner_id != distributor.id


@transaction.atomic
def create_sale(
    *,
    distributor,
    client,
    payment_type: str,
    lines: list[SaleLine],
    date=None,
    paid_amount: Decimal | None = None,
    due_date=None,
    discount_amount: Decimal = _ZERO,
    latitude=None,
    longitude=None,
    note: str = "",
    client_uuid: str | None = None,
    device_time=None,
    strict: bool = True,
    debt_override: bool = False,
    order=None,
) -> SaleResult:
    date = date or timezone.localdate()

    # 7.9 — idempotentlik
    if client_uuid:
        existing = Sale.objects.filter(client_uuid=client_uuid).first()
        if existing:
            return SaleResult(sale=existing, created=False, duplicate=True)

    if not lines:
        raise BusinessError(message="Sotuvda kamida bitta qator bo'lishi kerak.",
                            code="EMPTY_SALE")

    flags: list[str] = []
    profile = getattr(distributor, "distributor_profile", None)
    can_below = bool(profile and profile.can_sell_below_price)

    # Marshrut egaligini tekshirish — tarqatuvchi faqat o'z marshrutidagi
    # mijozga sotadi (marshrutsiz mijoz — ruxsat, aniqlab bo'lmaydi).
    if _off_route(distributor, client):
        if strict:
            raise BusinessError(
                message=f"«{client.name}» sizning marshrutingizda emas.",
                code="CLIENT_NOT_ON_ROUTE",
                details={"client_id": str(client.id)},
            )
        flags.append("CLIENT_NOT_ON_ROUTE")

    # 7.4 — bloklangan mijoz faqat naqd
    if client.is_blocked and payment_type != PaymentType.CASH:
        if strict:
            raise BusinessError(
                message=f"«{client.name}» bloklangan — faqat naqd sotuv mumkin.",
                code="CLIENT_BLOCKED",
            )
        flags.append("CLIENT_BLOCKED")

    # --- qatorlarni tayyorlash ---
    prepared: list[tuple[SaleLine, Decimal, bool]] = []
    for line in lines:
        product = line.product
        below_min = line.price < product.min_price and product.min_price > _ZERO
        if below_min:
            if strict and not can_below:
                raise BusinessError(
                    message=(
                        f"«{product.name}» narxi {line.price} — minimal narx "
                        f"{product.min_price} dan past."
                    ),
                    code="PRICE_BELOW_MINIMUM",
                    details={"product_id": str(product.id),
                             "min_price": str(product.min_price)},
                )
            flags.append("PRICE_BELOW_MINIMUM")
        prepared.append((line, product.cost_price, below_min))

    # 7.2 — VanStock yetarliligi (select_for_update)
    van_rows = {
        vs.product_id: vs
        for vs in VanStock.objects.select_for_update().filter(
            distributor=distributor,
            product__in=[ln.product for ln in lines],
        )
    }
    for line in lines:
        have = van_rows.get(line.product.id)
        have_qty = have.quantity if have else _ZERO
        if have_qty < line.quantity:
            if strict:
                raise InsufficientStock(
                    message=(
                        f"Mashinada «{line.product.name}» faqat {have_qty} "
                        f"{line.product.unit.short_name} bor"
                    ),
                    details={"product_id": str(line.product.id),
                             "available": str(have_qty),
                             "requested": str(line.quantity)},
                )
            flags.append("INSUFFICIENT_VAN_STOCK")

    conflict = "INSUFFICIENT_VAN_STOCK" in flags

    # --- Sale yozuvi ---
    sale = Sale(
        number=_next_number(date),
        date=date,
        distributor=distributor,
        client=client,
        order=order,
        payment_type=payment_type,
        discount_amount=discount_amount,
        due_date=due_date,
        latitude=latitude,
        longitude=longitude,
        note=note,
        client_uuid=client_uuid or None,
        is_synced=True,
        device_time=device_time,
        created_by=distributor,
        status=SaleStatus.CONFLICT if conflict else SaleStatus.COMPLETED,
    )
    sale.save()

    items: list[SaleItem] = []
    for (line, cost, below_min) in prepared:
        item = SaleItem(
            sale=sale, product=line.product, quantity=line.quantity,
            price=line.price, cost_price=cost,
            discount_percent=line.discount_percent, below_min_price=below_min,
            created_by=distributor,
        )
        item.compute()
        items.append(item)
    SaleItem.objects.bulk_create(items)

    sale.recalc()

    # to'lov / qarz taqsimoti
    total = sale.total_amount
    if payment_type == PaymentType.DEBT:
        sale.paid_amount = _ZERO
    elif payment_type == PaymentType.MIXED:
        sale.paid_amount = min(paid_amount or _ZERO, total)
    else:
        sale.paid_amount = total
    sale.debt_amount = max(_ZERO, total - sale.paid_amount)

    # 7.3 — qarz limiti
    if sale.debt_amount > _ZERO:
        projected = client.current_debt + sale.debt_amount
        if projected > client.debt_limit and client.debt_limit >= _ZERO:
            if strict and not debt_override:
                raise BusinessError(
                    message=(
                        f"«{client.name}» qarz limiti oshib ketadi "
                        f"({projected} > {client.debt_limit})."
                    ),
                    code="DEBT_LIMIT_EXCEEDED",
                    details={"current": str(client.current_debt),
                             "limit": str(client.debt_limit),
                             "requested": str(sale.debt_amount)},
                )
            flags.append("DEBT_LIMIT_EXCEEDED")

    if flags and not conflict:
        sale.status = SaleStatus.FLAGGED
    sale.flagged = bool(flags)
    sale.flag_reason = ", ".join(sorted(set(flags)))
    sale.save(update_fields=[
        "total_amount", "paid_amount", "debt_amount", "status",
        "flagged", "flag_reason", "updated_at",
    ])

    if not conflict:
        _apply_stock_and_debt(sale, lines, distributor, client)

    broadcast("admin_dashboard", "sale.created", {
        "sale_id": str(sale.id), "number": sale.number,
        "client": client.name, "distributor": distributor.full_name,
        "total": str(sale.total_amount), "status": sale.status,
    })
    if sale.flagged or conflict:
        _notify_flagged(sale)

    return SaleResult(sale=sale, created=True, flags=sorted(set(flags)))


def _apply_stock_and_debt(sale: Sale, lines: list[SaleLine], distributor, client) -> None:
    for line in lines:
        van_apply(distributor=distributor, product=line.product,
                  quantity=-line.quantity)

    if sale.debt_amount > _ZERO:
        debt = Debt.objects.create(
            client=client, sale=sale, amount=sale.debt_amount,
            due_date=sale.due_date, created_by=distributor,
        )
        debt.recalc()
        debt.save(update_fields=["remaining", "status", "updated_at"])

        Client.objects.filter(pk=client.pk).update(
            current_debt=F("current_debt") + sale.debt_amount
        )

    # Jonli hamyon (CLAUDE.md 4.4) — faqat naqd tushum
    if sale.payment_type in _CASH_PAYMENTS and sale.paid_amount > _ZERO:
        wallet_apply(
            distributor=distributor,
            transaction_type=TransactionType.SALE_CASH,
            amount=sale.paid_amount,
            date=sale.date,
            reference_type="sale",
            reference_id=sale.id,
            note=f"Sotuv {sale.number}",
            user=distributor,
        )


@transaction.atomic
def cancel_sale(sale: Sale, user=None, reason: str = "") -> Sale:
    """Sotuvni bekor qiladi: mashina qoldig'ini va qarzni qaytaradi."""
    sale = Sale.objects.select_for_update().get(pk=sale.pk)
    if sale.status == SaleStatus.CANCELLED:
        raise BusinessError(message="Sotuv allaqachon bekor qilingan.",
                            code="ALREADY_CANCELLED")

    if sale.status in (SaleStatus.COMPLETED, SaleStatus.FLAGGED):
        for item in sale.items.select_related("product"):
            van_apply(distributor=sale.distributor, product=item.product,
                      quantity=item.quantity)
        debt = getattr(sale, "debt", None)
        if debt is not None:
            if debt.paid_amount > _ZERO:
                raise BusinessError(
                    message="Qarzga to'lov qilingan — avval to'lovni bekor qiling.",
                    code="DEBT_HAS_PAYMENTS",
                )
            Client.objects.filter(pk=sale.client_id).update(
                current_debt=F("current_debt") - debt.remaining
            )
            debt.delete()

        # hamyondagi naqd tushumni teskari yozuv bilan qaytaramiz
        reverse_reference(
            distributor=sale.distributor, reference_type="sale",
            reference_id=sale.id, user=user, note=f"Sotuv {sale.number} bekor qilindi",
        )

    sale.status = SaleStatus.CANCELLED
    sale.cancelled_at = timezone.now()
    sale.save(update_fields=["status", "cancelled_at", "updated_at"])
    AuditLog.objects.create(
        user=user, action="sale.cancelled", model_name="Sale",
        object_id=str(sale.id), changes={"reason": reason, "number": sale.number},
    )
    return sale


@transaction.atomic
def resolve_conflict(sale: Sale, *, accept: bool, user=None) -> Sale:
    """CONFLICT holatidagi sotuvni admin hal qiladi (CLAUDE.md 4.4)."""
    sale = Sale.objects.select_for_update().get(pk=sale.pk)
    if sale.status != SaleStatus.CONFLICT:
        raise BusinessError(message="Bu sotuv ziddiyatli emas.", code="NOT_CONFLICT")

    if not accept:
        sale.status = SaleStatus.CANCELLED
        sale.cancelled_at = timezone.now()
        sale.save(update_fields=["status", "cancelled_at", "updated_at"])
        return sale

    lines = [
        SaleLine(product=i.product, quantity=i.quantity, price=i.price)
        for i in sale.items.select_related("product")
    ]
    for line in lines:
        # Ziddiyatni qabul qilish — qoldiq manfiy bo'lishiga yo'l qo'yamiz emas,
        # avval ADJUSTMENT bilan mashinaga tovar kiritish kerak. Shu sababli
        # bu yerda faqat mavjud bo'lsa yechamiz.
        van_apply(distributor=sale.distributor, product=line.product,
                  quantity=-line.quantity)
    sale.status = SaleStatus.FLAGGED if sale.flag_reason else SaleStatus.COMPLETED
    sale.save(update_fields=["status", "updated_at"])
    _apply_debt_only(sale)
    return sale


def _apply_debt_only(sale: Sale) -> None:
    if sale.payment_type in _CASH_PAYMENTS and sale.paid_amount > _ZERO:
        wallet_apply(
            distributor=sale.distributor,
            transaction_type=TransactionType.SALE_CASH,
            amount=sale.paid_amount, date=sale.date,
            reference_type="sale", reference_id=sale.id,
            note=f"Sotuv {sale.number} (ziddiyat hal qilindi)",
            user=sale.distributor,
        )
    if sale.debt_amount > _ZERO and not hasattr(sale, "debt"):
        debt = Debt.objects.create(
            client=sale.client, sale=sale, amount=sale.debt_amount,
            due_date=sale.due_date, created_by=sale.distributor,
        )
        debt.recalc()
        debt.save(update_fields=["remaining", "status", "updated_at"])
        Client.objects.filter(pk=sale.client_id).update(
            current_debt=F("current_debt") + sale.debt_amount
        )


def _notify_flagged(sale: Sale) -> None:
    AuditLog.objects.create(
        user=sale.distributor,
        action="sale.flagged" if sale.flagged else "sale.conflict",
        model_name="Sale",
        object_id=str(sale.id),
        changes={"reason": sale.flag_reason, "status": sale.status,
                 "number": sale.number},
    )
    broadcast(
        "admin_dashboard",
        "sale.flagged",
        {"sale_id": str(sale.id), "number": sale.number,
         "reason": sale.flag_reason, "status": sale.status},
    )
    from apps.notifications.services import notify_admins

    notify_admins(
        type="sale.flagged",
        title="Belgilangan sotuv" if sale.flagged else "Ziddiyatli sotuv",
        body=(f"{sale.number} · {sale.client.name} · {sale.distributor.full_name} "
              f"· {sale.flag_reason or sale.status}"),
        data={"sale_id": str(sale.id)},
    )
