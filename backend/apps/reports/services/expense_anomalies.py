"""Xarajat anomaliyalari — z-score (v5: C5).

Har xarajat o'z kategoriyasidagi boshqa xarajatlar bilan solishtiriladi
(davr + oldingi 90 kun, xarajatning o'zi hisobga olinmaydi — leave-one-out):
  z = (summa − o'rtacha) / standart og'ish
z ≥ 2.5 bo'lsa — "e'tibor talab qiladi". Bu jarima emas, ko'rib chiqish uchun
signal (CLAUDE.md 8: nazorat emas, ko'zoynak). Rad etilgan xarajatlar hisobga olinmaydi.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import date as date_cls
from datetime import timedelta

from apps.expenses.models import DistributorExpense

from .aggregates import in_branch

Z_THRESHOLD = 2.5
MIN_SAMPLES = 5  # solishtirish uchun kamida shuncha boshqa xarajat kerak
BASELINE_DAYS = 90
MIN_STD_RATIO = 0.1  # standart og'ish kamida o'rtachaning 10%


def _stats_without(total: float, total_sq: float, n: int, x: float) -> tuple[float, float]:
    """x ni chiqarib tashlab o'rtacha va standart og'ish."""
    m = n - 1
    mean = (total - x) / m
    variance = max((total_sq - x * x) / m - mean * mean, 0.0)
    return mean, math.sqrt(variance)


def expense_anomalies(*, date_from: date_cls, date_to: date_cls, branch=None) -> dict:
    window = in_branch(
        DistributorExpense.objects.filter(
            date__gte=date_from - timedelta(days=BASELINE_DAYS), date__lte=date_to,
        ).exclude(status="REJECTED"),
        branch, "branch",
    ).select_related("category", "distributor")

    by_category: dict = defaultdict(list)
    for exp in window:
        by_category[exp.category_id].append(exp)

    rows = []
    for items in by_category.values():
        n = len(items)
        if n - 1 < MIN_SAMPLES:
            continue
        amounts = [float(e.amount) for e in items]
        total, total_sq = sum(amounts), sum(a * a for a in amounts)
        for exp, x in zip(items, amounts):
            if not date_from <= exp.date <= date_to:
                continue
            mean, std = _stats_without(total, total_sq, n, x)
            if mean <= 0:
                continue
            # bir xil summalar (std≈0) — kichik farq ham "anomaliya" bo'lmasin
            std = max(std, mean * MIN_STD_RATIO)
            z = (x - mean) / std
            if z < Z_THRESHOLD:
                continue
            rows.append({
                "id": str(exp.id), "date": exp.date.isoformat(),
                "distributor": exp.distributor.full_name,
                "category": exp.category.name, "amount": str(exp.amount),
                "typical": f"{mean:.2f}", "times_typical": round(x / mean, 1) if mean else None,
                "z_score": round(z, 2), "status": exp.status,
                "description": exp.description,
            })
    rows.sort(key=lambda r: -r["z_score"])
    return {
        "date_from": date_from.isoformat(), "date_to": date_to.isoformat(),
        "threshold": Z_THRESHOLD, "rows": rows,
    }
