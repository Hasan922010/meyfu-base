"""Telegram davriy vazifalar (CLAUDE.md 15)."""
from __future__ import annotations

from celery import shared_task


@shared_task(ignore_result=True)
def daily_digest() -> None:
    from .services.digest import send_daily_digest

    send_daily_digest()


@shared_task(ignore_result=True)
def morning_loading_reminder() -> None:
    from .services.digest import send_morning_loading_reminder

    send_morning_loading_reminder()


@shared_task(ignore_result=True)
def evening_dayclose_reminder() -> None:
    from .services.digest import send_evening_dayclose_reminder

    send_evening_dayclose_reminder()
