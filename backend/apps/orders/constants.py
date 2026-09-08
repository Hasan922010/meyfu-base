from django.db import models
from django.utils.translation import gettext_lazy as _


class OrderStatus(models.TextChoices):
    DRAFT = "DRAFT", _("Qoralama")
    PLACED = "PLACED", _("Berilgan")
    APPROVED = "APPROVED", _("Tasdiqlangan")
    LOADED = "LOADED", _("Yuklamaga olindi")
    DELIVERED = "DELIVERED", _("Yetkazildi")
    PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED", _("Qisman yetkazildi")
    CANCELLED = "CANCELLED", _("Bekor qilindi")


# Yetkazish/tasdiqlash uchun ochiq holatlar
OPEN_STATUSES = (
    OrderStatus.DRAFT,
    OrderStatus.PLACED,
    OrderStatus.APPROVED,
    OrderStatus.LOADED,
)

ORDER_PREFIX = "ZAK"
