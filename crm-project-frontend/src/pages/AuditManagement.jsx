import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdDelete,
  MdDeleteForever,
  MdFilterList,
  MdHistory,
  MdOutlineAccessTime,
  MdOutlineLayers,
  MdOutlineRemoveRedEye,
  MdRefresh,
  MdRestore,
  MdSave,
  MdZoomIn,
} from "react-icons/md";
import Swal from "sweetalert2";
import AdvancedTableFilter from "../components/AdvancedTableFilter";
import Base from "../components/Base";
import RecordViewer from "../components/RecordViewer";
import TableView from "../components/TableView";
import { useUserRole } from "../hooks/useAuth";
import { getBaseApiUrl } from "../utils/apiConfig";

const MODULE_OPTIONS = [
  "ALL",
  "Leads",
  "Lead Follow-ups",
  "Customers",
  "Projects",
  "Quotations",
  "AMC Contracts",
  "AMC Services",
  "AMC Visits",
  "Invoices",
  "Bill of Supply",
  "Delivery Challans",
  "Advance Receipts",
  "Products",
  "Categories",
  "Vendors",
  "Inventory Items",
  "Purchase Orders",
  "GRNs",
  "Staff / Users",
  "Roles",
  "Branches",
  "Sites",
  "Terms & Conditions",
  "Billing Details",
  "Message Templates",
];

function getAuthHeaders() {
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
}

function formatDate(dateString) {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${day}-${month}-${year} ${h12}:${mins} ${ampm}`;
  } catch {
    return String(dateString);
  }
}

function formatNumber(num) {
  return String(num || 0).padStart(2, "0");
}

function formatTimeRemaining(record) {
  if (record.is_restored) {
    return "Restored";
  }
  const hrs = Number(record.hours_remaining ?? 0);
  if (hrs <= 0) return "Expiring";
  if (hrs < 24) return `${hrs}h left`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d left`;
}

export default function AuditManagement() {
  const baseApi = getBaseApiUrl();
  const { hasPermission } = useUserRole(baseApi);

  const canRestore = hasPermission("audit", "edit") || hasPermission("audit", "create");
  const canDelete = hasPermission("audit", "delete");

  const [activeTab, setActiveTab] = useState("deleted"); // "deleted" | "restored"
  const [allRows, setAllRows] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [retentionInput, setRetentionInput] = useState("30");
  const [savedRetentionDays, setSavedRetentionDays] = useState(30);
  const [savingSettings, setSavingSettings] = useState(false);

  const [summary, setSummary] = useState({
    retention_days: 30,
    active_deleted_count: 0,
    restored_count: 0,
    expiring_within_24h: 0,
    modules: [],
  });

  // Dropdown & Drawer Filters matching AMC.jsx
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [showModuleDropdown, setShowModuleDropdown] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Expanded Row & Record Viewer
  const [openRow, setOpenRow] = useState(null);
  const [expandedDetailMap, setExpandedDetailMap] = useState({});
  const [loadingExpandId, setLoadingExpandId] = useState(null);

  const [recordViewerOpen, setRecordViewerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const fetchAuditData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const headers = getAuthHeaders();
    try {
      const isRestoredParam = activeTab === "restored" ? "true" : "false";
      const params = new URLSearchParams({ is_restored: isRestoredParam });

      const [listRes, summaryRes, settingsRes] = await Promise.all([
        fetch(`${baseApi}/api/audit/deleted-records/?${params.toString()}`, { headers }),
        fetch(`${baseApi}/api/audit/deleted-records/summary/`, { headers }),
        fetch(`${baseApi}/api/audit/settings/`, { headers }),
      ]);

      if (!listRes.ok) {
        const errBody = await listRes.json().catch(() => ({}));
        throw new Error(errBody.detail || `Failed to load audit records (HTTP ${listRes.status})`);
      }

      const listData = await listRes.json();
      const rawList = Array.isArray(listData) ? listData : listData.results || [];
      const normalized = rawList.map((r) => ({
        ...r,
        summary_text: Object.entries(r.summary_fields || {})
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" • ") || "-",
      }));

      setAllRows(normalized);
      setFilteredData(normalized);

      if (summaryRes.ok) {
        const sumData = await summaryRes.json();
        setSummary(sumData);
      }
      if (settingsRes.ok) {
        const stData = await settingsRes.json();
        const days = Number(stData.retention_days || 30);
        setSavedRetentionDays(days);
        setRetentionInput(String(days));
      }
    } catch (err) {
      setError(err.message || "Failed to load Audit & Deleted Data");
      setAllRows([]);
      setFilteredData([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [baseApi, activeTab]);

  useEffect(() => {
    fetchAuditData();
  }, [fetchAuditData]);

  useEffect(() => {
    let result = filteredData;
    if (moduleFilter && moduleFilter !== "ALL") {
      result = filteredData.filter((r) => r.module_label === moduleFilter);
    }
    setRows(result);
    setCurrentPage(1);
  }, [filteredData, moduleFilter]);

  const handleToggleExpand = useCallback(
    async (row) => {
      if (openRow === row.id) {
        setOpenRow(null);
        return;
      }
      setOpenRow(row.id);
      if (expandedDetailMap[row.id]) return;

      setLoadingExpandId(row.id);
      try {
        const res = await fetch(`${baseApi}/api/audit/deleted-records/${row.id}/`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const detail = await res.json();
          setExpandedDetailMap((prev) => ({ ...prev, [row.id]: detail }));
        }
      } catch (err) {
        console.error("Snapshot fetch error:", err);
      } finally {
        setLoadingExpandId(null);
      }
    },
    [openRow, expandedDetailMap, baseApi]
  );

  const handleOpenRecordViewer = async (row) => {
    let detail = expandedDetailMap[row.id] || row;
    if (!detail.data) {
      try {
        const res = await fetch(`${baseApi}/api/audit/deleted-records/${row.id}/`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          detail = await res.json();
          setExpandedDetailMap((prev) => ({ ...prev, [row.id]: detail }));
        }
      } catch {
        // fall back to list row
      }
    }
    setSelectedRecord({
      ...detail,
      ...(detail.data?.fields ? { captured_fields: detail.data.fields } : {}),
    });
    setRecordViewerOpen(true);
  };

  const handleSaveRetention = async () => {
    const parsed = parseInt(retentionInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3650) {
      Swal.fire({
        icon: "warning",
        title: "Invalid Retention Days",
        text: "Please enter a valid number of days between 1 and 3650.",
      });
      return;
    }

    setSavingSettings(true);
    try {
      const res = await fetch(`${baseApi}/api/audit/settings/`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ retention_days: parsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.retention_days?.[0] || "Failed to update retention period");
      }

      setSavedRetentionDays(Number(data.retention_days || parsed));
      setRetentionInput(String(data.retention_days || parsed));
      const purgedMsg =
        data.purged_count > 0
          ? ` ${data.purged_count} expired deleted record(s) older than ${parsed} day(s) were cleared.`
          : "";

      Swal.fire({
        icon: "success",
        title: "Retention Updated",
        text: `Deleted data will stay here for ${parsed} day(s) before disappearing automatically.${purgedMsg}`,
        timer: 2500,
        showConfirmButton: false,
      });

      fetchAuditData();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err.message || "Could not update retention policy.",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRestore = async (row) => {
    const childNote =
      row.related_count > 0
        ? ` along with ${row.related_count} linked child item(s)`
        : "";

    const confirm = await Swal.fire({
      title: "Restore Deleted Data?",
      html: `Restore <b>${row.object_repr}</b> (${row.module_label})${childNote}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Restore",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#64748b",
    });

    if (!confirm.isConfirmed) return;

    setRestoringId(row.id);
    try {
      const res = await fetch(`${baseApi}/api/audit/deleted-records/${row.id}/restore/`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Restore failed (HTTP ${res.status})`);
      }

      Swal.fire({
        icon: "success",
        title: "Restored",
        text: data.message || `'${row.object_repr}' restored successfully.`,
        timer: 2200,
        showConfirmButton: false,
      });
      setOpenRow(null);
      fetchAuditData();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Cannot Restore",
        text: err.message || "Restore failed.",
      });
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (row) => {
    const confirm = await Swal.fire({
      title: "Delete Permanently?",
      text: `"${row.object_repr}" will be permanently removed and cannot be restored afterwards.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`${baseApi}/api/audit/deleted-records/${row.id}/`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Permanent delete failed");
      }
      Swal.fire({
        icon: "success",
        title: "Deleted",
        timer: 1600,
        showConfirmButton: false,
      });
      fetchAuditData();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: err.message,
      });
    }
  };

  const handleEmptyBin = async () => {
    const confirm = await Swal.fire({
      title: "Empty Audit Recycle Bin?",
      text: `This will permanently delete all ${summary.active_deleted_count} un-restored record(s). This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Empty Bin",
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`${baseApi}/api/audit/deleted-records/empty-trash/`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Failed to empty bin");
      Swal.fire({
        icon: "success",
        title: "Bin Emptied",
        text: data.message || "All deleted records removed.",
        timer: 2000,
        showConfirmButton: false,
      });
      fetchAuditData();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    }
  };

  const availableModules = useMemo(() => {
    const fromSummary = (summary.modules || []).map((m) => m.module_label);
    return Array.from(new Set(["ALL", ...fromSummary, ...MODULE_OPTIONS.slice(1)]));
  }, [summary.modules]);

  const totalPages = Math.max(1, Math.ceil(rows.length / itemsPerPage));
  const getCurrentPageData = () => {
    const start = (currentPage - 1) * itemsPerPage;
    return rows.slice(start, start + itemsPerPage);
  };

  const getRowClassName = (row) => {
    if (!row.is_restored && Number(row.hours_remaining ?? 0) <= 24) {
      return "bg-yellow-100/60";
    }
    return "";
  };

  const getStatusBadge = (row) => {
    if (row.is_restored) {
      return (
        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Restored
        </span>
      );
    }
    const hrs = Number(row.hours_remaining ?? 0);
    if (hrs <= 24) {
      return (
        <span className="px-2.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
          {formatTimeRemaining(row)}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 bg-sky-100 text-sky-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
        {formatTimeRemaining(row)}
      </span>
    );
  };

  const columns = [
    {
      key: "sr",
      label: "Sr.No",
      render: (_, idx) => (
        <span className="text-slate-600 font-medium text-xs py-0 whitespace-nowrap block">
          {(currentPage - 1) * itemsPerPage + (idx + 1)}
        </span>
      ),
      className: "w-14 whitespace-nowrap",
    },
    {
      key: "object_id",
      label: "Ref ID",
      render: (r) => (
        <span className="font-mono font-bold text-blue-600 text-xs py-0 block whitespace-nowrap">
          #{r.object_id}
        </span>
      ),
      className: "w-24 whitespace-nowrap",
    },
    {
      key: "module_label",
      label: "Module",
      render: (r) => (
        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
          {r.module_label}
        </span>
      ),
      className: "w-32 whitespace-nowrap",
    },
    {
      key: "object_repr",
      label: "Deleted Record",
      render: (r) => (
        <span
          className="text-slate-900 font-semibold text-xs py-0 block max-w-[190px] truncate mx-auto cursor-default"
          title={r.object_repr}
        >
          {r.object_repr}
        </span>
      ),
      className: "min-w-[160px] max-w-[200px]",
    },
    {
      key: "summary_text",
      label: "Details",
      render: (r) => (
        <span
          className="text-slate-600 text-xs py-0 block max-w-[210px] truncate mx-auto cursor-default"
          title={r.summary_text}
        >
          {r.summary_text}
        </span>
      ),
      className: "min-w-[160px] max-w-[220px]",
    },
    {
      key: "related_count",
      label: "Linked Items",
      render: (r) =>
        r.related_count > 0 ? (
          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-bold whitespace-nowrap">
            +{r.related_count} child{r.related_count > 1 ? "ren" : ""}
          </span>
        ) : (
          <span className="text-slate-400 text-xs py-0 block">—</span>
        ),
      className: "w-28 whitespace-nowrap",
    },
    {
      key: "deleted_by_name",
      label: "Deleted By",
      render: (r) => (
        <span
          className="text-slate-700 text-xs py-0 block max-w-[120px] truncate mx-auto"
          title={r.deleted_by_name || "System"}
        >
          {r.deleted_by_name || "System"}
        </span>
      ),
      className: "w-32 whitespace-nowrap",
    },
    {
      key: "deleted_at",
      label: activeTab === "restored" ? "Restored On" : "Deleted On",
      render: (r) => (
        <span className="text-slate-600 text-xs py-0 block whitespace-nowrap">
          {formatDate(activeTab === "restored" ? r.restored_at : r.deleted_at)}
        </span>
      ),
      className: "w-40 whitespace-nowrap",
    },
    {
      key: "retention",
      label: activeTab === "restored" ? "Status" : "Expires In",
      render: (r) => getStatusBadge(r),
      className: "w-28 text-center whitespace-nowrap",
    },
  ];

  const actionsRenderer = (row) => (
    <div className="flex items-center justify-center gap-1.5 py-0 whitespace-nowrap">
      {/* Expand Inline Snapshot & Cascade Child Items */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleToggleExpand(row);
        }}
        className={`p-1 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer ${
          openRow === row.id
            ? "bg-purple-600 text-white"
            : "bg-purple-50 hover:bg-purple-100 text-purple-600"
        }`}
        title="Inspect Snapshot & Linked Child Items"
      >
        <MdOutlineLayers size={16} />
      </button>

      {/* Restore Button */}
      {!row.is_restored && canRestore && (
        <button
          onClick={() => handleRestore(row)}
          disabled={restoringId === row.id}
          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded transition-all duration-150 text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1 disabled:opacity-60"
          title="Restore Deleted Data"
        >
          <MdRestore size={15} />
          <span>{restoringId === row.id ? "..." : "Restore"}</span>
        </button>
      )}

      {/* Full Record Viewer Button */}
      <button
        onClick={() => handleOpenRecordViewer(row)}
        className="p-1 bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer"
        title="View Full Snapshot Record"
      >
        <MdZoomIn />
      </button>

      {/* Inspect Details */}
      <button
        onClick={() => handleToggleExpand(row)}
        className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer"
        title="View Snapshot Details"
      >
        <MdOutlineRemoveRedEye />
      </button>

      {/* Permanent Delete Button */}
      {canDelete && (
        <button
          onClick={() => handlePermanentDelete(row)}
          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded transition-all duration-150 text-sm shadow-xs cursor-pointer"
          title="Delete Permanently"
        >
          <MdDelete />
        </button>
      )}
    </div>
  );

  const renderExpandedRow = useCallback(
    (row) => {
      if (openRow !== row.id) return null;
      const detail = expandedDetailMap[row.id] || row;
      const fields = detail.data?.fields || {};
      const children = detail.related_objects || [];
      const isLoadingDetail = loadingExpandId === row.id;

      return (
        <tr className="bg-slate-50/70 border-b">
          <td colSpan={10} className="p-4">
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-3 text-left">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-purple-100 text-purple-700 rounded-md">
                    <MdOutlineLayers className="text-base" />
                  </span>
                  <h4 className="font-bold text-xs text-slate-800">
                    Archived Snapshot — {row.module_label} #{row.object_id} ({children.length} linked item
                    {children.length !== 1 ? "s" : ""})
                  </h4>
                </div>

                {!row.is_restored && canRestore && (
                  <button
                    onClick={() => handleRestore(row)}
                    disabled={restoringId === row.id}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-60"
                  >
                    <MdRestore className="text-sm" />
                    {restoringId === row.id ? "Restoring..." : "Restore Record Now"}
                  </button>
                )}
              </div>

              {isLoadingDetail ? (
                <p className="text-xs text-slate-400 italic py-2">Loading full archived snapshot...</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {Object.entries(fields).map(([k, v]) => (
                      <div key={k} className="bg-slate-50/80 rounded-lg border border-slate-200/70 px-2.5 py-1.5">
                        <span className="text-[10px] font-mono text-slate-400 block truncate">{k}</span>
                        <span className="text-xs font-semibold text-slate-800 block truncate" title={String(v ?? "-")}>
                          {v === null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {children.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Cascade Child Items Included ({children.length})
                      </span>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100/70 text-slate-500 font-semibold text-[10px] uppercase">
                            <tr>
                              <th className="py-1.5 px-3">Type</th>
                              <th className="py-1.5 px-3">ID</th>
                              <th className="py-1.5 px-3">Record</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {children.map((child, idx) => (
                              <tr key={`${child.model_name}-${child.pk}-${idx}`} className="hover:bg-slate-50/50">
                                <td className="py-1.5 px-3 font-bold text-purple-700">
                                  <span className="px-2 py-0.5 bg-purple-50 rounded text-[10px]">
                                    {child.model_verbose || child.model_name}
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 font-mono text-slate-600">#{child.pk}</td>
                                <td className="py-1.5 px-3 text-slate-800 font-medium">{child.repr}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>
      );
    },
    [openRow, expandedDetailMap, loadingExpandId, canRestore, restoringId]
  );

  return (
    <Base title="">
      <div className="w-full space-y-4 font-sans antialiased text-slate-800 pt-1 sm:pt-2 px-1">
        {/* PAGE HEADER MATCHING AMC CONTRACTS */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 pt-1">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-10 bg-sky-600 rounded-full block"></span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                Audit &amp; Deleted Data
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading
                  ? "Synchronizing audit records..."
                  : activeTab === "deleted"
                  ? `Total ${rows.length} deleted record${rows.length === 1 ? "" : "s"} in recycle bin`
                  : `Total ${rows.length} restored record${rows.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Module Quick Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowModuleDropdown(!showModuleDropdown)}
                className="px-2.5 sm:px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <MdFilterList className="text-slate-400 text-sm" />
                <span>{moduleFilter === "ALL" ? "All Modules" : moduleFilter}</span>
              </button>

              {showModuleDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-20 cursor-default"
                    onClick={() => setShowModuleDropdown(false)}
                  />
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-52 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs">
                    {availableModules.map((mod) => (
                      <button
                        key={mod}
                        onClick={() => {
                          setModuleFilter(mod);
                          setShowModuleDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer ${
                          moduleFilter === mod ? "font-medium text-blue-600 bg-blue-50" : "text-slate-700"
                        }`}
                      >
                        <span>{mod === "ALL" ? "All Modules" : mod}</span>
                        {moduleFilter === mod && <span className="text-blue-600 font-bold">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Slide-out Advanced Filter Drawer Button */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className="px-2.5 sm:px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <MdFilterList className="text-slate-400 text-sm" />
              Filter
            </button>

            {/* Deleted Data / Restored History Segmented Toggle matching AMC Table/Calendar */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
              <button
                onClick={() => {
                  setOpenRow(null);
                  setActiveTab("deleted");
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "deleted"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <MdDelete className="text-sm" />
                <span>Deleted</span>
              </button>
              <button
                onClick={() => {
                  setOpenRow(null);
                  setActiveTab("restored");
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "restored"
                    ? "bg-sky-600 text-white shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <MdHistory className="text-sm" />
                <span>Restored</span>
              </button>
            </div>

            <button
              onClick={fetchAuditData}
              className="px-2.5 sm:px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <MdRefresh className="text-sm text-slate-500" />
              <span>Refresh</span>
            </button>

            {activeTab === "deleted" && canDelete && summary.active_deleted_count > 0 && (
              <button
                onClick={handleEmptyBin}
                className="px-3 sm:px-3.5 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <MdDeleteForever className="text-sm" />
                Empty Bin
              </button>
            )}
          </div>
        </div>

        {/* TOP RETENTION POLICY BAR */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <MdOutlineAccessTime size={19} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                Deleted Data Retention Policy (Days)
              </span>
              <p className="text-xs text-slate-700 mt-0.5">
                Deleted items stay here for{" "}
                <span className="font-bold text-sky-700">
                  {savedRetentionDays} day{savedRetentionDays === 1 ? "" : "s"}
                </span>{" "}
                from deletion and disappear automatically after {savedRetentionDays} day
                {savedRetentionDays === 1 ? "" : "s"}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {[1, 7, 15, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setRetentionInput(String(d))}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                    Number(retentionInput) === d
                      ? "bg-white text-sky-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={3650}
                value={retentionInput}
                onChange={(e) => setRetentionInput(e.target.value)}
                disabled={!canRestore || savingSettings}
                aria-label="Retention Days"
                className="w-20 px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <span className="text-xs text-slate-500 font-medium">days</span>
            </div>

            {canRestore && (
              <button
                type="button"
                onClick={handleSaveRetention}
                disabled={savingSettings}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <MdSave className="text-sm" />
                {savingSettings ? "Saving..." : "Save Retention"}
              </button>
            )}
          </div>
        </div>

        {/* 4 SUMMARY STAT CARDS MATCHING AMC CONTRACTS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Deleted Records
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-slate-900 block mt-0.5">
              {formatNumber(summary.active_deleted_count)} in bin
            </span>
            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
              Available for restore
            </span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Expiring Within 24h
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-amber-700 block mt-0.5">
              {formatNumber(summary.expiring_within_24h)} expiring
            </span>
            <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
              Auto-clears at expiry
            </span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Restored Data
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-emerald-700 block mt-0.5">
              {formatNumber(summary.restored_count)} restored
            </span>
            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
              Successfully recovered
            </span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
              Retention Window
            </span>
            <span className="text-xs sm:text-[13px] font-bold text-sky-700 block mt-0.5">
              {formatNumber(savedRetentionDays)} day{savedRetentionDays === 1 ? "" : "s"}
            </span>
            <span className="text-[10px] text-sky-600 font-medium block mt-0.5">
              Active auto-expiry rule
            </span>
          </div>
        </div>

        {/* TABLE VIEW (DESKTOP) + RESPONSIVE CARD VIEW (MOBILE) */}
        <div className="hidden sm:block bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <TableView
            columns={columns}
            rows={getCurrentPageData()}
            loading={loading}
            error={error}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
            pageSize={itemsPerPage}
            actions={actionsRenderer}
            rowClassName={getRowClassName}
            renderExpandedRow={renderExpandedRow}
            emptyMessage={
              activeTab === "deleted"
                ? "No deleted records matched the active criteria"
                : "No restored records found yet"
            }
          />
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="sm:hidden space-y-2.5">
          {loading ? (
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 text-center text-xs text-slate-500">
              Synchronizing audit records...
            </div>
          ) : error ? (
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 text-center text-xs text-rose-600">
              {error}
            </div>
          ) : getCurrentPageData().length === 0 ? (
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 text-center text-xs text-slate-500">
              {activeTab === "deleted"
                ? "No deleted records in recycle bin."
                : "No restored records found."}
            </div>
          ) : (
            getCurrentPageData().map((row) => (
              <div
                key={row.id}
                className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-mono font-bold text-blue-600 text-[11px]">
                        #{row.object_id}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold uppercase">
                        {row.module_label}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 break-words">
                      {row.object_repr}
                    </h3>
                  </div>
                  {getStatusBadge(row)}
                </div>

                {row.summary_text && row.summary_text !== "-" && (
                  <p className="text-[11px] text-slate-600 break-words">{row.summary_text}</p>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                  <span>By: {row.deleted_by_name || "System"}</span>
                  <span>{formatDate(activeTab === "restored" ? row.restored_at : row.deleted_at)}</span>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    onClick={() => handleOpenRecordViewer(row)}
                    className="p-1.5 bg-slate-100 text-slate-600 rounded text-xs"
                    title="View Full Snapshot"
                  >
                    <MdZoomIn />
                  </button>
                  {!row.is_restored && canRestore && (
                    <button
                      onClick={() => handleRestore(row)}
                      disabled={restoringId === row.id}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold flex items-center gap-1"
                    >
                      <MdRestore size={14} />
                      Restore
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handlePermanentDelete(row)}
                      className="p-1.5 bg-rose-50 text-rose-600 rounded text-xs"
                      title="Delete Permanently"
                    >
                      <MdDelete />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FILTER DRAWER MATCHING AMC CONTRACTS */}
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
                  data={allRows}
                  onFilter={setFilteredData}
                  setItemsPerPage={setItemsPerPage}
                  columns={columns}
                />
              </div>
            </div>
          </>,
          document.body
        )}

      <RecordViewer
        isOpen={recordViewerOpen}
        onClose={() => {
          setRecordViewerOpen(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
        title="Deleted Record Snapshot"
      />
    </Base>
  );
}
