from django.db import models
from django.utils.translation import gettext_lazy as _


class ScanStatus(models.TextChoices):
    UPLOADED = "UPLOADED", _("Yuklandi")
    PROCESSING = "PROCESSING", _("Qayta ishlanmoqda")
    NEEDS_REVIEW = "NEEDS_REVIEW", _("Tekshirish kerak")
    CONFIRMED = "CONFIRMED", _("Tasdiqlangan")
    FAILED = "FAILED", _("Xato")
    CANCELLED = "CANCELLED", _("Bekor qilingan")


class ScanType(models.TextChoices):
    INVOICE = "INVOICE", _("Nakladnoy")
    RECEIPT = "RECEIPT", _("Chek")


class OcrProvider(models.TextChoices):
    CLAUDE = "claude", _("Claude vision")
    TESSERACT = "tesseract", _("Tesseract")
    MOCK = "mock", _("Mock (sinov)")


class MatchStatus(models.TextChoices):
    EXACT = "EXACT", _("Aniq moslik")
    FUZZY = "FUZZY", _("O'xshash (tasdiq kerak)")
    NEW = "NEW", _("Yangi mahsulot")
    UNMATCHED = "UNMATCHED", _("Topilmadi")
