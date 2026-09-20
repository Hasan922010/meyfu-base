from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth.decorators import login_required, user_passes_test
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

def _docs_view(view_class, **kwargs):
    view = view_class.as_view(**kwargs)
    # Evaluate DEBUG per request so preview/test overrides are honored even
    # when URLConf was imported before the setting was changed.
    return login_required(
        user_passes_test(lambda user: settings.DEBUG or user.is_staff)(view)
    )


urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/v1/", include((api_v1, "v1"))),
    # Swagger / OpenAPI
    path("api/schema/", _docs_view(SpectacularAPIView), name="schema"),
    path(
        "api/docs/",
        _docs_view(SpectacularSwaggerView, url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        _docs_view(SpectacularRedocView, url_name="schema"),
        name="redoc",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
