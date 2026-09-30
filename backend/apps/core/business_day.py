"""Ish kuni (CLAUDE.md 5.4): 06:00 dan keyingi kun 05:59 gacha bitta kun.

Tongdagi (00:00–05:59) sotuv, yuklama va xarajatlar kechagi ish kuniga tushadi —
kechki smena to'g'ri kunda yopilishi uchun. "Bugun" kerak bo'lgan har joyda
Django'ning taqvim sanasi o'rniga shu funksiya ishlatiladi (UX audit N1).
"""
from datetime import date, datetime, timedelta

from django.conf import settings
from django.utils import timezone


def business_date(now: datetime | None = None) -> date:
    """`now` (default: hozir) qaysi ish kuniga tegishli — TIME_ZONE bo'yicha."""
    moment = timezone.localtime(now or timezone.now())
    return (moment - timedelta(hours=settings.BUSINESS_DAY_START_HOUR)).date()


def business_day_range(start: date, end: date) -> tuple[datetime, datetime]:
    """[start 06:00, end+1 06:00) — `created_at` kabi vaqt maydonlarini ish kuni
    bo'yicha filtrlash uchun (`created_at__date` taqvim sanasi beradi; audit BE-114)."""
    tz = timezone.get_current_timezone()
    shift = timedelta(hours=settings.BUSINESS_DAY_START_HOUR)
    begin = timezone.make_aware(datetime.combine(start, datetime.min.time()), tz) + shift
    finish = (
        timezone.make_aware(datetime.combine(end + timedelta(days=1), datetime.min.time()), tz)
        + shift
    )
    return begin, finish
