from __future__ import annotations

from uuid import UUID

from django.db import transaction
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, QuerySet, Sum
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.branch import NO_BRANCH, branch_scope, ensure_same_branch, staff_branch
from apps.core.business_day import business_date
from apps.core.exceptions import BusinessError
from apps.core.response import ok
from apps.core.serializers import OpeningBulkSerializer, OpeningSheetRowSerializer
from apps.core.viewsets import BaseModelViewSet, BaseReadOnlyViewSet
from apps.users.constants import Role

from .constants import MovementType, SupplierTxType, TransferStatus
from .models import (
    InventoryCount,
    Loading,
    Purchase,
    Stock,
    StockMovement,
    Supplier,
    SupplierTransaction,
    Transfer,
    VanStock,
    Warehouse,
)
from .pdf import loading_to_pdf, purchase_to_pdf
from .serializers import (
    InventoryCountListSerializer,
    InventoryCountSerializer,
    InventoryItemsUpdateSerializer,
    LoadingSerializer,
    OpeningWarehouseSerializer,
    PurchasePaymentSerializer,
    PurchaseSerializer,
    StockMovementSerializer,
    StockOpeningBalanceSerializer,
    StockSerializer,
    SupplierOpeningBalanceSerializer,
    SupplierSerializer,
    SupplierTransactionSerializer,
    TransferReceiveSerializer,
    TransferSerializer,
    VanStockSerializer,
    WarehouseSerializer,
)
from .services import apply_movement, supplier_apply
from .services.inventory import (
    cancel_inventory,
    confirm_inventory,
    fill_inventory,
    lock_draft,
    save_inventory_items,
)
from .services.loading import cancel_loading, confirm_loading, send_loading
from .services.opening import (
    stock_opening_bulk,
    stock_opening_sheet,
    supplier_opening_bulk,
    supplier_opening_sheet,
)
from .services.purchase import confirm_purchase
from .services.transfers import cancel_transfer, receive_transfer, send_transfer

_WH_WRITE = (Role.WAREHOUSE, Role.MANAGER, Role.SUPER_ADMIN)
_WH_READ = (Role.WAREHOUSE, Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)
_LOADING_READ = (*_WH_READ, Role.DISTRIBUTOR)


def _is_distributor(user) -> bool:
    return getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser


_NOWHERE = UUID(int=0)  # filialsiz filial rahbari — hech bir omborga mos kelmaydi


def _own_warehouse_id(user):
    """Omborga biriktirilgan omborchi va filial xodimlari faqat o'z ombori bilan ishlaydi.

    `None` — cheklov yo'q (markaz rollari yoki omborga biriktirilmagan omborchi).
    """
    scope = branch_scope(user)
    if scope is NO_BRANCH:
        return _NOWHERE
    if scope is not None:
        return scope
    if getattr(user, "role", None) == Role.WAREHOUSE and not user.is_superuser:
        return user.warehouse_id
    return None


class _OwnWarehouseMixin:
    """Filial omborchisi uchun ro'yxat va yaratishni o'z omboriga cheklaydi."""

    own_warehouse_field = "warehouse"

    def scope_to_own(self, qs):
        own = _own_warehouse_id(self.request.user)
        return qs.filter(**{self.own_warehouse_field: own}) if own else qs

    def check_own_warehouse(self, warehouse) -> None:
        own = _own_warehouse_id(self.request.user)
        if own and warehouse is not None and warehouse.pk != own:
            raise ValidationError(
                {"warehouse": "Faqat o'z omboringiz bo'yicha ishlay olasiz."}
            )

    def perform_create(self, serializer) -> None:
        self.check_own_warehouse(serializer.validated_data.get(self.own_warehouse_field))
        super().perform_create(serializer)

    def perform_update(self, serializer) -> None:
        # PATCH bilan omborni boshqa filialga o'tkazib bo'lmasin (audit SEC-111)
        self.check_own_warehouse(serializer.validated_data.get(
            self.own_warehouse_field,
            getattr(serializer.instance, self.own_warehouse_field),
        ))
        super().perform_update(serializer)


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
    central_only_write = True  # filial ochish/yopish — markaz qarori
    search_fields = ("name", "address")


class SupplierViewSet(BaseModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    write_roles = _WH_WRITE
    search_fields = ("name", "phone", "inn")
    action_roles = {
        "opening_balance": (Role.SUPER_ADMIN,),
        "opening_sheet": (Role.SUPER_ADMIN,),
        "opening_balance_bulk": (Role.SUPER_ADMIN,),
    }

    @extend_schema(
        summary="Boshlang'ich qoldiq uchun barcha faol ta'minotchilar balansi",
        responses=OpeningSheetRowSerializer(many=True),
    )
    @action(detail=False, methods=["get"], url_path="opening-sheet")
    def opening_sheet(self, request: Request) -> Response:
        return ok(OpeningSheetRowSerializer(supplier_opening_sheet(), many=True).data)

    @extend_schema(
        summary="Ta'minotchilar balansini ommaviy kiritish (yakuniy qiymat, ±)",
        request=OpeningBulkSerializer,
    )
    @action(detail=False, methods=["post"], url_path="opening-balance/bulk")
    def opening_balance_bulk(self, request: Request) -> Response:
        s = OpeningBulkSerializer(data=request.data, context={"decimal_places": 2})
        s.is_valid(raise_exception=True)
        return ok(supplier_opening_bulk(
            rows=s.validated_data["rows"], note=s.validated_data["note"],
            user=request.user,
        ))

    @extend_schema(
        summary="Ta'minotchi boshlang'ich qoldig'i (faqat SUPER_ADMIN)",
        request=SupplierOpeningBalanceSerializer,
        responses=SupplierTransactionSerializer,
    )
    @action(detail=False, methods=["post"], url_path="opening-balance")
    def opening_balance(self, request: Request) -> Response:
        s = SupplierOpeningBalanceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        tx = supplier_apply(
            supplier=data["supplier"],
            transaction_type=SupplierTxType.OPENING_BALANCE,
            amount=data["amount"],
            note=data.get("note", ""),
            user=request.user,
        )
        return ok(SupplierTransactionSerializer(tx).data, status_code=201)


class StockViewSet(_OwnWarehouseMixin, BaseReadOnlyViewSet):
    queryset = Stock.objects.select_related("warehouse", "product__unit").order_by(
        "warehouse__name", "product__name", "pk"
    )
    serializer_class = StockSerializer
    read_roles = _WH_READ
    filterset_fields = ("warehouse", "product")
    search_fields = ("product__name", "product__sku")
    ordering_fields = ("quantity", "updated_at")
    # Tovar boshlang'ich qoldig'ini omborchi kiritadi (menejer/admin ham)
    action_roles = {
        "opening_balance": _WH_WRITE,
        "opening_sheet": _WH_WRITE,
        "opening_balance_bulk": _WH_WRITE,
    }

    def get_queryset(self) -> QuerySet[Stock]:
        return self.scope_to_own(super().get_queryset())

    @extend_schema(
        summary="Boshlang'ich qoldiq uchun ombordagi barcha tovarlar (qoldiqsizi ham)",
        parameters=[OpenApiParameter("warehouse", str, required=True)],
        responses=OpeningSheetRowSerializer(many=True),
    )
    @action(detail=False, methods=["get"], url_path="opening-sheet")
    def opening_sheet(self, request: Request) -> Response:
        target = OpeningWarehouseSerializer(data=request.query_params)
        target.is_valid(raise_exception=True)
        self.check_own_warehouse(target.validated_data["warehouse"])
        rows = stock_opening_sheet(target.validated_data["warehouse"])
        return ok(OpeningSheetRowSerializer(rows, many=True).data)

    @extend_schema(
        summary="Tovar qoldiqlarini ommaviy kiritish (yakuniy miqdor)",
        request=OpeningBulkSerializer,
    )
    @action(detail=False, methods=["post"], url_path="opening-balance/bulk")
    def opening_balance_bulk(self, request: Request) -> Response:
        target = OpeningWarehouseSerializer(data=request.data)
        target.is_valid(raise_exception=True)
        self.check_own_warehouse(target.validated_data["warehouse"])
        s = OpeningBulkSerializer(data=request.data, context={"non_negative": True})
        s.is_valid(raise_exception=True)
        return ok(stock_opening_bulk(
            warehouse=target.validated_data["warehouse"],
            rows=s.validated_data["rows"], note=s.validated_data["note"],
            user=request.user,
        ))

    @extend_schema(summary="Kam qolgan tovarlar (min_stock_alert dan past)")
    @action(detail=False, methods=["get"], url_path="low")
    def low(self, request: Request) -> Response:
        qs = (
            self.get_queryset()
            .filter(quantity__lte=F("product__min_stock_alert"))
            .filter(product__is_active=True)
        )
        return ok(self.get_serializer(qs, many=True).data)

    @extend_schema(
        summary="Mavjud mahsulot uchun boshlang'ich qoldiq",
        request=StockOpeningBalanceSerializer, responses=StockMovementSerializer,
    )
    @action(detail=False, methods=["post"], url_path="opening-balance")
    def opening_balance(self, request: Request) -> Response:
        s = StockOpeningBalanceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        self.check_own_warehouse(data["warehouse"])
        movement = apply_movement(
            warehouse=data["warehouse"],
            product=data["product"],
            quantity=data["quantity"],
            movement_type=MovementType.OPENING_BALANCE,
            user=request.user,
            note=data.get("note", ""),
        )
        return ok(StockMovementSerializer(movement).data, status_code=201)


class StockMovementViewSet(_OwnWarehouseMixin, BaseReadOnlyViewSet):
    queryset = StockMovement.objects.select_related("warehouse", "product", "user")
    serializer_class = StockMovementSerializer
    read_roles = _WH_READ
    filterset_fields = ("warehouse", "product", "movement_type", "reference_type")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)

    def get_queryset(self) -> QuerySet[StockMovement]:
        return self.scope_to_own(super().get_queryset())


class SupplierTransactionViewSet(BaseReadOnlyViewSet):
    queryset = SupplierTransaction.objects.select_related("supplier")
    serializer_class = SupplierTransactionSerializer
    read_roles = _WH_READ
    filterset_fields = ("supplier", "transaction_type")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)


class PurchaseViewSet(_OwnWarehouseMixin, BaseModelViewSet):
    queryset = Purchase.objects.select_related("supplier", "warehouse").prefetch_related(
        "items__product"
    )
    serializer_class = PurchaseSerializer
    write_roles = _WH_WRITE
    read_roles = _WH_READ
    filterset_fields = ("supplier", "warehouse", "status", "source")
    search_fields = ("number", "invoice_number", "supplier__name")
    ordering_fields = ("date", "created_at", "total_amount")

    def get_queryset(self) -> QuerySet[Purchase]:
        return self.scope_to_own(super().get_queryset())

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


class InventoryCountViewSet(_OwnWarehouseMixin, BaseModelViewSet):
    """Inventarizatsiya: yaratilganda tovarlar avtomatik to'ldiriladi."""

    serializer_class = InventoryCountSerializer
    write_roles = _WH_WRITE
    read_roles = _WH_READ
    # Omborchi sanaydi, qoldiqni tuzatishni rahbar tasdiqlaydi
    action_roles = {"confirm": (Role.MANAGER, Role.SUPER_ADMIN)}
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("warehouse", "status", "date")
    search_fields = ("number", "note")
    ordering_fields = ("date", "created_at")

    def get_queryset(self) -> QuerySet[InventoryCount]:
        # GROUP BY'da Meta.ordering e'tiborsiz qoladi — sahifalash barqaror bo'lsin
        qs = self.scope_to_own(
            InventoryCount.objects.select_related("warehouse").order_by(
                "-date", "-created_at", "pk"
            )
        )
        if self.action == "list":
            counted = Q(items__actual_qty__isnull=False)
            diff_value = ExpressionWrapper(
                (F("items__actual_qty") - F("items__expected_qty"))
                * F("items__cost_price"),
                output_field=DecimalField(max_digits=20, decimal_places=5),
            )
            return qs.annotate(
                annotated_items_count=Count("items"),
                annotated_counted_count=Count("items", filter=counted),
                annotated_difference_amount=Sum(diff_value, filter=counted),
            )
        return qs.prefetch_related("items__product__unit")

    def get_serializer_class(self):
        if self.action == "list":
            return InventoryCountListSerializer
        return InventoryCountSerializer

    def _detail(self, count: InventoryCount) -> Response:
        fresh = self.get_queryset().get(pk=count.pk)
        return ok(InventoryCountSerializer(fresh).data)

    @transaction.atomic
    def perform_update(self, serializer) -> None:
        lock_draft(serializer.instance)
        serializer.save()

    @extend_schema(summary="Qatorlarni joriy qoldiq bilan qayta to'ldirish", request=None)
    @action(detail=True, methods=["post"])
    def fill(self, request: Request, pk: str | None = None) -> Response:
        return self._detail(fill_inventory(self.get_object(), user=request.user))

    @extend_schema(
        summary="Haqiqiy qoldiqlarni saqlash (bo'sh — sanalmagan)",
        request=InventoryItemsUpdateSerializer,
    )
    @action(detail=True, methods=["patch"])
    def items(self, request: Request, pk: str | None = None) -> Response:
        count = self.get_object()
        s = InventoryItemsUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        save_inventory_items(count, s.validated_data["items"])
        return self._detail(count)

    @extend_schema(summary="Tasdiqlash — farq qoldiqqa tuzatish bo'lib yoziladi",
                   request=None)
    @action(detail=True, methods=["post"])
    def confirm(self, request: Request, pk: str | None = None) -> Response:
        return self._detail(confirm_inventory(self.get_object(), user=request.user))

    @extend_schema(summary="Qoralamani bekor qilish", request=None)
    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk: str | None = None) -> Response:
        return self._detail(cancel_inventory(self.get_object(), user=request.user))


class TransferViewSet(_OwnWarehouseMixin, BaseModelViewSet):
    """Ombor/filiallar orasida ko'chirish: qoralama → yo'lda → qabul qilingan."""

    serializer_class = TransferSerializer
    write_roles = _WH_WRITE
    read_roles = _WH_READ
    own_warehouse_field = "from_warehouse"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("from_warehouse", "to_warehouse", "status", "date")
    search_fields = ("number", "note")
    ordering_fields = ("date", "created_at")

    def get_queryset(self) -> QuerySet[Transfer]:
        qs = Transfer.objects.select_related(
            "from_warehouse", "to_warehouse", "sent_by", "received_by"
        ).prefetch_related("items__product__unit").order_by("-date", "-created_at", "pk")
        own = _own_warehouse_id(self.request.user)
        # Filial omborchisi — o'zidan chiqqan va o'ziga kelgan ko'chirishlar
        return qs.filter(Q(from_warehouse=own) | Q(to_warehouse=own)) if own else qs

    @transaction.atomic
    def perform_update(self, serializer) -> None:
        data = serializer.validated_data
        self.check_own_warehouse(
            data.get("from_warehouse", serializer.instance.from_warehouse)
        )
        # Parallel `send` bilan poyga: qulfsiz eski DRAFT holati SENT ustidan
        # yozilib, transfer ikki marta jo'natilardi (audit BE-105)
        locked = Transfer.objects.select_for_update().get(pk=serializer.instance.pk)
        if locked.status != TransferStatus.DRAFT:
            raise BusinessError(
                message="Faqat qoralama ko'chirishni tahrirlash mumkin.",
                code="TRANSFER_NOT_DRAFT",
            )
        serializer.instance = locked
        serializer.save()

    def _fresh(self, transfer: Transfer) -> Response:
        return ok(TransferSerializer(self.get_queryset().get(pk=transfer.pk)).data)

    @extend_schema(summary="Yuborish — manba ombordan chiqim", request=None)
    @action(detail=True, methods=["post"])
    def send(self, request: Request, pk: str | None = None) -> Response:
        transfer = self.get_object()
        self.check_own_warehouse(transfer.from_warehouse)
        return self._fresh(send_transfer(transfer, user=request.user))

    @extend_schema(
        summary="Qabul qilish — qabul qilingan miqdor filialga kirim",
        request=TransferReceiveSerializer,
    )
    @action(detail=True, methods=["post"])
    def receive(self, request: Request, pk: str | None = None) -> Response:
        transfer = self.get_object()
        # Qabulni faqat qabul qiluvchi ombor omborchisi (yoki admin) qiladi
        self.check_own_warehouse(transfer.to_warehouse)
        s = TransferReceiveSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._fresh(receive_transfer(
            transfer, s.validated_data["items"], note=s.validated_data["note"],
            user=request.user,
        ))

    @extend_schema(summary="Bekor qilish (yo'ldagi tovar manbaga qaytadi)", request=None)
    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk: str | None = None) -> Response:
        transfer = self.get_object()
        self.check_own_warehouse(transfer.from_warehouse)
        return self._fresh(cancel_transfer(transfer, user=request.user))


class LoadingViewSet(_OwnWarehouseMixin, BaseModelViewSet):
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
        return self.scope_to_own(qs)

    def perform_create(self, serializer) -> None:
        # Filial rahbari faqat o'z filiali tarqatuvchisiga yuklama beradi
        branch = staff_branch(serializer.validated_data.get("distributor"))
        ensure_same_branch(
            self.request.user, branch.pk if branch else None, "distributor"
        )
        super().perform_create(serializer)

    def perform_update(self, serializer) -> None:
        branch = staff_branch(serializer.validated_data.get(
            "distributor", serializer.instance.distributor
        ))
        ensure_same_branch(
            self.request.user, branch.pk if branch else None, "distributor"
        )
        super().perform_update(serializer)

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

    @extend_schema(summary="Bugungi yuklamam + hali tasdiqlanmaganlari (tarqatuvchi uchun)")
    @action(detail=False, methods=["get"], url_path="my-today")
    def my_today(self, request: Request) -> Response:
        today = business_date()
        # Audit K10: kechagi yuborilgan (SENT) yuklama ham ko'rinsin — aks holda
        # u hech qachon tasdiqlanmay, tovar "yo'lda" qolib ketadi.
        qs = self.get_queryset().filter(
            Q(date=today) | Q(status="SENT"), distributor=request.user,
        ).exclude(status="DRAFT").order_by("date", "created_at")
        return ok(self.get_serializer(qs, many=True).data)


class VanStockViewSet(BaseReadOnlyViewSet):
    serializer_class = VanStockSerializer
    read_roles = _LOADING_READ
    branch_lookup = "distributor__warehouse"
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
