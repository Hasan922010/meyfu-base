from django.urls import path

from .views import (
    AbcAnalysisView,
    DashboardView,
    DebtAgingView,
    DistributorComparisonView,
    DistributorFullView,
    DistributorTimelineView,
    ExpensesReportView,
    ProfitView,
    ReportExportView,
    ReportQueryView,
    SalesSummaryView,
)

urlpatterns = [
    path("reports/dashboard/", DashboardView.as_view(), name="reports-dashboard"),
    path("reports/sales-summary/", SalesSummaryView.as_view(),
         name="reports-sales-summary"),
    path("reports/debt-aging/", DebtAgingView.as_view(), name="reports-debt-aging"),
    path("reports/profit/", ProfitView.as_view(), name="reports-profit"),
    path("reports/expenses/", ExpensesReportView.as_view(), name="reports-expenses"),
    path("reports/query/", ReportQueryView.as_view(), name="reports-query"),
    path("reports/abc/", AbcAnalysisView.as_view(), name="reports-abc"),
    path("reports/distributor-comparison/", DistributorComparisonView.as_view(),
         name="reports-distributor-comparison"),
    path("reports/distributor/<uuid:pk>/full/", DistributorFullView.as_view(),
         name="reports-distributor-full"),
    path("reports/distributor/<uuid:pk>/timeline/",
         DistributorTimelineView.as_view(), name="reports-distributor-timeline"),
    path("reports/export/", ReportExportView.as_view(), name="reports-export"),
]
