from __future__ import annotations

from uuid import UUID

from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.branch import NO_BRANCH, branch_scope, scope_queryset
from apps.core.business_day import business_date
from apps.core.models import AuditLog
from apps.core.permissions import RolePermission
from apps.core.response import ok
from apps.users.constants import Role

from .export import rows_to_xlsx
from .pdf import rows_to_pdf
from .services import (
    DIMENSIONS,
    abc_analysis,
    abc_rows_for_export,
    dashboard,
    debt_aging,
    distributor_comparison,
    distributor_full,
    distributor_rows_for_export,
    distributor_timeline,
    expenses_report,
    pnl_rows_for_export,
    profit_and_loss,
    report_query,
    report_query_rows_for_export,
    resolve_period,
    sales_rows_for_export,
    sales_summary,
)
from .services.branch import (
    KINDS as BRANCH_KINDS,
)
from .services.branch_compare import branch_comparison, comparison_rows_for_export
from .services.expense_anomalies import expense_anomalies
from .services.locations import distributor_locations
from .services.onec import export_1c_csv, export_1c_xml
from .services.reorder import reorder_suggestions
from .services.branch import (
    branch_activity,
    branch_activity_rows_for_export,
    branch_cards,
    branch_list,
)

User = get_user_model()

_REPORT_ROLES = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)
_NOWHERE = UUID(int=0)  # filialsiz filial rahbari — bo'sh hisobot


def report_branch(user):
    """Hisobot filiali: `None` — butun kompaniya (markaz), aks holda filial ID."""
    scope = branch_scope(user)
    return _NOWHERE if scope is NO_BRANCH else scope


class _ReportView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _REPORT_ROLES
    write_roles = _REPORT_ROLES

    def _scope(self, request: Request):
        return report_branch(request.user)

    def _range(self, request: Request):
        today = business_date()
        df = parse_date(request.query_params.get("date_from", "")) or today.replace(day=1)
        dt = parse_date(request.query_params.get("date_to", "")) or today
        return df, dt


class DashboardView(_ReportView):
    @extend_schema(
        summary="Boshqaruv paneli KPI (bugun)",
        parameters=[OpenApiParameter("date", str, required=False)],
        request=None,
        responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        day = parse_date(request.query_params.get("date", "")) or business_date()
        return ok(dashboard(day=day, branch=self._scope(request)))


class SalesSummaryView(_ReportView):
    @extend_schema(
        summary="Sotuv xulosasi",
        parameters=[
            OpenApiParameter("group_by", str, required=False,
                             enum=["day", "distributor", "product", "client"]),
            OpenApiParameter("date_from", str, required=False),
            OpenApiParameter("date_to", str, required=False),
        ],
        request=None,
        responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        df, dt = self._range(request)
        group_by = request.query_params.get("group_by", "day")
        return ok({
            "group_by": group_by,
            "date_from": str(df),
            "date_to": str(dt),
            "rows": sales_summary(date_from=df, date_to=dt, group_by=group_by,
                                  branch=self._scope(request)),
        })


class DebtAgingView(_ReportView):
    @extend_schema(summary="Qarzdorlik yoshi (aging)", request=None,
                   responses={200: dict})
    def get(self, request: Request) -> Response:
        return ok(debt_aging(branch=self._scope(request)))


class ProfitView(_ReportView):
    @extend_schema(
        summary="Foyda-zarar",
        parameters=[
            OpenApiParameter("date_from", str, required=False),
            OpenApiParameter("date_to", str, required=False),
        ],
        request=None, responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        df, dt = self._range(request)
        return ok(profit_and_loss(date_from=df, date_to=dt, branch=self._scope(request)))


class ExpensesReportView(_ReportView):
    @extend_schema(
        summary="Xarajatlar hisoboti",
        parameters=[
            OpenApiParameter("date_from", str, required=False),
            OpenApiParameter("date_to", str, required=False),
        ],
        request=None, responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        df, dt = self._range(request)
        return ok(expenses_report(date_from=df, date_to=dt, branch=self._scope(request)))


_PERIOD_PARAMS = [
    OpenApiParameter(
        "preset", str, required=False,
        enum=["today", "yesterday", "week", "month", "last_month",
              "quarter", "year", "custom"],
    ),
    OpenApiParameter("date_from", str, required=False),
    OpenApiParameter("date_to", str, required=False),
]


def _period(request: Request):
    return (
        request.query_params.get("preset"),
        parse_date(request.query_params.get("date_from", "")),
        parse_date(request.query_params.get("date_to", "")),
    )


class _DistributorScopedView(APIView):
    """MANAGER/ADMIN/ACCOUNTANT — istalgan tarqatuvchi; DISTRIBUTOR — faqat o'zi."""

    permission_classes = [IsAuthenticated]

    def _distributor(self, request: Request, pk: str):
        user = request.user
        is_dist = (
            getattr(user, "role", None) == Role.DISTRIBUTOR and not user.is_superuser
        )
        if is_dist:
            if str(pk) != str(user.id):
                raise PermissionDenied("Boshqa xodim ma'lumotini ko'rish mumkin emas.")
            return user
        allowed = (*_REPORT_ROLES, Role.SUPER_ADMIN, Role.BRANCH_MANAGER)
        if getattr(user, "role", None) not in allowed and not user.is_superuser:
            raise PermissionDenied("Ruxsat yo'q.")
        # Filial rahbari — faqat o'z filiali tarqatuvchisi
        distributors = scope_queryset(
            User.objects.filter(role=Role.DISTRIBUTOR), user, "warehouse"
        )
        return get_object_or_404(distributors, pk=pk)


class DistributorFullView(_DistributorScopedView):
    @extend_schema(summary="360° xodim kartasi", parameters=_PERIOD_PARAMS,
                   request=None, responses={200: dict})
    def get(self, request: Request, pk: str) -> Response:
        distributor = self._distributor(request, pk)
        preset, df, dt = _period(request)
        return ok(distributor_full(
            distributor, preset=preset, date_from=df, date_to=dt
        ))


class DistributorTimelineView(_DistributorScopedView):
    @extend_schema(summary="Xodim kunlik jurnali", parameters=_PERIOD_PARAMS,
                   request=None, responses={200: dict})
    def get(self, request: Request, pk: str) -> Response:
        distributor = self._distributor(request, pk)
        preset, df, dt = _period(request)
        start, end, *_ = resolve_period(preset, df, dt)
        return ok({
            "date_from": str(start),
            "date_to": str(end),
            "rows": distributor_timeline(distributor, start, end),
        })


# Filiallar — admin rollar hammasini, omborchi faqat o'z omborini ko'radi
_BRANCH_ROLES = (*_REPORT_ROLES, Role.WAREHOUSE)


def _branch_queryset(user):
    from apps.warehouse.models import Warehouse

    qs = scope_queryset(Warehouse.objects.filter(is_active=True), user, "pk")
    if getattr(user, "role", None) == Role.WAREHOUSE and not user.is_superuser:
        if user.warehouse_id:
            qs = qs.filter(pk=user.warehouse_id)
    return qs


def _branch(request: Request, pk):
    return get_object_or_404(_branch_queryset(request.user), pk=pk)


class _BranchView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _BRANCH_ROLES


class BranchListView(_BranchView):
    @extend_schema(summary="Filiallar (omborlar) kartochkalari", request=None,
                   responses={200: dict})
    def get(self, request: Request) -> Response:
        return ok(branch_list(_branch_queryset(request.user), business_date()))


class BranchCardsView(_BranchView):
    @extend_schema(summary="Filial faoliyati — kartalar", parameters=_PERIOD_PARAMS,
                   request=None, responses={200: dict})
    def get(self, request: Request, pk: str) -> Response:
        warehouse = _branch(request, pk)
        preset, df, dt = _period(request)
        start, end, prev_start, prev_end, _label = resolve_period(preset, df, dt)
        return ok(branch_cards(warehouse, start, end, prev_start, prev_end))


def _branch_kind(request: Request) -> str:
    kind = request.query_params.get("kind", "")
    if kind not in BRANCH_KINDS:
        raise ValidationError({"kind": f"Noma'lum bo'lim: {kind or '—'}."})
    return kind


class BranchActivityView(_BranchView):
    @extend_schema(
        summary="Filial faoliyati — batafsil hisobot (hujjatlar bilan)",
        parameters=[*_PERIOD_PARAMS, OpenApiParameter("kind", str, required=True,
                                                      enum=list(BRANCH_KINDS))],
        request=None, responses={200: dict},
    )
    def get(self, request: Request, pk: str) -> Response:
        warehouse = _branch(request, pk)
        kind = _branch_kind(request)
        preset, df, dt = _period(request)
        start, end, *_ = resolve_period(preset, df, dt)
        return ok(branch_activity(warehouse, kind, start, end))


class BranchComparisonView(_ReportView):
    """Filiallarni solishtirish + markaz bilan hisob-kitob. Filial xodimi — o'z qatori."""

    @extend_schema(summary="Filiallar kesimida solishtirish va hisob-kitob",
                   parameters=_PERIOD_PARAMS, request=None, responses={200: dict})
    def get(self, request: Request) -> Response:
        preset, df, dt = _period(request)
        start, end, *_ = resolve_period(preset, df, dt)
        scope = self._scope(request)
        return ok(branch_comparison(
            start, end, branch_ids=None if scope is None else [scope]
        ))


class DistributorComparisonView(_ReportView):
    @extend_schema(summary="Tarqatuvchilarni solishtirish + reyting",
                   parameters=_PERIOD_PARAMS, request=None, responses={200: dict})
    def get(self, request: Request) -> Response:
        preset, df, dt = _period(request)
        return ok(distributor_comparison(
            preset=preset, date_from=df, date_to=dt, branch=self._scope(request)
        ))


_QUERY_FILTERS = ("distributor", "product", "category", "client", "route",
                  "payment_type")


def _query_filters(request: Request) -> dict:
    return {
        name: request.query_params.get(name)
        for name in _QUERY_FILTERS
        if request.query_params.get(name)
    }


class ReportQueryView(_ReportView):
    @extend_schema(
        summary="Hisobot konstruktori — o'lcham bo'yicha agregatsiya",
        parameters=[
            OpenApiParameter("dimension", str, required=True,
                             enum=list(DIMENSIONS)),
            OpenApiParameter("date_from", str, required=False),
            OpenApiParameter("date_to", str, required=False),
            *[OpenApiParameter(f, str, required=False) for f in _QUERY_FILTERS],
        ],
        request=None, responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        df, dt = self._range(request)
        return ok(report_query(
            dimension=request.query_params.get("dimension", "product"),
            date_from=df, date_to=dt, filters=_query_filters(request),
            branch=self._scope(request),
        ))


class AbcAnalysisView(_ReportView):
    @extend_schema(
        summary="ABC (Pareto) tahlil",
        parameters=[
            OpenApiParameter("dimension", str, required=False,
                             enum=["product", "client", "category"]),
            OpenApiParameter("date_from", str, required=False),
            OpenApiParameter("date_to", str, required=False),
        ],
        request=None, responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        df, dt = self._range(request)
        return ok(abc_analysis(
            dimension=request.query_params.get("dimension", "product"),
            date_from=df, date_to=dt, branch=self._scope(request),
        ))


_XLSX_CT = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)


class ReportExportView(_ReportView):
    @extend_schema(
        summary="Hisobot eksporti (Excel yoki PDF)",
        parameters=[
            OpenApiParameter("type", str, required=False,
                             enum=["sales", "distributor", "query", "abc", "pnl"]),
            OpenApiParameter("fmt", str, required=False, enum=["xlsx", "pdf"]),
            OpenApiParameter("dimension", str, required=False),
            OpenApiParameter("distributor", str, required=False),
            OpenApiParameter("preset", str, required=False),
            OpenApiParameter("date_from", str, required=False),
            OpenApiParameter("date_to", str, required=False),
        ],
        request=None,
        responses={(200, _XLSX_CT): bytes, (200, "application/pdf"): bytes},
    )
    def get(self, request: Request) -> HttpResponse:
        df, dt = self._range(request)
        report_type = request.query_params.get("type", "sales")
        fmt = request.query_params.get("fmt", "xlsx")
        branch = self._scope(request)

        if report_type == "distributor":
            preset, pdf_, pdt = _period(request)
            start, end, *_ = resolve_period(preset, pdf_ or df, pdt or dt)
            distributor = get_object_or_404(
                scope_queryset(
                    User.objects.filter(role=Role.DISTRIBUTOR), request.user, "warehouse"
                ),
                pk=request.query_params.get("distributor", ""),
            )
            rows = distributor_rows_for_export(distributor, start, end)
            base = f"xodim_{distributor.full_name}_{start}_{end}"
            title = f"Xodim kunlik jurnali · {distributor.full_name}"
        elif report_type == "branch":
            preset, pdf_, pdt = _period(request)
            start, end, *_ = resolve_period(preset, pdf_ or df, pdt or dt)
            warehouse = _branch(request, request.query_params.get("branch", ""))
            payload = branch_activity(warehouse, _branch_kind(request), start, end)
            rows = branch_activity_rows_for_export(payload)
            base = f"filial_{warehouse.name}_{payload['kind']}_{start}_{end}"
            title = f"{warehouse.name} · {payload['label']} · {start} – {end}"
        elif report_type == "branches":
            preset, pdf_, pdt = _period(request)
            start, end, *_ = resolve_period(preset, pdf_ or df, pdt or dt)
            payload = branch_comparison(
                start, end, branch_ids=None if branch is None else [branch]
            )
            rows = comparison_rows_for_export(payload)
            base = f"filiallar_{start}_{end}"
            title = f"Filiallar solishtirmasi · {start} – {end}"
        elif report_type == "query":
            payload = report_query(
                dimension=request.query_params.get("dimension", "product"),
                date_from=df, date_to=dt, filters=_query_filters(request),
                branch=branch,
            )
            rows = report_query_rows_for_export(payload)
            base = f"hisobot_{payload['dimension']}_{df}_{dt}"
            title = f"Hisobot · {payload['key']} · {df} – {dt}"
        elif report_type == "abc":
            payload = abc_analysis(
                dimension=request.query_params.get("dimension", "product"),
                date_from=df, date_to=dt, branch=branch,
            )
            rows = abc_rows_for_export(payload)
            base = f"abc_{payload['dimension']}_{df}_{dt}"
            title = f"ABC tahlil · {payload['key']} · {df} – {dt}"
        elif report_type == "pnl":
            payload = profit_and_loss(date_from=df, date_to=dt, branch=branch)
            rows = pnl_rows_for_export(payload)
            base = f"foyda_zarar_{df}_{dt}"
            title = f"Foyda-zarar · {df} – {dt}"
        elif report_type == "sales":
            rows = sales_rows_for_export(date_from=df, date_to=dt, branch=branch)
            base = f"sotuvlar_{df}_{dt}"
            title = f"Sotuvlar · {df} – {dt}"
        else:
            rows = [["Noma'lum hisobot turi"]]
            base = "hisobot"
            title = "Hisobot"

        if fmt == "pdf":
            content = rows_to_pdf(rows, title=title)
            response = HttpResponse(content, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="{base}.pdf"'
            return response

        content = rows_to_xlsx(rows, sheet_name=title[:31])
        response = HttpResponse(content, content_type=_XLSX_CT)
        response["Content-Disposition"] = f'attachment; filename="{base}.xlsx"'
        return response


def _int_param(request: Request, name: str, default: int) -> int:
    raw = request.query_params.get(name, "")
    try:
        return int(raw) if raw else default
    except ValueError as exc:
        raise ValidationError({name: "Butun son kiriting."}) from exc


class ReorderView(_ReportView):
    """Buyurtma tavsiyasi (v5: C1) — omborchi ham ko'radi, o'z filiali bo'yicha."""

    read_roles = _BRANCH_ROLES

    @extend_schema(
        summary="Qoldiq prognozi va buyurtma tavsiyasi",
        parameters=[
            OpenApiParameter("days", int, required=False,
                             description="O'rtacha sotuv davri (7–180, default 28)"),
            OpenApiParameter("cover", int, required=False,
                             description="Necha kunlik zaxira kerak (1–90, default 14)"),
        ],
        request=None, responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        return ok(reorder_suggestions(
            branch=self._scope(request),
            days=_int_param(request, "days", 28),
            cover_days=_int_param(request, "cover", 14),
        ))


class ExpenseAnomaliesView(_ReportView):
    """Odatdagidan ancha katta xarajatlar (v5: C5) — ko'rib chiqish uchun signal."""

    @extend_schema(
        summary="Xarajat anomaliyalari (z-score)",
        parameters=[
            OpenApiParameter("date_from", str, required=False),
            OpenApiParameter("date_to", str, required=False),
        ],
        request=None, responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        df, dt = self._range(request)
        return ok(expense_anomalies(date_from=df, date_to=dt, branch=self._scope(request)))


class OneCExportView(_ReportView):
    """1C uchun fayl eksporti — XML yoki CSV (v5: C6)."""

    @extend_schema(
        summary="1C uchun eksport (sotuv, qaytarish, to'lov)",
        parameters=[
            OpenApiParameter("date_from", str, required=False),
            OpenApiParameter("date_to", str, required=False),
            OpenApiParameter("fmt", str, required=False, enum=["xml", "csv"]),
        ],
        request=None,
        responses={(200, "application/xml"): bytes, (200, "text/csv"): bytes},
    )
    def get(self, request: Request) -> HttpResponse:
        df, dt = self._range(request)
        fmt = request.query_params.get("fmt", "xml")
        if fmt not in ("xml", "csv"):
            raise ValidationError({"fmt": "xml yoki csv bo'lishi kerak."})
        branch = self._scope(request)
        if fmt == "csv":
            content = export_1c_csv(date_from=df, date_to=dt, branch=branch)
            content_type = "text/csv; charset=utf-8"
        else:
            content = export_1c_xml(date_from=df, date_to=dt, branch=branch)
            content_type = "application/xml; charset=utf-8"
        AuditLog.objects.create(
            user=request.user, action="export.1c", model_name="Sale",
            changes={"fmt": fmt, "date_from": df.isoformat(), "date_to": dt.isoformat()},
        )
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = (
            f'attachment; filename="1c-{df:%Y%m%d}-{dt:%Y%m%d}.{fmt}"'
        )
        return response


class DistributorLocationsView(_ReportView):
    """Tarqatuvchilarning bugungi oxirgi nuqtasi (faqat tashrif/sotuv paytida) — v5: B2."""

    @extend_schema(
        summary="Tarqatuvchilar xaritasi (oxirgi tashrif/sotuv nuqtasi)",
        parameters=[OpenApiParameter("date", str, required=False)],
        request=None, responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        day = parse_date(request.query_params.get("date", "")) or business_date()
        return ok(distributor_locations(day=day, branch=self._scope(request)))
