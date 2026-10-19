import React, { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { DataTable, Column } from "../../components/ui/DataTable";
import { useEscapeKey } from "../../components/ui/Modal";
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
  quotationNumber?: string | null;
}

interface NewDeliveryItem {
  productId: string;
  productName: string;
  sku: string;
  quantityDelivered: number;
  unitPrice: number;
  total: number;
  notes?: string;
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
    { id: string; name: string; doc: string }[]
  >([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    activeWarehouseId || "",
  );

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  useEscapeKey(
    () => {
      if (showCustomerSearch) setShowCustomerSearch(false);
      else if (productSearchRowIdx !== null) setProductSearchRowIdx(null);
      else if (isAddingFromSearch) setIsAddingFromSearch(false);
      else if (invoicingDelivery) setInvoicingDelivery(null);
      else if (isCreateOpen) setIsCreateOpen(false);
    },
    Boolean(
      showCustomerSearch ||
      productSearchRowIdx !== null ||
      isAddingFromSearch ||
      invoicingDelivery ||
      isCreateOpen,
    ),
  );

  // Formulario Nueva Nota de Entrega
  const [customerId, setCustomerId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [quotationRef, setQuotationRef] = useState("");
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
      const [custRes, prodRes, branchRes] = await Promise.all([
        fetch("/api/customers", { headers }),
        fetch("/api/inventory/products", { headers }),
        fetch("/api/auth/branches", { headers }),
      ]);

      if (custRes.ok) {
        const cJson = await custRes.json();
        if (cJson.success && Array.isArray(cJson.data)) {
          const mapped = cJson.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            doc: `${c.docType || "J"}-${c.docNumber || ""}`,
          }));
          setAvailableCustomers(mapped);
          if (mapped.length > 0 && !customerId) {
            setCustomerId(mapped[0].id);
          }
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
          bJson.data.forEach((b: any) => {
            if (Array.isArray(b.warehouses)) {
              b.warehouses.forEach((w: any) =>
                allWh.push({ id: w.id, name: `${b.name} - ${w.name}` }),
              );
            }
          });
          setWarehouses(allWh);
          if (allWh.length > 0 && !selectedWarehouseId) {
            setSelectedWarehouseId(allWh[0].id);
          }
        }
      }
    } catch {
      // Ignorar errores
    }
  };

  useEffect(() => {
    fetchDeliveries();
    fetchCatalogs();
  }, [activeBranchId, activeWarehouseId, token]);

  const totalDeliveryAmount = deliveryItems.reduce(
    (acc, i) => acc + i.total,
    0,
  );

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
          driverName: driverName.trim() || undefined,
          vehiclePlate: vehiclePlate.trim() || undefined,
          currency: "USD",
          exchangeRate,
          notes: deliveryNotesText.trim() || undefined,
          items: deliveryItems.map((item) => ({
            productId: item.productId,
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
          <p className="text-xs font-medium text-neutral-900">
            {item.customerName}
          </p>
          <span className="font-mono text-[10px] text-neutral-500">
            {item.customerDoc}
          </span>
        </div>
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
          <p className="text-xs font-semibold text-neutral-900">
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
            onClick={() =>
              setPdfModal({
                isOpen: true,
                endpoint: `/api/sales/deliveries/${item.id}/pdf`,
                title: `Nota de Entrega ${item.deliveryNumber}`,
                filename: `nota_entrega_${item.deliveryNumber}.pdf`,
              })
            }
            className="p-1 text-neutral-500 hover:text-sky-600 rounded-lg hover:bg-neutral-100"
            title="Ver / Reimprimir Nota de Entrega en PDF"
          >
            <FileText className="w-4 h-4 text-sky-600" />
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
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Notas de Entrega & Despachos
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Entrega física y salida de inventario con control de transportista y
            facturación posterior
          </p>
        </div>
        <Button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg py-2 px-3 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Nota de Entrega</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Total Despachos
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2">
            {deliveries.length}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Notas emitidas en el ciclo
          </p>
        </Card>

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
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

        <Card className="p-4 rounded-lg border border-neutral-200 bg-white">
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

      {/* Tabla de Notas de Entrega */}
      <Card className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={deliveries}
          isLoading={loading}
          searchPlaceholder="Buscar por número de despacho, cliente o conductor..."
        />
      </Card>

      {/* Modal Nueva Nota de Entrega */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Nueva Nota de Entrega / Despacho
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Salida física de productos desde el depósito con rebaja de
                  stock
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="createDeliveryForm"
              onSubmit={handleCreateDelivery}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Cliente Destinatario *
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="w-5/6 text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                      >
                        {availableCustomers.length === 0 ? (
                          <option value="">No hay clientes registrados</option>
                        ) : (
                          availableCustomers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.doc})
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
                        {/* <span>Buscar</span> */}
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
                      className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
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
                      className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
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
                      className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
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
                      className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                    />
                  </div>
                </div>

                {/* Detalle de Productos a Despachar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
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
                      <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-medium">
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
                                  className="flex-1 text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800 min-w-[140px]"
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
                                className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
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
                                className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-neutral-900 font-mono">
                              {formatMoneyUSD(item.total)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-neutral-400 hover:text-red-500 p-1"
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
              </div>

              {/* Footer (Pinned) */}
              <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-2 shrink-0">
                <span className="text-sm font-bold text-neutral-900 font-mono">
                  Total Despacho: {formatMoneyUSD(totalDeliveryAmount)}
                </span>
                <div className="flex items-center gap-2">
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
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg py-2 px-4 shadow-sm"
                  >
                    Confirmar Despacho y Rebajar Stock
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Facturar Despacho en CxC */}
      {invoicingDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-neutral-200 w-full max-w-lg max-h-[92vh] shadow-2xl flex flex-col overflow-hidden my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Facturar Despacho a CxC
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Generación de factura fiscal vinculada a la nota de entrega
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInvoicingDelivery(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="invoiceDeliveryForm"
              onSubmit={handleInvoiceDelivery}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs">
                  <p className="font-semibold text-neutral-900">
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
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
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
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
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
                      className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800"
                    />
                  </div>
                )}
              </div>

              {/* Footer (Pinned) */}
              <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
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
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-4 shadow-sm"
                >
                  Emitir Factura y Asentar en CxC
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buscador de Clientes */}
      <CustomerSearchModal
        isOpen={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelect={(c) => setCustomerId(c.id)}
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
