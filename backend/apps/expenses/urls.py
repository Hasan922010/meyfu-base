from rest_framework.routers import SimpleRouter

from .views import DistributorExpenseViewSet, ExpenseCategoryViewSet

router = SimpleRouter()
router.register("expenses", DistributorExpenseViewSet, basename="expense")
router.register("expense-categories", ExpenseCategoryViewSet,
                basename="expense-category")

urlpatterns = router.urls
