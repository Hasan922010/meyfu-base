from django.db import models
from django.utils.translation import gettext_lazy as _


class CommissionScope(models.TextChoices):
    GLOBAL = "GLOBAL", _("Umumiy")
    CATEGORY = "CATEGORY", _("Kategoriya")
    PRODUCT = "PRODUCT", _("Mahsulot")
    DISTRIBUTOR = "DISTRIBUTOR", _("Tarqatuvchi")


# Aniqlik darajasi — kattasi yutadi (CLAUDE.md 6 CommissionRule)
SCOPE_SPECIFICITY: dict[str, int] = {
    CommissionScope.DISTRIBUTOR: 4,
    CommissionScope.PRODUCT: 3,
    CommissionScope.CATEGORY: 2,
    CommissionScope.GLOBAL: 1,
}


class PayrollStatus(models.TextChoices):
    DRAFT = "DRAFT", _("Qoralama")
    APPROVED = "APPROVED", _("Tasdiqlangan")
    PAID = "PAID", _("To'langan")


class CommissionRole(models.TextChoices):
    """Komissiya qaysi ish uchun (v4 T1 — ikki bosqichli maosh)."""

    ORDER = "ORDER", _("Zakaz olgani")
    DELIVERY = "DELIVERY", _("Yetkazib bergani")


# Sozlama kaliti — kamomad/kassa farqi maoshdan avtomatik ushlansinmi (CLAUDE.md 7.11)
SETTING_AUTO_DEDUCT = "payroll.auto_deduct_shortage"

# v4 T1 — profil foizi topilmasa ishlatiladigan standart foizlar
SETTING_DEFAULT_ORDER_COMMISSION = "payroll.default_order_commission"
SETTING_DEFAULT_DELIVERY_COMMISSION = "payroll.default_delivery_commission"
