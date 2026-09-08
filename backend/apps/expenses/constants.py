from django.db import models
from django.utils.translation import gettext_lazy as _


class PaidBy(models.TextChoices):
    COMPANY = "COMPANY", _("Kompaniya")
    DISTRIBUTOR = "DISTRIBUTOR", _("Tarqatuvchi")


class PaymentSource(models.TextChoices):
    CASH_ON_HAND = "CASH_ON_HAND", _("Qo'ldagi naqd")
    OWN_MONEY = "OWN_MONEY", _("Shaxsiy pul")
    COMPANY_CARD = "COMPANY_CARD", _("Kompaniya kartasi")


class ExpenseStatus(models.TextChoices):
    PENDING = "PENDING", _("Tasdiq kutilmoqda")
    APPROVED = "APPROVED", _("Tasdiqlangan")
    REJECTED = "REJECTED", _("Rad etilgan")
