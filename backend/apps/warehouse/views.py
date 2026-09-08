from __future__ import annotations

from django.db.models import F, QuerySet
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.exceptions import BusinessError
from apps.core.response import ok
from apps.core.viewsets import BaseModelViewSet, BaseReadOnlyViewSet
from apps.users.constants import Role

from .models import (
    Loading,
    Purchase,
    Stock,
    StockMovement,
    Supplier,
    VanStock,
    Warehouse,
)
from .pdf import loading_to_pdf, purchase_to_pdf
from .serializers import (
    LoadingSerializer,
    PurchasePaymentSerializer,
    PurchaseSerializer,
    StockMovementSerializer,
    StockSerializer,
    SupplierSerializer,
    VanStockSerializer,
    WarehouseSerializer,
)
from .services.loading import cancel_loading, confirm_loading, send_loading
from .services.purchase import confirm_purchase

_WH_WRITE = (Role.WAREHOUSE, Role.MANAGER, Role.SUPER_ADMIN)
_WH_READ = (Role.WAREHOUSE, Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)
_LOADING_READ = (*_WH_READ, Role.DISTRIBUTOR)


def _is_distributor(user) -> bool:
    return getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser


def _wants_stamp(request: Request) -> bool:
    return request.query_params.get("stamp") in ("1", "true", "yes")


def _pdf_response(content: bytes, filename: str) -> HttpResponse:
    response = HttpResponse(content, content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response


class WarehouseViewSet(BaseModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    write_roles = (Role.MANAGER, Role.SUPER_ADMIN)
    search_fields = ("name", "address")


class SupplierViewSet(BaseModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    write_roles = _WH_WRITE
    search_fields = ("name", "phone", "inn")


class StockViewSet(BaseReadOnlyViewSet):
    queryset = Stock.objects.select_related("warehouse", "product")
    serializer_class = StockSerializer
    read_roles = _WH_READ
    filterset_fields = ("warehouse", "product")
    search_fields = ("product__name", "product__sku")
    ordering_fields = ("quantity", "updated_at")

    @extend_schema(summary="Kam qolgan tovarlar (min_stock_alert dan past)")
    @action(detail=False, methods=["get"], url_path="low")
    def low(self, request: Request) -> Response:
        qs = (
            self.get_queryset()
            .filter(quantity__lte=F("product__min_stock_alert"))
            .filter(product__is_active=True)
        )
        return ok(self.get_serializer(qs, many=True).data)


class StockMovementViewSet(BaseReadOnlyViewSet):
    queryset = StockMovement.objects.select_related("warehouse", "product", "user")
    serializer_class = StockMovementSerializer
    read_roles = _WH_READ
    filterset_fields = ("warehouse", "product", "movement_type", "reference_type")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)


class PurchaseViewSet(BaseModelViewSet):
    queryset = Purchase.objects.select_related("supplier", "warehouse").prefetch_related(
        "items__product"
    )
    serializer_class = PurchaseSerializer
    write_roles = _WH_WRITE
    read_roles = _WH_READ
    filterset_fields = ("supplier", "warehouse", "status", "source")
    search_fields = ("number", "invoice_number", "supplier__name")
    ordering_fields = ("date", "created_at", "total_amount")

    @extend_schema(summary="Qabulni tasdiqlash — qoldiqqa kirim qiladi", request=None)
    @action(detail=True, methods=["post"])
    def confirm(self, request: Request, pk: str | None = None) -> Response:
        purchase = confirm_purchase(self.get_object(), user=request.user)
        return ok(self.get_serializer(purchase).data)

    @extend_schema(
        summary="Nakladnoy PDF (rasm + rekvizit; ?stamp=1 — muhr bilan)",
        parameters=[OpenApiParameter("stamp", bool, required=False)],
        responses={(200, "application/pdf"): bytes},
    )
    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request: Request, pk: str | None = None) -> HttpResponse:
        purchase = self.get_object()
        content = purchase_to_pdf(purchase, with_stamp=_wants_stamp(request))
        return _pdf_response(content, f"nakladnoy-{purchase.number}.pdf")

    @extend_schema(summary="To'lovni yangilash", request=PurchasePaymentSerializer)
    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request: Request, pk: str | None = None) -> Response:
        purchase = self.get_object()
        serializer = PurchasePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase.paid_amount = serializer.validated_data["paid_amount"]
        purchase.recalc_totals()
        purchase.save(update_fields=["paid_amount", "debt_amount", "updated_at"])
        return ok(self.get_serializer(purchase).data)


class LoadingViewSet(BaseModelViewSet):
    serializer_class = LoadingSerializer
    write_roles = _WH_WRITE
    read_roles = _LOADING_READ
    action_roles = {
        "confirm": (Role.DISTRIBUTOR, Role.WAREHOUSE, Role.MANAGER, Role.SUPER_ADMIN),
        "my_today": _LOADING_READ,
    }
    filterset_fields = ("distributor", "warehouse", "status", "date")
    search_fields = ("number", "distributor__full_name")
    ordering_fields = ("date", "created_at", "total_amount")

    def get_queryset(self) -> QuerySet[Loading]:
        qs = Loading.objects.select_related("distributor", "warehouse").prefetch_related(
            "items__product"
        )
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs

    @extend_schema(summary="Yuklamani tarqatuvchiga yuborish (qoldiq band qilinadi)",
                   request=None)
    @action(detail=True, methods=["post"])
    def send(self, request: Request, pk: str | None = None) -> Response:
        loading = send_loading(self.get_object(), user=request.user)
        return ok(self.get_serializer(loading).data)

    @extend_schema(summary="Yuklamani tasdiqlash (VanStock oshadi)", request=None)
    @action(detail=True, methods=["post"])
    def confirm(self, request: Request, pk: str | None = None) -> Response:
        loading = self.get_object()
        if _is_distributor(request.user) and loading.distributor_id != request.user.id:
            raise BusinessError(
                message="Bu yuklama sizga tegishli emas.",
                code="NOT_YOUR_LOADING", status_code=403,
            )
        loading = confirm_loading(loading, user=request.user)
        return ok(self.get_serializer(loading).data)

    @extend_schema(summary="Yuklamani bekor qilish / qaytarish", request=None)
    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk: str | None = None) -> Response:
        loading = cancel_loading(self.get_object(), user=request.user)
        data = self.get_serializer(loading).data if loading.pk else {"deleted": True}
        return ok(data)

    @extend_schema(
        summary="Yuklama varag'i PDF (rasm + rekvizit; ?stamp=1 — muhr bilan)",
        parameters=[OpenApiParameter("stamp", bool, required=False)],
        responses={(200, "application/pdf"): bytes},
    )
    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request: Request, pk: str | None = None) -> HttpResponse:
        loading = self.get_object()
        content = loading_to_pdf(loading, with_stamp=_wants_stamp(request))
        return _pdf_response(content, f"yuklama-{loading.number}.pdf")

    @extend_schema(summary="Bugungi yuklamam (tarqatuvchi uchun)")
    @action(detail=False, methods=["get"], url_path="my-today")
    def my_today(self, request: Request) -> Response:
        today = timezone.localdate()
        qs = self.get_queryset().filter(
            distributor=request.user, date=today
        ).exclude(status="DRAFT")
        return ok(self.get_serializer(qs, many=True).data)


class VanStockViewSet(BaseReadOnlyViewSet):
    serializer_class = VanStockSerializer
    read_roles = _LOADING_READ
    filterset_fields = ("distributor", "product")
    search_fields = ("product__name", "product__sku")
    ordering_fields = ("quantity", "updated_at")

    def get_queryset(self) -> QuerySet[VanStock]:
        qs = VanStock.objects.select_related("distributor", "product", "product__unit")
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs

    @extend_schema(summary="Mening mashina qoldig'im")
    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request: Request) -> Response:
        qs = (
            VanStock.objects.filter(distributor=request.user, quantity__gt=0)
            .select_related("product", "product__unit")
            .order_by("product__name")
        )
        return ok(self.get_serializer(qs, many=True).data)
