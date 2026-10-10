from __future__ import annotations

from django.db.models import Count, Q, QuerySet
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.audit import diff_fields, write_audit
from apps.core.branch import (
    acting_branch,
    branch_scope,
    ensure_same_branch,
    scope_queryset,
    staff_branch,
    user_branch,
)
from apps.core.business_day import business_date
from apps.core.exceptions import BusinessError
from apps.core.permissions import RolePermission, is_order_taker
from apps.core.response import ok
from apps.core.serializers import OpeningBulkSerializer, OpeningSheetRowSerializer
from apps.core.viewsets import BaseModelViewSet, BranchScopedMixin, EnvelopeResponseMixin
from apps.users.constants import Role

from .models import Client, ClientVisit, Route
from .route_optimize import apply_route_order, optimize_route
from .serializers import (
    ClientLiteSerializer,
    ClientOpeningDebtSerializer,
    ClientSerializer,
    ClientVisitSerializer,
    RouteSerializer,
)
from .statement import client_statement, statement_pdf

_MANAGE = (Role.MANAGER, Role.SUPER_ADMIN)
_READ = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.DISTRIBUTOR)
# Zakaz oluvchi — faqat marshrut va mijozlarni o'qiydi (tashrif/yozish yo'q)
_CLIENTS_READ = (*_READ, Role.ORDER_TAKER)
_CLIENTS_CREATE = (*_MANAGE, Role.DISTRIBUTOR, Role.ORDER_TAKER)


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
        before = serializer.instance.branch_id
        self._save_in_branch(serializer)
        route = serializer.instance
        if route.branch_id != before:
            # Marshrut filialga o'tkazildi — uning mijozlari ham birga o'tadi
            Client.objects.filter(route=route).update(branch_id=route.branch_id)

    @extend_schema(
        summary="Marshrutni optimallashtirish taklifi (v5: C4) — yozmaydi",
        parameters=[OpenApiParameter("start_lat", float, required=False),
                    OpenApiParameter("start_lng", float, required=False)],
        responses={200: dict},
    )
    @action(detail=True, methods=["get"])
    def optimize(self, request: Request, pk: str | None = None) -> Response:
        route = self.get_object()
        start = None
        lat, lng = request.query_params.get("start_lat"), request.query_params.get("start_lng")
        if lat and lng:
            try:
                start = (float(lat), float(lng))
            except ValueError as exc:
                raise BusinessError(message="Boshlanish nuqtasi noto'g'ri.",
                                    code="INVALID_START") from exc
        return ok(optimize_route(route, start=start))

    @extend_schema(
        summary="Marshrutdagi tashrif tartibini saqlash (v5: C4)",
        request={"application/json": {"type": "object", "properties": {
            "clients": {"type": "array", "items": {"type": "string"}}}}},
        responses={200: dict},
    )
    @action(detail=True, methods=["post"])
    def reorder(self, request: Request, pk: str | None = None) -> Response:
        route = self.get_object()
        ids = request.data.get("clients")
        if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
            raise BusinessError(message="Mijozlar ro'yxati kerak.", code="INVALID_ORDER")
        count = apply_route_order(route, ids, user=request.user)
        return ok({"route": str(route.id), "clients": count})

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


_AUDITED_CLIENT_FIELDS = ("is_blocked", "debt_limit", "branch", "route")


_CLIENTS_WRITE = (*_MANAGE, Role.DISTRIBUTOR, Role.ORDER_TAKER)


class ClientViewSet(BaseModelViewSet):
    serializer_class = ClientSerializer
    write_roles = _CLIENTS_WRITE
    read_roles = _CLIENTS_READ
    filterset_fields = ("route", "client_type", "is_blocked")
    search_fields = ("name", "owner_name", "phone", "phone2", "inn")
    # Admin jadvalidagi har bir ustun (UI: shared/table)
    ordering_fields = (
        "name", "owner_name", "phone", "route__name", "route_order", "current_debt",
        "debt_limit", "is_blocked", "created_at",
    )
    action_roles = {
        "create": _CLIENTS_CREATE,
        "opening_balance": (*_MANAGE, Role.ACCOUNTANT),
        "opening_sheet": (*_MANAGE, Role.ACCOUNTANT),
        "opening_balance_bulk": (*_MANAGE, Role.ACCOUNTANT),
        "statement": _CLIENTS_READ,
    }
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
        user = self.request.user
        role = getattr(user, "role", None)
        if role in (Role.DISTRIBUTOR, Role.ORDER_TAKER) and not user.is_superuser:
            route = serializer.validated_data.get("route")
            if route is None:
                own_filter = _own_routes(user)
                own_qs = Route.objects.filter(own_filter, is_active=True) if own_filter else Route.objects.none()
                if own_qs.count() == 1:
                    serializer.validated_data["route"] = own_qs.first()
                else:
                    raise BusinessError(
                        message="Marshrutingizni tanlang.",
                        code="ROUTE_REQUIRED",
                    )
            else:
                if role == Role.DISTRIBUTOR and route.distributor_id != user.id:
                    raise BusinessError(
                        message="Faqat o'zingizga biriktirilgan marshrutga mijoz qo'shishingiz mumkin.",
                        code="PERMISSION_DENIED",
                    )
                if role == Role.ORDER_TAKER and route.order_taker_id != user.id:
                    raise BusinessError(
                        message="Faqat o'zingizga biriktirilgan marshrutga mijoz qo'shishingiz mumkin.",
                        code="PERMISSION_DENIED",
                    )
        self._save_in_branch(serializer, created_by=self.request.user)

    def perform_update(self, serializer) -> None:
        user = self.request.user
        role = getattr(user, "role", None)
        if role in (Role.DISTRIBUTOR, Role.ORDER_TAKER) and not user.is_superuser:
            instance = serializer.instance
            if role == Role.DISTRIBUTOR and (not instance.route or instance.route.distributor_id != user.id):
                raise BusinessError(
                    message="Faqat o'zingizga biriktirilgan marshrutdagi mijozni tahrirlashingiz mumkin.",
                    code="PERMISSION_DENIED",
                    status_code=403,
                )
            if role == Role.ORDER_TAKER and (not instance.route or instance.route.order_taker_id != user.id):
                raise BusinessError(
                    message="Faqat o'zingizga biriktirilgan marshrutdagi mijozni tahrirlashingiz mumkin.",
                    code="PERMISSION_DENIED",
                    status_code=403,
                )
            for field in ("debt_limit", "is_blocked", "branch", "route"):
                if field in serializer.validated_data and serializer.validated_data[field] != getattr(instance, field):
                    raise BusinessError(
                        message=f"{field} maydonini o'zgartirishga ruxsat yo'q.",
                        code="PERMISSION_DENIED",
                        status_code=403,
                    )
        # bloklash va qarz limiti — CLAUDE.md 5.3 bo'yicha audit (BE-112)
        changes = diff_fields(
            serializer.instance, _AUDITED_CLIENT_FIELDS, serializer.validated_data
        )
        self._save_in_branch(serializer)
        if changes:
            write_audit(self.request, "client.updated", serializer.instance, changes)

    def perform_destroy(self, instance) -> None:
        user = self.request.user
        if getattr(user, "role", None) in (Role.DISTRIBUTOR, Role.ORDER_TAKER) and not user.is_superuser:
            raise BusinessError(
                message="Mijozni o'chirishga ruxsat yo'q.",
                code="PERMISSION_DENIED",
                status_code=403,
            )
        write_audit(self.request, "client.deleted", instance, {"name": instance.name})
        super().perform_destroy(instance)

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

    @extend_schema(
        summary="Solishtirma dalolatnoma (akt-sverka) — v5: C2",
        parameters=[
            OpenApiParameter("date_from", str, required=False),
            OpenApiParameter("date_to", str, required=False),
            OpenApiParameter("fmt", str, required=False, enum=["json", "pdf"]),
        ],
        responses={200: dict},
    )
    @action(detail=True, methods=["get"])
    def statement(self, request: Request, pk: str | None = None):
        client = self.get_object()
        today = business_date()
        date_from = parse_date(request.query_params.get("date_from", "")) or today.replace(
            month=1, day=1
        )
        date_to = parse_date(request.query_params.get("date_to", "")) or today
        if date_from > date_to:
            raise BusinessError(message="Boshlanish sanasi tugashdan keyin bo'lmasin.",
                                code="INVALID_PERIOD")
        data = client_statement(client, date_from=date_from, date_to=date_to)
        if request.query_params.get("fmt") != "pdf":
            return ok(data)
        response = HttpResponse(statement_pdf(data), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="akt-sverka-{date_from:%Y%m%d}-{date_to:%Y%m%d}.pdf"'
        )
        return response

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

        rows = client_opening_sheet(branch=acting_branch(request.user))
        return ok(OpeningSheetRowSerializer(rows, many=True).data)

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
            user=request.user, branch=acting_branch(request.user),
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
        if acting_branch(request.user) is not None:
            ensure_same_branch(request.user, data["client"].branch_id, "client")
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
    read_roles = _CLIENTS_READ
    write_roles = (Role.DISTRIBUTOR, Role.ORDER_TAKER)
    branch_lookup = "distributor__warehouse"
    filterset_fields = ("client", "result")
    ordering = ("-checked_in_at",)

    def get_queryset(self) -> QuerySet[ClientVisit]:
        qs = ClientVisit.objects.select_related("client", "distributor")
        user = self.request.user
        if _is_distributor(user) or is_order_taker(user):
            return qs.filter(distributor=user)
        return qs

    def perform_create(self, serializer: ClientVisitSerializer) -> None:
        client = serializer.validated_data["client"]
        user = self.request.user
        from apps.sales.services.sale import ensure_client_in_scope
        ensure_client_in_scope(user, client)
        if _is_distributor(user) and (
            client.route_id is None
            or client.route.distributor_id != user.id
        ):
            raise BusinessError(
                message="Bu mijoz sizning marshrutingizda emas.",
                code="CLIENT_NOT_ON_ROUTE",
                status_code=403,
            )
        if is_order_taker(user) and (
            client.route_id is None
            or client.route.order_taker_id != user.id
        ):
            raise BusinessError(
                message="Bu mijoz sizning marshrutingizda emas.",
                code="CLIENT_NOT_ON_ROUTE",
                status_code=403,
            )
        serializer.save(
            distributor=user,
            created_by=user,
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
