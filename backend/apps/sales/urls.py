from rest_framework.routers import SimpleRouter

from .views import (
    DebtPaymentViewSet,
    DebtViewSet,
    SaleReturnViewSet,
    SaleViewSet,
)

router = SimpleRouter()
router.register("sales", SaleViewSet, basename="sale")
router.register("sale-returns", SaleReturnViewSet, basename="sale-return")
router.register("debts", DebtViewSet, basename="debt")
router.register("debt-payments", DebtPaymentViewSet, basename="debt-payment")

urlpatterns = router.urls
