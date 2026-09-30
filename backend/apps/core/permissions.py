"""Rolga asoslangan ruxsatlar (CLAUDE.md 2)."""
from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.users.constants import Role


class RolePermission(BasePermission):
    """View atributlari bo'yicha tekshiradi:

    - `allowed_roles`  — barcha metodlar uchun (agar `read/write_roles` berilmasa)
    - `read_roles`     — GET/HEAD/OPTIONS uchun
    - `write_roles`    — POST/PUT/PATCH/DELETE uchun
    - `action_roles`   — {action_nomi: (rollar,)} — alohida amallar uchun ustuvor

    Hech biri berilmasa — faqat autentifikatsiya talab qilinadi.

    BRANCH_MANAGER — MANAGER ruxsat etilgan joyda ruxsat oladi (ma'lumot
    `core.branch` orqali o'z filialiga cheklanadi), bundan mustasno:
    `central_only_write = True` bo'lgan view'da yozish (katalog, narx, lug'atlar)
    va `central_only_actions` dagi amallar (masalan ommaviy boshlang'ich qoldiq).
    """

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser or getattr(user, "role", None) == Role.SUPER_ADMIN:
            return True

        is_read = request.method in SAFE_METHODS
        role = getattr(user, "role", None)
        if role == Role.BRANCH_MANAGER:
            if not is_read and getattr(view, "central_only_write", False):
                return False
            if getattr(view, "action", None) in getattr(view, "central_only_actions", ()):
                return False
            candidates = {Role.BRANCH_MANAGER, Role.MANAGER}
        else:
            candidates = {role}

        action_roles = getattr(view, "action_roles", None)
        action = getattr(view, "action", None)
        if action_roles and action in action_roles:
            return bool(candidates & set(action_roles[action]))

        roles = (
            getattr(view, "read_roles", None)
            if is_read
            else getattr(view, "write_roles", None)
        )
        if roles is None:
            roles = getattr(view, "allowed_roles", None)
        if roles is None:
            return True
        return bool(candidates & set(roles))


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user and user.is_authenticated
            and (user.is_superuser or user.role == Role.SUPER_ADMIN)
        )


def is_order_taker(user) -> bool:
    """Zakaz oluvchi — faqat o'z buyurtmalari va marshrut mijozlarini ko'radi."""
    return getattr(user, "role", None) == Role.ORDER_TAKER and not getattr(
        user, "is_superuser", False
    )


class IsDistributor(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user and user.is_authenticated and user.role == Role.DISTRIBUTOR
        )


class IsCentralStaff(BasePermission):
    """Filialga biriktirilgan xodim (rahbar, omborchi, buxgalter) kompaniya
    bo'yicha umumiy ma'lumotni ko'rmaydi: butunlik farqlari, tizim holati,
    ta'minotchilar jurnali (audit SEC-115)."""

    def has_permission(self, request, view) -> bool:
        from apps.core.branch import branch_scope

        user = request.user
        if not (user and user.is_authenticated):
            return False
        return bool(user.is_superuser) or branch_scope(user) is None
