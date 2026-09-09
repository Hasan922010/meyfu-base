"""E2E (Playwright) sozlamalari — `local` ga o'xshash, lekin alohida sqlite fayl.

Repo'dagi `local.sqlite3` ni ifloslantirmaslik uchun. Playwright config har
ishga tushishdan oldin `e2e.sqlite3` ni o'chiradi.
"""
from .local import *  # noqa: F401,F403
from .local import BASE_DIR  # noqa: F401

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "e2e.sqlite3",  # noqa: F405
    }
}
