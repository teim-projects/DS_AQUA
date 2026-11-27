import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { State, City } from "country-state-city";
import { RxCross2 } from "react-icons/rx";
import {
  MdReceipt,
  MdCheckCircle,
  MdLink,
  MdRefresh,
} from "react-icons/md";
import { getBaseApiUrl } from "../../utils/apiConfig";
import QuotationTermsSelector from "../terms_conditions/QuotationTermsSelector";

// Live Indian Currency Number to Words Converter
function numberToIndianWords(amount) {
  const num = Math.round(parseFloat(amount) || 0);
  if (num <= 0) return "Zero Rupees only";

  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n) {
    let str = "";
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : " ");
    } else {
      str += a[n];
    }
    return str;
  }

  let words = "";
  const crore = Math.floor(num / 10000000);
  let rem = num % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  const hundred = Math.floor(rem / 100);
  rem = rem % 100;

  if (crore > 0) words += inWords(crore) + "Crore ";
  if (lakh > 0) words += inWords(lakh) + "Lakh ";
  if (thousand > 0) words += inWords(thousand) + "Thousand ";
  if (hundred > 0) words += inWords(hundred) + "Hundred ";
  if (rem > 0) words += (words !== "" ? "and " : "") + inWords(rem);

  return words.trim() + " Rupees only";
}

export default function AddBillOfSupplyModal({
  isOpen,
  onClose,
  onSuccess,
  billId = null,
  initialData = null,
}) {
  const isEdit = Boolean(billId);
  const baseApi = getBaseApiUrl();

  // Loading States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingNumber, setFetchingNumber] = useState(false);

  // Master Data Lists
  const [amcList, setAmcList] = useState([]);
  const [invoicesList, setInvoicesList] = useState([]);
  const [billingDetailsList, setBillingDetailsList] = useState([]);

  // Linked Invoice Selection (Dropdown)
  const [linkedInvoiceId, setLinkedInvoiceId] = useState("");

  // Selected AMC Contract
  const [selectedAmcId, setSelectedAmcId] = useState("");
  const [selectedAmc, setSelectedAmc] = useState(null);
  const [availableCycles, setAvailableCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [isRenewal, setIsRenewal] = useState(false);
  const [cycleNumber, setCycleNumber] = useState(1);
  const [noOfVisits, setNoOfVisits] = useState(4);
  const [amcContractNumber, setAmcContractNumber] = useState("");
  const [amcProduct, setAmcProduct] = useState("");

  // States list from country-state-city
  const states = useMemo(() => State.getStatesOfCountry("IN"), []);

  // Bill Header Details
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [billTime, setBillTime] = useState("11:00 AM");
  const [status, setStatus] = useState("PAID");
  const [poNumber, setPoNumber] = useState("");

  // Fixed Company Details (Default for Bill of Supply)
  const [companyName, setCompanyName] = useState("D S AQUA");
  const [companyAddress, setCompanyAddress] = useState(
    "Manufacturing Plant: S No 156/5A, Belhekar Wasti, Manjari Bk, Hadapsar, Pune City, Maharashtra, India – 412307.\nCorporate Office: Office No. 216, 2nd Floor, Deccan Heights, Opp. KFC, Near PMT Bus Stop, Deccan, Above Joshi Wadewale, Pune – 411004."
  );
  const [companyPhone, setCompanyPhone] = useState("+91 866-8274-241, +91 883-0373-068");
  const [companyEmail, setCompanyEmail] = useState("dswatertech1@gmail.com");
  const [companyState, setCompanyState] = useState("27-Maharashtra");

  // 1. Bill To Party (Exact structure matching AddInvoiceModal)
  const [billToCompanyName, setBillToCompanyName] = useState("");
  const [billToContactPerson, setBillToContactPerson] = useState("");
  const [billToContact, setBillToContact] = useState("");
  const [billToEmail, setBillToEmail] = useState("");
  const [billToState, setBillToState] = useState("Maharashtra");
  const [billToCity, setBillToCity] = useState("Pune");
  const [billToAddress, setBillToAddress] = useState("");
  const [billToGstin, setBillToGstin] = useState("");
  const [billToPan, setBillToPan] = useState("");

  // 2. Ship To Party (Exact structure matching AddInvoiceModal)
  const [shipToSameAsBillTo, setShipToSameAsBillTo] = useState(true);
  const [shipToCompanyName, setShipToCompanyName] = useState("");
  const [shipToContactPerson, setShipToContactPerson] = useState("");
  const [shipToContact, setShipToContact] = useState("");
  const [shipToEmail, setShipToEmail] = useState("");
  const [shipToState, setShipToState] = useState("Maharashtra");
  const [shipToCity, setShipToCity] = useState("Pune");
  const [shipToAddress, setShipToAddress] = useState("");
  const [shipToGstin, setShipToGstin] = useState("");

  // Cities filtered by selected states
  const billToCities = useMemo(() => {
    if (!billToState) return [];
    const matched = states.find(
      (s) =>
        s.name.toLowerCase() === billToState.toLowerCase() ||
        s.isoCode.toLowerCase() === billToState.toLowerCase() ||
        billToState.toLowerCase().includes(s.name.toLowerCase())
    );
    return matched ? City.getCitiesOfState("IN", matched.isoCode) : [];
  }, [billToState, states]);

  const shipToCities = useMemo(() => {
    if (!shipToState) return [];
    const matched = states.find(
      (s) =>
        s.name.toLowerCase() === shipToState.toLowerCase() ||
        s.isoCode.toLowerCase() === shipToState.toLowerCase() ||
        shipToState.toLowerCase().includes(s.name.toLowerCase())
    );
    return matched ? City.getCitiesOfState("IN", matched.isoCode) : [];
  }, [shipToState, states]);

  // AMC Service & Line Items (Bill of Supply has NO GST)
  const [itemName, setItemName] = useState("Water purifier AMC");
  const [hsnSac, setHsnSac] = useState("8421");
  const [quantity, setQuantity] = useState(1);
  const [pricePerUnit, setPricePerUnit] = useState(4800);
  const [discountAmount, setDiscountAmount] = useState(300);

  // Description / Terms
  const [description, setDescription] = useState(
    "one years warranty excluding electric parts"
  );
  const [termsConditions, setTermsConditions] = useState(
    "Thank you for doing business with us."
  );
  const [selectedTerms, setSelectedTerms] = useState([]);

  // Bank Info (from Billing Details Master)
  const [selectedBillingDetailId, setSelectedBillingDetailId] = useState("");
  const [bankName, setBankName] = useState("Federal Bank, Pune - Phursungi");
  const [bankAccountNo, setBankAccountNo] = useState("99980102625931");
  const [bankIfscCode, setBankIfscCode] = useState("FDRL0001785");
  const [bankAccountHolder, setBankAccountHolder] = useState("DATTA MARUTI RANDIVE");

  // Financials
  const [receivedAmount, setReceivedAmount] = useState(4500);
  const [paymentMode, setPaymentMode] = useState("Federal Bank(amc)");

  // Auth header helper
  const getHeaders = useCallback(() => {
    const token =
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "";
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  // Fetch next sequential number
  const fetchNextNumber = useCallback(async () => {
    setFetchingNumber(true);
    try {
      const res = await axios.get(`${baseApi}/invoice/bill-of-supply/next-number/`, {
        headers: getHeaders(),
      }).catch(() => {
        return axios.get(`${baseApi}/invoice/invoices/next-number/`, { headers: getHeaders() });
      });
      const nextVal = res.data?.next_number;
      if (nextVal) {
        setBillNumber(String(nextVal).padStart(6, "0"));
      }
    } catch {
      setBillNumber((prev) => prev || "001168");
    } finally {
      setFetchingNumber(false);
    }
  }, [baseApi, getHeaders]);

  // Calculations (Bill of Supply has 0% GST)
  const qtyVal = parseFloat(quantity) || 1;
  const rateVal = parseFloat(pricePerUnit) || 0;
  const subTotalAmount = qtyVal * rateVal;
  const discVal = Math.min(parseFloat(discountAmount) || 0, subTotalAmount);
  const discountPercent =
    subTotalAmount > 0 ? ((discVal / subTotalAmount) * 100).toFixed(2) : "0.00";
  const grandTotalAmount = Math.max(0, subTotalAmount - discVal);
  const recVal = parseFloat(receivedAmount) || 0;
  const balanceAmount = Math.max(0, grandTotalAmount - recVal);

  // Initial Load: Invoices, AMCs, Billing Banks, and Next Number
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);

    const headers = getHeaders();

    if (!isEdit) {
      fetchNextNumber();
    }

    // Fetch Created Invoices for dropdown
    axios
      .get(`${baseApi}/invoice/invoices/?limit=500`, { headers })
      .then((res) => {
        if (!isMounted) return;
        const raw = Array.isArray(res.data) ? res.data : res.data?.results || [];
        const list = raw.filter((b) => b.invoice_type !== "BILL_OF_SUPPLY");
        setInvoicesList(list);
      })
      .catch((e) => console.warn("Failed to fetch invoices list:", e));

    // Fetch Billing Banks
    axios
      .get(`${baseApi}/quotation/billing-details/`, { headers })
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setBillingDetailsList(list);

        if (list.length > 0 && !selectedBillingDetailId && !isEdit) {
          const def = list.find((b) => b.is_default) || list[0];
          setSelectedBillingDetailId(def.id);
          const bName = def.branch_name ? `${def.bank_name}, ${def.branch_name}` : def.bank_name;
          setBankName(bName || "Federal Bank, Pune - Phursungi");
          setBankAccountNo(def.account_number || "99980102625931");
          setBankIfscCode(def.ifsc_code || "FDRL0001785");
          setBankAccountHolder(def.account_holder_name || "DATTA MARUTI RANDIVE");
          setPaymentMode(`${def.bank_name || "Federal Bank"}(amc)`);
        }
      })
      .catch((e) => console.warn("Failed to fetch billing details:", e));

    // Fetch AMC Contracts
    const fetchAmcContracts = async () => {
      try {
        let res = null;
        try {
          res = await axios.get(`${baseApi}/lead/amc/contracts/?limit=500`, { headers });
        } catch {
          res = await axios.get(`${baseApi}/amc/contracts/?limit=500`, { headers });
        }
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : res?.data?.results || [];
        setAmcList(list);
      } catch (err) {
        console.warn("Failed to fetch AMC contracts:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAmcContracts();

    if (isEdit && initialData) {
      populateFromData(initialData);
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, isEdit, billId, fetchNextNumber, getHeaders]);

  // Populate data when editing
  const populateFromData = (data) => {
    setBillNumber(data.invoice_number || "");
    setBillDate(data.invoice_date || new Date().toISOString().split("T")[0]);
    setBillTime(data.invoice_time || "11:00 AM");
    setStatus(data.status || "PAID");
    setCompanyName(data.company_name || "D S AQUA");
    setCompanyAddress(
      data.company_address ||
        "Manufacturing Plant: S No 156/5A, Belhekar Wasti, Manjari Bk, Hadapsar, Pune City, Maharashtra, India – 412307.\nCorporate Office: Office No. 216, 2nd Floor, Deccan Heights, Opp. KFC, Near PMT Bus Stop, Deccan, Above Joshi Wadewale, Pune – 411004."
    );
    setCompanyPhone(data.company_phone || "+91 866-8274-241, +91 883-0373-068");
    setCompanyEmail(data.company_email || "dswatertech1@gmail.com");
    setCompanyState(data.company_state || "27-Maharashtra");

    setBillToCompanyName(data.bill_to_name || "");
    setBillToAddress(data.bill_to_address || "");
    setBillToContact(data.bill_to_contact || "");
    setBillToGstin(data.bill_to_gstin || "");
    setBillToState(data.bill_to_state || "Maharashtra");

    if (data.ship_to_address && data.ship_to_address !== data.bill_to_address) {
      setShipToSameAsBillTo(false);
      setShipToCompanyName(data.ship_to_name || data.bill_to_name || "");
      setShipToAddress(data.ship_to_address || "");
      setShipToContact(data.ship_to_contact || data.bill_to_contact || "");
      setShipToGstin(data.ship_to_gstin || "");
      setShipToState(data.ship_to_state || data.bill_to_state || "Maharashtra");
    } else {
      setShipToSameAsBillTo(true);
    }

    setBankName(data.bank_name || "");
    setBankAccountNo(data.bank_account_no || "");
    setBankIfscCode(data.bank_ifsc || "");
    setBankAccountHolder(data.account_holder_name || "");
    setSelectedBillingDetailId(data.billing_detail || "");
    setPaymentMode(data.payment_mode || "Federal Bank(amc)");
    setDescription(data.notes || "one years warranty excluding electric parts");
    if (data.terms_conditions) setTermsConditions(data.terms_conditions);
    setSelectedTerms(Array.isArray(data.terms_and_conditions) ? data.terms_and_conditions : []);

    setPoNumber(data.po_number || "");

    if (data.amc_contract) {
      setSelectedAmcId(String(data.amc_contract));
    }
    setIsRenewal(Boolean(data.amc_is_renewal));
    setCycleNumber(parseInt(data.amc_cycle_number || 1));
    setNoOfVisits(parseInt(data.amc_no_of_visits || 4));
    setAmcContractNumber(data.amc_contract_number || "");
    setAmcProduct(data.amc_contract_product || "");

    if (data.items && data.items.length > 0) {
      const it = data.items[0];
      setItemName(it.item_name || "Water purifier AMC");
      setHsnSac(it.hsn_sac || "8421");
      setQuantity(parseFloat(it.quantity) || 1);
      setPricePerUnit(parseFloat(it.price_per_unit) || 4800);
      setDiscountAmount(parseFloat(it.discount_amount) || 0);
    }

    setReceivedAmount(parseFloat(data.received_amount) || 0);
  };

  // Match linked invoice if po_number matches when invoicesList is loaded
  useEffect(() => {
    if (invoicesList.length > 0 && poNumber && !linkedInvoiceId) {
      const match = invoicesList.find(
        (inv) =>
          inv.invoice_number === poNumber ||
          String(inv.id) === String(poNumber) ||
          inv.invoice_number === poNumber.replace(/^#/, "")
      );
      if (match) {
        setLinkedInvoiceId(String(match.id));
      }
    }
  }, [invoicesList, poNumber, linkedInvoiceId]);

  // Handler: When an existing Invoice is selected from dropdown
  const handleLinkedInvoiceSelect = (invId) => {
    setLinkedInvoiceId(invId);
    if (!invId) {
      if (selectedAmc) {
        setPoNumber(selectedAmc.contract_id || "");
      } else {
        setPoNumber("");
      }
      return;
    }

    const inv = invoicesList.find((i) => String(i.id) === String(invId));
    if (!inv) return;

    setPoNumber(inv.invoice_number);

    // Auto-fill customer details if not already entered
    if (!billToCompanyName || billToCompanyName === "D S AQUA") {
      setBillToCompanyName(inv.bill_to_name || "");
      setBillToAddress(inv.bill_to_address || "");
      setBillToContact(inv.bill_to_contact || "");
      setBillToGstin(inv.bill_to_gstin || "");
      setBillToState(inv.bill_to_state || "Maharashtra");
    }

    // Auto-select AMC if invoice is tied to one
    if (inv.amc_contract && !selectedAmcId) {
      handleAmcSelect(String(inv.amc_contract));
    }
  };

  // Handler: When AMC Contract is selected from dropdown
  const handleAmcSelect = (amcId) => {
    setSelectedAmcId(amcId);
    setSelectedCycleId("");
    setSelectedCycle(null);
    if (!amcId) {
      setSelectedAmc(null);
      setAvailableCycles([]);
      setAmcContractNumber("");
      setAmcProduct("");
      setIsRenewal(false);
      setCycleNumber(1);
      setNoOfVisits(4);
      return;
    }

    const amc = amcList.find((a) => String(a.id) === String(amcId));
    if (!amc) return;

    setSelectedAmc(amc);
    const prodName = amc.product || "Water Purifier";
    setAmcContractNumber(amc.contract_id || `AMC-${amc.id}`);
    setAmcProduct(prodName);

    // Extract and sort cycles
    const rawCycles = Array.isArray(amc.cycles) ? amc.cycles : [];
    const cycles = [...rawCycles].sort((a, b) => (a.cycle_number || 0) - (b.cycle_number || 0));
    setAvailableCycles(cycles);

    let targetCycle = null;
    if (cycles.length > 0) {
      targetCycle = cycles.find((c) => c.status === "active") || cycles[cycles.length - 1];
      setSelectedCycleId(String(targetCycle.id));
      setSelectedCycle(targetCycle);
    }

    const amcRenewal = targetCycle
      ? targetCycle.cycle_number > 1
      : Boolean(amc.is_renewal || (amc.current_cycle && amc.current_cycle > 1));
    const cNum = targetCycle ? targetCycle.cycle_number : parseInt(amc.current_cycle || 1);
    const visits = targetCycle ? (targetCycle.no_of_visits || 4) : parseInt(amc.no_of_visits || 4);
    const cycleVal = targetCycle ? parseFloat(targetCycle.annual_value || 0) : (parseFloat(amc.annual_value || amc.contract_amount || 4800));

    setIsRenewal(amcRenewal);
    setCycleNumber(cNum);
    setNoOfVisits(visits);

    // Customer details resolution
    const cust = amc.customer_details || amc.customer || {};
    const cName = cust.name || cust.company_name || amc.customer_name || "";
    const cPerson = cust.contact_person || amc.contact_person || "";
    const cAddress = cust.billing_address || cust.address || amc.site_address || "";
    const cPhone = cust.phone || cust.contact_number || amc.contact_number || "";
    const cEmail = cust.email || cust.email_address || "";
    const cState = cust.state || "Maharashtra";
    const cCity = cust.city || "Pune";
    const cGst = cust.gst_number || cust.gstin || "";
    const cPan = cust.pan_number || "";

    setBillToCompanyName(cName);
    setBillToContactPerson(cPerson);
    setBillToContact(cPhone);
    setBillToEmail(cEmail);
    setBillToState(cState);
    setBillToCity(cCity);
    setBillToAddress(cAddress);
    setBillToGstin(cGst);
    setBillToPan(cPan);

    // Pricing & Item name
    if (cycleVal > 0) {
      setPricePerUnit(cycleVal);
    }
    setItemName(`${prodName} AMC`);

    // PO Number defaults to contract ID if not linked to an invoice
    if (!linkedInvoiceId) {
      const cId = amc.contract_id || `AMC-${amc.id}`;
      setPoNumber(amcRenewal ? `${cId} (Cycle #${cNum})` : cId);
    }

    // Site address for Ship To if different
    if (amc.site_address && amc.site_address !== cAddress) {
      setShipToSameAsBillTo(false);
      setShipToCompanyName(cName);
      setShipToAddress(amc.site_address);
      setShipToState(cState);
      setShipToCity(cCity);
      setShipToContact(cPhone);
    }

    // Clean description text
    const freq = targetCycle?.service_frequency || amc.service_frequency || "Quarterly";
    const dates = targetCycle && targetCycle.start_date && targetCycle.end_date ? `\n- Validity Period: ${targetCycle.start_date} to ${targetCycle.end_date}` : "";
    const descText = `${prodName} AMC - ${visits} Service Visits / year (${freq}). One years warranty excluding electric parts.\n- Service Visits: ${visits} Scheduled Visits (${freq})\n- Contract Type: ${amcRenewal ? `AMC Renewal (Cycle #${cNum})` : "Initial Term"}${dates}`;
    setDescription(descText);
  };

  // Handler: When a specific Contract / Renewal Cycle is selected
  const handleCycleSelect = (cycleId) => {
    setSelectedCycleId(cycleId);
    if (!cycleId) {
      setSelectedCycle(null);
      return;
    }

    const cyc = availableCycles.find((c) => String(c.id) === String(cycleId));
    if (!cyc) return;

    setSelectedCycle(cyc);
    const isRen = cyc.cycle_number > 1;
    const cNum = cyc.cycle_number;
    const visits = cyc.no_of_visits || 4;
    const val = parseFloat(cyc.annual_value || 0);

    setIsRenewal(isRen);
    setCycleNumber(cNum);
    setNoOfVisits(visits);
    if (val > 0) {
      setPricePerUnit(val);
    }

    const prodName = amcProduct || "Water Purifier";
    const freq = cyc.service_frequency || "Quarterly";
    const dates = cyc.start_date && cyc.end_date ? `\n- Validity Period: ${cyc.start_date} to ${cyc.end_date}` : "";
    setDescription(
      `${prodName} AMC - ${visits} Service Visits / year (${freq}). One years warranty excluding electric parts.\n- Service Visits: ${visits} Scheduled Visits (${freq})\n- Contract Type: ${isRen ? `AMC Renewal (Cycle #${cNum})` : "Initial Term"}${dates}`
    );

    if (!linkedInvoiceId && selectedAmc) {
      const cId = selectedAmc.contract_id || `AMC-${selectedAmc.id}`;
      setPoNumber(isRen ? `${cId} (Cycle #${cNum})` : cId);
    }
  };

  // Handler: Bank Selection
  const handleBankChange = (bId) => {
    setSelectedBillingDetailId(bId);
    if (!bId) return;
    const b = billingDetailsList.find((item) => String(item.id) === String(bId));
    if (b) {
      const fullBankName = b.branch_name ? `${b.bank_name}, ${b.branch_name}` : b.bank_name;
      setBankName(fullBankName);
      setBankAccountNo(b.account_number || "");
      setBankIfscCode(b.ifsc_code || "");
      setBankAccountHolder(b.account_holder_name || "DATTA MARUTI RANDIVE");
      setPaymentMode(`${b.bank_name || "Federal Bank"}(amc)`);
    }
  };

  // Handler: Status Change auto-adjusts received amount
  const handleStatusChange = (st) => {
    setStatus(st);
    if (st === "PAID") {
      setReceivedAmount(grandTotalAmount);
    } else if (st === "UNPAID") {
      setReceivedAmount(0);
    }
  };

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!billNumber.trim()) {
      Swal.fire("Validation Error", "Bill Number is required.", "warning");
      return;
    }
    if (!billToCompanyName.trim()) {
      Swal.fire("Validation Error", "Customer / Bill To Company Name is required.", "warning");
      return;
    }
    if (!billToAddress.trim()) {
      Swal.fire("Validation Error", "Billing Address Details are required.", "warning");
      return;
    }
    if (!itemName.trim()) {
      Swal.fire("Validation Error", "Item / AMC Description is required.", "warning");
      return;
    }

    setSubmitting(true);

    // Resolve Customer ID as a clean integer (never a dict)
    let customerId = null;
    if (selectedAmc) {
      if (selectedAmc.customer && typeof selectedAmc.customer === "object" && selectedAmc.customer.id) {
        customerId = parseInt(selectedAmc.customer.id);
      } else if (selectedAmc.customer && !isNaN(parseInt(selectedAmc.customer))) {
        customerId = parseInt(selectedAmc.customer);
      } else if (selectedAmc.customer_details?.id) {
        customerId = parseInt(selectedAmc.customer_details.id);
      }
    }

    // Construct full addresses
    const fullBillToAddress = [billToAddress, billToCity, billToState]
      .filter(Boolean)
      .join(", ");

    const fullShipToAddress = shipToSameAsBillTo
      ? fullBillToAddress
      : [shipToAddress, shipToCity, shipToState].filter(Boolean).join(", ");

    const itemsPayload = [
      {
        item_name: itemName.trim(),
        hsn_sac: hsnSac || "8421",
        quantity: qtyVal,
        unit: "Nos",
        price_per_unit: rateVal,
        discount_percent: parseFloat(discountPercent) || 0,
        discount_amount: discVal,
        taxable_amount: grandTotalAmount,
        gst_rate: 0,
        gst_amount: 0,
        cgst_rate: 0,
        cgst_amount: 0,
        sgst_rate: 0,
        sgst_amount: 0,
        igst_rate: 0,
        igst_amount: 0,
        total_amount: grandTotalAmount,
      },
    ];

    const payload = {
      // Independent Bill of Supply fields
      bill_number: billNumber.trim(),
      bill_date: billDate,
      bill_time: billTime || "11:00 AM",
      linked_invoice: linkedInvoiceId ? parseInt(linkedInvoiceId) : null,

      // Compatibility fields
      invoice_number: billNumber.trim(),
      invoice_date: billDate,
      invoice_time: billTime || "11:00 AM",
      invoice_type: "BILL_OF_SUPPLY",

      status: status,
      amc_contract: selectedAmcId ? parseInt(selectedAmcId) : null,
      customer: customerId,
      billing_detail: selectedBillingDetailId ? parseInt(selectedBillingDetailId) : null,

      company_name: companyName,
      company_address: companyAddress,
      company_phone: companyPhone,
      company_email: companyEmail,
      company_gstin: "27AALCD8065C1ZJ",
      company_state: companyState,

      bill_to_name: billToCompanyName.trim(),
      bill_to_contact_person: billToContactPerson.trim(),
      bill_to_address: fullBillToAddress,
      bill_to_contact: billToContact.trim(),
      bill_to_email: billToEmail.trim(),
      bill_to_gstin: billToGstin.trim(),
      bill_to_pan: billToPan.trim(),
      bill_to_state: billToState,
      bill_to_city: billToCity,

      ship_to_same_as_bill_to: shipToSameAsBillTo,
      ship_to_name: shipToSameAsBillTo
        ? billToCompanyName.trim()
        : (shipToCompanyName || billToCompanyName).trim(),
      ship_to_contact_person: shipToSameAsBillTo
        ? billToContactPerson.trim()
        : (shipToContactPerson || "").trim(),
      ship_to_address: fullShipToAddress,
      ship_to_contact: shipToSameAsBillTo
        ? billToContact.trim()
        : (shipToContact || billToContact).trim(),
      ship_to_email: shipToSameAsBillTo
        ? billToEmail.trim()
        : (shipToEmail || "").trim(),
      ship_to_gstin: shipToSameAsBillTo
        ? billToGstin.trim()
        : (shipToGstin || billToGstin).trim(),
      ship_to_state: shipToSameAsBillTo ? billToState : (shipToState || billToState),
      ship_to_city: shipToSameAsBillTo ? billToCity : (shipToCity || billToCity),

      place_of_supply: billToState
        ? billToState.toLowerCase().includes("maharashtra")
          ? "27-Maharashtra"
          : billToState
        : "27-Maharashtra",
      po_number: poNumber.trim(),
      po_date: billDate || null,

      bank_name: bankName,
      bank_account_no: bankAccountNo,
      bank_ifsc: bankIfscCode,
      account_holder_name: bankAccountHolder,

      sub_total: subTotalAmount,
      discount_total: discVal,
      taxable_amount: grandTotalAmount,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      round_off: 0,
      grand_total: grandTotalAmount,
      received_amount: recVal,
      balance_amount: balanceAmount,
      you_saved: discVal,
      payment_mode: paymentMode,
      previous_balance: 0,
      current_balance: 0,
      amount_in_words: numberToIndianWords(grandTotalAmount),

      // AMC Specifics
      amc_is_renewal: isRenewal,
      amc_cycle_number: cycleNumber,
      amc_no_of_visits: noOfVisits,
      amc_contract_number: amcContractNumber,
      amc_contract_product: amcProduct,

      terms_conditions:
        selectedTerms.length > 0
          ? selectedTerms.map((t) => `${t.name}: ${t.description}`).join("\n")
          : isEdit
          ? termsConditions
          : "",
      terms_and_conditions: selectedTerms,
      notes: description,
      items: itemsPayload,
    };

    try {
      const headers = getHeaders();
      const endpoint = isEdit ? `invoice/bill-of-supply/${billId}/` : "invoice/bill-of-supply/";
      const method = isEdit ? "put" : "post";

      await axios[method](`${baseApi}/${endpoint}`, payload, { headers });

      Swal.fire({
        icon: "success",
        title: isEdit ? "Bill Updated" : "Bill Created",
        text: `Bill of Supply #${billNumber} ${isEdit ? "updated" : "generated"} successfully.`,
        timer: 1800,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error saving Bill of Supply:", err);
      let errMsg = "Failed to save Bill of Supply.";
      if (err.response?.data) {
        if (typeof err.response.data === "string") {
          const match =
            err.response.data.match(/<pre class="exception_value">(.*?)<\/pre>/s) ||
            err.response.data.match(/<title>(.*?)<\/title>/i) ||
            err.response.data.match(/<h1>(.*?)<\/h1>/i);
          errMsg = match ? match[1].replace(/<[^>]+>/g, "").trim() : "Server Error (500)";
        } else if (typeof err.response.data === "object") {
          errMsg = Object.entries(err.response.data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("\n");
        }
      } else if (err.message) {
        errMsg = err.message;
      }
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: errMsg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-3xl w-full mx-auto my-6 relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header Bar matching AddLeadForm & AddInvoiceModal */}
        <div className="bg-white px-6 pt-5 pb-3 flex justify-between items-start border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {isEdit ? `Edit Bill of Supply #${billNumber}` : "Add Bill of Supply"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate official non-GST Bill of Supply for AMC contracts, renewals &amp; services
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
            title="Close"
          >
            <RxCross2 size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin space-y-5 text-slate-800">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* 1. LINKED INVOICE & AMC CONTRACT SELECTION */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/70 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <MdLink className="text-sky-600 text-base" />
                <span>Invoice Linking &amp; AMC Contract</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* INVOICE LINKING DROPDOWN */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Link to Created Invoice (Dropdown)
                  </label>
                  <select
                    value={linkedInvoiceId}
                    onChange={(e) => handleLinkedInvoiceSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="">-- No Linked Invoice (Direct Bill) --</option>
                    {invoicesList.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        #{inv.invoice_number} • {inv.bill_to_name} (₹
                        {parseFloat(inv.grand_total || 0).toLocaleString("en-IN")}) •{" "}
                        {inv.invoice_date}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-400 block">
                    Choose from existing created invoices to link reference &amp; customer details
                  </span>
                </div>

                {/* AMC CONTRACT SELECTOR */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Select AMC Contract
                  </label>
                  <select
                    value={selectedAmcId}
                    onChange={(e) => handleAmcSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="">-- Select AMC Contract ({amcList.length} available) --</option>
                    {amcList.map((amc) => {
                      const cName = amc.customer_name || amc.customer?.name || "Customer";
                      const prod = amc.product || "Water Purifier";
                      const vCount = amc.no_of_visits || 4;
                      const cycCount = Array.isArray(amc.cycles) ? amc.cycles.length : 0;
                      const hasRen = cycCount > 1 || (amc.cycles && amc.cycles.some((c) => c.cycle_number > 1));
                      return (
                        <option key={amc.id} value={amc.id}>
                          {amc.contract_id || `AMC-${amc.id}`} • {cName} • {prod} ({vCount} Visits){" "}
                          {hasRen ? `[🔄 Renewals: ${cycCount} Terms]` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <span className="text-[11px] text-slate-400 block">
                    Auto-populates customer billing/shipping details &amp; AMC pricing
                  </span>
                </div>

                {/* RENEWAL CYCLE SELECTOR - Appears when selected AMC has renewals */}
                {selectedAmc && (availableCycles.length > 1 || availableCycles.some((c) => c.cycle_number > 1)) && (
                  <div className="space-y-1 col-span-1 md:col-span-2 bg-sky-50/70 border border-sky-200/90 rounded-lg p-3 animate-fade-in">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sky-900">
                        <MdRefresh className="text-sky-600 text-sm" />
                        Select Contract / Renewal Cycle:
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                        🔄 AMC Renewals Available ({availableCycles.length} terms)
                      </span>
                    </label>
                    <select
                      value={selectedCycleId}
                      onChange={(e) => handleCycleSelect(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium border border-sky-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white shadow-2xs"
                    >
                      {availableCycles.map((cyc) => {
                        const isRen = cyc.cycle_number > 1;
                        const termLabel = isRen ? `Cycle #${cyc.cycle_number} - AMC Renewal` : `Cycle #1 - Initial Term`;
                        const dates = cyc.start_date && cyc.end_date ? `(${cyc.start_date} to ${cyc.end_date})` : "";
                        const val = parseFloat(cyc.annual_value || 0).toLocaleString();
                        const st = cyc.status ? `[${cyc.status.toUpperCase()}]` : "";
                        return (
                          <option key={cyc.id} value={cyc.id}>
                            {termLabel} {dates} • ₹{val} {st}
                          </option>
                        );
                      })}
                    </select>

                    {selectedCycle && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold ${
                            selectedCycle.cycle_number > 1
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          }`}
                        >
                          {selectedCycle.cycle_number > 1
                            ? `🔄 Renewal Cycle #${selectedCycle.cycle_number}`
                            : "✔ Initial Contract Term"}
                        </span>
                        <span>
                          Term: <strong>{selectedCycle.start_date || "N/A"}</strong> to{" "}
                          <strong>{selectedCycle.end_date || "N/A"}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Scheduled Visits: <strong>{selectedCycle.no_of_visits || 4} Visits/year</strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* AMC Contract Renewal & Visits Status Pill Banner */}
                {selectedAmc && (
                  <div className="col-span-1 sm:col-span-2 pt-2.5 mt-1 border-t border-slate-200/80 flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold ${
                        isRenewal
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      }`}
                    >
                      {isRenewal ? `🔄 AMC RENEWAL (Cycle #${cycleNumber})` : `✔ NEW AMC CONTRACT (Cycle #${cycleNumber})`}
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                      {noOfVisits} Scheduled Visits ({selectedAmc.service_frequency || "quarterly"})
                    </span>

                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer sm:ml-auto">
                      <input
                        type="checkbox"
                        checked={isRenewal}
                        onChange={(e) => setIsRenewal(e.target.checked)}
                        className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                      />
                      <span>Mark as Renewal</span>
                    </label>

                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <span>Visits:</span>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={noOfVisits}
                        onChange={(e) => setNoOfVisits(parseInt(e.target.value) || 1)}
                        className="w-14 px-2 py-1 text-xs border border-slate-300 rounded text-center font-bold text-slate-800 focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. DOCUMENT META DETAILS */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1 border-b border-slate-100">
                Bill of Supply Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Bill Number */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-600">
                      Bill No. *
                    </label>
                    <button
                      type="button"
                      onClick={fetchNextNumber}
                      title="Sync next sequential number"
                      className="text-slate-400 hover:text-sky-600 text-xs flex items-center gap-0.5 cursor-pointer"
                    >
                      <MdRefresh className={fetchingNumber ? "animate-spin" : ""} />
                      <span>Next</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    placeholder="e.g. 001168"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-mono font-bold text-slate-800"
                    required
                  />
                </div>

                {/* Bill Date */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Bill Date *</label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    required
                  />
                </div>

                {/* PO / Ref Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    PO / Ref Number
                  </label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="e.g. INV-13 or AMC-101"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Payment Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="PAID">Paid (Full Received)</option>
                    <option value="PARTIALLY_PAID">Partially Paid</option>
                    <option value="UNPAID">Unpaid (Balance Pending)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. BILL TO PARTY (Exact AddInvoiceModal Layout) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  1. Bill To Party (Client / Invoicing Details)
                </span>
                {billToCompanyName && (
                  <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <MdCheckCircle className="text-xs text-emerald-600" />
                    Customer Selected
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Company Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Company / Client Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={billToCompanyName}
                    onChange={(e) => setBillToCompanyName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-medium"
                    placeholder="M/S. Sunrise Textile Processing Mills"
                    required
                  />
                </div>

                {/* Contact Person */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Contact Person</label>
                  <input
                    type="text"
                    value={billToContactPerson}
                    onChange={(e) => setBillToContactPerson(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="e.g. Mahesh Patel"
                  />
                </div>

                {/* Mobile / Contact Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Mobile / Contact Number
                  </label>
                  <input
                    type="text"
                    value={billToContact}
                    onChange={(e) => setBillToContact(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="9825011223"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    value={billToEmail}
                    onChange={(e) => setBillToEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="billing@company.com"
                  />
                </div>

                {/* State Dropdown */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">State</label>
                  <select
                    value={billToState}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBillToState(val);
                      setBillToCity("");
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                  >
                    <option value="">Select State</option>
                    {states.map((st) => (
                      <option key={st.isoCode} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City Dropdown */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">City</label>
                  {billToCities.length > 0 ? (
                    <select
                      value={billToCity}
                      onChange={(e) => setBillToCity(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                    >
                      <option value="">Select City</option>
                      {billToCities.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={billToCity}
                      onChange={(e) => setBillToCity(e.target.value)}
                      placeholder="Enter city"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                    />
                  )}
                </div>

                {/* Billing Address Textarea */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Billing Address Details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={billToAddress}
                    onChange={(e) => setBillToAddress(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="Enter complete company billing address, street, landmark, PIN..."
                    required
                  />
                </div>

                {/* GST Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">GST Number</label>
                  <input
                    type="text"
                    value={billToGstin}
                    onChange={(e) => setBillToGstin(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="27AAACS7890E1Z1"
                    maxLength={15}
                  />
                </div>

                {/* PAN Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">PAN Number</label>
                  <input
                    type="text"
                    value={billToPan}
                    onChange={(e) => setBillToPan(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    placeholder="AAACS7890E"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>

            {/* 4. SHIP TO PARTY (Exact AddInvoiceModal Layout with toggle) */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  2. Ship To Party (Installation Site / Delivery Address)
                </span>

                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={shipToSameAsBillTo}
                    onChange={(e) => setShipToSameAsBillTo(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                  />
                  <span>Same as Bill To</span>
                </label>
              </div>

              {shipToSameAsBillTo ? (
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MdCheckCircle className="text-base text-emerald-600 shrink-0" />
                    <span>Shipping and site installation address matches the Billing Party details above.</span>
                  </div>
                  <span className="font-semibold text-sky-700 text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                    Same as Bill To
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 animate-fade-in">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      Ship To Company / Site Name
                    </label>
                    <input
                      type="text"
                      value={shipToCompanyName}
                      onChange={(e) => setShipToCompanyName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                      placeholder="e.g. Warehouse / Site Location"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Contact Person</label>
                    <input
                      type="text"
                      value={shipToContactPerson}
                      onChange={(e) => setShipToContactPerson(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                      placeholder="e.g. Site Supervisor"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Contact Number</label>
                    <input
                      type="text"
                      value={shipToContact}
                      onChange={(e) => setShipToContact(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                      placeholder="Mobile number"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">State</label>
                    <select
                      value={shipToState}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShipToState(val);
                        setShipToCity("");
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                    >
                      <option value="">Select State</option>
                      {states.map((st) => (
                        <option key={st.isoCode} value={st.name}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">City</label>
                    {shipToCities.length > 0 ? (
                      <select
                        value={shipToCity}
                        onChange={(e) => setShipToCity(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                      >
                        <option value="">Select City</option>
                        {shipToCities.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={shipToCity}
                        onChange={(e) => setShipToCity(e.target.value)}
                        placeholder="Enter site city"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white h-[38px]"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-600">Shipping GSTIN</label>
                    <input
                      type="text"
                      value={shipToGstin}
                      onChange={(e) => setShipToGstin(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                      placeholder="GSTIN if distinct"
                      maxLength={15}
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      Shipping / Site Address Details
                    </label>
                    <textarea
                      rows={2}
                      value={shipToAddress}
                      onChange={(e) => setShipToAddress(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                      placeholder="Complete site delivery address..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 5. ITEM & PRICING (BILL OF SUPPLY - NON-GST) */}
            <div className="space-y-3 pt-1">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1 border-b border-slate-100">
                3. Item &amp; Pricing (Bill of Supply - Non-GST)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Item / Service Description *
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Water purifier AMC"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">HSN / SAC</label>
                  <input
                    type="text"
                    value={hsnSac}
                    onChange={(e) => setHsnSac(e.target.value)}
                    placeholder="8421"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white text-center font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Unit Price / Rate (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    placeholder="4800.00"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Discount Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="300.00"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Received Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder="4500.00"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-semibold text-emerald-700"
                  />
                </div>
              </div>

              {/* Financial Summary Strip */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Sub Total:</span>
                  <span className="font-bold text-slate-800 text-sm">₹{subTotalAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Discount ({discountPercent}%):</span>
                  <span className="font-bold text-slate-700 text-sm">- ₹{discVal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Total Billed (No GST):</span>
                  <span className="font-extrabold text-sky-700 text-base">₹{grandTotalAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Balance Due:</span>
                  <span
                    className={`font-extrabold text-base ${balanceAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}
                  >
                    ₹{balanceAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* 6. BANK (PAY TO) & NOTES */}
            <div className="space-y-3 pt-1">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1 border-b border-slate-100">
                4. Bank Details &amp; Warranty Notes
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Select Pay To Bank (Billing Details)
                  </label>
                  <select
                    value={selectedBillingDetailId}
                    onChange={(e) => handleBankChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="">-- Choose Bank Account --</option>
                    {billingDetailsList.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} {b.branch_name ? `(${b.branch_name})` : ""} - A/c:{" "}
                        {b.account_number}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 block">
                    {bankName} • A/c: {bankAccountNo} • IFSC: {bankIfscCode}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Payment Mode / Bank Label
                  </label>
                  <input
                    type="text"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    placeholder="Federal Bank(amc)"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">
                  AMC Description / Warranty Terms
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="one years warranty excluding electric parts"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                />
              </div>

              {/* 7. COMMERCIAL TERMS & CONDITIONS (Same as Quotation) */}
              <div className="pt-2">
                <QuotationTermsSelector
                  selectedTerms={selectedTerms}
                  onChange={setSelectedTerms}
                  isEdit={isEdit}
                  legacyTermsText={termsConditions}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer Bar */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Saving..." : isEdit ? "Update Bill" : "Save & Generate Bill"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
