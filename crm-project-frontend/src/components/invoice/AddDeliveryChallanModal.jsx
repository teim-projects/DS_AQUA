import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { State, City } from "country-state-city";
import { RxCross2 } from "react-icons/rx";
import {
  MdRefresh,
  MdAdd,
  MdDelete,
  MdInventory2,
  MdLocalShipping,
  MdSearch,
} from "react-icons/md";
import {
  Briefcase,
  ShieldAlert,
  Wrench,
  UserCheck,
  Plus,
} from "lucide-react";
import Swal from "sweetalert2";
import { getBaseApiUrl } from "../../utils/apiConfig";
import QuotationTermsSelector from "../terms_conditions/QuotationTermsSelector";

function numberToIndianWords(num) {
  if (num === null || num === undefined || isNaN(num) || num === 0) {
    return "Zero Rupees only";
  }
  const n = Math.round(Math.abs(num));
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function formatHundreds(val) {
    let str = "";
    if (val > 99) {
      str += a[Math.floor(val / 100)] + " Hundred ";
      val %= 100;
    }
    if (val > 19) {
      str += b[Math.floor(val / 10)] + (val % 10 > 0 ? " " + a[val % 10] : "");
    } else if (val > 0) {
      str += a[val];
    }
    return str.trim();
  }

  let words = "";
  const crores = Math.floor(n / 10000000);
  let rem = n % 10000000;
  const lakhs = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;
  const hundreds = rem;

  if (crores > 0) words += formatHundreds(crores) + " Crore ";
  if (lakhs > 0) words += formatHundreds(lakhs) + " Lakh ";
  if (thousands > 0) words += formatHundreds(thousands) + " Thousand ";
  if (hundreds > 0) words += formatHundreds(hundreds);

  return words.trim() + " Rupees only";
}

export default function AddDeliveryChallanModal({
  isOpen,
  onClose,
  onSuccess,
  challanId = null,
  initialData = null,
}) {
  const isEdit = Boolean(challanId);
  const baseApi = getBaseApiUrl();

  // Loading States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingNumber, setFetchingNumber] = useState(false);

  // Source Type Tabs: PROJECT, AMC, SERVICE, DIRECT
  const [challanType, setChallanType] = useState("PROJECT");

  // Masters
  const [projectsList, setProjectsList] = useState([]);
  const [amcList, setAmcList] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [invoicesList, setInvoicesList] = useState([]);

  // Selected Sources
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAmcId, setSelectedAmcId] = useState("");
  const [availableCycles, setAvailableCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [linkedInvoiceId, setLinkedInvoiceId] = useState("");

  // States list from country-state-city
  const states = useMemo(() => State.getStatesOfCountry("IN"), []);

  // Challan Header Details
  const [challanNumber, setChallanNumber] = useState("");
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [challanTime, setChallanTime] = useState("11:00 AM");
  const [status, setStatus] = useState("DELIVERED");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");

  // Transport & Dispatch Logistics
  const [transportMode, setTransportMode] = useState("Road Transport");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [lrRrNumber, setLrRrNumber] = useState("");
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deliveredBy, setDeliveredBy] = useState("");

  // Fixed Company Details (Default DS AQUA matching Bill of Supply)
  const [companyName] = useState("D S AQUA");
  const [companyAddress] = useState(
    "Manufacturing Plant: S No 156/5A, Belhekar Wasti, Manjari Bk, Hadapsar, Pune City, Maharashtra, India – 412307.\nCorporate Office: Office No. 216, 2nd Floor, Deccan Heights, Opp. KFC, Near PMT Bus Stop, Deccan, Above Joshi Wadewale, Pune – 411004."
  );
  const [companyPhone] = useState("+91 866-8274-241, +91 883-0373-068");
  const [companyEmail] = useState("dswatertech1@gmail.com");
  const [companyState] = useState("27-Maharashtra");

  // 1. Bill To Party
  const [billToCompanyName, setBillToCompanyName] = useState("");
  const [billToContactPerson, setBillToContactPerson] = useState("");
  const [billToContact, setBillToContact] = useState("");
  const [billToEmail, setBillToEmail] = useState("");
  const [billToState, setBillToState] = useState("Maharashtra");
  const [billToCity, setBillToCity] = useState("Pune");
  const [billToAddress, setBillToAddress] = useState("");
  const [billToGstin, setBillToGstin] = useState("");
  const [billToPan, setBillToPan] = useState("");

  // 2. Ship To Party
  const [shipToSameAsBillTo, setShipToSameAsBillTo] = useState(true);
  const [shipToCompanyName, setShipToCompanyName] = useState("");
  const [shipToContactPerson, setShipToContactPerson] = useState("");
  const [shipToContact, setShipToContact] = useState("");
  const [shipToEmail, setShipToEmail] = useState("");
  const [shipToState, setShipToState] = useState("Maharashtra");
  const [shipToCity, setShipToCity] = useState("Pune");
  const [shipToAddress, setShipToAddress] = useState("");
  const [shipToGstin, setShipToGstin] = useState("");

  // Line Items
  const [items, setItems] = useState([
    {
      inventory_item: null,
      item_name: "D S AQUA ® INDUSTRIAL RO WATER PURIFICATION SYSTEM",
      description: "Complete water treatment & filtration unit",
      hsn_sac: "8421",
      quantity: 1,
      unit: "NOS",
      price_per_unit: 0,
      total_amount: 0,
      remarks: "Goods dispatched for site installation",
    },
  ]);

  // Inventory Quick Picker
  const [selectedInventoryItem, setSelectedInventoryItem] = useState("");
  const [inventoryAddQty, setInventoryAddQty] = useState(1);

  // Description / Terms
  const [notes, setNotes] = useState(
    "Material dispatched in sound condition for Project Installation / Maintenance / Service purpose."
  );
  const [termsConditions, setTermsConditions] = useState(
    "1. Goods once dispatched/delivered are non-returnable without prior approval.\n2. Goods inspected and received in good condition.\n3. Subject to Pune jurisdiction."
  );
  const [selectedTerms, setSelectedTerms] = useState([]);

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

  // Auth headers
  const getHeaders = useCallback(() => {
    const token =
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Fetch Next Challan Number
  const fetchNextNumber = useCallback(async () => {
    setFetchingNumber(true);
    try {
      const res = await axios.get(`${baseApi}/invoice/delivery-challans/next-number/`, {
        headers: getHeaders(),
      });
      if (res.data?.formatted || res.data?.next_number) {
        setChallanNumber(res.data.formatted || res.data.next_number);
      }
    } catch {
      setChallanNumber("DC-0001");
    } finally {
      setFetchingNumber(false);
    }
  }, [baseApi, getHeaders]);

  // Sync Ship To when "Same as Bill To" is checked
  useEffect(() => {
    if (shipToSameAsBillTo) {
      setShipToCompanyName(billToCompanyName);
      setShipToContactPerson(billToContactPerson);
      setShipToContact(billToContact);
      setShipToEmail(billToEmail);
      setShipToState(billToState);
      setShipToCity(billToCity);
      setShipToAddress(billToAddress);
      setShipToGstin(billToGstin);
    }
  }, [
    shipToSameAsBillTo,
    billToCompanyName,
    billToContactPerson,
    billToContact,
    billToEmail,
    billToState,
    billToCity,
    billToAddress,
    billToGstin,
  ]);

  // Load Initial Data / Masters
  useEffect(() => {
    if (!isOpen) return;

    if (!isEdit && !challanNumber) {
      fetchNextNumber();
    }

    const headers = getHeaders();
    let isMounted = true;

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

    // Fetch Inventory Items
    axios
      .get(`${baseApi}/inventory/items/?limit=500`, { headers })
      .then((res) => {
        if (!isMounted) return;
        setInventoryItems(Array.isArray(res.data) ? res.data : res.data?.results || []);
      })
      .catch((e) => console.warn("Failed to fetch inventory items:", e));

    // Fetch Created Invoices for optional linking
    axios
      .get(`${baseApi}/invoice/invoices/?limit=500`, { headers })
      .then((res) => {
        if (!isMounted) return;
        setInvoicesList(Array.isArray(res.data) ? res.data : res.data?.results || []);
      })
      .catch((e) => console.warn("Failed to fetch invoices:", e));

    if (isEdit && initialData) {
      populateFromData(initialData);
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, isEdit, challanId, fetchNextNumber, getHeaders]);

  const populateFromData = (data) => {
    setChallanNumber(data.challan_number || "");
    setChallanDate(data.challan_date || new Date().toISOString().split("T")[0]);
    setChallanTime(data.challan_time || "11:00 AM");
    setChallanType(data.challan_type || "PROJECT");
    setStatus(data.status || "DELIVERED");

    setBillToCompanyName(data.bill_to_name || "");
    setBillToContactPerson(data.bill_to_contact_person || "");
    setBillToContact(data.bill_to_contact || "");
    setBillToEmail(data.bill_to_email || "");
    setBillToState(data.bill_to_state || "Maharashtra");
    setBillToCity(data.bill_to_city || "Pune");
    setBillToAddress(data.bill_to_address || "");
    setBillToGstin(data.bill_to_gstin || "");
    setBillToPan(data.bill_to_pan || "");

    if (data.ship_to_address && data.ship_to_address !== data.bill_to_address) {
      setShipToSameAsBillTo(false);
      setShipToCompanyName(data.ship_to_name || "");
      setShipToContactPerson(data.ship_to_contact_person || "");
      setShipToContact(data.ship_to_contact || "");
      setShipToEmail(data.ship_to_email || "");
      setShipToState(data.ship_to_state || "Maharashtra");
      setShipToCity(data.ship_to_city || "Pune");
      setShipToAddress(data.ship_to_address || "");
      setShipToGstin(data.ship_to_gstin || "");
    } else {
      setShipToSameAsBillTo(true);
    }

    setPoNumber(data.po_number || "");
    setPoDate(data.po_date || "");
    setTransportMode(data.transport_mode || "Road Transport");
    setVehicleNumber(data.vehicle_number || "");
    setLrRrNumber(data.lr_rr_number || "");
    setDispatchDate(data.dispatch_date || data.challan_date || "");
    setDeliveredBy(data.delivered_by || "");

    setNotes(data.notes || "Material dispatched for installation / service purpose.");
    setTermsConditions(data.terms_conditions || "Thank you for doing business with us.");
    setSelectedTerms(Array.isArray(data.terms_and_conditions) ? data.terms_and_conditions : []);

    if (data.project) setSelectedProjectId(String(data.project));
    if (data.amc_contract) setSelectedAmcId(String(data.amc_contract));
    if (data.service) setSelectedServiceId(String(data.service));
    if (data.customer) setSelectedCustomerId(String(data.customer));
    if (data.linked_invoice) setLinkedInvoiceId(String(data.linked_invoice));

    if (data.items && data.items.length > 0) {
      setItems(
        data.items.map((it) => ({
          id: it.id,
          inventory_item: it.inventory_item || null,
          item_name: it.item_name || "",
          description: it.description || "",
          hsn_sac: it.hsn_sac || "8421",
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit || "NOS",
          price_per_unit: parseFloat(it.price_per_unit) || 0,
          total_amount: parseFloat(it.total_amount) || 0,
          remarks: it.remarks || "",
        }))
      );
    }
  };

  // AUTO-POPULATION: Project Selection
  const handleProjectSelect = (projId) => {
    setSelectedProjectId(projId);
    if (!projId) return;

    const proj = projectsList.find((p) => String(p.id) === String(projId));
    if (!proj) return;

    const cust = proj.customer_details || {};
    const company = cust.name || cust.company_name || proj.customer_name || "";
    const contactPerson = cust.contact_person || "";
    const contact = cust.contact_number || cust.phone || "";
    const email = cust.email || "";
    const gstin = cust.gst_number || cust.gstin || "";
    const pan = cust.pan_number || "";
    const state = cust.state || "Maharashtra";
    const city = cust.city || "Pune";
    const address = cust.billing_address || cust.address || "";

    setBillToCompanyName(company ? `M/S. ${company.toUpperCase()}` : "");
    setBillToContactPerson(contactPerson);
    setBillToContact(contact);
    setBillToEmail(email);
    setBillToGstin(gstin);
    setBillToPan(pan);
    setBillToState(state);
    setBillToCity(city);
    setBillToAddress(address);

    if (cust.id) setSelectedCustomerId(String(cust.id));
    if (proj.project_code) setPoNumber(proj.project_code);

    // Parse product(s) from project
    let raw = proj.product;
    let parsed = [];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          parsed = JSON.parse(trimmed.replace(/'/g, '"'));
        } catch {
          parsed = [trimmed.replace(/[\[\]'"]/g, "").trim()];
        }
      } else if (trimmed) {
        parsed = [trimmed];
      }
    } else if (Array.isArray(raw)) {
      parsed = raw;
    }

    const newItems = [];
    parsed.forEach((item) => {
      let name = typeof item === "string" ? item.trim() : item.product || item.product_name || item.name || "";
      if (name) {
        const fullName = name.toUpperCase().includes("D S AQUA") ? name : `D S AQUA ® ${name.toUpperCase()}`;
        newItems.push({
          inventory_item: null,
          item_name: fullName,
          description: `Project Code: ${proj.project_code || 'PRJ-' + proj.id}`,
          hsn_sac: "8421",
          quantity: 1,
          unit: "NOS",
          price_per_unit: 0,
          total_amount: 0,
          remarks: "Project Equipment Delivery",
        });
      }
    });

    if (newItems.length === 0) {
      newItems.push({
        inventory_item: null,
        item_name: "D S AQUA ® INDUSTRIAL RO WATER TREATMENT PLANT",
        description: `Project Code: ${proj.project_code || 'PRJ-' + proj.id}`,
        hsn_sac: "8421",
        quantity: 1,
        unit: "NOS",
        price_per_unit: 0,
        total_amount: 0,
        remarks: "Main System Delivery",
      });
    }

    // Also auto-fetch issued inventory items for this project if available
    axios
      .get(`${baseApi}/inventory/transactions/?project=${proj.id}&limit=50`, { headers: getHeaders() })
      .then((res) => {
        const txs = Array.isArray(res.data) ? res.data : res.data?.results || [];
        if (txs.length > 0) {
          txs.forEach((tx) => {
            const itemName = tx.item_name || tx.item?.name || "Inventory Spare Part";
            const qty = parseFloat(tx.quantity) || 1;
            const unit = tx.item?.unit || "NOS";
            newItems.push({
              inventory_item: tx.item_id || tx.item?.id || null,
              item_name: itemName,
              description: `Issued from Inventory (Ref: ${tx.reference_number || 'Project Materials'})`,
              hsn_sac: tx.item?.hsn_sac_code || "8421",
              quantity: qty,
              unit: unit,
              price_per_unit: parseFloat(tx.item?.unit_price || 0),
              total_amount: (parseFloat(tx.item?.unit_price || 0) * qty),
              remarks: "Project Inventory Material",
            });
          });
        }
        setItems(newItems);
      })
      .catch(() => {
        setItems(newItems);
      });
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

    // Extract cycles sorted
    const rawCycles = Array.isArray(amc.cycles) ? amc.cycles : [];
    const cycles = [...rawCycles].sort((a, b) => (a.cycle_number || 0) - (b.cycle_number || 0));
    setAvailableCycles(cycles);

    let targetCycle = null;
    if (cycles.length > 0) {
      targetCycle = cycles.find((c) => c.status === "active") || cycles[cycles.length - 1];
      setSelectedCycleId(String(targetCycle.id));
      setSelectedCycle(targetCycle);
    }

    const cust = amc.customer_details || amc.customer || {};
    const company = cust.name || cust.company_name || amc.customer_name || "";
    const contactPerson = cust.contact_person || amc.contact_person || "";
    const contact = cust.contact_number || cust.phone || amc.contact_number || "";
    const email = cust.email || "";
    const gstin = cust.gst_number || cust.gstin || "";
    const pan = cust.pan_number || "";
    const state = cust.state || "Maharashtra";
    const city = cust.city || "Pune";
    const address = cust.billing_address || cust.address || amc.site_address || "";

    setBillToCompanyName(company ? `M/S. ${company.toUpperCase()}` : "");
    setBillToContactPerson(contactPerson);
    setBillToContact(contact);
    setBillToEmail(email);
    setBillToGstin(gstin);
    setBillToPan(pan);
    setBillToState(state);
    setBillToCity(city);
    setBillToAddress(address);

    const siteAddr = amc.site_address || address;
    if (shipToSameAsBillTo) {
      setShipToAddress(siteAddr);
    }

    if (cust.id) setSelectedCustomerId(String(cust.id));

    const cId = amc.contract_id || `AMC-${amc.id}`;
    const isRen = targetCycle ? targetCycle.cycle_number > 1 : false;
    const cNum = targetCycle ? targetCycle.cycle_number : 1;
    const visits = targetCycle ? (targetCycle.no_of_visits || 4) : (amc.no_of_visits || 4);

    if (isRen) {
      setPoNumber(`${cId} (Cycle #${cNum})`);
    } else {
      setPoNumber(cId);
    }

    const prod = amc.product || "Water Purifier";
    const prodTitle = prod.toUpperCase().includes("D S AQUA") ? prod : `D S AQUA ® ${prod.toUpperCase()}`;
    const termText = isRen ? `AMC Renewal Cycle #${cNum}` : "Initial Term";
    const periodText =
      targetCycle && targetCycle.start_date && targetCycle.end_date
        ? ` | Period: ${targetCycle.start_date} to ${targetCycle.end_date}`
        : "";

    setItems([
      {
        inventory_item: null,
        item_name: `${prodTitle} - AMC Replacement Spares & Filter Cartridges`,
        description: `Contract ID: ${cId} | ${termText} | Scheduled Visits: ${visits} / year${periodText} | Maintenance Filters & Consumables`,
        hsn_sac: "8421",
        quantity: 1,
        unit: "SET",
        price_per_unit: 0,
        total_amount: 0,
        remarks: `AMC ${termText} Delivery`,
      },
    ]);
  };

  // Handler: When Contract / Renewal Cycle is picked
  const handleCycleSelect = (cycleId) => {
    setSelectedCycleId(cycleId);
    if (!cycleId) {
      setSelectedCycle(null);
      return;
    }

    const cyc = availableCycles.find((c) => String(c.id) === String(cycleId));
    if (!cyc) return;

    setSelectedCycle(cyc);
    const amc = amcList.find((a) => String(a.id) === String(selectedAmcId));
    const cId = amc ? amc.contract_id || `AMC-${amc.id}` : "AMC";
    const isRen = cyc.cycle_number > 1;
    const cNum = cyc.cycle_number;
    const visits = cyc.no_of_visits || 4;

    if (isRen) {
      setPoNumber(`${cId} (Cycle #${cNum})`);
    } else {
      setPoNumber(cId);
    }

    const prod = amc?.product || "Water Purifier";
    const prodTitle = prod.toUpperCase().includes("D S AQUA") ? prod : `D S AQUA ® ${prod.toUpperCase()}`;
    const termText = isRen ? `AMC Renewal Cycle #${cNum}` : "Initial Term";
    const periodText = cyc.start_date && cyc.end_date ? ` | Period: ${cyc.start_date} to ${cyc.end_date}` : "";

    setItems([
      {
        inventory_item: null,
        item_name: `${prodTitle} - AMC Replacement Spares & Filter Cartridges`,
        description: `Contract ID: ${cId} | ${termText} | Scheduled Visits: ${visits} / year${periodText} | Maintenance Filters & Consumables`,
        hsn_sac: "8421",
        quantity: 1,
        unit: "SET",
        price_per_unit: 0,
        total_amount: 0,
        remarks: `AMC ${termText} Delivery`,
      },
    ]);
  };

  // AUTO-POPULATION: Service Selection
  const handleServiceSelect = (srvId) => {
    setSelectedServiceId(srvId);
    if (!srvId) return;

    const srv = servicesList.find((s) => String(s.id) === String(srvId));
    if (!srv) return;

    const cust = srv.customer_details || {};
    const company = cust.name || cust.company_name || srv.customer_name || "";
    const contactPerson = cust.contact_person || srv.contact_person || "";
    const contact = cust.contact_number || cust.phone || srv.contact_phone || "";
    const email = cust.email || "";
    const gstin = cust.gst_number || "";
    const pan = cust.pan_number || "";
    const state = cust.state || "Maharashtra";
    const city = cust.city || "Pune";
    const address = cust.billing_address || cust.address || srv.visit_address || "";

    setBillToCompanyName(company ? `M/S. ${company.toUpperCase()}` : "");
    setBillToContactPerson(contactPerson);
    setBillToContact(contact);
    setBillToEmail(email);
    setBillToGstin(gstin);
    setBillToPan(pan);
    setBillToState(state);
    setBillToCity(city);
    setBillToAddress(address);

    const siteAddr = srv.visit_address || address;
    if (shipToSameAsBillTo) {
      setShipToAddress(siteAddr);
    }

    if (cust.id) setSelectedCustomerId(String(cust.id));
    const srvNum = srv.service_number || srv.visit_number || `SRV-${srv.id}`;
    setPoNumber(srvNum);
    if (srv.visit_date || srv.service_date) {
      setPoDate(srv.visit_date || srv.service_date);
    }

    const equip = srv.equipment || srv.product || "Water Purification Equipment";
    const equipTitle = equip.toUpperCase().includes("D S AQUA") ? equip : `D S AQUA ® ${equip.toUpperCase()}`;

    const newItems = [
      {
        inventory_item: null,
        item_name: `${equipTitle} - Service Repair Components`,
        description: `Service Ticket #${srvNum} (${srv.service_type || 'Repair Visit'})`,
        hsn_sac: "8421",
        quantity: 1,
        unit: "NOS",
        price_per_unit: 0,
        total_amount: 0,
        remarks: "Breakdown / Service Spares",
      },
    ];

    // Auto-fetch issued inventory spare parts for this service ticket
    axios
      .get(`${baseApi}/inventory/transactions/?service=${srv.id}&limit=50`, { headers: getHeaders() })
      .then((res) => {
        const txs = Array.isArray(res.data) ? res.data : res.data?.results || [];
        if (txs.length > 0) {
          txs.forEach((tx) => {
            const itemName = tx.item_name || tx.item?.name || "Replacement Part";
            const qty = parseFloat(tx.quantity) || 1;
            const unit = tx.item?.unit || "NOS";
            newItems.push({
              inventory_item: tx.item_id || tx.item?.id || null,
              item_name: itemName,
              description: `Service Spare (Ref: ${tx.reference_number || srvNum})`,
              hsn_sac: tx.item?.hsn_sac_code || "8421",
              quantity: qty,
              unit: unit,
              price_per_unit: parseFloat(tx.item?.unit_price || 0),
              total_amount: (parseFloat(tx.item?.unit_price || 0) * qty),
              remarks: "Service Ticket Replacement Part",
            });
          });
        }
        setItems(newItems);
      })
      .catch(() => {
        setItems(newItems);
      });
  };

  // Add Item from Inventory Master Dropdown
  const handleAddFromInventory = () => {
    if (!selectedInventoryItem) return;
    const inv = inventoryItems.find((i) => String(i.id) === String(selectedInventoryItem));
    if (!inv) return;

    const qty = parseFloat(inventoryAddQty) || 1;
    const rate = parseFloat(inv.unit_price) || 0;
    const total = qty * rate;

    setItems((prev) => [
      ...prev,
      {
        inventory_item: inv.id,
        item_name: inv.name,
        description: `Code: ${inv.item_code} | Cat: ${inv.category || 'General'}`,
        hsn_sac: inv.hsn_sac_code || "8421",
        quantity: qty,
        unit: inv.unit || "NOS",
        price_per_unit: rate,
        total_amount: total,
        remarks: "Inventory Dispatched Material",
      },
    ]);

    setSelectedInventoryItem("");
    setInventoryAddQty(1);
  };

  // Manual Item Operations
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        inventory_item: null,
        item_name: "",
        description: "",
        hsn_sac: "8421",
        quantity: 1,
        unit: "NOS",
        price_per_unit: 0,
        total_amount: 0,
        remarks: "",
      },
    ]);
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === "quantity" || field === "price_per_unit") {
        const qty = parseFloat(copy[index].quantity) || 0;
        const rate = parseFloat(copy[index].price_per_unit) || 0;
        copy[index].total_amount = qty * rate;
      }
      return copy;
    });
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      Swal.fire("Info", "Delivery Challan must have at least one line item.", "info");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate totals
  const totalQty = useMemo(() => {
    return items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0);
  }, [items]);

  const grandTotalValue = useMemo(() => {
    return items.reduce((sum, it) => sum + (parseFloat(it.total_amount) || 0), 0);
  }, [items]);

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!challanNumber.trim()) {
      Swal.fire("Validation Error", "Challan Number is required.", "warning");
      return;
    }
    if (!billToCompanyName.trim()) {
      Swal.fire("Validation Error", "Customer / Bill To Company Name is required.", "warning");
      return;
    }
    if (items.length === 0 || !items[0].item_name.trim()) {
      Swal.fire("Validation Error", "Please provide at least one valid line item.", "warning");
      return;
    }

    setSubmitting(true);

    const fullBillToAddress = [billToAddress, billToCity, billToState]
      .filter(Boolean)
      .join(", ");

    const fullShipToAddress = shipToSameAsBillTo
      ? fullBillToAddress
      : [shipToAddress, shipToCity, shipToState].filter(Boolean).join(", ");

    const payload = {
      challan_number: challanNumber.trim(),
      challan_date: challanDate,
      challan_time: challanTime || "11:00 AM",
      challan_type: challanType,
      status: status,

      project: challanType === "PROJECT" && selectedProjectId ? parseInt(selectedProjectId) : null,
      amc_contract: challanType === "AMC" && selectedAmcId ? parseInt(selectedAmcId) : null,
      service: challanType === "SERVICE" && selectedServiceId ? parseInt(selectedServiceId) : null,
      customer: selectedCustomerId ? parseInt(selectedCustomerId) : null,
      linked_invoice: linkedInvoiceId ? parseInt(linkedInvoiceId) : null,

      company_name: companyName,
      company_address: companyAddress,
      company_phone: companyPhone,
      company_email: companyEmail,
      company_gstin: "27AALCD8065C1ZJ",
      company_state: companyState,

      bill_to_name: billToCompanyName.trim(),
      bill_to_contact_person: billToContactPerson.trim(),
      bill_to_contact: billToContact.trim(),
      bill_to_email: billToEmail.trim(),
      bill_to_state: billToState,
      bill_to_city: billToCity,
      bill_to_address: fullBillToAddress,
      bill_to_gstin: billToGstin.trim(),
      bill_to_pan: billToPan.trim(),

      ship_to_same_as_bill_to: shipToSameAsBillTo,
      ship_to_name: shipToSameAsBillTo ? billToCompanyName.trim() : (shipToCompanyName || billToCompanyName).trim(),
      ship_to_contact_person: shipToSameAsBillTo ? billToContactPerson.trim() : (shipToContactPerson || "").trim(),
      ship_to_contact: shipToSameAsBillTo ? billToContact.trim() : (shipToContact || billToContact).trim(),
      ship_to_email: shipToSameAsBillTo ? billToEmail.trim() : (shipToEmail || "").trim(),
      ship_to_state: shipToSameAsBillTo ? billToState : (shipToState || billToState),
      ship_to_city: shipToSameAsBillTo ? billToCity : (shipToCity || billToCity),
      ship_to_address: fullShipToAddress,
      ship_to_gstin: shipToSameAsBillTo ? billToGstin.trim() : (shipToGstin || billToGstin).trim(),

      place_of_supply: billToState
        ? billToState.toLowerCase().includes("maharashtra")
          ? "27-Maharashtra"
          : billToState
        : "27-Maharashtra",
      po_number: poNumber.trim(),
      po_date: poDate || null,
      transport_mode: transportMode.trim(),
      vehicle_number: vehicleNumber.trim(),
      lr_rr_number: lrRrNumber.trim(),
      dispatch_date: dispatchDate || challanDate,
      delivered_by: deliveredBy.trim(),

      total_quantity: totalQty,
      sub_total: grandTotalValue,
      discount_total: 0,
      taxable_amount: grandTotalValue,
      grand_total: grandTotalValue,
      amount_in_words: numberToIndianWords(grandTotalValue),

      terms_conditions:
        selectedTerms.length > 0
          ? selectedTerms.map((t) => `${t.name}: ${t.description}`).join("\n")
          : isEdit
          ? termsConditions
          : "",
      terms_and_conditions: selectedTerms,
      notes: notes,

      items: items.map((it) => ({
        inventory_item: it.inventory_item ? parseInt(it.inventory_item) : null,
        item_name: it.item_name.trim(),
        description: (it.description || "").trim(),
        hsn_sac: (it.hsn_sac || "8421").trim(),
        quantity: parseFloat(it.quantity) || 1,
        unit: (it.unit || "NOS").trim(),
        price_per_unit: parseFloat(it.price_per_unit) || 0,
        total_amount: parseFloat(it.total_amount) || 0,
        remarks: (it.remarks || "").trim(),
      })),
    };

    try {
      const headers = getHeaders();
      const endpoint = isEdit ? `invoice/delivery-challans/${challanId}/` : "invoice/delivery-challans/";
      const method = isEdit ? "put" : "post";

      await axios[method](`${baseApi}/${endpoint}`, payload, { headers });

      Swal.fire({
        icon: "success",
        title: isEdit ? "Challan Updated" : "Challan Created",
        text: `Delivery Challan #${challanNumber} ${isEdit ? "updated" : "generated"} successfully.`,
        timer: 1800,
        showConfirmButton: false,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error saving Delivery Challan:", err);
      let errMsg = "Failed to save Delivery Challan.";
      if (err.response?.data) {
        if (typeof err.response.data === "string") {
          errMsg = err.response.data.slice(0, 200);
        } else {
          errMsg = JSON.stringify(err.response.data);
        }
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
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MdLocalShipping className="text-sky-600" />
              {isEdit ? `Edit Delivery Challan #${challanNumber}` : "Add Delivery Challan"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate official delivery challan auto-filled from Projects, AMC Contracts, or Service jobs with inventory spares
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
        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin text-slate-800">
          <form id="deliveryChallanForm" onSubmit={handleSubmit} className="space-y-6">
            {/* 1. SOURCE SELECTOR TABS (Matching AddInvoiceModal) */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                  Select Challan Source
                </span>
                <span className="text-[11px] text-slate-400">
                  Auto-populates customer, shipping address, products &amp; inventory items
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { type: "PROJECT", label: "Project", icon: Briefcase, desc: "Water plants & projects" },
                  { type: "AMC", label: "AMC Contract", icon: ShieldAlert, desc: "Annual maintenance spares" },
                  { type: "SERVICE", label: "Service Job", icon: Wrench, desc: "Service & breakdown parts" },
                  { type: "DIRECT", label: "Direct Delivery", icon: UserCheck, desc: "Manual material dispatch" },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = challanType === tab.type;
                  return (
                    <button
                      key={tab.type}
                      type="button"
                      onClick={() => {
                        setChallanType(tab.type);
                        setSelectedProjectId("");
                        setSelectedAmcId("");
                        setSelectedCycleId("");
                        setSelectedCycle(null);
                        setAvailableCycles([]);
                        setSelectedServiceId("");
                      }}
                      className={`p-3 rounded-lg text-left transition-all border cursor-pointer ${
                        active
                          ? "bg-white border-sky-500 shadow-xs ring-1 ring-sky-500"
                          : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${active ? "text-sky-600" : "text-slate-400"}`} />
                        <span className={`text-xs font-bold ${active ? "text-sky-900" : "text-slate-700"}`}>
                          {tab.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{tab.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Source-specific dropdown picker */}
              {challanType === "PROJECT" && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Select Project
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

              {challanType === "AMC" && (
                <div className="pt-2 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Select AMC Contract
                    </label>
                    <select
                      value={selectedAmcId}
                      onChange={(e) => handleAmcSelect(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="">-- Choose AMC Contract ({amcList.length} available) --</option>
                      {amcList.map((amc) => {
                        const cName = amc.customer_name || amc.customer?.name || "Client";
                        const prod = amc.product || "Water Purifier";
                        const cycCount = Array.isArray(amc.cycles) ? amc.cycles.length : 0;
                        const hasRen = cycCount > 1 || (amc.cycles && amc.cycles.some((c) => c.cycle_number > 1));
                        return (
                          <option key={amc.id} value={amc.id}>
                            {amc.contract_id || `AMC-${amc.id}`} • {cName} • {prod} ({amc.no_of_visits || 4} Visits){" "}
                            {hasRen ? `[🔄 Renewals: ${cycCount} Terms]` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* RENEWAL CYCLE SELECTOR - Appears when selected AMC has renewals */}
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
                            Visits: <strong>{selectedCycle.no_of_visits || 4} Visits/year</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {challanType === "SERVICE" && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Select Service Job / Visit
                  </label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => handleServiceSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="">-- Choose Service Job ({servicesList.length} available) --</option>
                    {servicesList.map((s) => {
                      const cName = s.customer_name || s.customer_details?.company_name || "Client";
                      const srvNum = s.service_number || s.visit_number || `SRV-${s.id}`;
                      return (
                        <option key={s.id} value={s.id}>
                          {srvNum} • {cName} • {s.service_type || "Service Visit"}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* 2. CHALLAN META & LOGISTICS DETAILS */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center justify-between">
                <span>Delivery Challan &amp; Dispatch Details</span>
                <span className="text-[11px] text-slate-400 lowercase font-normal">transport &amp; docket info</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Challan Number */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-600">
                      Challan No. *
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
                    value={challanNumber}
                    onChange={(e) => setChallanNumber(e.target.value)}
                    placeholder="e.g. DC-0001"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-mono font-bold text-slate-800"
                    required
                  />
                </div>

                {/* Challan Date */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Challan Date *</label>
                  <input
                    type="date"
                    value={challanDate}
                    onChange={(e) => setChallanDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                    required
                  />
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Delivery Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="DELIVERED">Delivered</option>
                    <option value="IN_TRANSIT">In Transit / Dispatched</option>
                    <option value="PENDING">Pending Dispatch</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                {/* Mode of Transport */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Transport Mode</label>
                  <input
                    type="text"
                    value={transportMode}
                    onChange={(e) => setTransportMode(e.target.value)}
                    placeholder="e.g. Road / Tempo / Courier"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>

                {/* Vehicle Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Vehicle Number</label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g. MH-12-AB-1234"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white font-mono uppercase"
                  />
                </div>

                {/* LR / Docket Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">LR / Docket No.</label>
                  <input
                    type="text"
                    value={lrRrNumber}
                    onChange={(e) => setLrRrNumber(e.target.value)}
                    placeholder="e.g. LR-98721"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>

                {/* PO / Ref Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">PO / Ref Number</label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="e.g. PO-2026-01"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>

                {/* Delivered By */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Delivered By Person</label>
                  <input
                    type="text"
                    value={deliveredBy}
                    onChange={(e) => setDeliveredBy(e.target.value)}
                    placeholder="e.g. Technician / Driver Name"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 3. BILL TO & SHIP TO ADDRESSES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* BILL TO (CLIENT) */}
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1 border-b border-slate-200 flex items-center justify-between">
                  <span>1. Bill To Party (Client Details)</span>
                  {billToCompanyName && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      Customer Loaded
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">Company / Client Name *</label>
                    <input
                      type="text"
                      value={billToCompanyName}
                      onChange={(e) => setBillToCompanyName(e.target.value)}
                      placeholder="e.g. Eminence Core Solutions LLP"
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">Contact Person</label>
                      <input
                        type="text"
                        value={billToContactPerson}
                        onChange={(e) => setBillToContactPerson(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">Contact Number</label>
                      <input
                        type="text"
                        value={billToContact}
                        onChange={(e) => setBillToContact(e.target.value)}
                        placeholder="e.g. +91 9876543210"
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">State</label>
                      <select
                        value={billToState}
                        onChange={(e) => {
                          setBillToState(e.target.value);
                          setBillToCity("");
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      >
                        {states.map((s) => (
                          <option key={s.isoCode} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">City</label>
                      <input
                        type="text"
                        value={billToCity}
                        onChange={(e) => setBillToCity(e.target.value)}
                        placeholder="e.g. Pune"
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">Billing Address Details</label>
                    <textarea
                      rows={2}
                      value={billToAddress}
                      onChange={(e) => setBillToAddress(e.target.value)}
                      placeholder="Street, Landmark, Area, Pin code..."
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* SHIP TO (CONSIGNEE / SITE) */}
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1 border-b border-slate-200 flex items-center justify-between">
                  <span>2. Ship To / Consignee (Delivery Site)</span>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shipToSameAsBillTo}
                      onChange={(e) => setShipToSameAsBillTo(e.target.checked)}
                      className="w-3.5 h-3.5 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                    />
                    <span>Same as Bill To</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">Consignee / Site Name</label>
                    <input
                      type="text"
                      disabled={shipToSameAsBillTo}
                      value={shipToCompanyName}
                      onChange={(e) => setShipToCompanyName(e.target.value)}
                      placeholder="e.g. Plant Site / Warehouse"
                      className={`w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg ${
                        shipToSameAsBillTo ? "bg-slate-100 text-slate-500" : "bg-white"
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">Site Contact Person</label>
                      <input
                        type="text"
                        disabled={shipToSameAsBillTo}
                        value={shipToContactPerson}
                        onChange={(e) => setShipToContactPerson(e.target.value)}
                        placeholder="Site Incharge"
                        className={`w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg ${
                          shipToSameAsBillTo ? "bg-slate-100 text-slate-500" : "bg-white"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">Site Contact Number</label>
                      <input
                        type="text"
                        disabled={shipToSameAsBillTo}
                        value={shipToContact}
                        onChange={(e) => setShipToContact(e.target.value)}
                        placeholder="Site Phone"
                        className={`w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg ${
                          shipToSameAsBillTo ? "bg-slate-100 text-slate-500" : "bg-white"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">Site State</label>
                      <select
                        disabled={shipToSameAsBillTo}
                        value={shipToState}
                        onChange={(e) => {
                          setShipToState(e.target.value);
                          setShipToCity("");
                        }}
                        className={`w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg ${
                          shipToSameAsBillTo ? "bg-slate-100 text-slate-500" : "bg-white"
                        }`}
                      >
                        {states.map((s) => (
                          <option key={s.isoCode} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">Site City</label>
                      <input
                        type="text"
                        disabled={shipToSameAsBillTo}
                        value={shipToCity}
                        onChange={(e) => setShipToCity(e.target.value)}
                        placeholder="City"
                        className={`w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg ${
                          shipToSameAsBillTo ? "bg-slate-100 text-slate-500" : "bg-white"
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">Delivery Site Address</label>
                    <textarea
                      rows={2}
                      disabled={shipToSameAsBillTo}
                      value={shipToAddress}
                      onChange={(e) => setShipToAddress(e.target.value)}
                      placeholder="Delivery site full location details..."
                      className={`w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg ${
                        shipToSameAsBillTo ? "bg-slate-100 text-slate-500" : "bg-white"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. INVENTORY QUICK PICKER TOOLBAR */}
            <div className="bg-sky-50/70 p-3.5 rounded-xl border border-sky-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MdInventory2 className="text-sky-600 text-lg shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Add from Inventory Master</span>
                  <span className="text-[11px] text-slate-400">
                    Quickly add stocked spare parts, membranes, valves or materials to this challan
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedInventoryItem}
                  onChange={(e) => setSelectedInventoryItem(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white flex-1 sm:w-64"
                >
                  <option value="">-- Choose Stocked Spare Part --</option>
                  {inventoryItems.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.item_code}) • Stock: {inv.available_stock || 0} {inv.unit}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  value={inventoryAddQty}
                  onChange={(e) => setInventoryAddQty(e.target.value)}
                  placeholder="Qty"
                  className="w-16 px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-center font-bold"
                />

                <button
                  type="button"
                  onClick={handleAddFromInventory}
                  disabled={!selectedInventoryItem}
                  className="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                >
                  <Plus size={14} />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            {/* 5. LINE ITEMS TABLE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                  Materials &amp; Products Dispatched ({items.length} items)
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                >
                  <MdAdd className="text-base" />
                  <span>Add Custom Row</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 w-8">#</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Item / Product Name</th>
                      <th className="py-2.5 px-3 w-28">HSN/SAC</th>
                      <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                      <th className="py-2.5 px-3 w-20">Unit</th>
                      <th className="py-2.5 px-3 w-28 text-right">Value / Unit</th>
                      <th className="py-2.5 px-3 w-28 text-right">Total</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Remarks / Serial</th>
                      <th className="py-2.5 px-3 w-10 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 font-semibold text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={it.item_name}
                            onChange={(e) => handleItemChange(idx, "item_name", e.target.value)}
                            placeholder="Item Name"
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white font-medium"
                            required
                          />
                          <input
                            type="text"
                            value={it.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            placeholder="Description / Specs (Optional)"
                            className="w-full px-2 py-0.5 text-[10px] text-slate-500 border border-slate-100 rounded bg-white mt-1"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={it.hsn_sac}
                            onChange={(e) => handleItemChange(idx, "hsn_sac", e.target.value)}
                            placeholder="8421"
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white font-mono"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            className="w-16 px-2 py-1 text-xs border border-slate-200 rounded bg-white text-center font-bold"
                            required
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={it.unit}
                            onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                            placeholder="NOS"
                            className="w-16 px-2 py-1 text-xs border border-slate-200 rounded bg-white text-center uppercase"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={it.price_per_unit}
                            onChange={(e) => handleItemChange(idx, "price_per_unit", e.target.value)}
                            className="w-24 px-2 py-1 text-xs border border-slate-200 rounded bg-white text-right font-mono"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                          ₹{parseFloat(it.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={it.remarks}
                            onChange={(e) => handleItemChange(idx, "remarks", e.target.value)}
                            placeholder="Condition / Purpose"
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded cursor-pointer"
                            title="Remove row"
                          >
                            <MdDelete size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/80 font-bold border-t border-slate-200 text-slate-800">
                      <td colSpan={3} className="py-2.5 px-3 text-right text-slate-600">
                        Total Quantity:
                      </td>
                      <td className="py-2.5 px-3 text-center text-sky-700 font-bold">
                        {totalQty}
                      </td>
                      <td colSpan={2} className="py-2.5 px-3 text-right text-slate-600">
                        Total Declared Value:
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-900 font-mono">
                        ₹{grandTotalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 6. REMARKS & QUOTATION TERMS */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Dispatch Purpose / Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes on delivery or materials..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <QuotationTermsSelector
                selectedTerms={selectedTerms}
                onChange={setSelectedTerms}
                isEdit={isEdit}
                legacyTermsText={termsConditions}
              />
            </div>
          </form>
        </div>

        {/* Footer Bar matching AddLeadForm */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Total Items: <span className="font-bold text-slate-800">{items.length}</span> &nbsp;|&nbsp;
            Total Quantity: <span className="font-bold text-sky-700">{totalQty}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="deliveryChallanForm"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors shadow-2xs shadow-sky-500/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Saving..." : isEdit ? "Update Delivery Challan" : "Save & Generate Challan"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
