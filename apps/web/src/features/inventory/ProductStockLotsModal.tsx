import React, { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  Warehouse,
  Calendar,
  AlertTriangle,
  Clock,
  Plus,
  Boxes,
  MapPin,
  CheckCircle2,
  XCircle,
  Building2,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { formatMoneyUSD, formatNumber } from "../../utils/formatters";
import { ProductItem } from "./ProductCatalog";

export interface WarehouseStockItem {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  isDefaultSales: boolean;
  isDefaultPurchases: boolean;
  branchId: string;
  branchName: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  aisle: string | null;
  shelf: string | null;
  compartment: string | null;
  locationNotes: string | null;
  costPrice: number;
  basePrice: number;
  totalCostValuation: number;
  totalSaleValuation: number;
}

export interface ProductLotRecord {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  branchName: string;
  lotNumber: string;
  manufacturingDate: string | null;
  expirationDate: string;
  daysToExpiration: number;
  initialQuantity: number;
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  costPrice: number;
  status: "ACTIVE" | "EXPIRED" | "DEPLETED" | "QUARANTINE";
  isExpiringSoon: boolean;
  isExpired: boolean;
  notes: string | null;
  createdAt: string;
}

interface ProductStockLotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductItem | null;
  onRefreshParent?: () => void;
}

export const ProductStockLotsModal: React.FC<ProductStockLotsModalProps> = ({
  isOpen,
  onClose,
  product,
  onRefreshParent,
}) => {
  const { token } = useAuthStore();

  const [activeTab, setActiveTab] = useState<"warehouses" | "lots">("warehouses");
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStockItem[]>([]);
  const [lots, setLots] = useState<ProductLotRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario para Registrar Nuevo Lote
  const [isAddingLot, setIsAddingLot] = useState<boolean>(false);
  const [isSavingLot, setIsSavingLot] = useState<boolean>(false);
  const [lotForm, setLotForm] = useState<{
    warehouseId: string;
    lotNumber: string;
    manufacturingDate: string;
    expirationDate: string;
    quantity: number;
    costPrice: number;
    adjustStock: boolean;
    notes: string;
  }>({
    warehouseId: "",
    lotNumber: "",
    manufacturingDate: "",
    expirationDate: "",
    quantity: 0,
    costPrice: 0,
    adjustStock: true,
    notes: "",
  });

  const fetchData = async () => {
    if (!product?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const [stockRes, lotsRes] = await Promise.all([
        fetch(`/api/inventory/products/${product.id}/stock-by-warehouse`, { headers }),
        fetch(`/api/inventory/products/${product.id}/lots`, { headers }),
      ]);

      if (!stockRes.ok) throw new Error("Error al consultar existencias en almacenes");
      const stockJson = await stockRes.json();
      if (stockJson.success && Array.isArray(stockJson.data)) {
        setWarehouseStocks(stockJson.data);
        if (stockJson.data.length > 0 && !lotForm.warehouseId) {
          const defaultWh = stockJson.data.find((w: WarehouseStockItem) => w.isDefaultSales) || stockJson.data[0];
          setLotForm((prev) => ({
            ...prev,
            warehouseId: defaultWh.warehouseId,
            costPrice: product.costPrice || 0,
          }));
        }
      }

      if (lotsRes.ok) {
        const lotsJson = await lotsRes.json();
        if (lotsJson.success && Array.isArray(lotsJson.data)) {
          setLots(lotsJson.data);
        }
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar la información");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && product) {
      fetchData();
      // Si el producto maneja lotes y tiene alerta, sugerir pestaña lotes si no hay stock
      if (product.hasBatches && (!product.currentStock || product.currentStock === 0)) {
        setActiveTab("lots");
      } else {
        setActiveTab("warehouses");
      }
      setIsAddingLot(false);
    }
  }, [isOpen, product?.id]);

  // Totales consolidados de almacenes
  const consolidated = React.useMemo(() => {
    let currentStock = 0;
    let reservedStock = 0;
    let availableStock = 0;
    let totalCost = 0;
    let totalSale = 0;

    for (const s of warehouseStocks) {
      currentStock += s.currentStock;
      reservedStock += s.reservedStock;
      availableStock += s.availableStock;
      totalCost += s.totalCostValuation;
      totalSale += s.totalSaleValuation;
    }

    return { currentStock, reservedStock, availableStock, totalCost, totalSale };
  }, [warehouseStocks]);

  // Resumen de Lotes
  const lotsSummary = React.useMemo(() => {
    let activeCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let totalLotQuantity = 0;

    for (const l of lots) {
      totalLotQuantity += l.currentQuantity;
      if (l.isExpired) expiredCount++;
      else if (l.isExpiringSoon) expiringSoonCount++;
      else activeCount++;
    }

    return { activeCount, expiringSoonCount, expiredCount, totalLotQuantity };
  }, [lots]);

  const handleCreateLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product?.id) return;

    if (!lotForm.lotNumber.trim()) {
      toast.error("El número de lote es obligatorio");
      return;
    }
    if (!lotForm.warehouseId) {
      toast.error("Debe seleccionar un almacén para el lote");
      return;
    }
    if (!lotForm.expirationDate) {
      toast.error("La fecha de vencimiento es obligatoria");
      return;
    }

    setIsSavingLot(true);
    try {
      const res = await fetch(`/api/inventory/products/${product.id}/lots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          warehouseId: lotForm.warehouseId,
          lotNumber: lotForm.lotNumber.trim().toUpperCase(),
          manufacturingDate: lotForm.manufacturingDate || null,
          expirationDate: lotForm.expirationDate,
          initialQuantity: Number(lotForm.quantity) || 0,
          currentQuantity: Number(lotForm.quantity) || 0,
          costPrice: Number(lotForm.costPrice) || 0,
          adjustStock: Boolean(lotForm.adjustStock),
          notes: lotForm.notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || "Error al registrar el lote");
      }

      toast.success(`Lote ${lotForm.lotNumber.toUpperCase()} registrado exitosamente`);
      setIsAddingLot(false);
      setLotForm((prev) => ({
        ...prev,
        lotNumber: "",
        manufacturingDate: "",
        expirationDate: "",
        quantity: 0,
        notes: "",
      }));
      await fetchData();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el lote");
    } finally {
      setIsSavingLot(false);
    }
  };

  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Control de Existencias & Trazabilidad"
      subtitle={`${product.name} — SKU: ${product.sku}${product.brand ? ` | Marca: ${product.brand}` : ""}`}
      icon={<Boxes className="w-5 h-5 text-sky-600" />}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Unidad de Medida Base:</span>
            <Badge variant="neutral" className="font-mono text-xs">
              {product.unitOfMeasure || "UND"}
            </Badge>
            {product.hasBatches && (
              <Badge variant="warning" className="text-amber-700 bg-amber-50 border-amber-200 text-xs">
                Maneja Lotes & Vencimiento
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={onClose} className="rounded-lg">
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Pestañas de Navegación del Modal */}
        <div className="flex items-center gap-1 border-b border-neutral-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("warehouses")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "warehouses"
                ? "bg-sky-50 text-sky-700 font-semibold"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Warehouse className="w-4 h-4" />
            <span>Existencias por Almacén</span>
            <span className="px-1.5 py-0.2 rounded-full bg-neutral-200 text-neutral-700 text-[10px]">
              {warehouseStocks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("lots")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "lots"
                ? "bg-sky-50 text-sky-700 font-semibold"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Lotes & Vencimientos</span>
            {product.hasBatches ? (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  lotsSummary.expiredCount > 0
                    ? "bg-red-200 text-red-800 font-bold"
                    : lotsSummary.expiringSoonCount > 0
                    ? "bg-amber-200 text-amber-800 font-bold"
                    : "bg-emerald-200 text-emerald-800"
                }`}
              >
                {lots.length}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full bg-neutral-100 text-neutral-500 text-[10px]">
                Inactivo
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 1: EXISTENCIAS POR ALMACÉN                       */}
        {/* ======================================================== */}
        {activeTab === "warehouses" && (
          <div className="flex flex-col gap-4">
            {/* Tarjetas de Resumen Consolidado */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                <span className="text-[11px] text-neutral-500 font-medium block">
                  Existencia Total
                </span>
                <span className="text-lg font-bold text-neutral-900">
                  {formatNumber(consolidated.currentStock, { maximumFractionDigits: 2 })}{" "}
                  <span className="text-xs font-normal text-neutral-500">
                    {product.unitOfMeasure || "UND"}
                  </span>
                </span>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                <span className="text-[11px] text-neutral-500 font-medium block">
                  Stock Disponible
                </span>
                <span
                  className={`text-lg font-bold ${
                    consolidated.availableStock <= 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {formatNumber(consolidated.availableStock, { maximumFractionDigits: 2 })}{" "}
                  <span className="text-xs font-normal text-neutral-500">
                    {product.unitOfMeasure || "UND"}
                  </span>
                </span>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                <span className="text-[11px] text-neutral-500 font-medium block">
                  Valorizado Costo ($)
                </span>
                <span className="text-lg font-bold text-neutral-900 font-mono">
                  {formatMoneyUSD(consolidated.totalCost)}
                </span>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                <span className="text-[11px] text-neutral-500 font-medium block">
                  Valorizado Venta ($)
                </span>
                <span className="text-lg font-bold text-neutral-900 font-mono">
                  {formatMoneyUSD(consolidated.totalSale)}
                </span>
              </div>
            </div>

            {/* Tabla de Almacenes */}
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : warehouseStocks.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-500">
                No hay depósitos o almacenes configurados en la empresa.
              </div>
            ) : (
              <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 font-semibold text-neutral-700">
                    <tr>
                      <th className="p-2.5">Depósito / Sucursal</th>
                      <th className="p-2.5 text-center">Actual</th>
                      <th className="p-2.5 text-center">Reservado</th>
                      <th className="p-2.5 text-center">Disponible</th>
                      <th className="p-2.5">Ubicación Física</th>
                      <th className="p-2.5 text-right">Val. Costo</th>
                      <th className="p-2.5 text-right">Val. Venta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {warehouseStocks.map((w) => (
                      <tr key={w.warehouseId} className="hover:bg-neutral-50/50">
                        <td className="p-2.5">
                          <div className="flex flex-col">
                            <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                              {w.warehouseName} ({w.warehouseCode})
                              {w.isDefaultSales && (
                                <Badge variant="info" className="text-[9px] py-0 px-1 text-sky-700 bg-sky-50 border-sky-200">
                                  Ventas
                                </Badge>
                              )}
                              {w.isDefaultPurchases && (
                                <Badge variant="neutral" className="text-[9px] py-0 px-1 text-purple-700 bg-purple-50 border-purple-200">
                                  Compras
                                </Badge>
                              )}
                            </span>
                            <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {w.branchName}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-mono font-medium text-neutral-800">
                          {formatNumber(w.currentStock, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-center font-mono text-neutral-500">
                          {formatNumber(w.reservedStock, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold">
                          <span
                            className={
                              w.availableStock <= 0 ? "text-red-600" : "text-emerald-700"
                            }
                          >
                            {formatNumber(w.availableStock, { maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="p-2.5 text-neutral-700">
                          {w.aisle ? (
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <span>
                                Pasillo {w.aisle}
                                {w.shelf ? ` • Estante ${w.shelf}` : ""}
                                {w.compartment ? ` • Comp. ${w.compartment}` : ""}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-400 italic">
                              Sin ubicación física
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono text-neutral-600">
                          {formatMoneyUSD(w.totalCostValuation)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-neutral-900">
                          {formatMoneyUSD(w.totalSaleValuation)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 2: CONTROL DE LOTES Y VENCIMIENTOS              */}
        {/* ======================================================== */}
        {activeTab === "lots" && (
          <div className="flex flex-col gap-4">
            {!product.hasBatches && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Este producto no tiene activada la casilla de <strong>"Manejo de Lotes y Vencimiento"</strong> en su ficha principal. Puede activarla editando el producto.
                  </span>
                </div>
              </div>
            )}

            {/* Tarjetas Semáforo de Lotes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-800 font-medium block">
                    Lotes Vigentes
                  </span>
                  <span className="text-lg font-bold text-emerald-900">
                    {lotsSummary.activeCount}
                  </span>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>

              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-amber-800 font-medium block">
                    Por Vencer (≤30d)
                  </span>
                  <span className="text-lg font-bold text-amber-900">
                    {lotsSummary.expiringSoonCount}
                  </span>
                </div>
                <Clock className="w-5 h-5 text-amber-600" />
              </div>

              <div className="p-3 bg-red-50/60 border border-red-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-red-800 font-medium block">
                    Lotes Vencidos
                  </span>
                  <span className="text-lg font-bold text-red-900">
                    {lotsSummary.expiredCount}
                  </span>
                </div>
                <XCircle className="w-5 h-5 text-red-600" />
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-neutral-600 font-medium block">
                    Unidades en Lote
                  </span>
                  <span className="text-lg font-bold text-neutral-900">
                    {formatNumber(lotsSummary.totalLotQuantity, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <Boxes className="w-5 h-5 text-neutral-500" />
              </div>
            </div>

            {/* Botón y Formulario para Registrar Nuevo Lote */}
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-900 uppercase">
                Listado de Lotes Registrados
              </h4>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsAddingLot(!isAddingLot)}
                className="rounded-lg"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {isAddingLot ? "Cerrar Registro" : "Registrar / Ingresar Lote"}
              </Button>
            </div>

            {/* Formulario colapsable para Crear / Ingresar Lote */}
            {isAddingLot && (
              <form
                onSubmit={handleCreateLot}
                className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg flex flex-col gap-3"
              >
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                  <h5 className="text-xs font-bold text-neutral-800">
                    Ingresar Nuevo Lote con Vencimiento
                  </h5>
                  <span className="text-[11px] text-neutral-500">
                    Establece el número de lote, depósito y fecha de expiración
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Número de Lote *"
                    placeholder="Ej: LOT-2026-003"
                    value={lotForm.lotNumber}
                    onChange={(e) =>
                      setLotForm({ ...lotForm, lotNumber: e.target.value.toUpperCase() })
                    }
                    required
                  />

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Almacén de Depósito *
                    </label>
                    <select
                      value={lotForm.warehouseId}
                      onChange={(e) => setLotForm({ ...lotForm, warehouseId: e.target.value })}
                      className="w-full h-10 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      required
                    >
                      <option value="">Seleccione depósito...</option>
                      {warehouseStocks.map((w) => (
                        <option key={w.warehouseId} value={w.warehouseId}>
                          {w.warehouseName} ({w.branchName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Cantidad en el Lote *"
                    type="number"
                    min="0"
                    step="0.01"
                    value={lotForm.quantity}
                    onChange={(e) =>
                      setLotForm({ ...lotForm, quantity: parseFloat(e.target.value) || 0 })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Fecha de Fabricación"
                    type="date"
                    value={lotForm.manufacturingDate}
                    onChange={(e) =>
                      setLotForm({ ...lotForm, manufacturingDate: e.target.value })
                    }
                  />

                  <Input
                    label="Fecha de Vencimiento *"
                    type="date"
                    value={lotForm.expirationDate}
                    onChange={(e) =>
                      setLotForm({ ...lotForm, expirationDate: e.target.value })
                    }
                    required
                  />

                  <Input
                    label="Costo Unitario ($)"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={lotForm.costPrice}
                    onChange={(e) =>
                      setLotForm({ ...lotForm, costPrice: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <Input
                    label="Notas / Proveedor / Documento"
                    placeholder="Ej: Factura de importación #9872"
                    value={lotForm.notes}
                    onChange={(e) => setLotForm({ ...lotForm, notes: e.target.value })}
                  />

                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="adjustStockCheck"
                      checked={lotForm.adjustStock}
                      onChange={(e) =>
                        setLotForm({ ...lotForm, adjustStock: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                    />
                    <label
                      htmlFor="adjustStockCheck"
                      className="text-xs text-neutral-800 font-medium cursor-pointer"
                    >
                      Incrementar automáticamente existencias en el depósito (+ Kardex)
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingLot(false)}
                    disabled={isSavingLot}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" isLoading={isSavingLot}>
                    Guardar Lote
                  </Button>
                </div>
              </form>
            )}

            {/* Tabla de Lotes Registrados */}
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : lots.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-500">
                No hay lotes registrados para este producto. Presione <strong>"Registrar / Ingresar Lote"</strong> para incorporar el primer lote con su vencimiento.
              </div>
            ) : (
              <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 font-semibold text-neutral-700">
                    <tr>
                      <th className="p-2.5">Lote #</th>
                      <th className="p-2.5">Almacén</th>
                      <th className="p-2.5">Fabricación</th>
                      <th className="p-2.5">Vencimiento</th>
                      <th className="p-2.5 text-center">Caducidad / Semáforo</th>
                      <th className="p-2.5 text-center">Cant. Actual</th>
                      <th className="p-2.5 text-center">Disponible</th>
                      <th className="p-2.5">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {lots.map((l) => (
                      <tr key={l.id} className="hover:bg-neutral-50/50">
                        <td className="p-2.5 font-mono font-bold text-neutral-900">
                          {l.lotNumber}
                        </td>
                        <td className="p-2.5">
                          <span className="font-medium text-neutral-800">
                            {l.warehouseName}
                          </span>
                          <span className="block text-[10px] text-neutral-400">
                            {l.branchName}
                          </span>
                        </td>
                        <td className="p-2.5 text-neutral-600 font-mono">
                          {l.manufacturingDate || "N/A"}
                        </td>
                        <td className="p-2.5 font-mono font-medium text-neutral-800">
                          {l.expirationDate}
                        </td>
                        <td className="p-2.5 text-center">
                          {l.isExpired ? (
                            <Badge variant="danger" className="text-[10px] py-0 px-2 text-red-700 bg-red-50 border-red-300">
                              Vencido hace {Math.abs(l.daysToExpiration)}d
                            </Badge>
                          ) : l.isExpiringSoon ? (
                            <Badge variant="warning" className="text-[10px] py-0 px-2 text-amber-700 bg-amber-50 border-amber-300">
                              Vence en {l.daysToExpiration}d
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px] py-0 px-2 text-emerald-700 bg-emerald-50 border-emerald-300">
                              Vigente ({l.daysToExpiration}d)
                            </Badge>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-neutral-900">
                          {formatNumber(l.currentQuantity, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-center font-mono font-medium text-emerald-700">
                          {formatNumber(l.availableQuantity, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-neutral-500 text-[11px]">
                          {l.notes || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
