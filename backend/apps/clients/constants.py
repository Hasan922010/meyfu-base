from django.db import models
from django.utils.translation import gettext_lazy as _


class ClientType(models.TextChoices):
    SHOP = "SHOP", _("Do'kon")
    MARKET = "MARKET", _("Bozor")
    SUPERMARKET = "SUPERMARKET", _("Supermarket")
    PHARMACY = "PHARMACY", _("Dorixona")
    OTHER = "OTHER", _("Boshqa")


class VisitResult(models.TextChoices):
    SALE = "SOTUV", _("Sotuv bo'ldi")
    NO_SALE = "SOTUVSIZ", _("Sotuvsiz")
    CLOSED = "YOPIQ", _("Yopiq edi")


# days_of_week: ISO — 1=Dushanba ... 7=Yakshanba
WEEKDAYS = {
    1: _("Dushanba"),
    2: _("Seshanba"),
    3: _("Chorshanba"),
    4: _("Payshanba"),
    5: _("Juma"),
    6: _("Shanba"),
    7: _("Yakshanba"),
}
