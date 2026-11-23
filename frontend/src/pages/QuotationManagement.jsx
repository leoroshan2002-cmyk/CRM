import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  FileText,
  Filter,
  Pencil,
  Plus,
  Search,
  Save,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import quotationApi from "../services/quotationApi.js";
import { apiUrl } from "../config/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const STATUS_OPTIONS = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Sent",
  "Viewed",
  "Negotiation",
  "Accepted",
  "Rejected",
  "Expired",
  "Cancelled",
];

const TABS = [
  // { key: "overview", label: "Dashboard" },
  { key: "all", label: "All Quotations" },
  { key: "create", label: "Create Quotation" },
  { key: "templates", label: "Templates" },
  { key: "settings", label: "Settings" },
  { key: "catalog", label: "Service & Pricing" },
];

const createBlankItem = () => ({
  id: `${Date.now()}-${Math.random()}`,
  name: "",
  description: "",
  quantity: 1,
  unit: "pcs",
  unitPrice: 0,
  discountType: "none",
  discountValue: 0,
  tax: 0,
  taxPercentage: 0,
  lineTotal: 0,
});

const dateInputValue = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const shiftDate = (date, offset) => {
  if (!date) return "";
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
})[character]);

const DEFAULT_FORM = {
  quotationNumber: "QT-2026-0001",
  customerName: "",
  clientId: "",
  companyName: "",
  email: "",
  phone: "",
  billingAddress: "",
  shippingAddress: "",
  quotationDate: new Date().toISOString().slice(0, 10),
  validUntil: "",
  salesPerson: "",
  department: "Sales",
  referenceNumber: "",
  relatedLead: "",
  relatedProject: "",
  relatedDeal: "",
  currency: "INR",
  paymentTerms: "50% Advance",
  paymentMethod: "Bank Transfer",
  advancePayment: 0,
  balancePayment: 0,
  paymentDueDays: 15,
  paymentInstructions: "",
  termsAndConditions: "Payment is due within 15 days; all goods remain the property of the supplier until paid in full.",
  notes: "",
  status: "Draft",
  additionalCharges: {
    shipping: 0,
    delivery: 0,
    installation: 0,
    service: 0,
    other: 0,
  },
  items: [createBlankItem()],
  duration: {
    type: "",
    name: "",
    startDate: "",
    endDate: "",
    days: 0,
  },
};

const toCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const calculateLineTotal = (item) => {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const baseAmount = quantity * unitPrice;
  const discountValue = item.discountType === "percent"
    ? (baseAmount * (Number(item.discountValue || 0) / 100))
    : Number(item.discountValue || 0);
  const taxableAmount = Math.max(baseAmount - discountValue, 0);
  const taxAmount = taxableAmount * ((Number(item.taxPercentage || item.tax || 0) || 0) / 100);
  return taxableAmount + taxAmount;
};

const calculateTotals = (items, additionalCharges = {}) => {
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const lineBase = quantity * unitPrice;
    const discountValue = item.discountType === "percent"
      ? lineBase * (Number(item.discountValue || 0) / 100)
      : Number(item.discountValue || 0);
    return sum + Math.max(lineBase - discountValue, 0);
  }, 0);

  const taxTotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const base = quantity * unitPrice;
    const discountValue = item.discountType === "percent"
      ? base * (Number(item.discountValue || 0) / 100)
      : Number(item.discountValue || 0);
    const taxable = Math.max(base - discountValue, 0);
    return sum + taxable * ((Number(item.taxPercentage || item.tax || 0) || 0) / 100);
  }, 0);

  const additional = additionalCharges && typeof additionalCharges === "object"
    ? Object.values(additionalCharges).reduce((sum, value) => sum + Number(value || 0), 0)
    : Number(additionalCharges || 0);

  const discountTotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const base = quantity * unitPrice;
    const discountValue = item.discountType === "percent"
      ? base * (Number(item.discountValue || 0) / 100)
      : Number(item.discountValue || 0);
    return sum + Math.min(discountValue, base);
  }, 0);

  const grandTotal = subtotal + taxTotal + additional;

  return {
    subtotal,
    discount: discountTotal,
    tax: taxTotal,
    additionalCharges: additional,
    grandTotal,
  };
};

const buildBlankForm = () => ({
  ...DEFAULT_FORM,
  quotationNumber: `QT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  items: [createBlankItem()],
});

export default function QuotationManagement() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const quotationBasePath = currentPath.startsWith("/employee/quotations")
    ? "/employee/quotations"
    : "/quotations";
  const navigateToQuotationPath = (path = "") => navigate(`${quotationBasePath}${path}`);

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [form, setForm] = useState(buildBlankForm());
  const [catalog, setCatalog] = useState({ services: [], packages: [], durations: [] });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [serviceDrafts, setServiceDrafts] = useState([]);
  const [newService, setNewService] = useState({ name: "", description: "", price: 0, active: true, subServices: [] });
  const [packageDraft, setPackageDraft] = useState({ name: "", description: "", price: 0, active: true, selectedServices: [] });
  const [packageServiceId, setPackageServiceId] = useState("");
  const [packageSubServiceId, setPackageSubServiceId] = useState("");
  const [durationDrafts, setDurationDrafts] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");

  const activeTab = useMemo(() => {
    if (currentPath.includes("/create")) return "create";
    if (currentPath.includes("/templates")) return "templates";
    if (currentPath.includes("/settings")) return "settings";
    if (currentPath.includes("/catalog")) return "catalog";
    if (currentPath === quotationBasePath || currentPath === `${quotationBasePath}/`) return "all";
    return "overview";
  }, [currentPath, quotationBasePath]);

  const loadQuotations = async () => {
    try {
      setLoading(true);
      const data = await quotationApi.list();
      setQuotations(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.message || "Unable to load quotations.");
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const applyCatalog = (data) => {
    const nextCatalog = {
      services: data.services || [],
      packages: data.packages || [],
      durations: data.durations || [],
    };
    setCatalog(nextCatalog);
    setServiceDrafts(nextCatalog.services.map((service) => ({
      ...service,
      subServices: (service.subServices || []).map((subService) => ({ ...subService })),
    })));
    setDurationDrafts(nextCatalog.durations.map((duration) => ({ ...duration })));
  };

  const loadCatalog = async () => {
    try {
      applyCatalog(await quotationApi.catalog());
    } catch (error) {
      toast.error(error.message || "Unable to load service catalog.");
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    quotationApi.list()
      .then((data) => {
        if (active) setQuotations(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (active) {
          toast.error(error.message || "Unable to load quotations.");
          setQuotations([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    quotationApi.catalog()
      .then((data) => {
        if (active) applyCatalog(data);
      })
      .catch((error) => {
        if (active) toast.error(error.message || "Unable to load service catalog.");
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    const token = localStorage.getItem("token");
    fetch(apiUrl("/clients"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load clients.");
        const data = await response.json();
        if (active) setClients(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (active) toast.error(error.message || "Unable to load clients.");
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredQuotations = useMemo(() => {
    const query = search.toLowerCase();

    return quotations.filter((quotation) => {
      const matchesSearch = !query || [
        quotation.quotationNumber,
        quotation.customerName || quotation.customerDetails?.customerName,
        quotation.companyName || quotation.customerDetails?.companyName,
        quotation.email || quotation.customerDetails?.email,
      ].some((value) => String(value || "").toLowerCase().includes(query));

      const matchesStatus = statusFilter === "all" || quotation.status === statusFilter;
      const matchesDepartment = departmentFilter === "all" || quotation.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [quotations, search, statusFilter, departmentFilter]);

  const stats = useMemo(() => {
    const total = quotations.length;
    const draft = quotations.filter((item) => item.status === "Draft").length;
    const pendingApproval = quotations.filter((item) => item.status === "Pending Approval").length;
    const approved = quotations.filter((item) => item.status === "Approved").length;
    const sent = quotations.filter((item) => item.status === "Sent").length;
    const accepted = quotations.filter((item) => item.status === "Accepted").length;
    const rejected = quotations.filter((item) => item.status === "Rejected").length;
    const expired = quotations.filter((item) => item.status === "Expired").length;

    const totalValue = quotations.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
    const acceptedValue = quotations
      .filter((item) => item.status === "Accepted")
      .reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
    const pendingValue = quotations
      .filter((item) => ["Draft", "Pending Approval", "Approved", "Sent", "Viewed", "Negotiation"].includes(item.status))
      .reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);

    return {
      total,
      draft,
      pendingApproval,
      approved,
      sent,
      accepted,
      rejected,
      expired,
      totalValue,
      acceptedValue,
      pendingValue,
    };
  }, [quotations]);

  const chartData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const byMonth = monthNames.map((month) => {
      const amount = quotations
        .filter((item) => new Date(item.quotationDate || Date.now()).toLocaleString("en-US", { month: "short" }) === month)
        .reduce((sum, value) => sum + Number(value.grandTotal || 0), 0);
      return { month, value: amount };
    });

    const statusCounts = STATUS_OPTIONS.map((status) => ({
      name: status,
      value: quotations.filter((item) => item.status === status).length,
    })).filter((item) => item.value > 0);

    const acceptedRejected = [
      { name: "Accepted", value: quotations.filter((item) => item.status === "Accepted").length },
      { name: "Rejected", value: quotations.filter((item) => item.status === "Rejected").length },
    ];

    return { byMonth, statusCounts, acceptedRejected };
  }, [quotations]);

  const updateFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectClient = (clientId) => {
    const client = clients.find((item) => item._id === clientId);
    setForm((prev) => ({
      ...prev,
      clientId,
      customerName: client?.projectName || client?.companyName || prev.customerName,
      companyName: client?.companyName || prev.companyName,
      email: client?.email || prev.email,
      phone: client?.contactNumber || prev.phone,
      billingAddress: client?.headquarters || prev.billingAddress,
    }));
  };

  const makeServiceItem = (service, subService = null) => ({
    ...createBlankItem(),
    name: subService?.name || service.name,
    description: subService
      ? `${service.name} - ${subService.description || subService.name}`
      : service.description || service.name,
    unitPrice: Number(subService?.price ?? service.price ?? 0),
    serviceId: String(service._id),
    subServiceId: subService ? String(subService._id) : "",
    catalogServiceName: service.name,
    catalogSubServiceName: subService?.name || "",
  });

  const isServiceSelectionActive = (serviceId, subServiceId = "") =>
    form.items.some((item) =>
      item.serviceId === String(serviceId) &&
      String(item.subServiceId || "") === String(subServiceId || ""),
    ) ||
    form.items.some((item) =>
      (item.serviceSelections || []).some((selection) =>
        selection.serviceId === String(serviceId) &&
        String(selection.subServiceId || "") === String(subServiceId || ""),
      ),
    );

  const toggleServiceSelection = (service, subService = null) => {
    const serviceId = String(service._id);
    const subServiceId = subService ? String(subService._id) : "";
    setForm((prev) => {
      const currentItems = prev.items.flatMap((item) => {
        if (!item.packageId) return [item];
        return (item.serviceSelections || []).map((selection) => ({
          ...createBlankItem(),
          name: selection.subServiceName || selection.serviceName,
          description: selection.subServiceName
            ? `${selection.serviceName} - ${selection.subServiceName}`
            : selection.serviceName,
          unitPrice: Number(selection.unitPrice || 0),
          serviceId: selection.serviceId,
          subServiceId: selection.subServiceId || "",
          catalogServiceName: selection.serviceName,
          catalogSubServiceName: selection.subServiceName || "",
        }));
      });
      const alreadySelected = currentItems.some((item) =>
        item.serviceId === serviceId && String(item.subServiceId || "") === subServiceId,
      );
      let nextItems = alreadySelected
        ? currentItems.filter((item) =>
          !(item.serviceId === serviceId && String(item.subServiceId || "") === subServiceId),
        )
        : [
          ...currentItems.filter((item) => item.name || item.serviceId),
          makeServiceItem(service, subService),
        ];
      if (nextItems.length === 0) nextItems = [createBlankItem()];
      return { ...prev, items: nextItems };
    });
  };

  const applyPackage = (packageId) => {
    const quotationPackage = catalog.packages.find((item) => String(item._id) === packageId);
    if (!quotationPackage) return;
    const serviceSelections = quotationPackage.selectedServices.map((selection) => {
      const service = catalog.services.find((item) => String(item._id) === selection.serviceId);
      const subService = service?.subServices?.find((item) => String(item._id) === selection.subServiceId);
      return {
        serviceId: selection.serviceId,
        subServiceId: selection.subServiceId || "",
        serviceName: selection.serviceName || service?.name || "",
        subServiceName: selection.subServiceName || subService?.name || "",
        unitPrice: Number(subService?.price ?? service?.price ?? 0),
      };
    });
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items.filter((item) => !item.serviceId && !item.packageId && item.name),
        {
          ...createBlankItem(),
          name: quotationPackage.name,
          description: quotationPackage.description || serviceSelections.map((selection) =>
            [selection.serviceName, selection.subServiceName].filter(Boolean).join(" - "),
          ).join(", "),
          unitPrice: Number(quotationPackage.price || 0),
          packageId: String(quotationPackage._id),
          serviceSelections,
        },
      ],
    }));
  };

  const updateDurationOption = (durationId) => {
    const option = catalog.durations.find((item) => String(item._id) === durationId);
    if (!option) {
      updateFormField("duration", { type: "", name: "", startDate: "", endDate: "", days: 0 });
      return;
    }
    const startDate = form.duration.startDate || "";
    updateFormField("duration", {
      type: option.custom ? "custom" : "fixed",
      name: option.name,
      startDate,
      endDate: option.custom ? form.duration.endDate : shiftDate(startDate, Number(option.days) - 1),
      days: option.custom ? Number(form.duration.days || 0) : Number(option.days),
    });
  };

  const updateDurationDate = (field, value) => {
    const option = catalog.durations.find((item) => item.name === form.duration.name);
    const nextDuration = { ...form.duration, [field]: value };
    if (field === "startDate" && option && !option.custom) {
      nextDuration.endDate = shiftDate(value, Number(option.days) - 1);
      nextDuration.days = Number(option.days);
    } else if (nextDuration.startDate && nextDuration.endDate) {
      const start = new Date(`${nextDuration.startDate}T00:00:00Z`);
      const end = new Date(`${nextDuration.endDate}T00:00:00Z`);
      nextDuration.days = Math.max(Math.floor((end - start) / 86400000) + 1, 0);
    }
    updateFormField("duration", nextDuration);
  };

  const updateServiceDraft = (serviceIndex, field, value) => {
    setServiceDrafts((prev) => prev.map((service, index) =>
      index === serviceIndex ? { ...service, [field]: value } : service,
    ));
  };

  const updateSubServiceDraft = (serviceIndex, subServiceIndex, field, value) => {
    setServiceDrafts((prev) => prev.map((service, index) => index === serviceIndex
      ? {
          ...service,
          subServices: service.subServices.map((subService, childIndex) =>
            childIndex === subServiceIndex ? { ...subService, [field]: value } : subService,
          ),
        }
      : service,
    ));
  };

  const saveService = async (service) => {
    try {
      await quotationApi.updateService(service._id, service);
      await loadCatalog();
      toast.success("Service and sub-services saved.");
    } catch (error) {
      toast.error(error.message || "Unable to save service.");
    }
  };

  const createService = async () => {
    try {
      if (!newService.name.trim()) {
        toast.error("Enter a service name.");
        return;
      }
      await quotationApi.createService(newService);
      setNewService({ name: "", description: "", price: 0, active: true, subServices: [] });
      await loadCatalog();
      toast.success("Service created.");
    } catch (error) {
      toast.error(error.message || "Unable to create service.");
    }
  };

  const deleteService = async (serviceId) => {
    try {
      await quotationApi.deleteService(serviceId);
      await loadCatalog();
      toast.success("Service and associated packages deleted.");
    } catch (error) {
      toast.error(error.message || "Unable to delete service.");
    }
  };

  const addPackageSelection = () => {
    const service = catalog.services.find((item) => String(item._id) === packageServiceId);
    const subService = service?.subServices?.find((item) => String(item._id) === packageSubServiceId);
    if (!service) return;
    const selection = {
      serviceId: String(service._id),
      subServiceId: subService ? String(subService._id) : "",
      serviceName: service.name,
      subServiceName: subService?.name || "",
    };
    setPackageDraft((prev) => ({
      ...prev,
      selectedServices: prev.selectedServices.some((item) =>
        item.serviceId === selection.serviceId && item.subServiceId === selection.subServiceId,
      ) ? prev.selectedServices : [...prev.selectedServices, selection],
    }));
  };

  const editPackage = (quotationPackage) => {
    setPackageDraft({
      _id: quotationPackage._id,
      name: quotationPackage.name,
      description: quotationPackage.description || "",
      price: quotationPackage.price,
      active: quotationPackage.active,
      selectedServices: quotationPackage.selectedServices.map((selection) => ({ ...selection })),
    });
  };

  const savePackage = async () => {
    try {
      const payload = {
        ...packageDraft,
        price: Number(packageDraft.price),
      };
      if (!payload.name.trim() || payload.selectedServices.length === 0) {
        toast.error("Enter a package name and select at least one service.");
        return;
      }
      if (packageDraft._id) await quotationApi.updatePackage(packageDraft._id, payload);
      else await quotationApi.createPackage(payload);
      setPackageDraft({ name: "", description: "", price: 0, active: true, selectedServices: [] });
      await loadCatalog();
      toast.success("Package saved.");
    } catch (error) {
      toast.error(error.message || "Unable to save package.");
    }
  };

  const deletePackage = async (packageId) => {
    try {
      await quotationApi.deletePackage(packageId);
      await loadCatalog();
      toast.success("Package deleted.");
    } catch (error) {
      toast.error(error.message || "Unable to delete package.");
    }
  };

  const saveDurations = async () => {
    try {
      await quotationApi.updateDurations(durationDrafts);
      await loadCatalog();
      toast.success("Duration options saved.");
    } catch (error) {
      toast.error(error.message || "Unable to save duration options.");
    }
  };

  const updateItem = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const nextItem = { ...item, [field]: value };
        if (["quantity", "unitPrice", "discountValue", "taxPercentage", "tax"].includes(field)) {
          nextItem.lineTotal = calculateLineTotal(nextItem);
        }
        return nextItem;
      }),
    }));
  };

  const updateAdditionalCharge = (field, value) => {
    setForm((prev) => {
      const currentCharges = prev.additionalCharges && typeof prev.additionalCharges === "object"
        ? prev.additionalCharges
        : { ...DEFAULT_FORM.additionalCharges, other: Number(prev.additionalCharges || 0) };
      return {
        ...prev,
        additionalCharges: { ...currentCharges, [field]: Number(value || 0) },
      };
    });
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items.filter((item) => item.name || item.serviceId), createBlankItem()],
    }));
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, itemIndex) => itemIndex !== index) : prev.items,
    }));
  };

  const handleSave = async () => {
    if (!form.customerName || !form.quotationDate || !form.validUntil || !form.items?.some((item) => item.name && item.name.trim())) {
      toast.error("Customer, quotation date, valid until, and at least one item are required.");
      return;
    }
    if ((!form.duration?.type && !selectedId) ||
      (form.duration?.type && (!form.duration.startDate || !form.duration.endDate || Number(form.duration.days) < 1))) {
      toast.error("Select a duration and provide valid start and end dates.");
      return;
    }
    if (form.duration?.startDate && form.duration?.endDate && form.duration.endDate < form.duration.startDate) {
      toast.error("The service end date cannot be before its start date.");
      return;
    }

    const totals = calculateTotals(form.items, form.additionalCharges);
    const payload = {
      ...form,
      client: form.clientId || null,
      companyDetails: {
        companyName: form.companyName || "Pearls IT Hub",
        email: form.email || "sales@pearlsit.com",
        phone: form.phone || "+0000000000",
      },
      customerDetails: {
        customerName: form.customerName,
        companyName: form.companyName,
        email: form.email,
        phone: form.phone,
        billingAddress: form.billingAddress,
        shippingAddress: form.shippingAddress,
      },
      items: form.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        discountValue: Number(item.discountValue || 0),
        taxPercentage: Number(item.taxPercentage || item.tax || 0),
        lineTotal: calculateLineTotal(item),
      })),
      duration: form.duration?.type
        ? {
            ...form.duration,
            days: Number(form.duration.days),
          }
        : undefined,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      additionalCharges: totals.additionalCharges,
      grandTotal: totals.grandTotal,
      status: form.status || "Draft",
    };

    try {
      let savedQuotation;
      if (selectedId) {
        savedQuotation = await quotationApi.update(selectedId, payload);
        toast.success("Quotation updated successfully.");
      } else {
        savedQuotation = await quotationApi.create(payload);
        toast.success("Quotation created successfully.");
      }

      await loadQuotations();
      setSelectedId(savedQuotation?._id || selectedId);
      navigateToQuotationPath();
    } catch (error) {
      toast.error(error.message || "Unable to save quotation.");
    }
  };

  const handleEdit = (quotation) => {
    setSelectedId(quotation._id || quotation.id);
    setForm({
      ...DEFAULT_FORM,
      ...quotation,
      currency: "INR",
      quotationDate: quotation.quotationDate ? new Date(quotation.quotationDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      validUntil: quotation.validUntil ? new Date(quotation.validUntil).toISOString().slice(0, 10) : "",
      duration: quotation.duration ? {
        ...quotation.duration,
        startDate: dateInputValue(quotation.duration.startDate),
        endDate: dateInputValue(quotation.duration.endDate),
      } : { type: "", name: "", startDate: "", endDate: "", days: 0 },
      customerName: quotation.customerName || quotation.customerDetails?.customerName || "",
      clientId: typeof quotation.client === "object" ? quotation.client?._id || "" : quotation.client || "",
      companyName: quotation.companyName || quotation.customerDetails?.companyName || "",
      email: quotation.email || quotation.customerDetails?.email || "",
      phone: quotation.phone || quotation.customerDetails?.phone || "",
      billingAddress: quotation.billingAddress || quotation.customerDetails?.billingAddress || "",
      shippingAddress: quotation.shippingAddress || quotation.customerDetails?.shippingAddress || "",
      items: Array.isArray(quotation.items) && quotation.items.length > 0 ? quotation.items.map((item, index) => ({
        ...item,
        id: item._id || `${Date.now()}-${index}`,
      })) : buildBlankForm().items,
      additionalCharges: typeof quotation.additionalCharges === "object"
        ? { ...DEFAULT_FORM.additionalCharges, ...quotation.additionalCharges }
        : { ...DEFAULT_FORM.additionalCharges, other: Number(quotation.additionalCharges || 0) },
    });
    navigateToQuotationPath("/create");
  };

  const openQuotationDetails = (quotation) => {
    setSelectedQuotation(quotation);
  };

  const closeQuotationDetails = () => {
    setSelectedQuotation(null);
  };

  const handleDuplicate = async (quotation) => {
    try {
      const duplicated = await quotationApi.duplicate(quotation._id);
      await loadQuotations();
      toast.success(`Created duplicate for ${duplicated?.quotationNumber || "quotation"}.`);
    } catch (error) {
      toast.error(error.message || "Unable to duplicate quotation.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await quotationApi.remove(id);
      await loadQuotations();
      toast.success("Quotation deleted successfully.");
    } catch (error) {
      toast.error(error.message || "Unable to delete quotation.");
    }
  };

  const printQuotation = (quotation) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Allow pop-ups to print the quotation.");
      return;
    }
    const customer = quotation.customerDetails || {};
    const items = (quotation.items || []).map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(item.name)}</strong><br><span>${escapeHtml(item.description || "")}</span></td>
        <td>${Number(item.quantity || 0)}</td>
        <td>${escapeHtml(toCurrency(item.unitPrice || 0))}</td>
        <td>${escapeHtml(toCurrency(item.lineTotal || calculateLineTotal(item)))}</td>
      </tr>`).join("");
    const duration = quotation.duration || {};
    const startDate = duration.startDate ? new Date(duration.startDate).toLocaleDateString() : "—";
    const endDate = duration.endDate ? new Date(duration.endDate).toLocaleDateString() : "—";
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(quotation.quotationNumber || "Quotation")}</title>
      <style>
        *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#102b65;margin:24px;font-size:12px}
        header{border-bottom:5px solid #1685e8;padding:8px 0 14px;display:flex;justify-content:space-between}
        h1{font-size:30px;margin:12px 0;color:#092b73}h2{font-size:16px;background:#06367d;color:#fff;padding:8px;margin:18px 0 0}
        .info{border:1px solid #1685e8;border-radius:8px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:7px}
        table{width:100%;border-collapse:collapse}th{background:#e8f2ff;color:#092b73}th,td{border:1px solid #9bb9e0;padding:9px;text-align:left}
        td span{color:#53647e}.totals{margin:18px 0 0 auto;width:300px}.totals div{display:flex;justify-content:space-between;padding:5px}
        .total{border-top:2px solid #123f8b;font-size:16px;font-weight:bold}.notes{margin-top:24px;white-space:pre-wrap}
        @media print{body{margin:12mm}}
      </style></head><body>
      <header><div><strong>${escapeHtml(quotation.companyDetails?.companyName || "Pearls IT Hub")}</strong><br>${escapeHtml(quotation.companyDetails?.phone || "")}</div><div>Quotation No.: ${escapeHtml(quotation.quotationNumber || "")}<br>Date: ${escapeHtml(dateInputValue(quotation.quotationDate))}</div></header>
      <h1>QUOTATION</h1>
      <h2>CLIENT DETAILS</h2><section class="info">
        <div>Client: <strong>${escapeHtml(customer.customerName || quotation.customerName || "")}</strong></div>
        <div>Company: <strong>${escapeHtml(customer.companyName || quotation.companyName || "")}</strong></div>
        <div>Email: ${escapeHtml(customer.email || quotation.email || "")}</div>
        <div>Phone: ${escapeHtml(customer.phone || quotation.phone || "")}</div>
        <div>Address: ${escapeHtml(customer.billingAddress || quotation.billingAddress || "")}</div>
        <div>Duration: <strong>${escapeHtml(duration.name || "—")}</strong> (${escapeHtml(startDate)} - ${escapeHtml(endDate)}${duration.days ? `, ${Number(duration.days)} days` : ""})</div>
      </section>
      <h2>SERVICE DETAILS</h2><table><thead><tr><th>S.No.</th><th>Service Description</th><th>Qty</th><th>Unit Price</th><th>Amount (INR)</th></tr></thead><tbody>${items}</tbody></table>
      <section class="totals"><div><span>Subtotal</span><strong>${escapeHtml(toCurrency(quotation.subtotal || 0))}</strong></div>
      <div><span>Discount</span><strong>-${escapeHtml(toCurrency(quotation.discount || 0))}</strong></div>
      <div><span>Tax</span><strong>${escapeHtml(toCurrency(quotation.tax || 0))}</strong></div>
      <div><span>Additional Charges</span><strong>${escapeHtml(toCurrency(quotation.additionalCharges || 0))}</strong></div>
      <div class="total"><span>Total</span><strong>${escapeHtml(toCurrency(quotation.grandTotal || 0))}</strong></div></section>
      <p class="notes"><strong>Payment terms:</strong> ${escapeHtml(quotation.paymentTerms || "—")}<br><strong>Notes:</strong> ${escapeHtml(quotation.notes || "—")}</p>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const tableColumns = [
    "Quotation Number",
    "Customer",
    "Company",
    "Date",
    "Valid Until",
    "Amount",
    "Status",
    "Approval",
    "Actions",
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Quotations", value: stats.total, icon: FileText, accent: "bg-blue-600" },
          { label: "Draft Quotations", value: stats.draft, icon: Pencil, accent: "bg-slate-600" },
          { label: "Pending Approval", value: stats.pendingApproval, icon: Filter, accent: "bg-amber-500" },
          { label: "Accepted Quotations", value: stats.accepted, icon: CheckCircle2, accent: "bg-emerald-600" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
              </div>
              <div className={`${card.accent} flex h-12 w-12 items-center justify-center rounded-xl text-white`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Quotations by Month</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => toCurrency(value)} />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Status Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData.statusCounts} dataKey="value" nameKey="name" outerRadius={80} innerRadius={40} paddingAngle={3}>
                  {chartData.statusCounts.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"][index % 5]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Recent Quotations</h3>
          <div className="space-y-3">
            {quotations.slice(0, 5).map((item) => (
              <div key={item._id || item.quotationNumber} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                <div>
                  <p className="font-semibold text-slate-900">{item.quotationNumber}</p>
                  <p className="text-sm text-slate-500">{item.customerName || item.customerDetails?.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{toCurrency(item.grandTotal || 0)}</p>
                  <p className="text-xs text-slate-500">{item.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Quick Actions</h3>
          <div className="space-y-2">
            <button onClick={() => navigateToQuotationPath("/create")} className="flex w-full items-center justify-between rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">
              <span>Create Quotation</span>
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={() => navigateToQuotationPath()} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
              <span>View All Quotations</span>
              <FileText className="h-4 w-4" />
            </button>
            <button onClick={() => navigateToQuotationPath()} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
              <span>Pending Approvals</span>
              <Filter className="h-4 w-4" />
            </button>
            <button onClick={() => navigateToQuotationPath("/templates")} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
              <span>Quotation Templates</span>
              <FileText className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAll = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none ring-0 transition focus:border-blue-400"
            placeholder="Search quotation number, customer, company or email"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All Departments</option>
            <option value="Sales">Sales</option>
            <option value="Marketing">Marketing</option>
           
          </select>

          <button onClick={() => navigateToQuotationPath("/create")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            <Plus className="h-4 w-4" />
            New Quotation
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                {tableColumns.map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableColumns.length} className="px-4 py-10 text-center text-slate-500">Loading quotations...</td>
                </tr>
              ) : filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length} className="px-4 py-10 text-center text-slate-500">No quotations found.</td>
                </tr>
              ) : (
                            filteredQuotations.map((quotation) => (
                              <tr
                                key={quotation._id || quotation.quotationNumber}
                                className="cursor-pointer border-t border-slate-200 align-top transition hover:bg-slate-50"
                                onClick={() => openQuotationDetails(quotation)}
                              >
                                <td className="px-4 py-3 font-medium text-slate-900" onClick={(event) => { event.stopPropagation(); openQuotationDetails(quotation); }}>
                                  {quotation.quotationNumber}
                                </td>
                                <td className="px-4 py-3">{quotation.customerName || quotation.customerDetails?.customerName || "—"}</td>
                                <td className="px-4 py-3">{quotation.companyName || quotation.customerDetails?.companyName || "—"}</td>
                                <td className="px-4 py-3">{quotation.quotationDate ? new Date(quotation.quotationDate).toLocaleDateString() : "—"}</td>
                                <td className="px-4 py-3">{quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "—"}</td>
                                <td className="px-4 py-3 font-semibold">{toCurrency(quotation.grandTotal || 0)}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">{quotation.status || "Draft"}</span>
                                </td>
                                <td className="px-4 py-3">{quotation.approvalStatus || "Pending"}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                                    <button onClick={() => handleEdit(quotation)} className="rounded-lg border border-slate-200 p-1.5 hover:border-blue-500">
                                      <Pencil className="h-4 w-4 text-slate-700" />
                        </button>
                                    <button onClick={() => handleDuplicate(quotation)} className="rounded-lg border border-slate-200 p-1.5 hover:border-emerald-500">
                                      <FileText className="h-4 w-4 text-emerald-700" />
                        </button>
                                    <button onClick={() => printQuotation(quotation)} className="rounded-lg border border-slate-200 p-1.5 hover:border-purple-500" aria-label="Print quotation">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-purple-700"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17.5v.5h16v-.5" /></svg>
                        </button>
                                    <button onClick={() => toast("Send quotation flow ready", { icon: "📨" })} className="rounded-lg border border-slate-200 p-1.5 hover:border-blue-500">
                                      <Send className="h-4 w-4 text-blue-700" />
                                    </button>
                                    <button onClick={() => handleDelete(quotation._id)} className="rounded-lg border border-slate-200 p-1.5 hover:border-red-500">
                                      <Trash2 className="h-4 w-4 text-red-700" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCreate = () => {
    const totals = calculateTotals(form.items, form.additionalCharges);

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedId ? "Edit Quotation" : "Create Quotation"}</h2>
              <p className="text-sm text-slate-500">Manage customer, product details, pricing and approval workflow.</p>
            </div>
            <button onClick={handleSave} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              {selectedId ? "Update Quotation" : "Save Quotation"}
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Company Details</h3>
              <input value={form.companyName} onChange={(event) => updateFormField("companyName", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Company Name" />
              <input value={form.email} onChange={(event) => updateFormField("email", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Company Email" />
              <input value={form.phone} onChange={(event) => updateFormField("phone", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Company Phone" />
              <textarea value={form.termsAndConditions} onChange={(event) => updateFormField("termsAndConditions", event.target.value)} rows="4" className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Terms & Conditions" />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Customer Details</h3>
            <select value={form.clientId || ""} onChange={(event) => selectClient(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5">
              <option value="">Select an existing client (or enter details below)</option>
              {clients.map((client) => (
                <option key={client._id} value={client._id}>
                  {client.projectName ? `${client.projectName} — ` : ""}{client.companyName}
                </option>
              ))}
            </select>
              <input value={form.customerName} onChange={(event) => updateFormField("customerName", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Customer Name" />
              <input value={form.companyName} onChange={(event) => updateFormField("companyName", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Customer Company" />
              <input value={form.email} onChange={(event) => updateFormField("email", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Customer Email" />
              <input value={form.phone} onChange={(event) => updateFormField("phone", event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Customer Phone" />
              <textarea value={form.billingAddress} onChange={(event) => updateFormField("billingAddress", event.target.value)} rows="2" className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Billing Address" />
              <textarea value={form.shippingAddress} onChange={(event) => updateFormField("shippingAddress", event.target.value)} rows="2" className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Shipping Address" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Quotation Information</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <input value={form.quotationNumber} onChange={(event) => updateFormField("quotationNumber", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Quotation Number" />
            <input type="date" value={form.quotationDate} onChange={(event) => updateFormField("quotationDate", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" />
            <input type="date" value={form.validUntil} onChange={(event) => updateFormField("validUntil", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" />
            <input value={form.salesPerson} onChange={(event) => updateFormField("salesPerson", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Sales Person" />
            <select value={form.department} onChange={(event) => updateFormField("department", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5">
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
            </select>
            <input value={form.referenceNumber} onChange={(event) => updateFormField("referenceNumber", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Reference Number" />
            <input value={form.relatedLead} onChange={(event) => updateFormField("relatedLead", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Related Lead" />
            <input value={form.relatedProject} onChange={(event) => updateFormField("relatedProject", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Related Project" />
            <input value={form.relatedDeal} onChange={(event) => updateFormField("relatedDeal", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Related Deal" />
            <input value={form.currency} onChange={(event) => updateFormField("currency", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Currency" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Service Duration</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <select
              value={catalog.durations.find((item) => item.name === form.duration?.name)?._id || ""}
              onChange={(event) => updateDurationOption(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5"
            >
              <option value="">Select duration</option>
              {catalog.durations.filter((item) => item.active).map((duration) => (
                <option key={duration._id} value={duration._id}>{duration.name}</option>
              ))}
            </select>
            <label className="text-sm text-slate-600">
              Start date
              <input type="date" value={form.duration?.startDate || ""} onChange={(event) => updateDurationDate("startDate", event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
            </label>
            <label className="text-sm text-slate-600">
              End date
              <input type="date" min={form.duration?.startDate || undefined} value={form.duration?.endDate || ""} onChange={(event) => updateDurationDate("endDate", event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
            </label>
            <div className="rounded-xl bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
              Calculated duration
              <p className="mt-1 font-semibold">
                {form.duration?.days > 0 ? `${form.duration.days} day${form.duration.days === 1 ? "" : "s"}` : "Set dates to calculate"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Main service category
              <select value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5">
                <option value="">Select a service</option>
                {catalog.services.filter((service) => service.active).map((service) => (
                  <option key={service._id} value={service._id}>{service.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Apply a saved package
              <select
                value=""
                onChange={(event) => applyPackage(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              >
                <option value="">Choose a package to use its price</option>
                {catalog.packages.filter((quotationPackage) => quotationPackage.active).map((quotationPackage) => (
                  <option key={quotationPackage._id} value={quotationPackage._id}>
                    {quotationPackage.name} — {toCurrency(quotationPackage.price)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedServiceId && (() => {
            const service = catalog.services.find((item) => String(item._id) === selectedServiceId);
            if (!service) return null;
            return (
              <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 font-semibold text-slate-900">{service.name} — select one or more services</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={isServiceSelectionActive(service._id)} onChange={() => toggleServiceSelection(service)} />
                      <span>{service.name} (Main service)</span>
                    </span>
                    <span className="font-medium">{toCurrency(service.price)}</span>
                  </label>
                  {service.subServices?.filter((subService) => subService.active).map((subService) => (
                    <label key={subService._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={isServiceSelectionActive(service._id, subService._id)} onChange={() => toggleServiceSelection(service, subService)} />
                        <span>{subService.name}</span>
                      </span>
                      <span className="font-medium">{toCurrency(subService.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Quotation Items</h3>
            <button onClick={addItem} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-slate-600">
                  <th className="px-2 py-2">Product</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">Unit</th>
                  <th className="px-2 py-2">Unit Price</th>
                  <th className="px-2 py-2">Discount</th>
                  <th className="px-2 py-2">Tax %</th>
                  <th className="px-2 py-2">Line Total</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, index) => (
                  <tr key={item.id || index} className="rounded-xl bg-slate-50">
                    <td className="px-2 py-2"><input value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-2" placeholder="Item name" /></td>
                    <td className="px-2 py-2"><input value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-2" placeholder="Description" /></td>
                    <td className="px-2 py-2"><input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, "quantity", Number(event.target.value))} className="w-20 rounded-lg border border-slate-200 px-2 py-2" /></td>
                    <td className="px-2 py-2"><input value={item.unit} onChange={(event) => updateItem(index, "unit", event.target.value)} className="w-20 rounded-lg border border-slate-200 px-2 py-2" /></td>
                    <td className="px-2 py-2"><input type="number" min="0" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", Number(event.target.value))} className="w-28 rounded-lg border border-slate-200 px-2 py-2" /></td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <select value={item.discountType} onChange={(event) => updateItem(index, "discountType", event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2">
                          <option value="none">None</option>
                          <option value="percent">%</option>
                          <option value="fixed">Fixed</option>
                        </select>
                        <input type="number" min="0" value={item.discountValue} onChange={(event) => updateItem(index, "discountValue", Number(event.target.value))} className="w-20 rounded-lg border border-slate-200 px-2 py-2" />
                      </div>
                    </td>
                    <td className="px-2 py-2"><input type="number" min="0" value={item.taxPercentage} onChange={(event) => updateItem(index, "taxPercentage", Number(event.target.value))} className="w-20 rounded-lg border border-slate-200 px-2 py-2" /></td>
                    <td className="px-2 py-2 font-semibold">{toCurrency(calculateLineTotal(item))}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeItem(index)} className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600">
                        <XCircle className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            {Object.keys(DEFAULT_FORM.additionalCharges).map((charge) => (
              <label key={charge} className="text-sm text-slate-600">
                {charge.charAt(0).toUpperCase() + charge.slice(1)} charge
                <input
                  type="number"
                  min="0"
                  value={form.additionalCharges?.[charge] || 0}
                  onChange={(event) => updateAdditionalCharge(charge, event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Subtotal</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{toCurrency(totals.subtotal)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Discount</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{toCurrency(totals.discount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Tax</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{toCurrency(totals.tax)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Additional Charges</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{toCurrency(totals.additionalCharges)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 lg:col-span-2">
              <p className="text-xs uppercase text-slate-500">Grand Total</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">{toCurrency(totals.grandTotal)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Payment Details</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <input value={form.paymentTerms} onChange={(event) => updateFormField("paymentTerms", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Payment Terms" />
            <input value={form.paymentMethod} onChange={(event) => updateFormField("paymentMethod", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Payment Method" />
            <input type="number" value={form.advancePayment} onChange={(event) => updateFormField("advancePayment", Number(event.target.value))} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Advance Payment" />
            <input type="number" value={form.balancePayment} onChange={(event) => updateFormField("balancePayment", Number(event.target.value))} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Balance Payment" />
            <input type="number" value={form.paymentDueDays} onChange={(event) => updateFormField("paymentDueDays", Number(event.target.value))} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Payment Due Days" />
            <input value={form.paymentInstructions} onChange={(event) => updateFormField("paymentInstructions", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Payment Instructions" />
          </div>
        </div>
      </div>
    );
  };

  const renderTemplates = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">Quotation Templates</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { name: "Standard Proposal", description: "General quotation for services and onboarding" },
          { name: "Product Quote", description: "Catalog and product-focused quote layout" },
          { name: "Maintenance Contract", description: "Support-based recurring revenue quotation" },
        ].map((template) => (
          <div key={template.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-lg font-semibold text-slate-900">{template.name}</p>
            <p className="mt-2 text-sm text-slate-600">{template.description}</p>
            <button onClick={() => navigateToQuotationPath("/create")} className="mt-4 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">Use Template</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <h2 className="text-xl font-bold text-slate-900">Quotation Settings</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Default Currency</p>
          <input defaultValue="INR" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Default Tax</p>
          <input defaultValue="5" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Approval Workflow</p>
          <input defaultValue="Manager / Admin Review" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Quotation Expiry Days</p>
          <input defaultValue="30" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
      </div>
    </div>
  );

  const renderCatalog = () => {
    if (!isAdmin) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Service and pricing configuration is available to administrators only.
        </div>
      );
    }

    const packageService = catalog.services.find((service) => String(service._id) === packageServiceId);
    const packageSubServices = packageService?.subServices || [];

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-900">Service catalog</h2>
            <p className="text-sm text-slate-500">Create service categories and configure their sub-services and standard prices.</p>
          </div>
          <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <h3 className="mb-3 font-semibold text-slate-900">Add service category</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <input value={newService.name} onChange={(event) => setNewService((prev) => ({ ...prev, name: event.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Service category name" />
              <input value={newService.description} onChange={(event) => setNewService((prev) => ({ ...prev, description: event.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Description" />
              <input type="number" min="0" value={newService.price} onChange={(event) => setNewService((prev) => ({ ...prev, price: Number(event.target.value) }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Main service price" />
            </div>
            <div className="mt-3 space-y-2">
              {newService.subServices.map((subService, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_140px_auto]">
                  <input value={subService.name} onChange={(event) => setNewService((prev) => ({ ...prev, subServices: prev.subServices.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Sub-service name" />
                  <input value={subService.description} onChange={(event) => setNewService((prev) => ({ ...prev, subServices: prev.subServices.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Description" />
                  <input type="number" min="0" value={subService.price} onChange={(event) => setNewService((prev) => ({ ...prev, subServices: prev.subServices.map((item, itemIndex) => itemIndex === index ? { ...item, price: Number(event.target.value) } : item) }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Price" />
                  <button onClick={() => setNewService((prev) => ({ ...prev, subServices: prev.subServices.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg border border-red-200 px-3 py-2 text-red-700">Remove</button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setNewService((prev) => ({ ...prev, subServices: [...prev.subServices, { name: "", description: "", price: 0, active: true }] }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">Add sub-service</button>
              <button onClick={createService} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" />Create service</button>
            </div>
          </div>

          {catalogLoading ? <p className="py-4 text-sm text-slate-500">Loading service catalog...</p> : (
            <div className="space-y-4">
              {serviceDrafts.map((service, serviceIndex) => (
                <div key={service._id} className="rounded-xl border border-slate-200 p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_150px_auto]">
                    <input value={service.name} onChange={(event) => updateServiceDraft(serviceIndex, "name", event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold" placeholder="Service category" />
                    <input value={service.description || ""} onChange={(event) => updateServiceDraft(serviceIndex, "description", event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Description" />
                    <input type="number" min="0" value={service.price} onChange={(event) => updateServiceDraft(serviceIndex, "price", Number(event.target.value))} className="rounded-lg border border-slate-200 px-3 py-2" aria-label="Main service price" />
                    <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={service.active} onChange={(event) => updateServiceDraft(serviceIndex, "active", event.target.checked)} />Active</label>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(service.subServices || []).map((subService, subServiceIndex) => (
                      <div key={subService._id || subServiceIndex} className="grid gap-2 md:grid-cols-[1fr_1fr_140px_auto_auto]">
                        <input value={subService.name} onChange={(event) => updateSubServiceDraft(serviceIndex, subServiceIndex, "name", event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Sub-service name" />
                        <input value={subService.description || ""} onChange={(event) => updateSubServiceDraft(serviceIndex, subServiceIndex, "description", event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Description" />
                        <input type="number" min="0" value={subService.price} onChange={(event) => updateSubServiceDraft(serviceIndex, subServiceIndex, "price", Number(event.target.value))} className="rounded-lg border border-slate-200 px-3 py-2" aria-label="Sub-service price" />
                        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={subService.active} onChange={(event) => updateSubServiceDraft(serviceIndex, subServiceIndex, "active", event.target.checked)} />Active</label>
                        <button onClick={() => updateServiceDraft(serviceIndex, "subServices", service.subServices.filter((_, index) => index !== subServiceIndex))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Remove</button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => updateServiceDraft(serviceIndex, "subServices", [...service.subServices, { name: "", description: "", price: 0, active: true }])} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">Add sub-service</button>
                    <button onClick={() => saveService(service)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"><Save className="h-4 w-4" />Save changes</button>
                    <button onClick={() => deleteService(service._id)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700"><Trash2 className="h-4 w-4" />Delete service</button>
                  </div>
                </div>
              ))}
              {!serviceDrafts.length && <p className="py-4 text-sm text-slate-500">No services configured yet.</p>}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Packages and combination pricing</h2>
          <p className="mb-4 text-sm text-slate-500">Define a fixed price for a selected combination of services.</p>
          <div className="grid gap-3 md:grid-cols-3">
            <input value={packageDraft.name} onChange={(event) => setPackageDraft((prev) => ({ ...prev, name: event.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Package name" />
            <input value={packageDraft.description} onChange={(event) => setPackageDraft((prev) => ({ ...prev, description: event.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Description" />
            <input type="number" min="0" value={packageDraft.price} onChange={(event) => setPackageDraft((prev) => ({ ...prev, price: Number(event.target.value) }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Package price" />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <select value={packageServiceId} onChange={(event) => { setPackageServiceId(event.target.value); setPackageSubServiceId(""); }} className="rounded-lg border border-slate-200 px-3 py-2">
              <option value="">Select category</option>
              {catalog.services.filter((service) => service.active).map((service) => <option key={service._id} value={service._id}>{service.name}</option>)}
            </select>
            <select value={packageSubServiceId} onChange={(event) => setPackageSubServiceId(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2">
              <option value="">Main service price</option>
              {packageSubServices.filter((subService) => subService.active).map((subService) => <option key={subService._id} value={subService._id}>{subService.name}</option>)}
            </select>
            <button onClick={addPackageSelection} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">Add selection</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {packageDraft.selectedServices.map((selection, index) => (
              <span key={`${selection.serviceId}-${selection.subServiceId}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800">
                {[selection.serviceName, selection.subServiceName].filter(Boolean).join(" — ")}
                <button aria-label="Remove package service" onClick={() => setPackageDraft((prev) => ({ ...prev, selectedServices: prev.selectedServices.filter((_, itemIndex) => itemIndex !== index) }))}><XCircle className="h-4 w-4" /></button>
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={packageDraft.active} onChange={(event) => setPackageDraft((prev) => ({ ...prev, active: event.target.checked }))} />Active package</label>
            <button onClick={savePackage} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"><Save className="h-4 w-4" />{packageDraft._id ? "Update package" : "Create package"}</button>
            {packageDraft._id && <button onClick={() => setPackageDraft({ name: "", description: "", price: 0, active: true, selectedServices: [] })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">Cancel edit</button>}
          </div>
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {catalog.packages.map((quotationPackage) => (
              <div key={quotationPackage._id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-semibold text-slate-900">{quotationPackage.name} <span className="font-normal text-slate-500">{toCurrency(quotationPackage.price)}</span></p>
                  <p className="text-xs text-slate-500">{quotationPackage.selectedServices.map((selection) => [selection.serviceName, selection.subServiceName].filter(Boolean).join(" — ")).join(", ")}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${quotationPackage.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{quotationPackage.active ? "Active" : "Inactive"}</span>
                  <button onClick={() => editPackage(quotationPackage)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Edit</button>
                  <button onClick={() => deletePackage(quotationPackage._id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700">Delete</button>
                </div>
              </div>
            ))}
            {!catalog.packages.length && <p className="p-3 text-sm text-slate-500">No packages configured.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Duration options</h2>
              <p className="text-sm text-slate-500">Configure the duration choices available while preparing a quotation.</p>
            </div>
            <button onClick={() => setDurationDrafts((prev) => [...prev, { name: "", days: 1, custom: false, active: true }])} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">Add duration</button>
          </div>
          <div className="space-y-2">
            {durationDrafts.map((duration, index) => (
              <div key={duration._id || index} className="grid gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-[1fr_150px_auto_auto_auto]">
                <input value={duration.name} onChange={(event) => setDurationDrafts((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Duration label" />
                <input type="number" min="1" disabled={duration.custom} value={duration.custom ? "" : duration.days} onChange={(event) => setDurationDrafts((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, days: Number(event.target.value) } : item))} className="rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100" placeholder="Days" />
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={duration.custom} onChange={(event) => setDurationDrafts((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, custom: event.target.checked, days: event.target.checked ? 0 : (item.days || 1) } : item))} />Custom dates</label>
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={duration.active} onChange={(event) => setDurationDrafts((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item))} />Active</label>
                <button onClick={() => setDurationDrafts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Remove</button>
              </div>
            ))}
          </div>
          <button onClick={saveDurations} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"><Save className="h-4 w-4" />Save duration options</button>
        </div>
      </div>
    );
  };

  const details = selectedQuotation
    ? {
        customerName: selectedQuotation.customerName || selectedQuotation.customerDetails?.customerName || "—",
        companyName: selectedQuotation.companyName || selectedQuotation.customerDetails?.companyName || "—",
        email: selectedQuotation.email || selectedQuotation.customerDetails?.email || "—",
        phone: selectedQuotation.phone || selectedQuotation.customerDetails?.phone || "—",
        quotationDate: selectedQuotation.quotationDate ? new Date(selectedQuotation.quotationDate).toLocaleDateString() : "—",
        validUntil: selectedQuotation.validUntil ? new Date(selectedQuotation.validUntil).toLocaleDateString() : "—",
        paymentTerms: selectedQuotation.paymentTerms || "—",
        status: selectedQuotation.status || "Draft",
        approvalStatus: selectedQuotation.approvalStatus || "Pending",
        grandTotal: selectedQuotation.grandTotal || 0,
        subtotal: selectedQuotation.subtotal || 0,
        tax: selectedQuotation.tax || 0,
        additionalCharges: selectedQuotation.additionalCharges || 0,
        discount: selectedQuotation.discount || 0,
        durationName: selectedQuotation.duration?.name || "—",
        durationStart: selectedQuotation.duration?.startDate ? new Date(selectedQuotation.duration.startDate).toLocaleDateString() : "—",
        durationEnd: selectedQuotation.duration?.endDate ? new Date(selectedQuotation.duration.endDate).toLocaleDateString() : "—",
        durationDays: selectedQuotation.duration?.days || 0,
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Quotation Management</h1>
                <p className="text-sm text-slate-500">Sales and marketing quotation operations</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {TABS.filter((tab) => tab.key !== "catalog" || isAdmin).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => navigateToQuotationPath(tab.key === "overview" || tab.key === "all" ? "" : `/${tab.key}`)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${
                    activeTab === tab.key
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeTab === "overview" && renderOverview()}
        {activeTab === "all" && renderAll()}
        {activeTab === "create" && renderCreate()}
        {activeTab === "templates" && renderTemplates()}
        {activeTab === "settings" && renderSettings()}
        {activeTab === "catalog" && renderCatalog()}

        {selectedQuotation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.12em] text-blue-600">Quotation Details</p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">{selectedQuotation.quotationNumber}</h3>
                </div>
                <button onClick={closeQuotationDetails} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-slate-300 hover:text-slate-700">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Customer</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{details.customerName}</p>
                  <p className="text-sm text-slate-600">{details.companyName}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Status</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">{details.status}</span>
                    <span className="text-sm text-slate-500">Approval: {details.approvalStatus}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Contact</p>
                  <p className="mt-2 text-sm text-slate-700">Email: {details.email}</p>
                  <p className="text-sm text-slate-700">Phone: {details.phone}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Validity</p>
                  <p className="mt-2 text-sm text-slate-700">Issued: {details.quotationDate}</p>
                  <p className="text-sm text-slate-700">Valid Until: {details.validUntil}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Service Duration</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">{details.durationName}</p>
                  <p className="text-sm text-slate-700">{details.durationStart} – {details.durationEnd}</p>
                  {details.durationDays > 0 && <p className="text-sm text-slate-700">{details.durationDays} days</p>}
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-slate-900">Line Items</h4>
                  <p className="text-sm text-slate-500">Payment Terms: {details.paymentTerms}</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Item</th>
                        <th className="px-3 py-2 font-semibold">Qty</th>
                        <th className="px-3 py-2 font-semibold">Unit Price</th>
                        <th className="px-3 py-2 font-semibold">Tax</th>
                        <th className="px-3 py-2 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedQuotation.items || []).map((item, index) => (
                        <tr key={item._id || item.id || `${item.name}-${index}`} className="border-t border-slate-200">
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900">{item.name || "Unnamed item"}</p>
                            <p className="text-xs text-slate-500">{item.description || "No description"}</p>
                          </td>
                          <td className="px-3 py-2">{item.quantity || 0}</td>
                          <td className="px-3 py-2">{toCurrency(item.unitPrice || 0)}</td>
                          <td className="px-3 py-2">{Number(item.taxPercentage || item.tax || 0)}%</td>
                          <td className="px-3 py-2 font-semibold">{toCurrency(item.lineTotal || calculateLineTotal(item))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Notes</p>
                  <p className="mt-2 text-sm text-slate-600">{selectedQuotation.notes || "No notes provided."}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-2 text-sm text-slate-700">
                    <div className="flex justify-between"><span>Subtotal</span><span>{toCurrency(details.subtotal)}</span></div>
                    <div className="flex justify-between"><span>Discount</span><span>-{toCurrency(details.discount)}</span></div>
                    <div className="flex justify-between"><span>Tax</span><span>{toCurrency(details.tax)}</span></div>
                    <div className="flex justify-between"><span>Additional Charges</span><span>{toCurrency(details.additionalCharges)}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Total</span><span>{toCurrency(details.grandTotal)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
