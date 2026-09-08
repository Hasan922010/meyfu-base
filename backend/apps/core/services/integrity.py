"""Butunlik tekshiruvi — balans = jurnal yig'indisi (CLAUDE.md 5.2, 15).

`DistributorWallet.balance`, `Stock.quantity`, `VanStock.quantity`,
`CashAccount.balance` — denormalized (tezlik uchun). Haqiqat manbai — jurnal.
Bu modul denormalized qiymatni jurnal yig'indisi bilan solishtiradi va
farqlarni qaytaradi. Tuzatish (`apply_integrity_fix`) denormalized qiymatni
jurnalga moslaydi — jurnalning o'zi hech qachon o'zgartirilmaydi.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

_ZERO = Decimal("0")
_CENT = Decimal("0.01")
_MILLI = Decimal("0.001")


def _q(value: Decimal, step: Decimal) -> str:
    return str((value or _ZERO).quantize(step))


def _wallet_mismatches() -> list[dict]:
    from apps.wallet.models import DistributorWallet

    out: list[dict] = []
    for w in DistributorWallet.objects.select_related("distributor"):
        ledger = w.transactions.aggregate(s=Sum("amount"))["s"] or _ZERO
        if w.balance != ledger:
            out.append({
                "kind": "wallet",
                "id": str(w.id),
                "label": f"Hamyon · {w.distributor.full_name}",
                "stored": _q(w.balance, _CENT),
                "ledger": _q(ledger, _CENT),
                "diff": _q(w.balance - ledger, _CENT),
            })
    return out


def _stock_mismatches() -> list[dict]:
    from apps.warehouse.models import Stock, StockMovement

    out: list[dict] = []
    for s in Stock.objects.select_related("warehouse", "product"):
        ledger = StockMovement.objects.filter(
            warehouse_id=s.warehouse_id, product_id=s.product_id
        ).aggregate(x=Sum("quantity"))["x"] or _ZERO
        if s.quantity != ledger:
            out.append({
                "kind": "stock",
                "id": str(s.id),
                "label": f"Ombor qoldig'i · {s.product.sku} @ {s.warehouse.name}",
                "stored": _q(s.quantity, _MILLI),
                "ledger": _q(ledger, _MILLI),
                "diff": _q(s.quantity - ledger, _MILLI),
            })
    return out


def _van_mismatches() -> list[dict]:
    from apps.warehouse.models import VanStock
    from apps.warehouse.services import van_expected_quantity

    out: list[dict] = []
    for vs in VanStock.objects.select_related("distributor", "product"):
        expected = van_expected_quantity(vs.distributor, vs.product)
        if vs.quantity != expected:
            out.append({
                "kind": "van_stock",
                "id": str(vs.id),
                "label": (
                    f"Mashina qoldig'i · {vs.product.sku} @ "
                    f"{vs.distributor.full_name}"
                ),
                "stored": _q(vs.quantity, _MILLI),
                "ledger": _q(expected, _MILLI),
                "diff": _q(vs.quantity - expected, _MILLI),
            })
    return out


def _cash_mismatches() -> list[dict]:
    from apps.finance.services import get_account

    account = get_account()
    ledger = account.transactions.aggregate(s=Sum("amount"))["s"] or _ZERO
    if account.balance == ledger:
        return []
    return [{
        "kind": "cash_account",
        "id": str(account.id),
        "label": f"Kassa · {account.name}",
        "stored": _q(account.balance, _CENT),
        "ledger": _q(ledger, _CENT),
        "diff": _q(account.balance - ledger, _CENT),
    }]


def _order_mismatches() -> list[dict]:
    """Order.total_amount == SUM(items.amount) (v4 T1, CLAUDE.md 5.2)."""
    from apps.orders.models import Order

    out: list[dict] = []
    qs = Order.objects.annotate(items_sum=Sum("items__amount"))
    for o in qs:
        ledger = o.items_sum or _ZERO
        if o.total_amount != ledger:
            out.append({
                "kind": "order_total",
                "id": str(o.id),
                "label": f"Buyurtma · {o.number}",
                "stored": _q(o.total_amount, _CENT),
                "ledger": _q(ledger, _CENT),
                "diff": _q(o.total_amount - ledger, _CENT),
            })
    return out


def run_integrity_check() -> dict:
    """Barcha denormalized balanslarni jurnal bilan solishtiradi.

    Hech narsani o'zgartirmaydi. Natija: ``{ok, checked_at, counts,
    mismatch_count, mismatches}``.
    """
    from apps.orders.models import Order
    from apps.wallet.models import DistributorWallet
    from apps.warehouse.models import Stock, VanStock

    mismatches = (
        _wallet_mismatches()
        + _stock_mismatches()
        + _van_mismatches()
        + _cash_mismatches()
        + _order_mismatches()
    )
    return {
        "ok": not mismatches,
        "checked_at": timezone.now().isoformat(),
        "counts": {
            "wallets": DistributorWallet.objects.count(),
            "stocks": Stock.objects.count(),
            "van_stocks": VanStock.objects.count(),
            "cash_accounts": 1,
            "orders": Order.objects.count(),
        },
        "mismatch_count": len(mismatches),
        "mismatches": mismatches,
    }


@transaction.atomic
def apply_integrity_fix(mismatch: dict) -> None:
    """Bitta farqni tuzatadi — denormalized qiymatni jurnal yig'indisiga moslaydi.

    Jurnal (append-only) tegilmaydi. `mismatch` — `run_integrity_check`
    qaytargan lug'atlardan biri.
    """
    kind = mismatch["kind"]
    target = Decimal(mismatch["ledger"])

    if kind == "wallet":
        from apps.wallet.models import DistributorWallet

        DistributorWallet.objects.filter(id=mismatch["id"]).update(balance=target)
    elif kind == "stock":
        from apps.warehouse.models import Stock

        Stock.objects.filter(id=mismatch["id"]).update(quantity=target)
    elif kind == "van_stock":
        from apps.warehouse.models import VanStock

        VanStock.objects.filter(id=mismatch["id"]).update(quantity=target)
    elif kind == "cash_account":
        from apps.finance.models import CashAccount

        CashAccount.objects.filter(id=mismatch["id"]).update(balance=target)
    elif kind == "order_total":
        from apps.orders.models import Order

        Order.objects.filter(id=mismatch["id"]).update(total_amount=target)
    else:  # pragma: no cover
        raise ValueError(f"Noma'lum tur: {kind}")
