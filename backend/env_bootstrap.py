"""`.env` dan `DJANGO_SETTINGS_MODULE` ni Django yuklanishidan OLDIN o'qiydi.

`manage.py`, `config/wsgi.py`, `config/asgi.py`, `config/celery.py` —
`os.environ.setdefault(...)` chaqirishidan avval buni ishga tushiradi. Shunda
`backend/.env` ga `DJANGO_SETTINGS_MODULE=...` yozib qo'yish (README tavsiyasi)
haqiqatan ishlaydi.

Bu modul ataylab `config` paketidan TASHQARIDA — import qilinganda
`config/__init__.py` (→ celery) ishga tushib, prod'ni oldindan o'rnatib
qo'ymasligi uchun. Boshqa sozlamalarni base.py o'zi `env.read_env()` bilan o'qiydi.
"""
import os
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parent / ".env"


def apply_settings_module() -> None:
    if os.environ.get("DJANGO_SETTINGS_MODULE"):
        return
    if not _ENV_FILE.exists():
        return
    for raw in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        if key.strip() == "DJANGO_SETTINGS_MODULE":
            value = value.split("#", 1)[0].strip().strip("'\"")
            if value:
                os.environ["DJANGO_SETTINGS_MODULE"] = value
            return
