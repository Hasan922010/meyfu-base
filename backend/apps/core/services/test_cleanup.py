"""Explicit superuser-only exception for archiving selected test operations.

Normal append-only APIs remain unchanged. Journals are never physically deleted:
their snapshots and the reason are audited, and source UUIDs remain reserved.
Only terminal ledger entries can be removed without rewriting real history.
"""
from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal

from django.apps import apps
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import connection, transaction
from django.db.models import Sum
from django.db.models.fields.files import FieldFile
from django.utils import timezone

ZERO = Decimal("0")
SETTING_ALLOW_TEST_CLEANUP = "system.allow_test_cleanup"

LEDGERS = {
    "finance.cashtransaction": ("finance.CashAccount", ("account_id",), "amount", "balance"),
    "wallet.wallettransaction": ("wallet.DistributorWallet", ("wallet_id",), "amount", "balance"),
    "warehouse.suppliertransaction": ("warehouse.Supplier", ("supplier_id",), "amount", "balance"),
    "warehouse.stockmovement": (
        "warehouse.Stock", ("warehouse_id", "product_id"), "quantity", "quantity",
    ),
}
SOURCES = {
    "company_expense": "finance.CompanyExpense",
    "expense": "expenses.DistributorExpense",
    "advance": "payroll.Advance",
    "sale": "sales.Sale",
    "debt_payment": "sales.DebtPayment",
    "cash_handover": "dayclose.CashHandover",
}


class CleanupBlocked(ValueError):
    pass


def is_test_cleanup_enabled() -> bool:
    """Sozlamada soxta operatsiyalarni tozalash yoqilganmi? Standart: True."""
    from apps.core.models import Setting

    val = Setting.get(SETTING_ALLOW_TEST_CLEANUP, True)
    if isinstance(val, dict):
        return bool(val.get("enabled", True))
    return bool(val)


def set_test_cleanup_enabled(enabled: bool, *, user=None) -> bool:
    """Soxta operatsiyalarni tozalash ruxsatini yoqish yoki o'chirish."""
    from apps.core.models import Setting

    obj, _ = Setting.objects.update_or_create(
        key=SETTING_ALLOW_TEST_CLEANUP,
        defaults={
            "value": bool(enabled),
            "description": "Soxta operatsiyalarni (tranzaksiyalarni) tozalashga ruxsat berish",
            **({"created_by": user} if user and getattr(user, "is_authenticated", False) else {}),
        },
    )
    return bool(obj.value)


def require_superuser(user):
    if not user or not getattr(user, "is_active", False):
        raise PermissionDenied
    is_super = bool(getattr(user, "is_superuser", False) and getattr(user, "is_staff", False))
    is_super_admin_role = getattr(user, "role", None) == "SUPER_ADMIN" and not getattr(user, "warehouse_id", None)
    if not (is_super or is_super_admin_role):
        raise PermissionDenied


def ensure_cleanup_allowed(user):
    require_superuser(user)
    if not is_test_cleanup_enabled():
        raise CleanupBlocked(
            "Soxta operatsiyalarni tozalash sozlamalarda o‘chirilgan. "
            "Avval Sozlamalar bo‘limidan ruxsatni yoqing."
        )


def _json(value):
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))


def snapshot(obj):
    values = {}
    for f in obj._meta.concrete_fields:
        value = f.value_from_object(obj)
        values[f.attname] = str(value) if isinstance(value, FieldFile) else value
    return _json({
        "model": obj._meta.label_lower,
        "id": str(obj.pk),
        "label": str(obj),
        "fields": values,
    })


@dataclass
class CleanupPlan:
    rows: dict = field(default_factory=dict)
    effects: dict = field(default_factory=dict)

    def add(self, obj):
        self.rows[(obj._meta.label_lower, str(obj.pk))] = obj
        if len(self.rows) > 500:
            raise CleanupBlocked("Bog‘liq yozuvlar juda ko‘p. Kichikroq guruh tanlang.")

    def effect(self, obj, changes):
        key = (obj._meta.label_lower, str(obj.pk))
        if key not in self.effects:
            self.effects[key] = (obj, {})
        self.effects[key][1].update(changes)

    def payload(self):
        return _json({
            "rows": [snapshot(self.rows[k]) for k in sorted(self.rows)],
            "effects": [
                {"before": snapshot(self.effects[k][0]), "after": self.effects[k][1]}
                for k in sorted(self.effects)
            ],
        })

    @property
    def digest(self):
        return hashlib.sha256(json.dumps(self.payload(), sort_keys=True).encode()).hexdigest()


def _model(label):
    return apps.get_model(label)


def _source(plan, ref, ref_id):
    model = _model(SOURCES[ref])
    obj = None
    if ref_id:
        try:
            obj = model.all_objects.filter(pk=ref_id).first()
        except (ValueError, ValidationError):
            obj = None

    if obj is None or obj.is_deleted:
        # Bog'liq hujjat allaqachon o'chirilgan yoki bazada yo'q (yetim jurnal yozuvi).
        # Shu havola bilan qolgan faol jurnal yozuvlarini ham rejaga qo'shamiz.
        if obj is not None:
            if ref == "expense":
                for child in _model("expenses.FuelLog").objects.filter(expense=obj):
                    plan.add(child)
            elif ref == "sale":
                for debt in _model("sales.Debt").objects.filter(sale=obj):
                    for dp in _model("sales.DebtPayment").objects.filter(debt=debt):
                        plan.add(dp)
                    plan.add(debt)
                for item in _model("sales.SaleItem").objects.filter(sale=obj):
                    plan.add(item)
        if ref_id:
            for label in LEDGERS:
                ledger_model = _model(label)
                if any(f.name == "reference_type" for f in ledger_model._meta.fields):
                    for entry in ledger_model.objects.filter(
                        reference_type=ref, reference_id=str(ref_id)
                    ):
                        plan.add(entry)
        return

    key = (obj._meta.label_lower, str(obj.pk))
    if key in plan.rows:
        return

    if ref == "company_expense":
        if _model("payroll.Payroll").all_objects.filter(
            company_expense=obj, is_deleted=False
        ).exists():
            raise CleanupBlocked("Xarajat maosh hisobiga bog‘langan.")
    elif ref == "advance":
        if obj.payroll_id:
            raise CleanupBlocked("Avans maosh hisobiga bog‘langan.")
    elif ref == "expense":
        for child in _model("expenses.FuelLog").objects.filter(expense=obj):
            plan.add(child)
    elif ref == "debt_payment":
        pass
    elif ref == "cash_handover":
        _check_handover(obj)
    elif ref == "sale":
        if _model("payroll.PayrollDetail").all_objects.filter(
            sale_item__sale=obj, is_deleted=False
        ).exists():
            raise CleanupBlocked("Sotuvdan maosh hisoblangan.")
        for ret in _model("sales.SaleReturn").objects.filter(sale=obj):
            for r_item in _model("sales.SaleReturnItem").objects.filter(sale_return=ret):
                plan.add(r_item)
            plan.add(ret)
        for debt in _model("sales.Debt").objects.filter(sale=obj):
            for dp in _model("sales.DebtPayment").objects.filter(debt=debt):
                plan.add(dp)
                for w_tx in _model("wallet.WalletTransaction").objects.filter(
                    reference_type="debt_payment", reference_id=str(dp.pk)
                ):
                    plan.add(w_tx)
            plan.add(debt)
        for item in _model("sales.SaleItem").objects.filter(sale=obj):
            plan.add(item)
    plan.add(obj)
    # One business operation can produce both cash and wallet entries.
    for label in LEDGERS:
        ledger_model = _model(label)
        if any(f.name == "reference_type" for f in ledger_model._meta.fields):
            for entry in ledger_model.objects.filter(
                reference_type=ref, reference_id=str(obj.pk)
            ):
                plan.add(entry)


def _check_handover(handover):
    """Validate cash handover cleanup without blocking on already-removed legs or later days."""
    if _model("warehouse.StockMovement").objects.filter(
        reference_type="cash_handover", reference_id=str(handover.pk),
    ).exists():
        raise CleanupBlocked("Naqd topshirishga begona ombor harakati bog‘langan.")


def build_plan(label, ids, *, user):
    ensure_cleanup_allowed(user)
    if label not in LEDGERS:
        raise CleanupBlocked("Bu jurnal uchun tozalash ruxsat etilmagan.")
    ids = {str(pk) for pk in ids}
    if not ids or len(ids) > 100:
        raise CleanupBlocked("1 dan 100 tagacha yozuvni tanlang.")
    model = _model(label)
    try:
        selected = list(model.objects.filter(pk__in=ids))
    except (ValueError, ValidationError) as exc:
        raise CleanupBlocked("Noto‘g‘ri yozuv tanlangan.") from exc
    if len(selected) != len(ids):
        raise CleanupBlocked("Tanlangan yozuvlar o‘zgargan yoki allaqachon tozalangan.")
    plan = CleanupPlan()
    for entry in selected:
        ref = getattr(entry, "reference_type", "")
        ref_id = getattr(entry, "reference_id", "")
        if ref in SOURCES:
            _source(plan, ref, ref_id)
        elif ref == "branch_cash_transfer" and label == "finance.cashtransaction":
            if ref_id:
                for item in model.objects.filter(reference_type=ref, reference_id=ref_id):
                    plan.add(item)
        elif ref not in ("", "manual", "opening_balance") or ref_id:
            raise CleanupBlocked(
                f"«{ref or 'noma’lum havola'}» bilan bog‘liq hujjatni xavfsiz "
                "ajratib bo‘lmadi. Bog‘liq hujjatni avval tekshiring."
            )
        elif label == "warehouse.stockmovement" and entry.movement_type not in (
            "OPENING_BALANCE", "CORRECTION",
        ):
            raise CleanupBlocked(
                "Faqat mustaqil boshlang‘ich qoldiq yoki tuzatish harakati tozalanadi. "
                "Qabul, yuklash, ko‘chirish va inventarizatsiya hujjatlari himoyalangan."
            )
        plan.add(entry)

    # Ensure any active CompanyExpense pointing at a selected CashTransaction is archived too.
    for (entry_label, _), entry in list(plan.rows.items()):
        if entry_label == "finance.cashtransaction":
            for expense in _model("finance.CompanyExpense").objects.filter(cash_transaction=entry):
                if (expense._meta.label_lower, str(expense.pk)) not in plan.rows:
                    plan.add(expense)

    groups = defaultdict(list)
    for (entry_label, _), entry in list(plan.rows.items()):
        if entry_label in LEDGERS:
            _, keys, _, _ = LEDGERS[entry_label]
            groups[(entry_label, tuple(getattr(entry, k) for k in keys))].append(entry)
    for (entry_label, values), entries in sorted(groups.items(), key=lambda p: str(p[0])):
        target_label, keys, amount, balance = LEDGERS[entry_label]
        qs = _model(entry_label).objects.filter(**dict(zip(keys, values)))
        history = list(qs.order_by("created_at", "pk"))
        target_ids = {e.pk for e in entries}
        lookup = dict(zip(keys, values)) if len(keys) > 1 else {"pk": values[0]}
        target = _model(target_label).all_objects.filter(**lookup).first()
        if target is None:
            raise CleanupBlocked("Balans yozuvi topilmadi.")
        remaining = [e for e in history if e.pk not in target_ids]
        running = ZERO
        for rem in remaining:
            running += getattr(rem, amount)
            if getattr(rem, "balance_after", running) != running:
                plan.effect(rem, {"balance_after": running})
        new = running
        if entry_label == "warehouse.stockmovement":
            if target.warehouse.is_opening_locked:
                raise CleanupBlocked("Ombor boshlang‘ich qoldig‘i qulflangan; avval qayta oching.")
            if new < target.reserved_quantity or new < ZERO:
                raise CleanupBlocked("Tozalash band qilingan yoki ishlatilgan qoldiqni buzadi.")
        plan.effect(target, {balance: new})
    _document_effects(plan)
    return plan


def _document_effects(plan):
    client_deltas = defaultdict(lambda: ZERO)
    van_deltas = defaultdict(lambda: ZERO)
    payment_deltas = defaultdict(lambda: ZERO)
    handover_deltas = defaultdict(lambda: ZERO)
    for (label, _), obj in plan.rows.items():
        if label == "sales.debt":
            client_deltas[obj.client_id] -= obj.remaining
        elif label == "sales.debtpayment":
            if ("sales.debt", str(obj.debt_id)) not in plan.rows:
                payment_deltas[obj.debt_id] += obj.amount
        elif label == "dayclose.cashhandover" and obj.day_close_id:
            handover_deltas[obj.day_close_id] += obj.amount
        elif label == "sales.saleitem":
            if obj.sale.status in ("COMPLETED", "FLAGGED"):
                van_deltas[(obj.sale.distributor_id, obj.product_id)] += obj.quantity
    for debt_id, amount in payment_deltas.items():
        debt = _model("sales.Debt").all_objects.filter(pk=debt_id).first()
        if debt is None or debt.is_deleted:
            continue
        paid = max(ZERO, debt.paid_amount - amount)
        remaining = max(ZERO, debt.amount - paid)
        plan.effect(debt, {
            "paid_amount": paid,
            "remaining": remaining,
            "status": "PAID" if paid >= debt.amount else "PARTIAL" if paid > ZERO else "ACTIVE",
        })
        client_deltas[debt.client_id] += amount
    for close_id, amount in handover_deltas.items():
        close = _model("dayclose.DayClose").all_objects.filter(pk=close_id).first()
        if close is None or close.is_deleted:
            continue
        handed = max(ZERO, close.cash_handed_amount - amount)
        plan.effect(close, {
            "cash_handed_amount": handed,
            "cash_difference": handed - close.cash_expected,
            "wallet_balance_end": close.wallet_balance_end + amount,
        })
    for client_id, delta in client_deltas.items():
        client = _model("clients.Client").all_objects.filter(pk=client_id).first()
        if client is None:
            continue
        total = _model("sales.Debt").objects.filter(client=client).aggregate(
            total=Sum("remaining"),
        )["total"] or ZERO
        plan.effect(client, {"current_debt": max(ZERO, total + delta)})
    for (distributor_id, product_id), delta in van_deltas.items():
        van = _model("warehouse.VanStock").objects.filter(
            distributor_id=distributor_id, product_id=product_id,
        ).first()
        if van is not None:
            plan.effect(van, {"quantity": max(ZERO, van.quantity + delta)})


@transaction.atomic
def execute_cleanup(label, ids, *, user, expected_digest, reason):
    ensure_cleanup_allowed(user)
    if not reason.strip():
        raise CleanupBlocked("Tozalash sababini kiriting.")
    # Rare maintenance action: briefly exclude concurrent business writes,
    # including new day-close/payroll links that row locks alone cannot cover.
    # No schema changes, no production migration, and no master-data deletion.
    if connection.vendor == "postgresql":
        domain_apps = {
            "finance", "wallet", "warehouse", "sales", "payroll",
            "dayclose", "expenses", "clients", "orders",
        }
        tables = sorted({
            model._meta.db_table for model in apps.get_models()
            if model._meta.app_label in domain_apps and model._meta.managed
        })
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL lock_timeout = '3s'")
            cursor.execute("SET LOCAL statement_timeout = '15s'")
            cursor.execute(
                "LOCK TABLE " + ", ".join(connection.ops.quote_name(t) for t in tables)
                + " IN SHARE ROW EXCLUSIVE MODE"
            )
    preliminary = build_plan(label, ids, user=user)
    # Business services lock documents and balance rows before writing. Recheck
    # after those locks; a new operation since preview invalidates confirmation.
    locks = {**preliminary.rows}
    locks.update({k: obj for k, (obj, _) in preliminary.effects.items()})
    for (model_label, pk), _ in sorted(locks.items()):
        _model(model_label).all_objects.select_for_update().get(pk=pk)
    plan = build_plan(label, ids, user=user)
    if plan.digest != expected_digest:
        raise CleanupBlocked("Ma’lumot o‘zgargan. Ro‘yxatni yangilab, qayta tasdiqlang.")
    payload = plan.payload()
    now = timezone.now()
    for (model_label, pk), obj in plan.rows.items():
        # Intentionally scoped exception; append-only model/admin APIs stay
        # read-only. Soft archive also preserves offline idempotency UUIDs.
        _model(model_label).all_objects.filter(pk=pk).update(is_deleted=True, updated_at=now)
    for (model_label, pk), (_, changes) in plan.effects.items():
        _model(model_label).all_objects.filter(pk=pk).update(**changes, updated_at=now)
    _model("core.AuditLog").objects.create(
        user=user, action="admin.test_operations_cleaned", model_name=label,
        changes={"reason": reason.strip(), **payload},
    )
    from django.core.cache import cache

    transaction.on_commit(cache.clear, robust=True)
    return len(plan.rows)


def list_cleanup_entries(label: str, *, limit: int = 50) -> list[dict]:
    """Tanlangan jurnal bo'yicha oxirgi faol operatsiyalar ro'yxati."""
    if label not in LEDGERS:
        raise CleanupBlocked("Bu jurnal uchun tozalash ruxsat etilmagan.")
    limit = max(1, min(int(limit or 50), 200))
    model = _model(label)

    if label == "finance.cashtransaction":
        qs = model.objects.select_related("account", "account__branch", "created_by").order_by(
            "-created_at", "-pk"
        )[:limit]
        return [
            {
                "id": str(row.pk),
                "date": str(row.date),
                "created_at": row.created_at.isoformat(),
                "type_code": row.transaction_type,
                "type_display": row.get_transaction_type_display(),
                "target_name": row.account.name if row.account_id else "Asosiy kassa",
                "counterparty": row.counterparty or "",
                "amount": str(row.amount),
                "balance_after": str(row.balance_after),
                "reference_type": row.reference_type or "",
                "reference_id": str(row.reference_id or ""),
                "note": row.note or "",
                "actor_name": row.created_by.full_name if row.created_by_id else "",
            }
            for row in qs
        ]

    if label == "wallet.wallettransaction":
        qs = model.objects.select_related(
            "wallet", "wallet__distributor", "created_by"
        ).order_by("-created_at", "-pk")[:limit]
        return [
            {
                "id": str(row.pk),
                "date": str(row.date),
                "created_at": row.created_at.isoformat(),
                "type_code": row.transaction_type,
                "type_display": row.get_transaction_type_display(),
                "target_name": (
                    row.wallet.distributor.full_name
                    if row.wallet_id and row.wallet.distributor_id
                    else str(row.wallet_id)
                ),
                "counterparty": "",
                "amount": str(row.amount),
                "balance_after": str(row.balance_after),
                "reference_type": row.reference_type or "",
                "reference_id": str(row.reference_id or ""),
                "note": row.note or "",
                "actor_name": row.created_by.full_name if row.created_by_id else "",
            }
            for row in qs
        ]

    if label == "warehouse.suppliertransaction":
        qs = model.objects.select_related("supplier", "created_by").order_by(
            "-created_at", "-pk"
        )[:limit]
        return [
            {
                "id": str(row.pk),
                "date": str(row.date),
                "created_at": row.created_at.isoformat(),
                "type_code": row.transaction_type,
                "type_display": row.get_transaction_type_display(),
                "target_name": row.supplier.name if row.supplier_id else "",
                "counterparty": "",
                "amount": str(row.amount),
                "balance_after": str(row.balance_after),
                "reference_type": "",
                "reference_id": "",
                "note": row.note or "",
                "actor_name": row.created_by.full_name if row.created_by_id else "",
            }
            for row in qs
        ]

    if label == "warehouse.stockmovement":
        qs = model.objects.select_related("warehouse", "product", "user", "created_by").order_by(
            "-created_at", "-pk"
        )[:limit]
        return [
            {
                "id": str(row.pk),
                "date": row.created_at.date().isoformat(),
                "created_at": row.created_at.isoformat(),
                "type_code": row.movement_type,
                "type_display": row.get_movement_type_display(),
                "target_name": f"{row.warehouse.name} · {row.product.name} ({row.product.sku})",
                "counterparty": row.to_location or row.from_location or "",
                "amount": str(row.quantity),
                "balance_after": str(row.balance_after),
                "reference_type": row.reference_type or "",
                "reference_id": str(row.reference_id or ""),
                "note": row.note or "",
                "actor_name": (
                    row.user.full_name
                    if row.user_id
                    else (row.created_by.full_name if row.created_by_id else "")
                ),
            }
            for row in qs
        ]

    return []


def format_plan_effects(plan: CleanupPlan) -> list[dict]:
    """UI va Admin uchun balans o'zgarishlarini o'qilishi qulay ro'yxatga aylantiradi."""
    return _json([
        {
            "model": obj._meta.label_lower,
            "id": str(obj.pk),
            "label": str(obj),
            "changes": [
                {
                    "field": str(obj._meta.get_field(field).verbose_name),
                    "field_name": field,
                    "old": str(getattr(obj, field)),
                    "new": str(value),
                }
                for field, value in changes.items()
            ],
        }
        for obj, changes in plan.effects.values()
    ])
