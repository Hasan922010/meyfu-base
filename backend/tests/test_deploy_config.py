"""CFG-001 — ishlab chiqarish konfiguratsiyasi xavfsiz standartga ega bo'lishi kerak.

Audit topilmasi: `docker-compose.yml` va process entrypoint'lari (`asgi/wsgi/celery/
manage.py`) `config.settings.dev` ga ishora qilardi — natijada ishlab chiqarishda
`DEBUG=True`, `ALLOWED_HOSTS=['*']`, xavfsizlik sarlavhalarisiz ishga tushardi.
`config/settings/prod.py` mavjud, lekin hech qaysi ishga tushirish yo'li uni ishlatmasdi.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent

# `os.environ.setdefault("DJANGO_SETTINGS_MODULE", "...")` qatoridagi qiymat
_SETDEFAULT_RE = re.compile(
    r"""setdefault\(\s*["']DJANGO_SETTINGS_MODULE["']\s*,\s*["']([^"']+)["']"""
)

ENTRYPOINT_MODULES = ["config/asgi.py", "config/wsgi.py", "config/celery.py", "manage.py"]


@pytest.mark.parametrize("rel_path", ENTRYPOINT_MODULES)
def test_process_entrypoints_default_to_prod_settings(rel_path: str) -> None:
    """Konteynerda ishlaydigan process'lar sozlanmagan muhitda `prod` ni tanlasin
    (fail-safe) — hech qachon `dev` ni emas."""
    source = (BACKEND_DIR / rel_path).read_text(encoding="utf-8")
    match = _SETDEFAULT_RE.search(source)
    assert match, f"{rel_path}: DJANGO_SETTINGS_MODULE setdefault topilmadi"
    assert match.group(1) != "config.settings.dev", (
        f"{rel_path}: standart sozlama `config.settings.dev` — ishlab chiqarishda "
        f"DEBUG=True bilan ishga tushadi. `config.settings.prod` bo'lishi kerak."
    )
    assert match.group(1) == "config.settings.prod"


def test_docker_compose_uses_prod_settings_and_no_insecure_secret() -> None:
    compose = (REPO_ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    assert "config.settings.dev" not in compose, (
        "docker-compose.yml `config.settings.dev` ni ishlatadi — dev qulayliklari "
        "`docker-compose.dev.yml` ga ko'chirilsin."
    )
    assert "config.settings.prod" in compose
    assert "insecure-dev-key-change-me" not in compose, (
        "docker-compose.yml ma'lum `SECRET_KEY` standart qiymatini in'ektsiya qiladi."
    )


def test_dev_compose_override_exists() -> None:
    assert (REPO_ROOT / "docker-compose.dev.yml").is_file(), (
        "Dev uchun alohida override fayli bo'lishi kerak (docker-compose.dev.yml)."
    )


_STRONG_KEY = "u" + "R7_x9Q2" * 8  # 57 belgi, blocklist'da emas


def _load_prod_settings(
    script: str, **env_overrides: str | None
) -> subprocess.CompletedProcess:
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.prod",
        "SECRET_KEY": _STRONG_KEY,
        "ALLOWED_HOSTS": "meyfu.example.com",
        "CORS_ALLOWED_ORIGINS": "https://meyfu.example.com",
        "CSRF_TRUSTED_ORIGINS": "https://meyfu.example.com",
        "DATABASE_URL": "sqlite:///deploy-check.sqlite3",
        "REDIS_URL": "redis://localhost:6379/0",
        "TELEGRAM_CREDENTIAL_KEY_VERSION": "v1",
        "TELEGRAM_CREDENTIAL_KEYS": json.dumps({
            "v1": "strong-dedicated-telegram-credential-key",
        }),
    }
    for key, value in env_overrides.items():
        if value is None:
            env.pop(key, None)
        else:
            env[key] = value
    return subprocess.run(
        [sys.executable, "-c", "import django; django.setup(); " + script],
        env=env, cwd=str(BACKEND_DIR), capture_output=True, text=True,
    )


def _load_replit_settings(
    script: str, *, debug: bool, **env_overrides: str | None
) -> subprocess.CompletedProcess:
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.replit",
        "DEBUG": str(debug),
        "SESSION_SECRET": _STRONG_KEY,
        "DATABASE_URL": "sqlite:///deploy-check.sqlite3",
        "TELEGRAM_CREDENTIAL_KEY_VERSION": "v1",
        "TELEGRAM_CREDENTIAL_KEYS": json.dumps({
            "v1": "strong-dedicated-telegram-credential-key",
        }),
    }
    for key, value in env_overrides.items():
        if value is None:
            env.pop(key, None)
        else:
            env[key] = value
    return subprocess.run(
        [sys.executable, "-c", "import django; django.setup(); " + script],
        env=env, cwd=str(BACKEND_DIR), capture_output=True, text=True,
    )


def test_prod_settings_are_hardened() -> None:
    """`config.settings.prod` yuklanganda xavfsizlik bayroqlari yoqilgan bo'lsin."""
    result = _load_prod_settings(
        "from django.conf import settings as s;"
        "assert s.DEBUG is False, 'DEBUG must be False';"
        "assert '*' not in s.ALLOWED_HOSTS, 'wildcard host';"
        "assert s.SESSION_COOKIE_SECURE is True;"
        "assert s.CSRF_COOKIE_SECURE is True;"
        "assert s.SECURE_HSTS_SECONDS > 0;"
        "assert s.SECURE_SSL_REDIRECT is True;"
        "print('ok')"
    )
    assert result.returncode == 0, result.stderr
    assert "ok" in result.stdout


def test_replit_production_enables_https_protection() -> None:
    result = _load_replit_settings(
        "from django.conf import settings as s;"
        "assert s.SECURE_PROXY_SSL_HEADER == ('HTTP_X_FORWARDED_PROTO', 'https');"
        "assert s.SECURE_SSL_REDIRECT is True;"
        "assert r'^api/v1/health/$' in s.SECURE_REDIRECT_EXEMPT;"
        "assert s.SECURE_HSTS_SECONDS == 3600;"
        "assert s.SECURE_HSTS_INCLUDE_SUBDOMAINS is False;"
        "assert s.SECURE_HSTS_PRELOAD is False;"
        "assert s.SESSION_COOKIE_SECURE is True;"
        "assert s.CSRF_COOKIE_SECURE is True;"
        "print('ok')",
        debug=False,
    )
    assert result.returncode == 0, result.stderr
    assert "ok" in result.stdout


def test_replit_preview_does_not_force_https_or_hsts() -> None:
    result = _load_replit_settings(
        "from django.conf import settings as s;"
        "assert s.SECURE_SSL_REDIRECT is False;"
        "assert s.SECURE_HSTS_SECONDS == 0;"
        "assert s.SESSION_COOKIE_SECURE is False;"
        "assert s.CSRF_COOKIE_SECURE is False;"
        "print('ok')",
        debug=True,
    )
    assert result.returncode == 0, result.stderr
    assert "ok" in result.stdout


def test_replit_production_deploy_check_has_no_https_warnings() -> None:
    result = _load_replit_settings(
        "from django.core.management import call_command;"
        "call_command('check', '--deploy')",
        debug=False,
    )
    assert result.returncode == 0, result.stderr
    output = result.stdout + result.stderr
    assert "security.W004" not in output
    assert "security.W008" not in output


@pytest.mark.parametrize(
    "secret_key",
    [
        "",  # bo'sh (aniq env — lokal .env ni bosib o'tadi)
        "insecure-dev-key-change-me",  # base.py fallback
        "django-insecure-abc123",  # Django auto-generatsiya prefiksi
        "short",  # juda qisqa
        "x" * 40,  # 50 belgidan qisqa
    ],
)
def test_prod_rejects_weak_secret_key(secret_key: str) -> None:
    """SEC-003 — kuchsiz/yo'q `SECRET_KEY` bilan `prod` yuklanmasligi kerak."""
    result = _load_prod_settings("print('loaded')", SECRET_KEY=secret_key)
    assert result.returncode != 0, (
        f"SECRET_KEY={secret_key!r} bilan prod yuklandi — rad etilishi kerak edi"
    )
    assert "ImproperlyConfigured" in result.stderr or "SECRET_KEY" in result.stderr


@pytest.mark.parametrize(
    "webhook_secret",
    ["", "dev-webhook-secret", "short"],
)
def test_prod_requires_strong_webhook_secret_when_bot_enabled(
    webhook_secret: str,
) -> None:
    """SEC-004 — TELEGRAM_BOT_TOKEN berilsa kuchli webhook siri majburiy."""
    result = _load_prod_settings(
        "print('loaded')",
        TELEGRAM_BOT_TOKEN="123456:fake-token",
        TELEGRAM_WEBHOOK_SECRET=webhook_secret,
    )
    assert result.returncode != 0, (
        f"webhook_secret={webhook_secret!r} bilan prod yuklandi — rad etilishi kerak"
    )
    assert "TELEGRAM_WEBHOOK_SECRET" in result.stderr


def test_prod_ok_without_bot() -> None:
    """Bot o'chirilgan bo'lsa webhook siri talab qilinmaydi."""
    result = _load_prod_settings(
        "from django.conf import settings; print(settings.TELEGRAM_BOT_TOKEN or 'none')",
        TELEGRAM_BOT_TOKEN="",
        TELEGRAM_WEBHOOK_SECRET=None,
    )
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize(
    "credential_keys",
    [
        None,
        "{}",
        '{"v1":"short"}',
        '{"v1":"insecure-dev-telegram-key-change-me"}',
    ],
)
def test_prod_rejects_unsafe_telegram_credential_keys(
    credential_keys: str | None,
) -> None:
    result = _load_prod_settings(
        "print('loaded')",
        TELEGRAM_CREDENTIAL_KEYS=credential_keys,
    )
    assert result.returncode != 0
    assert "TELEGRAM_CREDENTIAL_KEYS" in result.stderr


def test_replit_accepts_plain_telegram_credential_key() -> None:
    result = _load_prod_settings(
        "from django.conf import settings; "
        "print(settings.TELEGRAM_CREDENTIAL_KEYS['v1'])",
        TELEGRAM_CREDENTIAL_KEYS="strong-plain-telegram-credential-key-123456",
    )
    assert result.returncode == 0
    assert "strong-plain-telegram-credential-key-123456" in result.stdout
