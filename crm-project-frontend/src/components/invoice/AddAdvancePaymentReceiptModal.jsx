import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { RxCross2 } from "react-icons/rx";
import {
  MdReceipt,
  MdRefresh,
  MdBrowseGallery,
  MdCheckCircle,
  MdLocalShipping,
  MdPayment,
  MdAccountBalance,
} from "react-icons/md";
import { Briefcase, ShieldAlert, Wrench, UserCheck, DollarSign, CreditCard } from "lucide-react";
import { getBaseApiUrl } from "../../utils/apiConfig";

// Standard Indian Currency Words converter
function numberToIndianWords(num) {
  try {
    num = parseFloat(num);
  } catch {
    return "";
  }
  if (!num || isNaN(num) || num <= 0) return "Zero Rupees only";

  const units = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  function twoDigits(n) {
    if (n < 20) return units[n];
    const d = Math.floor(n / 10);
    const r = n % 10;
    return tens[d] + (r > 0 ? " " + units[r] : "");
  }

  function threeDigits(n) {
    const d = Math.floor(n / 100);
    const r = n % 100;
    let res = "";
    if (d > 0) {
      res += units[d] + " Hundred";
      if (r > 0) res += " and " + twoDigits(r);
    } else {
      res += twoDigits(r);
    }
    return res.trim();
  }

  const integerPart = Math.floor(num);
  const paisaPart = Math.round((num - integerPart) * 100);

  const parts = [];
  const crores = Math.floor(integerPart / 10000000);
  let rem = integerPart % 10000000;
  if (crores > 0) parts.push(twoDigits(crores) + " Crore");

  const lakhs = Math.floor(rem / 100000);
  rem = rem % 100000;
  if (lakhs > 0) parts.push(twoDigits(lakhs) + " Lakh");

  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;
  if (thousands > 0) parts.push(twoDigits(thousands) + " Thousand");

  if (rem > 0) parts.push(threeDigits(rem));

  const words = parts.join(" ").trim();
  let result = words ? `${words} Rupees` : "Zero Rupees";
  if (paisaPart > 0) result += ` and ${twoDigits(paisaPart)} Paise`;
  return result + " only";
}

export default function AddAdvancePaymentReceiptModal({
  isOpen,
  onClose,
  onSuccess,
  isEdit = false,
  receiptData = null,
  receiptId = null,
}) {
  const baseApi = getBaseApiUrl();

  const getHeaders = useCallback(() => {
    const token =
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "";
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  // Form State
  const [sourceType, setSourceType] = useState("PROJECT"); // 'PROJECT', 'AMC', 'SERVICE', 'DIRECT'
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("CONFIRMED");
  const [fetchingNumber, setFetchingNumber] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Linked Sources
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAmcId, setSelectedAmcId] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [availableCycles, setAvailableCycles] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [customerId, setCustomerId] = useState(null);
  const [selectedBillingDetailId, setSelectedBillingDetailId] = useState("");

  // Masters
  const [projectsList, setProjectsList] = useState([]);
  const [amcList, setAmcList] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [billingDetailsList, setBillingDetailsList] = useState([]);

  // Payer / Client Details
  const [payerName, setPayerName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [city, setCity] = useState("Pune");

  // Payment Details
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("ONLINE");
  const [transactionRef, setTransactionRef] = useState("");
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Financial Context
  const [totalOrderAmount, setTotalOrderAmount] = useState("");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [termsConditions, setTermsConditions] = useState(
    "1. Advance payment received is non-refundable upon project/contract commencement.\n2. Official tax invoice / bill will be issued upon milestone / progress delivery.\n3. Subject to Pune jurisdiction."
  );

  // Bank Info
  const [bankName, setBankName] = useState("Federal Bank, Pune - Phursungi");
  const [bankAccountNo, setBankAccountNo] = useState("99980102625931");
  const [bankIfscCode, setBankIfscCode] = useState("FDRL0001785");
  const [bankAccountHolder, setBankAccountHolder] = useState("DATTA MARUTI RANDIVE");

  // Fetch Next Receipt Number
  const fetchNextNumber = useCallback(async () => {
    if (isEdit) return;
    setFetchingNumber(true);
    try {
      const res = await axios.get(`${baseApi}/invoice/advance-receipts/next-number/`, {
        headers: getHeaders(),
      });
      if (res.data?.next_number) {
        setReceiptNumber(res.data.next_number);
      }
    } catch (err) {
      console.warn("Could not fetch next receipt number:", err);
      setReceiptNumber("APR-0001");
    } finally {
      setFetchingNumber(false);
    }
  }, [baseApi, getHeaders, isEdit]);

  // Load Masters
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const headers = getHeaders();

    fetchNextNumber();

    // Fetch Projects
    axios
      .get(`${baseApi}/lead/projects/?limit=500`, { headers })
      .catch(() => axios.get(`${baseApi}/projects/?limit=500`, { headers }))
      .then((res) => {
        if (!isMounted) return;
        setProjectsList(Array.isArray(res.data) ? res.data : res.data?.results || []);
      })
      .catch((e) => console.warn("Failed to fetch projects:", e));

    // Fetch AMC Contracts
    axios
      .get(`${baseApi}/lead/amc/contracts/?limit=500`, { headers })
      .catch(() => axios.get(`${baseApi}/amc/contracts/?limit=500`, { headers }))
      .then((res) => {
        if (!isMounted) return;
        setAmcList(Array.isArray(res.data) ? res.data : res.data?.results || []);
      })
      .catch((e) => console.warn("Failed to fetch AMC:", e));

    // Fetch Services
    axios
      .get(`${baseApi}/lead/amc/services/?limit=500`, { headers })
      .catch(() => axios.get(`${baseApi}/amc/services/?limit=500`, { headers }))
      .then((res) => {
        if (!isMounted) return;
        setServicesList(Array.isArray(res.data) ? res.data : res.data?.results || []);
      })
      .catch((e) => console.warn("Failed to fetch services:", e));

    // Fetch Customers
    axios
      .get(`${baseApi}/lead/customer/?limit=500`, { headers })
      .then((res) => {
        if (!isMounted) return;
        setCustomersList(Array.isArray(res.data) ? res.data : res.data?.results || []);
      })
      .catch((e) => console.warn("Failed to fetch customers:", e));

    // Fetch Billing Details (Bank accounts)
    axios
      .get(`${baseApi}/quotation/billing-details/`, { headers })
      .then((res) => {
        if (!isMounted) return;
        const banks = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setBillingDetailsList(banks);
        const defBank = banks.find((b) => b.is_default) || banks[0];
        if (defBank && !isEdit) {
          setSelectedBillingDetailId(defBank.id);
          applyBank(defBank);
        }
      })
      .catch((e) => console.warn("Failed to fetch billing details:", e));

    return () => {
      isMounted = false;
    };
  }, [isOpen, baseApi, getHeaders, fetchNextNumber, isEdit]);

  // Pre-fill Edit Data
  useEffect(() => {
    if (isEdit && receiptData) {
      setReceiptNumber(receiptData.receipt_number || "");
      setReceiptDate(receiptData.receipt_date || new Date().toISOString().split("T")[0]);
      setSourceType(receiptData.receipt_type || "PROJECT");
      setStatus(receiptData.status || "CONFIRMED");
      setSelectedProjectId(receiptData.project ? String(receiptData.project) : "");
      setSelectedAmcId(receiptData.amc_contract ? String(receiptData.amc_contract) : "");
      setSelectedServiceId(receiptData.service ? String(receiptData.service) : "");
      setCustomerId(receiptData.customer || null);
      setSelectedBillingDetailId(receiptData.billing_detail ? String(receiptData.billing_detail) : "");

      setPayerName(receiptData.payer_name || "");
      setContactPerson(receiptData.contact_person || "");
      setContactNumber(receiptData.contact_number || "");
      setEmail(receiptData.email || "");
      setAddress(receiptData.address || "");
      setGstin(receiptData.gstin || "");
      setPan(receiptData.pan || "");
      setState(receiptData.state || "Maharashtra");
      setCity(receiptData.city || "Pune");

      setAmount(receiptData.amount || "");
      setPaymentMode(receiptData.payment_mode || "ONLINE");
      setTransactionRef(receiptData.transaction_ref || "");
      setTransactionDate(receiptData.transaction_date || "");
      setTotalOrderAmount(receiptData.total_order_amount || "");
      setBalanceAmount(receiptData.balance_amount || "");
      setPurpose(receiptData.purpose || "");
      setNotes(receiptData.notes || "");
      if (receiptData.terms_conditions) setTermsConditions(receiptData.terms_conditions);

      setBankName(receiptData.bank_name || "");
      setBankAccountNo(receiptData.bank_account_no || "");
      setBankIfscCode(receiptData.bank_ifsc || "");
      setBankAccountHolder(receiptData.account_holder_name || "");
    }
  }, [isEdit, receiptData]);

  const applyBank = (bank) => {
    if (!bank) return;
    setBankName(bank.bank_name || "");
    setBankAccountNo(bank.account_number || "");
    setBankIfscCode(bank.ifsc_code || "");
    setBankAccountHolder(bank.account_holder_name || bank.company_name || "");
  };

  // AUTO-POPULATION: Project Selection
  const handleProjectSelect = (projId) => {
    setSelectedProjectId(projId);
    if (!projId) return;

    const proj = projectsList.find((p) => String(p.id) === String(projId));
    if (!proj) return;

    const cust = proj.customer_details || {};
    const company = cust.name || cust.company_name || proj.customer_name || "";
    setPayerName(company);
    setContactPerson(cust.contact_person || proj.contact_person || "");
    setContactNumber(cust.phone || cust.mobile || proj.contact_number || "");
    setEmail(cust.email || proj.email || "");
    setAddress(cust.address || proj.site_address || proj.location || "");
    setGstin(cust.gstin || "");
    setPan(cust.pan || "");
    setState(cust.state || "Maharashtra");
    setCity(cust.city || "Pune");
    setCustomerId(proj.customer || cust.id || null);

    const projVal = parseFloat(proj.project_value || proj.total_cost || 0);
    setTotalOrderAmount(projVal > 0 ? projVal : "");
    setPurpose(`Advance payment for ${proj.project_code || "Project"} - ${proj.title || "Water Treatment Project"}`);

    if (amount) {
      const adv = parseFloat(amount) || 0;
      setBalanceAmount(Math.max(0, projVal - adv));
    }
  };

  // AUTO-POPULATION: AMC Selection
  const handleAmcSelect = (amcId) => {
    setSelectedAmcId(amcId);
    setSelectedCycleId("");
    setSelectedCycle(null);
    if (!amcId) {
      setAvailableCycles([]);
      return;
    }

    const amc = amcList.find((a) => String(a.id) === String(amcId));
    if (!amc) return;

    const cust = amc.customer_details || {};
    const company = cust.name || cust.company_name || amc.customer_name || "";
    setPayerName(company);
    setContactPerson(cust.contact_person || amc.contact_person || "");
    setContactNumber(cust.phone || cust.mobile || amc.contact_number || "");
    setEmail(cust.email || amc.email || "");
    setAddress(cust.address || amc.service_address || "");
    setGstin(cust.gstin || "");
    setPan(cust.pan || "");
    setState(cust.state || "Maharashtra");
    setCity(cust.city || "Pune");
    setCustomerId(amc.customer || cust.id || null);

    // Extract cycles sorted by cycle_number
    const rawCycles = Array.isArray(amc.cycles) ? amc.cycles : [];
    const cycles = [...rawCycles].sort((a, b) => (a.cycle_number || 0) - (b.cycle_number || 0));
    setAvailableCycles(cycles);

    // Auto-select latest or active cycle if cycles exist
    let targetCycle = null;
    if (cycles.length > 0) {
      targetCycle = cycles.find((c) => c.status === "active") || cycles[cycles.length - 1];
      setSelectedCycleId(String(targetCycle.id));
      setSelectedCycle(targetCycle);
    }

    const amcVal = parseFloat(targetCycle?.annual_value || amc.contract_value || amc.annual_charges || 0);
    setTotalOrderAmount(amcVal > 0 ? amcVal : "");

    const cId = amc.contract_id || amc.contract_number || `AMC-${amc.id}`;
    if (targetCycle && targetCycle.cycle_number > 1) {
      setPurpose(`Advance payment for AMC Renewal Cycle #${targetCycle.cycle_number} (Contract #${cId})`);
    } else {
      setPurpose(`Advance payment for AMC Contract #${cId}`);
    }

    if (amount) {
      const adv = parseFloat(amount) || 0;
      setBalanceAmount(Math.max(0, amcVal - adv));
    }
  };

  // Handle Contract / Renewal Cycle Selection
  const handleCycleSelect = (cycleId) => {
    setSelectedCycleId(cycleId);
    if (!cycleId) {
      setSelectedCycle(null);
      return;
    }

    const amc = amcList.find((a) => String(a.id) === String(selectedAmcId));
    const cyc = availableCycles.find((c) => String(c.id) === String(cycleId));
    if (!cyc) return;

    setSelectedCycle(cyc);
    const cycVal = parseFloat(cyc.annual_value || 0);
    setTotalOrderAmount(cycVal > 0 ? cycVal : "");

    const cId = amc ? (amc.contract_id || amc.contract_number || `AMC-${amc.id}`) : "AMC";
    if (cyc.cycle_number > 1) {
      setPurpose(`Advance payment for AMC Renewal Cycle #${cyc.cycle_number} (Contract #${cId})`);
    } else {
      setPurpose(`Advance payment for AMC Contract #${cId} (Initial Term)`);
    }

    if (amount) {
      const adv = parseFloat(amount) || 0;
      setBalanceAmount(Math.max(0, cycVal - adv));
    }
  };

  // AUTO-POPULATION: Service Selection
  const handleServiceSelect = (srvId) => {
    setSelectedServiceId(srvId);
    if (!srvId) return;

    const srv = servicesList.find((s) => String(s.id) === String(srvId));
    if (!srv) return;

    const cust = srv.customer_details || {};
    const company = cust.name || cust.company_name || srv.customer_name || "";
    setPayerName(company);
    setContactPerson(cust.contact_person || srv.contact_person || "");
    setContactNumber(cust.phone || cust.mobile || srv.contact_number || "");
    setEmail(cust.email || srv.email || "");
    setAddress(cust.address || srv.service_address || "");
    setGstin(cust.gstin || "");
    setPan(cust.pan || "");
    setState(cust.state || "Maharashtra");
    setCity(cust.city || "Pune");
    setCustomerId(srv.customer || cust.id || null);

    const srvVal = parseFloat(srv.service_charge || srv.total_charges || 0);
    setTotalOrderAmount(srvVal > 0 ? srvVal : "");
    setPurpose(`Advance payment for Service #${srv.service_id || srv.visit_number || "SRV"}`);

    if (amount) {
      const adv = parseFloat(amount) || 0;
      setBalanceAmount(Math.max(0, srvVal - adv));
    }
  };

  // AUTO-POPULATION: Direct Customer Selection
  const handleDirectCustomerSelect = (cId) => {
    setCustomerId(cId);
    if (!cId) return;

    const cust = customersList.find((c) => String(c.id) === String(cId));
    if (!cust) return;

    setPayerName(cust.company_name || cust.name || "");
    setContactPerson(cust.contact_person || cust.primary_contact || "");
    setContactNumber(cust.mobile_number || cust.phone || "");
    setEmail(cust.email || "");
    setAddress(cust.billing_address || cust.address || "");
    setGstin(cust.gstin || "");
    setPan(cust.pan || "");
    setState(cust.state || "Maharashtra");
    setCity(cust.city || "Pune");
  };

  // Handle Amount change & balance calculation
  const handleAmountChange = (val) => {
    setAmount(val);
    const advVal = parseFloat(val) || 0;
    const totVal = parseFloat(totalOrderAmount) || 0;
    if (totVal > 0) {
      setBalanceAmount(Math.max(0, totVal - advVal));
    }
  };

  const handleTotalOrderChange = (val) => {
    setTotalOrderAmount(val);
    const totVal = parseFloat(val) || 0;
    const advVal = parseFloat(amount) || 0;
    if (totVal > 0) {
      setBalanceAmount(Math.max(0, totVal - advVal));
    }
  };

  // Amount In Words Live Preview
  const amountInWordsLive = useMemo(() => {
    const numeric = parseFloat(amount);
    return numeric > 0 ? numberToIndianWords(numeric) : "Zero Rupees only";
  }, [amount]);

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!receiptNumber.trim()) {
      Swal.fire("Validation Error", "Please provide a Receipt Number.", "warning");
      return;
    }
    if (!payerName.trim()) {
      Swal.fire("Validation Error", "Please provide Customer / Client Name.", "warning");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Swal.fire("Validation Error", "Please enter a valid Advance Amount greater than 0.", "warning");
      return;
    }

    setSubmitting(true);
    const payload = {
      receipt_number: receiptNumber.trim(),
      receipt_date: receiptDate,
      receipt_type: sourceType,
      status: status,

      project: selectedProjectId ? parseInt(selectedProjectId) : null,
      amc_contract: selectedAmcId ? parseInt(selectedAmcId) : null,
      service: selectedServiceId ? parseInt(selectedServiceId) : null,
      customer: customerId ? parseInt(customerId) : null,
      billing_detail: selectedBillingDetailId ? parseInt(selectedBillingDetailId) : null,

      company_name: "D S AQUA",
      company_address: "HEAD OFFICE: Nr Kalyani School, Belhekar Wasti, Manjari, Hadapsar, Pune Maharashtra",
      company_phone: "8830373068",
      company_email: "dswastewatersolution@gmail.com",
      company_gstin: "27AALCD8065C1ZJ",
      company_state: "27-Maharashtra",

      payer_name: payerName.trim(),
      contact_person: contactPerson.trim(),
      contact_number: contactNumber.trim(),
      email: email.trim(),
      address: address.trim(),
      gstin: gstin.trim(),
      pan: pan.trim(),
      state: state || "Maharashtra",
      city: city || "Pune",

      amount: numAmount,
      amount_in_words: numberToIndianWords(numAmount),
      payment_mode: paymentMode,
      transaction_ref: transactionRef.trim(),
      transaction_date: transactionDate || null,

      bank_name: bankName,
      bank_account_no: bankAccountNo,
      bank_ifsc: bankIfscCode,
      account_holder_name: bankAccountHolder,

      total_order_amount: parseFloat(totalOrderAmount) || 0,
      balance_amount: parseFloat(balanceAmount) || 0,
      purpose: purpose.trim(),
      notes: notes.trim(),
      terms_conditions: termsConditions,
    };

    try {
      const headers = getHeaders();
      const endpoint = isEdit ? `invoice/advance-receipts/${receiptId}/` : "invoice/advance-receipts/";
      const method = isEdit ? "put" : "post";

      await axios[method](`${baseApi}/${endpoint}`, payload, { headers });

      Swal.fire({
        icon: "success",
        title: isEdit ? "Receipt Updated" : "Receipt Created",
        text: `Advance Payment Receipt #${receiptNumber} ${isEdit ? "updated" : "generated"} successfully.`,
        timer: 1800,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error saving Advance Payment Receipt:", err);
      let errMsg = "Failed to save Advance Payment Receipt.";
      if (err.response?.data) {
        if (typeof err.response.data === "string") {
          errMsg = err.response.data;
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
        {/* Header Bar matching AddLeadForm */}
        <div className="bg-white px-6 pt-5 pb-3 flex justify-between items-start border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {isEdit ? `Edit Advance Receipt #${receiptNumber}` : "Add Advance Payment Receipt"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate official advance payment receipt for Projects, AMC Contracts, or Service jobs
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* SOURCE TABS HEADER (PROJECT, AMC, SERVICE, DIRECT) */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Advance Payment Source
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: "PROJECT", label: "Project", icon: Briefcase, desc: "Plant / RO project advance" },
                { type: "AMC", label: "AMC Contract", icon: ShieldAlert, desc: "Annual maintenance advance" },
                { type: "SERVICE", label: "Service Job", icon: Wrench, desc: "Breakdown / visit advance" },
                { type: "DIRECT", label: "Direct Client", icon: UserCheck, desc: "Direct customer payment" },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = sourceType === tab.type;
                return (
                  <button
                    key={tab.type}
                    type="button"
                    onClick={() => {
                      setSourceType(tab.type);
                      setSelectedProjectId("");
                      setSelectedAmcId("");
                      setSelectedCycleId("");
                      setSelectedCycle(null);
                      setAvailableCycles([]);
                      setSelectedServiceId("");
                    }}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white border-sky-500 shadow-xs ring-1 ring-sky-400"
                        : "bg-white/60 border-slate-200 hover:bg-white text-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-sky-600" : "text-slate-400"}`} />
                      <span className={`text-xs font-bold ${isSelected ? "text-sky-700" : "text-slate-700"}`}>
                        {tab.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 leading-tight">{tab.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* DYNAMIC SOURCE SELECTION DROPDOWN */}
            <div className="mt-3 pt-3 border-t border-slate-200/60">
              {sourceType === "PROJECT" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Select Project to Link &amp; Auto-populate:
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="">-- Choose Project ({projectsList.length} available) --</option>
                    {projectsList.map((p) => {
                      const cName = p.customer_name || p.customer_details?.company_name || "Client";
                      return (
                        <option key={p.id} value={p.id}>
                          {p.project_code || `PRJ-${p.id}`} • {cName} • ₹{parseFloat(p.project_value || 0).toLocaleString()}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {sourceType === "AMC" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Select AMC Contract to Link &amp; Auto-populate:
                    </label>
                    <select
                      value={selectedAmcId}
                      onChange={(e) => handleAmcSelect(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="">-- Choose AMC Contract ({amcList.length} available) --</option>
                      {amcList.map((a) => {
                        const cName = a.customer_name || a.customer_details?.company_name || "Client";
                        const cId = a.contract_id || a.contract_number || `AMC-${a.id}`;
                        const cycCount = Array.isArray(a.cycles) ? a.cycles.length : 0;
                        const hasRen = cycCount > 1 || (a.cycles && a.cycles.some((c) => c.cycle_number > 1));
                        return (
                          <option key={a.id} value={a.id}>
                            {cId} • {cName} • ₹{parseFloat(a.contract_value || a.annual_value || 0).toLocaleString()}{" "}
                            {hasRen ? `[🔄 Renewals: ${cycCount} Terms]` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* RENEWAL CYCLE SELECTOR - Appears when selected AMC has renewals / multiple cycles */}
                  {selectedAmcId && (availableCycles.length > 1 || availableCycles.some((c) => c.cycle_number > 1)) && (
                    <div className="bg-sky-50/70 border border-sky-200/90 rounded-lg p-3 space-y-2 animate-fade-in">
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
                            Value: <strong>₹{parseFloat(selectedCycle.annual_value || 0).toLocaleString()}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {sourceType === "SERVICE" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Select Service Job to Link &amp; Auto-populate:
                  </label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => handleServiceSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="">-- Choose Service Job ({servicesList.length} available) --</option>
                    {servicesList.map((s) => {
                      const cName = s.customer_name || s.customer_details?.company_name || "Client";
                      const srvNum = s.service_id || s.visit_number || `SRV-${s.id}`;
                      return (
                        <option key={s.id} value={s.id}>
                          {srvNum} • {cName} • {s.service_type || "Service"}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {sourceType === "DIRECT" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Select Existing Customer (Optional):
                  </label>
                  <select
                    value={customerId || ""}
                    onChange={(e) => handleDirectCustomerSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="">-- Choose Customer ({customersList.length} available) --</option>
                    {customersList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name || c.name} • {c.mobile_number || c.phone || "No phone"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 1: RECEIPT & PAYMENT METADATA */}
          <div className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-2xs">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MdReceipt className="text-sky-600" /> Receipt &amp; Transaction Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">Receipt No *</label>
                  {!isEdit && (
                    <button
                      type="button"
                      onClick={fetchNextNumber}
                      disabled={fetchingNumber}
                      className="text-[10px] text-sky-600 hover:text-sky-700 flex items-center gap-0.5 cursor-pointer"
                    >
                      <MdRefresh className={fetchingNumber ? "animate-spin" : ""} size={12} />
                      Next
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="APR-0001"
                  className="w-full px-3 py-2 text-sm font-mono font-bold text-sky-700 border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Receipt Date *</label>
                <input
                  type="date"
                  required
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode *</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white font-semibold text-slate-700"
                >
                  <option value="ONLINE">Online / UPI</option>
                  <option value="NEFT_RTGS">Bank Transfer / NEFT / RTGS</option>
                  <option value="CHEQUE">Cheque / DD</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Credit / Debit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                >
                  <option value="CONFIRMED">Confirmed / Cleared</option>
                  <option value="PENDING">Pending Clearance</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Transaction / UTR / Cheque Ref No
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. UPI/1234567890 or Cheque #004521"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Transaction Date</label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: RECEIVED FROM (CLIENT / PAYER DETAILS) */}
          <div className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-2xs">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <UserCheck className="text-sky-600 w-3.5 h-3.5" /> Received From (Customer / Client Details)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Customer / Client Name *</label>
                <input
                  type="text"
                  required
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Company / Client Full Name"
                  className="w-full px-3 py-2 text-sm font-semibold border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Number</label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Customer GSTIN</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="27AAAAA0000A1Z5"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white font-mono uppercase"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Client Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full office or site address"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: ADVANCE AMOUNT & FINANCIAL BREAKDOWN */}
          <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/30 shadow-2xs">
            <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <DollarSign className="text-emerald-600 w-3.5 h-3.5" /> Advance Amount &amp; Order Value
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">Advance Amount Received (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 text-base font-bold text-emerald-800 border-2 border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total Order / Contract Value (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={totalOrderAmount}
                    onChange={(e) => handleTotalOrderChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 text-sm font-semibold text-slate-800 border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Remaining Balance (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 text-sm font-semibold text-rose-700 border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 text-xs text-slate-700">
                  <span className="font-bold text-emerald-800">Amount in Words: </span>
                  <span className="italic font-medium">{amountInWordsLive}</span>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Purpose / Against Description
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Advance payment against 5000 LPH RO Plant Project execution"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: DEPOSITED TO BANK ACCOUNT */}
          <div className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MdAccountBalance className="text-sky-600" /> Deposited To (Company Bank Account)
              </h4>
              {billingDetailsList.length > 0 && (
                <select
                  value={selectedBillingDetailId}
                  onChange={(e) => {
                    setSelectedBillingDetailId(e.target.value);
                    const b = billingDetailsList.find((x) => String(x.id) === String(e.target.value));
                    if (b) applyBank(b);
                  }}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                >
                  <option value="">-- Switch Saved Bank Account --</option>
                  {billingDetailsList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} ({b.account_number?.slice(-4)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Account Number</label>
                <input
                  type="text"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={bankIfscCode}
                  onChange={(e) => setBankIfscCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white font-mono uppercase"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: NOTES & TERMS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Internal Notes / Remarks</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special remarks or receipt instructions..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Terms &amp; Conditions</label>
              <textarea
                rows={3}
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white resize-none text-slate-600"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer matching AddLeadForm */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEdit ? "Update Advance Receipt" : "Save Advance Receipt"}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
