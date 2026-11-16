import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import {
  FileText,
  Plus,
  Trash2,
  X,
  Check,
  AlertTriangle,
  ClipboardList,
  Building2,
  Calendar,
  TrendingDown,
  TrendingUp,
  Search,
  Package,
} from 'lucide-react';
import { ProductSearchModal } from '../../components/search';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD } from '../../utils/formatters';
import { showConfirmQuestion } from '../../lib/sweetalert';
import { Modal } from '../../components/ui/Modal';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';

interface AdjustmentRecord {
  id: string;
  adjustment_number: string;
  type: string;
  adjustment_date: string;
  total_cost_impact: number;
  reason: string;
  status: string;
  branch_name: string;
  warehouse_name: string;
  user_name: string;
  items_count: number;
}

interface NewAdjustmentItem {
  productId: string;
  productName: string;
  sku: string;
  movementType: 'ADJUST_IN' | 'ADJUST_OUT';
  quantity: number;
  unitCost: number;
  notes?: string;
}

export const InventoryAdjustmentsView: React.FC = () => {
  const { activeBranchId, activeWarehouseId, token } = useAuthStore();
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    endpoint: string | null;
    title: string;
    filename?: string;
  }>({
    isOpen: false,
    endpoint: null,
    title: '',
  });


  // Form State
  const [adjustmentType, setAdjustmentType] = useState<string>('DAMAGE_SPOILED');
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<NewAdjustmentItem[]>([]);

  // Selección de producto en formulario
  const [catalog, setCatalog] = useState<{ id: string; sku: string; name: string; cost: number; barcode?: string; currentStock?: number }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [newProductId, setNewProductId] = useState('');
  const [newMovementType, setNewMovementType] = useState<'ADJUST_IN' | 'ADJUST_OUT'>('ADJUST_OUT');
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newUnitCost, setNewUnitCost] = useState<number>(0);
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch('/api/inventory/products', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const mapped = json.data.map((p: any) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              barcode: p.barcode,
              cost: Number(p.costPrice || p.cost_price || 0),
              costPrice: Number(p.costPrice || p.cost_price || 0),
              defaultCost: Number(p.costPrice || p.cost_price || 0),
              currentStock: Number(p.currentStock || p.current_stock || 0),
            }));
            setCatalog(mapped);
            if (mapped.length > 0) {
              setNewProductId(mapped[0].id);
              setNewUnitCost(mapped[0].cost);
              setSelectedProduct(mapped[0]);
            }
          }
        }
      } catch {
        // Ignorar
      }
    };
    fetchCatalog();
  }, [token]);

  useEffect(() => {
    fetchAdjustments();
  }, [activeBranchId, activeWarehouseId]);

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append('branchId', activeBranchId);
      if (activeWarehouseId) params.append('warehouseId', activeWarehouseId);

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/adjustments?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAdjustments(json.data);
        } else {
          setAdjustments([]);
        }
      } else {
        setAdjustments([]);
      }
    } catch {
      setAdjustments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const prod = catalog.find((p) => p.id === newProductId) || selectedProduct;
    if (!prod) {
      toast.error('Seleccione un producto del catálogo');
      return;
    }
    if (newQuantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        movementType: newMovementType,
        quantity: newQuantity,
        unitCost: newUnitCost || prod.cost || 0,
        notes: newNotes.trim() || undefined,
      },
    ]);

    setNewQuantity(1);
    setNewNotes('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitAdjustment = async () => {
    if (!reason.trim()) {
      toast.error('Debe indicar el motivo o justificación del ajuste');
      return;
    }
    if (items.length === 0) {
      toast.error('Debe agregar al menos un producto a la lista de ajuste');
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: '¿Aplicar ajuste de inventario?',
      text: `Se procesará el ajuste con ${items.length} producto(s) afectando inmediatamente las existencias del depósito actual.`,
      confirmButtonText: 'Sí, aplicar ajuste',
      cancelButtonText: 'Cancelar',
      icon: 'question',
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          branchId: activeBranchId || 'b1111111-1111-1111-1111-111111111111',
          warehouseId: activeWarehouseId || 'w1111111-1111-1111-1111-111111111111',
          type: adjustmentType,
          reason: reason.trim(),
          items: items.map((i) => ({
            productId: i.productId,
            movementType: i.movementType,
            quantity: i.quantity,
            unitCost: i.unitCost,
            notes: i.notes || null,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al registrar el ajuste');
      }

      toast.success(`Ajuste ${json.data.adjustmentNumber} registrado y aplicado al Kardex`);
      setShowModal(false);
      setReason('');
      fetchAdjustments();

      // Abrir inmediatamente la visualización y descarga en PDF
      if (json.data?.id) {
        setPdfModal({
          isOpen: true,
          endpoint: `/api/inventory/adjustments/${json.data.id}/pdf`,
          title: `Comprobante de Ajuste N° ${json.data.adjustmentNumber || ''}`,
          filename: `ajuste_inventario_${json.data.adjustmentNumber || 'doc'}.pdf`,
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar ajuste');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'DAMAGE_SPOILED':
        return <Badge variant="danger">MERMA / DAÑADO</Badge>;
      case 'EXPIRED':
        return <Badge variant="danger">VENCIDO</Badge>;
      case 'FOUND_SURPLUS':
        return <Badge variant="success">SOBRANTE</Badge>;
      case 'PHYSICAL_COUNT':
        return <Badge variant="info">CONTEO FÍSICO</Badge>;
      case 'THEFT_LOSS':
        return <Badge variant="danger">PÉRDIDA / ROBO</Badge>;
      case 'INTERNAL_CONSUMPTION':
        return <Badge variant="neutral">CONSUMO INTERNO</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const columns: Column<AdjustmentRecord>[] = [
    {
      header: 'Fecha / N° Ajuste',
      accessorKey: 'adjustment_number',
      cell: (a) => (
        <div className="flex flex-col text-xs font-mono min-w-[130px]">
          <span className="font-bold text-sky-700 dark:text-sky-400">{a.adjustment_number}</span>
          <span className="text-[10px] text-neutral-400">
            {new Date(a.adjustment_date).toLocaleDateString('es-VE')} {new Date(a.adjustment_date).toLocaleTimeString('es-VE')}
          </span>
        </div>
      ),
    },
    {
      header: 'Tipo de Ajuste',
      accessorKey: 'type',
      cell: (a) => (
        <div className="min-w-[140px]">
          {getTypeBadge(a.type)}
        </div>
      ),
    },
    {
      header: 'Depósito / Sucursal',
      cell: (a) => (
        <div className="flex flex-col text-xs min-w-[160px]">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{a.warehouse_name}</span>
          <span className="text-[10px] text-neutral-400 truncate">{a.branch_name}</span>
        </div>
      ),
    },
    {
      header: 'Items',
      accessorKey: 'items_count',
      cell: (a) => (
        <div className="min-w-[80px] text-center">
          <span className="font-mono text-xs">{a.items_count} prod(s)</span>
        </div>
      ),
    },
    {
      header: 'Impacto en Costo',
      accessorKey: 'total_cost_impact',
      cell: (a) => {
        const val = Number(a.total_cost_impact);
        return (
          <div className="min-w-[110px] text-right">
            <span className={`font-mono font-bold text-xs ${val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {val >= 0 ? `+${formatMoneyUSD(val)}` : `-${formatMoneyUSD(Math.abs(val))}`}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Motivo / Justificación',
      accessorKey: 'reason',
      cell: (a) => (
        <div className="min-w-[200px] max-w-sm">
          <span className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-2">{a.reason}</span>
        </div>
      ),
    },
    {
      header: 'Usuario',
      accessorKey: 'user_name',
      cell: (a) => (
        <div className="min-w-[100px]">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{a.user_name}</span>
        </div>
      ),
    },
    {
      header: 'Estado',
      accessorKey: 'status',
      cell: () => (
        <div className="min-w-[90px] text-center">
          <Badge variant="success">APLICADO</Badge>
        </div>
      ),
    },
    {
      header: 'Acción',
      cell: (a) => (
        <div className="min-w-[80px] text-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setPdfModal({
                isOpen: true,
                endpoint: `/api/inventory/adjustments/${a.id}/pdf`,
                title: `Comprobante de Ajuste ${a.adjustment_number}`,
                filename: `comprobante_ajuste_${a.adjustment_number}.pdf`,
              })
            }
            className="h-8 px-2 text-xs text-sky-700 hover:text-sky-800 dark:text-sky-400"
            title="Ver / Reimprimir Comprobante de Ajuste en PDF"
          >
            <FileText className="w-3.5 h-3.5 mr-1 text-sky-600 dark:text-sky-400" />
            PDF
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Ajustes de Inventario
            </h1>
            <Badge variant="neutral">CONTROL DE MERMAS & CONTEO</Badge>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-400 mt-1">
            Registro de mermas, averías, sobrantes y correcciones de existencias
            físicas con afectación contable.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 border-[#007BFF] dark:border-[#3D91FF] rounded-lg bg-blue-50 dark:bg-blue-600/30 hover:bg-border-blue-600 dark:hover:border-blue-500"
          title="Nuevo Ajuste de Inventario"
        >
          <Plus className="w-4 h-4 text-blue-600 dark:blue-500 mr-1.5" />
          Nuevo Ajuste de Inventario
        </Button>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
            Total Ajustes Registrados
          </span>
          <div className="text-2xl font-bold font-mono text-[#007BFF] dark:text-[#3D91FF] mt-1">
            {adjustments.length}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Auditoría completa</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500 dark:border-l-red-400 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
            Ajustes por Merma / Avería
          </span>
          <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
            {
              adjustments.filter(
                (a) => a.type === "DAMAGE_SPOILED" || a.type === "EXPIRED",
              ).length
            }
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
            Productos dañados o vencidos
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
            Ajustes por Conteo Físico
          </span>
          <div className="text-2xl font-bold font-mono text-[#17A2B8] dark:text-[#38C9DD] mt-1">
            {adjustments.filter((a) => a.type === "PHYSICAL_COUNT").length}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
            Cuadre de existencias
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
            Impacto Neto en Costo
          </span>
          <div className="text-2xl font-bold font-mono text-[#b28500] dark:text-[#FBBF24] mt-1">
            {formatMoneyUSD(
              adjustments.reduce(
                (sum, a) => sum + Number(a.total_cost_impact),
                0,
              ),
            )}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
            Afectación neta de valor
          </div>
        </Card>
      </div>

      {/* Tabla de Historial de Ajustes */}
      <Card className="p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-8 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
          </div>
        ) : (
          <DataTable
            data={adjustments}
            columns={columns}
            searchPlaceholder="Buscar por N° ajuste, motivo o depósito..."
            searchKey="adjustment_number"
          />
        )}
      </Card>

      {/* Modal de Nuevo Ajuste */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Ajuste de Inventario"
        description="Ajuste de existencias por mermas, vencimientos, roturas o conteo físico"
        size="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs font-mono">
              {items.length > 0 && (
                <span className="text-neutral-500">
                  Total Renglones: <strong className="text-neutral-800 dark:text-neutral-200">{items.length}</strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={submitting || items.length === 0}
                onClick={handleSubmitAdjustment}
              >
                <Check className="w-4 h-4 mr-1.5" />
                Aplicar Ajuste a Inventario
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Tipo de Ajuste
              </label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value)}
                className="w-full h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="DAMAGE_SPOILED">Merma / Producto Dañado</option>
                <option value="EXPIRED">Producto Vencido</option>
                <option value="PHYSICAL_COUNT">
                  Corrección por Conteo Físico
                </option>
                <option value="FOUND_SURPLUS">Sobrante Encontrado</option>
                <option value="THEFT_LOSS">Faltante / Pérdida</option>
                <option value="INTERNAL_CONSUMPTION">Consumo Interno</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Motivo / Justificación *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Empaques averiados durante descarga de camión"
                className="w-full h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
                required
              />
            </div>
          </div>

          {/* Agregar Producto al Ajuste */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                Seleccionar Producto:
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowProductSearch(true)}
                className="h-7 text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40"
              >
                <Search className="w-3.5 h-3.5 mr-1" />
                Buscar en Catálogo (Modal)
              </Button>
            </div>

            {selectedProduct && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-sky-600 shrink-0" />
                  <div>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {selectedProduct.name}
                    </span>
                    <span className="ml-2 font-mono text-[11px] text-neutral-500">
                      SKU: {selectedProduct.sku}
                    </span>
                    {selectedProduct.barcode && (
                      <span className="ml-2 font-mono text-[11px] text-neutral-400">
                        [{selectedProduct.barcode}]
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-neutral-600 dark:text-neutral-300">
                  Costo Ref: <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatMoneyUSD(newUnitCost)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-4">
                <label className="text-[11px] text-neutral-500 dark:text-neutral-400 block mb-1">
                  Producto en Lista Rápida
                </label>
                <select
                  value={newProductId}
                  onChange={(e) => {
                    setNewProductId(e.target.value);
                    const p = catalog.find((c) => c.id === e.target.value);
                    if (p) {
                      setNewUnitCost(p.cost);
                      setSelectedProduct(p);
                    }
                  }}
                  className="w-full h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                >
                  {catalog.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] text-neutral-500 dark:text-neutral-400 block mb-1">
                  Tipo Movimiento
                </label>
                <select
                  value={newMovementType}
                  onChange={(e) => setNewMovementType(e.target.value as any)}
                  className="w-full h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="ADJUST_OUT">Salida / Descontar (-)</option>
                  <option value="ADJUST_IN">Entrada / Sumar (+)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] text-neutral-500 dark:text-neutral-400 block mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={newQuantity}
                  onChange={(e) =>
                    setNewQuantity(parseFloat(e.target.value) || 0)
                  }
                  className="w-full h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-mono font-bold bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-center"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] text-neutral-500 dark:text-neutral-400 block mb-1">
                  Costo Unit. ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newUnitCost}
                  onChange={(e) =>
                    setNewUnitCost(parseFloat(e.target.value) || 0)
                  }
                  className="w-full h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-mono bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-right"
                />
              </div>

              <div className="sm:col-span-1">
                <Button
                  size="sm"
                  onClick={handleAddItem}
                  className="w-full h-8 px-2"
                  title="Añadir producto a la lista de ajuste"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Observación opcional para este renglón (ej: Lote L-2024 averiado)"
                className="w-full h-7 px-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[11px] bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400"
              />
            </div>
          </div>

          {/* Tabla de Productos a Ajustar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200 block">
                Renglones a Ajustar ({items.length}):
              </span>
              {items.length > 0 && (
                <span className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300">
                  Impacto Neto Total:{" "}
                  <span
                    className={
                      items.reduce(
                        (sum, it) =>
                          sum +
                          (it.movementType === "ADJUST_IN"
                            ? it.quantity * it.unitCost
                            : -it.quantity * it.unitCost),
                        0,
                      ) >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  >
                    {formatMoneyUSD(
                      items.reduce(
                        (sum, it) =>
                          sum +
                          (it.movementType === "ADJUST_IN"
                            ? it.quantity * it.unitCost
                            : -it.quantity * it.unitCost),
                        0,
                      ),
                    )}
                  </span>
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400">
                <Package className="w-6 h-6 mx-auto mb-1 text-neutral-300 dark:text-neutral-600" />
                No hay productos en la lista. Busque un producto arriba o use el buscador modal y haga clic en el botón de agregar.
              </div>
            ) : (
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 min-w-[200px]">Producto & SKU</th>
                      <th className="p-2.5 w-32 text-center">Tipo Movimiento</th>
                      <th className="p-2.5 w-24 text-center">Cantidad</th>
                      <th className="p-2.5 w-28 text-right">Costo Unit. ($)</th>
                      <th className="p-2.5 w-32 text-right">Impacto Total ($)</th>
                      <th className="p-2.5 w-14 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {items.map((it, idx) => {
                      const lineTotal = it.quantity * it.unitCost;
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                        >
                          <td className="p-2.5">
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {it.productName}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono">
                              SKU: {it.sku}
                              {it.notes ? ` • Nota: ${it.notes}` : ""}
                            </div>
                          </td>
                          <td className="p-2.5 text-center">
                            <Badge
                              variant={
                                it.movementType === "ADJUST_IN"
                                  ? "success"
                                  : "danger"
                              }
                            >
                              {it.movementType === "ADJUST_IN"
                                ? "Entrada (+)"
                                : "Salida (-)"}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold">
                            {it.movementType === "ADJUST_IN"
                              ? `+${it.quantity}`
                              : `-${it.quantity}`}
                          </td>
                          <td className="p-2.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                            {formatMoneyUSD(it.unitCost)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            <span
                              className={
                                it.movementType === "ADJUST_IN"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600 dark:text-red-400"
                              }
                            >
                              {it.movementType === "ADJUST_IN"
                                ? `+${formatMoneyUSD(lineTotal)}`
                                : `-${formatMoneyUSD(lineTotal)}`}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-neutral-400 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              title="Quitar producto de la lista"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* Modal Buscador de Productos */}
      <ProductSearchModal
        isOpen={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        onSelect={(prod) => {
          setNewProductId(prod.id);
          const cost = Number(
            prod.defaultCost ?? prod.costPrice ?? (prod as any).cost ?? 0,
          );
          setNewUnitCost(cost);
          setSelectedProduct(prod);
          setShowProductSearch(false);
        }}
        products={catalog}
        warehouseId={activeWarehouseId || undefined}
        mode="general"
      />

      {/* Modal Visor / Descarga PDF de Ajuste de Inventario */}
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
