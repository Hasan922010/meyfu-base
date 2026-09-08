from django.urls import path

from .views import (
    CompanyPublicView,
    CompanySettingsView,
    HealthView,
    IntegrityCheckView,
    SystemStatusView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("system/status/", SystemStatusView.as_view(), name="system-status"),
    path("system/integrity/", IntegrityCheckView.as_view(), name="system-integrity"),
    path("company-settings/", CompanySettingsView.as_view(), name="company-settings"),
    path("company/public/", CompanyPublicView.as_view(), name="company-public"),
]
