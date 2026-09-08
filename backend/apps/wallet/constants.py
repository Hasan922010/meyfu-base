from django.db import models
from django.utils.translation import gettext_lazy as _


class TransactionType(models.TextChoices):
    SALE_CASH = "SALE_CASH", _("Naqd sotuv (+)")
    DEBT_COLLECTED = "DEBT_COLLECTED", _("Undirilgan qarz (+)")
    EXPENSE = "EXPENSE", _("Xarajat (−)")
    HANDOVER = "HANDOVER", _("Kassaga topshirildi (−)")
    ADVANCE = "ADVANCE", _("Avans (+)")
    CORRECTION = "CORRECTION", _("Tuzatuvchi yozuv (±)")


# Kutilgan ishora (validatsiya uchun)
POSITIVE_TYPES = {
    TransactionType.SALE_CASH,
    TransactionType.DEBT_COLLECTED,
    TransactionType.ADVANCE,
}
NEGATIVE_TYPES = {
    TransactionType.EXPENSE,
    TransactionType.HANDOVER,
}
