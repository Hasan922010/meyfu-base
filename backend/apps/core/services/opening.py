"""Boshlang'ich qoldiqlar — ommaviy kiritishning umumiy qismi.

Foydalanuvchi yakuniy qoldiqni kiritadi, server `delta = target − current` ni
qulflangan joriy qiymatdan hisoblaydi. Shu sabab bir xil so'rovni qayta yuborish
ikkinchi marta hech narsa o'zgartirmaydi (idempotent).
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from rest_framework.exceptions import ValidationError

from ..models import AuditLog

_ZERO = Decimal("0")


def sheet_row(*, id: Any, name: str, current: Decimal, code: str = "") -> dict:
    return {"id": id, "name": name, "code": code or "", "current": str(current)}


def plan_deltas(rows: list[dict], current: dict) -> list[tuple[Any, Decimal]]:
    """`[(id, delta)]` — ro'yxatda yo'q yozuv bo'lsa, hech narsa yozilmaydi."""
    missing = [row for row in rows if row["id"] not in current]
    if missing:
        message = (
            f"{len(missing)} ta yozuv topilmadi yoki faol emas — ro'yxatni yangilang."
        )
        raise ValidationError({"rows": message})
    return [(row["id"], row["target"] - current[row["id"]]) for row in rows]


def audit_bulk(
    *, user, kind: str, note: str, changes: list[tuple[Any, Decimal]]
) -> None:
    """CLAUDE.md 5.3 — qoldiq tuzatish majburiy audit qilinadi."""
    applied = [(obj_id, delta) for obj_id, delta in changes if delta != _ZERO]
    if not applied:
        return
    AuditLog.objects.create(
        user=user, action=f"opening_balance.bulk.{kind}", model_name=kind,
        changes={
            "note": note,
            "rows": [
                {"id": str(obj_id), "delta": str(delta)} for obj_id, delta in applied
            ],
        },
    )


def bulk_result(changes: list[tuple[Any, Decimal]]) -> dict:
    applied = sum(1 for _obj_id, delta in changes if delta != _ZERO)
    return {"applied": applied, "skipped": len(changes) - applied}
