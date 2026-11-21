from rest_framework import serializers
from decimal import Decimal
from .models import (
    Invoice,
    InvoiceItem,
    BillOfSupply,
    BillOfSupplyItem,
    DeliveryChallan,
    DeliveryChallanItem,
    AdvancePaymentReceipt,
    number_to_indian_words
)


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = [
            'id',
            'item_name',
            'hsn_sac',
            'quantity',
            'unit',
            'price_per_unit',
            'discount_percent',
            'discount_amount',
            'taxable_amount',
            'gst_rate',
            'gst_amount',
            'cgst_rate',
            'cgst_amount',
            'sgst_rate',
            'sgst_amount',
            'igst_rate',
            'igst_amount',
            'total_amount',
            'sort_order',
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)
    company_gstin = serializers.CharField(required=False, allow_blank=True, default="27AALCD8065C1ZJ")
    project_code = serializers.SerializerMethodField(read_only=True)
    amc_contract_number = serializers.SerializerMethodField(read_only=True)
    amc_contract_product = serializers.SerializerMethodField(read_only=True)
    amc_is_renewal = serializers.SerializerMethodField(read_only=True)
    amc_cycle_number = serializers.SerializerMethodField(read_only=True)
    amc_no_of_visits = serializers.SerializerMethodField(read_only=True)
    service_number = serializers.SerializerMethodField(read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)
    is_proforma = serializers.BooleanField(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'document_type',
            'is_proforma',
            'is_converted_from_proforma',
            'proforma_converted_at',
            'invoice_number',
            'invoice_date',
            'invoice_time',
            'invoice_type',
            'status',

            # Relations
            'project',
            'project_code',
            'amc_contract',
            'amc_contract_number',
            'amc_contract_product',
            'amc_is_renewal',
            'amc_cycle_number',
            'amc_no_of_visits',
            'service',
            'service_number',
            'customer',
            'billing_detail',

            # Company details
            'company_name',
            'company_address',
            'company_phone',
            'company_email',
            'company_gstin',
            'company_state',

            # Bill To
            'bill_to_name',
            'bill_to_address',
            'bill_to_contact',
            'bill_to_gstin',
            'bill_to_state',

            # Ship To
            'ship_to_name',
            'ship_to_address',
            'ship_to_contact',
            'ship_to_gstin',
            'ship_to_state',

            # Meta
            'place_of_supply',
            'po_number',
            'po_date',

            # Bank
            'bank_name',
            'bank_account_no',
            'bank_ifsc',
            'account_holder_name',

            # Financials
            'sub_total',
            'discount_total',
            'taxable_amount',
            'cgst_amount',
            'sgst_amount',
            'igst_amount',
            'round_off',
            'grand_total',
            'received_amount',
            'balance_amount',
            'you_saved',
            'payment_mode',
            'previous_balance',
            'current_balance',
            'amount_in_words',
            'terms_conditions',
            'notes',

            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',

            'items',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_project_code(self, obj):
        if obj.project:
            return obj.project.project_code or f"PRJ-{obj.project.id}"
        return None

    def get_amc_contract_number(self, obj):
        if obj.amc_contract:
            return getattr(obj.amc_contract, 'contract_id', None) or f"AMC-{obj.amc_contract.id}"
        return None

    def get_amc_contract_product(self, obj):
        if obj.amc_contract:
            return getattr(obj.amc_contract, 'product', '') or ''
        return ''

    def get_amc_is_renewal(self, obj):
        if obj.amc_contract:
            amc = obj.amc_contract
            cycles_cnt = amc.cycles.count() if hasattr(amc, 'cycles') else 0
            return (getattr(amc, 'status', '') == 'RENEWED') or (cycles_cnt > 1)
        return False

    def get_amc_cycle_number(self, obj):
        if obj.amc_contract:
            amc = obj.amc_contract
            if hasattr(amc, 'cycles'):
                return max(1, amc.cycles.count())
        return 1

    def get_amc_no_of_visits(self, obj):
        if obj.amc_contract:
            return getattr(obj.amc_contract, 'no_of_visits', 4) or 4
        return 4

    def get_service_number(self, obj):
        if obj.service:
            return getattr(obj.service, 'service_number', None) or f"SRV-{obj.service.id}"
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            full = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return full or obj.created_by.username or obj.created_by.email
        return None

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated and 'created_by' not in validated_data:
            validated_data['created_by'] = request.user

        # Auto-compute amount in words if missing
        if 'grand_total' in validated_data and not validated_data.get('amount_in_words'):
            validated_data['amount_in_words'] = number_to_indian_words(validated_data['grand_total'])

        invoice = Invoice.objects.create(**validated_data)

        for idx, item_data in enumerate(items_data):
            item_data.pop('sort_order', None)
            InvoiceItem.objects.create(invoice=invoice, sort_order=idx + 1, **item_data)

        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        if 'grand_total' in validated_data:
            validated_data['amount_in_words'] = number_to_indian_words(validated_data['grand_total'])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for idx, item_data in enumerate(items_data):
                item_data.pop('sort_order', None)
                InvoiceItem.objects.create(invoice=instance, sort_order=idx + 1, **item_data)

        return instance


class BillOfSupplyItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillOfSupplyItem
        fields = [
            'id',
            'item_name',
            'description',
            'hsn_sac',
            'quantity',
            'unit',
            'price_per_unit',
            'discount_percent',
            'discount_amount',
            'total_amount',
            'sort_order',
        ]


class BillOfSupplySerializer(serializers.ModelSerializer):
    items = BillOfSupplyItemSerializer(many=True, required=False)
    created_by_name = serializers.SerializerMethodField(read_only=True)
    linked_invoice_number = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BillOfSupply
        fields = [
            'id',
            'bill_number',
            'bill_date',
            'bill_time',
            'status',

            # Relations
            'amc_contract',
            'linked_invoice',
            'linked_invoice_number',
            'customer',
            'billing_detail',

            # Company details
            'company_name',
            'company_address',
            'company_phone',
            'company_email',
            'company_state',

            # Bill To
            'bill_to_name',
            'bill_to_contact_person',
            'bill_to_contact',
            'bill_to_email',
            'bill_to_state',
            'bill_to_city',
            'bill_to_address',
            'bill_to_gstin',
            'bill_to_pan',

            # Ship To
            'ship_to_same_as_bill_to',
            'ship_to_name',
            'ship_to_contact_person',
            'ship_to_contact',
            'ship_to_email',
            'ship_to_state',
            'ship_to_city',
            'ship_to_address',
            'ship_to_gstin',

            # Meta
            'place_of_supply',
            'po_number',
            'po_date',

            # Bank
            'bank_name',
            'bank_account_no',
            'bank_ifsc',
            'account_holder_name',

            # Financials
            'sub_total',
            'discount_total',
            'taxable_amount',
            'grand_total',
            'received_amount',
            'balance_amount',
            'you_saved',
            'payment_mode',
            'amount_in_words',

            # AMC specifics
            'amc_is_renewal',
            'amc_cycle_number',
            'amc_no_of_visits',
            'amc_contract_number',
            'amc_contract_product',

            'terms_conditions',
            'notes',
            'items',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_linked_invoice_number(self, obj):
        if obj.linked_invoice:
            return obj.linked_invoice.invoice_number
        return None

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        if 'grand_total' in validated_data and not validated_data.get('amount_in_words'):
            validated_data['amount_in_words'] = number_to_indian_words(validated_data['grand_total'])

        bill = BillOfSupply.objects.create(**validated_data)

        for idx, item_data in enumerate(items_data):
            item_data.pop('sort_order', None)
            BillOfSupplyItem.objects.create(bill_of_supply=bill, sort_order=idx + 1, **item_data)

        return bill

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        if 'grand_total' in validated_data:
            validated_data['amount_in_words'] = number_to_indian_words(validated_data['grand_total'])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for idx, item_data in enumerate(items_data):
                item_data.pop('sort_order', None)
                BillOfSupplyItem.objects.create(bill_of_supply=instance, sort_order=idx + 1, **item_data)

        return instance


class DeliveryChallanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryChallanItem
        fields = [
            'id',
            'inventory_item',
            'item_name',
            'description',
            'hsn_sac',
            'quantity',
            'unit',
            'price_per_unit',
            'discount_percent',
            'discount_amount',
            'taxable_amount',
            'total_amount',
            'remarks',
            'sort_order',
        ]


class DeliveryChallanSerializer(serializers.ModelSerializer):
    items = DeliveryChallanItemSerializer(many=True, required=False)
    created_by_name = serializers.SerializerMethodField()
    linked_invoice_number = serializers.SerializerMethodField()
    linked_bill_number = serializers.SerializerMethodField()
    project_code = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryChallan
        fields = [
            'id',
            'challan_number',
            'challan_date',
            'challan_time',
            'challan_type',
            'status',

            # Links
            'project',
            'project_code',
            'amc_contract',
            'service',
            'customer',
            'customer_name',
            'linked_invoice',
            'linked_invoice_number',
            'linked_bill_of_supply',
            'linked_bill_number',
            'billing_detail',

            # Company details
            'company_name',
            'company_address',
            'company_phone',
            'company_email',
            'company_gstin',
            'company_state',

            # Bill To
            'bill_to_name',
            'bill_to_contact_person',
            'bill_to_contact',
            'bill_to_email',
            'bill_to_state',
            'bill_to_city',
            'bill_to_address',
            'bill_to_gstin',
            'bill_to_pan',

            # Ship To
            'ship_to_same_as_bill_to',
            'ship_to_name',
            'ship_to_contact_person',
            'ship_to_contact',
            'ship_to_email',
            'ship_to_state',
            'ship_to_city',
            'ship_to_address',
            'ship_to_gstin',

            # Transport / Logistics
            'place_of_supply',
            'po_number',
            'po_date',
            'transport_mode',
            'vehicle_number',
            'lr_rr_number',
            'dispatch_date',
            'delivered_by',

            # Bank snapshot
            'bank_name',
            'bank_account_no',
            'bank_ifsc',
            'account_holder_name',

            # Totals
            'total_quantity',
            'sub_total',
            'discount_total',
            'taxable_amount',
            'grand_total',
            'amount_in_words',

            'terms_conditions',
            'notes',
            'items',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_linked_invoice_number(self, obj):
        if obj.linked_invoice:
            return obj.linked_invoice.invoice_number
        return None

    def get_linked_bill_number(self, obj):
        if obj.linked_bill_of_supply:
            return obj.linked_bill_of_supply.bill_number
        return None

    def get_project_code(self, obj):
        if obj.project:
            return getattr(obj.project, 'project_code', None) or f"PRJ-{obj.project.id}"
        return None

    def get_customer_name(self, obj):
        if obj.customer:
            return getattr(obj.customer, 'company_name', None) or getattr(obj.customer, 'name', None)
        return obj.bill_to_name

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        if 'grand_total' in validated_data and not validated_data.get('amount_in_words'):
            validated_data['amount_in_words'] = number_to_indian_words(validated_data['grand_total'])

        challan = DeliveryChallan.objects.create(**validated_data)

        for idx, item_data in enumerate(items_data):
            item_data.pop('sort_order', None)
            DeliveryChallanItem.objects.create(challan=challan, sort_order=idx + 1, **item_data)

        return challan

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        if 'grand_total' in validated_data:
            validated_data['amount_in_words'] = number_to_indian_words(validated_data['grand_total'])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for idx, item_data in enumerate(items_data):
                item_data.pop('sort_order', None)
                DeliveryChallanItem.objects.create(challan=instance, sort_order=idx + 1, **item_data)

        return instance


class AdvancePaymentReceiptSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    project_code = serializers.SerializerMethodField(read_only=True)
    project_title = serializers.SerializerMethodField(read_only=True)
    amc_contract_number = serializers.SerializerMethodField(read_only=True)
    service_title = serializers.SerializerMethodField(read_only=True)
    customer_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AdvancePaymentReceipt
        fields = '__all__'

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_project_code(self, obj):
        if obj.project:
            return getattr(obj.project, 'project_code', None) or f"PRJ-{obj.project.id}"
        return None

    def get_project_title(self, obj):
        if obj.project:
            return getattr(obj.project, 'title', None) or getattr(obj.project, 'project_name', None) or ''
        return None

    def get_amc_contract_number(self, obj):
        if obj.amc_contract:
            return getattr(obj.amc_contract, 'contract_id', None) or getattr(obj.amc_contract, 'contract_number', None) or ''
        return None

    def get_service_title(self, obj):
        if obj.service:
            return getattr(obj.service, 'service_id', None) or getattr(obj.service, 'title', None) or f"SRV-{obj.service.id}"
        return None

    def get_customer_name(self, obj):
        if obj.customer:
            return getattr(obj.customer, 'company_name', None) or getattr(obj.customer, 'name', None)
        return obj.payer_name

    def create(self, validated_data):
        if 'amount' in validated_data and not validated_data.get('amount_in_words'):
            validated_data['amount_in_words'] = number_to_indian_words(validated_data['amount'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'amount' in validated_data:
            validated_data['amount_in_words'] = number_to_indian_words(validated_data['amount'])
        return super().update(instance, validated_data)
