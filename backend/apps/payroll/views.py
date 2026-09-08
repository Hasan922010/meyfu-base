from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.permissions import RolePermission
from apps.core.response import ok
from apps.core.viewsets import BaseModelViewSet, EnvelopeResponseMixin
from apps.users.constants import Role

from .models import Advance, CommissionRule, Payroll
from .serializers import (
    AdvanceCreateSerializer,
    AdvanceSerializer,
    CommissionRuleSerializer,
    PayrollCalculateSerializer,
    PayrollManualSerializer,
    PayrollSerializer,
    PayrollWithDetailsSerializer,
)
from .services import (
    approve_payroll,
    calculate_payroll,
    create_advance,
    pay_payroll,
    set_manual_fields,
)

User = get_user_model()

_PAYROLL_ADMIN = (Role.SUPER_ADMIN, Role.ACCOUNTANT)
_PAYROLL_READ = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)


def _is_distributor(user) -> bool:
    return getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser


class CommissionRuleViewSet(BaseModelViewSet):
    """Komissiya qoidalari. Foiz o'zgartirish — faqat SUPER_ADMIN (CLAUDE.md 2)."""

    queryset = CommissionRule.objects.all()
    serializer_class = CommissionRuleSerializer
    read_roles = _PAYROLL_READ
    write_roles = (Role.SUPER_ADMIN,)
    filterset_fields = ("scope", "is_active", "target_id")
    ordering_fields = ("priority", "valid_from", "created_at")


class AdvanceViewSet(
    EnvelopeResponseMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdvanceSerializer
    queryset = Advance.objects.select_related("distributor")
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = (*_PAYROLL_READ, Role.DISTRIBUTOR)
    action_roles = {"create": _PAYROLL_ADMIN}
    filterset_fields = ("distributor", "date", "payroll")
    ordering = ("-date", "-created_at")

    def get_queryset(self) -> QuerySet[Advance]:
        qs = super().get_queryset()
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs

    @extend_schema(request=AdvanceCreateSerializer, responses=AdvanceSerializer)
    def create(self, request: Request, *args, **kwargs) -> Response:
        s = AdvanceCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        distributor = User.objects.get(pk=data["distributor"])
        advance = create_advance(
            distributor=distributor,
            amount=data["amount"],
            date=data.get("date"),
            note=data.get("note", ""),
            user=request.user,
        )
        return ok(AdvanceSerializer(advance).data, status_code=201)


class PayrollViewSet(
    EnvelopeResponseMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PayrollSerializer
    queryset = Payroll.objects.select_related("distributor", "approved_by")
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _PAYROLL_READ
    action_roles = {
        "calculate": _PAYROLL_ADMIN,
        "edit": _PAYROLL_ADMIN,
        "approve": (Role.SUPER_ADMIN,),
        "pay": _PAYROLL_ADMIN,
        "my": (Role.DISTRIBUTOR,),
    }
    filterset_fields = ("distributor", "status", "period")
    ordering = ("-period",)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PayrollWithDetailsSerializer
        return PayrollSerializer

    @extend_schema(
        summary="Maoshni hisoblash (qayta hisoblash — DRAFT bo'lsa)",
        request=PayrollCalculateSerializer,
        responses=PayrollWithDetailsSerializer,
    )
    @action(detail=False, methods=["post"])
    def calculate(self, request: Request) -> Response:
        s = PayrollCalculateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        distributor = User.objects.get(pk=s.validated_data["distributor"])
        payroll = calculate_payroll(
            distributor=distributor,
            period=s.validated_data["period"],
            user=request.user,
        )
        return ok(PayrollWithDetailsSerializer(payroll).data)

    @extend_schema(summary="Qo'lda tuzatish (bonus, ushlanma, izoh)",
                   request=PayrollManualSerializer,
                   responses=PayrollWithDetailsSerializer)
    @action(detail=True, methods=["post"])
    def edit(self, request: Request, pk: str | None = None) -> Response:
        s = PayrollManualSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        payroll = set_manual_fields(
            self.get_object(), user=request.user, **s.validated_data
        )
        return ok(PayrollWithDetailsSerializer(payroll).data)

    @extend_schema(summary="Maoshni tasdiqlash", request=None,
                   responses=PayrollSerializer)
    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk: str | None = None) -> Response:
        payroll = approve_payroll(self.get_object(), user=request.user)
        return ok(PayrollSerializer(payroll).data)

    @extend_schema(summary="Maoshni to'langan deb belgilash", request=None,
                   responses=PayrollSerializer)
    @action(detail=True, methods=["post"])
    def pay(self, request: Request, pk: str | None = None) -> Response:
        payroll = pay_payroll(self.get_object(), user=request.user)
        return ok(PayrollSerializer(payroll).data)

    @extend_schema(summary="Mening maoshlarim (tarqatuvchi)", request=None,
                   responses=PayrollSerializer(many=True))
    @action(detail=False, methods=["get"])
    def my(self, request: Request) -> Response:
        # DRAFT ham ko'rsatiladi — xodim o'z (taxminiy) maoshini ochiq ko'rsin
        # (CLAUDE.md 8). Frontend uni "tasdiqlanmagan" deb belgilaydi.
        qs = (
            Payroll.objects.filter(distributor=request.user)
            .order_by("-period")
        )
        return ok(PayrollSerializer(qs, many=True).data)
