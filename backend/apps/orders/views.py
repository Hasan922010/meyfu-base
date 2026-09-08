from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Prefetch, Q, QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.catalog.models import Product
from apps.clients.models import Client
from apps.core.response import ok
from apps.core.viewsets import BaseModelViewSet
from apps.users.constants import Role
from apps.warehouse.models import Warehouse

from .constants import OrderStatus
from .models import Order, OrderItem
from .serializers import (
    LoadingFromOrdersSerializer,
    OrderCancelSerializer,
    OrderCreateSerializer,
    OrderFulfillSerializer,
    OrderSerializer,
)
from .services import (
    FulfillLine,
    OrderLine,
    approve_order,
    build_loading_from_orders,
    cancel_order,
    create_order,
    fulfill_order,
    place_order,
)

User = get_user_model()

_ADMIN = (Role.MANAGER, Role.SUPER_ADMIN)
_WAREHOUSE = (Role.WAREHOUSE, Role.MANAGER, Role.SUPER_ADMIN)
_READ = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.WAREHOUSE,
         Role.DISTRIBUTOR)
_WRITE = (Role.DISTRIBUTOR, Role.MANAGER, Role.SUPER_ADMIN)


def _is_distributor(user) -> bool:
    return getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser


class OrderViewSet(BaseModelViewSet):
    serializer_class = OrderSerializer
    http_method_names = ["get", "post", "head", "options"]
    read_roles = _READ
    write_roles = _WRITE
    action_roles = {
        "approve": _ADMIN,
        "cancel": _ADMIN,
        "build_loading": _WAREHOUSE,
        "for_loading": _WAREHOUSE,
        "my_to_take": (Role.DISTRIBUTOR, *_ADMIN),
        "my_to_deliver": (Role.DISTRIBUTOR, *_ADMIN),
    }
    filterset_fields = ("status", "client", "taken_by", "assigned_to", "date")
    search_fields = ("number", "client__name")
    ordering_fields = ("date", "created_at", "total_amount")

    def get_queryset(self) -> QuerySet[Order]:
        qs = Order.objects.select_related(
            "client", "taken_by", "assigned_to", "loading"
        ).prefetch_related(
            Prefetch("items", queryset=OrderItem.objects.select_related("product"))
        )
        if _is_distributor(self.request.user):
            return qs.filter(
                Q(taken_by=self.request.user) | Q(assigned_to=self.request.user)
            )
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderSerializer

    @extend_schema(request=OrderCreateSerializer, responses=OrderSerializer)
    def create(self, request: Request, *args, **kwargs) -> Response:
        s = OrderCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        client = Client.objects.get(pk=data["client"])
        taken_by = request.user
        if data.get("taken_by") and not _is_distributor(request.user):
            taken_by = User.objects.get(pk=data["taken_by"])

        products = {
            str(p.id): p
            for p in Product.objects.select_related("unit").filter(
                id__in=[r["product"] for r in data["items"]]
            )
        }
        lines = [
            OrderLine(
                product=products[str(row["product"])],
                quantity=row["quantity"], price=row["price"],
            )
            for row in data["items"]
        ]
        result = create_order(
            client=client,
            taken_by=taken_by,
            lines=lines,
            date=data.get("date"),
            payment_intent=data.get("payment_intent", ""),
            desired_date=data.get("desired_date"),
            note=data.get("note", ""),
            place=data.get("place", False),
            client_uuid=str(data["client_uuid"]) if data.get("client_uuid") else None,
            device_time=data.get("device_time"),
            user=request.user,
        )
        return ok(
            OrderSerializer(result.order).data,
            status_code=200 if result.duplicate else 201,
        )

    @extend_schema(summary="Buyurtmani berish (DRAFT → PLACED)", request=None)
    @action(detail=True, methods=["post"])
    def place(self, request: Request, pk: str | None = None) -> Response:
        return ok(OrderSerializer(place_order(self.get_object(),
                                              user=request.user)).data)

    @extend_schema(summary="Buyurtmani tasdiqlash", request=None)
    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk: str | None = None) -> Response:
        return ok(OrderSerializer(approve_order(self.get_object(),
                                                user=request.user)).data)

    @extend_schema(summary="Buyurtmani bekor qilish", request=OrderCancelSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk: str | None = None) -> Response:
        s = OrderCancelSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = cancel_order(
            self.get_object(), user=request.user,
            reason=s.validated_data.get("reason", ""),
        )
        return ok(OrderSerializer(order).data)

    @extend_schema(summary="Buyurtmani yetkazish → Sale yaratish",
                   request=OrderFulfillSerializer)
    @action(detail=True, methods=["post"])
    def fulfill(self, request: Request, pk: str | None = None) -> Response:
        from apps.sales.serializers import SaleSerializer

        s = OrderFulfillSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        order = self.get_object()

        by_id = {str(it.id): it for it in order.items.all()}
        fulfill_lines = [
            FulfillLine(
                item=by_id[str(row["item"])],
                delivered_quantity=row["delivered_quantity"],
                price=row.get("price"),
            )
            for row in data["lines"]
            if str(row["item"]) in by_id
        ]
        distributor = None
        if data.get("distributor"):
            distributor = User.objects.get(pk=data["distributor"])
        elif _is_distributor(request.user):
            distributor = request.user

        result = fulfill_order(
            order,
            fulfill_lines,
            distributor=distributor,
            payment_type=data.get("payment_type") or None,
            paid_amount=data.get("paid_amount"),
            due_date=data.get("due_date"),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            note=data.get("note", ""),
            client_uuid=str(data["client_uuid"]) if data.get("client_uuid") else None,
            device_time=data.get("device_time"),
            user=request.user,
        )
        return ok(
            {"sale": SaleSerializer(result.sale).data,
             "order": OrderSerializer(Order.objects.get(pk=order.pk)).data},
            status_code=200 if result.duplicate else 201,
        )

    @extend_schema(summary="Bugun men olgan buyurtmalar", request=None)
    @action(detail=False, methods=["get"], url_path="my-to-take")
    def my_to_take(self, request: Request) -> Response:
        qs = self.get_queryset().filter(taken_by=request.user)
        return ok(OrderSerializer(qs, many=True).data)

    @extend_schema(summary="Menga biriktirilgan yetkaziladigan buyurtmalar",
                   request=None)
    @action(detail=False, methods=["get"], url_path="my-to-deliver")
    def my_to_deliver(self, request: Request) -> Response:
        qs = self.get_queryset().filter(
            assigned_to=request.user,
            status__in=[OrderStatus.APPROVED, OrderStatus.LOADED],
        )
        return ok(OrderSerializer(qs, many=True).data)

    @extend_schema(summary="Yuklamaga yig'ish uchun tasdiqlangan buyurtmalar",
                   request=None)
    @action(detail=False, methods=["get"], url_path="for-loading")
    def for_loading(self, request: Request) -> Response:
        qs = Order.objects.select_related("client", "taken_by").filter(
            status=OrderStatus.APPROVED
        )
        return ok(OrderSerializer(qs, many=True).data)

    @extend_schema(summary="Tanlangan buyurtmalardan yuklama yig'ish",
                   request=LoadingFromOrdersSerializer)
    @action(detail=False, methods=["post"], url_path="build-loading")
    def build_loading(self, request: Request) -> Response:
        from apps.warehouse.serializers import LoadingSerializer

        s = LoadingFromOrdersSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        orders = list(
            Order.objects.filter(id__in=data["order_ids"]).select_related("client")
        )
        loading = build_loading_from_orders(
            distributor=User.objects.get(pk=data["distributor"]),
            warehouse=Warehouse.objects.get(pk=data["warehouse"]),
            orders=orders,
            date=data.get("date"),
            user=request.user,
        )
        return ok(LoadingSerializer(loading).data, status_code=201)
