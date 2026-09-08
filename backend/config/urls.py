from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.users.urls import root_urlpatterns as users_root_urls

api_v1 = [
    path("auth/", include("apps.users.urls")),
    path("", include(users_root_urls)),
    path("", include("apps.core.urls")),
    path("", include("apps.catalog.urls")),
    path("", include("apps.warehouse.urls")),
    path("", include("apps.clients.urls")),
    path("", include("apps.sales.urls")),
    path("", include("apps.orders.urls")),
    path("", include("apps.dayclose.urls")),
    path("", include("apps.wallet.urls")),
    path("", include("apps.expenses.urls")),
    path("", include("apps.finance.urls")),
    path("", include("apps.reports.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.telegram_bot.urls")),
    path("", include("apps.ocr.urls")),
    path("", include("apps.payroll.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "v1"))),
    # Swagger / OpenAPI
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
