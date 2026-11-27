from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
import math

User = get_user_model()


def number_to_indian_words(num):
    """Converts a number to Indian currency words format (e.g. Fifteen Thousand Nine Hundred and Thirty One Rupees only)"""
    try:
        num = float(num)
    except (ValueError, TypeError):
        return ""

    if num == 0:
        return "Zero Rupees only"

    units = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"
    ]
    tens = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ]

    def two_digits(n):
        if n < 20:
            return units[n]
        div, rem = divmod(n, 10)
        return tens[div] + (" " + units[rem] if rem > 0 else "")

    def three_digits(n):
        div, rem = divmod(n, 100)
        res = ""
        if div > 0:
            res += units[div] + " Hundred"
            if rem > 0:
                res += " and " + two_digits(rem)
        else:
            res += two_digits(rem)
        return res.strip()

    integer_part = int(math.floor(num))
    paisa_part = int(round((num - integer_part) * 100))

    parts = []
    # Crores
    crores, rem = divmod(integer_part, 10000000)
    if crores > 0:
        parts.append(two_digits(crores) + " Crore")

    # Lakhs
    lakhs, rem = divmod(rem, 100000)
    if lakhs > 0:
        parts.append(two_digits(lakhs) + " Lakh")

    # Thousands
    thousands, rem = divmod(rem, 1000)
    if thousands > 0:
        parts.append(two_digits(thousands) + " Thousand")

    # Hundreds & remainder
    if rem > 0:
        parts.append(three_digits(rem))

    words = " ".join(parts).strip()
    result = f"{words} Rupees" if words else "Zero Rupees"

    if paisa_part > 0:
        result += f" and {two_digits(paisa_part)} Paise"

    return result + " only"


# ==============================================================================
# TAX INVOICE & PROFORMA INVOICE MODEL
# ==============================================================================
class Invoice(models.Model):
    DOCUMENT_TYPE_CHOICES = [
        ('TAX_INVOICE', 'Tax Invoice'),
        ('PROFORMA', 'Proforma Invoice'),
    ]

    INVOICE_TYPE_CHOICES = [
        ('PROJECT', 'Project'),
        ('AMC', 'AMC Contract'),
        ('BILL_OF_SUPPLY', 'Bill of Supply (AMC)'),
        ('SERVICE', 'Service / Repair'),
        ('DIRECT', 'Direct / Other'),
    ]

    STATUS_CHOICES = [
        ('PAID', 'Paid'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('UNPAID', 'Unpaid'),
        ('CANCELLED', 'Cancelled'),
    ]

    # Document Classification
    document_type = models.CharField(
        max_length=30, choices=DOCUMENT_TYPE_CHOICES, default='TAX_INVOICE', verbose_name="Document Type"
    )
    is_converted_from_proforma = models.BooleanField(
        default=False, verbose_name="Converted from Proforma"
    )
    proforma_converted_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Proforma Converted At"
    )

    # Invoice Identifier & Timing
    invoice_number = models.CharField(max_length=50, unique=True, verbose_name="Invoice Number")
    invoice_date = models.DateField(default=timezone.now, verbose_name="Invoice Date")
    invoice_time = models.CharField(max_length=20, default="11:00 AM", blank=True, verbose_name="Invoice Time")
    invoice_type = models.CharField(max_length=20, choices=INVOICE_TYPE_CHOICES, default='DIRECT', verbose_name="Invoice Type")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PAID', verbose_name="Status")

    # Relations
    project = models.ForeignKey(
        'lead_management.Project', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices', verbose_name="Linked Project"
    )
    amc_contract = models.ForeignKey(
        'amc.AMCContract', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices', verbose_name="Linked AMC Contract"
    )
    service = models.ForeignKey(
        'amc.AMCService', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices', verbose_name="Linked Service"
    )
    customer = models.ForeignKey(
        'lead_management.Customer', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices', verbose_name="Customer"
    )
    billing_detail = models.ForeignKey(
        'quotation.BillingDetail', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invoices', verbose_name="Selected Company Bank"
    )

    # Fixed DS Aqua Company Header (default values)
    company_name = models.CharField(max_length=255, default="D S WATER TECH PVT LTD", verbose_name="Company Name")
    company_address = models.TextField(
        default="Manufacturing Plant: S No 156/5A, Belhekar Wasti, Manjari Bk, Hadapsar, Pune City, Maharashtra, India – 412307.\nCorporate Office: Office No. 216, 2nd Floor, Deccan Heights, Opp. KFC, Near PMT Bus Stop, Deccan, Above Joshi Wadewale, Pune – 411004.",
        verbose_name="Company Address"
    )
    company_phone = models.CharField(max_length=50, default="+91 866-8274-241, +91 883-0373-068", verbose_name="Company Phone")
    company_email = models.CharField(max_length=100, default="dswatertech1@gmail.com", verbose_name="Company Email")
    company_gstin = models.CharField(max_length=50, default="27AALCD8065C1ZJ", blank=True, verbose_name="Company GSTIN")
    company_state = models.CharField(max_length=50, default="27-Maharashtra", verbose_name="Company State")

    # Bill To
    bill_to_name = models.CharField(max_length=255, verbose_name="Bill To Name / Company")
    bill_to_address = models.TextField(blank=True, default='', verbose_name="Billing Address")
    bill_to_contact = models.CharField(max_length=50, blank=True, default='', verbose_name="Contact Number")
    bill_to_gstin = models.CharField(max_length=50, blank=True, default='', verbose_name="Customer GSTIN")
    bill_to_state = models.CharField(max_length=100, default='27-Maharashtra', blank=True, verbose_name="Billing State")

    # Ship To
    ship_to_name = models.CharField(max_length=255, blank=True, default='', verbose_name="Ship To Name")
    ship_to_address = models.TextField(blank=True, default='', verbose_name="Shipping Address")
    ship_to_contact = models.CharField(max_length=50, blank=True, default='', verbose_name="Shipping Contact")
    ship_to_gstin = models.CharField(max_length=50, blank=True, default='', verbose_name="Shipping GSTIN")
    ship_to_state = models.CharField(max_length=100, default='27-Maharashtra', blank=True, verbose_name="Shipping State")

    # Place of supply & PO
    place_of_supply = models.CharField(max_length=100, default='27-Maharashtra', verbose_name="Place of Supply")
    po_number = models.CharField(max_length=100, blank=True, default='', verbose_name="PO Number")
    po_date = models.DateField(null=True, blank=True, verbose_name="PO Date")

    # Pay To (Banking Information Snapshot)
    bank_name = models.CharField(max_length=255, default='Icici Bank Limited, S. P. Pune', blank=True, verbose_name="Bank Name")
    bank_account_no = models.CharField(max_length=50, default='645105006800', blank=True, verbose_name="Account Number")
    bank_ifsc = models.CharField(max_length=30, default='ICIC0006451', blank=True, verbose_name="IFSC Code")
    account_holder_name = models.CharField(max_length=255, default='D S WATER TECH PVT LTD', blank=True, verbose_name="Account Holder Name")

    # Financial Summary
    sub_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Sub Total")
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount Total")
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Taxable Amount")
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="CGST Total")
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="SGST Total")
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="IGST Total")
    round_off = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'), verbose_name="Round Off")
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Grand Total")
    received_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Received Amount")
    balance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Balance Amount")
    you_saved = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="You Saved")
    payment_mode = models.CharField(max_length=100, default='ICICI BANK', blank=True, verbose_name="Payment Mode")
    previous_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Previous Balance")
    current_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Current Balance")

    amount_in_words = models.CharField(max_length=500, blank=True, default='', verbose_name="Amount in Words")
    terms_conditions = models.TextField(default="Thank you for doing business with us.", blank=True, verbose_name="Terms & Conditions")
    terms_and_conditions = models.JSONField(blank=True, null=True, default=list, verbose_name="Terms & Conditions (Structured)")
    notes = models.TextField(blank=True, default='', verbose_name="Internal Notes")

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-id']
        verbose_name = "Tax Invoice"
        verbose_name_plural = "Tax Invoices"

    def __str__(self):
        doc_label = "Proforma Invoice" if self.is_proforma else "Tax Invoice"
        return f"{doc_label} #{self.invoice_number} - {self.bill_to_name} (₹{self.grand_total})"

    @property
    def is_proforma(self):
        return self.document_type == 'PROFORMA'

    def save(self, *args, **kwargs):
        # Auto-compute amount in words if not provided or total changed
        if self.grand_total is not None and not self.amount_in_words:
            self.amount_in_words = number_to_indian_words(self.grand_total)
        # Compute balance amount
        if self.grand_total is not None and self.received_amount is not None:
            try:
                gt = Decimal(str(self.grand_total))
                rec = Decimal(str(self.received_amount))
                self.balance_amount = max(Decimal('0.00'), gt - rec)
            except Exception:
                pass
        super().save(*args, **kwargs)


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    item_name = models.CharField(max_length=255, verbose_name="Item Name / Description")
    hsn_sac = models.CharField(max_length=50, default='8421', blank=True, verbose_name="HSN/SAC Code")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1.00'), verbose_name="Quantity")
    unit = models.CharField(max_length=30, default='Nos', blank=True, verbose_name="Unit")
    price_per_unit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Price / Unit")
    discount_percent = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount %")
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount Amount")
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Taxable Amount")

    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('18.00'), verbose_name="GST Rate %")
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="GST Amount")
    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('9.00'), verbose_name="CGST Rate %")
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="CGST Amount")
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('9.00'), verbose_name="SGST Rate %")
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="SGST Amount")
    igst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'), verbose_name="IGST Rate %")
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="IGST Amount")

    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Total Amount")
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        verbose_name = "Invoice Line Item"
        verbose_name_plural = "Invoice Line Items"

    def __str__(self):
        return f"{self.item_name} ({self.quantity} {self.unit}) - ₹{self.total_amount}"


# ==============================================================================
# BILL OF SUPPLY MODEL (NON-GST FOR AMC & SERVICES)
# ==============================================================================
class BillOfSupply(models.Model):
    STATUS_CHOICES = [
        ('PAID', 'Paid'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('UNPAID', 'Unpaid'),
        ('CANCELLED', 'Cancelled'),
    ]

    bill_number = models.CharField(max_length=50, unique=True, verbose_name="Bill Number")
    bill_date = models.DateField(default=timezone.now, verbose_name="Bill Date")
    bill_time = models.CharField(max_length=20, default="11:00 AM", blank=True, verbose_name="Bill Time")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PAID', verbose_name="Status")

    # Linked Sources
    linked_invoice = models.ForeignKey(
        Invoice, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='linked_bills_of_supply', verbose_name="Linked Tax Invoice"
    )
    amc_contract = models.ForeignKey(
        'amc.AMCContract', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='bills_of_supply', verbose_name="Linked AMC Contract"
    )
    customer = models.ForeignKey(
        'lead_management.Customer', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='bills_of_supply', verbose_name="Customer"
    )
    billing_detail = models.ForeignKey(
        'quotation.BillingDetail', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='bills_of_supply', verbose_name="Selected Company Bank"
    )

    # Company Details (DS AQUA defaults)
    company_name = models.CharField(max_length=255, default="D S AQUA", verbose_name="Company Name")
    company_address = models.TextField(
        default="Manufacturing Plant: S No 156/5A, Belhekar Wasti, Manjari Bk, Hadapsar, Pune City, Maharashtra, India – 412307.\nCorporate Office: Office No. 216, 2nd Floor, Deccan Heights, Opp. KFC, Near PMT Bus Stop, Deccan, Above Joshi Wadewale, Pune – 411004.",
        verbose_name="Company Address"
    )
    company_phone = models.CharField(max_length=50, default="+91 866-8274-241, +91 883-0373-068", verbose_name="Company Phone")
    company_email = models.CharField(max_length=100, default="dswatertech1@gmail.com", verbose_name="Company Email")
    company_state = models.CharField(max_length=50, default="27-Maharashtra", verbose_name="Company State")

    # Bill To Party
    bill_to_name = models.CharField(max_length=255, verbose_name="Bill To Name / Company")
    bill_to_contact_person = models.CharField(max_length=100, blank=True, default='', verbose_name="Contact Person")
    bill_to_contact = models.CharField(max_length=50, blank=True, default='', verbose_name="Contact Number")
    bill_to_email = models.CharField(max_length=100, blank=True, default='', verbose_name="Customer Email")
    bill_to_state = models.CharField(max_length=100, default='Maharashtra', blank=True, verbose_name="Billing State")
    bill_to_city = models.CharField(max_length=100, default='Pune', blank=True, verbose_name="Billing City")
    bill_to_address = models.TextField(blank=True, default='', verbose_name="Billing Address")
    bill_to_gstin = models.CharField(max_length=50, blank=True, default='', verbose_name="Customer GSTIN")
    bill_to_pan = models.CharField(max_length=50, blank=True, default='', verbose_name="Customer PAN")

    # Ship To Party
    ship_to_same_as_bill_to = models.BooleanField(default=True, verbose_name="Same as Bill To")
    ship_to_name = models.CharField(max_length=255, blank=True, default='', verbose_name="Ship To Name")
    ship_to_contact_person = models.CharField(max_length=100, blank=True, default='', verbose_name="Ship Contact Person")
    ship_to_contact = models.CharField(max_length=50, blank=True, default='', verbose_name="Ship Contact Number")
    ship_to_email = models.CharField(max_length=100, blank=True, default='', verbose_name="Ship Email")
    ship_to_state = models.CharField(max_length=100, default='Maharashtra', blank=True, verbose_name="Shipping State")
    ship_to_city = models.CharField(max_length=100, default='Pune', blank=True, verbose_name="Shipping City")
    ship_to_address = models.TextField(blank=True, default='', verbose_name="Shipping Address")
    ship_to_gstin = models.CharField(max_length=50, blank=True, default='', verbose_name="Shipping GSTIN")

    # Logistics & Ref
    place_of_supply = models.CharField(max_length=100, default='27-Maharashtra', verbose_name="Place of Supply")
    po_number = models.CharField(max_length=100, blank=True, default='', verbose_name="PO / Ref Number")
    po_date = models.DateField(null=True, blank=True, verbose_name="PO Date")

    # Bank info
    bank_name = models.CharField(max_length=255, default='Federal Bank, Pune - Phursungi', blank=True, verbose_name="Bank Name")
    bank_account_no = models.CharField(max_length=50, default='99980102625931', blank=True, verbose_name="Account Number")
    bank_ifsc = models.CharField(max_length=30, default='FDRL0001785', blank=True, verbose_name="IFSC Code")
    account_holder_name = models.CharField(max_length=255, default='DATTA MARUTI RANDIVE', blank=True, verbose_name="Account Holder Name")

    # Totals
    sub_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Sub Total")
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount Total")
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Taxable Amount")
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Grand Total")
    received_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Received Amount")
    balance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Balance Amount")
    you_saved = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="You Saved")
    payment_mode = models.CharField(max_length=100, default='Federal Bank(amc)', blank=True, verbose_name="Payment Mode")
    amount_in_words = models.CharField(max_length=500, blank=True, default='', verbose_name="Amount in Words")

    # AMC Specific fields
    amc_is_renewal = models.BooleanField(default=False, verbose_name="Is AMC Renewal")
    amc_cycle_number = models.IntegerField(default=1, verbose_name="AMC Cycle / Term Number")
    amc_no_of_visits = models.IntegerField(default=4, verbose_name="Scheduled Number of Visits")
    amc_contract_number = models.CharField(max_length=100, blank=True, default='', verbose_name="Contract Number")
    amc_contract_product = models.CharField(max_length=255, blank=True, default='', verbose_name="Contract Product")

    terms_conditions = models.TextField(default="Thank you for doing business with us.", blank=True, verbose_name="Terms & Conditions")
    terms_and_conditions = models.JSONField(blank=True, null=True, default=list, verbose_name="Terms & Conditions (Structured)")
    notes = models.TextField(default="one years warranty excluding electric parts", blank=True, verbose_name="Description / Warranty Notes")

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='bills_of_supply_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bill_of_supply'
        ordering = ['-id']
        verbose_name = "Bill of Supply"
        verbose_name_plural = "Bills of Supply"

    def __str__(self):
        return f"Bill of Supply #{self.bill_number} - {self.bill_to_name} (₹{self.grand_total})"

    @property
    def invoice_number(self):
        return self.bill_number

    @property
    def invoice_date(self):
        return self.bill_date

    @property
    def invoice_time(self):
        return self.bill_time

    @property
    def invoice_type(self):
        return 'BILL_OF_SUPPLY'

    @property
    def is_bill_of_supply(self):
        return True

    def save(self, *args, **kwargs):
        if self.grand_total is not None and not self.amount_in_words:
            self.amount_in_words = number_to_indian_words(self.grand_total)
        if self.grand_total is not None and self.received_amount is not None:
            try:
                gt = Decimal(str(self.grand_total))
                rec = Decimal(str(self.received_amount))
                self.balance_amount = max(Decimal('0.00'), gt - rec)
            except Exception:
                pass
        super().save(*args, **kwargs)


class BillOfSupplyItem(models.Model):
    bill_of_supply = models.ForeignKey(BillOfSupply, on_delete=models.CASCADE, related_name='items')
    item_name = models.CharField(max_length=255, verbose_name="Item Name")
    description = models.TextField(blank=True, default='', verbose_name="Description / Specs")
    hsn_sac = models.CharField(max_length=50, default='8421', blank=True, verbose_name="HSN/SAC Code")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1.00'), verbose_name="Quantity")
    unit = models.CharField(max_length=30, default='Nos', blank=True, verbose_name="Unit")
    price_per_unit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Price / Unit")
    discount_percent = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount %")
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount Amount")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Total Amount")
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'bill_of_supply_items'
        ordering = ['sort_order', 'id']
        verbose_name = "Bill of Supply Line Item"
        verbose_name_plural = "Bill of Supply Line Items"

    def __str__(self):
        return f"{self.item_name} ({self.quantity} {self.unit}) - ₹{self.total_amount}"


# ==============================================================================
# DELIVERY CHALLAN MODEL (PROJECT, AMC, SERVICE DISPATCH)
# ==============================================================================
class DeliveryChallan(models.Model):
    CHALLAN_TYPE_CHOICES = [
        ('PROJECT', 'Project Delivery'),
        ('AMC', 'AMC Maintenance / Spares'),
        ('SERVICE', 'Service / Breakdown Spares'),
        ('DIRECT', 'Direct Material Dispatch'),
    ]

    STATUS_CHOICES = [
        ('DELIVERED', 'Delivered'),
        ('IN_TRANSIT', 'In Transit / Dispatched'),
        ('PENDING', 'Pending Dispatch'),
        ('CANCELLED', 'Cancelled'),
    ]

    challan_number = models.CharField(max_length=50, unique=True, verbose_name="Challan Number")
    challan_date = models.DateField(default=timezone.now, verbose_name="Challan Date")
    challan_time = models.CharField(max_length=20, default="11:00 AM", blank=True, verbose_name="Challan Time")
    challan_type = models.CharField(max_length=30, choices=CHALLAN_TYPE_CHOICES, default='PROJECT', verbose_name="Challan Type")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DELIVERED', verbose_name="Status")

    # Linked Sources
    project = models.ForeignKey(
        'lead_management.Project', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='delivery_challans', verbose_name="Linked Project"
    )
    amc_contract = models.ForeignKey(
        'amc.AMCContract', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='delivery_challans', verbose_name="Linked AMC Contract"
    )
    service = models.ForeignKey(
        'amc.AMCService', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='delivery_challans', verbose_name="Linked Service"
    )
    customer = models.ForeignKey(
        'lead_management.Customer', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='delivery_challans', verbose_name="Customer"
    )
    linked_invoice = models.ForeignKey(
        Invoice, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='delivery_challans', verbose_name="Linked Tax Invoice"
    )
    linked_bill_of_supply = models.ForeignKey(
        BillOfSupply, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='delivery_challans', verbose_name="Linked Bill of Supply"
    )
    billing_detail = models.ForeignKey(
        'quotation.BillingDetail', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='delivery_challans', verbose_name="Selected Company Bank"
    )

    # Company Details (DS AQUA default matching Bill of Supply)
    company_name = models.CharField(max_length=255, default="D S AQUA", verbose_name="Company Name")
    company_address = models.TextField(
        default="Manufacturing Plant: S No 156/5A, Belhekar Wasti, Manjari Bk, Hadapsar, Pune City, Maharashtra, India – 412307.\nCorporate Office: Office No. 216, 2nd Floor, Deccan Heights, Opp. KFC, Near PMT Bus Stop, Deccan, Above Joshi Wadewale, Pune – 411004.",
        verbose_name="Company Address"
    )
    company_phone = models.CharField(max_length=50, default="+91 866-8274-241, +91 883-0373-068", verbose_name="Company Phone")
    company_email = models.CharField(max_length=100, default="dswatertech1@gmail.com", verbose_name="Company Email")
    company_gstin = models.CharField(max_length=50, default="27AALCD8065C1ZJ", blank=True, verbose_name="Company GSTIN")
    company_state = models.CharField(max_length=50, default="27-Maharashtra", verbose_name="Company State")

    # Bill To Party (Client)
    bill_to_name = models.CharField(max_length=255, verbose_name="Bill To Name / Company")
    bill_to_contact_person = models.CharField(max_length=100, blank=True, default='', verbose_name="Contact Person")
    bill_to_contact = models.CharField(max_length=50, blank=True, default='', verbose_name="Contact Number")
    bill_to_email = models.CharField(max_length=100, blank=True, default='', verbose_name="Customer Email")
    bill_to_state = models.CharField(max_length=100, default='Maharashtra', blank=True, verbose_name="Billing State")
    bill_to_city = models.CharField(max_length=100, default='Pune', blank=True, verbose_name="Billing City")
    bill_to_address = models.TextField(blank=True, default='', verbose_name="Billing Address")
    bill_to_gstin = models.CharField(max_length=50, blank=True, default='', verbose_name="Customer GSTIN")
    bill_to_pan = models.CharField(max_length=50, blank=True, default='', verbose_name="Customer PAN")

    # Ship To Party (Consignee / Site delivery address)
    ship_to_same_as_bill_to = models.BooleanField(default=True, verbose_name="Same as Bill To")
    ship_to_name = models.CharField(max_length=255, blank=True, default='', verbose_name="Ship To Name")
    ship_to_contact_person = models.CharField(max_length=100, blank=True, default='', verbose_name="Ship Contact Person")
    ship_to_contact = models.CharField(max_length=50, blank=True, default='', verbose_name="Ship Contact Number")
    ship_to_email = models.CharField(max_length=100, blank=True, default='', verbose_name="Ship Email")
    ship_to_state = models.CharField(max_length=100, default='Maharashtra', blank=True, verbose_name="Shipping State")
    ship_to_city = models.CharField(max_length=100, default='Pune', blank=True, verbose_name="Shipping City")
    ship_to_address = models.TextField(blank=True, default='', verbose_name="Shipping Address")
    ship_to_gstin = models.CharField(max_length=50, blank=True, default='', verbose_name="Shipping GSTIN")

    # Transport / Logistics details
    place_of_supply = models.CharField(max_length=100, default='27-Maharashtra', verbose_name="Place of Supply")
    po_number = models.CharField(max_length=100, blank=True, default='', verbose_name="PO / Ref Number")
    po_date = models.DateField(null=True, blank=True, verbose_name="PO Date")
    transport_mode = models.CharField(max_length=100, default='Road Transport', blank=True, verbose_name="Mode of Transport")
    vehicle_number = models.CharField(max_length=50, blank=True, default='', verbose_name="Vehicle Number")
    lr_rr_number = models.CharField(max_length=50, blank=True, default='', verbose_name="LR / RR / Docket No")
    dispatch_date = models.DateField(null=True, blank=True, verbose_name="Dispatch Date")
    delivered_by = models.CharField(max_length=100, blank=True, default='', verbose_name="Delivered By Person / Transporter")

    # Banking Information Snapshot
    bank_name = models.CharField(max_length=255, default='Federal Bank, Pune - Phursungi', blank=True, verbose_name="Bank Name")
    bank_account_no = models.CharField(max_length=50, default='99980102625931', blank=True, verbose_name="Account Number")
    bank_ifsc = models.CharField(max_length=30, default='FDRL0001785', blank=True, verbose_name="IFSC Code")
    account_holder_name = models.CharField(max_length=255, default='DATTA MARUTI RANDIVE', blank=True, verbose_name="Account Holder Name")

    # Financial / Quantity summary
    total_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Total Quantity")
    sub_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Sub Total")
    discount_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount Total")
    taxable_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Taxable Amount")
    grand_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Total Value")
    amount_in_words = models.CharField(max_length=500, blank=True, default='', verbose_name="Amount in Words")

    terms_conditions = models.TextField(
        default="1. Goods once dispatched/delivered are non-returnable without prior written consent.\n2. Goods inspected and received in good condition.\n3. Subject to Pune jurisdiction.",
        blank=True, verbose_name="Terms & Conditions"
    )
    terms_and_conditions = models.JSONField(blank=True, null=True, default=list, verbose_name="Terms & Conditions (Structured)")
    notes = models.TextField(
        default="Material dispatched for Installation / Commissioning / Maintenance service purpose.",
        blank=True, verbose_name="Dispatch Notes"
    )

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_challans_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'delivery_challan'
        ordering = ['-id']
        verbose_name = "Delivery Challan"
        verbose_name_plural = "Delivery Challans"

    def __str__(self):
        return f"Delivery Challan #{self.challan_number} - {self.bill_to_name} ({self.total_quantity} Qty)"

    @property
    def invoice_number(self):
        return self.challan_number

    @property
    def invoice_date(self):
        return self.challan_date

    @property
    def invoice_time(self):
        return self.challan_time

    @property
    def invoice_type(self):
        return 'DELIVERY_CHALLAN'

    @property
    def is_delivery_challan(self):
        return True

    def save(self, *args, **kwargs):
        if self.grand_total is not None and not self.amount_in_words:
            self.amount_in_words = number_to_indian_words(self.grand_total)
        super().save(*args, **kwargs)


class DeliveryChallanItem(models.Model):
    challan = models.ForeignKey(DeliveryChallan, on_delete=models.CASCADE, related_name='items', verbose_name="Delivery Challan")
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='challan_items', verbose_name="Linked Inventory Item"
    )
    item_name = models.CharField(max_length=255, verbose_name="Item / Product Name")
    description = models.TextField(blank=True, default='', verbose_name="Item Description / Serial / Spec")
    hsn_sac = models.CharField(max_length=20, default='8421', blank=True, verbose_name="HSN / SAC Code")
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('1.00'), verbose_name="Quantity")
    unit = models.CharField(max_length=20, default='NOS', verbose_name="Unit of Measurement")
    price_per_unit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Price / Value Per Unit")
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount %")
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Discount Amount")
    taxable_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Taxable Amount")
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Total Amount")
    remarks = models.CharField(max_length=255, blank=True, default='', verbose_name="Remarks")
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'delivery_challan_items'
        ordering = ['sort_order', 'id']
        verbose_name = "Delivery Challan Item"
        verbose_name_plural = "Delivery Challan Items"

    def __str__(self):
        return f"{self.item_name} ({self.quantity} {self.unit}) - ₹{self.total_amount}"


# ==============================================================================
# ADVANCE PAYMENT RECEIPT MODEL (PROJECT, AMC, SERVICE ADVANCE PAYMENTS)
# ==============================================================================
class AdvancePaymentReceipt(models.Model):
    RECEIPT_TYPE_CHOICES = [
        ('PROJECT', 'Project Advance'),
        ('AMC', 'AMC Contract Advance'),
        ('SERVICE', 'Service Advance'),
        ('DIRECT', 'Direct / Other Advance'),
    ]

    STATUS_CHOICES = [
        ('CONFIRMED', 'Confirmed / Cleared'),
        ('PENDING', 'Pending Clearance'),
        ('CANCELLED', 'Cancelled'),
    ]

    PAYMENT_MODE_CHOICES = [
        ('ONLINE', 'Online / UPI'),
        ('NEFT_RTGS', 'Bank Transfer / NEFT / RTGS'),
        ('CHEQUE', 'Cheque / DD'),
        ('CASH', 'Cash'),
        ('CARD', 'Credit / Debit Card'),
    ]

    receipt_number = models.CharField(max_length=50, unique=True, verbose_name="Receipt Number")
    receipt_date = models.DateField(default=timezone.now, verbose_name="Receipt Date")
    receipt_type = models.CharField(max_length=30, choices=RECEIPT_TYPE_CHOICES, default='PROJECT', verbose_name="Receipt Source")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CONFIRMED', verbose_name="Status")

    # Linked Sources
    project = models.ForeignKey(
        'lead_management.Project', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='advance_receipts', verbose_name="Linked Project"
    )
    amc_contract = models.ForeignKey(
        'amc.AMCContract', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='advance_receipts', verbose_name="Linked AMC Contract"
    )
    service = models.ForeignKey(
        'amc.AMCService', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='advance_receipts', verbose_name="Linked Service"
    )
    customer = models.ForeignKey(
        'lead_management.Customer', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='advance_receipts', verbose_name="Customer"
    )
    billing_detail = models.ForeignKey(
        'quotation.BillingDetail', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='advance_receipts', verbose_name="Selected Company Bank"
    )

    # Company Details (DS AQUA defaults matching Bill of Supply & Challan)
    company_name = models.CharField(max_length=255, default="D S AQUA", verbose_name="Company Name")
    company_address = models.TextField(
        default="Manufacturing Plant: S No 156/5A, Belhekar Wasti, Manjari Bk, Hadapsar, Pune City, Maharashtra, India – 412307.\nCorporate Office: Office No. 216, 2nd Floor, Deccan Heights, Opp. KFC, Near PMT Bus Stop, Deccan, Above Joshi Wadewale, Pune – 411004.",
        verbose_name="Company Address"
    )
    company_phone = models.CharField(max_length=50, default="+91 866-8274-241, +91 883-0373-068", verbose_name="Company Phone")
    company_email = models.CharField(max_length=100, default="dswatertech1@gmail.com", verbose_name="Company Email")
    company_gstin = models.CharField(max_length=50, default="27AALCD8065C1ZJ", blank=True, verbose_name="Company GSTIN")
    company_state = models.CharField(max_length=50, default="27-Maharashtra", verbose_name="Company State")

    # Payer / Customer Details
    payer_name = models.CharField(max_length=255, verbose_name="Received From (Customer / Client Name)")
    contact_person = models.CharField(max_length=100, blank=True, default='', verbose_name="Contact Person")
    contact_number = models.CharField(max_length=50, blank=True, default='', verbose_name="Contact Number")
    email = models.CharField(max_length=100, blank=True, default='', verbose_name="Customer Email")
    address = models.TextField(blank=True, default='', verbose_name="Client Address")
    gstin = models.CharField(max_length=50, blank=True, default='', verbose_name="Customer GSTIN")
    pan = models.CharField(max_length=50, blank=True, default='', verbose_name="Customer PAN")
    state = models.CharField(max_length=100, default='Maharashtra', blank=True, verbose_name="State")
    city = models.CharField(max_length=100, default='Pune', blank=True, verbose_name="City")

    # Payment details
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Advance Amount (₹)")
    amount_in_words = models.CharField(max_length=500, blank=True, default='', verbose_name="Amount in Words")
    payment_mode = models.CharField(max_length=50, choices=PAYMENT_MODE_CHOICES, default='ONLINE', verbose_name="Payment Mode")
    transaction_ref = models.CharField(max_length=100, blank=True, default='', verbose_name="Transaction / UTR / Cheque Ref No")
    transaction_date = models.DateField(null=True, blank=True, verbose_name="Transaction Date")

    # Bank account details where payment was received
    bank_name = models.CharField(max_length=255, default='Federal Bank, Pune - Phursungi', blank=True, verbose_name="Bank Name")
    bank_account_no = models.CharField(max_length=50, default='99980102625931', blank=True, verbose_name="Account Number")
    bank_ifsc = models.CharField(max_length=30, default='FDRL0001785', blank=True, verbose_name="IFSC Code")
    account_holder_name = models.CharField(max_length=255, default='DATTA MARUTI RANDIVE', blank=True, verbose_name="Account Holder Name")

    # Project / Contract snapshot
    total_order_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Total Order / Contract Amount (₹)")
    balance_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), verbose_name="Remaining Balance (₹)")
    purpose = models.CharField(max_length=255, blank=True, default='', verbose_name="Purpose / Against Description")
    notes = models.TextField(blank=True, default='', verbose_name="Notes / Remarks")
    terms_conditions = models.TextField(
        default="1. Advance payment received is non-refundable upon project/contract commencement.\n2. Official tax invoice / bill will be issued upon milestone / progress delivery.\n3. Subject to Pune jurisdiction.",
        blank=True, verbose_name="Terms & Conditions"
    )
    terms_and_conditions = models.JSONField(blank=True, null=True, default=list, verbose_name="Terms & Conditions (Structured)")

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='advance_receipts_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'advance_payment_receipts'
        ordering = ['-id']
        verbose_name = "Advance Payment Receipt"
        verbose_name_plural = "Advance Payment Receipts"

    def __str__(self):
        return f"Advance Receipt #{self.receipt_number} - {self.payer_name} (₹{self.amount})"

    @property
    def invoice_number(self):
        return self.receipt_number

    @property
    def invoice_date(self):
        return self.receipt_date

    @property
    def grand_total(self):
        return self.amount

    @property
    def bill_to_name(self):
        return self.payer_name

    @property
    def bill_to_address(self):
        return self.address

    @property
    def bill_to_contact(self):
        return self.contact_number

    @property
    def bill_to_email(self):
        return self.email

    @property
    def bill_to_gstin(self):
        return self.gstin

    @property
    def bill_to_state(self):
        return self.state

    def save(self, *args, **kwargs):
        if self.amount is not None and not self.amount_in_words:
            self.amount_in_words = number_to_indian_words(self.amount)
        super().save(*args, **kwargs)
