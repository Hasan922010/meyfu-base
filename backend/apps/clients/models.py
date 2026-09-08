"""Mijoz va marshrut modellari (CLAUDE.md 6 — Mijozlar [MVP])."""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel

from .constants import ClientType, VisitResult

_ZERO = Decimal("0")
_MONEY = {"max_digits": 14, "decimal_places": 2}
_GEO = {"max_digits": 9, "decimal_places": 6, "null": True, "blank": True}


def _validate_weekdays(value: list) -> None:
    if not isinstance(value, list) or any(
        not isinstance(d, int) or d < 1 or d > 7 for d in value
    ):
        raise ValidationError(
            _("days_of_week — 1..7 oralig'idagi butun sonlar ro'yxati.")
        )


class Route(BaseModel):
    name = models.CharField(_("nomi"), max_length=128)
    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="routes", verbose_name=_("tarqatuvchi"),
    )
    days_of_week = models.JSONField(
        _("hafta kunlari"), default=list, blank=True, validators=[_validate_weekdays]
    )
    is_active = models.BooleanField(_("faol"), default=True)

    class Meta:
        verbose_name = _("marshrut")
        verbose_name_plural = _("marshrutlar")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Client(BaseModel):
    name = models.CharField(_("do'kon nomi"), max_length=255)
    owner_name = models.CharField(_("egasining ismi"), max_length=255, blank=True)
    phone = models.CharField(_("telefon"), max_length=20, blank=True)
    phone2 = models.CharField(_("qo'shimcha telefon"), max_length=20, blank=True)
    address = models.CharField(_("manzil"), max_length=255, blank=True)
    latitude = models.DecimalField(_("kenglik"), **_GEO)
    longitude = models.DecimalField(_("uzunlik"), **_GEO)

    route = models.ForeignKey(
        Route, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="clients", verbose_name=_("marshrut"),
    )
    client_type = models.CharField(
        _("turi"), max_length=16, choices=ClientType.choices,
        default=ClientType.SHOP,
    )
    debt_limit = models.DecimalField(
        _("qarz limiti"), **_MONEY, default=_ZERO,
        validators=[MinValueValidator(_ZERO)],
    )
    current_debt = models.DecimalField(
        _("joriy qarz"), **_MONEY, default=_ZERO,
        help_text=_("Denormalized — DebtPayment/Sale orqali yangilanadi"),
    )
    inn = models.CharField(_("INN / STIR"), max_length=20, blank=True)
    photo = models.ImageField(_("rasm"), upload_to="clients/", null=True, blank=True)
    is_blocked = models.BooleanField(_("bloklangan"), default=False, db_index=True)
    note = models.CharField(_("izoh"), max_length=500, blank=True)

    class Meta:
        verbose_name = _("mijoz")
        verbose_name_plural = _("mijozlar")
        ordering = ("name",)
        indexes = [
            models.Index(fields=["route", "name"]),
            models.Index(fields=["is_blocked"]),
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def debt_available(self) -> Decimal:
        return self.debt_limit - self.current_debt


class ClientVisit(BaseModel):
    """Tashrif / GPS check-in (CLAUDE.md 6, 8 — GPS faqat tashrif paytida)."""

    distributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="client_visits", verbose_name=_("tarqatuvchi"),
    )
    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, related_name="visits",
        verbose_name=_("mijoz"),
    )
    checked_in_at = models.DateTimeField(_("tashrif vaqti"))
    latitude = models.DecimalField(_("kenglik"), **_GEO)
    longitude = models.DecimalField(_("uzunlik"), **_GEO)
    result = models.CharField(
        _("natija"), max_length=10, choices=VisitResult.choices
    )
    photo = models.ImageField(_("rasm"), upload_to="visits/", null=True, blank=True)
    note = models.CharField(_("izoh"), max_length=500, blank=True)

    # Offline idempotentlik (CLAUDE.md 4.2)
    client_uuid = models.UUIDField(
        _("mijoz tomonidagi UUID"), unique=True, null=True, blank=True
    )
    device_time = models.DateTimeField(_("qurilma vaqti"), null=True, blank=True)

    class Meta:
        verbose_name = _("tashrif")
        verbose_name_plural = _("tashriflar")
        ordering = ("-checked_in_at",)
        indexes = [
            models.Index(fields=["distributor", "-checked_in_at"]),
            models.Index(fields=["client", "-checked_in_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.client.name} · {self.get_result_display()}"
