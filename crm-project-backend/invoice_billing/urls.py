from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InvoiceViewSet, BillOfSupplyViewSet, DeliveryChallanViewSet, AdvancePaymentReceiptViewSet

router = DefaultRouter()
router.register(r'advance-receipts', AdvancePaymentReceiptViewSet, basename='advance-receipt')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'bill-of-supply', BillOfSupplyViewSet, basename='bill-of-supply')
router.register(r'delivery-challans', DeliveryChallanViewSet, basename='delivery-challan')

urlpatterns = [
    path('', include(router.urls)),
]
