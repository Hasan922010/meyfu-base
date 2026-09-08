from django.db import models
from django.utils.translation import gettext_lazy as _


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", _("Super admin")
    MANAGER = "MANAGER", _("Menejer")
    WAREHOUSE = "WAREHOUSE", _("Omborchi")
    DISTRIBUTOR = "DISTRIBUTOR", _("Tarqatuvchi")
    ACCOUNTANT = "ACCOUNTANT", _("Buxgalter")


class ExpensesCoveredBy(models.TextChoices):
    COMPANY = "COMPANY", _("Kompaniya")
    SALARY = "SALARY", _("Maoshdan")
