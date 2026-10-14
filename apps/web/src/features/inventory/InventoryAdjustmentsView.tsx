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
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';

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

const DEMO_ADJUSTMENTS: AdjustmentRecord[] = [
  {
    id: 'adj-01',
    adjustment_number: 'AJU-202609-0001',
    type: 'DAMAGE_SPOILED',
    adjustment_date: '2026-09-29T11:00:00Z',
    total_cost_impact: -15.0,
    reason: 'Empaque roto por manipulación en pasillo 4',
    status: 'APPLIED',
    branch_name: 'Sucursal Principal Caracas',
    warehouse_name: 'Depósito Piso de Venta',
    user_name: 'Administrador Demo',
    items_count: 1,
  },
  {
    id: 'adj-02',
    adjustment_number: 'AJU-202609-0002',
    type: 'FOUND_SURPLUS',
    adjustment_date: '2026-09-28T16:30:00Z',
    total_cost_impact: 23.0,
    reason: 'Caja adicional encontrada en estantería superior durante inventario rotativo',
    status: 'APPLIED',
    branch_name: 'Sucursal Principal Caracas',
    warehouse_name: 'Almacén Central Mayorista',
    user_name: 'Supervisor Inventario',
    items_count: 2,
  },
  {
    id: 'adj-03',
    adjustment_number: 'AJU-202609-0003',
    type: 'PHYSICAL_COUNT',
    adjustment_date: '2026-09-27T18:00:00Z',
    total_cost_impact: -5.75,
    reason: 'Ajuste de conteo físico mensual de cierre de mes',
    status: 'APPLIED',
    branch_name: 'Sucursal Principal Caracas',
    warehouse_name: 'Almacén Central Mayorista',
    user_name: 'Administrador Demo',
    items_count: 1,
  },
];

export const InventoryAdjustmentsView: React.FC = () => {
  const { activeBranchId, activeWarehouseId, token } = useAuthStore();
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>(DEMO_ADJUSTMENTS);
  const [loading, setLoading] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [adjustmentType, setAdjustmentType] = useState<string>('DAMAGE_SPOILED');
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<NewAdjustmentItem[]>([
    {
      productId: 'p2',
      sku: 'LEC-POL-01',
      productName: 'Leche en Polvo Completa 1Kg',
      movementType: 'ADJUST_OUT',
      quantity: 1,
      unitCost: 7.5,
      notes: 'Bolsa rasgada',
    },
  ]);

  // Selección de producto en formulario
  const [newProductId, setNewProductId] = useState('p1');
  const [newMovementType, setNewMovementType] = useState<'ADJUST_IN' | 'ADJUST_OUT'>('ADJUST_OUT');
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newUnitCost, setNewUnitCost] = useState<number>(1.15);
  const [newNotes, setNewNotes] = useState('');

  const catalog = [
    { id: 'p1', sku: 'HAR-PAN-01', name: 'Harina PAN Blanca 1Kg', cost: 1.15 },
    { id: 'p2', sku: 'LEC-POL-01', name: 'Leche en Polvo Completa 1Kg', cost: 7.5 },
    { id: 'p3', sku: 'DES-SET-06', name: 'Juego Destornilladores 6 Piezas', cost: 10.0 },
    { id: 'p4', sku: 'ARR-PRI-01', name: 'Arroz Primor Blanco 1Kg', cost: 1.05 },
    { id: 'p5', sku: 'ACE-MAZ-01', name: 'Aceite Mazeite 1 Litro', cost: 2.9 },
  ];

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
          setAdjustments(json.data.length > 0 ? json.data : DEMO_ADJUSTMENTS);
        }
      }
    } catch {
      setAdjustments(DEMO_ADJUSTMENTS);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const prod = catalog.find((p) => p.id === newProductId);
    if (!prod) return;
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
        unitCost: newUnitCost || prod.cost,
        notes: newNotes || undefined,
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
        <div className="flex flex-col text-xs font-mono">
          <span className="font-bold text-sky-700">{a.adjustment_number}</span>
          <span className="text-[10px] text-neutral-400">
            {new Date(a.adjustment_date).toLocaleDateString('es-VE')} {new Date(a.adjustment_date).toLocaleTimeString('es-VE')}
          </span>
        </div>
      ),
    },
    {
      header: 'Tipo de Ajuste',
      accessorKey: 'type',
      cell: (a) => getTypeBadge(a.type),
    },
    {
      header: 'Depósito / Sucursal',
      cell: (a) => (
        <div className="flex flex-col text-xs max-w-[160px]">
          <span className="font-semibold text-neutral-900 truncate">{a.warehouse_name}</span>
          <span className="text-[10px] text-neutral-400 truncate">{a.branch_name}</span>
        </div>
      ),
    },
    {
      header: 'Items',
      accessorKey: 'items_count',
      cell: (a) => <span className="font-mono text-xs">{a.items_count} prod(s)</span>,
    },
    {
      header: 'Impacto en Costo',
      accessorKey: 'total_cost_impact',
      cell: (a) => {
        const val = Number(a.total_cost_impact);
        return (
          <span className={`font-mono font-bold text-xs ${val >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {val >= 0 ? `+$${val.toFixed(2)}` : `-$${Math.abs(val).toFixed(2)}`}
          </span>
        );
      },
    },
    {
      header: 'Motivo / Justificación',
      accessorKey: 'reason',
      cell: (a) => <span className="text-xs text-neutral-600 line-clamp-1 max-w-xs">{a.reason}</span>,
    },
    {
      header: 'Usuario',
      accessorKey: 'user_name',
      cell: (a) => <span className="text-xs text-neutral-500">{a.user_name}</span>,
    },
    {
      header: 'Estado',
      accessorKey: 'status',
      cell: () => <Badge variant="success">APLICADO</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
              Ajustes de Inventario
            </h1>
            <Badge variant="neutral">CONTROL DE MERMAS & CONTEO</Badge>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Registro de mermas, averías, sobrantes y correcciones de existencias físicas con afectación contable.
          </p>
        </div>

        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo Ajuste de Inventario
        </Button>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Total Ajustes Registrados</span>
          <div className="text-2xl font-bold font-mono text-neutral-900">{adjustments.length}</div>
          <div className="text-[11px] text-neutral-400">Auditoría completa</div>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Ajustes por Merma / Avería</span>
          <div className="text-2xl font-bold font-mono text-red-600">
            {adjustments.filter((a) => a.type === 'DAMAGE_SPOILED' || a.type === 'EXPIRED').length}
          </div>
          <div className="text-[11px] text-neutral-400">Productos dañados o vencidos</div>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Ajustes por Conteo Físico</span>
          <div className="text-2xl font-bold font-mono text-sky-700">
            {adjustments.filter((a) => a.type === 'PHYSICAL_COUNT').length}
          </div>
          <div className="text-[11px] text-neutral-400">Cuadre de existencias</div>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Impacto Neto en Costo</span>
          <div className="text-2xl font-bold font-mono text-amber-700">
            ${adjustments.reduce((sum, a) => sum + Number(a.total_cost_impact), 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-neutral-400">Afectación neta de valor</div>
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
      {showModal && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-neutral-900">Registrar Ajuste de Inventario</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Tipo de Ajuste</label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white"
                  >
                    <option value="DAMAGE_SPOILED">Merma / Producto Dañado</option>
                    <option value="EXPIRED">Producto Vencido</option>
                    <option value="PHYSICAL_COUNT">Corrección por Conteo Físico</option>
                    <option value="FOUND_SURPLUS">Sobrante Encontrado</option>
                    <option value="THEFT_LOSS">Faltante / Pérdida</option>
                    <option value="INTERNAL_CONSUMPTION">Consumo Interno</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Motivo / Justificación</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej: Empaques averiados durante descarga de camión"
                    className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Agregar Producto al Ajuste */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                <span className="font-semibold text-neutral-800 block">Agregar Producto a la Lista:</span>
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <label className="text-[11px] text-neutral-500 block mb-1">Producto</label>
                    <select
                      value={newProductId}
                      onChange={(e) => {
                        setNewProductId(e.target.value);
                        const p = catalog.find((c) => c.id === e.target.value);
                        if (p) setNewUnitCost(p.cost);
                      }}
                      className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white"
                    >
                      {catalog.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} - {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3">
                    <label className="text-[11px] text-neutral-500 block mb-1">Acción</label>
                    <select
                      value={newMovementType}
                      onChange={(e) => setNewMovementType(e.target.value as any)}
                      className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white"
                    >
                      <option value="ADJUST_OUT">Salida / Descontar (-)</option>
                      <option value="ADJUST_IN">Entrada / Sumar (+)</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-[11px] text-neutral-500 block mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(parseFloat(e.target.value) || 1)}
                      className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-2">
                    <Button size="sm" variant="outline" onClick={handleAddItem} className="w-full h-8">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Añadir
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lista de Items */}
              <div className="space-y-2">
                <span className="font-semibold text-neutral-800 block">
                  Productos a Ajustar ({items.length}):
                </span>
                <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {items.map((it, idx) => (
                    <div key={idx} className="p-2.5 bg-white flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-neutral-900">{it.productName}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">
                          {it.sku} • Costo: ${it.unitCost.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={it.movementType === 'ADJUST_IN' ? 'success' : 'danger'}>
                          {it.movementType === 'ADJUST_IN' ? `+${it.quantity}` : `-${it.quantity}`}
                        </Badge>
                        <span className="font-mono font-bold text-xs">
                          ${(it.quantity * it.unitCost).toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-neutral-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={submitting || items.length === 0} onClick={handleSubmitAdjustment}>
                <Check className="w-4 h-4 mr-1.5" />
                Aplicar Ajuste a Inventario
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
