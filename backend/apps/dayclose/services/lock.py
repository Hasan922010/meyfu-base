"""Yopilgan kun qulfi (CLAUDE.md 7.7; audit BE-101).

Kun topshirilgan (PENDING) yoki yopilgan (CLOSED) bo'lsa, o'sha kunga yangi
pul/tovar operatsiyasi yozilmaydi — aks holda `DayClose` summalari hamyon va
qoldiq bilan ajralib qoladi.

- Onlayn so'rov → rad etiladi (`DAY_CLOSED`).
- Offline sinxronizatsiya → ma'lumot yo'qolmasin (4-bo'lim): bugungi ish kuniga
  ko'chiriladi (u ham yopiq bo'lsa — o'z sanasida qoladi) va AuditLog yoziladi.
- Admin tahriri (masalan sotuvni bekor qilish) → faqat SUPER_ADMIN, sabab bilan.
"""
from __future__ import annotations

import datetime

from apps.core.business_day import business_date
from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog

from ..constants import DayCloseStatus
from ..models import DayClose

LOCKED_STATUSES = (DayCloseStatus.PENDING, DayCloseStatus.CLOSED)


def day_locked(distributor, date: datetime.date) -> bool:
    return DayClose.objects.filter(
        distributor=distributor, date=date, status__in=LOCKED_STATUSES
    ).exists()


def _closed_error(date: datetime.date) -> BusinessError:
    return BusinessError(
        message=f"{date:%d.%m.%Y} kuni yopilgan — o'zgartirish faqat SUPER_ADMIN "
                "ruxsati bilan (sabab ko'rsatib).",
        code="DAY_CLOSED",
        details={"date": str(date)},
    )


def resolve_operation_date(
    distributor, requested: datetime.date | None, *, offline: bool, kind: str
) -> tuple[datetime.date, bool]:
    """Yangi operatsiya sanasi. Qaytaradi: (sana, yopilgan_kunga_tushdimi)."""
    date = requested or business_date()
    if not day_locked(distributor, date):
        return date, False
    if not offline:
        raise _closed_error(date)
    today = business_date()
    final = today if date != today and not day_locked(distributor, today) else date
    AuditLog.objects.create(
        user=distributor, action="dayclose.late_operation", model_name=kind,
        changes={"requested_date": str(date), "booked_date": str(final)},
    )
    return final, True


def assert_day_open(
    distributor, date: datetime.date, *, user=None, reason: str = "", kind: str = ""
) -> None:
    """Mavjud hujjatni o'zgartirish (bekor qilish va h.k.) — yopilgan kunda
    faqat SUPER_ADMIN sabab bilan; har holat AuditLog'ga yoziladi."""
    if not day_locked(distributor, date):
        return
    from apps.users.constants import Role

    is_super = user is not None and (
        user.is_superuser or getattr(user, "role", None) == Role.SUPER_ADMIN
    )
    if not (is_super and reason.strip()):
        raise _closed_error(date)
    AuditLog.objects.create(
        user=user, action="dayclose.edit_after_close", model_name=kind,
        changes={"date": str(date), "distributor": str(distributor.pk),
                 "reason": reason.strip()},
    )
