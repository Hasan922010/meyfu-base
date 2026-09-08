"""OCR metrikalari (CLAUDE.md 9 — o'lchanishi shart bo'lgan metrikalar)."""
from __future__ import annotations

from decimal import Decimal

from django.db.models import Avg, Count, Sum
from django.utils import timezone

from ..constants import MatchStatus, ScanStatus
from ..models import InvoiceScan, InvoiceScanLine

_ZERO = Decimal("0")


def _pct(part, whole) -> float:
    return round(100 * part / whole, 1) if whole else 0.0


def compute_metrics(*, days: int = 30) -> dict:
    since = timezone.now() - timezone.timedelta(days=days)
    scans = InvoiceScan.objects.filter(created_at__gte=since)
    confirmed = scans.filter(status=ScanStatus.CONFIRMED)
    lines = InvoiceScanLine.objects.filter(scan__in=confirmed)

    total_lines = lines.count()
    # to'g'ri qator = EXACT moslik VA tuzatilmagan
    correct_lines = lines.filter(
        match_status=MatchStatus.EXACT, was_corrected=False
    ).count()
    corrected_lines = lines.filter(was_corrected=True).count()

    cost_agg = scans.aggregate(
        total=Sum("cost_usd"), n=Count("id"),
        avg_tokens=Avg("tokens_used"),
    )
    confirm_secs = [
        (s.confirmed_at - s.created_at).total_seconds()
        for s in confirmed.filter(confirmed_at__isnull=False)
    ]
    avg_confirm_sec = (
        round(sum(confirm_secs) / len(confirm_secs)) if confirm_secs else 0
    )

    n_scans = scans.count()
    failed = scans.filter(status=ScanStatus.FAILED).count()
    cancelled = scans.filter(status=ScanStatus.CANCELLED).count()

    return {
        "period_days": days,
        "scans_total": n_scans,
        "scans_confirmed": confirmed.count(),
        "scans_failed": failed,
        "line_accuracy_pct": _pct(correct_lines, total_lines),
        "correction_rate_pct": _pct(corrected_lines, total_lines),
        "total_lines": total_lines,
        "avg_cost_per_scan_usd": str(
            (cost_agg["total"] / cost_agg["n"]).quantize(Decimal("0.00001"))
            if cost_agg["total"] and cost_agg["n"] else _ZERO
        ),
        "total_cost_usd": str(cost_agg["total"] or _ZERO),
        "avg_tokens_per_scan": round(cost_agg["avg_tokens"] or 0),
        "avg_time_to_confirm_sec": avg_confirm_sec,
        "manual_fallback_pct": _pct(failed + cancelled, n_scans),
        "match_breakdown": {
            row["match_status"]: row["n"]
            for row in lines.values("match_status").annotate(n=Count("id"))
        },
        "decision": _decision(
            _pct(correct_lines, total_lines), total_lines
        ),
        "cost_limit": _cost_limit_status(),
    }


def _decision(line_accuracy: float, total_lines: int) -> str:
    """CLAUDE.md 9: line_accuracy < 85% → OCR foyda bermayapti."""
    if total_lines < 20:
        return "INSUFFICIENT_DATA"  # 20 ta naklit kerak
    return "OCR_WORKING" if line_accuracy >= 85 else "PREFER_MANUAL"


def _cost_limit_status() -> dict:
    from django.conf import settings

    from .scan import cost_used

    return {
        "daily_used_usd": str(cost_used(days=1)),
        "daily_limit_usd": str(settings.OCR_DAILY_COST_LIMIT_USD),
        "monthly_used_usd": str(cost_used(days=30)),
        "monthly_limit_usd": str(settings.OCR_MONTHLY_COST_LIMIT_USD),
    }
