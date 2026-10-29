import React, { useState, useEffect, useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { DataTable, Column } from "../../components/ui/DataTable";
import { Modal } from "../../components/ui/Modal";
import {
  Truck,
  Plus,
  Trash2,
  X,
  Warehouse,
  Receipt,
  FileCheck,
  DollarSign,
  AlertCircle,
  Eye,
  CheckCircle2,
  Search,
  FileText,
  Calendar,
  Filter,
  Download,
  RotateCcw,
  Check,
  Building2,
  User,
  ArrowRight,
  ExternalLink,
  Layers,
  Info,
} from "lucide-react";
import {
  CustomerSearchModal,
  ProductSearchModal,
} from "../../components/search";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { showConfirmQuestion } from "../../lib/sweetalert";
import { formatMoneyUSD, formatMoneyVES } from "@ero/shared";
import { PdfViewerModal } from "../../components/ui/PdfViewerModal";

interface DeliveryNoteRecord {
  id: string;
  deliveryNumber: string;
  deliveryDate: string;
  currency: "USD" | "VES";
  exchangeRate: number;
  totalAmount: number;
  driverName?: string | null;
  vehiclePlate?: string | null;
  status: "DELIVERED" | "INVOICED" | "ANNULLED";
  salesInvoiceId?: string | null;
  notes?: string | null;
  customerName: string;
  customerDoc: string;
  warehouseName: string;
  branchName: string;
  dispatchedByUserName: string;
  quotationId?: string | null;
  quotationNumber?: string | null;
  quotationStatus?:
    | "DRAFT"
    | "EMITTED"
    | "ACCEPTED"
    | "CONVERTED"
    | "REJECTED"
    | "EXPIRED"
    | null;
  quotationSubtotalAmount?: number | null;
  quotationTaxAmount?: number | null;
  quotationTotalAmount?: number | null;
  quotationTotalQuantity?: number | null;
  quotationDeliveredQuantity?: number | null;
  quotationDeliveredTotal?: number | null;
}

interface DeliveryNoteDetailItem {
  id: string;
  deliveryNoteId: string;
  productId: string;
  quantityDelivered: number;
  unitPrice: number;
  unitCost?: number;
  total: number;
  notes?: string | null;
  productSku: string;
  productName: string;
  unitOfMeasure?: string;
}

interface DeliveryNoteDetail extends DeliveryNoteRecord {
  customerPhone?: string | null;
  customerAddress?: string | null;
  items: DeliveryNoteDetailItem[];
}

interface NewDeliveryItem {
  productId: string;
  productName: string;
  sku: string;
  quantityDelivered: number;
  unitPrice: number;
  total: number;
  notes?: string;
  quotationItemId?: string | null;
}

interface CustomerSummary {
  id: string;
  name: string;
  doc: string;
  creditEnabled: number | boolean;
  creditLimit: number;
  deliveryNotesCount: number;
  quotationsCount: number;
  activeQuotationsCount: number;
}

interface QuotationOption {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntilDate: string;
  currency: string;
  totalAmount: number;
  status:
    | "DRAFT"
    | "EMITTED"
    | "ACCEPTED"
    | "CONVERTED"
    | "REJECTED"
    | "EXPIRED";
  customerName: string;
  customerDoc: string;
  customerId: string;
  itemsCount?: number;
  deliveredAmount?: number;
  totalQuotedQuantity?: number;
  totalDeliveredQuantity?: number;
  pendingItemsCount?: number;
  isFullyDelivered?: boolean;
}

export const DeliveryNotesView: React.FC = () => {
  const { activeBranchId, activeWarehouseId, token } = useAuthStore();
  const [deliveries, setDeliveries] = useState<DeliveryNoteRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Catálogos desde BD
  const [availableProducts, setAvailableProducts] = useState<
    {
      id: string;
      sku: string;
      name: string;
      basePrice: number;
      availableStock: number;
    }[]
  >([]);
  const [availableCustomers, setAvailableCustomers] = useState<
    { id: string; name: string; doc: string; isBlocked?: boolean; blockReason?: string }[]
  >([]);
  const [customersSummary, setCustomersSummary] = useState<CustomerSummary[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    activeWarehouseId || "",
  );

  // Filtros Avanzados
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [customerFilterType, setCustomerFilterType] = useState<
    "ALL" | "WITH_DELIVERIES" | "WITH_QUOTATIONS"
  >("ALL");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [originFilter, setOriginFilter] = useState<
    "ALL" | "FROM_QUOTATION" | "DIRECT"
  >("ALL");
  const [startDate, setStartDate] = useState<string>("");

  const [endDate, setEndDate] = useState<string>("");

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportQuotationOpen, setIsImportQuotationOpen] = useState(false);
  const [quotationsList, setQuotationsList] = useState<QuotationOption[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [quotationSearch, setQuotationSearch] = useState("");

  const [viewingDelivery, setViewingDelivery] =
    useState<DeliveryNoteDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [invoicingDelivery, setInvoicingDelivery] =
    useState<DeliveryNoteRecord | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [productSearchRowIdx, setProductSearchRowIdx] = useState<number | null>(
    null,
  );
  const [isAddingFromSearch, setIsAddingFromSearch] = useState(false);
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    endpoint: string | null;
    title: string;
    filename?: string;
  }>({
    isOpen: false,
    endpoint: null,
    title: "",
  });



  // Formulario Nueva Nota de Entrega
  const [customerId, setCustomerId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [quotationRef, setQuotationRef] = useState("");
  const [selectedQuotation, setSelectedQuotation] = useState<{
    id: string;
    number: string;
    total: number;
    status: string;
  } | null>(null);
  const [exchangeRate, setExchangeRate] = useState(36.85);
  const [deliveryNotesText, setDeliveryNotesText] = useState("");
  const [deliveryItems, setDeliveryItems] = useState<NewDeliveryItem[]>([]);

  // Formulario Facturación de Nota de Entrega
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [controlNumber, setControlNumber] = useState("");
  const [isCredit, setIsCredit] = useState(true);
  const [dueDate, setDueDate] = useState("");

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const params = new URLSearchParams();
      if (activeBranchId) params.append("branchId", activeBranchId);
      if (activeWarehouseId) params.append("warehouseId", activeWarehouseId);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (selectedCustomerId) params.append("customerId", selectedCustomerId);
      if (originFilter === "FROM_QUOTATION") params.append("hasQuotation", "true");
      if (originFilter === "DIRECT") params.append("hasQuotation", "false");
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/sales/deliveries?${params.toString()}`, {
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setDeliveries(json.data);
        } else {
          setDeliveries([]);
        }
      } else {
        setDeliveries([]);
      }
    } catch {
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [custRes, prodRes, branchRes, summaryRes] = await Promise.all([
        fetch("/api/customers", { headers }),
        fetch("/api/inventory/products", { headers }),
        fetch("/api/auth/branches", { headers }),
        fetch("/api/sales/customers-summary", { headers }),
      ]);

      if (custRes.ok) {
        const cJson = await custRes.json();
        if (cJson.success && Array.isArray(cJson.data)) {
          const mapped = cJson.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            doc: `${c.docType || "J"}-${c.docNumber || ""}`,
            isBlocked: Boolean(c.isBlocked ?? c.is_blocked ?? (c.status === 'BLOCKED')),
            blockReason: c.blockReason || c.block_reason,
          }));
          setAvailableCustomers(mapped);
          const firstActive = mapped.find((c: any) => !c.isBlocked);
          if (firstActive && !customerId) {
            setCustomerId(firstActive.id);
          }
        }
      }

      if (summaryRes.ok) {
        const sJson = await summaryRes.json();
        if (sJson.success && Array.isArray(sJson.data)) {
          setCustomersSummary(sJson.data);
        }
      }

      if (prodRes.ok) {
        const pJson = await prodRes.json();
        if (pJson.success && Array.isArray(pJson.data)) {
          const mapped = pJson.data.map((p: any) => ({
            id: p.id,
            sku: p.sku || "",
            name: p.name || "",
            basePrice: Number(p.basePrice || p.price || 0),
            availableStock: Number(p.totalStock ?? p.stock ?? 0),
          }));
          setAvailableProducts(mapped);
        }
      }

      if (branchRes.ok) {
        const bJson = await branchRes.json();
        if (bJson.success && Array.isArray(bJson.data)) {
          const allWh: { id: string; name: string }[] = [];
          let defaultSalesWhId = "";
          bJson.data.forEach((b: any) => {
            if (Array.isArray(b.warehouses)) {
              b.warehouses.forEach((w: any) => {
                allWh.push({ id: w.id, name: `${b.name} - ${w.name}` });
                if (w.isDefaultSales && !defaultSalesWhId) {
                  defaultSalesWhId = w.id;
                }
              });
            }
          });
          setWarehouses(allWh);
          if (allWh.length > 0 && !selectedWarehouseId) {
            setSelectedWarehouseId(defaultSalesWhId || allWh[0].id);
          }
        }
      }
    } catch {
      // Ignorar errores en carga inicial
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [
    activeBranchId,
    activeWarehouseId,
    token,
    statusFilter,
    selectedCustomerId,
    originFilter,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    fetchCatalogs();
  }, [activeBranchId, token]);

  const totalDeliveryAmount = deliveryItems.reduce(
    (acc, i) => acc + i.total,
    0,
  );

  const filteredCustomersForDropdown = useMemo(() => {
    if (customerFilterType === "WITH_DELIVERIES") {
      return customersSummary.filter((c) => Number(c.deliveryNotesCount) > 0);
    }
    if (customerFilterType === "WITH_QUOTATIONS") {
      return customersSummary.filter((c) => Number(c.quotationsCount) > 0);
    }
    return customersSummary.length > 0
      ? customersSummary
      : availableCustomers.map((c) => ({
          ...c,
          creditEnabled: false,
          creditLimit: 0,
          deliveryNotesCount: 0,
          quotationsCount: 0,
          activeQuotationsCount: 0,
        }));
  }, [customersSummary, customerFilterType, availableCustomers]);

  const handleOpenCreateModal = () => {
    if (availableProducts.length > 0 && deliveryItems.length === 0) {
      const prod = availableProducts[0];
      setDeliveryItems([
        {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantityDelivered: 1,
          unitPrice: prod.basePrice,
          total: Number((1 * prod.basePrice).toFixed(2)),
        },
      ]);
    }
    setIsCreateOpen(true);
  };

  const handleOpenImportModal = async () => {
    setIsImportQuotationOpen(true);
    setLoadingQuotations(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const params = new URLSearchParams();
      if (activeBranchId) params.append("branchId", activeBranchId);
      params.append("forDelivery", "true");
      const res = await fetch(`/api/sales/quotations?${params.toString()}`, {
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setQuotationsList(json.data);
        } else {
          setQuotationsList([]);
        }
      } else {
        setQuotationsList([]);
      }
    } catch {
      setQuotationsList([]);
    } finally {
      setLoadingQuotations(false);
    }
  };

  const handleSelectQuotationToImport = async (quot: QuotationOption) => {
    // Validar que esté previamente facturada
    if (quot.status !== "CONVERTED") {
      toast.error(
        `Solo se pueden despachar cotizaciones previamente facturadas. La cotización ${quot.quotationNumber} no ha sido facturada aún.`,
      );
      return;
    }

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/sales/quotations/${quot.id}`, { headers });
      if (!res.ok) {
        toast.error("No se pudo obtener el detalle de la cotización");
        return;
      }
      const json = await res.json();
      if (!json.success || !json.data) {
        toast.error("Error al procesar la cotización");
        return;
      }

      const fullQuot = json.data;
      if (!Array.isArray(fullQuot.items) || fullQuot.items.length === 0) {
        toast.error("La cotización no contiene productos para despachar");
        return;
      }

      // Filtrar únicamente los ítems que aún tengan cantidades pendientes por entregar
      const itemsWithPending = fullQuot.items.filter((i: any) => {
        const pending =
          i.quantityPending !== undefined
            ? Number(i.quantityPending)
            : Number(i.quantity);
        return pending > 0;
      });

      if (itemsWithPending.length === 0) {
        toast.error(
          `La cotización ${fullQuot.quotationNumber} ya fue entregada al 100%. No posee productos pendientes por despachar.`,
        );
        return;
      }

      const targetCustomerId = fullQuot.customerId || quot.customerId;
      const targetCust = availableCustomers.find((c) => c.id === targetCustomerId);
      if (targetCust?.isBlocked) {
        toast.error(
          `La cotización ${fullQuot.quotationNumber} pertenece al cliente "${targetCust.name}" que se encuentra BLOQUEADO. Motivo: ${targetCust.blockReason || 'Consulte con administración'}. No se permite emitir notas de entrega.`
        );
        return;
      }

      setCustomerId(targetCustomerId);
      setSelectedQuotation({
        id: fullQuot.id,
        number: fullQuot.quotationNumber,
        total: Number(fullQuot.totalAmount || 0),
        status: fullQuot.status,
      });
      setQuotationRef(fullQuot.quotationNumber);

      const mapped: NewDeliveryItem[] = itemsWithPending.map((i: any) => {
        const qtyToDeliver =
          i.quantityPending !== undefined && Number(i.quantityPending) > 0
            ? Number(i.quantityPending)
            : Number(i.quantity || 1);

        return {
          productId: i.productId,
          productName: i.productName || "",
          sku: i.productSku || "",
          quantityDelivered: qtyToDeliver,
          unitPrice: Number(i.unitPrice || 0),
          total: Number((qtyToDeliver * (i.unitPrice || 0)).toFixed(2)),
          notes:
            i.notes ||
            (Number(i.quantityDelivered || 0) > 0
              ? `Entrega restante (${qtyToDeliver} de ${i.quantity} cotizados)`
              : undefined),
          quotationItemId: i.id || null,
        };
      });

      setDeliveryItems(mapped);
      setIsImportQuotationOpen(false);
      setIsCreateOpen(true);
      toast.success(
        `Cotización facturada ${fullQuot.quotationNumber} importada con ${mapped.length} producto(s) pendiente(s) por despachar.`,
      );
    } catch {
      toast.error("Error de comunicación con el servidor al importar");
    }
  };

  const handleClearQuotationBinding = () => {
    setSelectedQuotation(null);
    setQuotationRef("");
    toast.info("Vinculación con cotización eliminada. Despacho directo.");
  };

  const handleViewDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/sales/deliveries/${id}`, { headers });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setViewingDelivery(json.data);

        } else {
          toast.error("No se pudo obtener el detalle de la nota de entrega");
        }
      } else {
        toast.error("Error al consultar el despacho");
      }
    } catch {
      toast.error("Error de comunicación con el servidor");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddItem = () => {
    if (availableProducts.length === 0) {
      toast.error("No hay productos disponibles en el catálogo");
      return;
    }
    const prod = availableProducts[0];
    setDeliveryItems([
      ...deliveryItems,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantityDelivered: 1,
        unitPrice: prod.basePrice,
        total: Number((1 * prod.basePrice).toFixed(2)),
      },
    ]);
  };

  const handleAddItemWithProduct = (prod: any) => {
    const unitPrice = Number(prod.basePrice ?? prod.salePrice ?? 0);
    setDeliveryItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantityDelivered: 1,
        unitPrice,
        total: Number((1 * unitPrice).toFixed(2)),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (deliveryItems.length === 1) {
      toast.error("Debe incluir al menos un producto a despachar");
      return;
    }
    setDeliveryItems(deliveryItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...deliveryItems];
    const item = updated[index];

    if (field === "productId") {
      const p = availableProducts.find((pr) => pr.id === val);
      if (p) {
        item.productId = p.id;
        item.productName = p.name;
        item.sku = p.sku;
        item.unitPrice = p.basePrice;
      }
    } else if (field === "quantityDelivered") {
      item.quantityDelivered = Number(val);
    } else if (field === "unitPrice") {
      item.unitPrice = Number(val);
    } else if (field === "notes") {
      item.notes = val;
    }

    item.total = Number((item.quantityDelivered * item.unitPrice).toFixed(2));
    setDeliveryItems(updated);
  };

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deliveryItems.length === 0) {
      toast.error("Debe incluir al menos un producto a despachar");
      return;
    }
    if (!customerId) {
      toast.error("Debe seleccionar un cliente destinatario");
      return;
    }
    const customer = availableCustomers.find((c) => c.id === customerId);
    if (customer?.isBlocked) {
      toast.error(
        `El cliente "${customer.name}" está BLOQUEADO. Motivo: ${customer.blockReason || 'Consulte con administración'}. No puede emitirse la nota de entrega.`
      );
      return;
    }
    const whId = selectedWarehouseId || activeWarehouseId;
    if (!whId) {
      toast.error("Debe seleccionar el depósito de salida");
      return;
    }
    if (!activeBranchId) {
      toast.error("Debe seleccionar una sucursal activa");
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: "¿Emitir nota de entrega?",
      text: `Se procesará el despacho por un monto de ${formatMoneyUSD(totalDeliveryAmount)} y se rebajará el stock del depósito.`,
      confirmButtonText: "Sí, emitir despacho",
    });
    if (!confirmed) return;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/sales/deliveries", {
        method: "POST",
        headers,
        body: JSON.stringify({
          branchId: activeBranchId,
          warehouseId: whId,
          customerId,
          quotationId: selectedQuotation ? selectedQuotation.id : undefined,
          driverName: driverName.trim() || undefined,
          vehiclePlate: vehiclePlate.trim() || undefined,
          currency: "USD",
          exchangeRate,
          notes: deliveryNotesText.trim() || undefined,
          items: deliveryItems.map((item) => ({
            productId: item.productId,
            quotationItemId: item.quotationItemId || undefined,
            quantityDelivered: item.quantityDelivered,
            unitPrice: item.unitPrice,
            notes: item.notes || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          `Nota de Entrega procesada. Stock rebajado en depósito y Kardex actualizado.`,
        );
        setIsCreateOpen(false);
        setDeliveryItems([]);
        setDriverName("");
        setVehiclePlate("");
        setDeliveryNotesText("");
        setSelectedQuotation(null);
        setQuotationRef("");
        fetchDeliveries();

        // Abrir inmediatamente la visualización y descarga en PDF
        if (json.data?.id) {
          setPdfModal({
            isOpen: true,
            endpoint: `/api/sales/deliveries/${json.data.id}/pdf`,
            title: `Nota de Entrega N° ${json.data.deliveryNumber || ""}`,
            filename: `nota_entrega_${json.data.deliveryNumber || "doc"}.pdf`,
          });
        }
      } else {
        toast.error(
          json.error?.message || "Error al emitir la nota de entrega",
        );
      }
    } catch {
      toast.error("Error de comunicación con el servidor");
    }
  };

  const handleInvoiceDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoicingDelivery) return;
    if (!invoiceNumber.trim()) {
      toast.error("El número de factura fiscal es obligatorio");
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: "¿Facturar despacho a CxC?",
      text: `Se generará la factura fiscal ${invoiceNumber} vinculada a la nota de entrega ${invoicingDelivery.deliveryNumber}.`,
      confirmButtonText: "Sí, facturar despacho",
    });
    if (!confirmed) return;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/sales/deliveries/to-invoice", {
        method: "POST",
        headers,
        body: JSON.stringify({
          deliveryNoteId: invoicingDelivery.id,
          invoiceNumber: invoiceNumber.trim(),
          controlNumber: controlNumber.trim() || undefined,
          isCredit,
          dueDate: isCredit && dueDate ? dueDate : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          `Factura ${invoiceNumber} generada para la Nota de Entrega. Registrada en Cuentas por Cobrar (CxC).`,
        );
        setInvoicingDelivery(null);
        setInvoiceNumber("");
        setControlNumber("");
        fetchDeliveries();
      } else {
        toast.error(
          json.error?.message ||
            "Error al convertir la nota de entrega a factura",
        );
      }
    } catch {
      toast.error("Error de comunicación con el servidor");
    }
  };

  const renderQuotationStatusBadge = (status?: string | null) => {
    switch (status) {
      case "ACCEPTED":
        return (
          <Badge variant="success" className="text-[10px]">
            Cotiz. Aprobada
          </Badge>
        );
      case "EMITTED":
        return (
          <Badge variant="info" className="text-[10px]">
            Cotiz. Emitida
          </Badge>
        );
      case "CONVERTED":
        return (
          <Badge
            variant="neutral"
            className="text-[10px] bg-purple-100 text-purple-700 border-purple-200"
          >
            Cotiz. Facturada
          </Badge>
        );
      case "DRAFT":
        return (
          <Badge variant="neutral" className="text-[10px]">
            Cotiz. Borrador
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="danger" className="text-[10px]">
            Cotiz. Rechazada
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="warning" className="text-[10px]">
            Cotiz. Vencida
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" className="text-[10px]">
            Cotización
          </Badge>
        );
    }
  };

  const hasActiveFilters = Boolean(
    statusFilter !== "ALL" ||
      customerFilterType !== "ALL" ||
      selectedCustomerId ||
      originFilter !== "ALL" ||
      startDate ||
      endDate,
  );

  const handleClearFilters = () => {
    setStatusFilter("ALL");
    setCustomerFilterType("ALL");
    setSelectedCustomerId("");
    setOriginFilter("ALL");
    setStartDate("");
    setEndDate("");
  };

  const filteredQuotationsForImport = useMemo(() => {
    return quotationsList.filter((q) => {
      // Regla de Negocio: Solo cotizaciones facturadas (CONVERTED)
      if (q.status !== "CONVERTED") return false;

      // Regla de Negocio: No mostrar cotizaciones ya entregadas al 100%
      if (q.isFullyDelivered) return false;
      if (
        q.pendingItemsCount !== undefined &&
        Number(q.pendingItemsCount) <= 0 &&
        Number(q.itemsCount || 0) > 0
      ) {
        return false;
      }
      if (
        q.totalQuotedQuantity &&
        q.totalDeliveredQuantity &&
        Number(q.totalDeliveredQuantity) >= Number(q.totalQuotedQuantity) &&
        Number(q.totalQuotedQuantity) > 0
      ) {
        return false;
      }

      if (!quotationSearch.trim()) return true;
      const term = quotationSearch.toLowerCase();
      return (
        q.quotationNumber.toLowerCase().includes(term) ||
        q.customerName.toLowerCase().includes(term) ||
        q.customerDoc.toLowerCase().includes(term)
      );
    });
  }, [quotationsList, quotationSearch]);

  const columns: Column<DeliveryNoteRecord>[] = [
    {
      header: "Nº Despacho",
      accessorKey: "deliveryNumber",
      cell: (item) => (
        <span className="font-mono text-xs font-semibold text-emerald-700">
          {item.deliveryNumber}
        </span>
      ),
    },
    {
      header: "Fecha Emisión",
      accessorKey: "deliveryDate",
      cell: (item) => (
        <span className="text-xs text-neutral-700">
          {new Date(item.deliveryDate).toLocaleDateString("es-VE")}
        </span>
      ),
    },
    {
      header: "Cliente & Documento",
      accessorKey: "customerName",
      cell: (item) => (
        <div>
          <p className="text-xs font-medium text-neutral-400">
            {item.customerName}
          </p>
          <span className="font-mono text-[10px] text-neutral-500">
            {item.customerDoc}
          </span>
        </div>
      ),
    },
    {
      header: "Cotización / Estado",
      accessorKey: "quotationNumber",
      cell: (item) =>
        item.quotationNumber ? (
          <div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-600" />
              <span className="font-mono text-xs font-semibold text-sky-700">
                {item.quotationNumber}
              </span>
            </div>
            <div className="mt-1">
              {renderQuotationStatusBadge(item.quotationStatus)}
            </div>
          </div>
        ) : (
          <Badge
            variant="neutral"
            className="text-[10px] text-neutral-500 border-neutral-200 bg-neutral-50"
          >
            Despacho Directo
          </Badge>
        ),
    },
    {
      header: "Depósito Salida",
      accessorKey: "warehouseName",
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
          <Warehouse className="w-3.5 h-3.5 text-neutral-400" />
          <span>{item.warehouseName}</span>
        </div>
      ),
    },
    {
      header: "Transporte / Conductor",
      accessorKey: "driverName",
      cell: (item) =>
        item.driverName ? (
          <div className="text-xs text-neutral-700">
            <p className="font-medium">{item.driverName}</p>
            {item.vehiclePlate && (
              <span className="font-mono text-[10px] text-neutral-500">
                Placa: {item.vehiclePlate}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-neutral-400 italic">
            Entrega en Mostrador
          </span>
        ),
    },
    {
      header: "Monto Total",
      accessorKey: "totalAmount",
      cell: (item) => (
        <div className="text-right font-mono">
          <p className="text-xs font-semibold text-neutral-400">
            {formatMoneyUSD(item.totalAmount)}
          </p>
          <p className="text-[10px] text-neutral-500">
            {formatMoneyVES(item.totalAmount * item.exchangeRate)}
          </p>
        </div>
      ),
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: (item) =>
        item.status === "DELIVERED" ? (
          <Badge variant="info" className="text-[10px]">
            Despachada / Pendiente Factura
          </Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">
            Facturada en CxC
          </Badge>
        ),
    },
    {
      header: "Acciones",
      accessorKey: "id",
      cell: (item) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => handleViewDetail(item.id)}
            disabled={loadingDetail}
            className="p-1.5 text-neutral-500 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
            title="Ver Detalle y Porcentaje Entregado"
          >
            <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>
          <button
            onClick={() =>
              setPdfModal({
                isOpen: true,
                endpoint: `/api/sales/deliveries/${item.id}/pdf`,
                title: `Nota de Entrega ${item.deliveryNumber}`,
                filename: `nota_entrega_${item.deliveryNumber}.pdf`,
              })
            }
            className="p-1.5 text-neutral-500 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            title="Ver / Reimprimir Nota de Entrega en PDF"
          >
            <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </button>
          {item.status === "DELIVERED" && (
            <Button
              variant="outline"
              onClick={() => setInvoicingDelivery(item)}
              className="text-[11px] py-1 px-2 rounded-lg border-sky-300 text-sky-700 hover:bg-sky-50 flex items-center gap-1"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Facturar a CxC</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-400 tracking-tight">
            Notas de Entrega & Despachos
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Entrega física y salida de inventario con control de transportista,
            importación de cotizaciones y facturación
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenImportModal}
            variant="outline"
            className="flex items-center gap-2 border-sky-300 text-sky-700 hover:bg-sky-50 font-medium text-xs rounded-lg py-2 px-3 shadow-xs"
          >
            <Download className="w-4 h-4 text-sky-600" />
            <span>Importar Cotización</span>
          </Button>
          <Button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg py-2 px-3 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Nota de Entrega</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-emerald-500  bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-emerald-200 dark:border-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Total Despachos
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">
            {deliveries.length}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Notas emitidas en el ciclo
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500  bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-amber-200 dark:border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Pendientes por Facturar
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {deliveries.filter((d) => d.status === "DELIVERED").length}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Mercancía entregada sin factura fiscal
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-sky-500  bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Valor Despachado ($)
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-sky-700 mt-2 font-mono">
            {formatMoneyUSD(
              deliveries.reduce((acc, d) => acc + d.totalAmount, 0),
            )}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Mercancía salida del inventario
          </p>
        </Card>
      </div>

      {/* Filtros de Pestaña de Estado */}
      <div className="flex flex-col gap-3 border-b border-neutral-200 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: "ALL", label: "Todos los Despachos" },
              { id: "DELIVERED", label: "Pendientes por Facturar" },
              { id: "INVOICED", label: "Facturados en CxC" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === st.id
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="text-xs text-neutral-600 rounded-lg py-1 px-2.5 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar Filtros</span>
            </Button>
          )}
        </div>

        {/* Barra de Filtros Avanzados (Clientes, Origen, Fechas) */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2 text-xs">
          {/* Segmento de Clientes */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-neutral-500">
              Tipo de Clientes:
            </label>
            <div className="flex bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 items-center gap-1 p-1 rounded-lg p-2">
              <button
                type="button"
                title="Todas"
                onClick={() => {
                  setCustomerFilterType("ALL");
                  setSelectedCustomerId("");
                }}
                className={`flex-1 py-1 text-[11px] rounded-lg font-medium transition-colors cursor-pointer ${
                  customerFilterType === "ALL"
                    ? "bg-white text-neutral-400 shadow-xs"
                    : "text-neutral-300 hover:text-neutral-400"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerFilterType("WITH_DELIVERIES");
                  setSelectedCustomerId("");
                }}
                className={`flex-1 py-1 text-[11px] rounded-lg font-medium transition-colors cursor-pointer ${
                  customerFilterType === "WITH_DELIVERIES"
                    ? "bg-white text-neutral-400 shadow-xs"
                    : "text-neutral-300 hover:text-neutral-400"
                }`}
                title="Clientes con Notas de Entrega emitidas"
              >
                Con Notas
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerFilterType("WITH_QUOTATIONS");
                  setSelectedCustomerId("");
                }}
                className={`flex-1 py-1 text-[11px] rounded-lg font-medium transition-colors cursor-pointer ${
                  customerFilterType === "WITH_QUOTATIONS"
                    ? "bg-white text-neutral-400 shadow-xs"
                    : "text-neutral-300 hover:text-neutral-400"
                }`}
                title="Clientes con Cotizaciones o Presupuestos registrados"
              >
                Con Cotiz.
              </button>
            </div>
          </div>

          {/* Selector de Cliente Específico */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-neutral-500">
              Cliente:
            </label>
            <div className="flex items-center gap-1.5  px-2.5 py-1.5  p-4 rounded-lg">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">
                {customerFilterType === "WITH_DELIVERIES"
                  ? "Todos los clientes con notas"
                  : customerFilterType === "WITH_QUOTATIONS"
                    ? "Todos los clientes con cotizaciones"
                    : "Todos los clientes"}
              </option>
              {filteredCustomersForDropdown.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.doc})
                  {"deliveryNotesCount" in c && (
                    ` - ${c.deliveryNotesCount} notas / ${c.quotationsCount} cotiz.`
                  )}
                </option>
              ))}
            </select>
          </div>
          </div>

          {/* Filtro por Origen */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-neutral-500">
              Origen del Despacho:
            </label>
            <div className="flex items-center gap-1.5  px-2.5 py-1.5  p-4 rounded-lg">
            <select
              value={originFilter}
              onChange={(e) =>
                setOriginFilter(
                  e.target.value as "ALL" | "FROM_QUOTATION" | "DIRECT",
                )
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">Todos los orígenes</option>
              <option value="FROM_QUOTATION">Desde Cotización</option>
              <option value="DIRECT">Despacho Directo</option>
            </select>
            </div>
          </div>

          {/* Rango de Fechas */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-neutral-500">
              Fecha Desde:
            </label>
            <div className="flex items-center gap-1.5  px-2.5 py-1.5  p-4 rounded-lg">
              <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-neutral-500">
              Fecha Hasta:
            </label>
            <div className="flex items-center gap-1.5  px-2.5 py-1.5  p-4 rounded-lg ">
              <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 p-0 focus:ring-0 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Notas de Entrega */}
      <Card className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-xs">
        <DataTable
          columns={columns}
          data={deliveries}
          isLoading={loading}
          searchPlaceholder="Buscar por número de despacho, cliente o cotización..."
        />
      </Card>

      {/* Modal Nueva Nota de Entrega */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Nueva Nota de Entrega / Despacho"
        subtitle="Salida física de productos desde el depósito con rebaja de stock"
        size="4xl"
        footer={
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-sm font-bold text-neutral-400 dark:text-neutral-100 font-mono">
              Total Despacho: {formatMoneyUSD(totalDeliveryAmount)}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenImportModal}
                className="text-xs border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Importar Cotización</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                form="createDeliveryForm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs"
              >
                Confirmar Despacho y Rebajar Stock
              </Button>
            </div>
          </div>
        }
      >
        <form
          id="createDeliveryForm"
          onSubmit={handleCreateDelivery}
          className="space-y-4 text-xs"
        >
                {/* Banner de Cotización Vinculada si aplica */}
                {selectedQuotation && (
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-center justify-between text-xs text-sky-900">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-sky-700 shrink-0" />
                      <span>
                        Despachando según Cotización{" "}
                        <strong>{selectedQuotation.number}</strong> (Total
                        cotizado: {formatMoneyUSD(selectedQuotation.total)})
                      </span>
                      {renderQuotationStatusBadge(selectedQuotation.status)}
                    </div>
                    <button
                      type="button"
                      onClick={handleClearQuotationBinding}
                      className="text-sky-700 hover:text-sky-900 text-[11px] font-medium underline cursor-pointer"
                    >
                      Desvincular
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Cliente Destinatario *
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={customerId}
                        onChange={(e) => {
                          const targetCustomer = availableCustomers.find((c) => c.id === e.target.value);
                          if (targetCustomer?.isBlocked) {
                            toast.error(
                              `El cliente "${targetCustomer.name}" está BLOQUEADO. Motivo: ${targetCustomer.blockReason || 'Consulte con administración'}. No puede ser seleccionado.`
                            );
                            return;
                          }
                          setCustomerId(e.target.value);
                        }}
                        className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        {availableCustomers.length === 0 ? (
                          <option value="">No hay clientes registrados</option>
                        ) : (
                          availableCustomers.map((c) => (
                            <option key={c.id} value={c.id} disabled={c.isBlocked}>
                              {c.name} ({c.doc}){c.isBlocked ? ' — [BLOQUEADO]' : ''}
                            </option>
                          ))
                        )}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCustomerSearch(true)}
                        title="Buscar cliente en modal"
                        className="px-2.5 py-2 shrink-0 flex items-center gap-1 text-xs"
                      >
                        <Search className="w-3.5 h-3.5 text-neutral-500" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Depósito de Despacho *
                    </label>
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">Seleccione depósito...</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Nombre del Conductor
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Placa del Vehículo
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. A88CK2D"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Cotización Ref. (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. COT-2026-0001"
                      value={quotationRef}
                      onChange={(e) => setQuotationRef(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* Detalle de Productos a Despachar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Productos a Despachar ({deliveryItems.length})
                    </h4>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddingFromSearch(true)}
                        className="text-xs rounded-lg py-1 px-2.5 flex items-center gap-1.5"
                      >
                        <Search className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Buscar en Catálogo</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddItem}
                        className="text-xs rounded-lg py-1 px-2.5 flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar Fila</span>
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Producto</th>
                          <th className="py-2.5 px-3 w-32">Cant. Despachar</th>
                          <th className="py-2.5 px-3 w-32">Precio Unit. ($)</th>
                          <th className="py-2.5 px-3 w-32 text-right">
                            Total ($)
                          </th>
                          <th className="py-2.5 px-3 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {deliveryItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50/50">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={item.productId}
                                  onChange={(e) =>
                                    handleItemChange(
                                      idx,
                                      "productId",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                  {availableProducts.length === 0 ? (
                                    <option value="">Sin productos</option>
                                  ) : (
                                    availableProducts.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.sku} - {p.name} (Disp:{" "}
                                        {p.availableStock})
                                      </option>
                                    ))
                                  )}
                                </select>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setProductSearchRowIdx(idx)}
                                  title="Buscar producto en modal"
                                  className="p-1.5 shrink-0"
                                >
                                  <Search className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantityDelivered}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "quantityDelivered",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "unitPrice",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-neutral-300 font-mono">
                              {formatMoneyUSD(item.total)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-neutral-400 hover:text-red-500 p-1 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Banner Informativo de Descuento de Stock */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Aviso de Inventario:</strong> Al emitir esta Nota de
                    Entrega, las cantidades serán rebajadas físicamente del
                    stock disponible en el depósito de forma inmediata, evitando
                    doble facturación de inventario cuando se procese la factura
                    fiscal.
                  </p>
                </div>

        </form>
      </Modal>

      {/* Modal Importar Cotización Facturada */}
      <Modal
        isOpen={isImportQuotationOpen}
        onClose={() => setIsImportQuotationOpen(false)}
        title="Importar Cotización Facturada a Nota de Entrega"
        subtitle="Seleccione una cotización previamente facturada con saldo pendiente por despachar"
        size="4xl"
        footer={
          <div className="flex items-center justify-end w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsImportQuotationOpen(false)}
            >
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">

            {/* Search & Notice */}
            <div className="p-4  space-y-3 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800">
              <div className="flex items-center gap-2  shadow-2xs">
                <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar cotización por número o nombre de cliente..."
                  value={quotationSearch}
                  onChange={(e) => setQuotationSearch(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  autoFocus
                />
                {quotationSearch && (
                  <button
                    type="button"
                    onClick={() => setQuotationSearch("")}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-start gap-2 text-xs text-sky-800 bg-sky-50/80 p-2.5 rounded-lg border border-sky-200">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Regla de Despacho:</strong> Únicamente se permite importar cotizaciones previamente <strong>Facturadas</strong> y que cuenten con mercancía pendiente por despachar. Las cotizaciones entregadas al 100% no se muestran.
                </p>
              </div>
            </div>

            {/* List Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {loadingQuotations ? (
                <div className="py-12 text-center text-xs text-neutral-500">
                  Cargando cotizaciones facturadas disponibles...
                </div>
              ) : filteredQuotationsForImport.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500 space-y-1">
                  <FileText className="w-8 h-8 text-neutral-300 mx-auto" />
                  <p className="font-medium text-neutral-700">
                    No se encontraron cotizaciones facturadas pendientes
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    No hay propuestas comerciales facturadas con mercancía pendiente por despachar
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700">
                      <tr>
                        <th className="py-2.5 px-3">Nº Cotización</th>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3 text-right">Monto Facturado ($)</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3 text-center">Mercancía</th>
                        <th className="py-2.5 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredQuotationsForImport.map((q) => {
                        const totalQuotQty = Number(q.totalQuotedQuantity || 0);
                        const totalDelivQty = Number(q.totalDeliveredQuantity || 0);
                        const pendingQty = Math.max(0, totalQuotQty - totalDelivQty);
                        const pctDelivered =
                          totalQuotQty > 0
                            ? Math.round((totalDelivQty / totalQuotQty) * 100)
                            : 0;

                        return (
                          <tr key={q.id} className="hover:bg-neutral-50/50">
                            <td className="py-2.5 px-3 font-mono font-semibold text-sky-300">
                              {q.quotationNumber}
                            </td>
                            <td className="py-2.5 px-3 text-neutral-300">
                              {new Date(q.quotationDate).toLocaleDateString(
                                "es-VE",
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-medium text-neutral-300">
                                {q.customerName}
                              </p>
                              <span className="font-mono text-[10px] text-neutral-400">
                                {q.customerDoc}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-300">
                              {formatMoneyUSD(q.totalAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                <span>Facturada</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {totalQuotQty > 0 ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="text-[11px] font-semibold text-neutral-300">
                                    {pendingQty} pend. / {totalQuotQty} total
                                  </span>
                                  {pctDelivered > 0 && (
                                    <span className="text-[10px] text-amber-600 font-medium">
                                      ({pctDelivered}% ya despachado)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-neutral-400 text-[11px]">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  handleSelectQuotationToImport(q)
                                }
                                className="text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-lg py-1 px-2.5 shadow-2xs flex items-center gap-1 ml-auto cursor-pointer"
                              >
                                <span>Importar</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

        </div>
      </Modal>

      {/* Modal Detalle de Nota de Entrega y Porcentaje Entregado */}
      <Modal
        isOpen={Boolean(viewingDelivery)}
        onClose={() => setViewingDelivery(null)}
        title={
          viewingDelivery
            ? `Detalle de Nota de Entrega: ${viewingDelivery.deliveryNumber}`
            : "Detalle de Nota de Entrega"
        }
        subtitle={
          viewingDelivery
            ? `Emitida el ${new Date(viewingDelivery.deliveryDate).toLocaleDateString("es-VE")}`
            : undefined
        }
        size="3xl"
        footer={
          viewingDelivery && (
            <div className="flex items-center justify-between w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPdfModal({
                    isOpen: true,
                    endpoint: `/api/sales/deliveries/${viewingDelivery.id}/pdf`,
                    title: `Nota de Entrega ${viewingDelivery.deliveryNumber}`,
                    filename: `nota_entrega_${viewingDelivery.deliveryNumber}.pdf`,
                  })
                }
                className="flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-neutral-800"
              >
                <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Imprimir / Ver PDF</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingDelivery(null)}
                >
                  Cerrar
                </Button>
                {viewingDelivery.status === "DELIVERED" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const d = viewingDelivery;
                      setViewingDelivery(null);
                      setInvoicingDelivery(d);
                    }}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Facturar a CxC</span>
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {viewingDelivery && (
          <div className="space-y-4 text-xs">
            {/* Sección de Vinculación con Cotización & Porcentaje Entregado */}
            {viewingDelivery.quotationNumber ? (
              <div className="bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-700 dark:text-sky-400" />
                    <span className="font-semibold text-neutral-400 dark:text-neutral-100 text-xs">
                      Cotización Vinculada:
                    </span>
                    <span className="font-mono text-xs font-bold text-sky-800 dark:text-sky-300">
                      {viewingDelivery.quotationNumber}
                    </span>
                    {renderQuotationStatusBadge(viewingDelivery.quotationStatus)}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Subtotal Cotizado:{" "}
                      <strong className="font-mono text-neutral-400 dark:text-neutral-100">
                        {formatMoneyUSD(
                          Number(
                            viewingDelivery.quotationSubtotalAmount ??
                              viewingDelivery.quotationTotalAmount ??
                              0,
                          ),
                        )}
                      </strong>
                    </span>
                    {Number(viewingDelivery.quotationTaxAmount || 0) > 0 && (
                      <span className="text-neutral-500 dark:text-neutral-400 font-mono">
                        (IVA:{" "}
                        {formatMoneyUSD(
                          Number(viewingDelivery.quotationTaxAmount),
                        )}
                        )
                      </span>
                    )}
                  </div>
                </div>

                {(() => {
                  const totalQty = Number(
                    viewingDelivery.quotationTotalQuantity || 0,
                  );
                  const deliveredQty = Number(
                    viewingDelivery.quotationDeliveredQuantity || 0,
                  );
                  const subtotalQuot = Number(
                    viewingDelivery.quotationSubtotalAmount ??
                      viewingDelivery.quotationTotalAmount ??
                      0,
                  );
                  const deliveredTotal = Number(
                    viewingDelivery.quotationDeliveredTotal ||
                      viewingDelivery.totalAmount ||
                      0,
                  );

                  const pct =
                    totalQty > 0
                      ? Math.min(
                          100,
                          Number(((deliveredQty / totalQty) * 100).toFixed(1)),
                        )
                      : subtotalQuot > 0
                        ? Math.min(
                            100,
                            Number(
                              ((deliveredTotal / subtotalQuot) * 100).toFixed(1),
                            ),
                          )
                        : 100;
                  const isComplete = pct >= 100;

                  return (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          Progreso de Entrega Física:
                        </span>
                        <div className="flex items-center gap-2">
                          {totalQty > 0 && (
                            <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                              ({deliveredQty} de {totalQty} un.)
                            </span>
                          )}
                          <span
                            className={`font-bold font-mono text-sm ${
                              isComplete
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-sky-700 dark:text-sky-400"
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-lg h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-lg transition-all duration-500 ${
                            isComplete ? "bg-emerald-600" : "bg-sky-600"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span>
                          Acumulado despachado (Neto):{" "}
                          <strong className="font-mono text-neutral-700 dark:text-neutral-300">
                            {formatMoneyUSD(deliveredTotal)}
                          </strong>
                        </span>
                        {isComplete ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Entrega
                            completa de los productos cotizados
                          </span>
                        ) : (
                          <span>
                            Restante por despachar:{" "}
                            <strong className="font-mono text-neutral-700 dark:text-neutral-300">
                              {totalQty > 0
                                ? `${Math.max(0, totalQty - deliveredQty)} un.`
                                : formatMoneyUSD(
                                    Math.max(0, subtotalQuot - deliveredTotal),
                                  )}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                <Truck className="w-4 h-4 text-neutral-500 shrink-0" />
                <span>
                  <strong>Despacho Directo:</strong> Esta nota de entrega fue
                  emitida directamente sin vincularse a una cotización previa
                  (100% despachado en este documento).
                </span>
              </div>
            )}

            {/* Datos de Entrega y Logística */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-neutral-50 dark:bg-neutral-800/60 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <div>
                <span className="text-[10px] text-neutral-400 block uppercase font-medium">
                  Cliente Destinatario
                </span>
                <p className="font-semibold text-neutral-400 dark:text-neutral-100 mt-0.5">
                  {viewingDelivery.customerName}
                </p>
                <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                  {viewingDelivery.customerDoc}
                </p>
                {viewingDelivery.customerPhone && (
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Tlf: {viewingDelivery.customerPhone}
                  </p>
                )}
                {viewingDelivery.customerAddress && (
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {viewingDelivery.customerAddress}
                  </p>
                )}
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 block uppercase font-medium">
                  Depósito y Sucursal
                </span>
                <p className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">
                  {viewingDelivery.warehouseName}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {viewingDelivery.branchName}
                </p>
                <p className="text-[11px] text-neutral-400">
                  Despachó: {viewingDelivery.dispatchedByUserName}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 block uppercase font-medium">
                  Transporte y Conductor
                </span>
                <p className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">
                  {viewingDelivery.driverName || "Entrega en Mostrador"}
                </p>
                {viewingDelivery.vehiclePlate && (
                  <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                    Placa: {viewingDelivery.vehiclePlate}
                  </p>
                )}
                <div className="mt-1">
                  {viewingDelivery.status === "DELIVERED" ? (
                    <Badge variant="info" className="text-[10px]">
                      Despachada / Pendiente Factura
                    </Badge>
                  ) : (
                    <Badge variant="success" className="text-[10px]">
                      Facturada en CxC
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla de Productos Despachados */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-neutral-400 dark:text-neutral-100 uppercase tracking-wider">
                Productos Despachados ({viewingDelivery.items?.length || 0})
              </h4>
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-3">Código</th>
                      <th className="py-2 px-3">Descripción</th>
                      <th className="py-2 px-3 text-right">Cant. Despachada</th>
                      <th className="py-2 px-3 text-right">Precio Unit. ($)</th>
                      <th className="py-2 px-3 text-right">Subtotal ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {viewingDelivery.items && viewingDelivery.items.length > 0 ? (
                      viewingDelivery.items.map((i, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                          <td className="py-2 px-3 font-mono text-neutral-500 dark:text-neutral-400">
                            {i.productSku}
                          </td>
                          <td className="py-2 px-3 font-medium text-neutral-400 dark:text-neutral-100">
                            {i.productName}
                            {i.notes && (
                              <span className="block text-[10px] text-neutral-400 font-normal">
                                {i.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                            {i.quantityDelivered}{" "}
                            <span className="text-[10px] text-neutral-400 font-normal">
                              {i.unitOfMeasure || "UND"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                            {formatMoneyUSD(i.unitPrice)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-neutral-400 dark:text-neutral-100">
                            {formatMoneyUSD(i.total)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-4 text-center text-neutral-400 dark:text-neutral-500"
                        >
                          Sin ítems registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totales */}
            <div className="flex justify-end pt-1">
              <div className="bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 text-right min-w-[220px] space-y-1">
                <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                  <span>Total Despacho ($):</span>
                  <strong className="text-neutral-400 dark:text-neutral-100 font-mono text-sm">
                    {formatMoneyUSD(viewingDelivery.totalAmount)}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span>Equivalente en Bs:</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">
                    {formatMoneyVES(
                      viewingDelivery.totalAmount *
                        viewingDelivery.exchangeRate,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Facturar Despacho en CxC */}
      <Modal
        isOpen={Boolean(invoicingDelivery)}
        onClose={() => setInvoicingDelivery(null)}
        title="Facturar Despacho a CxC"
        subtitle="Generación de factura fiscal vinculada a la nota de entrega"
        size="lg"
        footer={
          invoicingDelivery && (
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInvoicingDelivery(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                form="invoiceDeliveryForm"
                className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs"
              >
                Emitir Factura y Asentar en CxC
              </Button>
            </div>
          )
        }
      >
        {invoicingDelivery && (
          <form
            id="invoiceDeliveryForm"
            onSubmit={handleInvoiceDelivery}
            className="space-y-4 text-xs"
          >
                <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs">
                  <p className="font-semibold text-neutral-400">
                    {invoicingDelivery.customerName}
                  </p>
                  <p className="text-neutral-500">
                    {invoicingDelivery.customerDoc}
                  </p>
                  <p className="text-neutral-700 mt-1">
                    Monto a Facturar:{" "}
                    <strong>
                      {formatMoneyUSD(invoicingDelivery.totalAmount)}
                    </strong>{" "}
                    (
                    {formatMoneyVES(
                      invoicingDelivery.totalAmount *
                        invoicingDelivery.exchangeRate,
                    )}
                    )
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Nº Factura de Venta *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. FACT-001096"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Nº de Control Fiscal SENIAT
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 00-112233"
                    value={controlNumber}
                    onChange={(e) => setControlNumber(e.target.value)}
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="creditToggle"
                    checked={isCredit}
                    onChange={(e) => setIsCredit(e.target.checked)}
                    className="rounded-lg text-sky-600 focus:ring-sky-500"
                  />
                  <label
                    htmlFor="creditToggle"
                    className="text-xs text-neutral-700 font-medium"
                  >
                    Venta a Crédito (Registrar obligación pendiente en CxC)
                  </label>
                </div>

                {isCredit && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Fecha de Vencimiento de Factura
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                )}

          </form>
        )}
      </Modal>

      {/* Modal Buscador de Clientes */}
      <CustomerSearchModal
        isOpen={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelect={(c) => {
          if (c.isBlocked) {
            toast.error(`El cliente "${c.name}" está BLOQUEADO. No puede ser seleccionado.`);
            return;
          }
          setCustomerId(c.id);
        }}
        customers={availableCustomers}
      />

      {/* Modal Buscador de Productos */}
      <ProductSearchModal
        isOpen={productSearchRowIdx !== null || isAddingFromSearch}
        onClose={() => {
          setProductSearchRowIdx(null);
          setIsAddingFromSearch(false);
        }}
        onSelect={(prod) => {
          if (isAddingFromSearch) {
            handleAddItemWithProduct(prod);
          } else if (productSearchRowIdx !== null) {
            handleItemChange(productSearchRowIdx, "productId", prod.id);
          }
        }}
        products={availableProducts}
        mode="sale"
      />

      {/* Modal Visor / Descarga PDF de Nota de Entrega */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        title={pdfModal.title}
        endpoint={pdfModal.endpoint}
        filename={pdfModal.filename}
      />
    </div>
  );
};
