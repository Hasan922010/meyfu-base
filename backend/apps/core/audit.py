"""AuditLog yozish — kim, qachon, nima, eski → yangi, IP, qurilma (CLAUDE.md 5.3)."""
from __future__ import annotations

from typing import Any

from .models import AuditLog
from .net import client_ip


def diff_fields(instance, fields, new_values: dict) -> dict[str, list[str]]:
    """`{maydon: [eski, yangi]}` — faqat haqiqatda o'zgarganlar."""
    return {
        name: [str(getattr(instance, name)), str(new_values[name])]
        for name in fields
        if name in new_values and new_values[name] != getattr(instance, name)
    }


def write_audit(
    request, action: str, obj, changes: dict[str, Any] | None = None
) -> AuditLog:
    return AuditLog.objects.create(
        user=request.user if request.user.is_authenticated else None,
        action=action,
        model_name=f"{obj._meta.app_label}.{obj.__class__.__name__}",
        object_id=str(obj.pk),
        changes=changes or {},
        ip=client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
    )
