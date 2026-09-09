"""CFG-001 — ishlab chiqarish konfiguratsiyasi xavfsiz standartga ega bo'lishi kerak.

Audit topilmasi: `docker-compose.yml` va process entrypoint'lari (`asgi/wsgi/celery/
manage.py`) `config.settings.dev` ga ishora qilardi — natijada ishlab chiqarishda
`DEBUG=True`, `ALLOWED_HOSTS=['*']`, xavfsizlik sarlavhalarisiz ishga tushardi.
`config/settings/prod.py` mavjud, lekin hech qaysi ishga tushirish yo'li uni ishlatmasdi.
"""
from __future__ import annotations

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


def test_prod_settings_are_hardened() -> None:
    """`config.settings.prod` yuklanganda xavfsizlik bayroqlari yoqilgan bo'lsin."""
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.prod",
        "SECRET_KEY": "x" * 60,
        "ALLOWED_HOSTS": "meyfu.example.com",
        "CORS_ALLOWED_ORIGINS": "https://meyfu.example.com",
        "DATABASE_URL": "sqlite:///deploy-check.sqlite3",
        "REDIS_URL": "redis://localhost:6379/0",
    }
    script = (
        "import django; django.setup();"
        "from django.conf import settings as s;"
        "assert s.DEBUG is False, 'DEBUG must be False';"
        "assert '*' not in s.ALLOWED_HOSTS, 'wildcard host';"
        "assert s.SESSION_COOKIE_SECURE is True;"
        "assert s.CSRF_COOKIE_SECURE is True;"
        "assert s.SECURE_HSTS_SECONDS > 0;"
        "assert s.SECURE_SSL_REDIRECT is True;"
        "print('ok')"
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        env=env,
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert "ok" in result.stdout
