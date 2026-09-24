from __future__ import annotations

from django.contrib.auth import get_user_model
from django.conf import settings
from django.db.models import QuerySet
from django.utils import timezone
from datetime import timedelta
import hashlib
import secrets
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import AuditLog
from apps.core.response import ok
from apps.core.viewsets import BaseModelViewSet
from apps.users.constants import Role

from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UserSerializer,
    UserWriteSerializer,
)
from .models import WebSocketTicket
from .services import password_reset

User = get_user_model()

_RESET_REQUESTED = (
    "Agar raqam Telegram'ga bog'langan bo'lsa, kod yuborildi. "
    "Kod kelmasa — administratorga murojaat qiling."
)


class LoginView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"
    serializer_class = LoginSerializer

    @extend_schema(summary="Kirish (telefon + parol) → JWT")
    def post(self, request: Request) -> Response:
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.validated_data
        user = serializer.user
        User = user.__class__
        User.objects.filter(pk=user.pk).update(last_seen_at=timezone.now())
        return Response(result, status=status.HTTP_200_OK)


class RefreshView(TokenRefreshView):
    """Access tokenni yangilash (refresh rotation yoqilgan)."""

    permission_classes = [AllowAny]


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Chiqish",
        request={"type": "object", "properties": {"refresh": {"type": "string"}}},
        responses={200: dict},
    )
    def post(self, request: Request) -> Response:
        refresh = request.data.get("refresh")
        if refresh:
            try:
                RefreshToken(str(refresh)).blacklist()
            except (TokenError, ValueError, TypeError):
                # Logout is idempotent: an expired/already-revoked token still
                # means the client should clear its local session.
                pass
        return ok({"detail": "Tizimdan chiqildi."})


class WebSocketTicketView(APIView):
    """Issue a short-lived, one-time credential for the event WebSocket."""

    permission_classes = [IsAuthenticated]

    @extend_schema(summary="WebSocket ticket", request=None, responses={200: dict})
    def post(self, request: Request) -> Response:
        raw_ticket = secrets.token_urlsafe(32)
        WebSocketTicket.objects.create(
            user=request.user,
            token_hash=hashlib.sha256(raw_ticket.encode()).hexdigest(),
            expires_at=timezone.now()
            + timedelta(seconds=settings.WS_TICKET_TTL_SECONDS),
        )
        return ok({"ticket": raw_ticket, "expires_in": settings.WS_TICKET_TTL_SECONDS})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Joriy foydalanuvchi", request=None, responses={200: UserSerializer}
    )
    def get(self, request: Request) -> Response:
        return ok(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    @extend_schema(
        summary="Parolni o'zgartirish",
        request=ChangePasswordSerializer,
        responses={200: dict},
    )
    def post(self, request: Request) -> Response:
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return ok({"detail": "Parol yangilandi."})


class PasswordResetRequestView(APIView):
    """Telegram'ga bog'langan xodimga tiklash kodini yuboradi.

    Javob har doim bir xil — raqam tizimda bor-yo'qligi oshkor qilinmaydi.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(
        summary="Parolni tiklash — kod so'rash",
        request=PasswordResetRequestSerializer,
        responses={200: dict},
    )
    def post(self, request: Request) -> Response:
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password_reset.request_code(serializer.validated_data["phone"])
        return ok({"detail": _RESET_REQUESTED})


class PasswordResetConfirmView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(
        summary="Parolni tiklash — kod va yangi parol",
        request=PasswordResetConfirmSerializer,
        responses={200: dict},
    )
    def post(self, request: Request) -> Response:
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        changed = password_reset.confirm_code(
            data["phone"], data["code"], data["new_password"],
            ip=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
        if not changed:
            raise ValidationError(
                {"code": ["Kod noto'g'ri yoki muddati o'tgan. Yangi kod so'rang."]}
            )
        return ok({"detail": "Parol yangilandi. Yangi parol bilan kiring."})


class UserViewSet(BaseModelViewSet):
    """Xodimlar boshqaruvi (CLAUDE.md 2, 5, 6).

    O'qish — MANAGER/ADMIN/ACCOUNTANT (marshrutga tarqatuvchi biriktirish uchun).
    Yaratish/tahrirlash/bloklash/o'chirish — faqat SUPER_ADMIN.
    O'chirish — yumshoq (`is_deleted=True`, `BaseModel.delete()`), tarix
    (sotuv, hamyon, maosh yozuvlari) saqlanadi — bloklash (`toggle_active`)
    vaqtinchalik, o'chirish esa xodimni ro'yxatdan butunlay olib tashlaydi.
    """

    queryset = (
        User.objects.select_related("distributor_profile").order_by("full_name")
    )
    read_roles = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)
    write_roles = (Role.SUPER_ADMIN,)
    filterset_fields = ("role", "is_active")
    search_fields = ("full_name", "phone")
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return UserWriteSerializer
        return UserSerializer

    def perform_create(self, serializer) -> None:
        user = serializer.save()
        self._audit("user.create", user, {"role": user.role, "phone": user.phone})

    def perform_update(self, serializer) -> None:
        before = {
            "role": serializer.instance.role,
            "is_active": serializer.instance.is_active,
        }
        user = serializer.save()
        after = {"role": user.role, "is_active": user.is_active}
        if before != after:
            self._audit("user.update", user, {"before": before, "after": after})

    @extend_schema(summary="Xodimni bloklash / blokdan chiqarish", request=None,
                   responses={200: UserSerializer})
    @action(detail=True, methods=["post"])
    def toggle_active(self, request: Request, pk: str | None = None) -> Response:
        user = self.get_object()
        if user == request.user:
            raise ValidationError("O'zingizni bloklay olmaysiz.")
        user.is_active = not user.is_active
        user.save(update_fields=["is_active", "updated_at"])
        self._audit(
            "user.block" if not user.is_active else "user.unblock", user,
            {"is_active": user.is_active},
        )
        return ok(UserSerializer(user).data)

    def get_queryset(self) -> QuerySet:
        return super().get_queryset().filter(is_deleted=False)

    def perform_destroy(self, instance) -> None:
        if instance == self.request.user:
            raise ValidationError("O'zingizni o'chira olmaysiz.")
        # Qattiq o'chirish emas — FK'lar PROTECT (masalan Payroll.distributor),
        # va tarix saqlanishi kerak (CLAUDE.md 5). Login ham to'xtaydi
        # (is_active=False).
        instance.is_deleted = True
        instance.is_active = False
        instance.save(update_fields=["is_deleted", "is_active", "updated_at"])
        self._audit("user.delete", instance, {"role": instance.role})

    def _audit(self, action_name: str, user, changes: dict) -> None:
        AuditLog.objects.create(
            user=self.request.user, action=action_name, model_name="User",
            object_id=str(user.id), changes=changes,
            ip=self.request.META.get("REMOTE_ADDR"),
            user_agent=self.request.META.get("HTTP_USER_AGENT", "")[:255],
        )
