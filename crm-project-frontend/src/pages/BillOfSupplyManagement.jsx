import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  MdAdd,
  MdFilterList,
  MdEdit,
  MdDelete,
  MdDownload,
  MdRefresh,
  MdVisibility,
  MdAutorenew,
  MdVerified,
  MdReceipt,
} from "react-icons/md";
import { Search } from "lucide-react";
import Swal from "sweetalert2";
import Base from "../components/Base";
import TableView from "../components/TableView";
import AddBillOfSupplyModal from "../components/invoice/AddBillOfSupplyModal";
import AdvancedTableFilter from "../components/AdvancedTableFilter";
import { getBaseApiUrl } from "../utils/apiConfig";
import { exportToExcel, formatExcelDate } from "../utils/excelExport";

export default function BillOfSupplyManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const baseApi = getBaseApiUrl();

  // Data States
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredData, setFilteredData] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const getHeaders = () => {
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
  };

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Bills of Supply (from dedicated bill-of-supply endpoint)
  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${baseApi}/invoice/bill-of-supply/?limit=1000`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.results || [];
      setBills(list);
      setFilteredData(list);
    } catch (err) {
      console.error("Error fetching Bill of Supply records:", err);
      setError(err.message || "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, [baseApi]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Filtered dataset
  const filteredBills = useMemo(() => {
    let base = filteredData.length > 0 || bills.length === 0 ? filteredData : bills;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      return base.filter((b) => {
        return (
          (b.invoice_number && b.invoice_number.toLowerCase().includes(searchLower)) ||
          (b.bill_to_name && b.bill_to_name.toLowerCase().includes(searchLower)) ||
          (b.bill_to_contact && b.bill_to_contact.toLowerCase().includes(searchLower)) ||
          (b.amc_contract_number && b.amc_contract_number.toLowerCase().includes(searchLower)) ||
          (b.amc_contract_product && b.amc_contract_product.toLowerCase().includes(searchLower)) ||
          (b.po_number && b.po_number.toLowerCase().includes(searchLower)) ||
          (b.notes && b.notes.toLowerCase().includes(searchLower))
        );
      });
    }
    return base;
  }, [bills, filteredData, searchTerm]);

  // Financial KPI totals
  const stats = useMemo(() => {
    let totalBilled = 0;
    let totalReceived = 0;
    let totalBalance = 0;
    let renewalCount = 0;

    bills.forEach((b) => {
      totalBilled += parseFloat(b.grand_total) || 0;
      totalReceived += parseFloat(b.received_amount) || 0;
      totalBalance += parseFloat(b.balance_amount) || 0;
      if (b.amc_is_renewal) renewalCount++;
    });

    return {
      totalBilled,
      totalReceived,
      totalBalance,
      totalCount: bills.length,
      renewalCount,
    };
  }, [bills]);

  // Pagination slice
  const totalCount = filteredBills.length;
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const currentPageData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBills.slice(start, start + itemsPerPage);
  }, [filteredBills, currentPage, itemsPerPage]);

  // Format currency
  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // View PDF Inline
  const handleViewPdf = async (billId) => {
    Swal.fire({
      title: "Opening Bill of Supply...",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0;">
          <div style="width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top: 4px solid #0284c7; border-radius: 50%; animation: spinPdf 0.9s linear infinite; margin-bottom: 12px;"></div>
          <p style="font-size: 13px; color: #475569; margin: 0; font-weight: 500;">Generating Bill of Supply PDF...</p>
        </div>
        <style>@keyframes spinPdf { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
    });

    try {
      let url = `${baseApi}/invoice/bill-of-supply/${billId}/pdf/?disposition=inline`;
      let response = await fetch(url, { headers: getHeaders() });
      if (!response.ok) {
        url = `${baseApi}/invoice/invoices/${billId}/pdf/?disposition=inline`;
        response = await fetch(url, { headers: getHeaders() });
      }
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
      Swal.fire("Error", "Failed to render Bill of Supply PDF.", "error");
    }
  };

  // Download PDF
  const handleDownloadPdf = async (billId, billNumber) => {
    Swal.fire({
      title: "Downloading Bill of Supply...",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0;">
          <div style="width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top: 4px solid #16a34a; border-radius: 50%; animation: spinPdfDown 0.9s linear infinite; margin-bottom: 12px;"></div>
          <p style="font-size: 13px; color: #475569; margin: 0; font-weight: 500;">Preparing PDF download...</p>
        </div>
        <style>@keyframes spinPdfDown { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
    });

    try {
      let url = `${baseApi}/invoice/bill-of-supply/${billId}/pdf/?disposition=attachment`;
      let response = await fetch(url, { headers: getHeaders() });
      if (!response.ok) {
        url = `${baseApi}/invoice/invoices/${billId}/pdf/?disposition=attachment`;
        response = await fetch(url, { headers: getHeaders() });
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const fileURL = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = fileURL;
      link.download = `Bill_Of_Supply_${billNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(fileURL);
      Swal.close();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to download Bill of Supply PDF.", "error");
    }
  };

  // Delete Action
  const handleDelete = (id, billNum) => {
    Swal.fire({
      title: "Delete Bill of Supply?",
      text: `Are you sure you want to permanently delete Bill of Supply #${billNum}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          let res = await fetch(`${baseApi}/invoice/bill-of-supply/${id}/`, {
            method: "DELETE",
            headers: getHeaders(),
          });
          if (!res.ok) {
            res = await fetch(`${baseApi}/invoice/invoices/${id}/`, {
              method: "DELETE",
              headers: getHeaders(),
            });
          }
          if (!res.ok) throw new Error("Delete failed");
          Swal.fire({
            icon: "success",
            title: "Deleted!",
            text: `Bill #${billNum} deleted successfully.`,
            timer: 1500,
            showConfirmButton: false,
          });
          fetchBills();
        } catch (err) {
          Swal.fire("Error", "Could not delete Bill of Supply record.", "error");
        }
      }
    });
  };

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = filteredBills.length > 0 ? filteredBills : bills;
    const formatted = dataToExport.map((b, idx) => ({
      "Sr No": idx + 1,
      "Bill No": b.invoice_number,
      "Bill Date": formatExcelDate(b.invoice_date),
      "Customer / Client": b.bill_to_name || "-",
      "Contact": b.bill_to_contact || "-",
      "AMC Contract": b.amc_contract_number || "-",
      "AMC Product": b.amc_contract_product || "-",
      "Contract Type": b.amc_is_renewal ? `Renewal (Cycle #${b.amc_cycle_number || 2})` : "New AMC",
      "Service Visits": b.amc_no_of_visits || 4,
      "Linked Invoice": b.po_number || "-",
      "Total Amount (₹)": parseFloat(b.grand_total || 0),
      "Received (₹)": parseFloat(b.received_amount || 0),
      "Balance (₹)": parseFloat(b.balance_amount || 0),
      "Payment Status": b.status || "PAID",
      "Notes": b.notes || "-",
    }));

    exportToExcel({
      data: formatted,
      fileName: "Bill_Of_Supply_AMC",
      sheetName: "Bills_Of_Supply",
    });
  };

  // Table Columns matching Lead.jsx and InvoiceManagement.jsx styling
  const columns = [
    {
      key: "sr",
      label: "Sr.No",
      render: (_, idx) => (
        <span className="text-slate-600 font-medium text-xs whitespace-nowrap block">
          {(currentPage - 1) * itemsPerPage + (idx + 1)}
        </span>
      ),
      className: "w-12 whitespace-nowrap text-center",
    },
    {
      key: "invoice_number",
      label: "Bill No",
      render: (r) => (
        <span
          className="text-sky-600 font-bold text-xs whitespace-nowrap cursor-pointer hover:underline block"
          onClick={() => handleViewPdf(r.id)}
          title="Click to view Bill of Supply PDF"
        >
          #{r.bill_number || r.invoice_number}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "invoice_date",
      label: "Date",
      render: (r) => (
        <span className="text-slate-600 text-xs whitespace-nowrap block">
          {r.bill_date || r.invoice_date || "-"}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "bill_to_name",
      label: "Customer / Client",
      render: (r) => (
        <span
          className="text-slate-900 font-semibold text-xs tracking-tight block max-w-[150px] truncate mx-auto cursor-pointer hover:text-sky-600"
          title={`${r.bill_to_name || ""}${r.bill_to_contact ? ` (${r.bill_to_contact})` : ""}`}
          onClick={() => handleViewPdf(r.id)}
        >
          {r.bill_to_name || "-"}
        </span>
      ),
      className: "min-w-[120px] max-w-[160px] text-center",
    },
    {
      key: "bill_to_contact",
      label: "Contact",
      render: (r) => (
        <span className="text-slate-700 text-xs font-medium whitespace-nowrap block">
          {r.bill_to_contact || "-"}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "amc_info",
      label: "AMC Contract & Type",
      render: (r) => (
        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
          <span
            className="text-slate-800 font-medium text-xs truncate max-w-[110px]"
            title={r.amc_contract_product || r.amc_contract_number || "AMC"}
          >
            {r.amc_contract_product || r.amc_contract_number || "AMC"}
          </span>
          {r.amc_is_renewal ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider bg-purple-50 text-purple-700 border-purple-200">
              Renewal
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-200">
              New
            </span>
          )}
        </div>
      ),
      className: "min-w-[140px] text-center",
    },
    {
      key: "visits",
      label: "Visits",
      render: (r) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
          {r.amc_no_of_visits || 4} Visits
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "linked_invoice",
      label: "Linked Invoice",
      render: (r) => {
        const invRef = r.linked_invoice_number || r.po_number;
        if (!invRef) {
          return <span className="text-slate-300 text-xs">-</span>;
        }
        return (
          <span
            className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold whitespace-nowrap inline-block"
            title={`Linked Tax Invoice / Reference: ${invRef}`}
          >
            #{invRef}
          </span>
        );
      },
      className: "whitespace-nowrap text-center",
    },
    {
      key: "grand_total",
      label: "Total Amount",
      render: (r) => (
        <span className="text-slate-900 font-bold text-xs whitespace-nowrap block">
          {formatCurrency(r.grand_total)}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "received_amount",
      label: "Received",
      render: (r) => (
        <span className="text-emerald-700 font-medium text-xs whitespace-nowrap block">
          {formatCurrency(r.received_amount)}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "balance_amount",
      label: "Balance",
      render: (r) => {
        const bal = parseFloat(r.balance_amount || 0);
        return (
          <span
            className={`font-semibold text-xs whitespace-nowrap block ${bal > 0 ? "text-rose-600" : "text-slate-400"}`}
          >
            {formatCurrency(bal)}
          </span>
        );
      },
      className: "whitespace-nowrap text-center",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const s = (r.status || "PAID").toUpperCase();
        let color = "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (s === "PARTIALLY_PAID" || s === "PARTIAL") {
          color = "bg-amber-50 text-amber-700 border-amber-200";
        } else if (s === "UNPAID") {
          color = "bg-rose-50 text-rose-700 border-rose-200";
        }
        return (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider whitespace-nowrap ${color}`}>
            {s.replace("_", " ")}
          </span>
        );
      },
      className: "whitespace-nowrap text-center",
    },
  ];

  // Action Buttons matching Lead.jsx / InvoiceManagement.jsx styling
  const actionsRenderer = useCallback(
    (row) => (
      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
        {/* View PDF */}
        <button
          onClick={() => handleViewPdf(row.id)}
          className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="View Bill of Supply PDF"
        >
          <MdVisibility />
        </button>

        {/* Download PDF */}
        <button
          onClick={() => handleDownloadPdf(row.id, row.invoice_number)}
          className="p-1 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="Download PDF"
        >
          <MdDownload />
        </button>

        {/* Edit */}
        <button
          onClick={() => {
            setEditingBill(row);
            setShowModal(true);
          }}
          className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="Edit Bill"
        >
          <MdEdit />
        </button>

        {/* Delete */}
        <button
          onClick={() => handleDelete(row.id, row.invoice_number)}
          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
          title="Delete Bill"
        >
          <MdDelete />
        </button>
      </div>
    ),
    [handleDelete, handleViewPdf, handleDownloadPdf]
  );

  return (
    <Base title="">
      <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1">
        {/* HEADER BLOCK WITH SKY BLUE VERTICAL ACCENT LINE MATCHING LEAD.JSX */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 pt-1">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-10 bg-sky-600 rounded-full block"></span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                Bill of Supply (AMC)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading
                  ? "Synchronizing Bill of Supply records..."
                  : `Total ${totalCount} records identified across AMC contracts & renewals`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Search Input */}
            <div className="relative w-40 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search bills..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 placeholder:text-slate-400 text-slate-800 shadow-2xs"
              />
            </div>

            {/* Filter Button */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
            >
              <MdFilterList className="text-slate-400" />
              Filter
            </button>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
              title="Export Bills to Excel"
            >
              <MdDownload className="text-emerald-600 text-sm" />
              Export
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchBills}
              className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-slate-50 rounded-lg transition-colors shadow-xs cursor-pointer"
              title="Refresh List"
            >
              <MdRefresh className="text-base" />
            </button>

            {/* Add Bill of Supply Button */}
            <button
              type="button"
              onClick={() => {
                setEditingBill(null);
                setShowModal(true);
              }}
              className="px-3 sm:px-4 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>+</span> Add Bill of Supply
            </button>
          </div>
        </div>

        {/* 4 TOP KPI STATS CARDS MATCHING SYSTEM STANDARD */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Total Bills
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {stats.totalCount} bills
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              Non-GST AMC Bills of Supply
            </span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Total AMC Billed
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-sky-700 block mt-0.5">
              {formatCurrency(stats.totalBilled)}
            </span>
            <span className="text-[10px] text-sky-600 font-medium block mt-0.5">
              Gross AMC contract revenue
            </span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Total Collected
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-emerald-700 block mt-0.5">
              {formatCurrency(stats.totalReceived)}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
              Payment received
            </span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Balance Due / Renewals
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-rose-700 block mt-0.5">
              {formatCurrency(stats.totalBalance)}
            </span>
            <span className="text-[10px] text-purple-600 font-medium block mt-0.5">
              {stats.renewalCount} AMC renewals
            </span>
          </div>
        </div>

        {/* COMPACT DATA TABLE COMPONENT */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <TableView
            columns={columns}
            rows={currentPageData}
            loading={loading}
            error={error}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
            pageSize={itemsPerPage}
            actions={actionsRenderer}
            emptyMessage="No Bill of Supply records found matching your filters"
          />
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <AddBillOfSupplyModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingBill(null);
          }}
          onSuccess={fetchBills}
          billId={editingBill?.id}
          initialData={editingBill}
        />
      )}
      {/* FILTER DRAWER - PORTAL TO BODY PREVENTS LAYOUT PUSH AND WHITE BOTTOM STRIP */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            {isFilterOpen && (
              <div
                className="fixed inset-0 w-screen h-screen bg-black/40 z-[9999]"
                onClick={() => setIsFilterOpen(false)}
              />
            )}

            <div
              className={`fixed top-0 right-0 h-screen w-full max-w-[380px] sm:w-[380px] bg-white shadow-2xl z-[10000] flex flex-col transition-transform duration-300 ease-in-out ${
                isFilterOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
                <h3 className="text-lg font-bold text-slate-900">Filters</h3>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                <AdvancedTableFilter
                  data={bills}
                  onFilter={setFilteredData}
                  setItemsPerPage={setItemsPerPage}
                  columns={columns}
                />
              </div>
            </div>
          </>,
          document.body
        )}
    </Base>
  );
}
