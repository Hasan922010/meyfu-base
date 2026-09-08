from django.db import models
from django.utils.translation import gettext_lazy as _


class PaymentType(models.TextChoices):
    CASH = "NAQD", _("Naqd")
    CARD = "PLASTIK", _("Plastik karta")
    TRANSFER = "OTKAZMA", _("Bank o'tkazmasi")
    DEBT = "QARZ", _("Qarzga")
    MIXED = "ARALASH", _("Aralash")


class SaleStatus(models.TextChoices):
    COMPLETED = "COMPLETED", _("Yakunlangan")
    FLAGGED = "FLAGGED", _("Belgilangan (ko'rib chiqilsin)")
    CONFLICT = "CONFLICT", _("Ziddiyat (admin hal qilsin)")
    CANCELLED = "CANCELLED", _("Bekor qilingan")


class ReturnReason(models.TextChoices):
    DEFECT = "BRAK", _("Brak")
    EXPIRED = "MUDDAT", _("Muddati o'tgan")
    DISAGREEMENT = "KELISHMOVCHILIK", _("Kelishmovchilik")


class DebtStatus(models.TextChoices):
    ACTIVE = "ACTIVE", _("Faol")
    PARTIAL = "PARTIAL", _("Qisman to'langan")
    PAID = "PAID", _("To'langan")
    OVERDUE = "OVERDUE", _("Muddati o'tgan")


# Qarz to'lovi uchun ruxsat etilgan to'lov turlari
DEBT_PAYMENT_TYPES = [
    PaymentType.CASH,
    PaymentType.CARD,
    PaymentType.TRANSFER,
]
