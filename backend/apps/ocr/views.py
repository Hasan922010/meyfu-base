from __future__ import annotations

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.exceptions import BusinessError
from apps.core.permissions import RolePermission
from apps.core.response import ok
from apps.core.viewsets import EnvelopeResponseMixin
from apps.users.constants import Role
from apps.warehouse.models import Supplier, Warehouse

from .constants import ScanStatus
from .models import InvoiceScan, InvoiceScanLine, InvoiceScanPage
from .serializers import (
    InvoiceScanCreateSerializer,
    InvoiceScanLineUpdateSerializer,
    InvoiceScanSerializer,
    InvoiceScanUpdateSerializer,
    ReceiptScanSerializer,
)
from .services import compute_metrics, confirm_scan, process_scan
from .services.preprocess import preprocess_image
from .services.providers import get_provider

_OCR = (Role.WAREHOUSE, Role.MANAGER, Role.SUPER_ADMIN)
_READ = (*_OCR, Role.ACCOUNTANT)


class InvoiceScanViewSet(
    EnvelopeResponseMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = InvoiceScanSerializer
    queryset = InvoiceScan.objects.select_related(
        "uploaded_by", "warehouse", "supplier"
    ).prefetch_related("pages", "lines__matched_product", "lines__final_product")
    permission_classes = [IsAuthenticated, RolePermission]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    read_roles = _READ
    write_roles = _OCR
    action_roles = {
        "metrics": _READ,
        "confirm": (Role.WAREHOUSE, Role.MANAGER, Role.SUPER_ADMIN),
    }
    filterset_fields = ("status", "warehouse", "supplier")
    ordering = ("-created_at",)
    # OCR har chaqiruvda pul turadi (Claude API) — yuklash/qayta ishlashni cheklaymiz
    throttle_scope = "ocr"

    def get_throttles(self):
        if self.action in ("create", "reprocess"):
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self) -> QuerySet[InvoiceScan]:
        qs = super().get_queryset()
        u = self.request.user
        if getattr(u, "role", None) == Role.WAREHOUSE and not u.is_superuser:
            return qs.filter(warehouse_id=getattr(u, "warehouse_id", None))
        return qs

    @extend_schema(request=InvoiceScanCreateSerializer,
                   responses=InvoiceScanSerializer)
    def create(self, request: Request, *args, **kwargs) -> Response:
        s = InvoiceScanCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        warehouse = Warehouse.objects.filter(pk=data["warehouse"]).first()
        if warehouse is None:
            raise BusinessError(message="Ombor topilmadi.", code="WAREHOUSE_NOT_FOUND")
        supplier = None
        if data.get("supplier"):
            supplier = Supplier.objects.filter(pk=data["supplier"]).first()

        scan = InvoiceScan.objects.create(
            uploaded_by=request.user, warehouse=warehouse, supplier=supplier,
            scan_type=data["scan_type"], status=ScanStatus.UPLOADED,
            created_by=request.user,
        )
        for i, image in enumerate(data["images"], start=1):
            InvoiceScanPage.objects.create(
                scan=scan, image=image, page_number=i, created_by=request.user
            )

        # Sinxron ishlov (Celery bo'lsa .delay() ga o'zgartiring)
        process_scan(str(scan.id))
        scan.refresh_from_db()
        return ok(InvoiceScanSerializer(scan).data, status_code=201)

    @extend_schema(summary="Skanni qayta ishlash", request=None)
    @action(detail=True, methods=["post"])
    def reprocess(self, request: Request, pk: str | None = None) -> Response:
        scan = self.get_object()
        if scan.status == ScanStatus.CONFIRMED:
            raise BusinessError(message="Tasdiqlangan skanni qayta ishlab bo'lmaydi.",
                                code="ALREADY_CONFIRMED")
        scan.status = ScanStatus.UPLOADED
        scan.save(update_fields=["status", "updated_at"])
        process_scan(str(scan.id))
        scan.refresh_from_db()
        return ok(InvoiceScanSerializer(scan).data)

    @extend_schema(summary="Skanni tasdiqlash — Purchase yaratadi", request=None)
    @action(detail=True, methods=["post"])
    def confirm(self, request: Request, pk: str | None = None) -> Response:
        scan = confirm_scan(str(self.get_object().id), user=request.user)
        return ok(InvoiceScanSerializer(scan).data)

    @extend_schema(summary="Skanni bekor qilish", request=None)
    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk: str | None = None) -> Response:
        scan = self.get_object()
        if scan.status == ScanStatus.CONFIRMED:
            raise BusinessError(message="Tasdiqlangan skan bekor qilinmaydi.",
                                code="ALREADY_CONFIRMED")
        scan.status = ScanStatus.CANCELLED
        scan.save(update_fields=["status", "updated_at"])
        return ok(InvoiceScanSerializer(scan).data)

    @extend_schema(summary="Sarlavha ma'lumotini tuzatish",
                   request=InvoiceScanUpdateSerializer)
    @action(detail=True, methods=["patch"], url_path="header")
    def update_header(self, request: Request, pk: str | None = None) -> Response:
        scan = self.get_object()
        s = InvoiceScanUpdateSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        if "supplier" in d:
            scan.supplier = Supplier.objects.filter(pk=d["supplier"]).first()
        if "detected_invoice_number" in d:
            scan.detected_invoice_number = d["detected_invoice_number"]
        if "detected_date" in d:
            scan.detected_date = d["detected_date"]
        scan.save()
        return ok(InvoiceScanSerializer(scan).data)

    @extend_schema(
        summary="Qatorni tahrirlash",
        request=InvoiceScanLineUpdateSerializer,
        parameters=[OpenApiParameter("line_id", str, OpenApiParameter.PATH)],
    )
    @action(detail=True, methods=["patch"], url_path=r"lines/(?P<line_id>[^/.]+)")
    def update_line(
        self, request: Request, pk: str | None = None,
        line_id: str | None = None,
    ) -> Response:
        line = InvoiceScanLine.objects.filter(
            scan_id=pk, pk=line_id
        ).select_related("scan").first()
        if line is None:
            raise BusinessError(message="Qator topilmadi.", code="LINE_NOT_FOUND")
        s = InvoiceScanLineUpdateSerializer(line, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return ok(InvoiceScanLineUpdateSerializer(line).data)

    @extend_schema(summary="OCR metrikalari (CLAUDE.md 9)")
    @action(detail=False, methods=["get"])
    def metrics(self, request: Request) -> Response:
        days = int(request.query_params.get("days", 30))
        return ok(compute_metrics(days=days))


class ReceiptScanView(EnvelopeResponseMixin, viewsets.ViewSet):
    """Chek rasmi → {amount, date, supplier} (xarajat formasini to'ldirish uchun)."""

    permission_classes = [IsAuthenticated, RolePermission]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ocr"

    @extend_schema(request=ReceiptScanSerializer, responses={200: dict})
    def create(self, request: Request) -> Response:
        s = ReceiptScanSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        img = s.validated_data["image"].read()
        result = get_provider().extract([preprocess_image(img)])
        return ok({
            "supplier": result.supplier,
            "date": result.date,
            "total": str(result.total) if result.total is not None else None,
            "confidence": str(result.confidence),
            "provider": result.provider,
        })
