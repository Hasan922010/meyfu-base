"""Foydalanuvchi va tarqatuvchi profili (CLAUDE.md 6).

Eslatma: `User.warehouse` va `DistributorProfile.route` FK'lari mos ravishda
`warehouse` va `clients` applari qo'shilganda (2 va 3-bosqich) migratsiya
bilan ulanadi.
"""
from __future__ import annotations

import re
import uuid
from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from .constants import ExpensesCoveredBy, Role
from .managers import UserManager

_PHONE_RE = re.compile(r"[^\d+]")


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # AbstractUser dan username'ni olib tashlaymiz — login telefon orqali
    username = None  # type: ignore[assignment]
    first_name = None  # type: ignore[assignment]
    last_name = None  # type: ignore[assignment]

    phone = models.CharField(_("telefon"), max_length=20, unique=True)
    full_name = models.CharField(_("F.I.SH."), max_length=255)
    role = models.CharField(
        _("rol"), max_length=20, choices=Role.choices, default=Role.DISTRIBUTOR,
        db_index=True,
    )
    avatar = models.ImageField(
        _("rasm"), upload_to="avatars/", null=True, blank=True
    )
    passport_series = models.CharField(
        _("passport seriyasi"), max_length=20, blank=True
    )
    address = models.CharField(_("manzil"), max_length=255, blank=True)
    hire_date = models.DateField(_("ishga kirgan sana"), null=True, blank=True)

    device_id = models.CharField(_("qurilma ID"), max_length=128, blank=True)
    last_seen_at = models.DateTimeField(_("oxirgi faollik"), null=True, blank=True)
    telegram_chat_id = models.CharField(
        _("Telegram chat ID"), max_length=64, blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        verbose_name = _("foydalanuvchi")
        verbose_name_plural = _("foydalanuvchilar")
        ordering = ("full_name",)

    def __str__(self) -> str:
        return f"{self.full_name} ({self.phone})"

    @staticmethod
    def normalize_phone(phone: str) -> str:
        cleaned = _PHONE_RE.sub("", phone or "").strip()
        if not cleaned or cleaned.startswith("+"):
            return cleaned
        if cleaned.startswith("998"):
            return "+" + cleaned
        # Lokal 9 xonali raqam (masalan 901234567) → +998 bilan to'ldiramiz
        if len(cleaned) == 9:
            return "+998" + cleaned
        return cleaned

    def save(self, *args, **kwargs):
        if self.phone:
            self.phone = self.normalize_phone(self.phone)
        super().save(*args, **kwargs)


class DistributorProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="distributor_profile"
    )

    vehicle_number = models.CharField(_("mashina raqami"), max_length=20, blank=True)
    base_salary = models.DecimalField(
        _("asosiy maosh"), max_digits=14, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    commission_percent = models.DecimalField(
        _("komissiya foizi (legacy)"), max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal("0"))],
        help_text=_("Eski yagona foiz — order/delivery foizi 0 bo'lsa ishlatiladi"),
    )
    order_commission_percent = models.DecimalField(
        _("zakaz olgani uchun foiz"), max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    delivery_commission_percent = models.DecimalField(
        _("yetkazib bergani uchun foiz"), max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    monthly_plan = models.DecimalField(
        _("oylik reja"), max_digits=14, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    debt_limit = models.DecimalField(
        _("qarz limiti"), max_digits=14, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    can_sell_below_price = models.BooleanField(
        _("minimal narxdan past sotishga ruxsat"), default=False
    )

    # [F2] — 7-bosqich (xarajat va hamyon)
    daily_expense_limit = models.DecimalField(
        _("kunlik xarajat limiti"), max_digits=14, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    expenses_covered_by = models.CharField(
        _("xarajatni kim qoplaydi"), max_length=10,
        choices=ExpensesCoveredBy.choices, default=ExpensesCoveredBy.COMPANY,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("tarqatuvchi profili")
        verbose_name_plural = _("tarqatuvchi profillari")

    def __str__(self) -> str:
        return f"Profil: {self.user.full_name}"
