"""Qarz undirish — service layer (CLAUDE.md 6, 4.2 offline)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import ValidationError

from apps.clients.models import Client
from apps.core.business_day import business_date
from apps.core.exceptions import BusinessError
from apps.core.services.opening import audit_bulk, bulk_result, plan_deltas, sheet_row
from apps.wallet.constants import TransactionType
from apps.wallet.services import wallet_apply

from ..constants import DEBT_PAYMENT_TYPES, PaymentType
from ..models import Debt, DebtPayment
from .sale import _off_route, ensure_client_in_scope

_ZERO = Decimal("0")


@dataclass
class DebtPaymentResult:
    payment: DebtPayment
    created: bool = True
    duplicate: bool = False


@transaction.atomic
def collect_debt_payment(
    *,
    debt: Debt,
    amount: Decimal,
    collected_by,
    payment_type: str = PaymentType.CASH,
    date=None,
    client_uuid: str | None = None,
    device_time=None,
    note: str = "",
    strict: bool = True,
) -> DebtPaymentResult:
    date = date or business_date()

    if client_uuid:
        existing = DebtPayment.objects.filter(client_uuid=client_uuid).first()
        if existing:
            return DebtPaymentResult(payment=existing, created=False, duplicate=True)

    from apps.dayclose.services.lock import resolve_operation_date

    date, _late = resolve_operation_date(
        collected_by, date, offline=not strict, kind="DebtPayment"
    )

    if payment_type not in DEBT_PAYMENT_TYPES:
        raise BusinessError(
            message="Qarz to'lovi naqd, plastik yoki o'tkazma bo'lishi mumkin.",
            code="INVALID_PAYMENT_TYPE",
        )

    ensure_client_in_scope(collected_by, debt.client)
    if _off_route(collected_by, debt.client):
        raise BusinessError(
            message="Bu qarz sizning marshrutingizda emas.",
            code="DEBT_NOT_ON_ROUTE",
        )

    debt = Debt.objects.select_for_update().get(pk=debt.pk)
    if amount <= _ZERO:
        raise BusinessError(message="To'lov summasi musbat bo'lishi kerak.",
                            code="INVALID_AMOUNT")
    if amount > debt.remaining:
        # Offline (strict=False): qarz boshqa qurilmada qisman/to'liq to'langan
        # bo'lishi mumkin — mavjud qoldiqqa moslashtiramiz, yo'qolgan pul bo'lmasin.
        if strict or debt.remaining <= _ZERO:
            raise BusinessError(
                message=(
                    "Bu qarz allaqachon to'langan."
                    if debt.remaining <= _ZERO
                    else f"To'lov ({amount}) qarz qoldig'idan "
                    f"({debt.remaining}) katta."
                ),
                code="DEBT_ALREADY_PAID" if debt.remaining <= _ZERO else "OVERPAYMENT",
                details={"remaining": str(debt.remaining)},
            )
        note = (f"{note} · offline: qoldiqqa moslashtirildi ({amount}→"
                f"{debt.remaining})").strip(" ·")
        amount = debt.remaining

    payment = DebtPayment.objects.create(
        debt=debt, amount=amount, payment_type=payment_type,
        collected_by=collected_by, date=date,
        client_uuid=client_uuid or None, device_time=device_time, note=note,
        created_by=collected_by,
    )

    debt.paid_amount += amount
    debt.recalc()
    debt.save(update_fields=["paid_amount", "remaining", "status", "updated_at"])

    Client.objects.filter(pk=debt.client_id).update(
        current_debt=F("current_debt") - amount
    )

    # Jonli hamyon — faqat naqd undirilgan qarz (CLAUDE.md 4.4)
    if payment_type == PaymentType.CASH:
        wallet_apply(
            distributor=collected_by,
            transaction_type=TransactionType.DEBT_COLLECTED,
            amount=amount, date=date,
            reference_type="debt_payment", reference_id=payment.id,
            note=f"Qarz undirildi: {debt.client.name}",
            user=collected_by,
        )

    return DebtPaymentResult(payment=payment, created=True)


@transaction.atomic
def create_opening_debt(
    *, client: Client, amount: Decimal, note: str = "", user=None
) -> Debt:
    """Mijozning boshlang'ich qarzi — sotuvsiz (CLAUDE.md 6 — Boshlang'ich
    qoldiqlar). `Debt.sale` shu holat uchun ataylab nullable qilingan."""
    if amount <= _ZERO:
        raise BusinessError(
            message="Boshlang'ich qarz summasi musbat bo'lishi kerak.",
            code="INVALID_AMOUNT",
        )

    debt = Debt.objects.create(
        client=client, sale=None, amount=amount, remaining=amount,
        created_by=user,
    )
    Client.objects.filter(pk=client.pk).update(
        current_debt=F("current_debt") + amount
    )

    # Debt'da `note` maydoni yo'q — CLAUDE.md 5.3 "qoldiq tuzatish" majburiy
    # yozilishi kerak bo'lgan harakatlardan, shu sabab AuditLog'ga yoziladi.
    from apps.core.models import AuditLog

    AuditLog.objects.create(
        user=user, action="debt.opening_balance", model_name="Debt",
        object_id=str(debt.id),
        changes={"client": str(client.id), "amount": str(amount), "note": note},
    )
    return debt


def _opening_clients(branch):
    qs = Client.objects.filter(is_blocked=False)
    return qs.filter(branch=branch) if branch is not None else qs


def client_opening_sheet(branch=None) -> list[dict]:
    """Boshlang'ich qarz uchun bloklanmagan mijozlar — joriy qarzi bilan.

    `branch` — faqat shu filial mijozlari (filial rahbari uchun).
    """
    return [
        sheet_row(id=c.id, name=c.name, code=c.phone, current=c.current_debt)
        for c in _opening_clients(branch).order_by("name", "pk")
    ]


@transaction.atomic
def client_opening_bulk(*, rows: list[dict], note: str, user, branch=None) -> dict:
    """Yakuniy qarz kiritiladi — faqat oshirish mumkin (qarz sotuvsiz yaratiladi).

    Kamaytirish qarz to'lovi orqali bo'ladi, aks holda qarzlar jurnali
    (Debt/DebtPayment) va `current_debt` bir-biridan ajrab qoladi.
    """
    clients = {
        c.id: c
        for c in _opening_clients(branch).select_for_update().filter(
            id__in=[row["id"] for row in rows]
        )
    }
    changes = plan_deltas(rows, {pk: c.current_debt for pk, c in clients.items()})
    lowered = [clients[pk].name for pk, delta in changes if delta < _ZERO]
    if lowered:
        names = ", ".join(lowered[:3]) + ("…" if len(lowered) > 3 else "")
        raise ValidationError({
            "rows": (
                f"Qarzni bu yerda kamaytirib bo'lmaydi ({names}) — "
                "qarz to'lovi orqali kiriting."
            )
        })
    for client_id, delta in changes:
        if delta > _ZERO:
            create_opening_debt(
                client=clients[client_id], amount=delta, note=note, user=user
            )
    audit_bulk(user=user, kind="client", note=note, changes=changes)
    return bulk_result(changes)
