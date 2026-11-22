from __future__ import annotations

import time

from django.db.models import Prefetch, QuerySet
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.catalog.models import Product
from apps.clients.models import Client
from apps.core.business_day import business_date
from apps.core.formatting import fmt_money
from apps.core.models import SyncLog
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
    collect_client_debt_payment,
    collect_debt_payment,
    create_sale,
    create_sale_return,
    process_operations,
    resolve_conflict,
)

_ADMIN = (Role.MANAGER, Role.SUPER_ADMIN)
_READ = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.DISTRIBUTOR, Role.WAREHOUSE)
_SALE_MANAGE = (*_ADMIN, Role.ACCOUNTANT)


def _is_self_only(user) -> bool:
    return (
        getattr(user, "role", None) in (Role.DISTRIBUTOR, Role.ORDER_TAKER, Role.WAREHOUSE)
        and not user.is_superuser
    )


def _resolve_products(rows: list[dict]) -> dict[str, Product]:
    ids = [r["product"] for r in rows]
    return {
        str(p.id): p
        for p in Product.objects.select_related("unit").filter(id__in=ids)
    }


class SaleViewSet(BaseModelViewSet):
    serializer_class = SaleSerializer
    branch_lookup = "branch"
    http_method_names = ["get", "post", "head", "options"]
    read_roles = _READ
    write_roles = (Role.DISTRIBUTOR, Role.MANAGER, Role.SUPER_ADMIN, Role.WAREHOUSE)
    action_roles = {
        "cancel": _SALE_MANAGE,
        "resolve": _SALE_MANAGE,
        "bulk_sync": (Role.DISTRIBUTOR, Role.ORDER_TAKER, Role.WAREHOUSE),
        "my_today": _READ,
    }
    filterset_fields = {
        "distributor": ["exact"],
        "client": ["exact"],
        "status": ["exact"],
        "payment_type": ["exact"],
        "flagged": ["exact"],
        "date": ["gte", "lte"],
    }
    search_fields = ("number", "client__name", "distributor__full_name")
    # Admin jadvalidagi har bir ustun (UI: shared/table)
    ordering_fields = (
        "number", "date", "created_at", "client__name", "distributor__full_name",
        "payment_type", "total_amount", "debt_amount", "status",
    )

    def get_queryset(self) -> QuerySet[Sale]:
        qs = Sale.objects.select_related("distributor", "client").prefetch_related(
            Prefetch("items", queryset=SaleItem.objects.select_related("product"))
        )
        if _is_self_only(self.request.user):
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
                is_bonus=bool(row.get("is_bonus", False)),
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
        started = time.monotonic()
        results = process_operations(ops, user=request.user)
        # Sinxronizatsiya jurnali (v5: B6) — offline muammolarini tahlil qilish uchun
        SyncLog.objects.create(
            user=request.user,
            device_id=request.headers.get("X-Device-Id", "")[:128]
            or getattr(request.user, "device_id", ""),
            operations_count=len(results),
            conflicts_count=sum(1 for r in results if r.get("status") == "CONFLICT"),
            errors_count=sum(1 for r in results if r.get("status") == "FAILED"),
            duration_ms=int((time.monotonic() - started) * 1000),
            created_by=request.user,
        )
        return ok({"results": results, "server_time": timezone.now().isoformat()})

    @extend_schema(summary="Bugungi sotuvlarim")
    @action(detail=False, methods=["get"], url_path="my-today")
    def my_today(self, request: Request) -> Response:
        today = business_date()
        qs = self.get_queryset().filter(
            distributor=request.user, date=today
        ).exclude(status="CANCELLED")
        return ok(SaleSerializer(qs, many=True).data)

    @extend_schema(summary="Chek ma'lumoti (WhatsApp/Telegram uchun matn)")
    @action(detail=True, methods=["get"])
    def receipt(self, request: Request, pk: str | None = None) -> Response:
        sale = self.get_object()
        lines = [
            f"{i.product.name} — {i.quantity} × {fmt_money(i.price)}"
            f" = {fmt_money(i.amount)}"
            for i in sale.items.select_related("product")
        ]
        text = (
            f"{sale.number}\n{sale.client.name}\n{sale.date:%d.%m.%Y}\n"
            + "\n".join(lines)
            + f"\n\nJami: {fmt_money(sale.total_amount)}"
            + (f"\nTo'landi: {fmt_money(sale.paid_amount)}" if sale.paid_amount else "")
            + (f"\nQarz: {fmt_money(sale.debt_amount)}" if sale.debt_amount else "")
        )
        return ok({"text": text, "sale": SaleSerializer(sale).data})


class DebtViewSet(BaseReadOnlyViewSet):
    serializer_class = DebtSerializer
    branch_lookup = "client__branch"
    read_roles = (*_READ, Role.ORDER_TAKER)
    filterset_fields = ("client", "status")
    search_fields = ("client__name", "client__phone", "sale__number")
    ordering_fields = ("created_at", "due_date", "remaining")

    def get_queryset(self) -> QuerySet[Debt]:
        from apps.clients.models import own_clients_q

        qs = Debt.objects.select_related("client", "sale")
        own = own_clients_q(self.request.user, prefix="client__")
        return qs.filter(own) if own is not None else qs

    @extend_schema(summary="Marshrutimdagi qarzdorlar")
    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request: Request) -> Response:
        from apps.clients.models import own_clients_q

        qs = (
            Debt.objects.select_related("client", "sale")
            .filter(
                status__in=["ACTIVE", "PARTIAL", "OVERDUE"],
            )
            .order_by("due_date")
        )
        own = own_clients_q(request.user, prefix="client__")
        if own is not None:
            qs = qs.filter(own)
        return ok(DebtSerializer(qs, many=True).data)

    @extend_schema(summary="Mijozlar bo'yicha umumlashtirilgan qarzlar")
    @action(detail=False, methods=["get"], url_path="by-client")
    def by_client(self, request: Request) -> Response:
        from decimal import Decimal

        from django.db.models import Q

        qs = self.get_queryset()
        client_id = (request.query_params.get("client") or "").strip()
        if client_id:
            qs = qs.filter(client_id=client_id)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(client__name__icontains=search)
                | Q(client__phone__icontains=search)
                | Q(sale__number__icontains=search)
            )
        only_open = request.query_params.get("only_open") in ("1", "true", "True")
        status_filter = (request.query_params.get("status") or "").strip()

        grouped: dict[str, dict] = {}
        for d in qs.order_by("client__name", "due_date", "created_at"):
            cid = str(d.client_id)
            g = grouped.get(cid)
            if g is None:
                g = {
                    "client": cid,
                    "client_name": d.client.name,
                    "client_phone": d.client.phone or "",
                    "debt_count": 0,
                    "amount": Decimal("0"),
                    "paid_amount": Decimal("0"),
                    "remaining": Decimal("0"),
                    "due_date": None,
                    "has_overdue": False,
                    "has_partial": False,
                    "primary_debt_id": None,
                }
                grouped[cid] = g
            g["debt_count"] += 1
            g["amount"] += d.amount
            g["paid_amount"] += d.paid_amount
            g["remaining"] += d.remaining
            if d.remaining > 0:
                if g["primary_debt_id"] is None:
                    g["primary_debt_id"] = str(d.id)
                if d.due_date is not None and (
                    g["due_date"] is None or d.due_date < g["due_date"]
                ):
                    g["due_date"] = d.due_date
                if d.status == "OVERDUE":
                    g["has_overdue"] = True
                elif d.status == "PARTIAL":
                    g["has_partial"] = True
            elif g["due_date"] is None and d.due_date is not None:
                g["due_date"] = d.due_date

        status_labels = {
            "OVERDUE": "Muddati o'tgan",
            "PARTIAL": "Qisman",
            "ACTIVE": "Faol",
            "PAID": "To'langan",
        }
        rows = []
        for g in grouped.values():
            rem = g["remaining"]
            if only_open and rem <= 0:
                continue
            if rem <= 0:
                st = "PAID"
            elif g["has_overdue"]:
                st = "OVERDUE"
            elif g["has_partial"] or g["paid_amount"] > 0:
                st = "PARTIAL"
            else:
                st = "ACTIVE"
            if status_filter and st != status_filter:
                continue
            rows.append({
                "client": g["client"],
                "client_name": g["client_name"],
                "client_phone": g["client_phone"],
                "debt_count": g["debt_count"],
                "amount": f"{g['amount']:.2f}",
                "paid_amount": f"{g['paid_amount']:.2f}",
                "remaining": f"{rem:.2f}",
                "due_date": g["due_date"].isoformat() if g["due_date"] else None,
                "status": st,
                "status_display": status_labels[st],
                "primary_debt_id": g["primary_debt_id"],
            })

        rows.sort(key=lambda r: (r["due_date"] or "9999-12-31", r["client_name"].lower()))
        page = self.paginate_queryset(rows)
        if page is not None:
            return self.get_paginated_response(page)
        return ok(rows)


class DebtPaymentViewSet(BaseModelViewSet):
    serializer_class = DebtPaymentSerializer
    branch_lookup = "debt__client__branch"
    http_method_names = ["get", "post", "head", "options"]
    read_roles = (*_READ, Role.ORDER_TAKER)
    write_roles = (
        Role.DISTRIBUTOR,
        Role.ORDER_TAKER,
        Role.WAREHOUSE,
        Role.MANAGER,
        Role.SUPER_ADMIN,
        Role.ACCOUNTANT,
    )
    filterset_fields = ("debt", "payment_type")
    search_fields = ("debt__client__name", "debt__client__phone")
    ordering_fields = ("date", "created_at")
    action_roles = {
        "cancel": (Role.SUPER_ADMIN,),
    }

    def get_queryset(self) -> QuerySet[DebtPayment]:
        qs = DebtPayment.objects.select_related("debt__client", "collected_by")
        if _is_self_only(self.request.user):
            return qs.filter(collected_by=self.request.user)
        return qs

    @extend_schema(request=DebtPaymentCreateSerializer, responses=DebtPaymentSerializer)
    def create(self, request: Request, *args, **kwargs) -> Response:
        s = DebtPaymentCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        common = dict(
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
        if data.get("debt"):
            res = collect_debt_payment(debt=Debt.objects.get(pk=data["debt"]), **common)
        else:
            from apps.clients.models import Client

            res = collect_client_debt_payment(
                client=Client.objects.get(pk=data["client"]), **common
            )
        code = 200 if res.duplicate else 201
        return ok(DebtPaymentSerializer(res.payment).data, status_code=code)

    @extend_schema(summary="Qarz to'lovini bekor qilish (faqat SuperAdmin, 24 soat ichida)",
                   responses=DebtPaymentSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk: str | None = None) -> Response:
        from .services.debt import cancel_debt_payment

        payment = self.get_object()
        cancelled = cancel_debt_payment(
            payment,
            user=request.user,
            reason=str(request.data.get("reason") or ""),
        )
        return ok(DebtPaymentSerializer(cancelled).data)


class SaleReturnViewSet(BaseModelViewSet):
    serializer_class = SaleReturnSerializer
    branch_lookup = "branch"
    http_method_names = ["get", "post", "head", "options"]
    read_roles = _READ
    write_roles = (Role.DISTRIBUTOR, Role.WAREHOUSE, Role.MANAGER, Role.SUPER_ADMIN)
    filterset_fields = ("distributor", "client", "reason")
    ordering_fields = ("date", "created_at")

    def get_queryset(self) -> QuerySet[SaleReturn]:
        qs = SaleReturn.objects.select_related("distributor", "client", "sale").prefetch_related(
            "items__product"
        )
        if _is_self_only(self.request.user):
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
