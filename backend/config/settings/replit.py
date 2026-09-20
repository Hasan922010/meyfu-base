"""Replit development and deployment settings."""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import BASE_DIR, env, validate_telegram_credential_keys

DEBUG = env.bool("DEBUG", default=False)
SECRET_KEY = os.environ.get("SESSION_SECRET") or env(
    "SECRET_KEY",
    default="insecure-replit-preview-key-change-before-production",
)
if not DEBUG:
    if "TELEGRAM_CREDENTIAL_KEYS" not in os.environ:
        raise ImproperlyConfigured(
            "Replit deployment uchun TELEGRAM_CREDENTIAL_KEYS secreti kerak."
        )
    validate_telegram_credential_keys()

ALLOWED_HOSTS = ["*"]

_domains = [
    item.strip()
    for item in os.environ.get("REPLIT_DOMAINS", "").split(",")
    if item.strip()
]
CSRF_TRUSTED_ORIGINS = [
    *(f"https://{domain}" for domain in _domains),
    "https://meyfu-base.uz",
    "https://www.meyfu-base.uz",
]
CORS_ALLOWED_ORIGINS = CSRF_TRUSTED_ORIGINS

if not os.environ.get("DATABASE_URL"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "replit.sqlite3",
        }
    }

if os.environ.get("REDIS_URL"):
    REDIS_URL = os.environ["REDIS_URL"]
else:
    CACHES = {
        "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
    }
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
    }
    CELERY_TASK_ALWAYS_EAGER = True

USE_S3 = env.bool("USE_S3", default=False)

MIDDLEWARE.insert(  # noqa: F405
    MIDDLEWARE.index("django.contrib.sessions.middleware.SessionMiddleware"),  # noqa: F405
    "whitenoise.middleware.WhiteNoiseMiddleware",
)
STORAGES = {
    "default": {
        "BACKEND": (
            "storages.backends.s3boto3.S3Boto3Storage"
            if USE_S3
            else "django.core.files.storage.FileSystemStorage"
        )
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
# Replit's Autoscale startup probe reaches Daphne over the container's internal
# HTTP port. Redirecting this path to HTTPS makes the probe speak TLS to an HTTP
# server and prevents an otherwise healthy deployment from becoming ready.
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/$"]
# Start with a short production rollout before increasing HSTS or including
# subdomains/preload, which are harder to reverse if HTTPS coverage is incomplete.
SECURE_HSTS_SECONDS = 3600 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_CONTENT_TYPE_NOSNIFF = True
