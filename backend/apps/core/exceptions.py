"""Yagona javob formati va xatoliklarni qayta ishlash (CLAUDE.md 10).

    { "success": true,  "data": {...} }
    { "success": false, "error": { "code": "...", "message": "...", "details": {} } }
"""
from __future__ import annotations

import re
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    Throttled,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

# CLAUDE.md 20 / 2-band: DRF va uchinchi tomon paketlarning (simplejwt) standart
# xabarlari inglizcha keladi, chunki ular Django'ning o'z "uz" katalogida yo'q
# (Django yadro validatorlari bilan bir xil matn tasodifan mos kelsagina
# gettext orqali avtomatik tarjima bo'ladi). Shu yerda qolganlarini o'zbekchaga
# o'giramiz — .po/.mo tuzish (gettext) shart bo'lmasin deb, lug'at + naqsh
# (pattern) asosida.
_STATIC_MESSAGES: dict[str, str] = {
    "This field may not be blank.": "Bu maydon bo'sh bo'lishi mumkin emas.",
    "This field may not be null.": "Bu maydon bo'sh (null) bo'lishi mumkin emas.",
    "Not a valid string.": "Yaroqli matn emas.",
    "Must be a valid UUID.": "UUID formatida bo'lishi kerak.",
    "Must be a valid boolean.": "Mantiqiy (ha/yo'q) qiymat bo'lishi kerak.",
    "A valid integer is required.": "Butun son kiritilishi kerak.",
    "A valid number is required.": "Raqam kiritilishi kerak.",
    "This field must be unique.": "Bu qiymat band — noyob bo'lishi kerak.",
    "Invalid value.": "Noto'g'ri qiymat.",
    "Enter a valid URL.": "To'g'ri URL manzil kiriting.",
    "This value does not match the required pattern.": (
        "Qiymat talab qilingan namunaga mos kelmadi."
    ),
    "String value too large.": "Matn juda uzun.",
    "Value must be valid JSON.": "Qiymat yaroqli JSON bo'lishi kerak.",
    "No file was submitted.": "Fayl yuborilmadi.",
    "The submitted data was not a file. Check the encoding type on the form.": (
        "Yuborilgan ma'lumot fayl emas. Forma kodlash turini tekshiring."
    ),
    "No active account found with the given credentials": (
        "Bunday login/parolga ega faol hisob topilmadi."
    ),
    "Token is invalid or expired": "Token yaroqsiz yoki muddati tugagan.",
    "Token is blacklisted": "Token bekor qilingan (qora ro'yxatda).",
    "Given token not valid for any token type": (
        "Berilgan token hech qanday token turi uchun yaroqli emas."
    ),
    "User not found": "Foydalanuvchi topilmadi.",
    "User is inactive": "Foydalanuvchi faol emas.",
    "Authentication credentials were not provided.": (
        "Tizimga kirish ma'lumotlari yuborilmadi."
    ),
    "Method \"{method}\" not allowed.": "«{method}» metodi ruxsat etilmagan.",
    # Audit K3: rol ruxsat bermagan amal — ayblovsiz, keyingi qadam bilan
    "You do not have permission to perform this action.": (
        "Bu amal sizning rolingiz uchun yopiq. Kerak bo'lsa, administratorga murojaat qiling."
    ),
    "Not found.": "Topilmadi.",
}

_PATTERN_MESSAGES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r'^"(.*)" is not a valid choice\.$'), '"{0}" — yaroqli tanlov emas.'),
    (
        re.compile(r'^Invalid pk "(.*)" - object does not exist\.$'),
        'ID "{0}" bo\'yicha obyekt topilmadi.',
    ),
    (
        re.compile(r'^Incorrect type\. Expected pk value, received (.+)\.$'),
        "Noto'g'ri tur. ID qiymati kutilgan edi, {0} qabul qilindi.",
    ),
    (
        re.compile(r'^Ensure this field has no more than (\d+) characters?\.$'),
        "Bu maydon {0} ta belgidan oshmasligi kerak.",
    ),
    (
        re.compile(r'^Ensure this field has at least (\d+) characters?\.$'),
        "Bu maydon kamida {0} ta belgidan iborat bo'lishi kerak.",
    ),
    (
        re.compile(r'^Ensure this value is less than or equal to (.+)\.$'),
        "Bu qiymat {0} dan katta bo'lmasligi kerak.",
    ),
    (
        re.compile(r'^Ensure this value is greater than or equal to (.+)\.$'),
        "Bu qiymat {0} dan kichik bo'lmasligi kerak.",
    ),
    (
        re.compile(r'^Ensure that there are no more than (\d+) digits in total\.$'),
        "Jami {0} ta xonadan oshmasligi kerak.",
    ),
    (
        re.compile(r'^Ensure that there are no more than (\d+) decimal places\.$'),
        "Kasr qismi {0} ta xonadan oshmasligi kerak.",
    ),
    (
        re.compile(
            r'^Ensure that there are no more than (\d+) digits before the decimal point\.$'
        ),
        "Butun qism {0} ta xonadan oshmasligi kerak.",
    ),
    (
        re.compile(r'^This password is too short\. It must contain at least (\d+) character'),
        "Parol juda qisqa. Kamida {0} ta belgidan iborat bo'lishi kerak.",
    ),
    (re.compile(r'^Date has wrong format\.'), "Sana formati noto'g'ri."),
    (re.compile(r'^Datetime has wrong format\.'), "Sana/vaqt formati noto'g'ri."),
    (re.compile(r'^Time has wrong format\.'), "Vaqt formati noto'g'ri."),
)


def _translate_message(message: str) -> str:
    translated = _STATIC_MESSAGES.get(message)
    if translated is not None:
        return translated
    for pattern, template in _PATTERN_MESSAGES:
        match = pattern.match(message)
        if match:
            return template.format(*match.groups())
    return message


def _translate_tree(data: Any) -> Any:
    if isinstance(data, dict):
        return {key: _translate_tree(value) for key, value in data.items()}
    if isinstance(data, list):
        return [_translate_tree(value) for value in data]
    if isinstance(data, str):
        return _translate_message(data)
    return data


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
                        {"messages": _translate_tree(exc.messages)}),
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
    elif isinstance(exc, Throttled):
        # DRF standart xabari inglizcha — CLAUDE.md 20: o'zbekcha, aniq, ayblovsiz
        wait = int(exc.wait) if exc.wait is not None else None
        message = (
            f"Juda ko'p urinish. {wait} soniyadan so'ng qayta urinib ko'ring."
            if wait is not None
            else "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring."
        )
        response.data = _error_body("THROTTLED", message, {})
        return response
    elif isinstance(exc, Http404):
        code = "NOT_FOUND"
    elif isinstance(exc, PermissionDenied):
        code = "PERMISSION_DENIED"
    else:
        code = getattr(exc, "default_code", "ERROR")
        code = str(code).upper()

    data = response.data
    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        message = _translate_message(str(data["detail"]))
        details: Any = {}
    else:
        message = "So'rovda xatolik bor."
        details = _translate_tree(data)

    response.data = _error_body(code, message, details)
    return response
