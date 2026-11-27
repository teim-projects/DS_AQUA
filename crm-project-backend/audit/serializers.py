from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers

from .models import AuditSettings, DeletedRecord
from .utils import get_user_display_name


class AuditSettingsSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditSettings
        fields = ['id', 'retention_days', 'updated_at', 'updated_by', 'updated_by_name']
        read_only_fields = ['id', 'updated_at', 'updated_by', 'updated_by_name']

    def validate_retention_days(self, value):
        if value < 1 or value > 3650:
            raise serializers.ValidationError("Retention days must be between 1 and 3650.")
        return value

    def get_updated_by_name(self, obj):
        return get_user_display_name(obj.updated_by) if obj.updated_by else ''


class DeletedRecordListSerializer(serializers.ModelSerializer):
    expires_at = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    hours_remaining = serializers.SerializerMethodField()
    related_count = serializers.SerializerMethodField()

    class Meta:
        model = DeletedRecord
        fields = [
            'id',
            'app_label',
            'model_name',
            'module_label',
            'object_id',
            'object_repr',
            'summary_fields',
            'related_count',
            'deleted_by',
            'deleted_by_name',
            'deleted_at',
            'expires_at',
            'days_remaining',
            'hours_remaining',
            'is_restored',
            'restored_at',
            'restored_by',
            'restored_by_name',
        ]

    def _get_retention_days(self):
        days = self.context.get('retention_days')
        if days is None:
            days = AuditSettings.get_settings().retention_days
        return days

    def get_expires_at(self, obj):
        if obj.is_restored:
            return None
        return obj.deleted_at + timedelta(days=self._get_retention_days())

    def get_days_remaining(self, obj):
        if obj.is_restored:
            return None
        expires = self.get_expires_at(obj)
        delta = expires - timezone.now()
        return max(0, round(delta.total_seconds() / 86400, 1))

    def get_hours_remaining(self, obj):
        if obj.is_restored:
            return None
        expires = self.get_expires_at(obj)
        delta = expires - timezone.now()
        return max(0, int(delta.total_seconds() // 3600))

    def get_related_count(self, obj):
        return len(obj.related_objects or [])


class DeletedRecordDetailSerializer(DeletedRecordListSerializer):
    class Meta(DeletedRecordListSerializer.Meta):
        fields = DeletedRecordListSerializer.Meta.fields + ['data', 'related_objects']
