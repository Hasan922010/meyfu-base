from __future__ import annotations

from django.db.models import Count, QuerySet
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import BusinessError
from apps.core.permissions import RolePermission
from apps.core.response import ok
from apps.core.viewsets import BaseModelViewSet, EnvelopeResponseMixin
from apps.users.constants import Role

from .models import Client, ClientVisit, Route
from .serializers import (
    ClientLiteSerializer,
    ClientSerializer,
    ClientVisitSerializer,
    RouteSerializer,
)

_MANAGE = (Role.MANAGER, Role.SUPER_ADMIN)
_READ = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.DISTRIBUTOR)


def _is_distributor(user) -> bool:
    return getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser


class RouteViewSet(BaseModelViewSet):
    serializer_class = RouteSerializer
    write_roles = _MANAGE
    read_roles = _READ
    search_fields = ("name", "distributor__full_name")
    ordering_fields = ("name", "created_at")

    def get_queryset(self) -> QuerySet[Route]:
        qs = Route.objects.select_related("distributor").annotate(
            clients_count=Count("clients", distinct=True)
        )
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs

    @extend_schema(summary="Mening marshrutlarim (tarqatuvchi uchun)")
    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request: Request) -> Response:
        qs = (
            Route.objects.filter(distributor=request.user, is_active=True)
            .annotate(clients_count=Count("clients", distinct=True))
            .order_by("name")
        )
        return ok(self.get_serializer(qs, many=True).data)


class ClientViewSet(BaseModelViewSet):
    serializer_class = ClientSerializer
    write_roles = _MANAGE
    read_roles = _READ
    filterset_fields = ("route", "client_type", "is_blocked")
    search_fields = ("name", "owner_name", "phone", "phone2", "inn")
    ordering_fields = ("name", "current_debt", "created_at")

    def get_queryset(self) -> QuerySet[Client]:
        qs = Client.objects.select_related("route")
        if _is_distributor(self.request.user):
            return qs.filter(route__distributor=self.request.user)
        return qs

    @extend_schema(summary="Mijoz tarixi — tashriflar (keyinchalik sotuvlar ham)")
    @action(detail=True, methods=["get"])
    def history(self, request: Request, pk: str | None = None) -> Response:
        client = self.get_object()
        visits = client.visits.select_related("distributor")[:100]
        return ok(
            {
                "visits": ClientVisitSerializer(visits, many=True).data,
                # 5-bosqichda: "sales": [...]
            }
        )

    @extend_schema(summary="Mijoz qarzlari")
    @action(detail=True, methods=["get"])
    def debts(self, request: Request, pk: str | None = None) -> Response:
        client = self.get_object()
        return ok(
            {
                "current_debt": str(client.current_debt),
                "debt_limit": str(client.debt_limit),
                "debt_available": str(client.debt_available),
                "items": [],  # Debt modeli — 5-bosqich
            }
        )


class ClientVisitViewSet(
    EnvelopeResponseMixin,
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ClientVisitSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _READ
    write_roles = (Role.DISTRIBUTOR,)
    filterset_fields = ("client", "result")
    ordering = ("-checked_in_at",)

    def get_queryset(self) -> QuerySet[ClientVisit]:
        qs = ClientVisit.objects.select_related("client", "distributor")
        if _is_distributor(self.request.user):
            return qs.filter(distributor=self.request.user)
        return qs

    def perform_create(self, serializer: ClientVisitSerializer) -> None:
        client = serializer.validated_data["client"]
        if _is_distributor(self.request.user) and (
            client.route_id is None
            or client.route.distributor_id != self.request.user.id
        ):
            raise BusinessError(
                message="Bu mijoz sizning marshrutingizda emas.",
                code="CLIENT_NOT_ON_ROUTE",
                status_code=403,
            )
        serializer.save(
            distributor=self.request.user,
            created_by=self.request.user,
            checked_in_at=serializer.validated_data.get("checked_in_at")
            or timezone.now(),
        )


class ClientSyncView(APIView):
    """Offline mijoz delta (CLAUDE.md 4.1, 10). Tarqatuvchi — faqat o'z marshruti."""

    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _READ

    @extend_schema(
        summary="Mijozlar sinxronizatsiyasi (delta)",
        parameters=[OpenApiParameter("since", str, required=False)],
        responses=ClientLiteSerializer(many=True),
    )
    def get(self, request: Request) -> Response:
        qs = Client.all_objects.all()
        if _is_distributor(request.user):
            qs = qs.filter(route__distributor=request.user)

        since_raw = request.query_params.get("since")
        if since_raw:
            since = parse_datetime(since_raw)
            if since is None:
                raise BusinessError(
                    message="`since` ISO8601 formatda bo'lishi kerak.",
                    code="INVALID_SINCE", status_code=400,
                )
            qs = qs.filter(updated_at__gt=since)

        return ok(
            {
                "server_time": timezone.now().isoformat(),
                "count": qs.count(),
                "clients": ClientLiteSerializer(qs, many=True).data,
            }
        )
