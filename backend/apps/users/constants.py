from django.db import models
from django.utils.translation import gettext_lazy as _


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", _("Super admin")
    MANAGER = "MANAGER", _("Menejer")
    # Bitta filialni boshqaradi: o'z xodimlari, mijozlari, savdosi va kassasi.
    # MANAGER huquqlariga ega, lekin faqat o'z filiali doirasida va markaziy
    # sozlamalarsiz (katalog, narx, foiz, kompaniya sozlamalari).
    BRANCH_MANAGER = "BRANCH_MANAGER", _("Filial rahbari")
    WAREHOUSE = "WAREHOUSE", _("Omborchi")
    DISTRIBUTOR = "DISTRIBUTOR", _("Tarqatuvchi")
    ACCOUNTANT = "ACCOUNTANT", _("Buxgalter")
    # Faqat buyurtma oladi — sotuv, pul, tovar harakati yo'q
    ORDER_TAKER = "ORDER_TAKER", _("Zakaz oluvchi")


class ExpensesCoveredBy(models.TextChoices):
    COMPANY = "COMPANY", _("Kompaniya")
    SALARY = "SALARY", _("Maoshdan")
