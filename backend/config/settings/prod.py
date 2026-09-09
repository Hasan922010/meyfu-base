"""Production sozlamalari."""
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# --- SECRET_KEY (audit SEC-003) ---
# base.py da dev qulayligi uchun standart qiymat bor; ishlab chiqarishda uni
# ishlatib bo'lmaydi — env majburiy va kuchli bo'lishi shart.
SECRET_KEY = env("SECRET_KEY")
_INSECURE_KEYS = {
    "insecure-dev-key-change-me",
    "dev-insecure-not-a-secret",
    "change-me-in-production",
    "test-secret-key-not-for-production-0123456789abcdef",
}
if not SECRET_KEY or SECRET_KEY in _INSECURE_KEYS or SECRET_KEY.startswith(
    ("django-insecure-", "insecure-", "change-me")
):
    raise ImproperlyConfigured(
        "Ishlab chiqarishda kuchli SECRET_KEY kerak. Generatsiya qiling: "
        'python -c "import secrets;print(secrets.token_urlsafe(64))"'
    )
if len(SECRET_KEY) < 50:
    raise ImproperlyConfigured(
        f"SECRET_KEY juda qisqa ({len(SECRET_KEY)} belgi) — kamida 50 belgi bo'lsin."
    )

ADMINS = [
    ("Operator", email.strip())
    for email in env("ADMIN_EMAILS", default="").split(",")
    if email.strip()
]

# --- Xavfsizlik (CLAUDE.md 16) ---
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS", default=[])

# --- Sentry (xatoliklar monitoringi — CLAUDE.md 16) ---
SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration()],
            traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.1),
            send_default_pii=False,
            environment=env("SENTRY_ENVIRONMENT", default="production"),
        )
    except ImportError:  # sentry-sdk o'rnatilmagan — jimgina davom etamiz
        pass
