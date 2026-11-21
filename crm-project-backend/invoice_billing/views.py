import logging
import re
from decimal import Decimal
from django.db.models import Sum, Count, Q
from django.http import HttpResponse, Http404
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    Invoice,
    InvoiceItem,
    BillOfSupply,
    BillOfSupplyItem,
    DeliveryChallan,
    DeliveryChallanItem,
    AdvancePaymentReceipt
)
from .serializers import (
    InvoiceSerializer,
    InvoiceItemSerializer,
    BillOfSupplySerializer,
    BillOfSupplyItemSerializer,
    DeliveryChallanSerializer,
    DeliveryChallanItemSerializer,
    AdvancePaymentReceiptSerializer
)
from .utils.pdf_generator import (
    generate_invoice_pdf,
    render_invoice_html,
    generate_advance_receipt_pdf,
    render_advance_receipt_html
)

logger = logging.getLogger(__name__)


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().prefetch_related('items').select_related(
        'project', 'amc_contract', 'service', 'customer', 'billing_detail'
    ).order_by('-id')
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'invoice_number',
        'bill_to_name',
        'bill_to_contact',
        'bill_to_gstin',
        'po_number',
        'project__project_code',
        'amc_contract__contract_id',
    ]

    def get_queryset(self):
        qs = super().get_queryset()

        # Type filter
        invoice_type = self.request.query_params.get('invoice_type')
        if invoice_type and invoice_type.upper() == 'ALL':
            pass
        elif invoice_type:
            qs = qs.filter(invoice_type=invoice_type.upper())
        elif self.request.query_params.get('include_bill_of_supply') != 'true':
            # By default, /invoice/invoices/ only returns Tax Invoices and excludes Bill of Supply
            qs = qs.exclude(invoice_type='BILL_OF_SUPPLY')

        # Status filter
        status_param = self.request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())

        # Project filter
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)

        # AMC Contract filter
        amc_id = self.request.query_params.get('amc_contract')
        if amc_id:
            qs = qs.filter(amc_contract_id=amc_id)

        # Service filter
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)

        # Customer filter
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(
                Q(customer_id=customer_id) |
                Q(project__customer_id=customer_id) |
                Q(amc_contract__customer_id=customer_id) |
                Q(service__customer_id=customer_id)
            )

        # Date range filters
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(invoice_date__gte=start_date)
        if end_date:
            qs = qs.filter(invoice_date__lte=end_date)

        # Document type filter (TAX_INVOICE vs PROFORMA)
        doc_type = self.request.query_params.get('document_type')
        if doc_type and doc_type.upper() != 'ALL':
            qs = qs.filter(document_type=doc_type.upper())

        return qs

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Returns KPI metrics for tax invoices (excluding Bill of Supply)"""
        tax_invoices = Invoice.objects.exclude(invoice_type='BILL_OF_SUPPLY')
        total_invoices = tax_invoices.count()
        aggregates = tax_invoices.aggregate(
            total_billed=Sum('grand_total'),
            total_received=Sum('received_amount'),
            total_balance=Sum('balance_amount'),
        )

        paid_count = tax_invoices.filter(status='PAID').count()
        unpaid_count = tax_invoices.filter(status='UNPAID').count()
        partially_paid_count = tax_invoices.filter(status='PARTIALLY_PAID').count()

        project_invoices_count = tax_invoices.filter(invoice_type='PROJECT').count()
        amc_invoices_count = tax_invoices.filter(invoice_type='AMC').count()
        service_invoices_count = tax_invoices.filter(invoice_type='SERVICE').count()

        return Response({
            'total_invoices': total_invoices,
            'total_billed': float(aggregates['total_billed'] or 0),
            'total_received': float(aggregates['total_received'] or 0),
            'total_balance': float(aggregates['total_balance'] or 0),
            'paid_count': paid_count,
            'unpaid_count': unpaid_count,
            'partially_paid_count': partially_paid_count,
            'project_invoices_count': project_invoices_count,
            'amc_invoices_count': amc_invoices_count,
            'service_invoices_count': service_invoices_count,
        })

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_invoice_number(self, request):
        """Generates the next sequential invoice number (e.g. 13, 14, ...)"""
        invoices = Invoice.objects.exclude(invoice_type='BILL_OF_SUPPLY').values_list('invoice_number', flat=True)
        max_num = 0
        for num_str in invoices:
            # Extract digits
            match = re.search(r'(\d+)', str(num_str))
            if match:
                val = int(match.group(1))
                if val > max_num:
                    max_num = val

        next_val = max(13, max_num + 1)
        return Response({
            'next_number': str(next_val),
            'formatted': f"{next_val}"
        })

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        """Generate and stream Tax Invoice PDF (or HTML if format=html or fallback)"""
        try:
            invoice = self.get_object()
        except Http404:
            return HttpResponse("Invoice not found", status=404)
        except Exception as e:
            logger.exception(f"Error fetching invoice {pk}: {e}")
            return HttpResponse(f"Error retrieving invoice: {e}", status=500)

        format_param = request.query_params.get('format', '').lower()

        if format_param == 'html':
            try:
                html_content = render_invoice_html(invoice)
                return HttpResponse(html_content, content_type='text/html')
            except Exception as e:
                logger.exception(f"Error rendering HTML invoice {pk}: {e}")
                return HttpResponse(f"Error rendering HTML invoice: {e}", status=500)

        try:
            pdf_bytes = generate_invoice_pdf(invoice)
            disposition = request.query_params.get('disposition', 'inline')
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            filename = f"Tax_Invoice_{invoice.invoice_number}.pdf"
            response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
            return response
        except Exception as e:
            logger.warning(f"WeasyPrint PDF generation failed ({e}), falling back to HTML invoice view")
            try:
                html_content = render_invoice_html(invoice)
                return HttpResponse(html_content, content_type='text/html')
            except Exception as html_err:
                logger.exception(f"Error rendering fallback HTML invoice {pk}: {html_err}")
                return HttpResponse(f"Error generating invoice view: {html_err}", status=500)

    @action(detail=True, methods=['get'], url_path='html')
    def html(self, request, pk=None):
        """Render standalone HTML invoice page"""
        try:
            invoice = self.get_object()
        except Http404:
            return HttpResponse("Invoice not found", status=404)
        except Exception as e:
            logger.exception(f"Error fetching invoice {pk}: {e}")
            return HttpResponse(f"Error retrieving invoice: {e}", status=500)

        try:
            html_content = render_invoice_html(invoice)
            return HttpResponse(html_content, content_type='text/html')
        except Exception as e:
            logger.exception(f"Error rendering HTML invoice {pk}: {e}")
            return HttpResponse(f"Error rendering HTML invoice: {e}", status=500)

    @action(detail=True, methods=['post'], url_path='convert-to-invoice')
    def convert_to_invoice(self, request, pk=None):
        """Converts a Proforma Invoice to an official Tax Invoice"""
        from django.utils import timezone
        invoice = self.get_object()
        if invoice.document_type == 'TAX_INVOICE':
            return Response(
                {'detail': f'Invoice #{invoice.invoice_number} is already an official Tax Invoice.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        invoice.document_type = 'TAX_INVOICE'
        invoice.is_converted_from_proforma = True
        invoice.proforma_converted_at = timezone.now()
        invoice.save()

        serializer = self.get_serializer(invoice)
        return Response({
            'message': f'Proforma Invoice #{invoice.invoice_number} successfully converted to official Tax Invoice.',
            'invoice': serializer.data
        })


class BillOfSupplyViewSet(viewsets.ModelViewSet):
    queryset = BillOfSupply.objects.all().prefetch_related('items').select_related(
        'amc_contract', 'linked_invoice', 'customer', 'billing_detail'
    ).order_by('-id')
    serializer_class = BillOfSupplySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'bill_number',
        'bill_to_name',
        'bill_to_contact',
        'po_number',
        'amc_contract_number',
    ]

    def get_queryset(self):
        qs = super().get_queryset()
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(
                Q(customer_id=customer_id) |
                Q(amc_contract__customer_id=customer_id) |
                Q(linked_invoice__customer_id=customer_id)
            )
        status_param = self.request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_bill_number(self, request):
        """Generates next sequential Bill of Supply number (e.g. 001167, 001168)"""
        bills = BillOfSupply.objects.values_list('bill_number', flat=True)
        max_num = 0
        for num_str in bills:
            match = re.search(r'(\d+)', str(num_str))
            if match:
                val = int(match.group(1))
                if val > max_num:
                    max_num = val
        next_val = max(1167, max_num + 1) if max_num > 0 else 1167
        formatted = f"{next_val:06d}" if next_val < 100000 else str(next_val)
        return Response({
            'next_number': formatted,
            'formatted': formatted
        })

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Returns KPI metrics for Bills of Supply"""
        bills = BillOfSupply.objects.all()
        total_bills = bills.count()
        aggregates = bills.aggregate(
            total_billed=Sum('grand_total'),
            total_received=Sum('received_amount'),
            total_balance=Sum('balance_amount'),
        )
        return Response({
            'total_bills': total_bills,
            'total_billed': float(aggregates['total_billed'] or 0),
            'total_received': float(aggregates['total_received'] or 0),
            'total_balance': float(aggregates['total_balance'] or 0),
            'paid_count': bills.filter(status='PAID').count(),
            'unpaid_count': bills.filter(status='UNPAID').count(),
            'partially_paid_count': bills.filter(status='PARTIALLY_PAID').count(),
        })

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        """Generate and stream Bill of Supply PDF"""
        try:
            bill = self.get_object()
        except Http404:
            return HttpResponse("Bill of Supply not found", status=404)
        except Exception as e:
            logger.exception(f"Error fetching Bill of Supply {pk}: {e}")
            return HttpResponse(f"Error retrieving bill: {e}", status=500)

        format_param = request.query_params.get('format', '').lower()
        if format_param == 'html':
            try:
                html_content = render_invoice_html(bill)
                return HttpResponse(html_content, content_type='text/html')
            except Exception as e:
                logger.exception(f"Error rendering HTML bill {pk}: {e}")
                return HttpResponse(f"Error rendering HTML bill: {e}", status=500)

        try:
            pdf_bytes = generate_invoice_pdf(bill)
            disposition = request.query_params.get('disposition', 'inline')
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            filename = f"Bill_Of_Supply_{bill.bill_number}.pdf"
            response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
            return response
        except Exception as e:
            logger.warning(f"PDF generation failed ({e}), falling back to HTML view")
            try:
                html_content = render_invoice_html(bill)
                return HttpResponse(html_content, content_type='text/html')
            except Exception as html_err:
                logger.exception(f"Error rendering fallback HTML bill {pk}: {html_err}")
                return HttpResponse(f"Error generating bill view: {html_err}", status=500)

    @action(detail=True, methods=['get'], url_path='html')
    def html(self, request, pk=None):
        try:
            bill = self.get_object()
        except Http404:
            return HttpResponse("Bill of Supply not found", status=404)
        except Exception as e:
            logger.exception(f"Error fetching Bill of Supply {pk}: {e}")
            return HttpResponse(f"Error retrieving bill: {e}", status=500)

        try:
            html_content = render_invoice_html(bill)
            return HttpResponse(html_content, content_type='text/html')
        except Exception as e:
            logger.exception(f"Error rendering HTML bill {pk}: {e}")
            return HttpResponse(f"Error rendering HTML bill: {e}", status=500)


class DeliveryChallanViewSet(viewsets.ModelViewSet):
    queryset = DeliveryChallan.objects.all().prefetch_related('items').select_related(
        'project', 'amc_contract', 'service', 'customer', 'billing_detail', 'linked_invoice', 'linked_bill_of_supply'
    ).order_by('-id')
    serializer_class = DeliveryChallanSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'challan_number',
        'bill_to_name',
        'bill_to_contact',
        'ship_to_name',
        'ship_to_address',
        'po_number',
        'vehicle_number',
        'lr_rr_number',
        'project__project_code',
        'amc_contract__contract_id',
    ]

    def get_queryset(self):
        qs = super().get_queryset()

        # Challan source type (PROJECT, AMC, SERVICE, DIRECT)
        challan_type = self.request.query_params.get('challan_type')
        if challan_type and challan_type.upper() != 'ALL':
            qs = qs.filter(challan_type=challan_type.upper())

        # Status filter
        status_param = self.request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())

        # Project filter
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)

        # AMC filter
        amc_id = self.request.query_params.get('amc_contract')
        if amc_id:
            qs = qs.filter(amc_contract_id=amc_id)

        # Service filter
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)

        # Customer filter
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(
                Q(customer_id=customer_id) |
                Q(project__customer_id=customer_id) |
                Q(amc_contract__customer_id=customer_id) |
                Q(service__customer_id=customer_id)
            )

        # Date range filters
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(challan_date__gte=start_date)
        if end_date:
            qs = qs.filter(challan_date__lte=end_date)

        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_challan_number(self, request):
        """Generates next sequential Delivery Challan number (e.g. DC-001168 or DC-0001)"""
        challans = DeliveryChallan.objects.values_list('challan_number', flat=True)
        max_num = 0
        for num_str in challans:
            match = re.search(r'(\d+)', str(num_str))
            if match:
                val = int(match.group(1))
                if val > max_num:
                    max_num = val
        next_val = max_num + 1 if max_num > 0 else 1
        formatted = f"DC-{next_val:04d}" if next_val < 10000 else f"DC-{next_val}"
        return Response({
            'next_number': formatted,
            'formatted': formatted
        })

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Returns KPI metrics for Delivery Challans"""
        challans = DeliveryChallan.objects.all()
        total_challans = challans.count()
        aggregates = challans.aggregate(
            total_qty=Sum('total_quantity'),
            total_val=Sum('grand_total'),
        )
        return Response({
            'total_challans': total_challans,
            'total_quantity': float(aggregates['total_qty'] or 0),
            'total_value': float(aggregates['total_val'] or 0),
            'delivered_count': challans.filter(status='DELIVERED').count(),
            'in_transit_count': challans.filter(status='IN_TRANSIT').count(),
            'pending_count': challans.filter(status='PENDING').count(),
        })

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        """Generate and stream Delivery Challan PDF"""
        try:
            challan = self.get_object()
        except Http404:
            return HttpResponse("Delivery Challan not found", status=404)
        except Exception as e:
            logger.exception(f"Error fetching Delivery Challan {pk}: {e}")
            return HttpResponse(f"Error retrieving challan: {e}", status=500)

        format_param = request.query_params.get('format', '').lower()
        if format_param == 'html':
            try:
                html_content = render_invoice_html(challan)
                return HttpResponse(html_content, content_type='text/html')
            except Exception as e:
                logger.exception(f"Error rendering HTML challan {pk}: {e}")
                return HttpResponse(f"Error rendering HTML challan: {e}", status=500)

        try:
            pdf_bytes = generate_invoice_pdf(challan)
            disposition = request.query_params.get('disposition', 'inline')
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            filename = f"Delivery_Challan_{challan.challan_number}.pdf"
            response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
            return response
        except Exception as e:
            logger.warning(f"PDF generation failed ({e}), falling back to HTML view")
            try:
                html_content = render_invoice_html(challan)
                return HttpResponse(html_content, content_type='text/html')
            except Exception as html_err:
                logger.exception(f"Error rendering fallback HTML challan {pk}: {html_err}")
                return HttpResponse(f"Error generating challan view: {html_err}", status=500)

    @action(detail=True, methods=['get'], url_path='html')
    def html(self, request, pk=None):
        try:
            challan = self.get_object()
        except Http404:
            return HttpResponse("Delivery Challan not found", status=404)
        except Exception as e:
            logger.exception(f"Error fetching Delivery Challan {pk}: {e}")
            return HttpResponse(f"Error retrieving challan: {e}", status=500)

        try:
            html_content = render_invoice_html(challan)
            return HttpResponse(html_content, content_type='text/html')
        except Exception as e:
            logger.exception(f"Error rendering HTML challan {pk}: {e}")
            return HttpResponse(f"Error rendering HTML challan: {e}", status=500)


class AdvancePaymentReceiptViewSet(viewsets.ModelViewSet):
    queryset = AdvancePaymentReceipt.objects.all().select_related(
        'project', 'amc_contract', 'service', 'customer', 'billing_detail'
    ).order_by('-id')
    serializer_class = AdvancePaymentReceiptSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'receipt_number',
        'payer_name',
        'contact_number',
        'transaction_ref',
        'purpose',
        'project__project_code',
        'amc_contract__contract_id',
    ]

    def get_queryset(self):
        qs = super().get_queryset()

        receipt_type = self.request.query_params.get('receipt_type')
        if receipt_type and receipt_type.upper() != 'ALL':
            qs = qs.filter(receipt_type=receipt_type.upper())

        status_param = self.request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())

        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)

        amc_id = self.request.query_params.get('amc_contract')
        if amc_id:
            qs = qs.filter(amc_contract_id=amc_id)

        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)

        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(
                Q(customer_id=customer_id) |
                Q(project__customer_id=customer_id) |
                Q(amc_contract__customer_id=customer_id) |
                Q(service__customer_id=customer_id)
            )

        payment_mode = self.request.query_params.get('payment_mode')
        if payment_mode and payment_mode.upper() != 'ALL':
            qs = qs.filter(payment_mode=payment_mode.upper())

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_receipt_number(self, request):
        latest = AdvancePaymentReceipt.objects.order_by('-id').first()
        if not latest:
            next_num = "APR-0001"
        else:
            m = re.search(r'(\d+)$', latest.receipt_number or '')
            if m:
                cur = int(m.group(1))
                prefix = latest.receipt_number[:m.start()]
                next_num = f"{prefix}{cur + 1:04d}"
            else:
                next_num = f"APR-{latest.id + 1:04d}"
        return Response({'next_number': next_num})

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        qs = self.get_queryset()
        total_advance = qs.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        total_orders = qs.aggregate(t=Sum('total_order_amount'))['t'] or Decimal('0.00')
        total_balance = qs.aggregate(t=Sum('balance_amount'))['t'] or Decimal('0.00')
        total_count = qs.count()
        confirmed_count = qs.filter(status='CONFIRMED').count()
        pending_count = qs.filter(status='PENDING').count()

        return Response({
            'total_advance': total_advance,
            'total_orders': total_orders,
            'total_balance': total_balance,
            'total_count': total_count,
            'confirmed_count': confirmed_count,
            'pending_count': pending_count,
        })

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        try:
            receipt = self.get_object()
        except Http404:
            return HttpResponse("Advance Payment Receipt not found", status=404)
        except Exception as e:
            logger.exception(f"Error fetching Receipt {pk}: {e}")
            return HttpResponse(f"Error retrieving receipt: {e}", status=500)

        format_param = request.query_params.get('format', '').lower()
        if format_param == 'html':
            try:
                html_content = render_advance_receipt_html(receipt)
                return HttpResponse(html_content, content_type='text/html')
            except Exception as e:
                logger.exception(f"Error rendering HTML receipt {pk}: {e}")
                return HttpResponse(f"Error rendering HTML receipt: {e}", status=500)

        try:
            pdf_bytes = generate_advance_receipt_pdf(receipt)
            disposition = request.query_params.get('disposition', 'inline')
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            filename = f"Advance_Receipt_{receipt.receipt_number}.pdf"
            response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
            return response
        except Exception as e:
            logger.warning(f"PDF generation failed ({e}), falling back to HTML view")
            try:
                html_content = render_advance_receipt_html(receipt)
                return HttpResponse(html_content, content_type='text/html')
            except Exception as html_err:
                logger.exception(f"Error rendering fallback HTML receipt {pk}: {html_err}")
                return HttpResponse(f"Error generating receipt view: {html_err}", status=500)

    @action(detail=True, methods=['get'], url_path='html')
    def html(self, request, pk=None):
        try:
            receipt = self.get_object()
        except Http404:
            return HttpResponse("Advance Payment Receipt not found", status=404)
        except Exception as e:
            logger.exception(f"Error fetching Receipt {pk}: {e}")
            return HttpResponse(f"Error retrieving receipt: {e}", status=500)

        try:
            html_content = render_advance_receipt_html(receipt)
            return HttpResponse(html_content, content_type='text/html')
        except Exception as e:
            logger.exception(f"Error rendering HTML receipt {pk}: {e}")
            return HttpResponse(f"Error rendering HTML receipt: {e}", status=500)
