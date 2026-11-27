import logging

from django.apps import apps
from django.db import models
from django.db.models.signals import pre_delete

from .middleware import get_current_user, is_audit_skipped
from .models import DeletedRecord
from .utils import (
    TRACKED_ROOT_MODELS,
    collect_cascade_tree,
    extract_summary_fields,
    get_module_label,
    get_user_display_name,
    serialize_instance,
)

logger = logging.getLogger(__name__)


def capture_deleted_instance(sender, instance, using, origin=None, **kwargs):
    """
    Archive deleted root CRM objects along with their cascade-deleted child records.
    Cascade-triggered signals on child rows (where origin != instance) are ignored so
    each user deletion creates one clean, restorable DeletedRecord entry.
    """
    if is_audit_skipped():
        return

    if sender._meta.app_label == 'audit':
        return

    # Skip cascade child deletions; the parent's pre_delete captures the full tree.
    if origin is not None:
        if isinstance(origin, models.Model):
            if origin is not instance:
                return
        elif hasattr(origin, 'model'):
            if origin.model is not sender:
                return

    if instance.pk is None:
        return

    try:
        user = get_current_user()
        snapshot = serialize_instance(instance)
        related = collect_cascade_tree(instance)
        summary = extract_summary_fields(instance)

        DeletedRecord.objects.create(
            app_label=sender._meta.app_label,
            model_name=sender._meta.model_name,
            module_label=get_module_label(sender),
            object_id=str(instance.pk),
            object_repr=str(instance)[:255],
            data={
                'fields': snapshot['fields'],
                'm2m': snapshot['m2m'],
                'model_verbose': snapshot['model_verbose'],
            },
            related_objects=related,
            summary_fields=summary,
            deleted_by=user if (user and getattr(user, 'is_authenticated', False)) else None,
            deleted_by_name=get_user_display_name(user),
        )
    except Exception as exc:
        logger.exception("Audit capture failed for %s (%s): %s", sender, instance.pk, exc)


def connect_audit_signals():
    for (app_label, model_name) in TRACKED_ROOT_MODELS.keys():
        try:
            model_cls = apps.get_model(app_label, model_name)
        except LookupError:
            logger.warning("Audit tracked model %s.%s not found; skipping.", app_label, model_name)
            continue

        dispatch_uid = f"audit_pre_delete_{app_label}_{model_name}"
        pre_delete.connect(
            capture_deleted_instance,
            sender=model_cls,
            weak=False,
            dispatch_uid=dispatch_uid,
        )


connect_audit_signals()
