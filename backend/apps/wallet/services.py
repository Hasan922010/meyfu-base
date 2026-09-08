"""Hamyon — service layer (CLAUDE.md 5.2, 6).

Barcha naqd pul harakati SHU YERDAN o'tadi. `amount` ishorali saqlanadi:
  balance == SUM(WalletTransaction.amount)   (butunlik sharti)
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .constants import NEGATIVE_TYPES, POSITIVE_TYPES, TransactionType
from .models import DistributorWallet, WalletTransaction

_ZERO = Decimal("0")


def get_or_create_wallet(distributor) -> DistributorWallet:
    wallet, _created = DistributorWallet.objects.get_or_create(
        distributor=distributor, defaults={"balance": _ZERO}
    )
    return wallet


@transaction.atomic
def wallet_apply(
    *,
    distributor,
    transaction_type: str,
    amount: Decimal,
    date=None,
    reference_type: str = "",
    reference_id: str = "",
    note: str = "",
    user=None,
) -> WalletTransaction:
    """Hamyon balansini `amount` ga o'zgartiradi (ishorali kiritiladi).

    Kirim turlari uchun amount > 0, chiqim turlari uchun amount < 0 bo'lishi kerak
    (CORRECTION bundan mustasno).
    """
    if amount == _ZERO:
        raise ValueError("amount 0 bo'lishi mumkin emas")
    if transaction_type in POSITIVE_TYPES and amount < _ZERO:
        raise ValueError(f"{transaction_type} uchun amount musbat bo'lishi kerak")
    if transaction_type in NEGATIVE_TYPES and amount > _ZERO:
        raise ValueError(f"{transaction_type} uchun amount manfiy bo'lishi kerak")

    wallet = DistributorWallet.objects.select_for_update().get_or_create(
        distributor=distributor, defaults={"balance": _ZERO}
    )[0]

    new_balance = wallet.balance + amount
    wallet.balance = new_balance
    wallet.save(update_fields=["balance", "updated_at"])

    tx = WalletTransaction.objects.create(
        wallet=wallet,
        date=date or timezone.localdate(),
        transaction_type=transaction_type,
        amount=amount,
        balance_after=new_balance,
        reference_type=reference_type,
        reference_id=str(reference_id),
        note=note,
        created_by=user,
    )

    from realtime.broadcast import broadcast

    broadcast(f"distributor_{distributor.id}", "wallet.updated", {
        "balance": str(new_balance),
        "transaction_type": transaction_type,
        "amount": str(amount),
    })
    return tx


@transaction.atomic
def reverse_reference(
    *, distributor, reference_type: str, reference_id: str, user=None, note: str = ""
) -> list[WalletTransaction]:
    """Berilgan havola hamyonga qo'shgan sof ta'sirni CORRECTION bilan bekor qiladi.

    O'chirilmaydi — teskari ishorali yozuv qo'shiladi (CLAUDE.md 5.1). Idempotent:
    havola bo'yicha barcha yozuvlar (avvalgi CORRECTION'lar ham) yig'indisi olinadi,
    shuning uchun ikki marta chaqirilsa ikkinchisi hech narsa qilmaydi.
    """
    wallet = get_or_create_wallet(distributor)
    net = WalletTransaction.objects.filter(
        wallet=wallet, reference_type=reference_type,
        reference_id=str(reference_id),
    ).aggregate(s=Sum("amount"))["s"] or _ZERO

    if net == _ZERO:
        return []

    return [wallet_apply(
        distributor=distributor,
        transaction_type=TransactionType.CORRECTION,
        amount=-net,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note or "Bekor qilindi",
        user=user,
    )]


def wallet_matches_ledger(distributor) -> bool:
    """CLAUDE.md 5.2: balance == SUM(transactions.amount)?"""
    wallet = get_or_create_wallet(distributor)
    total = wallet.transactions.aggregate(s=Sum("amount"))["s"] or _ZERO
    return wallet.balance == total
