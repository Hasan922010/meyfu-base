"""Filiallarni ajratish (multi-branch) — umumiy qoidalar.

Filial = `is_branch=True` bo'lgan ombor. Xodimga (`User.warehouse`) filial
biriktirilgan bo'lsa, u faqat shu filial ma'lumotini ko'radi va yozadi.
Markaz xodimlari (filialsiz yoki markaziy omborga biriktirilgan) va SUPER_ADMIN
hammasini ko'radi — mavjud ish tartibi o'zgarmaydi.
"""
from __future__ import annotations

from uuid import UUID

from django.db.models import QuerySet
from rest_framework.exceptions import ValidationError

from apps.users.constants import Role

# Filial rahbari yarata oladigan rollar — o'zidan yuqori rol berib bo'lmaydi
BRANCH_STAFF_ROLES = frozenset(
    {Role.DISTRIBUTOR, Role.ORDER_TAKER, Role.WAREHOUSE, Role.ACCOUNTANT}
)


class _NoBranch:
    """Filial rahbariga filial biriktirilmagan — hech narsa ko'rinmaydi."""


NO_BRANCH = _NoBranch()


def is_central(user) -> bool:
    return bool(user.is_superuser or getattr(user, "role", None) == Role.SUPER_ADMIN)


def user_branch(user):
    """Xodimning filiali (`Warehouse`) yoki `None` (markaz)."""
    if is_central(user):
        return None
    warehouse = getattr(user, "warehouse", None)
    return warehouse if warehouse is not None and warehouse.is_branch else None


def branch_scope(user) -> UUID | _NoBranch | None:
    """Ro'yxatlarni cheklash uchun filial ID.

    `None` — cheklov yo'q (markaz). `NO_BRANCH` — filial rahbari, lekin filial
    biriktirilmagan (xato sozlama — hech narsa ko'rsatilmaydi).
    """
    branch = user_branch(user)
    if branch is not None:
        return branch.pk
    if getattr(user, "role", None) == Role.BRANCH_MANAGER and not is_central(user):
        return NO_BRANCH
    return None


def scope_queryset(qs: QuerySet, user, lookup: str) -> QuerySet:
    """`lookup` — modeldan filialgacha yo'l (masalan `distributor__warehouse`)."""
    scope = branch_scope(user)
    if scope is None:
        return qs
    if scope is NO_BRANCH:
        return qs.none()
    return qs.filter(**{lookup: scope})


def staff_branch(staff):
    """Tarqatuvchi/xodim qaysi filialga tegishli (`None` — markaz)."""
    warehouse = getattr(staff, "warehouse", None) if staff is not None else None
    return warehouse if warehouse is not None and warehouse.is_branch else None


def ensure_same_branch(user, branch_id, field: str) -> None:
    """Filial xodimi boshqa filial obyektiga bog'lay olmasin."""
    scope = branch_scope(user)
    if scope is None:
        return
    if scope is NO_BRANCH or branch_id != scope:
        raise ValidationError({field: "Faqat o'z filialingiz ma'lumotini tanlay olasiz."})
