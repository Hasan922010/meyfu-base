"""Test sozlamalari — tashqi xizmatlarsiz (sqlite + locmem).

CI va lokal `pytest` uchun. Docker ichida `dev.py` (PostgreSQL) ishlatiladi.
"""
import tempfile

from .base import *  # noqa: F401,F403
from .base import REST_FRAMEWORK

# Test yuklamalari repo `media/` ni ifloslantirmasin — vaqtinchalik katalog
MEDIA_ROOT = tempfile.mkdtemp(prefix="meyfu-test-media-")

DEBUG = False
ALLOWED_HOSTS = ["*"]  # WebSocket AllowedHostsOriginValidator testlarda

# Testlarda tezlik cheklovi (throttling) o'chirilgan
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {
        "anon": None, "user": None, "login": None, "ocr": None,
    },
}
SECRET_KEY = "test-secret-key-not-for-production-0123456789abcdef"  # noqa: S105

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

CELERY_TASK_ALWAYS_EAGER = True
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
