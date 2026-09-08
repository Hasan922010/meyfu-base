from __future__ import annotations

from django.contrib.auth.base_user import BaseUserManager
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    """Telefon raqami login sifatida (CLAUDE.md 6)."""

    use_in_migrations = True

    def _create_user(self, phone: str, password: str | None, **extra):
        if not phone:
            raise ValueError(_("Telefon raqami majburiy."))
        phone = self.model.normalize_phone(phone)
        user = self.model(phone=phone, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone: str, password: str | None = None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(phone, password, **extra)

    def create_superuser(self, phone: str, password: str | None = None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", "SUPER_ADMIN")
        if extra.get("is_staff") is not True:
            raise ValueError(_("Superuser is_staff=True bo'lishi kerak."))
        if extra.get("is_superuser") is not True:
            raise ValueError(_("Superuser is_superuser=True bo'lishi kerak."))
        return self._create_user(phone, password, **extra)
