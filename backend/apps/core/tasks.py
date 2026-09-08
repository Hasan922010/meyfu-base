"""Yadro davriy vazifalari — butunlik nazorati (CLAUDE.md 5.2, 15)."""
from __future__ import annotations

from celery import shared_task


@shared_task(ignore_result=True)
def check_integrity() -> dict:
    """Har kecha: balans == jurnal yig'indisi? Farq bo'lsa — adminga xabar + AuditLog.

    Natija har doim `AuditLog(action="integrity.check")` ga yoziladi — tizim
    salomatligi sahifasi oxirgi yozuvni ko'rsatadi.
    """
    from apps.core.models import AuditLog
    from apps.core.services.integrity import run_integrity_check

    result = run_integrity_check()

    AuditLog.objects.create(
        action="integrity.check",
        model_name="",
        object_id="",
        changes={
            "ok": result["ok"],
            "mismatch_count": result["mismatch_count"],
            "mismatches": result["mismatches"],
            "counts": result["counts"],
        },
    )

    if not result["ok"]:
        from apps.notifications.services import notify_admins
        from realtime.broadcast import broadcast

        lines = "\n".join(
            f"· {m['label']}: {m['stored']} ≠ {m['ledger']}"
            for m in result["mismatches"][:10]
        )
        notify_admins(
            type="integrity.mismatch",
            title="⚠️ Butunlik farqi topildi",
            body=(
                f"{result['mismatch_count']} ta balans jurnal bilan mos kelmadi:\n"
                f"{lines}"
            ),
            data={"mismatch_count": result["mismatch_count"]},
        )
        broadcast(
            "admin_dashboard",
            "integrity.mismatch",
            {"mismatch_count": result["mismatch_count"]},
        )

    return result
