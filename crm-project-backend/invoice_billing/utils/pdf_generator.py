import os
import base64
import logging
from decimal import Decimal
from django.conf import settings
from django.template.loader import render_to_string

try:
    from weasyprint import HTML
except Exception:
    HTML = None

logger = logging.getLogger(__name__)


def amount_to_indian_words(num_val):
    """Convert a numeric amount into standard Indian currency words (Title Cased)."""
    try:
        val = int(round(float(num_val or 0)))
        if val <= 0:
            return "Zero Rupees only"
        try:
            import num2words
            raw = num2words.num2words(val, lang='en_IN')
            # Clean up commas and ensure proper casing
            clean = raw.replace(',', '').replace('-', ' ')
            words = ' '.join(w.capitalize() for w in clean.split())
            return f"{words} Rupees only"
        except Exception:
            pass
    except Exception:
        pass
    return f"{num_val} Rupees only"


def build_invoice_pdf_context(invoice):
    """Build context for rendering invoice.html template"""
    inv_type = str(getattr(invoice, 'invoice_type', '')).upper()
    is_delivery_challan = (inv_type == 'DELIVERY_CHALLAN') or hasattr(invoice, 'challan_number')
    is_bill_of_supply = (inv_type == 'BILL_OF_SUPPLY') or hasattr(invoice, 'bill_number')
    doc_type = str(getattr(invoice, 'document_type', '')).upper()
    is_proforma = (doc_type == 'PROFORMA') or bool(getattr(invoice, 'is_proforma', False))

    items_qs = invoice.items.all()
    items_list = []
    total_quantity = Decimal('0')
    total_discount = Decimal('0')
    total_gst = Decimal('0')
    total_line_amount = Decimal('0')

    for it in items_qs:
        qty = Decimal(str(getattr(it, 'quantity', 0) or 0))
        rate = Decimal(str(getattr(it, 'price_per_unit', 0) or 0))
        gross = qty * rate
        disc = Decimal(str(getattr(it, 'discount_amount', 0) or 0))
        disc_pct = Decimal(str(getattr(it, 'discount_percent', 0) or 0))
        if disc == 0 and disc_pct > 0:
            disc = (gross * disc_pct) / Decimal('100')

        taxable = max(Decimal('0'), gross - disc)

        if is_bill_of_supply or is_delivery_challan:
            # Bill of Supply and Delivery Challan are strictly non-GST
            gst_pct = Decimal('0')
            gst_amt = Decimal('0')
            line_total = Decimal(str(getattr(it, 'total_amount', None) or taxable))
        else:
            gst_pct = Decimal(str(getattr(it, 'gst_rate', None) or getattr(it, 'gst_percent', None) or 18))
            gst_amt = Decimal(str(getattr(it, 'gst_amount', 0) or 0))
            if gst_amt == 0 and gst_pct > 0:
                gst_amt = (taxable * gst_pct) / Decimal('100')
            line_total = Decimal(str(getattr(it, 'total_amount', None) or (taxable + gst_amt)))

        total_quantity += qty
        total_discount += disc
        total_gst += gst_amt
        total_line_amount += line_total

        items_list.append({
            'item_name': getattr(it, 'item_name', ''),
            'description': getattr(it, 'description', '') if hasattr(it, 'description') else '',
            'hsn_sac': getattr(it, 'hsn_sac', '8421') or '8421',
            'quantity': qty,
            'unit': getattr(it, 'unit', 'Nos') or 'Nos',
            'price_per_unit': rate,
            'discount_amount': disc,
            'discount_percent': disc_pct,
            'gst_percent': gst_pct,
            'gst_amount': gst_amt,
            'total_amount': line_total,
        })

    # AMC details (visits, renewal, period)
    amc = getattr(invoice, 'amc_contract', None)
    if amc:
        no_of_visits = getattr(amc, 'no_of_visits', 4) or 4
        service_frequency = getattr(amc, 'service_frequency', 'Quarterly') or 'Quarterly'
        cycles_count = amc.cycles.count() if hasattr(amc, 'cycles') else 0
        is_renewal = (getattr(amc, 'status', '') == 'RENEWED') or (cycles_count > 1)
        amc_cycle_number = max(1, cycles_count)
        start_d = amc.start_date.strftime('%d-%m-%Y') if amc.start_date else ''
        end_d = amc.end_date.strftime('%d-%m-%Y') if amc.end_date else ''
        contract_period = f"{start_d} to {end_d}" if start_d and end_d else ''
        product_name = getattr(amc, 'product', '') or 'Water purifier'
    else:
        no_of_visits = 4
        service_frequency = 'Quarterly'
        is_renewal = False
        amc_cycle_number = 1
        contract_period = ''
        product_name = ''

    # Description (notes field or defaults)
    description = (getattr(invoice, 'notes', '') or '').strip()
    if not description and is_bill_of_supply:
        description = 'one years warranty excluding electric parts'
    elif not description and is_delivery_challan:
        description = 'Material dispatched for project / service / maintenance delivery purpose.'

    # Company info resolution
    if is_bill_of_supply or is_delivery_challan:
        company_name = getattr(invoice, 'company_name', None) or 'D S AQUA'
        company_address = getattr(invoice, 'company_address', None) or 'HEAD OFFICE: Nr Kalyani School, Belhekar Wasti, Manjari, Hadapsar, Pune Maharashtra'
        company_phone = getattr(invoice, 'company_phone', None) or '8830373068'
        company_email = getattr(invoice, 'company_email', None) or 'dswastewatersolution@gmail.com'
        company_state = getattr(invoice, 'company_state', None) or '27-Maharashtra'
    else:
        company_name = getattr(invoice, 'company_name', None) or 'D S WATER TECH PVT LTD'
        company_address = getattr(invoice, 'company_address', None) or 'GROUND FLOOR BELHEKAR COMPLEX SR. NO. 156/5A, OFFICE NO. 1 MANJARI BUDRUK Pune'
        company_phone = getattr(invoice, 'company_phone', None) or '+919881653030'
        company_email = getattr(invoice, 'company_email', None) or 'dswatertech1@gmail.com'
        company_state = getattr(invoice, 'company_state', None) or '27-Maharashtra'

    # Pay To Banking Information resolution:
    # 1. Linked BillingDetail on invoice
    # 2. Or Default / First BillingDetail from master data
    # 3. Or fields stored directly on invoice
    # 4. Or standard DS Aqua fallback
    billing_obj = getattr(invoice, 'billing_detail', None)
    if not billing_obj:
        try:
            from quotation.models import BillingDetail
            billing_obj = BillingDetail.objects.filter(is_default=True).first() or BillingDetail.objects.first()
        except Exception as e:
            logger.warning(f"Could not load BillingDetail master: {e}")
            billing_obj = None

    if billing_obj:
        b_name = (getattr(billing_obj, 'bank_name', '') or '').strip()
        b_branch = (getattr(billing_obj, 'branch_name', '') or '').strip()
        if b_branch and b_branch.lower() not in b_name.lower():
            bank_name = f"{b_name}, {b_branch}".strip(', ')
        else:
            bank_name = b_name or 'Icici Bank Limited, S. P. Pune'

        bank_account_no = (getattr(billing_obj, 'account_number', '') or '').strip() or '645105006800'
        bank_ifsc = (getattr(billing_obj, 'ifsc_code', '') or '').strip() or 'ICIC0006451'
        account_holder = (getattr(billing_obj, 'account_holder_name', '') or getattr(billing_obj, 'company_name', '') or '').strip() or 'D S WATER TECH PVT LTD'
    else:
        bank_name = getattr(invoice, 'bank_name', None) or 'Icici Bank Limited, S. P. Pune'
        bank_account_no = getattr(invoice, 'bank_account_no', None) or '645105006800'
        bank_ifsc = getattr(invoice, 'bank_ifsc', None) or getattr(invoice, 'bank_ifsc_code', None) or 'ICIC0006451'
        account_holder = getattr(invoice, 'account_holder_name', None) or getattr(invoice, 'bank_account_holder', None) or 'D S WATER TECH PVT LTD'

    sub_total = getattr(invoice, 'sub_total', None) or getattr(invoice, 'subtotal', None)
    if sub_total is None or sub_total == Decimal('0.00'):
        sub_total = sum((it['price_per_unit'] * it['quantity']) for it in items_list) if items_list else Decimal('0.00')

    terms_conditions = getattr(invoice, 'terms_conditions', None) or getattr(invoice, 'terms_and_conditions', None) or 'Thank you for doing business with us.'

    # Round off & Abs
    try:
        round_off_val = Decimal(str(getattr(invoice, 'round_off', 0) or 0))
    except Exception:
        round_off_val = Decimal('0.00')
    round_off_abs = abs(round_off_val)

    # Tax splits
    try:
        total_gst_half = (total_gst / Decimal('2')).quantize(Decimal('0.01'))
    except Exception:
        total_gst_half = Decimal('0.00')

    # You saved calculation
    raw_saved = getattr(invoice, 'you_saved', None)
    if raw_saved and Decimal(str(raw_saved)) > 0:
        you_saved_calc = Decimal(str(raw_saved))
    else:
        you_saved_calc = (total_discount * Decimal('1.18')).quantize(Decimal('0.01'))

    # Amount in words
    amount_in_words = amount_to_indian_words(invoice.grand_total)

    # Payment Mode display
    payment_mode_raw = getattr(invoice, 'payment_mode', None) or 'ICICI BANK'
    po_num = getattr(invoice, 'po_number', None)
    if po_num and f"({po_num})" not in payment_mode_raw:
        payment_mode_display = f"{payment_mode_raw}({po_num})"
    else:
        payment_mode_display = payment_mode_raw

    # Logo base64
    logo_base64 = ""
    candidate_logo_paths = [
        os.path.join(settings.BASE_DIR, 'static', 'images', 'ds_aqua_logo.png'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'ds_aqua_logo.jpg'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'dummy-logo.png'),
    ]

    for lpath in candidate_logo_paths:
        if os.path.exists(lpath):
            try:
                with open(lpath, 'rb') as lf:
                    ldata = lf.read()
                    lfmt = 'png' if lpath.lower().endswith('.png') else 'jpeg'
                    logo_base64 = f"data:image/{lfmt};base64," + base64.b64encode(ldata).decode('utf-8')
                    break
            except Exception as e:
                logger.error(f"Error reading logo file {lpath}: {e}")

    # Signature base64
    signature_base64 = ""
    candidate_sig_paths = [
        r"S:\installers\Downloads\aksn sign.png",
        os.path.join(settings.BASE_DIR, 'static', 'images', 'aksn-sign.png'),
        r"S:\installers\Downloads\aksn-sign.png",
    ]
    for spath in candidate_sig_paths:
        if os.path.exists(spath):
            try:
                with open(spath, 'rb') as sf:
                    sdata = sf.read()
                    signature_base64 = "data:image/png;base64," + base64.b64encode(sdata).decode('utf-8')
                    break
            except Exception as err:
                logger.error(f"Error encoding signature from {spath}: {err}")

    return {
        'invoice': invoice,
        'items_list': items_list,
        'total_quantity': total_quantity,
        'total_discount': total_discount,
        'total_gst': total_gst,
        'total_line_amount': total_line_amount,
        'amount_in_words': amount_in_words,
        'payment_mode_display': payment_mode_display,
        'logo_base64': logo_base64,
        'signature_base64': signature_base64,
        'bank_name': bank_name,
        'bank_account_no': bank_account_no,
        'bank_ifsc': bank_ifsc,
        'account_holder': account_holder,
        'sub_total': sub_total,
        'terms_conditions': terms_conditions,
        'round_off_val': round_off_val,
        'round_off_abs': round_off_abs,
        'total_gst_half': total_gst_half,
        'you_saved_calc': you_saved_calc,
        'is_bill_of_supply': is_bill_of_supply,
        'is_delivery_challan': is_delivery_challan,
        'is_proforma': is_proforma,
        'no_of_visits': no_of_visits,
        'service_frequency': service_frequency,
        'is_renewal': is_renewal,
        'amc_cycle_number': amc_cycle_number,
        'contract_period': contract_period,
        'product_name': product_name,
        'description': description,
        'company_name': company_name,
        'company_address': company_address,
        'company_phone': company_phone,
        'company_email': company_email,
        'company_state': company_state,
    }


def render_invoice_html(invoice):
    """Render HTML string for invoice.html"""
    context = build_invoice_pdf_context(invoice)
    return render_to_string('pdf/invoice.html', context)


def generate_invoice_pdf(invoice):
    """Generate invoice PDF bytes using WeasyPrint"""
    context = build_invoice_pdf_context(invoice)
    html_string = render_to_string('pdf/invoice.html', context)

    if HTML is None:
        raise RuntimeError("WeasyPrint is not installed or unavailable on this system.")

    from weasyprint import default_url_fetcher
    def safe_url_fetcher(url, *args, **kwargs):
        if url.startswith('data:'):
            return default_url_fetcher(url, *args, **kwargs)
        return {'string': b'', 'mime_type': 'text/plain'}

    pdf = HTML(
        string=html_string,
        url_fetcher=safe_url_fetcher
    ).write_pdf()

    return pdf


def get_static_logo_and_signature():
    """Load base64-encoded logo and signature images."""
    logo_base64 = ""
    candidate_logo_paths = [
        os.path.join(settings.BASE_DIR, 'static', 'images', 'ds_aqua_logo.png'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'ds_aqua_logo.jpg'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'dummy-logo.png'),
    ]
    for lpath in candidate_logo_paths:
        if os.path.exists(lpath):
            try:
                with open(lpath, 'rb') as lf:
                    ldata = lf.read()
                    lfmt = 'png' if lpath.lower().endswith('.png') else 'jpeg'
                    logo_base64 = f"data:image/{lfmt};base64," + base64.b64encode(ldata).decode('utf-8')
                    break
            except Exception as e:
                logger.error(f"Error reading logo file {lpath}: {e}")

    signature_base64 = ""
    candidate_sig_paths = [
        r"S:\installers\Downloads\aksn sign.png",
        os.path.join(settings.BASE_DIR, 'static', 'images', 'aksn-sign.png'),
        r"S:\installers\Downloads\aksn-sign.png",
    ]
    for spath in candidate_sig_paths:
        if os.path.exists(spath):
            try:
                with open(spath, 'rb') as sf:
                    sdata = sf.read()
                    signature_base64 = "data:image/png;base64," + base64.b64encode(sdata).decode('utf-8')
                    break
            except Exception as err:
                logger.error(f"Error encoding signature from {spath}: {err}")

    return logo_base64, signature_base64


def build_advance_receipt_context(receipt):
    """Build template context for Advance Payment Receipt"""
    logo_base64, signature_base64 = get_static_logo_and_signature()

    payment_mode_raw = str(getattr(receipt, 'payment_mode', 'ONLINE') or 'ONLINE').upper()
    payment_mode_map = {
        'ONLINE': 'Online / UPI',
        'UPI': 'UPI Payment',
        'NEFT_RTGS': 'Bank Transfer / NEFT / RTGS',
        'CHEQUE': 'Cheque / DD',
        'CASH': 'Cash',
        'CARD': 'Credit / Debit Card',
    }
    payment_mode_display = payment_mode_map.get(payment_mode_raw, payment_mode_raw)

    company_name = getattr(receipt, 'company_name', None) or 'D S AQUA'
    company_address = getattr(receipt, 'company_address', None) or 'HEAD OFFICE: Nr Kalyani School, Belhekar Wasti, Manjari, Hadapsar, Pune Maharashtra'
    company_phone = getattr(receipt, 'company_phone', None) or '8830373068'
    company_email = getattr(receipt, 'company_email', None) or 'dswastewatersolution@gmail.com'
    company_state = getattr(receipt, 'company_state', None) or '27-Maharashtra'

    # Banking Info Resolution
    billing_obj = getattr(receipt, 'billing_detail', None)
    if not billing_obj:
        try:
            from quotation.models import BillingDetail
            billing_obj = BillingDetail.objects.filter(is_default=True).first() or BillingDetail.objects.first()
        except Exception:
            billing_obj = None

    if billing_obj:
        b_name = (getattr(billing_obj, 'bank_name', '') or '').strip()
        b_branch = (getattr(billing_obj, 'branch_name', '') or '').strip()
        bank_name = f"{b_name}, {b_branch}".strip(', ') if b_branch and b_branch.lower() not in b_name.lower() else (b_name or 'Federal Bank, Pune - Phursungi')
        bank_account_no = (getattr(billing_obj, 'account_number', '') or '').strip() or '99980102625931'
        bank_ifsc = (getattr(billing_obj, 'ifsc_code', '') or '').strip() or 'FDRL0001785'
        account_holder = (getattr(billing_obj, 'account_holder_name', '') or getattr(billing_obj, 'company_name', '') or '').strip() or 'DATTA MARUTI RANDIVE'
    else:
        bank_name = getattr(receipt, 'bank_name', None) or 'Federal Bank, Pune - Phursungi'
        bank_account_no = getattr(receipt, 'bank_account_no', None) or '99980102625931'
        bank_ifsc = getattr(receipt, 'bank_ifsc', None) or 'FDRL0001785'
        account_holder = getattr(receipt, 'account_holder_name', None) or 'DATTA MARUTI RANDIVE'

    project_code = getattr(receipt.project, 'project_code', None) if receipt.project else None
    amc_contract_number = (getattr(receipt.amc_contract, 'contract_id', None) or getattr(receipt.amc_contract, 'contract_number', None)) if receipt.amc_contract else None
    service_number = (getattr(receipt.service, 'service_id', None) or getattr(receipt.service, 'service_number', None)) if receipt.service else None

    return {
        'receipt': receipt,
        'payment_mode_display': payment_mode_display,
        'company_name': company_name,
        'company_address': company_address,
        'company_phone': company_phone,
        'company_email': company_email,
        'company_state': company_state,
        'bank_name': bank_name,
        'bank_account_no': bank_account_no,
        'bank_ifsc': bank_ifsc,
        'account_holder': account_holder,
        'project_code': project_code,
        'amc_contract_number': amc_contract_number,
        'service_number': service_number,
        'logo_base64': logo_base64,
        'signature_base64': signature_base64,
    }


def render_advance_receipt_html(receipt):
    """Render HTML string for advance_receipt.html"""
    context = build_advance_receipt_context(receipt)
    return render_to_string('pdf/advance_receipt.html', context)


def generate_advance_receipt_pdf(receipt):
    """Generate advance receipt PDF bytes using WeasyPrint"""
    context = build_advance_receipt_context(receipt)
    html_string = render_to_string('pdf/advance_receipt.html', context)

    if HTML is None:
        raise RuntimeError("WeasyPrint is not installed or unavailable on this system.")

    from weasyprint import default_url_fetcher
    def safe_url_fetcher(url, *args, **kwargs):
        if url.startswith('data:'):
            return default_url_fetcher(url, *args, **kwargs)
        return {'string': b'', 'mime_type': 'text/plain'}

    pdf = HTML(
        string=html_string,
        url_fetcher=safe_url_fetcher
    ).write_pdf()

    return pdf
