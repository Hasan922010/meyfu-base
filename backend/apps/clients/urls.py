from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import (
    ClientSyncView,
    ClientViewSet,
    ClientVisitViewSet,
    RouteViewSet,
)

router = SimpleRouter()
router.register("clients", ClientViewSet, basename="client")
router.register("routes", RouteViewSet, basename="route")
router.register("client-visits", ClientVisitViewSet, basename="client-visit")

urlpatterns = [
    path("sync/clients/", ClientSyncView.as_view(), name="clients-sync"),
    path("", include(router.urls)),
]
