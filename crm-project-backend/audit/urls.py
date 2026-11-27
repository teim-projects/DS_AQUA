from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AuditSettingsAPIView, DeletedRecordViewSet

router = DefaultRouter()
router.register(r'deleted-records', DeletedRecordViewSet, basename='audit-deleted-records')

urlpatterns = [
    path('settings/', AuditSettingsAPIView.as_view(), name='audit-settings'),
    path('', include(router.urls)),
]
