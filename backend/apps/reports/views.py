from __future__ import annotations

from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

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

User = get_user_model()

_REPORT_ROLES = (Role.MANAGER, Role.SUPER_ADMIN, Role.ACCOUNTANT)


class _ReportView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    read_roles = _REPORT_ROLES
    write_roles = _REPORT_ROLES

    def _range(self, request: Request):
        today = timezone.localdate()
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
        day = parse_date(request.query_params.get("date", "")) or timezone.localdate()
        return ok(dashboard(day=day))


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
            "rows": sales_summary(date_from=df, date_to=dt, group_by=group_by),
        })


class DebtAgingView(_ReportView):
    @extend_schema(summary="Qarzdorlik yoshi (aging)", request=None,
                   responses={200: dict})
    def get(self, request: Request) -> Response:
        return ok(debt_aging())


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
        return ok(profit_and_loss(date_from=df, date_to=dt))


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
        return ok(expenses_report(date_from=df, date_to=dt))


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
        if getattr(user, "role", None) not in (*_REPORT_ROLES, Role.SUPER_ADMIN) and (
            not user.is_superuser
        ):
            raise PermissionDenied("Ruxsat yo'q.")
        return get_object_or_404(User, pk=pk, role=Role.DISTRIBUTOR)


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


class DistributorComparisonView(_ReportView):
    @extend_schema(summary="Tarqatuvchilarni solishtirish + reyting",
                   parameters=_PERIOD_PARAMS, request=None, responses={200: dict})
    def get(self, request: Request) -> Response:
        preset, df, dt = _period(request)
        return ok(distributor_comparison(preset=preset, date_from=df, date_to=dt))


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
            date_from=df, date_to=dt,
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

        if report_type == "distributor":
            preset, pdf_, pdt = _period(request)
            start, end, *_ = resolve_period(preset, pdf_ or df, pdt or dt)
            distributor = get_object_or_404(
                User, pk=request.query_params.get("distributor", ""),
                role=Role.DISTRIBUTOR,
            )
            rows = distributor_rows_for_export(distributor, start, end)
            base = f"xodim_{distributor.full_name}_{start}_{end}"
            title = f"Xodim kunlik jurnali · {distributor.full_name}"
        elif report_type == "query":
            payload = report_query(
                dimension=request.query_params.get("dimension", "product"),
                date_from=df, date_to=dt, filters=_query_filters(request),
            )
            rows = report_query_rows_for_export(payload)
            base = f"hisobot_{payload['dimension']}_{df}_{dt}"
            title = f"Hisobot · {payload['key']} · {df} – {dt}"
        elif report_type == "abc":
            payload = abc_analysis(
                dimension=request.query_params.get("dimension", "product"),
                date_from=df, date_to=dt,
            )
            rows = abc_rows_for_export(payload)
            base = f"abc_{payload['dimension']}_{df}_{dt}"
            title = f"ABC tahlil · {payload['key']} · {df} – {dt}"
        elif report_type == "pnl":
            payload = profit_and_loss(date_from=df, date_to=dt)
            rows = pnl_rows_for_export(payload)
            base = f"foyda_zarar_{df}_{dt}"
            title = f"Foyda-zarar · {df} – {dt}"
        elif report_type == "sales":
            rows = sales_rows_for_export(date_from=df, date_to=dt)
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
