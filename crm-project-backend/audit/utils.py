import datetime
import decimal
import logging
import uuid
from datetime import timedelta

from django.apps import apps
from django.db import IntegrityError, models, transaction
from django.db.models.deletion import Collector
from django.db.models.fields.files import FieldFile
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime, parse_duration, parse_time

from .middleware import skip_audit_logging
from .models import AuditSettings, DeletedRecord

logger = logging.getLogger(__name__)

# Root CRM models whose deletion is captured in the Audit Recycle Bin.
# Child line-item models (InvoiceItem, QuotationItem, etc.) are intentionally
# excluded here so partial edits (e.g. serializer.update replacing line items)
# are never logged as deletions, while deleting a parent captures the full
# cascade tree inside related_objects.
TRACKED_ROOT_MODELS = {
    ('lead_management', 'lead_management'): 'Leads',
    ('lead_management', 'leadfollowup'): 'Lead Follow-ups',
    ('lead_management', 'customer'): 'Customers',
    ('lead_management', 'project'): 'Projects',
    ('lead_management', 'leadfaq'): 'Lead FAQs',

    ('quotation', 'quotation'): 'Quotations',
    ('quotation', 'termcategory'): 'Term Categories',
    ('quotation', 'termsconditions'): 'Terms & Conditions',
    ('quotation', 'billingdetail'): 'Billing Details',

    ('amc', 'amccontract'): 'AMC Contracts',
    ('amc', 'amcservice'): 'AMC Services',
    ('amc', 'amcvisit'): 'AMC Visits',
    ('amc', 'serviceattachment'): 'Service Attachments',

    ('invoice_billing', 'invoice'): 'Invoices',
    ('invoice_billing', 'billofsupply'): 'Bill of Supply',
    ('invoice_billing', 'deliverychallan'): 'Delivery Challans',
    ('invoice_billing', 'advancepaymentreceipt'): 'Advance Receipts',

    ('product_management', 'product'): 'Products',
    ('product_management', 'category'): 'Categories',

    ('inventory', 'vendor'): 'Vendors',
    ('inventory', 'inventoryitem'): 'Inventory Items',
    ('inventory', 'purchaseorder'): 'Purchase Orders',
    ('inventory', 'grn'): 'GRNs',
    ('inventory', 'stocktransaction'): 'Stock Transactions',

    ('api', 'customuser'): 'Staff / Users',
    ('api', 'role'): 'Roles',
    ('api', 'branchmanagement'): 'Branches',
    ('api', 'sitemanagement'): 'Sites',
    ('api', 'messagetemplate'): 'Message Templates',
}


def get_module_label(model_cls):
    key = (model_cls._meta.app_label, model_cls._meta.model_name)
    return TRACKED_ROOT_MODELS.get(key) or str(model_cls._meta.verbose_name_plural).title()


def get_user_display_name(user):
    if not user:
        return 'System'
    full = ''
    if hasattr(user, 'get_full_name'):
        try:
            full = (user.get_full_name() or '').strip()
        except Exception:
            full = ''
    return (
        full
        or getattr(user, 'email', None)
        or getattr(user, 'mobile_no', None)
        or str(user)
    )


def _serialize_value(val):
    if val is None:
        return None
    if isinstance(val, FieldFile):
        return val.name or ''
    if isinstance(val, decimal.Decimal):
        return str(val)
    if isinstance(val, datetime.datetime):
        return val.isoformat()
    if isinstance(val, datetime.date):
        return val.isoformat()
    if isinstance(val, datetime.time):
        return val.isoformat()
    if isinstance(val, datetime.timedelta):
        return val.total_seconds()
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, (dict, list, str, int, float, bool)):
        return val
    return str(val)


def serialize_instance(instance):
    """Serialize concrete fields and auto-created M2M pks into JSON-safe dicts."""
    meta = instance._meta
    fields_data = {}
    for field in meta.concrete_fields:
        if isinstance(field, models.BinaryField):
            continue
        raw_val = getattr(instance, field.attname, None)
        fields_data[field.attname] = _serialize_value(raw_val)

    m2m_data = {}
    for field in meta.many_to_many:
        through = field.remote_field.through
        if through is not None and not through._meta.auto_created:
            continue
        try:
            m2m_data[field.name] = [
                _serialize_value(pk)
                for pk in getattr(instance, field.name).values_list('pk', flat=True)
            ]
        except Exception:
            m2m_data[field.name] = []

    return {
        'app_label': meta.app_label,
        'model_name': meta.model_name,
        'model_verbose': str(meta.verbose_name).title(),
        'pk': _serialize_value(instance.pk),
        'repr': str(instance)[:255],
        'fields': fields_data,
        'm2m': m2m_data,
    }


def extract_summary_fields(instance):
    """Extract readable key/value highlights for quick inspection in the UI."""
    candidate_keys = [
        ('invoice_number', 'Invoice No'),
        ('bill_number', 'Bill No'),
        ('challan_number', 'Challan No'),
        ('receipt_number', 'Receipt No'),
        ('quotation_number', 'Quotation No'),
        ('amc_number', 'AMC No'),
        ('po_number', 'PO No'),
        ('grn_number', 'GRN No'),
        ('visit_code', 'Visit Code'),
        ('service_number', 'Service No'),
        ('name', 'Name'),
        ('title', 'Title'),
        ('company_name', 'Company'),
        ('customer_name', 'Customer'),
        ('email', 'Email'),
        ('phone', 'Phone'),
        ('mobile_no', 'Mobile'),
        ('status', 'Status'),
        ('grand_total', 'Grand Total'),
        ('total_amount', 'Total Amount'),
        ('amount', 'Amount'),
        ('balance_due', 'Balance Due'),
    ]
    summary = {}
    for attr, label in candidate_keys:
        if hasattr(instance, attr):
            val = getattr(instance, attr, None)
            if val not in (None, '', []):
                summary[label] = str(_serialize_value(val))
        if len(summary) >= 6:
            break
    return summary


def collect_cascade_tree(root_instance):
    """
    Collect all cascade-deleted dependent objects (from Collector.data and
    Collector.fast_deletes) excluding auto-created M2M through tables and audit models.
    """
    using = root_instance._state.db or 'default'
    collector = Collector(using=using)
    collector.collect([root_instance])

    root_key = (root_instance._meta.label_lower, str(root_instance.pk))
    seen = {root_key}
    related = []

    def _add_obj(obj):
        meta = obj._meta
        if meta.app_label == 'audit':
            return
        if meta.auto_created:
            return
        key = (meta.label_lower, str(obj.pk))
        if key in seen:
            return
        seen.add(key)
        related.append(serialize_instance(obj))

    for model_cls, instances in collector.data.items():
        if model_cls._meta.app_label == 'audit' or model_cls._meta.auto_created:
            continue
        for obj in instances:
            _add_obj(obj)

    for qs in collector.fast_deletes:
        model_cls = qs.model
        if model_cls._meta.app_label == 'audit' or model_cls._meta.auto_created:
            continue
        try:
            for obj in qs.iterator():
                _add_obj(obj)
        except Exception as exc:
            logger.warning("Audit fast_delete inspection failed for %s: %s", model_cls, exc)

    return related


def _deserialize_field_value(field, value):
    if value is None:
        return None
    if isinstance(field, models.ForeignKey):
        target_field = field.target_field
        return _deserialize_field_value(target_field, value)
    if isinstance(field, models.DecimalField):
        return decimal.Decimal(str(value))
    if isinstance(field, models.DateTimeField):
        if isinstance(value, datetime.datetime):
            return value
        dt = parse_datetime(str(value))
        if dt is None:
            d = parse_date(str(value))
            if d is not None:
                dt = datetime.datetime.combine(d, datetime.time.min)
        if dt is not None and timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt
    if isinstance(field, models.DateField):
        if isinstance(value, datetime.date) and not isinstance(value, datetime.datetime):
            return value
        parsed = parse_date(str(value)[:10])
        return parsed
    if isinstance(field, models.TimeField):
        if isinstance(value, datetime.time):
            return value
        return parse_time(str(value))
    if isinstance(field, models.DurationField):
        if isinstance(value, (int, float)):
            return timedelta(seconds=float(value))
        return parse_duration(str(value))
    if isinstance(field, models.UUIDField):
        return uuid.UUID(str(value))
    if isinstance(field, (models.IntegerField, models.AutoField, models.BigAutoField, models.PositiveIntegerField, models.BigIntegerField)):
        return int(value)
    if isinstance(field, models.FloatField):
        return float(value)
    if isinstance(field, models.BooleanField):
        return bool(value)
    return value


def restore_deleted_record(deleted_record, restored_by_user=None):
    """
    Atomically restore a DeletedRecord and its entire cascade tree with original PKs
    and timestamps preserved, returning the total number of restored database rows.
    """
    if deleted_record.is_restored:
        raise ValueError("This record has already been restored.")

    root_payload = {
        'app_label': deleted_record.app_label,
        'model_name': deleted_record.model_name,
        'pk': deleted_record.object_id,
        'repr': deleted_record.object_repr,
        'fields': (deleted_record.data or {}).get('fields', {}),
        'm2m': (deleted_record.data or {}).get('m2m', {}),
    }
    if not root_payload['fields']:
        raise ValueError("Snapshot data is empty and cannot be restored.")

    batch = [root_payload] + list(deleted_record.related_objects or [])

    resolved_items = []
    pending_keys = set()
    for idx, entry in enumerate(batch):
        model_cls = apps.get_model(entry['app_label'], entry['model_name'])
        if model_cls is None:
            raise ValueError(f"Model {entry['app_label']}.{entry['model_name']} no longer exists.")
        pk_str = str(entry.get('pk') or entry['fields'].get(model_cls._meta.pk.attname))
        pending_keys.add((model_cls._meta.label_lower, pk_str))
        resolved_items.append({
            'is_root': idx == 0,
            'model_cls': model_cls,
            'pk_str': pk_str,
            'fields': dict(entry.get('fields') or {}),
            'm2m': dict(entry.get('m2m') or {}),
            'repr': entry.get('repr') or pk_str,
        })

    restored_instances = []

    with transaction.atomic():
        with skip_audit_logging():
            remaining = list(resolved_items)
            max_passes = max(len(remaining) + 2, 5)

            for _ in range(max_passes):
                if not remaining:
                    break
                next_remaining = []
                progressed = False

                for item in remaining:
                    model_cls = item['model_cls']
                    meta = model_cls._meta
                    fields_dict = item['fields']

                    waiting_on_batch_parent = False
                    for field in meta.concrete_fields:
                        if not (field.is_relation and field.many_to_one):
                            continue
                        fk_val = fields_dict.get(field.attname)
                        if fk_val in (None, ''):
                            continue
                        rel_model = field.related_model
                        # Defer if parent belongs to the same restore batch and isn't inserted yet
                        batch_key = (rel_model._meta.label_lower, str(fk_val))
                        if not rel_model.objects.filter(pk=fk_val).exists():
                            if batch_key in pending_keys:
                                waiting_on_batch_parent = True
                                break
                            # External parent missing in DB
                            if field.null:
                                fields_dict[field.attname] = None
                            else:
                                raise ValueError(
                                    f"Cannot restore '{item['repr']}': required parent "
                                    f"{rel_model._meta.verbose_name} (ID: {fk_val}) does not exist. "
                                    f"Please restore that parent record first."
                                )

                    if waiting_on_batch_parent:
                        next_remaining.append(item)
                        continue

                    pk_attname = meta.pk.attname
                    pk_val = _deserialize_field_value(meta.pk, fields_dict.get(pk_attname))
                    if model_cls.objects.filter(pk=pk_val).exists():
                        if item['is_root']:
                            raise ValueError(
                                f"{meta.verbose_name.title()} (ID: {pk_val}) already exists in the database."
                            )
                        existing_obj = model_cls.objects.get(pk=pk_val)
                        pending_keys.discard((meta.label_lower, item['pk_str']))
                        restored_instances.append((existing_obj, item['m2m']))
                        progressed = True
                        continue

                    kwargs = {}
                    for field in meta.concrete_fields:
                        if field.attname in fields_dict:
                            kwargs[field.attname] = _deserialize_field_value(
                                field, fields_dict[field.attname]
                            )

                    obj = model_cls(**kwargs)
                    try:
                        # save_base(raw=True, force_insert=True) restores exact PK and auto_now fields
                        # without re-running side-effect custom save() hooks or signals.
                        with transaction.atomic():
                            obj.save_base(raw=True, force_insert=True)
                    except IntegrityError as exc:
                        raise ValueError(
                            f"Database constraint conflict restoring {meta.verbose_name} "
                            f"'{item['repr']}': {exc}"
                        ) from exc

                    pending_keys.discard((meta.label_lower, item['pk_str']))
                    restored_instances.append((obj, item['m2m']))
                    progressed = True

                remaining = next_remaining
                if remaining and not progressed:
                    sample = remaining[0]
                    raise ValueError(
                        f"Could not resolve parent dependencies while restoring '{sample['repr']}'."
                    )

            # Restore many-to-many relations once all records exist
            for obj, m2m_map in restored_instances:
                if not m2m_map:
                    continue
                for field in obj._meta.many_to_many:
                    if field.name not in m2m_map:
                        continue
                    pks = m2m_map.get(field.name) or []
                    if not pks:
                        continue
                    valid_pks = list(
                        field.related_model.objects.filter(pk__in=pks).values_list('pk', flat=True)
                    )
                    getattr(obj, field.name).set(valid_pks)

            deleted_record.is_restored = True
            deleted_record.restored_at = timezone.now()
            deleted_record.restored_by = restored_by_user
            deleted_record.restored_by_name = get_user_display_name(restored_by_user)
            deleted_record.save(
                update_fields=['is_restored', 'restored_at', 'restored_by', 'restored_by_name']
            )

    return len(restored_instances)


def purge_expired_records():
    """
    Delete un-restored DeletedRecord rows whose age exceeds AuditSettings.retention_days.
    Called on retention updates and Audit Recycle Bin reads so retention changes apply immediately.
    """
    settings_obj = AuditSettings.get_settings()
    cutoff = timezone.now() - timedelta(days=settings_obj.retention_days)
    with skip_audit_logging():
        deleted_count, _ = DeletedRecord.objects.filter(
            is_restored=False,
            deleted_at__lte=cutoff,
        ).delete()
    return deleted_count
