"""/health/ va tizim salomatligi endpointlari (CLAUDE.md 16, 15)."""
from __future__ import annotations

import hmac

from django.core import signing
from django.db import DatabaseError
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.core.cleanup_admin import SALT as CLEANUP_SALT
from apps.core.exceptions import BusinessError
from apps.core.models import AuditLog, CompanySettings
from apps.core.net import client_ip
from apps.core.permissions import IsCentralStaff, RolePermission
from apps.core.response import ok
from apps.core.serializers import (
    CompanyPublicSerializer,
    CompanySettingsSerializer,
    SystemSettingsSerializer,
    TestCleanupExecuteSerializer,
    TestCleanupPreviewSerializer,
)
from apps.core.services.integrity import apply_integrity_fix, run_integrity_check
from apps.core.services.system_status import health_checks, system_status
from apps.core.services.test_cleanup import (
    SETTING_ALLOW_TEST_CLEANUP,
    CleanupBlocked,
    build_plan,
    execute_cleanup,
    format_plan_effects,
    is_test_cleanup_enabled,
    list_cleanup_entries,
    set_test_cleanup_enabled,
)
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

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
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

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
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
            ip=client_ip(request),
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
            ip=client_ip(request),
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


class SystemSettingsView(APIView):
    """Tizim sozlamalari — soxta operatsiyalarni tozalashga ruxsat berish/o'chirish."""

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
    read_roles = _ADMIN_ROLES
    write_roles = (Role.SUPER_ADMIN,)

    @extend_schema(
        summary="Tizim xavfsizlik sozlamalari",
        request=None,
        responses={200: SystemSettingsSerializer},
    )
    def get(self, request: Request) -> Response:
        return ok({"allow_test_cleanup": is_test_cleanup_enabled()})

    @extend_schema(
        summary="Tizim xavfsizlik sozlamalarini yangilash (SUPER_ADMIN)",
        request=SystemSettingsSerializer,
        responses={200: SystemSettingsSerializer},
    )
    def patch(self, request: Request) -> Response:
        s = SystemSettingsSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        before = is_test_cleanup_enabled()
        after = set_test_cleanup_enabled(
            s.validated_data["allow_test_cleanup"], user=request.user
        )
        AuditLog.objects.create(
            user=request.user,
            action="system_settings.updated",
            model_name="Setting",
            object_id=SETTING_ALLOW_TEST_CLEANUP,
            changes={"allow_test_cleanup": {"before": before, "after": after}},
            ip=client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
        )
        return ok({"allow_test_cleanup": after})


class TestCleanupEntriesView(APIView):
    """Soxta operatsiyalarni tozalash uchun jurnal yozuvlari ro'yxati (SUPER_ADMIN)."""

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
    read_roles = (Role.SUPER_ADMIN,)

    @extend_schema(
        summary="Tanlangan jurnal bo'yicha oxirgi operatsiyalar",
        parameters=[
            OpenApiParameter("ledger", str, required=True),
            OpenApiParameter("limit", int, required=False),
        ],
        request=None,
        responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        ledger = request.query_params.get("ledger", "finance.cashtransaction")
        try:
            limit = int(request.query_params.get("limit", 50))
        except (TypeError, ValueError):
            limit = 50
        try:
            entries = list_cleanup_entries(ledger, limit=limit)
        except CleanupBlocked as exc:
            raise BusinessError(
                message=str(exc), code="CLEANUP_BLOCKED", status_code=400
            ) from exc
        return ok({
            "ledger": ledger,
            "allow_test_cleanup": is_test_cleanup_enabled(),
            "entries": entries,
        })


class TestCleanupPreviewView(APIView):
    """Tanlangan soxta operatsiyalarni tozalash rejasini tekshirish (preview)."""

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
    write_roles = (Role.SUPER_ADMIN,)

    @extend_schema(
        summary="Soxta operatsiyalarni tozalash ta'sirini oldindan ko'rish",
        request=TestCleanupPreviewSerializer,
        responses={200: dict},
    )
    def post(self, request: Request) -> Response:
        s = TestCleanupPreviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ledger = s.validated_data["ledger"]
        ids = sorted({str(pk) for pk in s.validated_data["ids"]})
        try:
            plan = build_plan(ledger, ids, user=request.user)
        except CleanupBlocked as exc:
            raise BusinessError(
                message=str(exc), code="CLEANUP_BLOCKED", status_code=400
            ) from exc

        token = signing.dumps(
            {
                "user": str(request.user.pk),
                "model": ledger,
                "ids": ids,
                "digest": plan.digest,
            },
            salt=CLEANUP_SALT,
        )
        payload = plan.payload()
        return ok({
            "ledger": ledger,
            "selected_ids": ids,
            "rows": payload["rows"],
            "effects": format_plan_effects(plan),
            "digest": plan.digest,
            "cleanup_token": token,
        })


class TestCleanupExecuteView(APIView):
    """Tanlangan soxta operatsiyalarni tasdiqlab tozalash."""

    permission_classes = [IsAuthenticated, RolePermission, IsCentralStaff]
    write_roles = (Role.SUPER_ADMIN,)

    @extend_schema(
        summary="Soxta operatsiyalarni tasdiqlab tozalash (SUPER_ADMIN)",
        request=TestCleanupExecuteSerializer,
        responses={200: dict},
    )
    def post(self, request: Request) -> Response:
        s = TestCleanupExecuteSerializer(
            data=request.data, context={"request": request}
        )
        s.is_valid(raise_exception=True)
        data = s.validated_data
        ledger = data["ledger"]
        ids = sorted({str(pk) for pk in data["ids"]})
        try:
            try:
                signed = signing.loads(
                    data["cleanup_token"], salt=CLEANUP_SALT, max_age=600
                )
            except signing.BadSignature as exc:
                raise CleanupBlocked(
                    "Tasdiqlash muddati tugagan yoki ma’lumot noto‘g‘ri. Qayta tanlang."
                ) from exc

            if signed.get("user") != str(request.user.pk) or signed.get("model") != ledger:
                raise CleanupBlocked("Tasdiqlash tokeni joriy foydalanuvchi yoki jurnalga mos emas.")
            if signed.get("ids") != ids:
                raise CleanupBlocked("Tanlov o‘zgargan. Qayta tekshirib tasdiqlang.")

            count = execute_cleanup(
                ledger,
                ids,
                user=request.user,
                expected_digest=signed.get("digest", ""),
                reason=data["reason"],
            )
        except CleanupBlocked as exc:
            raise BusinessError(
                message=str(exc), code="CLEANUP_BLOCKED", status_code=400
            ) from exc
        except DatabaseError as exc:
            raise BusinessError(
                message=(
                    "Baza band yoki amal bajarilmadi. Hech narsa qisman tozalanmadi. "
                    "Boshqa qurilmalardagi ishlarni to‘xtatib, qayta urinib ko‘ring."
                ),
                code="DATABASE_BUSY",
                status_code=409,
            ) from exc

        return ok({
            "cleaned_count": count,
            "message": (
                f"{count} ta soxta/bog‘liq yozuv faol hisoblardan chiqarildi. "
                "Balanslar moslandi, audit nusxasi saqlandi."
            ),
        })
