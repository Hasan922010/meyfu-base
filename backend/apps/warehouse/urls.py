from rest_framework.routers import SimpleRouter

from .views import (
    InventoryCountViewSet,
    LoadingViewSet,
    PurchaseViewSet,
    StockMovementViewSet,
    StockViewSet,
    SupplierTransactionViewSet,
    SupplierViewSet,
    TransferViewSet,
    VanStockViewSet,
    WarehouseViewSet,
)

router = SimpleRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register(
    "supplier-transactions", SupplierTransactionViewSet, basename="supplier-transaction"
)
router.register("purchases", PurchaseViewSet, basename="purchase")
router.register("stock", StockViewSet, basename="stock")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")
router.register("loadings", LoadingViewSet, basename="loading")
router.register("inventory-counts", InventoryCountViewSet, basename="inventory-count")
router.register("transfers", TransferViewSet, basename="transfer")
router.register("van-stock", VanStockViewSet, basename="van-stock")

urlpatterns = router.urls
