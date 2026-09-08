from __future__ import annotations

from django.db.models import Prefetch, QuerySet
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.catalog.models import Product
from apps.clients.models import Client
from apps.core.response import ok
from apps.core.viewsets import BaseModelViewSet, BaseReadOnlyViewSet
from apps.users.constants import Role

from .models import Debt, DebtPayment, Sale, SaleItem, SaleReturn
from .serializers import (
    BulkSyncSerializer,
    DebtPaymentCreateSerializer,
    DebtPaymentSerializer,
    DebtSerializer,
    SaleCreateSerializer,
    SaleReturnCreateSerializer,
    SaleReturnSerializer,
    SaleSerializer,
)
from .services import (
    ReturnLine,
    SaleLine,
    cancel_sale,
    collect_debt_payment,
    create_sale,
    create_sale_return,
    process_operations,
    resolve_conflict,
)

_ADMIN = (Role.MANAGER, Role.SUPER_ADMIN)
_READ = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.DISTRIBUTOR)


def _is_distributor(user) -> bool:
    return getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser


def _resolve_products(rows: list[dict]) -> dict[str, Product]:
    ids = [r["product"] for r in rows]
    return {
        str(p.id): p
        for p in Product.objects.select_related("unit").filter(id__in=ids)
    }


class SaleViewSet(BaseModelViewSet):
    serializer_class = SaleSerializer
    http_method_names = ["get", "post", "head", "options"]
    read_roles = _READ
    write_roles = (Role.DISTRIBUTOR, Role.MANAGER, Role.SUPER_ADMIN)
    action_roles = {
        "cancel": _ADMIN,
        "resolve": _ADMIN,
        "bulk_sync": (Role.DISTRIBUTOR,),
        "my_today": _READ,
    }
    filterset_fields = ("distributor", "client", "status", "payment_type", "flagged")
    search_fields = ("number", "client__name")
    ordering_fields = ("date", "created_at", "total_amount")

    def get_queryset(self) -> QuerySet[Sale]:
        qs = Sale.objects.select_related("distributor", "client").prefetch_related(
            Prefetch("items", queryset=SaleItem.objects.select_related("product"))
        )
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return SaleCreateSerializer
        return SaleSerializer

    @extend_schema(request=SaleCreateSerializer, responses=SaleSerializer)
    def create(self, request: Request, *args, **kwargs) -> Response:
        s = SaleCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        products = _resolve_products(data["items"])
        client = Client.objects.get(pk=data["client"])
        lines = [
            SaleLine(
                product=products[str(row["product"])],
                quantity=row["quantity"], price=row["price"],
                discount_percent=row.get("discount_percent", 0),
            )
            for row in data["items"]
        ]
        result = create_sale(
            distributor=request.user,
            client=client,
            payment_type=data["payment_type"],
            lines=lines,
            date=data.get("date"),
            paid_amount=data.get("paid_amount"),
            due_date=data.get("due_date"),
            discount_amount=data.get("discount_amount", 0),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            note=data.get("note", ""),
            client_uuid=str(data["client_uuid"]) if data.get("client_uuid") else None,
            device_time=data.get("device_time"),
            strict=True,
            debt_override=request.query_params.get("force") == "true",
        )
        status_code = 200 if result.duplicate else 201
        return ok(SaleSerializer(result.sale).data, status_code=status_code)

    @extend_schema(summary="Sotuvni bekor qilish", request=None)
    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk: str | None = None) -> Response:
        sale = cancel_sale(
            self.get_object(), user=request.user,
            reason=request.data.get("reason", ""),
        )
        return ok(SaleSerializer(sale).data)

    @extend_schema(summary="Ziddiyatni hal qilish (accept/reject)")
    @action(detail=True, methods=["post"])
    def resolve(self, request: Request, pk: str | None = None) -> Response:
        accept = bool(request.data.get("accept", False))
        sale = resolve_conflict(self.get_object(), accept=accept, user=request.user)
        return ok(SaleSerializer(sale).data)

    @extend_schema(
        summary="Offline outbox sinxronizatsiyasi (CLAUDE.md 4.2)",
        request=BulkSyncSerializer,
    )
    @action(detail=False, methods=["post"], url_path="bulk-sync")
    def bulk_sync(self, request: Request) -> Response:
        s = BulkSyncSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ops = [
            {
                "type": op["type"],
                "client_uuid": str(op["client_uuid"]),
                "payload": op["payload"],
            }
            for op in s.validated_data["operations"]
        ]
        results = process_operations(ops, user=request.user)
        return ok({"results": results, "server_time": timezone.now().isoformat()})

    @extend_schema(summary="Bugungi sotuvlarim")
    @action(detail=False, methods=["get"], url_path="my-today")
    def my_today(self, request: Request) -> Response:
        today = timezone.localdate()
        qs = self.get_queryset().filter(
            distributor=request.user, date=today
        ).exclude(status="CANCELLED")
        return ok(SaleSerializer(qs, many=True).data)

    @extend_schema(summary="Chek ma'lumoti (WhatsApp/Telegram uchun matn)")
    @action(detail=True, methods=["get"])
    def receipt(self, request: Request, pk: str | None = None) -> Response:
        sale = self.get_object()
        lines = [
            f"{i.product.name} — {i.quantity} × {i.price} = {i.amount}"
            for i in sale.items.select_related("product")
        ]
        text = (
            f"{sale.number}\n{sale.client.name}\n{sale.date:%d.%m.%Y}\n"
            + "\n".join(lines)
            + f"\n\nJami: {sale.total_amount} so'm"
            + (f"\nTo'landi: {sale.paid_amount}" if sale.paid_amount else "")
            + (f"\nQarz: {sale.debt_amount}" if sale.debt_amount else "")
        )
        return ok({"text": text, "sale": SaleSerializer(sale).data})


class DebtViewSet(BaseReadOnlyViewSet):
    serializer_class = DebtSerializer
    read_roles = _READ
    filterset_fields = ("client", "status")
    search_fields = ("client__name", "sale__number")
    ordering_fields = ("created_at", "due_date", "remaining")

    def get_queryset(self) -> QuerySet[Debt]:
        qs = Debt.objects.select_related("client", "sale")
        if _is_distributor(self.request.user):
            return qs.filter(client__route__distributor=self.request.user)
        return qs

    @extend_schema(summary="Marshrutimdagi qarzdorlar")
    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request: Request) -> Response:
        qs = (
            Debt.objects.select_related("client", "sale")
            .filter(
                client__route__distributor=request.user,
                status__in=["ACTIVE", "PARTIAL", "OVERDUE"],
            )
            .order_by("due_date")
        )
        return ok(DebtSerializer(qs, many=True).data)


class DebtPaymentViewSet(BaseModelViewSet):
    serializer_class = DebtPaymentSerializer
    http_method_names = ["get", "post", "head", "options"]
    read_roles = _READ
    write_roles = (Role.DISTRIBUTOR, Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)
    filterset_fields = ("debt", "payment_type")
    ordering_fields = ("date", "created_at")

    def get_queryset(self) -> QuerySet[DebtPayment]:
        qs = DebtPayment.objects.select_related("debt__client", "collected_by")
        if _is_distributor(self.request.user):
            return qs.filter(collected_by=self.request.user)
        return qs

    @extend_schema(request=DebtPaymentCreateSerializer, responses=DebtPaymentSerializer)
    def create(self, request: Request, *args, **kwargs) -> Response:
        s = DebtPaymentCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        debt = Debt.objects.get(pk=data["debt"])
        res = collect_debt_payment(
            debt=debt,
            amount=data["amount"],
            collected_by=request.user,
            payment_type=data["payment_type"],
            date=data.get("date"),
            client_uuid=(
                str(data["client_uuid"]) if data.get("client_uuid") else None
            ),
            device_time=data.get("device_time"),
            note=data.get("note", ""),
        )
        code = 200 if res.duplicate else 201
        return ok(DebtPaymentSerializer(res.payment).data, status_code=code)


class SaleReturnViewSet(BaseModelViewSet):
    serializer_class = SaleReturnSerializer
    http_method_names = ["get", "post", "head", "options"]
    read_roles = _READ
    write_roles = (Role.DISTRIBUTOR, Role.MANAGER, Role.SUPER_ADMIN)
    filterset_fields = ("distributor", "client", "reason")
    ordering_fields = ("date", "created_at")

    def get_queryset(self) -> QuerySet[SaleReturn]:
        qs = SaleReturn.objects.select_related("distributor", "client", "sale")
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs

    @extend_schema(request=SaleReturnCreateSerializer, responses=SaleReturnSerializer)
    def create(self, request: Request, *args, **kwargs) -> Response:
        s = SaleReturnCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        products = _resolve_products(data["items"])
        client = Client.objects.get(pk=data["client"])
        sale = None
        if data.get("sale"):
            sale = Sale.objects.filter(pk=data["sale"]).first()
        lines = [
            ReturnLine(
                product=products[str(row["product"])],
                quantity=row["quantity"], price=row["price"],
            )
            for row in data["items"]
        ]
        res = create_sale_return(
            distributor=request.user, client=client, reason=data["reason"],
            lines=lines, sale=sale, restock=data["restock"],
            date=data.get("date"), note=data.get("note", ""),
            client_uuid=str(data["client_uuid"]) if data.get("client_uuid") else None,
        )
        code = 200 if res.duplicate else 201
        return ok(SaleReturnSerializer(res.sale_return).data, status_code=code)
