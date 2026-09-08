from rest_framework.routers import SimpleRouter

from .views import AdvanceViewSet, CommissionRuleViewSet, PayrollViewSet

router = SimpleRouter()
router.register("payrolls", PayrollViewSet, basename="payroll")
router.register("commission-rules", CommissionRuleViewSet, basename="commission-rule")
router.register("advances", AdvanceViewSet, basename="advance")

urlpatterns = router.urls
