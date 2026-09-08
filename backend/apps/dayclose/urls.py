from rest_framework.routers import SimpleRouter

from .views import CashHandoverViewSet, DayCloseViewSet

router = SimpleRouter()
router.register("day-close", DayCloseViewSet, basename="day-close")
router.register("cash-handovers", CashHandoverViewSet, basename="cash-handover")

urlpatterns = router.urls
