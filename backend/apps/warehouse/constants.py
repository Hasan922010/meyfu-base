from django.db import models
from django.utils.translation import gettext_lazy as _


class MovementType(models.TextChoices):
    IN_PURCHASE = "IN_PURCHASE", _("Kirim — xarid")
    OUT_LOADING = "OUT_LOADING", _("Chiqim — yuklash")
    IN_RETURN = "IN_RETURN", _("Kirim — qaytarish")
    OUT_SALE = "OUT_SALE", _("Chiqim — sotuv")
    ADJUSTMENT = "ADJUSTMENT", _("Tuzatish (inventarizatsiya)")
    WRITE_OFF = "WRITE_OFF", _("Hisobdan chiqarish (brak)")
    TRANSFER = "TRANSFER", _("Ko'chirish")
    CORRECTION = "CORRECTION", _("Xatoni tuzatuvchi yozuv")


class PurchaseStatus(models.TextChoices):
    DRAFT = "DRAFT", _("Qoralama")
    CONFIRMED = "CONFIRMED", _("Tasdiqlangan")


class PurchaseSource(models.TextChoices):
    MANUAL = "MANUAL", _("Qo'lda")
    SCAN = "SCAN", _("Naklit skani")


class LoadingStatus(models.TextChoices):
    DRAFT = "DRAFT", _("Qoralama")
    SENT = "SENT", _("Yuborilgan")
    CONFIRMED = "CONFIRMED", _("Tasdiqlangan")
    CLOSED = "CLOSED", _("Yopilgan")
