from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone


class AuditSettings(models.Model):
    """Singleton configuration controlling Recycle Bin retention duration."""
    retention_days = models.PositiveIntegerField(
        default=30,
        validators=[MinValueValidator(1), MaxValueValidator(3650)],
        verbose_name="Retention Period (Days)",
        help_text="Number of days deleted records stay in the Audit Recycle Bin before expiring automatically.",
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_settings_updates',
    )

    class Meta:
        db_table = 'audit_settings'
        verbose_name = 'Audit Settings'
        verbose_name_plural = 'Audit Settings'

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults={'retention_days': 30})
        return obj

    def __str__(self):
        return f"Audit Retention: {self.retention_days} day(s)"


class DeletedRecord(models.Model):
    """Stores snapshots of deleted CRM objects along with cascade-deleted child entities."""
    app_label = models.CharField(max_length=100, db_index=True)
    model_name = models.CharField(max_length=100, db_index=True)
    module_label = models.CharField(max_length=100, db_index=True)
    object_id = models.CharField(max_length=100, db_index=True)
    object_repr = models.CharField(max_length=255)

    data = models.JSONField(default=dict)
    related_objects = models.JSONField(default=list, blank=True)
    summary_fields = models.JSONField(default=dict, blank=True)

    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_deleted_records',
    )
    deleted_by_name = models.CharField(max_length=255, blank=True, default='')
    deleted_at = models.DateTimeField(default=timezone.now, db_index=True)

    is_restored = models.BooleanField(default=False, db_index=True)
    restored_at = models.DateTimeField(null=True, blank=True)
    restored_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_restored_records',
    )
    restored_by_name = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        db_table = 'audit_deleted_records'
        ordering = ['-deleted_at', '-id']
        verbose_name = 'Deleted Record'
        verbose_name_plural = 'Deleted Records'
        indexes = [
            models.Index(fields=['is_restored', '-deleted_at']),
            models.Index(fields=['module_label', 'is_restored']),
        ]

    def __str__(self):
        return f"[{self.module_label}] {self.object_repr} (ID: {self.object_id})"
