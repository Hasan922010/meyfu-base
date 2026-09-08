from __future__ import annotations

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

from .constants import CashTxType
from .models import CashTransaction, CompanyExpense
from .serializers import (
    CashAccountSerializer,
    CashTransactionCreateSerializer,
    CashTransactionSerializer,
    CompanyExpenseSerializer,
)
from .services import cash_apply, create_company_expense, get_account

_FINANCE = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)


class CashTransactionViewSet(
    EnvelopeResponseMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CashTransactionSerializer
    queryset = CashTransaction.objects.select_related("account")
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _FINANCE
    write_roles = (Role.SUPER_ADMIN, Role.ACCOUNTANT)
    filterset_fields = ("transaction_type", "date")
    ordering = ("-created_at",)

    @extend_schema(summary="Kassa balansi")
    @action(detail=False, methods=["get"])
    def account(self, request: Request) -> Response:
        return ok(CashAccountSerializer(get_account()).data)

    @extend_schema(request=CashTransactionCreateSerializer,
                   responses=CashTransactionSerializer)
    def create(self, request: Request, *args, **kwargs) -> Response:
        s = CashTransactionCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        tx_type = data["transaction_type"]
        signed = (
            data["amount"] if tx_type in {CashTxType.OTHER_IN}
            else -data["amount"]
        )
        tx = cash_apply(
            transaction_type=tx_type,
            amount=signed,
            date=data.get("date"),
            counterparty=data.get("counterparty", ""),
            reference_type="manual",
            note=data.get("note", ""),
            user=request.user,
        )
        return ok(CashTransactionSerializer(tx).data, status_code=201)


class CompanyExpenseViewSet(BaseModelViewSet):
    serializer_class = CompanyExpenseSerializer
    queryset = CompanyExpense.objects.select_related("cash_transaction")
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    read_roles = _FINANCE
    write_roles = (Role.SUPER_ADMIN, Role.ACCOUNTANT)
    filterset_fields = ("category", "date", "paid_from_cash")
    search_fields = ("description",)
    ordering_fields = ("date", "amount", "created_at")

    def get_queryset(self) -> QuerySet[CompanyExpense]:
        return super().get_queryset()

    @extend_schema(request=CompanyExpenseSerializer,
                   responses=CompanyExpenseSerializer)
    def create(self, request: Request, *args, **kwargs) -> Response:
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        expense = create_company_expense(
            category=d["category"],
            amount=d["amount"],
            date=d.get("date"),
            description=d.get("description", ""),
            paid_from_cash=d.get("paid_from_cash", True),
            receipt_image=d.get("receipt_image"),
            user=request.user,
        )
        return ok(CompanyExpenseSerializer(expense).data, status_code=201)
