from __future__ import annotations

from django.contrib.auth import get_user_model
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

from apps.core.models import AuditLog
from apps.core.response import ok
from apps.core.viewsets import BaseModelViewSet
from apps.users.constants import Role

from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    UserSerializer,
    UserWriteSerializer,
)

User = get_user_model()


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

    @extend_schema(summary="Chiqish", request=None, responses={200: dict})
    def post(self, request: Request) -> Response:
        # SimpleJWT stateless — mijoz tokenni o'chiradi.
        return ok({"detail": "Tizimdan chiqildi."})


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


class UserViewSet(BaseModelViewSet):
    """Xodimlar boshqaruvi (CLAUDE.md 2, 6).

    O'qish — MANAGER/ADMIN/ACCOUNTANT (marshrutga tarqatuvchi biriktirish uchun).
    Yaratish/tahrirlash/bloklash — faqat SUPER_ADMIN.
    O'chirish yo'q — `is_active=False` (bloklash), tarix saqlanadi.
    """

    queryset = (
        User.objects.select_related("distributor_profile").order_by("full_name")
    )
    read_roles = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)
    write_roles = (Role.SUPER_ADMIN,)
    filterset_fields = ("role", "is_active")
    search_fields = ("full_name", "phone")
    http_method_names = ["get", "post", "patch", "head", "options"]

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

    def _audit(self, action_name: str, user, changes: dict) -> None:
        AuditLog.objects.create(
            user=self.request.user, action=action_name, model_name="User",
            object_id=str(user.id), changes=changes,
            ip=self.request.META.get("REMOTE_ADDR"),
            user_agent=self.request.META.get("HTTP_USER_AGENT", "")[:255],
        )
