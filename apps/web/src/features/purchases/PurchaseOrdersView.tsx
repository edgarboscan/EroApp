import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { DataTable, Column } from "../../components/ui/DataTable";
import { Modal } from "../../components/ui/Modal";
import { useExchangeRateStore } from "../../stores/exchangeRateStore";
import {
  FileText,
  Plus,
  Trash2,
  X,
  Check,
  Building2,
  Calendar,
  DollarSign,
  Truck,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  Search,
  PackageCheck,
} from "lucide-react";
import {
  SupplierSearchModal,
  ProductSearchModal,
} from "../../components/search";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import {
  formatMoneyUSD,
  formatMoneyVES,
  formatExchangeRate,
} from "../../utils/formatters";
import { PdfViewerModal } from "../../components/ui/PdfViewerModal";
import {
  showConfirmQuestion,
  showDestructiveConfirm,
} from "../../lib/sweetalert";

interface PurchaseOrderRecord {
  id: string;
  orderNumber: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  currency: "USD" | "VES";
  exchangeRate: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  status:
    | "DRAFT"
    | "CONFIRMED"
    | "PARTIALLY_RECEIVED"
    | "RECEIVED"
    | "CANCELLED";
  notes?: string | null;
  supplierName: string;
  supplierRif: string;
  branchName: string;
  createdByUserName: string;
  itemsCount: number;
}

interface NewOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantityOrdered: number;
  unitCost: number;
  taxRate: number;
  subtotal: number;
  total: number;
  notes?: string;
}

export const PurchaseOrdersView: React.FC = () => {
  const navigate = useNavigate();
  const rate = useExchangeRateStore((s) => s.rate);
  const { activeBranchId, token, user } = useAuthStore();
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Catálogos desde BD
  const [availableProducts, setAvailableProducts] = useState<
    {
      id: string;
      sku: string;
      name: string;
      defaultCost: number;
      taxRate: number;
    }[]
  >([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<
    { id: string; name: string; rif: string }[]
  >([]);

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrderRecord | null>(
    null,
  );
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
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

  // Formulario Nueva Orden
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [exchangeRate, setExchangeRate] = useState(rate);
  const [orderNotes, setOrderNotes] = useState("");
  const [orderItems, setOrderItems] = useState<NewOrderItem[]>([]);
  const [autoConfirmOnCreate, setAutoConfirmOnCreate] = useState(true);

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;
        const [prodRes, supRes] = await Promise.all([
          fetch("/api/inventory/products", { headers }),
          fetch("/api/suppliers", { headers }),
        ]);

        if (prodRes.ok) {
          const pJson = await prodRes.json();
          if (pJson.success && Array.isArray(pJson.data)) {
            const mappedProds = pJson.data.map((p: any) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              defaultCost: Number(p.costPrice || p.cost_price || 0),
              taxRate: Number(p.taxRate || 16.0),
            }));
            setAvailableProducts(mappedProds);
          }
        }

        if (supRes.ok) {
          const sJson = await supRes.json();
          if (sJson.success && Array.isArray(sJson.data)) {
            const mappedSups = sJson.data.map((s: any) => ({
              id: s.id,
              name: s.name,
              rif: s.rif,
            }));
            setAvailableSuppliers(mappedSups);
            if (mappedSups.length > 0) setSelectedSupplierId(mappedSups[0].id);
          }
        }
      } catch {
        // Ignorar
      }
    };
    fetchCatalogs();
  }, [token]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append("branchId", activeBranchId);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/purchases/orders?${params.toString()}`, {
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        setOrders(Array.isArray(json.data) ? json.data : []);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeBranchId, statusFilter, token]);

  // Totales de la nueva orden
  const orderSubtotal = orderItems.reduce((acc, i) => acc + i.subtotal, 0);
  const orderTax = orderItems.reduce(
    (acc, i) => acc + (i.total - i.subtotal),
    0,
  );
  const orderTotalUSD = orderSubtotal + orderTax;
  const orderTotalVES = orderTotalUSD * exchangeRate;

  const resetCreateForm = () => {
    setSelectedSupplierId(availableSuppliers.length > 0 ? availableSuppliers[0].id : "");
    setExpectedDate("");
    setCurrency("USD");
    setExchangeRate(rate);
    setOrderNotes("");
    setOrderItems([]);
    setAutoConfirmOnCreate(true);
    setProductSearchRowIdx(null);
    setIsAddingFromSearch(false);
  };

  const handleCloseCreateModal = () => {
    setIsCreateOpen(false);
    resetCreateForm();
  };

  const handleAddItem = () => {
    if (availableProducts.length === 0) {
      toast.error("No hay productos disponibles en el catálogo de inventario");
      return;
    }
    const prod = availableProducts[0];
    const sub = Number((10 * prod.defaultCost).toFixed(2));
    const tax = Number((sub * (prod.taxRate / 100)).toFixed(2));
    setOrderItems([
      ...orderItems,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantityOrdered: 10,
        unitCost: prod.defaultCost,
        taxRate: prod.taxRate,
        subtotal: sub,
        total: Number((sub + tax).toFixed(2)),
      },
    ]);
  };

  const handleAddItemWithProduct = (prod: any) => {
    const cost = Number(prod.defaultCost ?? prod.costPrice ?? prod.cost ?? 0);
    const taxRate = Number(prod.taxRate ?? 16.0);
    const sub = Number((10 * cost).toFixed(2));
    const tax = Number((sub * (taxRate / 100)).toFixed(2));
    setOrderItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantityOrdered: 10,
        unitCost: cost,
        taxRate,
        subtotal: sub,
        total: Number((sub + tax).toFixed(2)),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...orderItems];
    const current = updated[index];

    if (field === "productId") {
      const p = availableProducts.find((item) => item.id === val);
      if (p) {
        current.productId = p.id;
        current.productName = p.name;
        current.sku = p.sku;
        current.unitCost = p.defaultCost;
        current.taxRate = p.taxRate;
      } else {
        current.productId = val;
      }
    } else if (field === "quantityOrdered") {
      current.quantityOrdered = Number(val);
    } else if (field === "unitCost") {
      current.unitCost = Number(val);
    } else if (field === "taxRate") {
      current.taxRate = Number(val);
    } else if (field === "notes") {
      current.notes = val;
    }

    const sub = Number((current.quantityOrdered * current.unitCost).toFixed(2));
    const tax = Number((sub * (current.taxRate / 100)).toFixed(2));
    current.subtotal = sub;
    current.total = Number((sub + tax).toFixed(2));

    setOrderItems(updated);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      toast.error("Debe seleccionar un proveedor");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("Debe incluir al menos un producto");
      return;
    }

    const invalidItem = orderItems.find(
      (i) => !i.productId || Number(i.quantityOrdered) <= 0 || Number(i.unitCost) < 0
    );
    if (invalidItem) {
      toast.error("Todos los productos deben tener cantidad mayor a 0 y costo válido");
      return;
    }

    const supplier = availableSuppliers.find(
      (s) => s.id === selectedSupplierId,
    );

    const confirmed = await showConfirmQuestion({
      title: "¿Crear orden de compra?",
      text: `Se creará la orden de compra por $${orderTotalUSD.toFixed(2)} para ${supplier?.name || "el proveedor seleccionado"}.`,
      confirmButtonText: "Sí, crear orden",
      cancelButtonText: "Cancelar",
      icon: "question",
    });
    if (!confirmed) return;

    try {
      const res = await fetch("/api/purchases/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          branchId: activeBranchId || user?.branchId || undefined,
          supplierId: selectedSupplierId,
          orderDate: new Date().toISOString(),
          expectedDeliveryDate: expectedDate || undefined,
          currency,
          exchangeRate: Number(exchangeRate) || 1,
          notes: orderNotes || undefined,
          items: orderItems.map((i) => ({
            productId: i.productId,
            quantityOrdered: Number(i.quantityOrdered),
            unitCost: Number(i.unitCost),
            taxRate: Number(i.taxRate) || 0,
            notes: i.notes || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (autoConfirmOnCreate && json.data?.id) {
          try {
            await fetch(`/api/purchases/orders/${json.data.id}/confirm`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });
            toast.success(
              `Orden ${json.data.orderNumber} creada y confirmada exitosamente`
            );
          } catch {
            toast.success(`Orden ${json.data.orderNumber} creada exitosamente`);
          }
        } else {
          toast.success(`Orden ${json.data.orderNumber} creada exitosamente`);
        }
        handleCloseCreateModal();
        fetchOrders();

        // Abrir inmediatamente la visualización y descarga en PDF
        if (json.data?.id) {
          setPdfModal({
            isOpen: true,
            endpoint: `/api/purchases/orders/${json.data.id}/pdf`,
            title: `Orden de Compra N° ${json.data.orderNumber || ""}`,
            filename: `orden_compra_${json.data.orderNumber || "doc"}.pdf`,
          });
        }
      } else {
        const errorMsg =
          json.error?.message ||
          (Array.isArray(json.error?.issues)
            ? json.error.issues.map((it: any) => `${it.path.join('.')}: ${it.message}`).join(', ')
            : undefined) ||
          json.message ||
          "Error al crear orden de compra";
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al emitir orden de compra");
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    const confirmed = await showConfirmQuestion({
      title: "¿Confirmar orden de compra?",
      text: "¿Desea confirmar y emitir formalmente esta orden de compra al proveedor?",
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Cancelar",
      icon: "question",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/purchases/orders/${orderId}/confirm`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Orden de compra confirmada y emitida al proveedor");
        fetchOrders();
      } else {
        throw new Error(
          json.error?.message || json.message || "Error al confirmar orden"
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Error al confirmar orden de compra");
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const confirmed = await showDestructiveConfirm(
      "¿Anular orden de compra?",
      "¿Está seguro de que desea cancelar y anular esta orden de compra?",
      "Sí, anular orden",
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/purchases/orders/${orderId}/cancel`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.info("Orden de compra cancelada");
        fetchOrders();
      } else {
        throw new Error(
          json.error?.message || json.message || "Error al cancelar orden"
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Error al cancelar orden de compra");
    }
  };

  // Filtrado de órdenes
  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    return true;
  });

  // KPIs
  const totalActiveOrders = orders.filter(
    (o) => o.status !== "CANCELLED",
  ).length;
  const totalAmountUSD = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((acc, o) => acc + o.totalAmount, 0);
  const pendingReceiptCount = orders.filter(
    (o) => o.status === "CONFIRMED" || o.status === "PARTIALLY_RECEIVED",
  ).length;

  const renderStatusBadge = (status: PurchaseOrderRecord["status"]) => {
    switch (status) {
      case "DRAFT":
        return (
          <Badge variant="neutral" className="text-[10px]">
            Borrador
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge variant="info" className="text-[10px]">
            Confirmada
          </Badge>
        );
      case "PARTIALLY_RECEIVED":
        return (
          <Badge variant="warning" className="text-[10px]">
            Recepción Parcial
          </Badge>
        );
      case "RECEIVED":
        return (
          <Badge variant="success" className="text-[10px]">
            Recibida Total
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="danger" className="text-[10px]">
            Cancelada
          </Badge>
        );
      default:
        return null;
    }
  };

  const columns: Column<PurchaseOrderRecord>[] = [
    {
      header: "Nº Orden",
      accessorKey: "orderNumber",
      cell: (item) => (
        <span className="font-mono text-xs font-semibold text-sky-700">
          {item.orderNumber}
        </span>
      ),
    },
    {
      header: "Fecha Emisión",
      accessorKey: "orderDate",
      cell: (item) => (
        <div className="text-xs text-neutral-400 ">
          <p>{new Date(item.orderDate).toLocaleDateString("es-VE")}</p>
          {item.expectedDeliveryDate && (
            <p className="text-[10px] text-neutral-500">
              Entrega: {item.expectedDeliveryDate}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Proveedor & RIF",
      accessorKey: "supplierName",
      cell: (item) => (
        <div>
          <p className="text-xs font-medium text-neutral-400 ">
            {item.supplierName}
          </p>
          <span className="font-mono text-[10px] text-neutral-500">
            {item.supplierRif}
          </span>
        </div>
      ),
    },
    {
      header: "Sucursal",
      accessorKey: "branchName",
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 ">
          <Building2 className="w-3.5 h-3.5 text-neutral-400" />
          <span>{item.branchName}</span>
        </div>
      ),
    },
    {
      header: "Ítems",
      accessorKey: "itemsCount",
      cell: (item) => (
        <span className="text-xs font-medium text-neutral-400 ">
          {item.itemsCount} productos
        </span>
      ),
    },
    {
      header: "Monto Total",
      accessorKey: "totalAmount",
      cell: (item) => (
        <div className="text-right">
          <p className="text-xs font-semibold text-neutral-400 ">
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
      cell: (item) => renderStatusBadge(item.status),
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
                endpoint: `/api/purchases/orders/${item.id}/pdf`,
                title: `Orden de Compra ${item.orderNumber}`,
                filename: `orden_compra_${item.orderNumber}.pdf`,
              })
            }
            className="p-1 text-neutral-500 hover:text-sky-600 rounded-lg hover:bg-neutral-100"
            title="Ver / Reimprimir Orden de Compra en PDF"
          >
            <FileText className="w-4 h-4 text-sky-600" />
          </button>
          <button
            onClick={() => setViewingOrder(item)}
            className="p-1 text-neutral-500 hover:text-sky-600 rounded-lg hover:bg-neutral-100"
            title="Ver Detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {item.status === "DRAFT" && (
            <button
              onClick={() => handleConfirmOrder(item.id)}
              className="p-1 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50"
              title="Confirmar Orden"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {(item.status === "CONFIRMED" || item.status === "PARTIALLY_RECEIVED") && (
            <button
              onClick={() => navigate(`/purchases/receipts?orderId=${item.id}`)}
              className="p-1 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50"
              title="Recibir en Almacén (Verificar cantidades)"
            >
              <PackageCheck className="w-4 h-4" />
            </button>
          )}
          {item.status !== "RECEIVED" && item.status !== "CANCELLED" && (
            <button
              onClick={() => handleCancelOrder(item.id)}
              className="p-1 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50"
              title="Cancelar Orden"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Encabezado y Acción Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-400  tracking-tight">
            Órdenes de Compra
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Gestión y seguimiento del ciclo de abastecimiento de inventario con
            proveedores
          </p>
        </div>
        <Button
          onClick={() => {
            resetCreateForm();
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg py-2 px-3 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Orden de Compra</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-3 border-l-4 border-l-neutral-500  bg-neutral-50 dark:bg-neutral-800 text-neutral-400  dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Órdenes Activas
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-400  mt-2">
            {totalActiveOrders}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            En curso o completadas
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-600  bg-neutral-50 dark:bg-neutral-800 text-neutral-400  dark:text-neutral-400 rounded-lg border border-emerald-200 dark:border-emerald-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Monto Comprometido
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">
            {formatMoneyUSD(totalAmountUSD)}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Total adquisiciones valorizadas
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-600  bg-neutral-50 dark:bg-neutral-800 text-neutral-400  dark:text-neutral-400 rounded-lg border border-amber-200 dark:border-amber-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              Pendientes por Recibir
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {pendingReceiptCount}
          </p>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Esperando recepción en depósito
          </p>
        </Card>
      </div>

      {/* Filtros de Estado */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2 overflow-x-auto">
        {[
          "ALL",
          "DRAFT",
          "CONFIRMED",
          "PARTIALLY_RECEIVED",
          "RECEIVED",
          "CANCELLED",
        ].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === st
                ? "bg-neutral-900 text-white"
                : "text-neutral-400  hover:bg-neutral-100"
            }`}
          >
            {st === "ALL" && "Todas"}
            {st === "DRAFT" && "Borradores"}
            {st === "CONFIRMED" && "Confirmadas"}
            {st === "PARTIALLY_RECEIVED" && "Parciales"}
            {st === "RECEIVED" && "Recibidas"}
            {st === "CANCELLED" && "Canceladas"}
          </button>
        ))}
      </div>

      {/* Tabla de Órdenes */}
      <Card className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={filteredOrders}
          isLoading={loading}
          searchPlaceholder="Buscar órdenes por proveedor, correlativo..."
        />
      </Card>

      {/* Modal Nueva Orden de Compra */}
      <Modal
        isOpen={isCreateOpen}
        onClose={handleCloseCreateModal}
        title="Nueva Orden de Compra"
        subtitle="Emisión formal de pedido de mercancía hacia proveedor"
        size="4xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseCreateModal}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              form="createPurchaseOrderForm"
              className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs"
            >
              Emitir Orden de Compra
            </Button>
          </div>
        }
      >
        <form
          id="createPurchaseOrderForm"
          onSubmit={handleCreateOrder}
          className="space-y-4 text-xs"
        >
          {/* Cabecera Proveedor y Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400  mb-1">
                Proveedor Destinatario *
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {availableSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rif})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSupplierSearch(true)}
                  title="Buscar proveedor en catálogo"
                  className="px-2.5 py-2 shrink-0 flex items-center gap-1 text-xs"
                >
                  <Search className="w-3.5 h-3.5 text-neutral-500" />
                  {/* <span>Buscar</span> */}
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400  mb-1">
                Fecha Estimada de Entrega
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400  mb-1">
                Tasa Oficial BCV (USD / VES)
              </label>
              <input
                type="number"
                step="0.01"
                value={formatExchangeRate(exchangeRate, 2)}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-right"
              />
            </div>
          </div>

          {/* Detalle de Productos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-neutral-400  uppercase tracking-wider">
                Líneas de la Orden ({orderItems.length})
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingFromSearch(true)}
                  className="text-xs rounded-lg py-1 px-2.5 flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Buscar en Catálogo</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddItem}
                  className="text-xs rounded-lg py-1 px-2.5 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Fila</span>
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto border border-neutral-200 rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-400  dark:text-neutral-400 uppercase  tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3 w-28">Cantidad</th>
                    <th className="py-2.5 px-3 w-32">Costo Unit. ($)</th>
                    <th className="py-2.5 px-3 w-24">IVA (%)</th>
                    <th className="py-2.5 px-3 w-32 text-right">
                      Subtotal ($)
                    </th>
                    <th className="py-2.5 px-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {orderItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={item.productId}
                            onChange={(e) =>
                              handleItemChange(idx, "productId", e.target.value)
                            }
                            className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="" disabled>
                              -- Seleccione producto --
                            </option>
                            {item.productId && !availableProducts.some((p) => p.id === item.productId) && (
                              <option value={item.productId}>
                                {item.sku ? `${item.sku} - ` : ""}{item.productName || "Producto Seleccionado"}
                              </option>
                            )}
                            {availableProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.sku} - {p.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setProductSearchRowIdx(idx)}
                            title="Buscar producto"
                            className="p-1.5 shrink-0"
                          >
                            <Search className="w-3.5 h-3.5 text-neutral-500" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantityOrdered}
                          onChange={(e) =>
                            handleItemChange(
                              idx,
                              "quantityOrdered",
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
                          value={item.unitCost}
                          onChange={(e) =>
                            handleItemChange(idx, "unitCost", e.target.value)
                          }
                          className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={item.taxRate}
                          onChange={(e) =>
                            handleItemChange(idx, "taxRate", e.target.value)
                          }
                          className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="0">0% Exento</option>
                          <option value="8">8% Reducido</option>
                          <option value="16">16% General</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-neutral-400 ">
                        {formatMoneyUSD(item.subtotal)}
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

          {/* Notas y Resumen de Totales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-2">
            <div>
              <label className="block text-xs font-medium text-neutral-400  mb-1">
                Instrucciones / Observaciones
              </label>
              <textarea
                rows={3}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Instrucciones especiales de despacho, contacto o términos comerciales..."
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoConfirmOrderToggle"
                  checked={autoConfirmOnCreate}
                  onChange={(e) => setAutoConfirmOnCreate(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <label
                  htmlFor="autoConfirmOrderToggle"
                  className="text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                >
                  Confirmar y emitir inmediatamente al proveedor (lista para recepción)
                </label>
              </div>
            </div>

            <div className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  space-y-2">
              <div className="flex justify-between text-xs text-neutral-400 ">
                <span>Subtotal Base Imponible:</span>
                <span className="font-semibold">
                  {formatMoneyUSD(orderSubtotal)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-neutral-400 ">
                <span>IVA Estimado:</span>
                <span className="font-semibold">
                  {formatMoneyUSD(orderTax)}
                </span>
              </div>
              <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-neutral-400 ">
                  Total Orden (USD):
                </span>
                <span className="text-base font-bold text-sky-700">
                  {formatMoneyUSD(orderTotalUSD)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-neutral-500">
                <span>Equivalente en Bolívares (BCV):</span>
                <span className="font-medium">
                  {formatMoneyVES(orderTotalVES)}
                </span>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Ver Detalle de Orden */}
      <Modal
        isOpen={Boolean(viewingOrder)}
        onClose={() => setViewingOrder(null)}
        title={
          viewingOrder
            ? `Orden ${viewingOrder.orderNumber}`
            : "Detalle de Orden"
        }
        subtitle={
          viewingOrder
            ? `Emitida el ${new Date(viewingOrder.orderDate).toLocaleDateString("es-VE")} por ${viewingOrder.createdByUserName}`
            : undefined
        }
        size="2xl"
        footer={
          viewingOrder && (
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                size="sm"
                onClick={() => {
                  setPdfModal({
                    isOpen: true,
                    endpoint: `/api/purchases/orders/${viewingOrder.id}/pdf`,
                    title: `Orden de Compra ${viewingOrder.orderNumber}`,
                    filename: `orden_compra_${viewingOrder.orderNumber}.pdf`,
                  });
                }}
              >
                <FileText className="w-4 h-4 mr-1.5" />
                Descargar / Ver PDF
              </Button>
              {viewingOrder.status === "DRAFT" && (
                <Button
                  size="sm"
                  onClick={async () => {
                    const id = viewingOrder.id;
                    await handleConfirmOrder(id);
                    setViewingOrder(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar Orden</span>
                </Button>
              )}
              {(viewingOrder.status === "CONFIRMED" || viewingOrder.status === "PARTIALLY_RECEIVED") && (
                <Button
                  size="sm"
                  onClick={() => {
                    const id = viewingOrder.id;
                    setViewingOrder(null);
                    navigate(`/purchases/receipts?orderId=${id}`);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Recibir en Almacén</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingOrder(null)}
              >
                Cerrar
              </Button>
            </div>
          )
        }
      >
        {viewingOrder && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 ">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                  Proveedor
                </span>
                <p className="font-semibold text-neutral-400 ">
                  {viewingOrder.supplierName}
                </p>
                <p className="font-mono text-neutral-500">
                  {viewingOrder.supplierRif}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                  Destino
                </span>
                <p className="font-semibold text-neutral-400 ">
                  {viewingOrder.branchName}
                </p>
                {viewingOrder.expectedDeliveryDate && (
                  <p className="text-neutral-500">
                    Fecha entrega estimada: {viewingOrder.expectedDeliveryDate}
                  </p>
                )}
              </div>
            </div>

            {viewingOrder.notes && (
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                  Observaciones
                </span>
                <p className="text-neutral-400  mt-0.5">{viewingOrder.notes}</p>
              </div>
            )}

            <div className="border-t border-neutral-200 pt-3 flex justify-between items-center">
              <span className="text-xs text-neutral-500">
                Tasa de cambio: {formatExchangeRate(viewingOrder.exchangeRate)}
                /USD
              </span>
              <div className="text-right">
                <p className="text-lg font-bold text-neutral-400 ">
                  Total: {formatMoneyUSD(viewingOrder.totalAmount)}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatMoneyVES(
                    viewingOrder.totalAmount * viewingOrder.exchangeRate,
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Buscador de Proveedores */}
      <SupplierSearchModal
        isOpen={showSupplierSearch}
        onClose={() => setShowSupplierSearch(false)}
        onSelect={(s) => setSelectedSupplierId(s.id)}
        suppliers={availableSuppliers}
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
            const cost = Number(prod.defaultCost ?? prod.cost ?? prod.costPrice ?? 0);
            const tax = Number(prod.taxRate ?? 16.0);
            const updated = [...orderItems];
            if (updated[productSearchRowIdx]) {
              const current = updated[productSearchRowIdx];
              const unitCost = cost > 0 ? cost : current.unitCost;
              const sub = Number((current.quantityOrdered * unitCost).toFixed(2));
              const taxAmount = Number((sub * (tax / 100)).toFixed(2));
              updated[productSearchRowIdx] = {
                ...current,
                productId: prod.id,
                productName: prod.name,
                sku: prod.sku,
                unitCost,
                taxRate: tax,
                subtotal: sub,
                total: Number((sub + taxAmount).toFixed(2)),
              };
              setOrderItems(updated);
            }
          }
        }}
        products={availableProducts}
        mode="purchase"
      />

      {/* Modal Visor / Descarga PDF de Orden de Compra */}
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
