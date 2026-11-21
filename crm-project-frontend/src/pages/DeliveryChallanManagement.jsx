import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import Base from "../components/Base";
import TableView from "../components/TableView";
import AddDeliveryChallanModal from "../components/invoice/AddDeliveryChallanModal";
import AdvancedTableFilter from "../components/AdvancedTableFilter";
import {
  MdEdit,
  MdDelete,
  MdOutlineRemoveRedEye,
  MdDownload,
  MdFilterList,
  MdRefresh,
  MdLocalShipping,
  MdCheckCircle,
  MdPendingActions,
} from "react-icons/md";
import { Search } from "lucide-react";
import Swal from "sweetalert2";
import { exportToExcel, formatExcelDate } from "../utils/excelExport";
import { getBaseApiUrl } from "../utils/apiConfig";

export default function DeliveryChallanManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const BASE_API = getBaseApiUrl();

  // Data states
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal & Edit state
  const [showModal, setShowModal] = useState(false);
  const [editingChallan, setEditingChallan] = useState(null);

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

  // Fetch Delivery Challans
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_API}/invoice/delivery-challans/?limit=1000`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.results || [];
      setChallans(list);
      setFilteredData(list);
    } catch (err) {
      console.error("Error fetching Delivery Challans:", err);
      setError(err.message || "Failed to load delivery challan records");
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
      setEditingChallan(null);
      setShowModal(true);
    }
  }, [searchParams]);

  // Filtered dataset
  const filteredChallans = useMemo(() => {
    let base = filteredData.length > 0 || challans.length === 0 ? filteredData : challans;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      return base.filter((c) => {
        return (
          (c.challan_number && c.challan_number.toLowerCase().includes(searchLower)) ||
          (c.bill_to_name && c.bill_to_name.toLowerCase().includes(searchLower)) ||
          (c.bill_to_contact && c.bill_to_contact.toLowerCase().includes(searchLower)) ||
          (c.ship_to_name && c.ship_to_name.toLowerCase().includes(searchLower)) ||
          (c.ship_to_address && c.ship_to_address.toLowerCase().includes(searchLower)) ||
          (c.vehicle_number && c.vehicle_number.toLowerCase().includes(searchLower)) ||
          (c.po_number && c.po_number.toLowerCase().includes(searchLower)) ||
          (c.project_code && c.project_code.toLowerCase().includes(searchLower))
        );
      });
    }
    return base;
  }, [challans, filteredData, searchTerm]);

  // Pagination calculation
  const totalCount = filteredChallans.length;
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const currentPageData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredChallans.slice(start, start + itemsPerPage);
  }, [filteredChallans, currentPage, itemsPerPage]);

  // View PDF Inline (opens in browser PDF viewer tab matching Bill of Supply)
  const handleViewPDF = async (id) => {
    const token =
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "";

    Swal.fire({
      title: "Opening Delivery Challan...",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0;">
          <div style="width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top: 4px solid #0284c7; border-radius: 50%; animation: spinChallan 0.9s linear infinite; margin-bottom: 12px;"></div>
          <p style="font-size: 13px; color: #475569; margin: 0; font-weight: 500;">Generating Delivery Challan PDF...</p>
        </div>
        <style>
          @keyframes spinChallan { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
    });

    try {
      const url = `${BASE_API}/invoice/delivery-challans/${id}/pdf/?disposition=inline`;
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
        text: "Failed to render Delivery Challan PDF.",
      });
    }
  };

  // Download PDF
  const handleDownloadPDF = async (id, num) => {
    Swal.fire({
      title: "Downloading Challan PDF...",
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
      const url = `${BASE_API}/invoice/delivery-challans/${id}/pdf/?disposition=attachment`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const file = new Blob([blob], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = `Delivery_Challan_${num || id}.pdf`;
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
        text: err.message || "Failed to download Delivery Challan PDF",
      });
    }
  };

  // Delete Challan
  const handleDelete = (id, num) => {
    Swal.fire({
      title: "Delete Delivery Challan?",
      text: `Are you sure you want to permanently delete Delivery Challan #${num}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`${BASE_API}/invoice/delivery-challans/${id}/`, {
            method: "DELETE",
            headers: getHeaders(),
          });
          if (!res.ok) throw new Error("Delete failed");
          Swal.fire("Deleted!", `Challan #${num} has been deleted.`, "success");
          fetchData();
        } catch {
          Swal.fire("Error", "Could not delete delivery challan", "error");
        }
      }
    });
  };

  // Export to Excel matching Lead.jsx
  const handleExportExcel = () => {
    const dataToExport = filteredChallans && filteredChallans.length > 0 ? filteredChallans : challans;
    const formatted = dataToExport.map((c, idx) => ({
      "Sr No": idx + 1,
      "Challan Number": c.challan_number || "-",
      "Challan Date": formatExcelDate(c.challan_date),
      "Source Type": c.challan_type || "-",
      "Customer / Bill To": c.bill_to_name || "-",
      "Contact Person": c.bill_to_contact_person || "-",
      "Contact Number": c.bill_to_contact || "-",
      "Billing State": c.bill_to_state || "-",
      "Consignee / Ship To": c.ship_to_name || c.bill_to_name || "-",
      "Site Delivery Address": c.ship_to_address || "-",
      "Transport Mode": c.transport_mode || "-",
      "Vehicle Number": c.vehicle_number || "-",
      "LR / Docket No": c.lr_rr_number || "-",
      "PO / Ref Number": c.po_number || "-",
      "Total Quantity": parseFloat(c.total_quantity || 0),
      "Declared Value (₹)": parseFloat(c.grand_total || 0),
      "Delivery Status": c.status || "-",
      "Created At": formatExcelDate(c.created_at),
    }));

    exportToExcel({
      data: formatted,
      fileName: "Delivery_Challans",
      sheetName: "Challans",
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
      key: "challan_number",
      label: "Challan No",
      render: (r) => (
        <span
          className="text-sky-600 font-bold text-xs whitespace-nowrap cursor-pointer hover:underline block text-center font-mono"
          onClick={() => handleViewPDF(r.id)}
          title="Click to view Delivery Challan PDF"
        >
          #{r.challan_number}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "challan_date",
      label: "Date",
      render: (r) => (
        <span className="text-slate-600 text-xs whitespace-nowrap block text-center">
          {r.challan_date || "-"}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "challan_type",
      label: "Source",
      render: (r) => {
        let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
        let label = "Direct";
        if (r.challan_type === "PROJECT") {
          badgeColor = "bg-sky-50 text-sky-700 border-sky-200";
          label = "Project";
        } else if (r.challan_type === "AMC") {
          badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
          label = "AMC";
        } else if (r.challan_type === "SERVICE") {
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
      key: "bill_to_name",
      label: "Customer / Client",
      render: (r) => (
        <span
          className="text-slate-900 font-semibold text-xs tracking-tight block max-w-[150px] truncate mx-auto cursor-pointer hover:text-sky-600"
          title={r.bill_to_name || ""}
          onClick={() => handleViewPDF(r.id)}
        >
          {r.bill_to_name || "-"}
        </span>
      ),
      className: "min-w-[120px] max-w-[160px] text-center",
    },
    {
      key: "ship_to_address",
      label: "Consignee / Site Address",
      render: (r) => (
        <span
          className="text-slate-700 text-xs block max-w-[150px] truncate mx-auto cursor-default"
          title={r.ship_to_address || r.ship_to_name || r.bill_to_name || ""}
        >
          {r.ship_to_address || r.ship_to_name || r.bill_to_name || "-"}
        </span>
      ),
      className: "min-w-[120px] max-w-[160px] text-center",
    },
    {
      key: "transport_mode",
      label: "Transport & Vehicle No",
      render: (r) => (
        <span
          className="text-slate-700 text-xs font-medium whitespace-nowrap block text-center cursor-default"
          title={r.vehicle_number ? `${r.transport_mode || 'Road'} - ${r.vehicle_number}` : (r.transport_mode || 'Road')}
        >
          {r.vehicle_number ? `${r.transport_mode || 'Road'} (${r.vehicle_number})` : (r.transport_mode || "Road")}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "total_quantity",
      label: "Total Qty",
      render: (r) => (
        <span className="text-slate-800 font-semibold text-xs whitespace-nowrap block text-center">
          {parseFloat(r.total_quantity || 0)}
        </span>
      ),
      className: "whitespace-nowrap text-center",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const isDelivered = r.status === "DELIVERED";
        const isTransit = r.status === "IN_TRANSIT";
        return (
          <div className="text-center">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap inline-block ${
                isDelivered
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isTransit
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {isDelivered ? "Delivered" : isTransit ? "In Transit" : r.status || "Pending"}
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
      {/* View Document */}
      <button
        type="button"
        onClick={() => handleViewPDF(row.id)}
        className="p-1 bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
        title="View Delivery Challan (PDF)"
      >
        <MdOutlineRemoveRedEye />
      </button>

      {/* Download PDF */}
      <button
        type="button"
        onClick={() => handleDownloadPDF(row.id, row.challan_number)}
        className="p-1 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 rounded transition-all duration-150 text-sm shadow-sm cursor-pointer"
        title="Download Challan PDF"
      >
        <MdDownload />
      </button>

      {/* Edit Record */}
      <button
        type="button"
        onClick={() => {
          setEditingChallan(row);
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
        onClick={() => handleDelete(row.id, row.challan_number)}
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
                Delivery Challan Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading
                  ? "Synchronizing delivery records..."
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
                placeholder="Search challan, client, vehicle..."
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
              title="Export Delivery Challans to Excel"
            >
              <MdDownload className="text-emerald-600 text-sm" />
              Export
            </button>

            {/* Sync Refresh */}
            <button
              type="button"
              onClick={fetchData}
              className="p-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-xs flex items-center justify-center cursor-pointer"
              title="Refresh Records"
            >
              <MdRefresh size={16} className={loading ? "animate-spin" : ""} />
            </button>

            {/* + Add Delivery Challan Button */}
            <button
              type="button"
              onClick={() => {
                setEditingChallan(null);
                setShowModal(true);
              }}
              className="px-3 sm:px-4 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>+</span> Add Delivery Challan
            </button>
          </div>
        </div>

        {/* COMPACT DATA TABLE COMPONENT (EXACT MATCHING Lead.jsx) */}
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
            emptyMessage="No delivery challan records match the active criteria filters"
          />
        </div>
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
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                <AdvancedTableFilter
                  data={challans}
                  onFilter={setFilteredData}
                  setItemsPerPage={setItemsPerPage}
                  columns={columns}
                />
              </div>
            </div>
          </>,
          document.body
        )}

      {/* ADD / EDIT DELIVERY CHALLAN MODAL */}
      {showModal && (
        <AddDeliveryChallanModal
          key={editingChallan ? `edit-${editingChallan.id}` : `new-${Date.now()}`}
          isOpen={showModal}
          challanId={editingChallan?.id}
          initialData={editingChallan}
          onClose={() => {
            setShowModal(false);
            setEditingChallan(null);
            if (searchParams.get("create")) {
              const p = new URLSearchParams(searchParams);
              p.delete("create");
              setSearchParams(p, { replace: true });
            }
          }}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}
    </Base>
  );
}
