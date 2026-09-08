from __future__ import annotations

from decimal import Decimal

from django.db.models import Q, QuerySet
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.catalog.models import Product
from apps.core.exceptions import BusinessError
from apps.core.permissions import RolePermission
from apps.core.response import ok
from apps.core.viewsets import BaseReadOnlyViewSet, EnvelopeResponseMixin
from apps.users.constants import Role
from apps.warehouse.models import VanStock, Warehouse

from .models import CashHandover, DayClose
from .serializers import (
    CashHandoverSerializer,
    DayCloseSerializer,
    DayCloseSubmitSerializer,
)
from .services import ReturnRow, build_snapshot, confirm_day_close, submit_day_close

_ADMIN = (Role.MANAGER, Role.SUPER_ADMIN)
_READ = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.DISTRIBUTOR)


def _is_distributor(user) -> bool:
    return getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser


def _m(value) -> str:
    return str(Decimal(value).quantize(Decimal("0.01")))


class DayCloseViewSet(
    EnvelopeResponseMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = DayCloseSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _READ
    action_roles = {
        "submit": (Role.DISTRIBUTOR,),
        "confirm": _ADMIN,
        "my_today": _READ,
    }
    filterset_fields = ("distributor", "status", "date")
    ordering = ("-date",)

    def get_queryset(self) -> QuerySet[DayClose]:
        qs = DayClose.objects.select_related("distributor").prefetch_related(
            "daily_returns__items__product"
        )
        if self.request.query_params.get("has_difference") == "true":
            qs = qs.exclude(Q(cash_difference=0) & Q(stock_difference_qty=0))
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs

    @extend_schema(summary="Bugungi kun holati (jonli hisob)")
    @action(detail=False, methods=["get"], url_path="my-today")
    def my_today(self, request: Request) -> Response:
        today = timezone.localdate()
        existing = DayClose.objects.filter(
            distributor=request.user, date=today
        ).first()
        if existing:
            return ok({"submitted": True,
                       "day_close": DayCloseSerializer(existing).data})

        snap = build_snapshot(request.user, today)
        van = [
            {
                "product": str(vs.product_id),
                "product_name": vs.product.name,
                "product_sku": vs.product.sku,
                "unit": vs.product.unit.short_name,
                "quantity": str(vs.quantity),
                "wholesale_price": str(vs.product.wholesale_price),
            }
            for vs in VanStock.objects.select_related(
                "product", "product__unit"
            ).filter(distributor=request.user, quantity__gt=0)
        ]
        return ok({
            "submitted": False,
            "date": str(today),
            "loaded_amount": _m(snap.loaded_amount),
            "sold_amount": _m(snap.sold_amount),
            "cash_sales_amount": _m(snap.cash_sales_amount),
            "debt_collected_amount": _m(snap.debt_collected_amount),
            "expense_amount": _m(snap.expense_amount),
            "expense_approved_amount": _m(snap.expense_approved_amount),
            "debt_given_amount": _m(snap.debt_given_amount),
            "cash_expected": _m(snap.cash_expected),
            "wallet_balance_end": _m(snap.wallet_balance_end),
            "sales_count": snap.sales_count,
            "visits_count": snap.visits_count,
            "van_items": van,
        })

    @extend_schema(summary="Kunni yopish (3 qadam yakuni)",
                   request=DayCloseSubmitSerializer)
    @action(detail=False, methods=["post"])
    def submit(self, request: Request) -> Response:
        s = DayCloseSubmitSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        warehouse = Warehouse.objects.filter(pk=data["warehouse"]).first()
        if warehouse is None:
            raise BusinessError(message="Ombor topilmadi.", code="WAREHOUSE_NOT_FOUND")

        products = {
            str(p.id): p
            for p in Product.objects.filter(
                id__in=[r["product"] for r in data["items"]]
            )
        }
        rows = [
            ReturnRow(
                product=products[str(r["product"])],
                quantity=r["quantity"],
                condition=r["condition"],
            )
            for r in data["items"]
        ]
        day_close = submit_day_close(
            distributor=request.user,
            date=data.get("date") or timezone.localdate(),
            warehouse=warehouse,
            return_rows=rows,
            cash_handed=data["cash_handed"],
            note=data.get("note", ""),
        )
        return ok(DayCloseSerializer(day_close).data, status_code=201)

    @extend_schema(summary="Kun yopishni tasdiqlash (admin)", request=None)
    @action(detail=True, methods=["post"])
    def confirm(self, request: Request, pk: str | None = None) -> Response:
        day_close = confirm_day_close(self.get_object(), user=request.user)
        return ok(DayCloseSerializer(day_close).data)


class CashHandoverViewSet(BaseReadOnlyViewSet):
    serializer_class = CashHandoverSerializer
    queryset = CashHandover.objects.select_related("distributor", "received_by")
    read_roles = _READ
    filterset_fields = ("distributor", "confirmed", "date")

    def get_queryset(self):
        qs = super().get_queryset()
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs
