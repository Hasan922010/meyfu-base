from django.db import models
from django.utils.translation import gettext_lazy as _


class DayCloseStatus(models.TextChoices):
    OPEN = "OPEN", _("Ochiq")
    PENDING = "PENDING", _("Tasdiq kutilmoqda")
    CLOSED = "CLOSED", _("Yopilgan")


class ItemCondition(models.TextChoices):
    GOOD = "GOOD", _("Yaroqli")
    DAMAGED = "DAMAGED", _("Shikastlangan")
    EXPIRED = "EXPIRED", _("Muddati o'tgan")
