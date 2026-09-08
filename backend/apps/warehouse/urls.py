from rest_framework.routers import SimpleRouter

from .views import (
    LoadingViewSet,
    PurchaseViewSet,
    StockMovementViewSet,
    StockViewSet,
    SupplierViewSet,
    VanStockViewSet,
    WarehouseViewSet,
)

router = SimpleRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("purchases", PurchaseViewSet, basename="purchase")
router.register("stock", StockViewSet, basename="stock")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")
router.register("loadings", LoadingViewSet, basename="loading")
router.register("van-stock", VanStockViewSet, basename="van-stock")

urlpatterns = router.urls
