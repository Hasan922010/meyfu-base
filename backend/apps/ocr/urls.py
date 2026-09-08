from rest_framework.routers import SimpleRouter

from .views import InvoiceScanViewSet, ReceiptScanView

router = SimpleRouter()
router.register("invoice-scans", InvoiceScanViewSet, basename="invoice-scan")
router.register("receipt-scan", ReceiptScanView, basename="receipt-scan")

urlpatterns = router.urls
