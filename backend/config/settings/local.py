"""Local browser-sinov sozlamalari — tashqi xizmatlarsiz (sqlite + locmem).

Docker'siz `runserver` uchun:
    DJANGO_SETTINGS_MODULE=config.settings.local python manage.py runserver
"""
from .base import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "local.sqlite3",  # noqa: F405
    }
}

CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
}
CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
}

CELERY_TASK_ALWAYS_EAGER = True

# Kreditsialli wildcard CORS xavfli (audit CFG-002) — aniq ro'yxat.
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
CSRF_TRUSTED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
