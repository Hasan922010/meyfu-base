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
    """

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser or getattr(user, "role", None) == Role.SUPER_ADMIN:
            return True

        action_roles = getattr(view, "action_roles", None)
        action = getattr(view, "action", None)
        if action_roles and action in action_roles:
            return getattr(user, "role", None) in action_roles[action]

        is_read = request.method in SAFE_METHODS
        roles = (
            getattr(view, "read_roles", None)
            if is_read
            else getattr(view, "write_roles", None)
        )
        if roles is None:
            roles = getattr(view, "allowed_roles", None)
        if roles is None:
            return True
        return getattr(user, "role", None) in roles


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user and user.is_authenticated
            and (user.is_superuser or user.role == Role.SUPER_ADMIN)
        )


class IsDistributor(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user and user.is_authenticated and user.role == Role.DISTRIBUTOR
        )
