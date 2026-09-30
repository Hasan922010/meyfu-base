from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import (
    BranchPriceViewSet,
    BrandViewSet,
    CatalogSyncView,
    CategoryViewSet,
    ProductViewSet,
    UnitViewSet,
)

router = SimpleRouter()
router.register("products", ProductViewSet, basename="product")
router.register("categories", CategoryViewSet, basename="category")
router.register("brands", BrandViewSet, basename="brand")
router.register("units", UnitViewSet, basename="unit")
router.register("branch-prices", BranchPriceViewSet, basename="branch-price")

urlpatterns = [
    path("sync/catalog/", CatalogSyncView.as_view(), name="catalog-sync"),
    path("", include(router.urls)),
]
