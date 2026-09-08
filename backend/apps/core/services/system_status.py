"""Tizim salomatligi — bir joyga yig'ilgan holat (CLAUDE.md 13-panel #16, 16).

db / redis / celery / disk · butunlik tekshiruvi natijasi · backup holati ·
sinxronizatsiya ziddiyatlari · OCR navbati · Celery navbat uzunligi.
"""
from __future__ import annotations

import shutil
import time
from datetime import UTC, datetime
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.db import connections
from django.utils import timezone

# 26 soat — kunlik backup (02:00) uchun kichik zaxira oynasi bilan
_BACKUP_STALE_HOURS = 26


def _check_db() -> bool:
    try:
        connections["default"].cursor().execute("SELECT 1")
        return True
    except Exception:  # noqa: BLE001
        return False


def _check_redis() -> bool:
    try:
        cache.set("health:ping", "pong", 5)
        return cache.get("health:ping") == "pong"
    except Exception:  # noqa: BLE001
        return False


def _check_celery() -> dict:
    """Ishchi (worker) javob beryaptimi? Best-effort — ping 1 soniya."""
    try:
        from config.celery import app

        replies = app.control.ping(timeout=1.0) or []
        return {"ok": bool(replies), "workers": len(replies)}
    except Exception:  # noqa: BLE001
        return {"ok": False, "workers": 0}


def _check_disk() -> dict:
    try:
        usage = shutil.disk_usage(Path(settings.BASE_DIR))
        free_pct = round(usage.free / usage.total * 100, 1)
        return {
            "ok": free_pct > 10,
            "free_percent": free_pct,
            "free_gb": round(usage.free / 1024**3, 1),
        }
    except Exception:  # noqa: BLE001
        return {"ok": True, "free_percent": None, "free_gb": None}


def _celery_queue_len() -> int | None:
    try:
        from django_redis import get_redis_connection

        return int(get_redis_connection("default").llen("celery"))
    except Exception:  # noqa: BLE001
        return None


def health_checks(*, deep: bool = True) -> dict:
    """`/health/` va tizim sahifasi uchun. `deep=False` — celery ping o'tkazilmaydi."""
    started = time.monotonic()
    checks: dict = {"db": _check_db(), "redis": _check_redis(), "disk": _check_disk()}
    checks["celery"] = _check_celery() if deep else {"ok": None, "workers": None}

    # db va redis — majburiy; disk/celery — ogohlantirish, "degraded" qilmaydi
    healthy = checks["db"] and checks["redis"]
    return {
        "status": "ok" if healthy else "degraded",
        "healthy": healthy,
        "checks": checks,
        "queue_length": _celery_queue_len(),
        "response_ms": round((time.monotonic() - started) * 1000, 1),
    }


def _last_integrity() -> dict:
    from apps.core.models import AuditLog

    last = (
        AuditLog.objects.filter(action="integrity.check")
        .order_by("-created_at")
        .first()
    )
    if last is None:
        return {"ran_at": None, "ok": None, "mismatch_count": None}
    changes = last.changes or {}
    return {
        "ran_at": last.created_at.isoformat(),
        "ok": changes.get("ok"),
        "mismatch_count": changes.get("mismatch_count"),
        "mismatches": changes.get("mismatches", []),
    }


def _backup_status() -> dict:
    backup_dir = Path(settings.BACKUP_DIR)
    try:
        dumps = sorted(backup_dir.glob("db_*.sql.gz"))
    except Exception:  # noqa: BLE001
        dumps = []
    if not dumps:
        return {"status": "unknown", "last_at": None, "age_hours": None,
                "size_mb": None, "count": 0}
    newest = max(dumps, key=lambda p: p.stat().st_mtime)
    stat = newest.stat()
    last_dt = datetime.fromtimestamp(stat.st_mtime, tz=UTC)
    age_hours = round((timezone.now() - last_dt).total_seconds() / 3600, 1)
    return {
        "status": "stale" if age_hours > _BACKUP_STALE_HOURS else "ok",
        "last_at": last_dt.isoformat(),
        "age_hours": age_hours,
        "size_mb": round(stat.st_size / 1024**2, 2),
        "count": len(dumps),
    }


def _sync_status() -> dict:
    """Sinxronizatsiya ziddiyatlari — offline outbox serverga tushganda yuzaga keladi."""
    from apps.sales.models import Sale

    conflicts = Sale.objects.filter(status="CONFLICT").count()
    flagged = Sale.objects.filter(status="FLAGGED").count()
    unsynced = Sale.objects.filter(is_synced=False).count()
    last_sale = Sale.objects.order_by("-created_at").values_list(
        "created_at", flat=True
    ).first()
    return {
        "conflicts": conflicts,
        "flagged": flagged,
        "unsynced": unsynced,
        "last_sale_at": last_sale.isoformat() if last_sale else None,
    }


def _ocr_status() -> dict:
    from apps.ocr.constants import ScanStatus
    from apps.ocr.models import InvoiceScan

    return {
        "configured": bool(getattr(settings, "ANTHROPIC_API_KEY", "")),
        "needs_review": InvoiceScan.objects.filter(
            status=ScanStatus.NEEDS_REVIEW
        ).count(),
        "processing": InvoiceScan.objects.filter(
            status=ScanStatus.PROCESSING
        ).count(),
        "failed_7d": InvoiceScan.objects.filter(
            status=ScanStatus.FAILED,
            created_at__gte=timezone.now() - timezone.timedelta(days=7),
        ).count(),
    }


def system_status() -> dict:
    return {
        "generated_at": timezone.now().isoformat(),
        "health": health_checks(deep=True),
        "integrity": _last_integrity(),
        "backup": _backup_status(),
        "sync": _sync_status(),
        "ocr": _ocr_status(),
        "sentry_enabled": bool(getattr(settings, "SENTRY_DSN", "")),
    }
