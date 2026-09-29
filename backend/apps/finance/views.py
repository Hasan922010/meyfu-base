from __future__ import annotations

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.branch import acting_branch, user_branch
from apps.core.permissions import RolePermission
from apps.core.response import ok
from apps.core.serializers import OpeningBulkSerializer, OpeningSheetRowSerializer
from apps.core.viewsets import BaseModelViewSet, BranchScopedMixin, EnvelopeResponseMixin
from apps.users.constants import Role

from .constants import CashTxType
from .models import CashTransaction, CompanyExpense
from .serializers import (
    BranchCashTransferSerializer,
    CashAccountSerializer,
    CashOpeningBalanceSerializer,
    CashTransactionCreateSerializer,
    CashTransactionSerializer,
    CompanyExpenseSerializer,
)
from .services import cash_apply, create_company_expense, get_account
from .services.cash import transfer_to_center
from .services.opening import cash_opening_bulk, cash_opening_sheet

_FINANCE = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)


class CashTransactionViewSet(
    BranchScopedMixin,
    EnvelopeResponseMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CashTransactionSerializer
    queryset = CashTransaction.objects.select_related("account", "created_by")
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _FINANCE
    # Filial rahbari — faqat o'z filiali kassasiga (branch_lookup + create)
    write_roles = (Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.BRANCH_MANAGER)
    branch_lookup = "account__branch"
    # Filial rahbari — faqat o'z filiali kassasining boshlang'ich qoldig'i
    action_roles = {
        "opening_balance": (Role.SUPER_ADMIN, Role.BRANCH_MANAGER),
        "opening_sheet": (Role.SUPER_ADMIN, Role.BRANCH_MANAGER),
        "opening_balance_bulk": (Role.SUPER_ADMIN, Role.BRANCH_MANAGER),
    }
    filterset_fields = ("transaction_type", "date")
    ordering = ("-created_at",)

    @extend_schema(
        summary="Boshlang'ich qoldiq uchun kassalar ro'yxati (joriy balans bilan)",
        responses=OpeningSheetRowSerializer(many=True),
    )
    @action(detail=False, methods=["get"], url_path="opening-sheet")
    def opening_sheet(self, request: Request) -> Response:
        rows = cash_opening_sheet(branch=acting_branch(request.user))
        return ok(OpeningSheetRowSerializer(rows, many=True).data)

    @extend_schema(
        summary="Kassa balansini ro'yxatdan kiritish (yakuniy qiymat, ±)",
        request=OpeningBulkSerializer,
    )
    @action(detail=False, methods=["post"], url_path="opening-balance/bulk")
    def opening_balance_bulk(self, request: Request) -> Response:
        s = OpeningBulkSerializer(data=request.data, context={"decimal_places": 2})
        s.is_valid(raise_exception=True)
        return ok(cash_opening_bulk(
            rows=s.validated_data["rows"], note=s.validated_data["note"],
            user=request.user, branch=acting_branch(request.user),
        ))

    @extend_schema(
        summary="Filial kassasidan markazga pul topshirish (inkassatsiya)",
        request=BranchCashTransferSerializer, responses=CashTransactionSerializer,
    )
    @action(detail=False, methods=["post"], url_path="to-center")
    def to_center(self, request: Request) -> Response:
        s = BranchCashTransferSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        # Filial xodimi — faqat o'z filialidan; markaz — tanlangan filial nomidan
        branch = user_branch(request.user) or data.get("branch")
        if branch is None or not branch.is_branch:
            raise ValidationError({"branch": "Qaysi filial kassasidan topshirilishini tanlang."})
        tx = transfer_to_center(
            branch=branch, amount=data["amount"], note=data.get("note", ""),
            user=request.user,
        )
        return ok(CashTransactionSerializer(tx).data, status_code=201)

    @extend_schema(summary="Kassa balansi")
    @action(detail=False, methods=["get"])
    def account(self, request: Request) -> Response:
        return ok(CashAccountSerializer(get_account(user_branch(request.user))).data)

    @extend_schema(
        summary="Kassa boshlang'ich qoldig'ini kiritish (faqat SUPER_ADMIN)",
        request=CashOpeningBalanceSerializer, responses=CashTransactionSerializer,
    )
    @action(detail=False, methods=["post"], url_path="opening-balance")
    def opening_balance(self, request: Request) -> Response:
        s = CashOpeningBalanceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        tx = cash_apply(
            transaction_type=CashTxType.OPENING_BALANCE,
            amount=data["amount"],
            date=data.get("date"),
            reference_type="opening_balance",
            note=data.get("note", ""),
            user=request.user,
            branch=acting_branch(request.user),
        )
        return ok(CashTransactionSerializer(tx).data, status_code=201)

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
            branch=user_branch(request.user),
        )
        return ok(CashTransactionSerializer(tx).data, status_code=201)


class CompanyExpenseViewSet(BaseModelViewSet):
    serializer_class = CompanyExpenseSerializer
    queryset = CompanyExpense.objects.select_related("cash_transaction")
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    read_roles = _FINANCE
    write_roles = (Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.BRANCH_MANAGER)
    branch_lookup = "branch"
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
            branch=user_branch(request.user),
        )
        return ok(CompanyExpenseSerializer(expense).data, status_code=201)
