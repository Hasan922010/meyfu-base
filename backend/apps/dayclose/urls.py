from rest_framework.routers import SimpleRouter

from .views import CashHandoverViewSet, DailyReturnViewSet, DayCloseViewSet

router = SimpleRouter()
router.register("day-close", DayCloseViewSet, basename="day-close")
router.register("cash-handovers", CashHandoverViewSet, basename="cash-handover")
router.register("daily-returns", DailyReturnViewSet, basename="daily-return")

urlpatterns = router.urls
