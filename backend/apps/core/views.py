"""/health/ va tizim salomatligi endpointlari (CLAUDE.md 16, 15)."""
from __future__ import annotations

import hmac

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.core.models import AuditLog, CompanySettings
from apps.core.permissions import RolePermission
from apps.core.response import ok
from apps.core.serializers import (
    CompanyPublicSerializer,
    CompanySettingsSerializer,
)
from apps.core.services.integrity import apply_integrity_fix, run_integrity_check
from apps.core.services.system_status import health_checks, system_status
from apps.users.constants import Role

_ADMIN_ROLES = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)


class HealthView(APIView):
    """Ochiq monitoring endpointi.

    Anonim so'rov faqat `{"success": bool}` oladi (audit SEC-005 — infra
    tafsilotlarini oshkor qilmaslik). To'liq tafsilot (db/redis/celery/disk)
    faqat autentifikatsiyalangan foydalanuvchiga yoki `X-Health-Token` bilan.
    `?deep=1` — celery ishchisini ham tekshiradi.
    """

    # JWT'ni tekshiradi (ixtiyoriy) — auth bo'lsa to'liq tafsilot, aks holda minimal
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Tizim salomatligi (db, redis, disk, celery)",
        parameters=[OpenApiParameter("deep", bool, required=False)],
        request=None,
        responses={200: dict, 503: dict},
    )
    def get(self, request: Request) -> Response:
        from django.conf import settings

        deep = request.query_params.get("deep") in ("1", "true", "yes")
        token = settings.HEALTH_DETAIL_TOKEN
        is_admin = bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_staff
                or request.user.is_superuser
                or getattr(request.user, "role", None) in _ADMIN_ROLES
            )
        )
        detailed = bool(
            is_admin
            or (
                token
                and hmac.compare_digest(
                    str(request.headers.get("X-Health-Token", "")), str(token)
                )
            )
        )
        if deep and not detailed:
            return Response(
                {"success": False, "error": {"code": "HEALTH_DETAIL_FORBIDDEN"}},
                status=403,
            )
        data = health_checks(deep=deep)
        status_code = 200 if data["healthy"] else 503
        body = {"success": data["healthy"]}
        if detailed:
            body["data"] = data
        return Response(body, status=status_code)


class SystemStatusView(APIView):
    """Admin tizim salomatligi paneli — hamma narsa bir joyda (CLAUDE.md 13 #16)."""

    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _ADMIN_ROLES

    @extend_schema(
        summary="Tizim holati — salomatlik, butunlik, backup, sinxronizatsiya, OCR",
        request=None, responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        # ?deep=0 — tezkor javob (celery ping'siz), audit m8
        deep = request.query_params.get("deep") != "0"
        return ok(system_status(deep=deep))


class IntegrityCheckView(APIView):
    """Butunlik tekshiruvini qo'lda ishga tushirish (CLAUDE.md 5.2)."""

    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _ADMIN_ROLES
    write_roles = (Role.SUPER_ADMIN,)

    @extend_schema(
        summary="Butunlik tekshiruvi (balans == jurnal)",
        request=None, responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        return ok(run_integrity_check())

    @extend_schema(
        summary="Butunlik farqlarini tuzatish (denormalized qiymatni jurnalga moslash)",
        description="Faqat SUPER_ADMIN. Jurnal (append-only) tegilmaydi.",
        request=None, responses={200: dict},
    )
    def post(self, request: Request) -> Response:
        from apps.core.models import AuditLog

        result = run_integrity_check()
        for mismatch in result["mismatches"]:
            apply_integrity_fix(mismatch)
        AuditLog.objects.create(
            user=request.user,
            action="integrity.fix",
            changes={"fixed": result["mismatches"]},
            ip=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
        )
        return ok({"fixed_count": result["mismatch_count"], **run_integrity_check()})


class CompanySettingsView(APIView):
    """Kompaniya rekvizitlari va muhri (v4 T3). O'zgartirish — faqat SUPER_ADMIN."""

    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _ADMIN_ROLES
    write_roles = (Role.SUPER_ADMIN,)
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(summary="Kompaniya rekvizitlari", request=None,
                   responses=CompanySettingsSerializer)
    def get(self, request: Request) -> Response:
        obj = CompanySettings.load()
        return ok(CompanySettingsSerializer(obj, context={"request": request}).data)

    @extend_schema(summary="Kompaniya rekvizitlarini yangilash",
                   request=CompanySettingsSerializer,
                   responses=CompanySettingsSerializer)
    def patch(self, request: Request) -> Response:
        obj = CompanySettings.load()
        before = CompanySettingsSerializer(obj).data
        serializer = CompanySettingsSerializer(
            obj, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        AuditLog.objects.create(
            user=request.user, action="company_settings.updated",
            model_name="CompanySettings", object_id=str(obj.id),
            changes={"fields": list(serializer.validated_data.keys()),
                     "before": before},
            ip=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
        )
        return ok(CompanySettingsSerializer(obj, context={"request": request}).data)


class CompanyPublicView(APIView):
    """Mobil offline kesh uchun rekvizitlar + muhr (base64). Har autentifikatsiyalangan
    foydalanuvchi o'qiy oladi (chek PDF'ida ishlatiladi — v4 T4)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Kompaniya rekvizitlari (mobil kesh)", request=None,
                   responses=CompanyPublicSerializer)
    def get(self, request: Request) -> Response:
        obj = CompanySettings.load()
        return ok(CompanyPublicSerializer(obj).data)
