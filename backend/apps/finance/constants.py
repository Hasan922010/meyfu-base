from django.db import models
from django.utils.translation import gettext_lazy as _


class CashTxType(models.TextChoices):
    HANDOVER_IN = "HANDOVER_IN", _("Tarqatuvchidan naqd (+)")
    OTHER_IN = "OTHER_IN", _("Boshqa kirim (+)")
    BANK_DEPOSIT = "BANK_DEPOSIT", _("Bankka topshirildi (−)")
    SUPPLIER_PAYMENT = "SUPPLIER_PAYMENT", _("Yetkazib beruvchiga to'lov (−)")
    COMPANY_EXPENSE = "COMPANY_EXPENSE", _("Kompaniya xarajati (−)")
    OTHER_OUT = "OTHER_OUT", _("Boshqa chiqim (−)")
    CORRECTION = "CORRECTION", _("Tuzatuvchi yozuv (±)")


POSITIVE_CASH_TYPES = {CashTxType.HANDOVER_IN, CashTxType.OTHER_IN}
NEGATIVE_CASH_TYPES = {
    CashTxType.BANK_DEPOSIT,
    CashTxType.SUPPLIER_PAYMENT,
    CashTxType.COMPANY_EXPENSE,
    CashTxType.OTHER_OUT,
}


class CompanyExpenseCategory(models.TextChoices):
    RENT = "RENT", _("Ijara")
    SALARY = "SALARY", _("Maosh")
    UTILITIES = "UTILITIES", _("Kommunal to'lovlar")
    TRANSPORT = "TRANSPORT", _("Transport")
    MARKETING = "MARKETING", _("Marketing")
    TAX = "TAX", _("Soliq")
    OTHER = "OTHER", _("Boshqa")
