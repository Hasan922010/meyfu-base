from rest_framework.routers import SimpleRouter

from .views import CashTransactionViewSet, CompanyExpenseViewSet

router = SimpleRouter()
router.register("cash-transactions", CashTransactionViewSet,
                basename="cash-transaction")
router.register("company-expenses", CompanyExpenseViewSet,
                basename="company-expense")

urlpatterns = router.urls
