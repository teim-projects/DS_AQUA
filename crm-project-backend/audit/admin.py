from django.contrib import admin
from .models import AuditSettings, DeletedRecord


@admin.register(AuditSettings)
class AuditSettingsAdmin(admin.ModelAdmin):
    list_display = ('id', 'retention_days', 'updated_at', 'updated_by')


@admin.register(DeletedRecord)
class DeletedRecordAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'module_label',
        'object_id',
        'object_repr',
        'deleted_by_name',
        'deleted_at',
        'is_restored',
    )
    list_filter = ('module_label', 'is_restored', 'app_label')
    search_fields = ('object_repr', 'object_id', 'deleted_by_name')
