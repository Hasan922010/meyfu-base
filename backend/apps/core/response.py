"""Muvaffaqiyatli javob uchun yordamchi (CLAUDE.md 10)."""
from __future__ import annotations

from typing import Any

from rest_framework.response import Response


def ok(data: Any = None, status_code: int = 200) -> Response:
    return Response({"success": True, "data": data if data is not None else {}},
                    status=status_code)
