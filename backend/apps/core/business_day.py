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
