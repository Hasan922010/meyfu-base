"""Komissiya foizini aniqlash (CLAUDE.md 6 CommissionRule, 7.10).

Ustuvorlik: DISTRIBUTOR > PRODUCT > CATEGORY > GLOBAL, keyin `priority`, keyin yangi.
Hech qanday qoida bo'lmasa — Product.commission_percent, keyin
DistributorProfile.commission_percent, keyin 0.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date as date_cls
from decimal import Decimal

from django.db.models import Q

from apps.core.models import Setting

from ..constants import (
    SCOPE_SPECIFICITY,
    SETTING_DEFAULT_DELIVERY_COMMISSION,
    SETTING_DEFAULT_ORDER_COMMISSION,
    CommissionScope,
)
from ..models import CommissionRule

_ZERO = Decimal("0")


@dataclass(frozen=True)
class CommissionMatch:
    percent: Decimal
    scope: str


def _rules_for(distributor, product, on_date: date_cls) -> list[CommissionRule]:
    active = CommissionRule.objects.filter(
        is_active=True, valid_from__lte=on_date,
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=on_date))

    matches: list[CommissionRule] = []
    for rule in active:
        if rule.scope == CommissionScope.GLOBAL:
            matches.append(rule)
        elif rule.scope == CommissionScope.DISTRIBUTOR and (
            rule.target_id == distributor.id
        ):
            matches.append(rule)
        elif rule.scope == CommissionScope.PRODUCT and (
            rule.target_id == product.id
        ):
            matches.append(rule)
        elif rule.scope == CommissionScope.CATEGORY and (
            product.category_id and rule.target_id == product.category_id
        ):
            matches.append(rule)
    return matches


def resolve_commission(
    *, distributor, product, on_date: date_cls
) -> CommissionMatch:
    """Berilgan tarqatuvchi + mahsulot + sana uchun eng aniq foizni qaytaradi."""
    rules = _rules_for(distributor, product, on_date)
    if rules:
        best = max(
            rules,
            key=lambda r: (SCOPE_SPECIFICITY[r.scope], r.priority, r.created_at),
        )
        return CommissionMatch(percent=best.percent, scope=best.scope)

    product_pct = product.commission_percent or _ZERO
    if product_pct > _ZERO:
        return CommissionMatch(percent=product_pct, scope=CommissionScope.PRODUCT)

    profile = getattr(distributor, "distributor_profile", None)
    profile_pct = getattr(profile, "commission_percent", _ZERO) or _ZERO
    if profile_pct > _ZERO:
        return CommissionMatch(percent=profile_pct, scope=CommissionScope.DISTRIBUTOR)

    return CommissionMatch(percent=_ZERO, scope=CommissionScope.GLOBAL)


def _setting_percent(key: str) -> Decimal:
    try:
        return Decimal(str(Setting.get(key, 0) or 0))
    except (TypeError, ValueError):
        return _ZERO


def resolve_two_stage(*, user, on_date=None) -> tuple[Decimal, Decimal]:
    """(order_percent, delivery_percent) — v4 T1.

    Ustuvorlik: DistributorProfile.order/delivery_commission_percent →
    Setting standart foizlar → legacy commission_percent (faqat delivery uchun).
    `on_date` hozircha ishlatilmaydi (kelajakda vaqt bo'yicha foiz uchun qoldirilgan).
    """
    def _dec(value) -> Decimal:
        try:
            return Decimal(str(value or 0))
        except (TypeError, ValueError):
            return _ZERO

    profile = getattr(user, "distributor_profile", None)
    order_pct = _dec(getattr(profile, "order_commission_percent", _ZERO))
    delivery_pct = _dec(getattr(profile, "delivery_commission_percent", _ZERO))

    if order_pct == _ZERO:
        order_pct = _setting_percent(SETTING_DEFAULT_ORDER_COMMISSION)
    if delivery_pct == _ZERO:
        delivery_pct = _setting_percent(SETTING_DEFAULT_DELIVERY_COMMISSION)

    # Legacy: yangi foizlarning ikkalasi ham 0, lekin eski yagona foiz bor —
    # uni yetkazish foizi sifatida qo'llaymiz (eski xulqni buzmaslik uchun).
    legacy_pct = _dec(getattr(profile, "commission_percent", _ZERO))
    if order_pct == _ZERO and delivery_pct == _ZERO and legacy_pct > _ZERO:
        delivery_pct = legacy_pct

    return order_pct, delivery_pct
