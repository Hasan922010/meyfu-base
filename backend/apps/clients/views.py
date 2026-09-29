from __future__ import annotations

from django.db.models import Count, Q, QuerySet
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.branch import (
    branch_scope,
    ensure_same_branch,
    scope_queryset,
    staff_branch,
    user_branch,
)
from apps.core.exceptions import BusinessError
from apps.core.permissions import RolePermission, is_order_taker
from apps.core.response import ok
from apps.core.serializers import OpeningBulkSerializer, OpeningSheetRowSerializer
from apps.core.viewsets import BaseModelViewSet, BranchScopedMixin, EnvelopeResponseMixin
from apps.users.constants import Role

from .models import Client, ClientVisit, Route
from .serializers import (
    ClientLiteSerializer,
    ClientOpeningDebtSerializer,
    ClientSerializer,
    ClientVisitSerializer,
    RouteSerializer,
)

_MANAGE = (Role.MANAGER, Role.SUPER_ADMIN)
_READ = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.DISTRIBUTOR)
# Zakaz oluvchi — faqat marshrut va mijozlarni o'qiydi (tashrif/yozish yo'q)
_CLIENTS_READ = (*_READ, Role.ORDER_TAKER)


def _is_distributor(user) -> bool:
    return getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser


def _own_routes(user, prefix: str = "") -> Q | None:
    """Maydon xodimining marshrutlari filtri; admin rollar uchun `None` (hammasi)."""
    if _is_distributor(user):
        return Q(**{f"{prefix}distributor": user})
    if is_order_taker(user):
        return Q(**{f"{prefix}order_taker": user})
    return None


def _staff_branch_id(staff):
    branch = staff_branch(staff)
    return branch.pk if branch is not None else None


class RouteViewSet(BaseModelViewSet):
    serializer_class = RouteSerializer
    write_roles = _MANAGE
    read_roles = _CLIENTS_READ
    branch_lookup = "branch"
    search_fields = ("name", "distributor__full_name")
    ordering_fields = ("name", "created_at")

    def get_queryset(self) -> QuerySet[Route]:
        qs = Route.objects.select_related("distributor", "order_taker").annotate(
            clients_count=Count("clients", distinct=True)
        ).order_by("name", "pk")
        own = _own_routes(self.request.user)
        return qs.filter(own) if own is not None else qs

    def _save_in_branch(self, serializer, **extra) -> None:
        """Filial xodimi — marshrut o'z filialida, xodimlar ham o'z filialidan."""
        user = self.request.user
        data = serializer.validated_data
        if branch_scope(user) is not None:
            for field in ("distributor", "order_taker"):
                staff = data.get(field)
                if staff is not None:
                    ensure_same_branch(user, _staff_branch_id(staff), field)
            extra["branch"] = user_branch(user)
        serializer.save(**extra)

    def perform_create(self, serializer) -> None:
        self._save_in_branch(serializer, created_by=self.request.user)

    def perform_update(self, serializer) -> None:
        self._save_in_branch(serializer)

    @extend_schema(summary="Mening marshrutlarim (tarqatuvchi uchun)")
    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request: Request) -> Response:
        own = _own_routes(request.user) or Q(distributor=request.user)
        qs = (
            Route.objects.filter(own, is_active=True)
            .annotate(clients_count=Count("clients", distinct=True))
            .order_by("name")
        )
        return ok(self.get_serializer(qs, many=True).data)


class ClientViewSet(BaseModelViewSet):
    serializer_class = ClientSerializer
    write_roles = _MANAGE
    read_roles = _CLIENTS_READ
    filterset_fields = ("route", "client_type", "is_blocked")
    search_fields = ("name", "owner_name", "phone", "phone2", "inn")
    # Admin jadvalidagi har bir ustun (UI: shared/table)
    ordering_fields = (
        "name", "owner_name", "phone", "route__name", "current_debt", "debt_limit",
        "is_blocked", "created_at",
    )
    action_roles = {
        "opening_balance": _MANAGE,
        "opening_sheet": _MANAGE,
        "opening_balance_bulk": _MANAGE,
    }
    # Boshlang'ich qarz ro'yxati barcha mijozlar bo'yicha — hozircha faqat markaz
    central_only_actions = ("opening_balance", "opening_sheet", "opening_balance_bulk")
    branch_lookup = "branch"

    def get_queryset(self) -> QuerySet[Client]:
        qs = Client.objects.select_related("route", "branch")
        own = _own_routes(self.request.user, prefix="route__")
        return qs.filter(own) if own is not None else qs

    def _save_in_branch(self, serializer, **extra) -> None:
        """Mijoz filiali = marshrut filiali; filial xodimi uchun — o'z filiali."""
        user = self.request.user
        route = serializer.validated_data.get(
            "route", getattr(serializer.instance, "route", None)
        )
        if branch_scope(user) is not None:
            if route is not None:
                ensure_same_branch(user, route.branch_id, "route")
            extra["branch"] = user_branch(user)
        elif route is not None and "branch" not in serializer.validated_data:
            extra["branch"] = route.branch
        serializer.save(**extra)

    def perform_create(self, serializer) -> None:
        self._save_in_branch(serializer, created_by=self.request.user)

    def perform_update(self, serializer) -> None:
        self._save_in_branch(serializer)

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

    @extend_schema(
        summary="Boshlang'ich qarz uchun mijozlar ro'yxati (joriy qarzi bilan)",
        responses=OpeningSheetRowSerializer(many=True),
    )
    @action(detail=False, methods=["get"], url_path="opening-sheet")
    def opening_sheet(self, request: Request) -> Response:
        from apps.sales.services.debt import client_opening_sheet

        return ok(OpeningSheetRowSerializer(client_opening_sheet(), many=True).data)

    @extend_schema(
        summary="Mijozlar qarzini ro'yxatdan kiritish (yakuniy qarz, faqat oshirish)",
        request=OpeningBulkSerializer,
    )
    @action(detail=False, methods=["post"], url_path="opening-balance/bulk")
    def opening_balance_bulk(self, request: Request) -> Response:
        from apps.sales.services.debt import client_opening_bulk

        s = OpeningBulkSerializer(
            data=request.data, context={"non_negative": True, "decimal_places": 2}
        )
        s.is_valid(raise_exception=True)
        return ok(client_opening_bulk(
            rows=s.validated_data["rows"], note=s.validated_data["note"],
            user=request.user,
        ))

    @extend_schema(
        summary="Mijoz boshlang'ich qarzi (sotuvsiz)",
        request=ClientOpeningDebtSerializer,
    )
    @action(detail=False, methods=["post"], url_path="opening-balance")
    def opening_balance(self, request: Request) -> Response:
        from apps.sales.serializers import DebtSerializer
        from apps.sales.services.debt import create_opening_debt

        s = ClientOpeningDebtSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        debt = create_opening_debt(
            client=data["client"], amount=data["amount"],
            note=data.get("note", ""), user=request.user,
        )
        return ok(DebtSerializer(debt).data, status_code=201)


class ClientVisitViewSet(
    BranchScopedMixin,
    EnvelopeResponseMixin,
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ClientVisitSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _READ
    write_roles = (Role.DISTRIBUTOR,)
    branch_lookup = "distributor__warehouse"
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
    """Offline mijoz delta (CLAUDE.md 4.1, 10). Maydon xodimi — faqat o'z marshruti."""

    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _CLIENTS_READ

    @extend_schema(
        summary="Mijozlar sinxronizatsiyasi (delta)",
        parameters=[OpenApiParameter("since", str, required=False)],
        responses=ClientLiteSerializer(many=True),
    )
    def get(self, request: Request) -> Response:
        qs = scope_queryset(Client.all_objects.all(), request.user, "branch")
        own = _own_routes(request.user, prefix="route__")
        if own is not None:
            qs = qs.filter(own)

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
