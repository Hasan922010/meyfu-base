"""Development sozlamalari (faqat lokal — audit CFG-004)."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True
# `.env` / compose override bermasa lokal xostlar (wildcard emas).
ALLOWED_HOSTS = env(
    "ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1", "[::1]", "web", "nginx"],
)

INTERNAL_IPS = ["127.0.0.1"]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
