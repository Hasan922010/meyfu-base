from django.urls import path
from rest_framework.routers import SimpleRouter

from .audit_views import AuditLogViewSet, SyncLogViewSet
from .backup_views import (
    BackupDeleteView,
    BackupDownloadView,
    BackupListView,
    BackupRestoreView,
    BackupUploadView,
)
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
    path("system/backups/", BackupListView.as_view(), name="backup-list"),
    path("system/backups/create/", BackupListView.as_view(), name="backup-create"),
    path("system/backups/upload/", BackupUploadView.as_view(), name="backup-upload"),
    path("system/backups/<str:filename>/download/", BackupDownloadView.as_view(), name="backup-download"),
    path("system/backups/<str:filename>/restore/", BackupRestoreView.as_view(), name="backup-restore"),
    path("system/backups/<str:filename>/", BackupDeleteView.as_view(), name="backup-delete"),
    path("company-settings/", CompanySettingsView.as_view(), name="company-settings"),
    path("company/public/", CompanyPublicView.as_view(), name="company-public"),
]

router = SimpleRouter()
router.register("audit-logs", AuditLogViewSet, basename="audit-log")
router.register("sync-logs", SyncLogViewSet, basename="sync-log")
urlpatterns += router.urls
