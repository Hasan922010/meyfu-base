from rest_framework.routers import SimpleRouter

from .views import WalletTransactionViewSet, WalletViewSet

router = SimpleRouter()
router.register("wallet", WalletViewSet, basename="wallet")
router.register("wallet-transactions", WalletTransactionViewSet,
                basename="wallet-transaction")

urlpatterns = router.urls
