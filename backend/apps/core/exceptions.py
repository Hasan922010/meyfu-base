"""Yagona javob formati va xatoliklarni qayta ishlash (CLAUDE.md 10).

    { "success": true,  "data": {...} }
    { "success": false, "error": { "code": "...", "message": "...", "details": {} } }
"""
from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class BusinessError(APIException):
    """Biznes qoidasi buzilganda (CLAUDE.md 7). Ayblovsiz, aniq matn."""

    status_code = status.HTTP_409_CONFLICT
    default_code = "BUSINESS_RULE_VIOLATION"
    default_detail = "Amalni bajarib bo'lmadi."

    def __init__(
        self,
        message: str | None = None,
        code: str | None = None,
        details: dict[str, Any] | None = None,
        status_code: int | None = None,
    ) -> None:
        self.code = code or self.default_code
        self.details = details or {}
        if status_code is not None:
            self.status_code = status_code
        super().__init__(message or self.default_detail, self.code)


class InsufficientStock(BusinessError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "INSUFFICIENT_STOCK"
    default_detail = "Qoldiq yetarli emas."


class DebtLimitExceeded(BusinessError):
    default_code = "DEBT_LIMIT_EXCEEDED"
    default_detail = "Mijoz qarz limitidan oshib ketdi."


class PriceBelowMinimum(BusinessError):
    default_code = "PRICE_BELOW_MINIMUM"
    default_detail = "Narx minimal narxdan past."


def _error_body(code: str, message: str, details: Any) -> dict[str, Any]:
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details if isinstance(details, (dict, list)) else {},
        },
    }


def api_exception_handler(exc: Exception, context: dict) -> Response | None:
    if isinstance(exc, DjangoValidationError):
        return Response(
            _error_body("VALIDATION_ERROR", "Ma'lumot noto'g'ri.",
                        {"messages": exc.messages}),
            status=status.HTTP_400_BAD_REQUEST,
        )

    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, BusinessError):
        return Response(
            _error_body(exc.code, str(exc.detail), getattr(exc, "details", {})),
            status=exc.status_code,
        )

    if isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
        # Auth klassi bo'lmagan view'larda DRF 403 qaytaradi — biz 401 ga keltiramiz
        response.status_code = status.HTTP_401_UNAUTHORIZED
        code = "NOT_AUTHENTICATED"
    elif isinstance(exc, Http404):
        code = "NOT_FOUND"
    elif isinstance(exc, PermissionDenied):
        code = "PERMISSION_DENIED"
    else:
        code = getattr(exc, "default_code", "ERROR")
        code = str(code).upper()

    data = response.data
    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        message = str(data["detail"])
        details: Any = {}
    else:
        message = "So'rovda xatolik bor."
        details = data

    response.data = _error_body(code, message, details)
    return response
