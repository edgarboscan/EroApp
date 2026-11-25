import React, { useState, useEffect, useMemo } from "react";
import {
  Scissors,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Package,
  Sliders,
  Trash2,
  Play,
  XCircle,
  ArrowRight,
  Scale,
  Layers,
  Tag,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { toast } from "sonner";
import { formatMoneyUSD } from "../../utils/formatters";

interface ProductionProduct {
  id: string;
  sku: string;
  name: string;
  productType: string;
  unitOfMeasure: string;
  costPrice: number;
  basePrice: number;
  allowsWaste: boolean;
  isButcheryBase: boolean;
  isButcheryYield: boolean;
  expectedWastePct: number;
  currentStock: number;
}

interface WasteReason {
  id: string;
  code: string;
  name: string;
  affectsCost: boolean;
  isActive: boolean;
}

interface ProductionOutput {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unitOfMeasure: string;
  outputType: "INTERMEDIATE" | "FINAL_CUT";
  quantity: number;
  yieldPct: number;
  allocatedUnitCost: number;
  allocatedTotalCost: number;
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  processType:
    | "WHOLE_CARCASS"
    | "PARTIAL_EXTRACTION"
    | "SUBDIVISION"
    | "TRANSFORMATION";
  parentOrderId: string | null;
  warehouseId: string;
  warehouseName: string;
  sourceProductId: string;
  sourceProductSku: string;
  sourceProductName: string;
  sourceUnit: string;
  sourceQuantity: number;
  sourceUnitCost: number;
  sourceTotalCost: number;
  totalOutputQuantity: number;
  wasteQuantity: number;
  wastePct: number;
  wasteReasonId: string | null;
  wasteReasonName: string | null;
  wasteCost: number;
  costAllocationMethod: "BY_WEIGHT" | "EQUAL_UNIT";
  status: "DRAFT" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  createdByName: string | null;
  outputs: ProductionOutput[];
}

interface WasteLog {
  id: string;
  productionOrderId: string | null;
  orderNumber: string | null;
  warehouseName: string;
  productSku: string;
  productName: string;
  unitOfMeasure: string;
  reasonCode: string;
  reasonName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes: string | null;
  userName: string | null;
  createdAt: string;
}

interface WarehouseItem {
  id: string;
  name: string;
}

const PROCESS_TYPE_LABELS: Record<ProductionOrder["processType"], string> = {
  WHOLE_CARCASS: "Despiece Total / Lote",
  PARTIAL_EXTRACTION: "Despiece Parcial (Pieza Intermedia)",
  SUBDIVISION: "Subdivisión en Cortes Finales",
  TRANSFORMATION: "Transformación / Producción",
};

export const ProductionView: React.FC = () => {
  const { token, user } = useAuthStore();
  const defaultWarehouseId = user?.warehouseId || "";

  const [activeTab, setActiveTab] = useState<"orders" | "waste" | "config">(
    "orders",
  );
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    defaultWarehouseId,
  );
  const [products, setProducts] = useState<ProductionProduct[]>([]);
  const [wasteReasons, setWasteReasons] = useState<WasteReason[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);

  // Modal Nueva Orden de Desposte / Producción
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState<{
    warehouseId: string;
    processType: ProductionOrder["processType"];
    parentOrderId: string | null;
    sourceProductId: string;
    sourceQuantity: string;
    wasteQuantity: string;
    wasteReasonId: string;
    costAllocationMethod: "BY_WEIGHT" | "EQUAL_UNIT";
    notes: string;
    outputs: Array<{
      productId: string;
      outputType: "INTERMEDIATE" | "FINAL_CUT";
      quantity: string;
      notes: string;
    }>;
  }>({
    warehouseId: defaultWarehouseId,
    processType: "WHOLE_CARCASS",
    parentOrderId: null,
    sourceProductId: "",
    sourceQuantity: "",
    wasteQuantity: "0",
    wasteReasonId: "",
    costAllocationMethod: "BY_WEIGHT",
    notes: "",
    outputs: [
      { productId: "", outputType: "FINAL_CUT", quantity: "", notes: "" },
    ],
  });

  // Modal Merma Directa
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [submittingWaste, setSubmittingWaste] = useState(false);
  const [directWasteForm, setDirectWasteForm] = useState({
    warehouseId: defaultWarehouseId,
    productId: "",
    quantity: "",
    wasteReasonId: "",
    notes: "",
  });

  // Modal Nuevo Motivo de Merma
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [reasonForm, setReasonForm] = useState({
    code: "",
    name: "",
    affectsCost: true,
  });
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const fetchWarehouses = async () => {
    try {
      const res = await fetch('/api/production/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setWarehouses(json.data);
        if (!selectedWarehouseId && json.data.length > 0) {
          setSelectedWarehouseId(json.data[0].id);
        }
      }
    } catch {
      toast.error('No se pudieron cargar los almacenes');
    }
  };

  const fetchAllData = async (whId?: string) => {
    setLoading(true);
    try {
      const targetWh = whId ?? selectedWarehouseId;
      const whParam = targetWh
        ? `?warehouseId=${encodeURIComponent(targetWh)}`
        : "";
      const [prodRes, reasonsRes, ordersRes, logsRes] = await Promise.all([
        fetch(`/api/production/products${whParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/production/waste-reasons", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/production/orders", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/production/waste-logs", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [prodJson, reasonsJson, ordersJson, logsJson] = await Promise.all([
        prodRes.json(),
        reasonsRes.json(),
        ordersRes.json(),
        logsRes.json(),
      ]);

      if (prodJson.success) setProducts(prodJson.data || []);
      if (reasonsJson.success) setWasteReasons(reasonsJson.data || []);
      if (ordersJson.success) setOrders(ordersJson.data || []);
      if (logsJson.success) setWasteLogs(logsJson.data || []);
    } catch {
      toast.error("Error al cargar los datos de producción y merma");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [token]);

  useEffect(() => {
    fetchAllData(selectedWarehouseId);
  }, [token, selectedWarehouseId]);

  const sourceProductObj = useMemo(
    () => products.find((p) => p.id === orderForm.sourceProductId) || null,
    [products, orderForm.sourceProductId],
  );

  const totalOutputQty = useMemo(
    () =>
      orderForm.outputs.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0,
      ),
    [orderForm.outputs],
  );

  const sourceQtyNum = Number(orderForm.sourceQuantity) || 0;
  const wasteQtyNum = Number(orderForm.wasteQuantity) || 0;
  const unassignedDiff = Math.max(
    0,
    Number((sourceQtyNum - totalOutputQty - wasteQtyNum).toFixed(4)),
  );
  const remainingBaseStock = sourceProductObj
    ? Math.max(
        0,
        Number((sourceProductObj.currentStock - sourceQtyNum).toFixed(4)),
      )
    : 0;
  const liveYieldPct =
    sourceQtyNum > 0
      ? Number(((totalOutputQty / sourceQtyNum) * 100).toFixed(2))
      : 0;
  const liveWastePct =
    sourceQtyNum > 0
      ? Number(((wasteQtyNum / sourceQtyNum) * 100).toFixed(2))
      : 0;

  // KPIs
  const kpis = useMemo(() => {
    const completed = orders.filter((o) => o.status === "COMPLETED");
    const totalProcessed = completed.reduce(
      (acc, o) => acc + o.sourceQuantity,
      0,
    );
    const totalYield = completed.reduce(
      (acc, o) => acc + o.totalOutputQuantity,
      0,
    );
    const avgYieldPct =
      totalProcessed > 0 ? (totalYield / totalProcessed) * 100 : 0;
    const totalWasteQty = wasteLogs.reduce((acc, l) => acc + l.quantity, 0);
    const totalWasteCost = wasteLogs.reduce((acc, l) => acc + l.totalCost, 0);
    return {
      completedCount: completed.length,
      totalProcessed,
      avgYieldPct,
      totalWasteQty,
      totalWasteCost,
    };
  }, [orders, wasteLogs]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.sourceProductName.toLowerCase().includes(q) ||
        o.sourceProductSku.toLowerCase().includes(q) ||
        o.outputs.some((out) => out.productName.toLowerCase().includes(q))
      );
    });
  }, [orders, statusFilter, searchTerm]);

  const filteredProductsConfig = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, searchTerm]);

  const openNewOrderModal = (preset?: {
    processType?: ProductionOrder["processType"];
    parentOrderId?: string;
    sourceProductId?: string;
    sourceQuantity?: number;
  }) => {
    const defaultWh = selectedWarehouseId || warehouses[0]?.id || "";
    const defaultReason = wasteReasons.find((r) => r.isActive)?.id || "";
    setOrderForm({
      warehouseId: defaultWh,
      processType: preset?.processType || "WHOLE_CARCASS",
      parentOrderId: preset?.parentOrderId || null,
      sourceProductId: preset?.sourceProductId || "",
      sourceQuantity: preset?.sourceQuantity
        ? String(preset.sourceQuantity)
        : "",
      wasteQuantity: "0",
      wasteReasonId: defaultReason,
      costAllocationMethod: "BY_WEIGHT",
      notes: "",
      outputs: [
        {
          productId: "",
          outputType:
            preset?.processType === "PARTIAL_EXTRACTION"
              ? "INTERMEDIATE"
              : "FINAL_CUT",
          quantity: "",
          notes: "",
        },
      ],
    });
    setIsOrderModalOpen(true);
  };

  const handleAddOutputRow = () => {
    setOrderForm((prev) => ({
      ...prev,
      outputs: [
        ...prev.outputs,
        {
          productId: "",
          outputType:
            prev.processType === "PARTIAL_EXTRACTION"
              ? "INTERMEDIATE"
              : "FINAL_CUT",
          quantity: "",
          notes: "",
        },
      ],
    }));
  };

  const handleRemoveOutputRow = (idx: number) => {
    setOrderForm((prev) => ({
      ...prev,
      outputs: prev.outputs.filter((_, i) => i !== idx),
    }));
  };

  const handleAssignRemainingAsWaste = () => {
    if (!sourceProductObj?.allowsWaste) {
      toast.error("Este producto no admite merma en su configuración.");
      return;
    }
    const diff = Math.max(
      0,
      Number((sourceQtyNum - totalOutputQty).toFixed(4)),
    );
    setOrderForm((prev) => ({ ...prev, wasteQuantity: String(diff) }));
  };

  const handleSubmitOrder = async (processImmediately: boolean) => {
    if (
      !orderForm.warehouseId ||
      !orderForm.sourceProductId ||
      sourceQtyNum <= 0
    ) {
      toast.error(
        "Seleccione el almacén, producto base y cantidad a procesar.",
      );
      return;
    }

    const validOutputs = orderForm.outputs.filter(
      (o) => o.productId && Number(o.quantity) > 0,
    );
    if (validOutputs.length === 0) {
      toast.error(
        "Agregue al menos un producto derivado con cantidad mayor a cero.",
      );
      return;
    }

    if (totalOutputQty + wasteQtyNum > sourceQtyNum + 0.0001) {
      toast.error(
        "La suma de derivados más merma excede la cantidad del producto base.",
      );
      return;
    }

    if (wasteQtyNum > 0 && !sourceProductObj?.allowsWaste) {
      toast.error(
        `El producto "${sourceProductObj?.name}" no admite merma. Habilite "Admite Merma" en Configuración o iguale los derivados a ${sourceQtyNum}.`,
      );
      return;
    }

    if (wasteQtyNum > 0 && !orderForm.wasteReasonId) {
      toast.error("Seleccione el motivo de merma.");
      return;
    }

    setSubmittingOrder(true);
    try {
      const res = await fetch("/api/production/orders", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          warehouseId: orderForm.warehouseId,
          processType: orderForm.processType,
          parentOrderId: orderForm.parentOrderId,
          sourceProductId: orderForm.sourceProductId,
          sourceQuantity: sourceQtyNum,
          wasteQuantity: wasteQtyNum,
          wasteReasonId: wasteQtyNum > 0 ? orderForm.wasteReasonId : null,
          costAllocationMethod: orderForm.costAllocationMethod,
          notes: orderForm.notes || null,
          processImmediately,
          outputs: validOutputs.map((o) => ({
            productId: o.productId,
            outputType: o.outputType,
            quantity: Number(o.quantity),
            notes: o.notes || null,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Error al registrar la orden");
      }

      toast.success(
        processImmediately
          ? `Orden ${json.data.orderNumber} procesada e inventario actualizado.`
          : `Orden ${json.data.orderNumber} guardada como borrador.`,
      );
      setIsOrderModalOpen(false);
      await fetchAllData(selectedWarehouseId);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al procesar la orden";
      toast.error(msg);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleProcessDraftOrder = async (
    orderId: string,
    orderNumber: string,
  ) => {
    try {
      const res = await fetch(`/api/production/orders/${orderId}/process`, {
        method: "POST",
        headers: authHeaders,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Error al procesar orden");
      }
      toast.success(`Orden ${orderNumber} procesada exitosamente.`);
      await fetchAllData(selectedWarehouseId);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo procesar la orden",
      );
    }
  };

  const handleCancelDraftOrder = async (
    orderId: string,
    orderNumber: string,
  ) => {
    try {
      const res = await fetch(`/api/production/orders/${orderId}/cancel`, {
        method: "POST",
        headers: authHeaders,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Error al anular orden");
      }
      toast.success(`Orden ${orderNumber} anulada.`);
      await fetchAllData(selectedWarehouseId);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo anular la orden",
      );
    }
  };

  const handleToggleProductConfig = async (
    prod: ProductionProduct,
    patch: Partial<
      Pick<
        ProductionProduct,
        | "allowsWaste"
        | "isButcheryBase"
        | "isButcheryYield"
        | "expectedWastePct"
      >
    >,
  ) => {
    setSavingConfigId(prod.id);
    const nextConfig = {
      allowsWaste: patch.allowsWaste ?? prod.allowsWaste,
      isButcheryBase: patch.isButcheryBase ?? prod.isButcheryBase,
      isButcheryYield: patch.isButcheryYield ?? prod.isButcheryYield,
      expectedWastePct: patch.expectedWastePct ?? prod.expectedWastePct,
    };

    try {
      const res = await fetch(
        `/api/production/products/${prod.id}/waste-config`,
        {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify(nextConfig),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.error?.message || "Error al actualizar configuración",
        );
      }
      setProducts((prev) =>
        prev.map((item) =>
          item.id === prod.id ? { ...item, ...nextConfig } : item,
        ),
      );
      toast.success(`Configuración actualizada para ${prod.name}`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar configuración",
      );
    } finally {
      setSavingConfigId(null);
    }
  };

  const handleSubmitDirectWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWaste(true);
    try {
      const res = await fetch("/api/production/waste-logs", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          warehouseId: directWasteForm.warehouseId,
          productId: directWasteForm.productId,
          quantity: Number(directWasteForm.quantity),
          wasteReasonId: directWasteForm.wasteReasonId,
          notes: directWasteForm.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Error al registrar merma");
      }
      toast.success("Merma registrada y descontada del inventario.");
      setIsWasteModalOpen(false);
      await fetchAllData(selectedWarehouseId);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al registrar merma",
      );
    } finally {
      setSubmittingWaste(false);
    }
  };

  const handleCreateWasteReason = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/production/waste-reasons", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          code: reasonForm.code,
          name: reasonForm.name,
          affectsCost: reasonForm.affectsCost,
          isActive: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Error al crear motivo");
      }
      toast.success("Motivo de merma creado.");
      setIsReasonModalOpen(false);
      setReasonForm({ code: "", name: "", affectsCost: true });
      await fetchAllData(selectedWarehouseId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear motivo");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Scissors className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span>Producción, Desposte & Control de Merma</span>
          </h1>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            Transformación de materia prima o canal en piezas intermedias y
            cortes finales con trazabilidad de rendimiento y desperdicio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            aria-label="Almacén de trabajo"
            className="text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todos los almacenes</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDirectWasteForm({
                warehouseId: selectedWarehouseId || warehouses[0]?.id || "",
                productId: "",
                quantity: "",
                wasteReasonId: wasteReasons.find((r) => r.isActive)?.id || "",
                notes: "",
              });
              setIsWasteModalOpen(true);
            }}
            className="rounded-lg"
          >
            <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600 dark:text-amber-400" />
            Registrar Merma
          </Button>

          <Button
            size="sm"
            onClick={() => openNewOrderModal()}
            className="rounded-lg"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nueva Orden de Desposte
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] rounded-lg">
          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
            Órdenes Procesadas
          </p>
          <p className="text-2xl font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1">
            {kpis.completedCount}
          </p>
          <span className="text-[11px] text-neutral-600 dark:text-neutral-400">
            Transformaciones completadas
          </span>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] rounded-lg">
          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
            Materia Prima Procesada
          </p>
          <p className="text-2xl font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1">
            {kpis.totalProcessed.toFixed(2)}
          </p>
          <span className="text-[11px] text-neutral-600 dark:text-neutral-400">
            Unidades / kg consumidos
          </span>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80] rounded-lg">
          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
            Rendimiento Aprovechable
          </p>
          <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
            {kpis.avgYieldPct.toFixed(1)}%
          </p>
          <span className="text-[11px] text-neutral-600 dark:text-neutral-400">
            Promedio de aprovechamiento
          </span>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#EF4444] dark:border-l-[#F87171] rounded-lg">
          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
            Merma Acumulada
          </p>
          <p className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-1">
            {kpis.totalWasteQty.toFixed(2)}
          </p>
          <span className="text-[11px] text-neutral-600 dark:text-neutral-400">
            Costo pérdida: {formatMoneyUSD(kpis.totalWasteCost)}
          </span>
        </Card>
      </div>

      {/* Tabs y Buscador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "orders"
                ? "border-sky-600 text-sky-700 dark:text-sky-400"
                : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Órdenes de Desposte ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("waste")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "waste"
                ? "border-sky-600 text-sky-700 dark:text-sky-400"
                : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Bitácora de Merma ({wasteLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "config"
                ? "border-sky-600 text-sky-700 dark:text-sky-400"
                : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Configuración de Productos & Motivos</span>
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar orden, SKU o producto..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* TAB 1: ÓRDENES DE PRODUCCIÓN Y DESPOSTE */}
      {activeTab === "orders" && (
        <Card className="p-0 overflow-hidden rounded-lg">
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Historial de Desposte y Transformaciones
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
              className="text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1 text-neutral-800 dark:text-neutral-200"
            >
              <option value="ALL">Todos los estados</option>
              <option value="COMPLETED">Completadas</option>
              <option value="DRAFT">Borradores</option>
              <option value="CANCELLED">Anuladas</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 uppercase font-bold text-[11px] tracking-wider border-b border-neutral-300 dark:border-neutral-800 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">Orden / Fecha</th>
                  <th className="py-3 px-4">Proceso</th>
                  <th className="py-3 px-4">Producto Base Consumido</th>
                  <th className="py-3 px-4">Derivados Obtenidos</th>
                  <th className="py-3 px-4 text-right">Merma</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="py-4 px-4">
                        <div className="h-5 bg-neutral-300 dark:bg-neutral-800 rounded-lg w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-12 text-neutral-600 dark:text-neutral-400"
                    >
                      <Scissors className="w-8 h-8 mx-auto mb-2 opacity-60" />
                      <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                        Sin órdenes de producción o desposte
                      </p>
                      <p className="text-xs mt-1">
                        Presione "Nueva Orden de Desposte" para transformar un
                        producto base en cortes o piezas intermedias.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => (
                    <tr
                      key={ord.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 align-top">
                        <div className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100">
                          {ord.orderNumber}
                        </div>
                        <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
                          {new Date(ord.createdAt).toLocaleDateString("es-VE")}{" "}
                          · {ord.warehouseName}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                          {PROCESS_TYPE_LABELS[ord.processType]}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                          {ord.sourceProductName}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-700 dark:text-neutral-300">
                          {ord.sourceQuantity.toFixed(2)} {ord.sourceUnit} ·
                          Costo: {formatMoneyUSD(ord.sourceTotalCost)}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1">
                          {ord.outputs.map((out) => (
                            <div
                              key={out.id}
                              className="flex items-center justify-between gap-2 text-[11px] bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-lg"
                            >
                              <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[180px]">
                                {out.productName}
                                {out.outputType === "INTERMEDIATE"
                                  ? " (Pieza)"
                                  : ""}
                              </span>
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                                +{out.quantity.toFixed(2)} {out.unitOfMeasure} (
                                {out.yieldPct.toFixed(1)}%)
                              </span>
                              {ord.status === "COMPLETED" &&
                                out.outputType === "INTERMEDIATE" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openNewOrderModal({
                                        processType: "SUBDIVISION",
                                        parentOrderId: ord.id,
                                        sourceProductId: out.productId,
                                        sourceQuantity: out.quantity,
                                      })
                                    }
                                    className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 hover:underline shrink-0 cursor-pointer"
                                    title="Subdividir esta pieza intermedia en cortes finales"
                                  >
                                    Subdividir
                                  </button>
                                )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right align-top font-mono text-xs">
                        {ord.wasteQuantity > 0 ? (
                          <div>
                            <span className="font-bold text-rose-700 dark:text-rose-400">
                              {ord.wasteQuantity.toFixed(2)} {ord.sourceUnit} (
                              {ord.wastePct.toFixed(1)}%)
                            </span>
                            {ord.wasteReasonName && (
                              <div className="text-[10px] font-sans text-neutral-600 dark:text-neutral-400">
                                {ord.wasteReasonName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-500 dark:text-neutral-400">
                            0.00
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center align-top">
                        <Badge
                          variant={
                            ord.status === "COMPLETED"
                              ? "success"
                              : ord.status === "DRAFT"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {ord.status === "COMPLETED"
                            ? "Completada"
                            : ord.status === "DRAFT"
                              ? "Borrador"
                              : "Anulada"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right align-top">
                        {ord.status === "DRAFT" && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleProcessDraftOrder(ord.id, ord.orderNumber)
                              }
                              className="h-7 text-xs px-2"
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Procesar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleCancelDraftOrder(ord.id, ord.orderNumber)
                              }
                              className="h-7 text-xs px-2 text-rose-700 dark:text-rose-400"
                            >
                              <XCircle className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: BITÁCORA DE MERMAS */}
      {activeTab === "waste" && (
        <Card className="p-0 overflow-hidden rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 uppercase font-bold text-[11px] tracking-wider border-b border-neutral-300 dark:border-neutral-800 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">Fecha / Origen</th>
                  <th className="py-3 px-4">Almacén</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Motivo de Merma</th>
                  <th className="py-3 px-4 text-right">Cantidad</th>
                  <th className="py-3 px-4 text-right">Pérdida Total</th>
                  <th className="py-3 px-4">Responsable / Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {wasteLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-12 text-neutral-600 dark:text-neutral-400"
                    >
                      No hay registros de merma hasta el momento.
                    </td>
                  </tr>
                ) : (
                  wasteLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="py-3 px-4 text-xs">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {new Date(log.createdAt).toLocaleDateString("es-VE")}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                          {log.orderNumber
                            ? `Orden ${log.orderNumber}`
                            : "Merma Directa"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-800 dark:text-neutral-200">
                        {log.warehouseName}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-bold text-neutral-900 dark:text-neutral-100">
                          {log.productName}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                          {log.productSku}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="warning">{log.reasonName}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700 dark:text-rose-400 text-xs">
                        {log.quantity.toFixed(2)} {log.unitOfMeasure}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                        {formatMoneyUSD(log.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-700 dark:text-neutral-300">
                        <div>{log.userName || "Usuario"}</div>
                        {log.notes && (
                          <div className="text-[11px] text-neutral-500">
                            {log.notes}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: CONFIGURACIÓN POR PRODUCTO & MOTIVOS DE MERMA */}
      {activeTab === "config" && (
        <div className="space-y-6">
          {/* Motivos de Merma */}
          <Card className="p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Catálogo de Motivos de Merma
                </h2>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Categorías disponibles para justificar desperdicios en
                  procesos de desposte o mermas directas.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsReasonModalOpen(true)}
                className="rounded-lg"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nuevo Motivo
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {wasteReasons.map((r) => (
                <div
                  key={r.id}
                  className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50"
                >
                  <div>
                    <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {r.name}
                    </div>
                    <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                      {r.code}
                    </div>
                  </div>
                  <Badge variant={r.isActive ? "success" : "neutral"}>
                    {r.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Configuración por Producto */}
          <Card className="p-0 overflow-hidden rounded-lg">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Reglas de Merma y Desposte por Producto
              </h2>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                Indique qué productos admiten merma, cuáles son materia
                prima/canal de entrada y cuáles son cortes derivados.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 uppercase font-bold text-[11px] tracking-wider border-b border-neutral-300 dark:border-neutral-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Producto / SKU</th>
                    <th className="py-3 px-4 text-right">Stock</th>
                    <th className="py-3 px-4 text-center">Admite Merma</th>
                    <th className="py-3 px-4 text-center">Base / Canal</th>
                    <th className="py-3 px-4 text-center">Corte / Derivado</th>
                    <th className="py-3 px-4 text-right">% Merma Esperada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredProductsConfig.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                          {p.name}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                          {p.sku} · {p.unitOfMeasure}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        {p.currentStock.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={p.allowsWaste}
                          disabled={savingConfigId === p.id}
                          aria-label={`Admite merma ${p.name}`}
                          onChange={(e) =>
                            handleToggleProductConfig(p, {
                              allowsWaste: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={p.isButcheryBase}
                          disabled={savingConfigId === p.id}
                          aria-label={`Es producto base ${p.name}`}
                          onChange={(e) =>
                            handleToggleProductConfig(p, {
                              isButcheryBase: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={p.isButcheryYield}
                          disabled={savingConfigId === p.id}
                          aria-label={`Es corte derivado ${p.name}`}
                          onChange={(e) =>
                            handleToggleProductConfig(p, {
                              isButcheryYield: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          defaultValue={p.expectedWastePct}
                          aria-label={`Porcentaje esperado ${p.name}`}
                          onBlur={(e) => {
                            const val = Number(e.target.value) || 0;
                            if (val !== p.expectedWastePct) {
                              handleToggleProductConfig(p, {
                                expectedWastePct: val,
                              });
                            }
                          }}
                          className="w-20 text-right text-xs font-mono bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1 text-neutral-900 dark:text-neutral-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL NUEVA ORDEN DE DESPOSTE / PRODUCCIÓN */}
      <Modal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        title="Nueva Orden de Desposte / Producción"
        size="3xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Almacén
              </label>
              <select
                value={orderForm.warehouseId}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, warehouseId: e.target.value })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Tipo de Proceso
              </label>
              <select
                value={orderForm.processType}
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    processType: e.target
                      .value as ProductionOrder["processType"],
                  })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
              >
                <option value="WHOLE_CARCASS">Despiece Total / Lote</option>
                <option value="PARTIAL_EXTRACTION">
                  Despiece Parcial (Pieza Intermedia)
                </option>
                <option value="SUBDIVISION">
                  Subdivisión en Cortes Finales
                </option>
                <option value="TRANSFORMATION">
                  Transformación / Producción
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Método de Costeo
              </label>
              <select
                value={orderForm.costAllocationMethod}
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    costAllocationMethod: e.target.value as
                      | "BY_WEIGHT"
                      | "EQUAL_UNIT",
                  })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
              >
                <option value="BY_WEIGHT">
                  Prorrateo Proporcional al Peso Útil
                </option>
                <option value="EQUAL_UNIT">Costo Unitario Base Directo</option>
              </select>
            </div>
          </div>

          {/* Producto Base */}
          <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Producto Base / Pieza a Consumir
                </label>
                <select
                  value={orderForm.sourceProductId}
                  onChange={(e) =>
                    setOrderForm({
                      ...orderForm,
                      sourceProductId: e.target.value,
                    })
                  }
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Seleccione un producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name} (Disp: {p.currentStock.toFixed(2)}{" "}
                      {p.unitOfMeasure})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Cantidad / Peso a Procesar{" "}
                  {sourceProductObj
                    ? `(${sourceProductObj.unitOfMeasure})`
                    : ""}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={orderForm.sourceQuantity}
                  onChange={(e) =>
                    setOrderForm({
                      ...orderForm,
                      sourceQuantity: e.target.value,
                    })
                  }
                  placeholder="Ej. 80 o 500"
                  className="w-full text-xs font-mono bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            {sourceProductObj && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 text-neutral-700 dark:text-neutral-300">
                <span>
                  Stock actual:{" "}
                  <strong className="font-mono">
                    {sourceProductObj.currentStock.toFixed(2)}{" "}
                    {sourceProductObj.unitOfMeasure}
                  </strong>
                  <ArrowRight className="w-3.5 h-3.5 inline mx-1.5" />
                  Saldo restante estimado:{" "}
                  <strong className="font-mono text-sky-700 dark:text-sky-400">
                    {remainingBaseStock.toFixed(2)}{" "}
                    {sourceProductObj.unitOfMeasure}
                  </strong>
                </span>
                <Badge
                  variant={sourceProductObj.allowsWaste ? "info" : "neutral"}
                >
                  {sourceProductObj.allowsWaste
                    ? "Admite Merma"
                    : "Sin Control de Merma"}
                </Badge>
              </div>
            )}
          </div>

          {/* Productos Derivados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                Productos Derivados (Piezas Intermedias / Cortes Finales)
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddOutputRow}
                className="h-7 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Agregar Corte / Pieza
              </Button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {orderForm.outputs.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-neutral-900 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <select
                      value={row.productId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOrderForm((prev) => ({
                          ...prev,
                          outputs: prev.outputs.map((item, i) =>
                            i === idx ? { ...item, productId: val } : item,
                          ),
                        }));
                      }}
                      className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="">Seleccione derivado...</option>
                      {products
                        .filter((p) => p.id !== orderForm.sourceProductId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} - {p.name} ({p.unitOfMeasure})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <select
                      value={row.outputType}
                      onChange={(e) => {
                        const val = e.target.value as
                          | "INTERMEDIATE"
                          | "FINAL_CUT";
                        setOrderForm((prev) => ({
                          ...prev,
                          outputs: prev.outputs.map((item, i) =>
                            i === idx ? { ...item, outputType: val } : item,
                          ),
                        }));
                      }}
                      className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="FINAL_CUT">Corte Final</option>
                      <option value="INTERMEDIATE">Pieza Intermedia</option>
                    </select>
                  </div>

                  <div className="col-span-5 sm:col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Peso / Cant."
                      value={row.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOrderForm((prev) => ({
                          ...prev,
                          outputs: prev.outputs.map((item, i) =>
                            i === idx ? { ...item, quantity: val } : item,
                          ),
                        }));
                      }}
                      className="w-full text-xs font-mono text-right bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>

                  <div className="col-span-1 flex justify-end">
                    {orderForm.outputs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOutputRow(idx)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                        aria-label="Eliminar fila"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Merma y Balance de Masa */}
          <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                <Scale className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>
                  Total Derivados:{" "}
                  <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                    {totalOutputQty.toFixed(2)}
                  </strong>{" "}
                  ({liveYieldPct}%)
                </span>
                <span>
                  Merma:{" "}
                  <strong className="font-mono text-rose-700 dark:text-rose-400">
                    {wasteQtyNum.toFixed(2)}
                  </strong>{" "}
                  ({liveWastePct}%)
                </span>
              </div>

              {unassignedDiff > 0 && sourceProductObj?.allowsWaste && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAssignRemainingAsWaste}
                  className="h-7 text-xs"
                >
                  Asignar {unassignedDiff.toFixed(2)} a Merma
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Merma / Desperdicio Generado
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!sourceProductObj?.allowsWaste}
                  value={orderForm.wasteQuantity}
                  onChange={(e) =>
                    setOrderForm({
                      ...orderForm,
                      wasteQuantity: e.target.value,
                    })
                  }
                  className="w-full text-xs font-mono bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Motivo de Merma
                </label>
                <select
                  disabled={wasteQtyNum <= 0}
                  value={orderForm.wasteReasonId}
                  onChange={(e) =>
                    setOrderForm({
                      ...orderForm,
                      wasteReasonId: e.target.value,
                    })
                  }
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
                >
                  <option value="">Seleccione motivo...</option>
                  {wasteReasons
                    .filter((r) => r.isActive)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Observaciones del Proceso
              </label>
              <input
                type="text"
                value={orderForm.notes}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, notes: e.target.value })
                }
                placeholder="Notas de lote, operador o rendimiento..."
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              variant="outline"
              onClick={() => setIsOrderModalOpen(false)}
              disabled={submittingOrder}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmitOrder(false)}
              disabled={submittingOrder}
            >
              Guardar Borrador
            </Button>
            <Button
              onClick={() => handleSubmitOrder(true)}
              disabled={submittingOrder}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {submittingOrder
                ? "Procesando..."
                : "Procesar y Actualizar Inventario"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL MERMA DIRECTA */}
      <Modal
        isOpen={isWasteModalOpen}
        onClose={() => setIsWasteModalOpen(false)}
        title="Registrar Merma Directa en Inventario"
        size="md"
      >
        <form onSubmit={handleSubmitDirectWaste} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              Almacén
            </label>
            <select
              required
              value={directWasteForm.warehouseId}
              onChange={(e) =>
                setDirectWasteForm({
                  ...directWasteForm,
                  warehouseId: e.target.value,
                })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              Producto (solo productos que admiten merma)
            </label>
            <select
              required
              value={directWasteForm.productId}
              onChange={(e) =>
                setDirectWasteForm({
                  ...directWasteForm,
                  productId: e.target.value,
                })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
            >
              <option value="">Seleccione un producto...</option>
              {products
                .filter((p) => p.allowsWaste)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} - {p.name} (Disp: {p.currentStock.toFixed(2)}{" "}
                    {p.unitOfMeasure})
                  </option>
                ))}
            </select>
            {products.filter((p) => p.allowsWaste).length === 0 && (
              <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-300 flex items-center justify-between gap-2">
                <span>
                  Ningún producto tiene habilitado &quot;Admite Merma&quot;. Actívelo en Configuración.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsWasteModalOpen(false);
                    setActiveTab('config');
                  }}
                  className="font-bold underline shrink-0 cursor-pointer"
                >
                  Configurar ahora
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Cantidad / Peso
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={directWasteForm.quantity}
                onChange={(e) =>
                  setDirectWasteForm({
                    ...directWasteForm,
                    quantity: e.target.value,
                  })
                }
                className="w-full text-xs font-mono bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Motivo
              </label>
              <select
                required
                value={directWasteForm.wasteReasonId}
                onChange={(e) =>
                  setDirectWasteForm({
                    ...directWasteForm,
                    wasteReasonId: e.target.value,
                  })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
              >
                {wasteReasons
                  .filter((r) => r.isActive)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              Justificación / Notas
            </label>
            <input
              type="text"
              value={directWasteForm.notes}
              onChange={(e) =>
                setDirectWasteForm({
                  ...directWasteForm,
                  notes: e.target.value,
                })
              }
              placeholder="Ej. Deshidratación de cámara fría..."
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsWasteModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submittingWaste}>
              {submittingWaste ? "Registrando..." : "Registrar Merma"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL NUEVO MOTIVO DE MERMA */}
      <Modal
        isOpen={isReasonModalOpen}
        onClose={() => setIsReasonModalOpen(false)}
        title="Nuevo Motivo de Merma"
        size="sm"
      >
        <form onSubmit={handleCreateWasteReason} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              Código
            </label>
            <input
              required
              type="text"
              value={reasonForm.code}
              onChange={(e) =>
                setReasonForm({
                  ...reasonForm,
                  code: e.target.value.toUpperCase(),
                })
              }
              placeholder="Ej. EVISCERADO"
              className="w-full text-xs font-mono bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              Nombre del Motivo
            </label>
            <input
              required
              type="text"
              value={reasonForm.name}
              onChange={(e) =>
                setReasonForm({ ...reasonForm, name: e.target.value })
              }
              placeholder="Ej. Desperdicio por eviscerado"
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReasonModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Guardar Motivo</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
