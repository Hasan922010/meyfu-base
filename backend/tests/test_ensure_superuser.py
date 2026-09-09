"""SEC-002 — `ensure_superuser` standart parolli admin yaratmasligi kerak.

Audit topilmasi: `docker/entrypoint.sh` har ishga tushganda `ensure_superuser`
chaqirardi; env berilmasa standart `+998900000000` / `Hasanali.0220` (repo va
hujjatlarда ochiq) bilan SUPER_ADMIN yaratilardi.
"""
from __future__ import annotations

from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError

User = get_user_model()

_SUPER_ENV = ("DJANGO_SUPERUSER_PHONE", "DJANGO_SUPERUSER_PASSWORD",
              "DJANGO_SUPERUSER_NAME")


@pytest.fixture(autouse=True)
def _clean_super_env(monkeypatch):
    for key in _SUPER_ENV:
        monkeypatch.delenv(key, raising=False)


@pytest.mark.django_db
def test_no_env_is_noop(monkeypatch):
    out = StringIO()
    call_command("ensure_superuser", stdout=out)
    assert User.objects.count() == 0
    assert "o'tkazib yuborildi" in out.getvalue()


@pytest.mark.django_db
def test_partial_env_is_error(monkeypatch):
    monkeypatch.setenv("DJANGO_SUPERUSER_PHONE", "+998900000000")
    with pytest.raises(CommandError, match="ikkalasi ham"):
        call_command("ensure_superuser")
    assert User.objects.count() == 0


@pytest.mark.django_db
def test_weak_password_is_rejected(monkeypatch):
    monkeypatch.setenv("DJANGO_SUPERUSER_PHONE", "+998900000000")
    monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", "12345678")
    with pytest.raises(CommandError, match="kuchli emas"):
        call_command("ensure_superuser")
    assert User.objects.count() == 0


@pytest.mark.django_db
def test_valid_env_creates_once(monkeypatch):
    monkeypatch.setenv("DJANGO_SUPERUSER_PHONE", "+998900000000")
    monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", "Str0ng-Pass-9x2")
    monkeypatch.setenv("DJANGO_SUPERUSER_NAME", "Test Admin")

    call_command("ensure_superuser", stdout=StringIO())
    user = User.objects.get()
    assert user.is_superuser and user.is_staff
    assert user.check_password("Str0ng-Pass-9x2")

    out = StringIO()
    call_command("ensure_superuser", stdout=out)  # ikkinchi marta — dublikat yo'q
    assert User.objects.count() == 1
    assert "allaqachon mavjud" in out.getvalue()


@pytest.mark.django_db
def test_seed_demo_refuses_without_force_when_not_debug(settings):
    settings.DEBUG = False
    with pytest.raises(CommandError, match="--force"):
        call_command("seed_demo")
    assert User.objects.count() == 0
