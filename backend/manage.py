#!/usr/bin/env python
"""Django boshqaruv yordamchisi."""
import os
import sys


def main() -> None:
    # Fail-safe: sozlanmagan muhitda `prod` tanlanadi. Lokal ishlab chiqish uchun
    # `--settings=config.settings.local` bering yoki `backend/.env` ga
    # `DJANGO_SETTINGS_MODULE=config.settings.local` yozing (README ga qarang).
    from env_bootstrap import apply_settings_module

    apply_settings_module()
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:  # pragma: no cover
        raise ImportError(
            "Django topilmadi. Virtual muhit faollashtirilganmi?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
