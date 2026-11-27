from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .middleware import skip_audit_logging
from .models import AuditSettings, DeletedRecord
from .permissions import AuditAccessPermission
from .serializers import (
    AuditSettingsSerializer,
    DeletedRecordDetailSerializer,
    DeletedRecordListSerializer,
)
from .utils import purge_expired_records, restore_deleted_record


class AuditSettingsAPIView(APIView):
    permission_classes = [AuditAccessPermission]

    def get(self, request):
        settings_obj = AuditSettings.get_settings()
        return Response(AuditSettingsSerializer(settings_obj).data)

    def _update(self, request, partial=False):
        settings_obj = AuditSettings.get_settings()
        serializer = AuditSettingsSerializer(settings_obj, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        purged = purge_expired_records()
        data = dict(serializer.data)
        data['purged_count'] = purged
        return Response(data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)


class DeletedRecordViewSet(viewsets.ModelViewSet):
    queryset = DeletedRecord.objects.all()
    permission_classes = [AuditAccessPermission]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DeletedRecordDetailSerializer
        return DeletedRecordListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['retention_days'] = AuditSettings.get_settings().retention_days
        return ctx

    def get_queryset(self):
        qs = DeletedRecord.objects.all()
        params = self.request.query_params

        is_restored = params.get('is_restored')
        if is_restored in ('true', '1', 'True'):
            qs = qs.filter(is_restored=True)
        elif is_restored in ('false', '0', 'False'):
            qs = qs.filter(is_restored=False)

        module_label = params.get('module_label')
        if module_label and module_label != 'ALL':
            qs = qs.filter(module_label=module_label)

        search = (params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(object_repr__icontains=search)
                | Q(module_label__icontains=search)
                | Q(object_id__icontains=search)
                | Q(deleted_by_name__icontains=search)
            )

        return qs.order_by('-deleted_at', '-id')

    def list(self, request, *args, **kwargs):
        purge_expired_records()
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        purge_expired_records()
        return super().retrieve(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        with skip_audit_logging():
            return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        purge_expired_records()
        try:
            record = self.get_object()
        except Exception:
            return Response(
                {'detail': 'Deleted record not found or already expired.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            restored_rows = restore_deleted_record(record, restored_by_user=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {'detail': f'Restore failed: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = DeletedRecordDetailSerializer(record, context=self.get_serializer_context())
        return Response(
            {
                'message': f"Restored '{record.object_repr}' ({restored_rows} record(s) restored).",
                'restored_rows': restored_rows,
                'record': serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        purged_now = purge_expired_records()
        settings_obj = AuditSettings.get_settings()
        now = timezone.now()
        expiry_horizon = now - timedelta(days=max(settings_obj.retention_days - 1, 0))

        active_qs = DeletedRecord.objects.filter(is_restored=False)
        expiring_soon = active_qs.filter(deleted_at__lte=expiry_horizon).count()

        module_counts = list(
            active_qs.values('module_label')
            .annotate(count=Count('id'))
            .order_by('-count', 'module_label')
        )

        return Response({
            'retention_days': settings_obj.retention_days,
            'active_deleted_count': active_qs.count(),
            'restored_count': DeletedRecord.objects.filter(is_restored=True).count(),
            'expiring_within_24h': expiring_soon,
            'purged_now': purged_now,
            'modules': module_counts,
        })

    @action(detail=False, methods=['delete'], url_path='empty-trash')
    def empty_trash(self, request):
        with skip_audit_logging():
            count, _ = DeletedRecord.objects.filter(is_restored=False).delete()
        return Response({'message': f'Permanently removed {count} deleted record(s).', 'count': count})
