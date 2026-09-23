from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import QuerySet, Sum
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.response import ok
from apps.core.viewsets import BaseReadOnlyViewSet
from apps.users.constants import Role

from .constants import TransactionType
from .models import DistributorWallet, WalletTransaction
from .serializers import (
    WalletOpeningBalanceSerializer,
    WalletSerializer,
    WalletTransactionSerializer,
)
from .services import get_or_create_wallet, wallet_apply

User = get_user_model()

_READ = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.DISTRIBUTOR)
_ZERO = Decimal("0")


def _is_distributor(user) -> bool:
    return getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser


def _pending_expense_total(distributor) -> Decimal:
    from apps.expenses.models import DistributorExpense

    return (
        DistributorExpense.objects.filter(
            distributor=distributor, status="PENDING",
            payment_source="CASH_ON_HAND",
        ).aggregate(s=Sum("amount"))["s"]
        or _ZERO
    )


class WalletViewSet(BaseReadOnlyViewSet):
    serializer_class = WalletSerializer
    queryset = DistributorWallet.objects.select_related("distributor")
    read_roles = _READ
    filterset_fields = ("distributor",)
    action_roles = {"opening_balance": (Role.SUPER_ADMIN,)}

    def get_queryset(self) -> QuerySet[DistributorWallet]:
        qs = super().get_queryset()
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs

    @extend_schema(
        summary="Xodim boshlang'ich balansi (faqat SUPER_ADMIN, mavjud xodim uchun)",
        request=WalletOpeningBalanceSerializer,
        responses=WalletTransactionSerializer,
    )
    @action(detail=False, methods=["post"], url_path="opening-balance")
    def opening_balance(self, request: Request) -> Response:
        s = WalletOpeningBalanceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        distributor = User.objects.get(pk=data["distributor"])
        tx = wallet_apply(
            distributor=distributor,
            transaction_type=TransactionType.OPENING_BALANCE,
            amount=data["amount"],
            note=data.get("note", ""),
            user=request.user,
        )
        return ok(WalletTransactionSerializer(tx).data, status_code=201)

    @extend_schema(summary="Mening hamyonim (jonli balans bilan)")
    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request: Request) -> Response:
        wallet = get_or_create_wallet(request.user)
        pending = _pending_expense_total(request.user)
        cents = Decimal("0.01")
        data = WalletSerializer(wallet).data
        data["pending_expense_amount"] = str(pending.quantize(cents))
        data["live_balance"] = str((wallet.balance - pending).quantize(cents))
        return ok(data)

    @extend_schema(summary="Hamyon tranzaksiyalari")
    @action(detail=False, methods=["get"], url_path="my/transactions")
    def my_transactions(self, request: Request) -> Response:
        wallet = get_or_create_wallet(request.user)
        txs = wallet.transactions.all()[:200]
        return ok(WalletTransactionSerializer(txs, many=True).data)


class WalletTransactionViewSet(BaseReadOnlyViewSet):
    serializer_class = WalletTransactionSerializer
    queryset = WalletTransaction.objects.select_related("wallet__distributor")
    read_roles = _READ
    filterset_fields = ("wallet", "transaction_type", "date")
    ordering = ("-created_at",)

    def get_queryset(self):
        qs = super().get_queryset()
        if _is_distributor(self.request.user):
            return qs.filter(wallet__distributor=self.request.user)
        return qs
