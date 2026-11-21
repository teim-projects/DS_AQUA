import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import Base from "../components/Base";
import TableView from "../components/TableView";
import AddAdvancePaymentReceiptModal from "../components/invoice/AddAdvancePaymentReceiptModal";
import AdvancedTableFilter from "../components/AdvancedTableFilter";
import {
  MdEdit,
  MdDelete,
  MdOutlineRemoveRedEye,
  MdDownload,
  MdFilterList,
  MdRefresh,
  MdReceipt,
  MdCheckCircle,
  MdPayment,
} from "react-icons/md";
import { Search, Plus } from "lucide-react";
import Swal from "sweetalert2";
import { exportToExcel, formatExcelDate } from "../utils/excelExport";
import { getBaseApiUrl } from "../utils/apiConfig";

export default function AdvancePaymentReceiptManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const BASE_API = getBaseApiUrl();

  // Data states
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal & Edit state
  const [showModal, setShowModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredData, setFilteredData] = useState([]);

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

  // Fetch Advance Receipts
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_API}/invoice/advance-receipts/?limit=1000`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.results || [];
      setReceipts(list);
      setFilteredData(list);
    } catch (err) {
      console.error("Error fetching Advance Payment Receipts:", err);
      setError(err.message || "Failed to load advance receipt records");
    } finally {
      setLoading(false);
    }
  }, [BASE_API]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open modal if ?create=true in URL
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setEditingReceipt(null);
      setShowModal(true);
    }
  }, [searchParams]);

  // Filtered dataset
  const filteredReceipts = useMemo(() => {
    let base = filteredData.length > 0 || receipts.length === 0 ? filteredData : receipts;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      return base.filter((r) => {
        return (
          (r.receipt_number && r.receipt_number.toLowerCase().includes(searchLower)) ||
          (r.customer_name && r.customer_name.toLowerCase().includes(searchLower)) ||
          (r.payer_name && r.payer_name.toLowerCase().includes(searchLower)) ||
          (r.contact_number && r.contact_number.toLowerCase().includes(searchLower)) ||
          (r.transaction_ref && r.transaction_ref.toLowerCase().includes(searchLower)) ||
          (r.payment_mode && r.payment_mode.toLowerCase().includes(searchLower)) ||
          (r.purpose && r.purpose.toLowerCase().includes(searchLower)) ||
          (r.project_name && r.project_name.toLowerCase().includes(searchLower)) ||
          (r.notes && r.notes.toLowerCase().includes(searchLower))
        );
      });
    }
    return base;
  }, [receipts, filteredData, searchTerm]);

  // Pagination calculation
  const totalCount = filteredReceipts.length;
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const currentPageData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredReceipts.slice(start, start + itemsPerPage);
  }, [filteredReceipts, currentPage, itemsPerPage]);

  // View PDF Inline (opens in browser PDF viewer tab matching Bill of Supply)
  const handleViewPDF = async (id) => {
    const token =
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "";

    Swal.fire({
      title: "Opening Advance Receipt...",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0;">
          <div style="width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top: 4px solid #0284c7; border-radius: 50%; animation: spinRec 0.9s linear infinite; margin-bottom: 12px;"></div>
          <p style="font-size: 13px; color: #475569; margin: 0; font-weight: 500;">Generating Receipt PDF...</p>
        </div>
        <style>
          @keyframes spinRec { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    try {
      const url = `${BASE_API}/invoice/advance-receipts/${id}/pdf/?disposition=inline`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
        text: "Failed to render Advance Payment Receipt PDF.",
      });
    }
  };

  // Download PDF
  const handleDownloadPDF = async (id, num) => {
    Swal.fire({
      title: "Downloading Receipt PDF...",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0;">
          <div style="width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top: 4px solid #16a34a; border-radius: 50%; animation: spinDown 0.9s linear infinite; margin-bottom: 12px;"></div>
          <p style="font-size: 13px; color: #475569; margin: 0; font-weight: 500;">Generating PDF file, please wait...</p>
        </div>
        <style>
          @keyframes spinDown { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    try {
      const token =
        localStorage.getItem("access") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        "";
      const url = `${BASE_API}/invoice/advance-receipts/${id}/pdf/?disposition=attachment`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const file = new Blob([blob], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = `Advance_Receipt_${num || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      Swal.close();
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: err.message || "Failed to download Advance Payment Receipt PDF",
      });
    }
  };

  // Delete Receipt
  const handleDelete = (id, num) => {
    Swal.fire({
      title: "Delete Advance Receipt?",
      text: `Are you sure you want to permanently delete Advance Receipt #${num}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`${BASE_API}/invoice/advance-receipts/${id}/`, {
            method: "DELETE",
            headers: getHeaders(),
          });
          if (!res.ok) throw new Error("Delete failed");
          Swal.fire("Deleted!", `Receipt #${num} has been deleted.`, "success");
          fetchData();
        } catch {
          Swal.fire("Error", "Could not delete advance receipt", "error");
        }
      }
    });
  };

  // Export to Excel matching Lead.jsx
  const handleExportExcel = () => {
    const dataToExport = filteredReceipts && filteredReceipts.length > 0 ? filteredReceipts : receipts;
    const formatted = dataToExport.map((r, idx) => ({
      "Sr No": idx + 1,
      "Receipt Number": r.receipt_number || "-",
      "Receipt Date": formatExcelDate(r.receipt_date),
      "Source Type": r.receipt_type || "-",
      "Customer / Payer": r.customer_name || r.payer_name || "-",
      "Contact Person": r.payer_name || "-",
      "Contact Number": r.contact_number || "-",
      "Payment Mode": r.payment_mode || "-",
      "Transaction / UTR": r.transaction_ref || "-",
      "Advance Amount (₹)": parseFloat(r.amount || 0),
      "Total Order Value (₹)": parseFloat(r.total_order_amount || 0),
      "Remaining Balance (₹)": parseFloat(r.balance_amount || 0),
      "Status": r.status || "-",
      "Purpose": r.purpose || "-",
      "Notes": r.notes || "-",
      "Created At": formatExcelDate(r.created_at),
    }));

    exportToExcel({
      data: formatted,
      fileName: "Advance_Payment_Receipts",
      sheetName: "Receipts",
    });
  };

  // Table Columns - strictly compact single-line matching TableView.jsx & Lead.jsx row height
  const columns = [
    {
      key: "sr_no",
      label: "Sr.No",
      render: (_, __, index) => (
        <span className="text-slate-600 font-medium text-xs whitespace-nowrap block text-center">
          {(currentPage - 1) * itemsPerPage + index + 1}
        </span>
      ),
      className: "w-12 whitespace-nowrap text-center",
    },
    {
      key: "receipt_number",
      label: "Receipt No",
      render: (r) => (
        <span
          className="text-sky-600 font-bold text-xs whitespace-nowrap cursor-pointer hover:underline block text-center font-mono"
          onClick={() => handleViewPDF(r.id)}
          title="Click to view Advance Payment Receipt PDF"
        >
          #{r.receipt_number}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "receipt_date",
      label: "Date",
      render: (r) => (
        <span className="text-slate-600 text-xs whitespace-nowrap block text-center">
          {r.receipt_date || "-"}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "receipt_type",
      label: "Source",
      render: (r) => {
        let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
        let label = "Direct";
        if (r.receipt_type === "PROJECT") {
          badgeColor = "bg-sky-50 text-sky-700 border-sky-200";
          label = "Project";
        } else if (r.receipt_type === "AMC") {
          badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
          label = "AMC";
        } else if (r.receipt_type === "SERVICE") {
          badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
          label = "Service";
        }
        return (
          <div className="text-center">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap inline-block ${badgeColor}`}>
              {label}
            </span>
          </div>
        );
      },
      className: "whitespace-nowrap text-center",
    },
    {
      key: "customer_name",
      label: "Customer / Payer",
      render: (r) => (
        <span
          className="text-slate-900 font-semibold text-xs tracking-tight block max-w-[150px] truncate mx-auto cursor-pointer hover:text-sky-600"
          title={r.customer_name || r.payer_name || ""}
          onClick={() => handleViewPDF(r.id)}
        >
          {r.customer_name || r.payer_name || "-"}
        </span>
      ),
      className: "min-w-[120px] max-w-[160px] text-center",
    },
    {
      key: "payment_mode",
      label: "Payment Mode",
      render: (r) => (
        <span
          className="text-slate-700 text-xs font-medium whitespace-nowrap block text-center cursor-default uppercase"
          title={r.payment_mode || "CASH"}
        >
          {r.payment_mode || "CASH"}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "transaction_ref",
      label: "Txn / Ref No",
      render: (r) => (
        <span
          className="text-slate-600 text-xs font-mono block max-w-[120px] truncate mx-auto cursor-default"
          title={r.transaction_ref || "-"}
        >
          {r.transaction_ref || "-"}
        </span>
      ),
      className: "min-w-[100px] max-w-[130px] text-center",
    },
    {
      key: "amount",
      label: "Advance (₹)",
      render: (r) => (
        <span className="text-emerald-700 font-bold text-xs whitespace-nowrap block text-center">
          ₹{Number(r.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "balance_amount",
      label: "Balance (₹)",
      render: (r) => {
        const bal = Number(r.balance_amount || 0);
        return (
          <span
            className={`font-semibold text-xs whitespace-nowrap block text-center ${
              bal > 0 ? "text-rose-600" : "text-slate-600"
            }`}
          >
            ₹{bal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        );
      },
      className: "whitespace-nowrap text-center",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const isConfirmed = r.status === "CONFIRMED";
        const isCancelled = r.status === "CANCELLED";
        return (
          <div className="text-center">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap inline-block ${
                isConfirmed
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isCancelled
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {r.status || "CONFIRMED"}
            </span>
          </div>
        );
      },
      className: "whitespace-nowrap text-center",
    },
  ];

  // Actions renderer matching Lead.jsx
  const actionsRenderer = (row) => (
    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
      {/* View PDF */}
      <button
        type="button"
        onClick={() => handleViewPDF(row.id)}
        className="p-1 bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
        title="View Advance Receipt (PDF)"
      >
        <MdOutlineRemoveRedEye />
      </button>

      {/* Download PDF */}
      <button
        type="button"
        onClick={() => handleDownloadPDF(row.id, row.receipt_number)}
        className="p-1 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
        title="Download Receipt PDF"
      >
        <MdDownload />
      </button>

      {/* Edit Record */}
      <button
        type="button"
        onClick={() => {
          setEditingReceipt(row);
          setShowModal(true);
        }}
        className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
        title="Edit Record"
      >
        <MdEdit />
      </button>

      {/* Delete Record */}
      <button
        type="button"
        onClick={() => handleDelete(row.id, row.receipt_number)}
        className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
        title="Delete Record"
      >
        <MdDelete />
      </button>
    </div>
  );

  return (
    <Base title="">
      <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1">
        {/* HEADER BLOCK WITH THE BLUE VERTICAL ACCENT LINE (EXACT MATCHING Lead.jsx) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 pt-1">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-10 bg-sky-600 rounded-full block"></span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                Advance Payment Receipts
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading
                  ? "Synchronizing advance receipts..."
                  : `Total ${totalCount} records identified across channels`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search receipt, customer, txn ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 sm:w-60 pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 shadow-xs text-slate-700 placeholder-slate-400"
              />
            </div>

            {/* Filter Button */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="px-3 sm:px-4 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <MdFilterList className="text-slate-400" />
              Filter
            </button>

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-2.5 sm:px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Export Advance Receipts to Excel"
            >
              <MdDownload className="text-emerald-600 text-sm" />
              Export
            </button>

            {/* Sync Refresh */}
            <button
              type="button"
              onClick={fetchData}
              className="p-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-xs flex items-center justify-center cursor-pointer"
              title="Refresh Advance Receipts"
            >
              <MdRefresh className={`text-base ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* + Add Advance Receipt */}
            <button
              type="button"
              onClick={() => {
                setEditingReceipt(null);
                setShowModal(true);
              }}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Advance Receipt</span>
            </button>
          </div>
        </div>

        {/* ERROR NOTIFICATION */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchData}
              className="text-xs font-semibold underline hover:no-underline ml-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* DATA TABLE (MATCHING Lead.jsx ROW HEIGHT & TableView) */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <TableView
            columns={columns}
            rows={currentPageData}
            actions={actionsRenderer}
            loading={loading}
            error={error}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
            pageSize={itemsPerPage}
            emptyMessage={
              searchTerm || filteredReceipts.length !== receipts.length
                ? "No advance payment receipts match your search criteria"
                : "No advance payment receipts created yet. Click '+ Add Advance Receipt' to issue one."
            }
          />
        </div>

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
                    data={receipts}
                    onFilter={setFilteredData}
                    setItemsPerPage={setItemsPerPage}
                    columns={columns}
                  />
                </div>
              </div>
            </>,
            document.body
          )}

        {/* ADD / EDIT ADVANCE RECEIPT MODAL */}
        <AddAdvancePaymentReceiptModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingReceipt(null);
            if (searchParams.get("create")) {
              setSearchParams({});
            }
          }}
          onSuccess={() => {
            fetchData();
            setShowModal(false);
            setEditingReceipt(null);
          }}
          isEdit={Boolean(editingReceipt)}
          receiptData={editingReceipt}
          receiptId={editingReceipt?.id}
        />
      </div>
    </Base>
  );
}
