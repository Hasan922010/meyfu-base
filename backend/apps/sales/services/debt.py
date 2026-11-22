"""Qarz undirish — service layer (CLAUDE.md 6, 4.2 offline)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.clients.models import Client
from apps.core.business_day import business_date
from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog
from apps.core.services.opening import audit_bulk, bulk_result, plan_deltas, sheet_row
from apps.wallet.constants import TransactionType
from apps.wallet.services import reverse_reference, wallet_apply

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

    if hasattr(collected_by, "has_app_permission") and not collected_by.has_app_permission("can_collect_debts"):
        raise BusinessError(
            message="Sizda qarz / pul undirish huquqi yo'q.",
            code="DEBT_COLLECTION_FORBIDDEN",
            status_code=403,
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
def collect_client_debt_payment(
    *,
    client: Client,
    amount: Decimal,
    collected_by,
    payment_type: str = PaymentType.CASH,
    date=None,
    client_uuid: str | None = None,
    device_time=None,
    note: str = "",
    strict: bool = True,
) -> DebtPaymentResult:
    """Mijozning barcha ochiq qarzlariga FIFO tartibida to'lov taqsimlaydi."""
    if client_uuid:
        existing = DebtPayment.objects.filter(client_uuid=client_uuid).first()
        if existing:
            return DebtPaymentResult(payment=existing, created=False, duplicate=True)

    open_debts = list(
        Debt.objects.select_for_update()
        .filter(client=client, remaining__gt=_ZERO)
        .order_by(F("due_date").asc(nulls_last=True), "created_at", "pk")
    )
    total_remaining = sum((d.remaining for d in open_debts), _ZERO)
    if total_remaining <= _ZERO:
        raise BusinessError(
            message="Ushbu mijozda ochiq qarz topilmadi.",
            code="DEBT_ALREADY_PAID",
        )
    if amount <= _ZERO:
        raise BusinessError(
            message="To'lov summasi musbat bo'lishi kerak.",
            code="INVALID_AMOUNT",
        )
    if amount > total_remaining:
        if strict:
            raise BusinessError(
                message=(
                    f"To'lov ({amount}) mijozning jami qarz qoldig'idan "
                    f"({total_remaining}) katta."
                ),
                code="OVERPAYMENT",
                details={"remaining": str(total_remaining)},
            )
        note = (
            f"{note} · offline: qoldiqqa moslashtirildi ({amount}→{total_remaining})"
        ).strip(" ·")
        amount = total_remaining

    left = amount
    first_result: DebtPaymentResult | None = None
    for idx, debt in enumerate(open_debts):
        if left <= _ZERO:
            break
        part = min(left, debt.remaining)
        res = collect_debt_payment(
            debt=debt,
            amount=part,
            collected_by=collected_by,
            payment_type=payment_type,
            date=date,
            client_uuid=client_uuid if idx == 0 else None,
            device_time=device_time,
            note=note,
            strict=strict,
        )
        if first_result is None:
            first_result = res
        left -= part
    assert first_result is not None
    return first_result


@transaction.atomic
def recalc_debt_and_client(debt: Debt) -> None:
    """Qarz va mijozning joriy qarzini faol DebtPayment/Debt yozuvlaridan qayta hisoblaydi."""
    from django.db.models import Sum

    paid = (
        DebtPayment.objects.filter(debt=debt, is_deleted=False).aggregate(s=Sum("amount"))["s"]
        or _ZERO
    )
    debt.paid_amount = paid
    debt.recalc()
    debt.save(update_fields=["paid_amount", "remaining", "status", "updated_at"])

    total_remaining = (
        Debt.objects.filter(client_id=debt.client_id, is_deleted=False).aggregate(
            s=Sum("remaining")
        )["s"]
        or _ZERO
    )
    Client.objects.filter(pk=debt.client_id).update(current_debt=total_remaining)


@transaction.atomic
def cancel_debt_payment(payment: DebtPayment, *, user, reason: str = "") -> DebtPayment:
    """SuperAdmin uchun 24 soat ichida qarz to'lovini bekor qilish va qarzni tiklash."""
    from apps.users.constants import Role

    if not (
        getattr(user, "is_superuser", False)
        or getattr(user, "role", None) == Role.SUPER_ADMIN
    ):
        raise BusinessError(
            message="Qarz to'lovini faqat SuperAdmin bekor qila oladi.",
            code="CANCEL_FORBIDDEN",
            status_code=403,
        )

    payment = (
        DebtPayment.all_objects.select_for_update()
        .select_related("debt", "debt__client", "collected_by")
        .get(pk=payment.pk)
    )
    if payment.is_deleted:
        raise BusinessError(
            message="Bu to'lov allaqachon bekor qilingan.",
            code="ALREADY_CANCELLED",
        )
    if timezone.now() - payment.created_at > timedelta(hours=24):
        raise BusinessError(
            message="To'lovni faqat 24 soat ichida bekor qilish mumkin.",
            code="CANCEL_WINDOW_EXPIRED",
        )

    debt = Debt.objects.select_for_update().get(pk=payment.debt_id)
    Client.objects.select_for_update().get(pk=debt.client_id)

    if payment.payment_type == PaymentType.CASH:
        reverse_reference(
            distributor=payment.collected_by,
            reference_type="debt_payment",
            reference_id=str(payment.id),
            user=user,
            note=(
                f"Qarz to'lovi bekor qilindi ({debt.client.name}): {reason}"
                if reason
                else f"Qarz to'lovi bekor qilindi ({debt.client.name})"
            ),
        )

    payment.is_deleted = True
    payment.save(update_fields=["is_deleted", "updated_at"])
    recalc_debt_and_client(debt)

    AuditLog.objects.create(
        user=user,
        action="debt_payment.cancelled",
        model_name="DebtPayment",
        object_id=str(payment.id),
        changes={
            "amount": str(payment.amount),
            "client": str(debt.client_id),
            "debt": str(debt.id),
            "reason": reason,
        },
    )
    return payment


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
        for c in _opening_clients(branch).order_by("name", "phone", "pk")
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
