import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  MdClose,
  MdArrowBack,
  MdMail,
  MdCall,
  MdEdit,
  MdAdd,
  MdOutlineRemoveRedEye,
  MdEngineering,
  MdCheckCircle,
  MdAccessTime,
  MdWarningAmber,
  MdOutlinePayment,
  MdLocationOn,
  MdBusiness,
  MdDescription,
  MdReceiptLong,
  MdOutlineBuild,
  MdAccountBalance,
  MdFilterList,
  MdCardGiftcard,
  MdReceipt,
  MdLocalShipping,
  MdPayment,
} from "react-icons/md";
import { FaWhatsapp } from "react-icons/fa";
import SendMessageModal from "../templates/SendMessageModal";
import TableView from "../TableView";

export default function CustomerDetailView({
  customer,
  onBack,
  onEdit,
  onRefresh,
  baseApi,
  token,
  formatDate,
  canEdit = true,
  canDelete = true,
  productList = [],
}) {
  const navigate = useNavigate();
  const BASE_API = (baseApi || import.meta.env.VITE_BASE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "services" | "amc" | "quotations" | "invoices" | "bill_of_supply" | "delivery_challans" | "advance_receipts" | "projects" | "referrals"
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Related data states
  const [services, setServices] = useState([]);
  const [amcContracts, setAmcContracts] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [referralPoints, setReferralPoints] = useState(0);
  const [invoices, setInvoices] = useState([]);
  const [billsOfSupply, setBillsOfSupply] = useState([]);
  const [deliveryChallans, setDeliveryChallans] = useState([]);
  const [advanceReceipts, setAdvanceReceipts] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(true);

  // Send message modal
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState("email");

  const customerId = customer?.id;

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // Fetch all related context (Services, AMC Contracts, Quotations, Invoices, Bills of Supply, Delivery Challans, Advance Receipts, Projects, Referrals)
  const fetchCustomerRelatedData = useCallback(async () => {
    if (!customerId) return;
    setLoadingRelated(true);

    try {
      const [srvRes, amcRes, quoteRes, prjRes, refRes, invRes, bosRes, dcRes, aprRes] = await Promise.allSettled([
        fetch(`${BASE_API}/amc/services/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/amc/contracts/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/quotation/quotation/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/lead/projects/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/lead/customer/${customerId}/referrals/`, { headers: authHeaders }),
        fetch(`${BASE_API}/invoice/invoices/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/invoice/bill-of-supply/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/invoice/delivery-challans/?customer=${customerId}&limit=100`, { headers: authHeaders }),
        fetch(`${BASE_API}/invoice/advance-receipts/?customer=${customerId}&limit=100`, { headers: authHeaders }),
      ]);

      // Services
      if (srvRes.status === "fulfilled" && srvRes.value.ok) {
        const data = await srvRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setServices(list);
      }

      // AMC Contracts
      if (amcRes.status === "fulfilled" && amcRes.value.ok) {
        const data = await amcRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setAmcContracts(list);
      }

      // Quotations
      if (quoteRes.status === "fulfilled" && quoteRes.value.ok) {
        const data = await quoteRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setQuotations(list);
      }

      // Invoices
      if (invRes.status === "fulfilled" && invRes.value.ok) {
        const data = await invRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setInvoices(list);
      }

      // Bill of Supply
      if (bosRes.status === "fulfilled" && bosRes.value.ok) {
        const data = await bosRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setBillsOfSupply(list);
      }

      // Delivery Challans
      if (dcRes.status === "fulfilled" && dcRes.value.ok) {
        const data = await dcRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setDeliveryChallans(list);
      }

      // Advance Payment Receipts
      if (aprRes.status === "fulfilled" && aprRes.value.ok) {
        const data = await aprRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setAdvanceReceipts(list);
      }

      // Projects
      if (prjRes.status === "fulfilled" && prjRes.value.ok) {
        const data = await prjRes.value.json();
        const list = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];
        setProjects(list);
      }

      // Referrals
      if (refRes.status === "fulfilled" && refRes.value.ok) {
        const data = await refRes.value.json();
        const list = Array.isArray(data.referrals) ? data.referrals : [];
        setReferrals(list);
        setReferralPoints(data.referral_points !== undefined ? data.referral_points : list.length);
      } else if (customer?.referred_leads) {
        const list = Array.isArray(customer.referred_leads) ? customer.referred_leads : [];
        setReferrals(list);
        setReferralPoints(customer.referral_points !== undefined ? customer.referral_points : list.length);
      }
    } catch (err) {
      console.error("Error fetching customer related context:", err);
    } finally {
      setLoadingRelated(false);
    }
  }, [customerId, BASE_API, authHeaders, customer]);

  useEffect(() => {
    if (customer?.referred_leads) {
      const list = Array.isArray(customer.referred_leads) ? customer.referred_leads : [];
      setReferrals(list);
      setReferralPoints(customer.referral_points !== undefined ? customer.referral_points : list.length);
    }
  }, [customer]);

  useEffect(() => {
    fetchCustomerRelatedData();
  }, [fetchCustomerRelatedData]);

  if (!customer) return null;

  // Format date helper fallback
  const formatDt = (dateStr) => {
    if (!dateStr) return "—";
    if (typeof formatDate === "function") return formatDate(dateStr);
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Helper to resolve product names
  const resolveProducts = (productPurchased) => {
    if (!productPurchased) return [];
    if (Array.isArray(productPurchased)) {
      return productPurchased.map((item) => {
        if (typeof item === "object" && item !== null) {
          return item.name || item.product_name || item.title || JSON.stringify(item);
        }
        if (productList.length > 0) {
          const match = productList.find((p) => String(p.id) === String(item));
          if (match) return match.name;
        }
        return String(item);
      });
    }
    return [String(productPurchased)];
  };

  // Helper for Status badge color
  const getCustomerStatusBadge = (status) => {
    switch (String(status).toLowerCase()) {
      case "active":
        return {
          pill: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
          dot: "bg-emerald-500",
          label: "Active Customer",
        };
      case "prospect":
        return {
          pill: "bg-sky-50 text-sky-700 border-sky-200/60",
          dot: "bg-sky-500",
          label: "Prospect",
        };
      case "on_hold":
        return {
          pill: "bg-amber-50 text-amber-700 border-amber-200/60",
          dot: "bg-amber-500",
          label: "On Hold",
        };
      case "inactive":
        return {
          pill: "bg-slate-100 text-slate-700 border-slate-200",
          dot: "bg-slate-400",
          label: "Inactive",
        };
      default:
        return {
          pill: "bg-slate-50 text-slate-700 border-slate-200",
          dot: "bg-slate-400",
          label: customer.customer_status_display || customer.customer_status || "Customer",
        };
    }
  };

  const statusMeta = getCustomerStatusBadge(customer.customer_status);

  // KPI Calculations
  const completedServicesCount = services.filter((s) => s.status === "completed").length;
  const upcomingServicesCount = services.filter((s) => s.status === "scheduled" || s.status === "in_progress").length;

  const activeAmcContracts = amcContracts.filter((c) => c.status === "active");
  const totalAnnualAmc = amcContracts.reduce((sum, c) => sum + parseFloat(c.annual_value || 0), 0);

  const totalQuotationValue = quotations.reduce((sum, q) => {
    const val = parseFloat(q.latest_version_details?.grand_total || q.total_amount || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalInvoicedValue = invoices.reduce((sum, inv) => {
    const val = parseFloat(inv.grand_total || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalBillOfSupplyValue = billsOfSupply.reduce((sum, b) => {
    const val = parseFloat(b.grand_total || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalAdvanceReceived = advanceReceipts.reduce((sum, rec) => {
    const val = parseFloat(rec.amount || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const handleViewPDF = async (url, docTitle = "Document") => {
    Swal.fire({
      title: `Opening ${docTitle}...`,
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0;">
          <div style="width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top: 4px solid #0284c7; border-radius: 50%; animation: spinPdf 0.9s linear infinite; margin-bottom: 12px;"></div>
          <p style="font-size: 13px; color: #475569; margin: 0; font-weight: 500;">Generating document, please wait...</p>
        </div>
        <style>
          @keyframes spinPdf { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    try {
      const response = await fetch(url, { headers: authHeaders });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const contentType = response.headers.get("content-type") || "";
      const fileType = contentType.includes("pdf") ? "application/pdf" : "text/html";
      const fileURL = URL.createObjectURL(new Blob([blob], { type: fileType }));
      Swal.close();
      const newWin = window.open(fileURL, "_blank");
      if (!newWin || newWin.closed || typeof newWin.closed === "undefined") {
        const link = document.createElement("a");
        link.href = fileURL;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `Failed to open ${docTitle} PDF.`,
      });
    }
  };

  const customerPhone = customer.contact_number || customer.phone || "";
  const customerEmail = customer.email || "";
  const customerName = customer.name || customer.company_name || "Customer";
  const contactPerson = customer.contact_person || "Primary Contact";
  const salesExecutiveName =
    customer.sales_executive_details?.full_name ||
    customer.sales_executive_details?.first_name ||
    customer.sales_executive_name ||
    "—";

  // Communication handlers
  const openWhatsAppModal = () => {
    setMessageChannel("whatsapp");
    setMessageModalOpen(true);
  };

  const openEmailModal = () => {
    setMessageChannel("email");
    setMessageModalOpen(true);
  };

  const handleCall = () => {
    if (!customerPhone) {
      Swal.fire({ icon: "info", text: "No mobile number recorded for this customer." });
      return;
    }
    window.location.href = `tel:${customerPhone}`;
  };

  // Reusable TableView Pagination states
  const [tabPages, setTabPages] = useState({
    services: 1,
    amc: 1,
    quotations: 1,
    invoices: 1,
    bill_of_supply: 1,
    delivery_challans: 1,
    advance_receipts: 1,
    projects: 1,
    referrals: 1,
  });

  const handleTabPageChange = (tabKey, newPage) => {
    setTabPages((prev) => ({ ...prev, [tabKey]: newPage }));
  };

  const getTabPagedRows = (list, tabKey, pageSize = 10) => {
    const page = tabPages[tabKey] || 1;
    const totalPages = Math.max(1, Math.ceil((list?.length || 0) / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const rows = (list || []).slice(startIdx, startIdx + pageSize);
    return { page: safePage, totalPages, rows, pageSize };
  };

  // 1. Services Columns
  const serviceColumns = useMemo(
    () => [
      {
        key: "service_number",
        label: "Service No",
        className: "whitespace-nowrap font-bold text-sky-700",
        render: (srv) => srv.service_number || `#SRV-${srv.id}`,
      },
      {
        key: "service_date",
        label: "Date",
        className: "whitespace-nowrap text-slate-600",
        render: (srv) => formatDt(srv.service_date),
      },
      {
        key: "service_type",
        label: "Type",
        className: "whitespace-nowrap font-medium text-slate-800 capitalize",
        render: (srv) => srv.service_type_display || srv.service_type || "Routine",
      },
      {
        key: "service_category",
        label: "Category",
        className: "whitespace-nowrap",
        render: (srv) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              srv.service_category === "amc_service"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-sky-50 text-sky-700 border-sky-200"
            }`}
          >
            {srv.service_category === "amc_service" ? "AMC Service" : "On-Demand"}
          </span>
        ),
      },
      {
        key: "technician",
        label: "Technician",
        className: "whitespace-nowrap text-slate-700",
        render: (srv) => {
          const techs = Array.isArray(srv.technicians_details) ? srv.technicians_details : [];
          const techName = techs[0]
            ? `${techs[0].first_name || ""} ${techs[0].last_name || ""}`.trim() || techs[0].username
            : srv.service_engineer_details?.full_name || "Unassigned";
          return (
            <span className="flex items-center justify-center gap-1 font-medium">
              <MdEngineering size={12} className="text-slate-400" />
              {techName}
            </span>
          );
        },
      },
      {
        key: "status",
        label: "Status",
        className: "whitespace-nowrap",
        render: (srv) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${
              srv.status === "completed"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : srv.status === "in_progress"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : srv.status === "cancelled"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-sky-50 text-sky-700 border-sky-200"
            }`}
          >
            {srv.status_display || srv.status || "Scheduled"}
          </span>
        ),
      },
      {
        key: "service_cost",
        label: "Cost",
        className: "whitespace-nowrap text-right font-semibold text-slate-900",
        render: (srv) => `₹${parseFloat(srv.service_cost || 0).toLocaleString("en-IN")}`,
      },
    ],
    []
  );

  // 2. AMC Columns
  const amcColumns = useMemo(
    () => [
      {
        key: "contract_id",
        label: "Contract ID",
        className: "whitespace-nowrap font-bold text-sky-700 font-mono",
        render: (c) => c.contract_id || `#AMC-${c.id}`,
      },
      {
        key: "period",
        label: "Period (Start — End)",
        className: "whitespace-nowrap text-slate-700",
        render: (c) => (
          <span>
            <span className="font-medium text-slate-800">{formatDt(c.start_date)}</span>
            <span className="text-slate-400 mx-1">to</span>
            <span className="font-medium text-slate-800">{formatDt(c.end_date)}</span>
          </span>
        ),
      },
      {
        key: "annual_value",
        label: "Annual Value",
        className: "whitespace-nowrap text-right font-bold text-emerald-700",
        render: (c) => `₹${parseFloat(c.annual_value || 0).toLocaleString("en-IN")}`,
      },
      {
        key: "frequency",
        label: "Frequency & Visits",
        className: "whitespace-nowrap capitalize text-slate-700",
        render: (c) => (
          <div>
            <span className="font-semibold block">{c.service_frequency_display || c.service_frequency || "Quarterly"}</span>
            <span className="text-[10px] text-slate-500 block">
              ({c.no_of_visits !== undefined && c.no_of_visits !== null ? c.no_of_visits : 4} visits)
            </span>
          </div>
        ),
      },
      {
        key: "coordinator",
        label: "Coordinator",
        className: "whitespace-nowrap text-slate-700",
        render: (c) => c.support_coordinator_details?.full_name || c.support_coordinator_details?.username || "—",
      },
      {
        key: "status",
        label: "Status",
        className: "whitespace-nowrap",
        render: (c) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${
              c.status === "active"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : c.status === "renewed"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : c.status === "expired"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {c.status_display || c.status || "Active"}
          </span>
        ),
      },
    ],
    []
  );

  // 3. Quotations Columns
  const quotationColumns = useMemo(
    () => [
      {
        key: "quotation_no",
        label: "Quotation No",
        className: "whitespace-nowrap",
        render: (q) => (
          <span className={`font-bold ${q.is_dropped ? "line-through text-slate-500" : "text-sky-700"}`}>
            {q.quotation_no || `AKSN-${q.id}`}
            {q.is_dropped && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-slate-700 text-white rounded text-[9px] font-extrabold">
                DROPPED
              </span>
            )}
          </span>
        ),
      },
      {
        key: "quotation_date",
        label: "Date",
        className: "whitespace-nowrap text-slate-600",
        render: (q) => formatDt(q.quotation_date || q.created_at),
      },
      {
        key: "subject",
        label: "Subject / Purpose",
        className: "text-slate-800 max-w-xs truncate text-left",
        render: (q) => q.subject || "RO Water Treatment System",
      },
      {
        key: "quotation_for",
        label: "Location",
        className: "whitespace-nowrap",
        render: (q) => (
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
            {q.quotation_for || "Pune"}
          </span>
        ),
      },
      {
        key: "grand_total",
        label: "Grand Total",
        className: "whitespace-nowrap text-right font-bold text-slate-900",
        render: (q) => {
          const val = parseFloat(q.latest_version_details?.grand_total || q.total_amount || 0);
          return `₹${val.toLocaleString("en-IN")}`;
        },
      },
      {
        key: "status",
        label: "Status",
        className: "whitespace-nowrap",
        render: (q) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              q.is_finalized
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : q.is_dropped
                ? "bg-slate-100 text-slate-600 border-slate-200"
                : "bg-sky-50 text-sky-700 border-sky-200"
            }`}
          >
            {q.is_finalized ? "Finalized" : q.is_dropped ? "Dropped" : "Draft"}
          </span>
        ),
      },
    ],
    []
  );

  // 4. Invoices Columns
  const invoiceColumns = useMemo(
    () => [
      {
        key: "invoice_number",
        label: "Invoice No",
        className: "whitespace-nowrap font-bold text-sky-700 font-mono",
        render: (inv) => inv.invoice_number || `INV-${inv.id}`,
      },
      {
        key: "invoice_date",
        label: "Date",
        className: "whitespace-nowrap text-slate-600",
        render: (inv) => formatDt(inv.invoice_date || inv.created_at),
      },
      {
        key: "document_type",
        label: "Document Type",
        className: "whitespace-nowrap",
        render: (inv) => {
          const isProforma = inv.document_type === "PROFORMA";
          return (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isProforma
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-sky-50 text-sky-700 border-sky-200"
              }`}
            >
              {isProforma ? "PROFORMA" : "TAX INVOICE"}
            </span>
          );
        },
      },
      {
        key: "linked_ref",
        label: "Linked Ref",
        className: "whitespace-nowrap text-slate-700",
        render: (inv) =>
          inv.project_code ? (
            <span className="font-mono text-sky-700">{inv.project_code}</span>
          ) : inv.amc_contract_number ? (
            <span className="font-mono text-purple-700">{inv.amc_contract_number}</span>
          ) : inv.service_number ? (
            <span className="font-mono text-emerald-700">{inv.service_number}</span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      {
        key: "grand_total",
        label: "Grand Total",
        className: "whitespace-nowrap text-right font-bold text-slate-900",
        render: (inv) => `₹${parseFloat(inv.grand_total || 0).toLocaleString("en-IN")}`,
      },
      {
        key: "status",
        label: "Status",
        className: "whitespace-nowrap",
        render: (inv) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              inv.status === "PAID"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : inv.status === "PARTIALLY_PAID"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {inv.status || "UNPAID"}
          </span>
        ),
      },
    ],
    []
  );

  // 5. Bill of Supply Columns
  const billOfSupplyColumns = useMemo(
    () => [
      {
        key: "bill_number",
        label: "Bill No",
        className: "whitespace-nowrap font-bold text-sky-700 font-mono",
        render: (b) => `#${b.bill_number || `00${b.id}`}`,
      },
      {
        key: "bill_date",
        label: "Date",
        className: "whitespace-nowrap text-slate-600",
        render: (b) => formatDt(b.bill_date || b.created_at),
      },
      {
        key: "amc_contract_number",
        label: "AMC Contract / Ref",
        className: "whitespace-nowrap text-slate-700",
        render: (b) =>
          b.amc_contract_number ? (
            <span className="font-mono text-purple-700">{b.amc_contract_number}</span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      {
        key: "bill_to_name",
        label: "Bill To Party",
        className: "text-slate-800 max-w-xs truncate text-left",
        render: (b) => b.bill_to_name || customerName,
      },
      {
        key: "grand_total",
        label: "Grand Total",
        className: "whitespace-nowrap text-right font-bold text-slate-900",
        render: (b) => `₹${parseFloat(b.grand_total || 0).toLocaleString("en-IN")}`,
      },
      {
        key: "status",
        label: "Status",
        className: "whitespace-nowrap",
        render: (b) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              b.status === "PAID"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : b.status === "PARTIALLY_PAID"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {b.status || "PAID"}
          </span>
        ),
      },
    ],
    [customerName]
  );

  // 6. Delivery Challans Columns
  const deliveryChallanColumns = useMemo(
    () => [
      {
        key: "challan_number",
        label: "Challan No",
        className: "whitespace-nowrap font-bold text-sky-700 font-mono",
        render: (dc) => dc.challan_number || `DC-${dc.id}`,
      },
      {
        key: "challan_date",
        label: "Date",
        className: "whitespace-nowrap text-slate-600",
        render: (dc) => formatDt(dc.challan_date || dc.created_at),
      },
      {
        key: "linked_ref",
        label: "Linked Ref",
        className: "whitespace-nowrap text-slate-700",
        render: (dc) =>
          dc.project_code ? (
            <span className="font-mono text-sky-700">{dc.project_code}</span>
          ) : dc.po_number ? (
            <span className="font-mono text-purple-700">{dc.po_number}</span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      {
        key: "ship_to_address",
        label: "Ship To Location",
        className: "text-slate-800 max-w-xs truncate text-left",
        render: (dc) =>
          dc.ship_to_city ? `${dc.ship_to_city}, ${dc.ship_to_state || ""}` : dc.ship_to_address || "—",
      },
      {
        key: "items_count",
        label: "Items",
        className: "whitespace-nowrap text-center",
        render: (dc) => {
          const count = dc.items?.length || 0;
          return (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-semibold">
              {count} {count === 1 ? "item" : "items"}
            </span>
          );
        },
      },
      {
        key: "grand_total",
        label: "Declared Value",
        className: "whitespace-nowrap text-right font-bold text-slate-900",
        render: (dc) => {
          const amount = parseFloat(dc.grand_total || 0);
          return amount > 0 ? `₹${amount.toLocaleString("en-IN")}` : "₹0.00";
        },
      },
    ],
    []
  );

  // 7. Advance Payment Receipts Columns
  const advanceReceiptColumns = useMemo(
    () => [
      {
        key: "receipt_number",
        label: "Receipt No",
        className: "whitespace-nowrap font-bold text-emerald-700 font-mono",
        render: (apr) => apr.receipt_number || `APR-${apr.id}`,
      },
      {
        key: "receipt_date",
        label: "Date",
        className: "whitespace-nowrap text-slate-600",
        render: (apr) => formatDt(apr.receipt_date || apr.created_at),
      },
      {
        key: "receipt_type",
        label: "Source / Ref",
        className: "whitespace-nowrap text-slate-700",
        render: (apr) => (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {apr.receipt_type || "PROJECT"}
            </span>
            {apr.project_code && <span className="font-mono text-sky-700">{apr.project_code}</span>}
            {apr.amc_contract_number && (
              <span className="font-mono text-purple-700">{apr.amc_contract_number}</span>
            )}
            {apr.service_title && (
              <span className="font-mono text-emerald-700">{apr.service_title}</span>
            )}
          </div>
        ),
      },
      {
        key: "payment_mode",
        label: "Payment Mode",
        className: "whitespace-nowrap text-center",
        render: (apr) => (
          <div>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
              {apr.payment_mode || "ONLINE"}
            </span>
            {apr.transaction_ref && (
              <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-[120px]">
                {apr.transaction_ref}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "amount",
        label: "Advance Paid",
        className: "whitespace-nowrap text-right font-bold text-emerald-700",
        render: (apr) => `₹${parseFloat(apr.amount || 0).toLocaleString("en-IN")}`,
      },
      {
        key: "balance_amount",
        label: "Balance",
        className: "whitespace-nowrap text-right font-medium text-slate-600",
        render: (apr) => `₹${parseFloat(apr.balance_amount || 0).toLocaleString("en-IN")}`,
      },
      {
        key: "status",
        label: "Status",
        className: "whitespace-nowrap text-center",
        render: (apr) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              apr.status === "CONFIRMED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {apr.status || "CONFIRMED"}
          </span>
        ),
      },
    ],
    []
  );

  // 8. Projects Columns
  const projectColumns = useMemo(
    () => [
      {
        key: "project_code",
        label: "Project Code",
        className: "whitespace-nowrap font-bold text-sky-700",
        render: (p) => p.project_code || `PRJ-${p.id}`,
      },
      {
        key: "project_name",
        label: "Project Name",
        className: "whitespace-nowrap font-semibold text-slate-800 text-left",
        render: (p) => p.project_name || "—",
      },
      {
        key: "project_stage",
        label: "Stage",
        className: "whitespace-nowrap text-center",
        render: (p) => (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-100 capitalize">
            {p.project_stage_display || p.project_stage || "Initiation"}
          </span>
        ),
      },
      {
        key: "priority",
        label: "Priority",
        className: "whitespace-nowrap text-center",
        render: (p) => (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
            {p.priority_display || p.priority || "Medium"}
          </span>
        ),
      },
      {
        key: "expected_to_go_live",
        label: "Go-Live",
        className: "whitespace-nowrap text-slate-600",
        render: (p) => formatDt(p.expected_to_go_live || p.start_date),
      },
      {
        key: "project_value",
        label: "Value",
        className: "whitespace-nowrap text-right font-bold text-slate-900",
        render: (p) => `₹${parseFloat(p.project_value || 0).toLocaleString("en-IN")}`,
      },
      {
        key: "project_executive",
        label: "Executive",
        className: "whitespace-nowrap text-slate-700",
        render: (p) => p.project_executive_details?.full_name || p.project_executive_details?.username || "—",
      },
    ],
    []
  );

  // 9. Referrals Columns
  const referralColumns = useMemo(
    () => [
      {
        key: "company_name",
        label: "Referred Lead / Company",
        className: "whitespace-nowrap text-left",
        render: (ref) => (
          <div>
            <span className="font-bold text-slate-900 block">{ref.company_name || "Unnamed"}</span>
            <span className="text-[10px] text-slate-400">Lead #{ref.id}</span>
          </div>
        ),
      },
      {
        key: "contact_person",
        label: "Contact Person",
        className: "whitespace-nowrap text-slate-700 font-medium",
        render: (ref) => ref.contact_person || "—",
      },
      {
        key: "contact",
        label: "Phone & Email",
        className: "whitespace-nowrap text-left",
        render: (ref) => (
          <div>
            {ref.mobile_number && <span className="text-slate-800 font-medium block">{ref.mobile_number}</span>}
            {ref.email_address && (
              <span className="text-[10px] text-slate-400 block truncate max-w-[160px]">
                {ref.email_address}
              </span>
            )}
            {!ref.mobile_number && !ref.email_address && "—"}
          </div>
        ),
      },
      {
        key: "enquiry_date",
        label: "Date Referred",
        className: "whitespace-nowrap text-slate-600",
        render: (ref) =>
          ref.enquiry_date ? formatDt(ref.enquiry_date) : ref.created_at ? formatDt(ref.created_at) : "—",
      },
      {
        key: "pipeline_stage",
        label: "Pipeline Stage",
        className: "whitespace-nowrap text-center",
        render: (ref) => (
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold capitalize">
            {ref.pipeline_stage_display || ref.pipeline_stage || "Enquiry"}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        className: "whitespace-nowrap text-center",
        render: (ref) => (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              ref.status === "close_win"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : ref.status === "close_loss"
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : "bg-sky-50 text-sky-700 border-sky-200"
            }`}
          >
            {ref.status_display || ref.status || "Open"}
          </span>
        ),
      },
      {
        key: "conversion",
        label: "Conversion",
        className: "whitespace-nowrap text-center",
        render: (ref) => (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              ref.is_converted ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
            }`}
          >
            {ref.is_converted ? "✓ Customer Converted" : "In Pipeline"}
          </span>
        ),
      },
      {
        key: "points",
        label: "Points Awarded",
        className: "whitespace-nowrap text-center font-bold text-emerald-700",
        render: () => "+1 Point",
      },
    ],
    []
  );

  return (
    <div className="w-full space-y-4 font-sans antialiased text-slate-800 pb-10 animate-fade-in text-xs">
      {/* 2. MAIN CUSTOMER SUMMARY CARD (Exact UI match with FollowupHistoryView & Figma) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-7 space-y-6">
        {/* Top Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {/* Customer Code */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100 uppercase tracking-wide">
                {customer.customer_code || `CUST-${String(customer.id).padStart(4, "0")}`}
              </span>
              {customer.lead && (
                <span className="text-[10px] text-slate-400">
                  Converted from Lead #{customer.lead}
                </span>
              )}
            </div>

            {/* Company Name */}
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-0.5">
              {customerName}
            </h1>

            {/* Subtitle with Contact Details */}
            <p className="text-[11px] text-slate-500 font-normal mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-slate-700">{contactPerson}</span>
              {customer.designation && <span>({customer.designation})</span>}
              <span>·</span>
              <span>Executive: <strong className="text-slate-800">{salesExecutiveName}</strong></span>
              {(customer.city || customer.state) && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5 text-slate-600">
                    <MdLocationOn size={13} className="text-slate-400" />
                    {[customer.city, customer.state].filter(Boolean).join(", ")}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Right: Status Pill & Communication Actions */}
          <div className="flex items-center gap-2.5 self-start sm:self-center">
            {/* Status Pill Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border shadow-2xs whitespace-nowrap ${statusMeta.pill}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`}></span>
              {statusMeta.label}
            </span>

            {/* Action Buttons: WhatsApp, Email, Phone, Edit */}
            <div className="flex items-center gap-1 border-l border-slate-200/80 pl-2 text-slate-500">
              <button
                type="button"
                onClick={openWhatsAppModal}
                className="p-1.5 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                title="Send WhatsApp Message"
              >
                <FaWhatsapp size={16} />
              </button>
              <button
                type="button"
                onClick={openEmailModal}
                className="p-1.5 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                title="Send Email"
              >
                <MdMail size={16} />
              </button>
              <button
                type="button"
                onClick={handleCall}
                className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                title={`Call ${customerPhone || ""}`}
              >
                <MdCall size={16} />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit && onEdit(customer)}
                  className="p-1.5 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Customer Details"
                >
                  <MdEdit size={16} />
                </button>
              )}

              <button
                type="button"
                onClick={onBack}
                className="p-1.5 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-600 ml-1 border-l border-slate-200 pl-2"
                title="Close"
              >
                <MdClose size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* 3. 5 KPI PULSE CARDS ROW (Exact match with FollowupHistoryView & Figma design) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 pt-1">
          {/* KPI 1: Services */}
          <div
            onClick={() => setActiveTab("services")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "services"
                ? "bg-sky-50/50 border-sky-300 ring-2 ring-sky-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Services & Visits
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {services.length} {services.length === 1 ? "visit" : "visits"} recorded
            </span>
            <span className="text-[10px] text-sky-600 font-medium block mt-0.5 truncate">
              {completedServicesCount} completed · {upcomingServicesCount} upcoming
            </span>
          </div>

          {/* KPI 2: AMC Contracts */}
          <div
            onClick={() => setActiveTab("amc")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "amc"
                ? "bg-sky-50/50 border-sky-300 ring-2 ring-sky-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              AMC Contracts
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {amcContracts.length} {amcContracts.length === 1 ? "contract" : "contracts"}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5 truncate">
              {activeAmcContracts.length > 0 ? "Active Contract" : "No Active AMC"} · ₹{totalAnnualAmc.toLocaleString("en-IN")}/yr
            </span>
          </div>

          {/* KPI 3: Quotations */}
          <div
            onClick={() => setActiveTab("quotations")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "quotations"
                ? "bg-sky-50/50 border-sky-300 ring-2 ring-sky-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Quotations
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {quotations.length} {quotations.length === 1 ? "quotation" : "quotations"}
            </span>
            <span className="text-[10px] text-slate-500 font-normal block mt-0.5 truncate">
              Total ₹{totalQuotationValue.toLocaleString("en-IN")} quoted
            </span>
          </div>

          {/* KPI 4: Project Value & Commercial */}
          <div
            onClick={() => setActiveTab("projects")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "projects"
                ? "bg-sky-50/50 border-sky-300 ring-2 ring-sky-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Project & Commercial
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {customer.project_value ? `₹${parseFloat(customer.project_value).toLocaleString("en-IN")}` : "—"}
            </span>
            <span className="text-[10px] text-slate-500 font-normal block mt-0.5 truncate">
              {projects.length} project(s) · {customer.payment_terms_display || customer.payment_terms || "Credit"}
            </span>
          </div>

          {/* KPI 5: Referral Points */}
          <div
            onClick={() => setActiveTab("referrals")}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === "referrals"
                ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-100 shadow-xs"
                : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Referral Points
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {referralPoints} {referralPoints === 1 ? "point" : "points"} earned
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5 truncate">
              {referrals.length} {referrals.length === 1 ? "referral" : "referrals"} (1 pt each)
            </span>
          </div>
        </div>

        {/* 4. TABS NAVIGATION HEADER */}
        <div className="border-b border-slate-200/80 flex items-center justify-between gap-2 overflow-x-auto pt-2 thin-scrollbar pb-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "overview"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdBusiness size={15} />
              <span>Overview & Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("services")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "services"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdOutlineBuild size={15} />
              <span>Services</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {services.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("amc")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "amc"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdDescription size={15} />
              <span>AMC Contracts</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {amcContracts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("quotations")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "quotations"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdReceiptLong size={15} />
              <span>Quotations</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {quotations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("invoices")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "invoices"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdReceiptLong size={15} />
              <span>Invoices</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {invoices.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("bill_of_supply")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "bill_of_supply"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdReceipt size={15} />
              <span>Bill of Supply</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {billsOfSupply.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("delivery_challans")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "delivery_challans"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdLocalShipping size={15} />
              <span>Delivery Challans</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {deliveryChallans.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("advance_receipts")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "advance_receipts"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdPayment size={15} />
              <span>Advance Receipts</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {advanceReceipts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("projects")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "projects"
                  ? "border-sky-600 text-sky-700 bg-sky-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdEngineering size={15} />
              <span>Projects</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                {projects.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("referrals")}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "referrals"
                  ? "border-emerald-600 text-emerald-700 bg-emerald-50/40"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MdCardGiftcard size={15} />
              <span>Referral Points</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                {referralPoints} pts
              </span>
            </button>
          </div>
        </div>

        {/* 5. TAB PANELS CONTENT */}

        {/* TAB 1: OVERVIEW & PROFILE */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card A: Company & Contact Information */}
              <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200/80 space-y-3.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/70 pb-1.5">
                  Company & Contact Information
                </h3>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Company Name</span>
                  <span className="col-span-2 text-slate-900 font-semibold text-xs">{customerName}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Contact Person</span>
                  <span className="col-span-2 text-slate-800 text-[11px]">
                    {customer.contact_person || "—"}
                    {customer.designation && <span className="text-slate-400 ml-1">({customer.designation})</span>}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Mobile Phone</span>
                  <span className="col-span-2 text-slate-800 text-[11px] flex items-center gap-2">
                    <span>{customerPhone || "—"}</span>
                    {customerPhone && (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={openWhatsAppModal}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          title="WhatsApp"
                        >
                          <FaWhatsapp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCall}
                          className="p-1 text-sky-600 hover:bg-sky-50 rounded"
                          title="Call"
                        >
                          <MdCall size={13} />
                        </button>
                      </span>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Email Address</span>
                  <span className="col-span-2 text-slate-800 text-[11px] flex items-center gap-1.5">
                    {customerEmail ? (
                      <a href={`mailto:${customerEmail}`} className="text-sky-600 hover:underline">
                        {customerEmail}
                      </a>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Website</span>
                  <span className="col-span-2 text-slate-800 text-[11px]">
                    {customer.website ? (
                      <a
                        href={customer.website.startsWith("http") ? customer.website : `https://${customer.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-600 hover:underline"
                      >
                        {customer.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Industry Category</span>
                  <span className="col-span-2 text-slate-700 text-[11px] capitalize">
                    {customer.industry_category_display || customer.industry_category || "—"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">Lead Source</span>
                  <span className="col-span-2 text-slate-700 text-[11px] capitalize">
                    {customer.lead_source_display || customer.lead_source || "—"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">GST Number</span>
                  <span className="col-span-2 text-slate-800 font-mono font-medium text-[11px]">
                    {customer.gst_number || "—"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">PAN Number</span>
                  <span className="col-span-2 text-slate-800 font-mono font-medium text-[11px]">
                    {customer.pan_number || customer.pan || "—"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400 font-normal text-[11px]">MSME Number</span>
                  <span className="col-span-2 text-slate-800 font-mono text-[11px]">
                    {customer.msme_number || "—"}
                  </span>
                </div>
              </div>

              {/* Card B: Commercial, Address & Billing */}
              <div className="space-y-5">
                <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200/80 space-y-3.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/70 pb-1.5">
                    Commercial & Contract Terms
                  </h3>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">Payment Terms</span>
                    <span className="col-span-2 text-slate-800 font-medium text-[11px] capitalize">
                      {customer.payment_terms_display || customer.payment_terms || "—"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">Project Value</span>
                    <span className="col-span-2 text-emerald-700 font-bold text-xs">
                      {customer.project_value ? `₹${parseFloat(customer.project_value).toLocaleString("en-IN")}` : "—"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">Sales Executive</span>
                    <span className="col-span-2 text-slate-800 font-medium text-[11px]">{salesExecutiveName}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">AMC Coverage</span>
                    <span className="col-span-2 text-slate-700 text-[11px]">
                      {customer.amc_start_date ? (
                        <span>
                          {formatDt(customer.amc_start_date)} to {formatDt(customer.amc_end_date)}
                        </span>
                      ) : (
                        "No fixed dates in master"
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">Products Purchased</span>
                    <div className="col-span-2 flex flex-wrap gap-1">
                      {resolveProducts(customer.product_purchased).length > 0 ? (
                        resolveProducts(customer.product_purchased).map((prod, idx) => (
                          <span
                            key={idx}
                            className="bg-sky-50 text-sky-700 border border-sky-100 text-[10px] px-2 py-0.5 rounded-full font-medium"
                          >
                            {prod}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <span className="text-slate-400 font-normal text-[11px]">Service Package</span>
                    <div className="col-span-2 flex flex-wrap gap-1">
                      {Array.isArray(customer.service_package) && customer.service_package.length > 0 ? (
                        customer.service_package.map((pkg, idx) => (
                          <span
                            key={idx}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] px-2 py-0.5 rounded-full font-medium"
                          >
                            {typeof pkg === "object" ? pkg.name || JSON.stringify(pkg) : pkg}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Invoicing & Operations Activity */}
                <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200/80 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Invoicing & Operations Activity
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium">Quick Summary</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab("invoices")}
                      className="p-2.5 bg-white rounded-lg border border-slate-200/70 hover:border-sky-300 hover:shadow-xs transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-slate-400 group-hover:text-sky-600 mb-1">
                        <span className="text-[10px] font-medium uppercase">Tax Invoices</span>
                        <MdReceiptLong size={14} />
                      </div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700">
                        ₹{totalInvoicedValue.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("bill_of_supply")}
                      className="p-2.5 bg-white rounded-lg border border-slate-200/70 hover:border-sky-300 hover:shadow-xs transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-slate-400 group-hover:text-sky-600 mb-1">
                        <span className="text-[10px] font-medium uppercase">Bill of Supply</span>
                        <MdReceipt size={14} />
                      </div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700">
                        ₹{totalBillOfSupplyValue.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {billsOfSupply.length} {billsOfSupply.length === 1 ? "bill" : "bills"}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("delivery_challans")}
                      className="p-2.5 bg-white rounded-lg border border-slate-200/70 hover:border-sky-300 hover:shadow-xs transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-slate-400 group-hover:text-sky-600 mb-1">
                        <span className="text-[10px] font-medium uppercase">Challans</span>
                        <MdLocalShipping size={14} />
                      </div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700">
                        {deliveryChallans.length} {deliveryChallans.length === 1 ? "Challan" : "Challans"}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        Shipment & Delivery
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("advance_receipts")}
                      className="p-2.5 bg-white rounded-lg border border-slate-200/70 hover:border-emerald-300 hover:shadow-xs transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-600 mb-1">
                        <span className="text-[10px] font-medium uppercase">Advance Recd</span>
                        <MdPayment size={14} />
                      </div>
                      <div className="text-xs font-bold text-emerald-700">
                        ₹{totalAdvanceReceived.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {advanceReceipts.length} {advanceReceipts.length === 1 ? "receipt" : "receipts"}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Card C: Billing Address */}
                <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200/80 space-y-2.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/70 pb-1.5">
                    Billing Address
                  </h3>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    {customer.billing_address || customer.address || "No billing address specified."}
                  </p>
                  {(customer.city || customer.state || customer.pin_code) && (
                    <p className="text-[11px] text-slate-500 font-medium">
                      {[customer.city, customer.state, customer.pin_code].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SERVICES (All On-Demand & AMC Services for this customer) */}
        {activeTab === "services" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Services & Maintenance Visits
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Complete history of on-demand breakdown jobs and scheduled AMC visits for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/services?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Add Service</span>
              </button>
            </div>

            <TableView
              columns={serviceColumns}
              rows={getTabPagedRows(services, "services").rows}
              loading={loadingRelated}
              page={getTabPagedRows(services, "services").page}
              totalPages={getTabPagedRows(services, "services").totalPages}
              onPageChange={(p) => handleTabPageChange("services", p)}
              pageSize={10}
              actions={(srv) => (
                <button
                  type="button"
                  onClick={() => navigate("/amc-services", { state: { viewingService: srv, serviceId: srv.id } })}
                  className="px-2 py-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors border border-sky-200 cursor-pointer inline-flex items-center gap-1"
                  title="View Full Service Details"
                >
                  <MdOutlineRemoveRedEye size={13} />
                  <span>View</span>
                </button>
              )}
              emptyMessage="No service visits recorded for this customer yet."
            />
          </div>
        )}

        {/* TAB 3: AMC CONTRACTS */}
        {activeTab === "amc" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  AMC Contracts
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Annual maintenance contracts, visit schedules, and renewals for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/amc?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Add AMC Contract</span>
              </button>
            </div>

            <TableView
              columns={amcColumns}
              rows={getTabPagedRows(amcContracts, "amc").rows}
              loading={loadingRelated}
              page={getTabPagedRows(amcContracts, "amc").page}
              totalPages={getTabPagedRows(amcContracts, "amc").totalPages}
              onPageChange={(p) => handleTabPageChange("amc", p)}
              pageSize={10}
              actions={(c) => (
                <button
                  type="button"
                  onClick={() => navigate(`/amc?contractId=${c.id}`)}
                  className="px-2 py-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors border border-sky-200 cursor-pointer inline-flex items-center gap-1"
                  title="View Full AMC Details"
                >
                  <MdOutlineRemoveRedEye size={13} />
                  <span>View</span>
                </button>
              )}
              emptyMessage="No AMC contracts found for this customer."
            />
          </div>
        )}

        {/* TAB 4: QUOTATIONS */}
        {activeTab === "quotations" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Quotations & Proposals
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Commercial estimates, system proposals, and revisions generated for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/quotations?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Add Quotation</span>
              </button>
            </div>

            <TableView
              columns={quotationColumns}
              rows={getTabPagedRows(quotations, "quotations").rows}
              loading={loadingRelated}
              page={getTabPagedRows(quotations, "quotations").page}
              totalPages={getTabPagedRows(quotations, "quotations").totalPages}
              onPageChange={(p) => handleTabPageChange("quotations", p)}
              pageSize={10}
              actions={(q) => (
                <button
                  type="button"
                  onClick={() => navigate(`/quotations?id=${q.id}`)}
                  className="px-2 py-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors border border-sky-200 cursor-pointer inline-flex items-center gap-1"
                  title="View Quotation"
                >
                  <MdOutlineRemoveRedEye size={13} />
                  <span>View</span>
                </button>
              )}
              emptyMessage="No commercial proposals or quotations generated for this customer yet."
            />
          </div>
        )}

        {/* TAB: INVOICES */}
        {activeTab === "invoices" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Tax Invoices & Proforma Invoices
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Official GST tax invoices and proforma billing generated for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/invoices?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Create Invoice</span>
              </button>
            </div>

            <TableView
              columns={invoiceColumns}
              rows={getTabPagedRows(invoices, "invoices").rows}
              loading={loadingRelated}
              page={getTabPagedRows(invoices, "invoices").page}
              totalPages={getTabPagedRows(invoices, "invoices").totalPages}
              onPageChange={(p) => handleTabPageChange("invoices", p)}
              pageSize={10}
              actions={(inv) => {
                const isProforma = inv.document_type === "PROFORMA";
                return (
                  <button
                    type="button"
                    onClick={() =>
                      handleViewPDF(
                        `${BASE_API}/invoice/invoices/${inv.id}/pdf/?disposition=inline`,
                        isProforma ? "Proforma Invoice" : "Tax Invoice"
                      )
                    }
                    className="px-2 py-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors border border-sky-200 cursor-pointer inline-flex items-center gap-1"
                    title="View Invoice PDF"
                  >
                    <MdOutlineRemoveRedEye size={13} />
                    <span>View PDF</span>
                  </button>
                );
              }}
              emptyMessage="No tax or proforma invoices generated for this customer yet."
            />
          </div>
        )}

        {/* TAB: BILL OF SUPPLY */}
        {activeTab === "bill_of_supply" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Bill of Supply
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Official non-GST Bills of Supply for AMC contracts, renewals & services for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/bill-of-supply?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Create Bill of Supply</span>
              </button>
            </div>

            <TableView
              columns={billOfSupplyColumns}
              rows={getTabPagedRows(billsOfSupply, "bill_of_supply").rows}
              loading={loadingRelated}
              page={getTabPagedRows(billsOfSupply, "bill_of_supply").page}
              totalPages={getTabPagedRows(billsOfSupply, "bill_of_supply").totalPages}
              onPageChange={(p) => handleTabPageChange("bill_of_supply", p)}
              pageSize={10}
              actions={(b) => (
                <button
                  type="button"
                  onClick={() =>
                    handleViewPDF(
                      `${BASE_API}/invoice/bill-of-supply/${b.id}/pdf/?disposition=inline`,
                      "Bill of Supply"
                    )
                  }
                  className="px-2 py-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors border border-sky-200 cursor-pointer inline-flex items-center gap-1"
                  title="View Bill of Supply PDF"
                >
                  <MdOutlineRemoveRedEye size={13} />
                  <span>View PDF</span>
                </button>
              )}
              emptyMessage="No bills of supply generated for this customer yet."
            />
          </div>
        )}

        {/* TAB: DELIVERY CHALLANS */}
        {activeTab === "delivery_challans" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Delivery Challans
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Goods dispatch notes, equipment delivery challans & proof of dispatch for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/delivery-challans?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Create Delivery Challan</span>
              </button>
            </div>

            <TableView
              columns={deliveryChallanColumns}
              rows={getTabPagedRows(deliveryChallans, "delivery_challans").rows}
              loading={loadingRelated}
              page={getTabPagedRows(deliveryChallans, "delivery_challans").page}
              totalPages={getTabPagedRows(deliveryChallans, "delivery_challans").totalPages}
              onPageChange={(p) => handleTabPageChange("delivery_challans", p)}
              pageSize={10}
              actions={(dc) => (
                <button
                  type="button"
                  onClick={() =>
                    handleViewPDF(
                      `${BASE_API}/invoice/delivery-challans/${dc.id}/pdf/?disposition=inline`,
                      "Delivery Challan"
                    )
                  }
                  className="px-2 py-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors border border-sky-200 cursor-pointer inline-flex items-center gap-1"
                  title="View Delivery Challan PDF"
                >
                  <MdOutlineRemoveRedEye size={13} />
                  <span>View PDF</span>
                </button>
              )}
              emptyMessage="No delivery challans recorded for this customer yet."
            />
          </div>
        )}

        {/* TAB: ADVANCE PAYMENT RECEIPTS */}
        {activeTab === "advance_receipts" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Advance Payment Receipts
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Advance payment acknowledgements & booking deposits received for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/advance-receipts?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-emerald-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Add Advance Receipt</span>
              </button>
            </div>

            <TableView
              columns={advanceReceiptColumns}
              rows={getTabPagedRows(advanceReceipts, "advance_receipts").rows}
              loading={loadingRelated}
              page={getTabPagedRows(advanceReceipts, "advance_receipts").page}
              totalPages={getTabPagedRows(advanceReceipts, "advance_receipts").totalPages}
              onPageChange={(p) => handleTabPageChange("advance_receipts", p)}
              pageSize={10}
              actions={(apr) => (
                <button
                  type="button"
                  onClick={() =>
                    handleViewPDF(
                      `${BASE_API}/invoice/advance-receipts/${apr.id}/pdf/?disposition=inline`,
                      "Advance Payment Receipt"
                    )
                  }
                  className="px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200 cursor-pointer inline-flex items-center gap-1"
                  title="View Advance Receipt PDF"
                >
                  <MdOutlineRemoveRedEye size={13} />
                  <span>View PDF</span>
                </button>
              )}
              emptyMessage="No advance payment receipts recorded for this customer yet."
            />
          </div>
        )}

        {/* TAB 5: PROJECTS */}
        {activeTab === "projects" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                  Projects
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Execution projects and deployment milestones for {customerName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/projects?customerId=${customer.id}`)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <MdAdd size={15} />
                <span>Add Project</span>
              </button>
            </div>

            <TableView
              columns={projectColumns}
              rows={getTabPagedRows(projects, "projects").rows}
              loading={loadingRelated}
              page={getTabPagedRows(projects, "projects").page}
              totalPages={getTabPagedRows(projects, "projects").totalPages}
              onPageChange={(p) => handleTabPageChange("projects", p)}
              pageSize={10}
              actions={(p) => (
                <button
                  type="button"
                  onClick={() => navigate(`/projects?projectId=${p.id}`)}
                  className="px-2 py-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors border border-sky-200 cursor-pointer inline-flex items-center gap-1"
                  title="View Full Project Details"
                >
                  <MdOutlineRemoveRedEye size={13} />
                  <span>View</span>
                </button>
              )}
              emptyMessage="No execution projects linked to this customer account."
            />
          </div>
        )}

        {/* TAB 6: REFERRAL POINTS & NETWORK */}
        {activeTab === "referrals" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight flex items-center gap-2">
                  <span>Referral Points & Network</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[11px] font-bold">
                    {referralPoints} {referralPoints === 1 ? "Point" : "Points"}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Leads referred by {customerName}. Each qualified referral earns 1 point.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-lg text-[11px] text-amber-800 font-semibold flex items-center gap-1.5 shadow-2xs">
                  <MdCardGiftcard className="text-amber-600" size={15} />
                  <span>Rule: 1 Referral = 1 Point</span>
                </div>
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MdCardGiftcard size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Total Referral Points
                  </span>
                  <span className="text-xl font-bold text-emerald-950">
                    {referralPoints} <span className="text-xs font-semibold text-emerald-700">Pts</span>
                  </span>
                </div>
              </div>

              <div className="bg-sky-50/50 border border-sky-200/70 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MdBusiness size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block">
                    Total Leads Referred
                  </span>
                  <span className="text-xl font-bold text-sky-950">
                    {referrals.length} <span className="text-xs font-semibold text-sky-700">Leads</span>
                  </span>
                </div>
              </div>

              <div className="bg-purple-50/50 border border-purple-200/70 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MdCheckCircle size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">
                    Converted Customers
                  </span>
                  <span className="text-xl font-bold text-purple-950">
                    {referrals.filter((r) => r.is_converted).length}{" "}
                    <span className="text-xs font-semibold text-purple-700">Converted</span>
                  </span>
                </div>
              </div>
            </div>

            <TableView
              columns={referralColumns}
              rows={getTabPagedRows(referrals, "referrals").rows}
              loading={loadingRelated}
              page={getTabPagedRows(referrals, "referrals").page}
              totalPages={getTabPagedRows(referrals, "referrals").totalPages}
              onPageChange={(p) => handleTabPageChange("referrals", p)}
              pageSize={10}
              emptyMessage="No referrals recorded yet for this customer."
            />
          </div>
        )}
      </div>

      {/* 6. SEND MESSAGE MODAL (Integrated WhatsApp & Email) */}
      {messageModalOpen && (
        <SendMessageModal
          isOpen={messageModalOpen}
          onClose={() => setMessageModalOpen(false)}
          category="customer"
          recordData={{
            name: customerName,
            company_name: customerName,
            contact_person: contactPerson,
            email: customerEmail,
            email_address: customerEmail,
            mobile_number: customerPhone,
            phone_number: customerPhone,
            customer_code: customer.customer_code,
            id: customer.id,
          }}
          defaultChannel={messageChannel}
          onSuccess={() => {
            Swal.fire({
              icon: "success",
              title: "Message Sent",
              text: "Communication delivered successfully.",
              timer: 1500,
              showConfirmButton: false,
            });
          }}
        />
      )}
    </div>
  );
}

