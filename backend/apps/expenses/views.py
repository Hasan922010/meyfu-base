from __future__ import annotations

from decimal import Decimal

from django.db.models import QuerySet, Sum
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.response import ok
from apps.core.viewsets import BaseModelViewSet
from apps.users.constants import Role

from .constants import ExpenseStatus
from .models import DistributorExpense, ExpenseCategory
from .serializers import (
    DistributorExpenseSerializer,
    ExpenseCategorySerializer,
    ExpenseCreateSerializer,
    ExpenseRejectSerializer,
)
from .services import approve_expense, create_expense, reject_expense

_ADMIN = (Role.MANAGER, Role.SUPER_ADMIN)
_READ = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.DISTRIBUTOR)
_ZERO = Decimal("0")


def _is_distributor(user) -> bool:
    return getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser


class ExpenseCategoryViewSet(BaseModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    write_roles = _ADMIN
    read_roles = _READ
    search_fields = ("name",)


class DistributorExpenseViewSet(BaseModelViewSet):
    serializer_class = DistributorExpenseSerializer
    http_method_names = ["get", "post", "head", "options"]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    read_roles = _READ
    write_roles = (Role.DISTRIBUTOR,)
    action_roles = {
        "approve": _ADMIN,
        "reject": _ADMIN,
        "summary": _READ,
        "my": _READ,
        "my_today": _READ,
    }
    filterset_fields = ("distributor", "category", "status", "payment_source", "date")
    search_fields = ("description", "category__name")
    ordering_fields = ("date", "created_at", "amount")

    def get_queryset(self) -> QuerySet[DistributorExpense]:
        qs = DistributorExpense.objects.select_related(
            "distributor", "category", "approved_by"
        )
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs

    @extend_schema(request=ExpenseCreateSerializer,
                   responses=DistributorExpenseSerializer)
    def create(self, request: Request, *args, **kwargs) -> Response:
        s = ExpenseCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        category = ExpenseCategory.objects.get(pk=data["category"])
        result = create_expense(
            distributor=request.user,
            category=category,
            amount=data["amount"],
            payment_source=data["payment_source"],
            date=data.get("date"),
            description=data.get("description", ""),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            receipt_image=data.get("receipt_image"),
            fuel=data.get("fuel"),
            client_uuid=str(data["client_uuid"]) if data.get("client_uuid") else None,
            device_time=data.get("device_time"),
        )
        code = 200 if result.duplicate else 201
        body = DistributorExpenseSerializer(result.expense).data
        body["over_limit"] = result.over_limit
        return ok(body, status_code=code)

    @extend_schema(summary="Xarajatni tasdiqlash", request=None)
    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk: str | None = None) -> Response:
        expense = approve_expense(self.get_object(), user=request.user)
        return ok(DistributorExpenseSerializer(expense).data)

    @extend_schema(summary="Xarajatni rad etish", request=ExpenseRejectSerializer)
    @action(detail=True, methods=["post"])
    def reject(self, request: Request, pk: str | None = None) -> Response:
        s = ExpenseRejectSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        expense = reject_expense(
            self.get_object(), user=request.user,
            reason=s.validated_data["reason"],
        )
        return ok(DistributorExpenseSerializer(expense).data)

    @extend_schema(summary="Mening xarajatlarim (bugungi)")
    @action(detail=False, methods=["get"], url_path="my-today")
    def my_today(self, request: Request) -> Response:
        today = timezone.localdate()
        qs = self.get_queryset().filter(distributor=request.user, date=today)
        return ok(DistributorExpenseSerializer(qs, many=True).data)

    @extend_schema(summary="Xarajatlar xulosasi (kategoriya bo'yicha)")
    @action(detail=False, methods=["get"])
    def summary(self, request: Request) -> Response:
        qs = self.get_queryset().exclude(status=ExpenseStatus.REJECTED)
        by_cat = list(
            qs.values("category__name")
            .annotate(total=Sum("amount"))
            .order_by("-total")
        )
        total = qs.aggregate(s=Sum("amount"))["s"] or _ZERO
        pending = qs.filter(status=ExpenseStatus.PENDING).count()
        return ok({
            "total": str(total),
            "pending_count": pending,
            "by_category": [
                {"category": r["category__name"], "total": str(r["total"])}
                for r in by_cat
            ],
        })
