import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import {
  Truck,
  ArrowRightLeft,
  Plus,
  Trash2,
  X,
  Check,
  Building2,
  Warehouse,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';

interface TransferRecord {
  id: string;
  transfer_number: string;
  status: 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  total_items: number;
  total_cost: number;
  shipped_at: string;
  received_at?: string | null;
  notes?: string | null;
  origin_branch_name: string;
  origin_warehouse_name: string;
  destination_branch_name: string;
  destination_warehouse_name: string;
  shipped_by_name: string;
  received_by_name?: string | null;
}

interface NewTransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  notes?: string;
}

const DEMO_TRANSFERS: TransferRecord[] = [
  {
    id: 'tr-01',
    transfer_number: 'TRS-202609-0001',
    status: 'IN_TRANSIT',
    total_items: 2,
    total_cost: 322.5,
    shipped_at: '2026-09-29T09:30:00Z',
    notes: 'Reabastecimiento urgente de productos de alta rotación para piso de venta',
    origin_branch_name: 'Sucursal Principal Caracas',
    origin_warehouse_name: 'Almacén Central Mayorista',
    destination_branch_name: 'Sucursal Principal Caracas',
    destination_warehouse_name: 'Depósito Piso de Venta',
    shipped_by_name: 'Administrador Demo',
  },
  {
    id: 'tr-02',
    transfer_number: 'TRS-202609-0002',
    status: 'RECEIVED',
    total_items: 1,
    total_cost: 115.0,
    shipped_at: '2026-09-28T14:00:00Z',
    received_at: '2026-09-28T15:30:00Z',
    notes: 'Traslado regular completado',
    origin_branch_name: 'Sucursal Principal Caracas',
    origin_warehouse_name: 'Almacén Central Mayorista',
    destination_branch_name: 'Sucursal Este - Las Mercedes',
    destination_warehouse_name: 'Depósito Piso de Venta',
    shipped_by_name: 'Supervisor Inventario',
    received_by_name: 'Administrador Demo',
  },
];

export const InventoryTransfersView: React.FC = () => {
  const { activeBranchId, token } = useAuthStore();
  const [transfers, setTransfers] = useState<TransferRecord[]>(DEMO_TRANSFERS);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_TRANSIT' | 'RECEIVED'>('ALL');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State: Nuevo Traslado
  const [originWarehouseId, setOriginWarehouseId] = useState('w1111111-1111-1111-1111-111111111111');
  const [destWarehouseId, setDestWarehouseId] = useState('w2222222-2222-2222-2222-222222222222');
  const [transferNotes, setTransferNotes] = useState('');
  const [items, setItems] = useState<NewTransferItem[]>([
    {
      productId: 'p1',
      sku: 'HAR-PAN-01',
      productName: 'Harina PAN Blanca 1Kg',
      quantity: 50,
      notes: 'Bultos sellados',
    },
  ]);

  // Selección de producto en formulario
  const [newProductId, setNewProductId] = useState('p2');
  const [newQuantity, setNewQuantity] = useState<number>(10);
  const [newNotes, setNewNotes] = useState('');

  const catalog = [
    { id: 'p1', sku: 'HAR-PAN-01', name: 'Harina PAN Blanca 1Kg' },
    { id: 'p2', sku: 'LEC-POL-01', name: 'Leche en Polvo Completa 1Kg' },
    { id: 'p3', sku: 'DES-SET-06', name: 'Juego Destornilladores 6 Piezas' },
    { id: 'p4', sku: 'ARR-PRI-01', name: 'Arroz Primor Blanco 1Kg' },
    { id: 'p5', sku: 'ACE-MAZ-01', name: 'Aceite Mazeite 1 Litro' },
  ];

  const warehouses = [
    { id: 'w1111111-1111-1111-1111-111111111111', name: 'Almacén Central Mayorista (ALM-01)' },
    { id: 'w2222222-2222-2222-2222-222222222222', name: 'Depósito Piso de Venta (TIENDA-01)' },
  ];

  useEffect(() => {
    fetchTransfers();
  }, [activeBranchId, statusFilter]);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append('branchId', activeBranchId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/transfers?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTransfers(json.data.length > 0 ? json.data : DEMO_TRANSFERS);
        }
      }
    } catch {
      setTransfers(DEMO_TRANSFERS);
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
        quantity: newQuantity,
        notes: newNotes || undefined,
      },
    ]);

    setNewQuantity(10);
    setNewNotes('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateTransfer = async () => {
    if (originWarehouseId === destWarehouseId) {
      toast.error('El depósito de origen y destino no pueden ser el mismo');
      return;
    }
    if (items.length === 0) {
      toast.error('Debe incluir al menos un producto a trasladar');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          originBranchId: activeBranchId || 'b1111111-1111-1111-1111-111111111111',
          originWarehouseId,
          destinationBranchId: activeBranchId || 'b1111111-1111-1111-1111-111111111111',
          destinationWarehouseId: destWarehouseId,
          notes: transferNotes || null,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            notes: i.notes || null,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al crear traslado');
      }

      toast.success(`Traslado ${json.data.transferNumber} despachado en tránsito`);
      setShowCreateModal(false);
      setTransferNotes('');
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.message || 'Error al despachar traslado');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiveTransfer = async () => {
    if (!selectedTransfer) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/transfers/receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          transferId: selectedTransfer.id,
          notes: receiveNotes || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al recepcionar traslado');
      }

      toast.success(`Traslado ${selectedTransfer.transfer_number} recibido y acreditado en stock`);
      setShowReceiveModal(false);
      setSelectedTransfer(null);
      setReceiveNotes('');
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.message || 'Error al recepcionar traslado');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  const columns: Column<TransferRecord>[] = [
    {
      header: 'N° Traslado',
      accessorKey: 'transfer_number',
      cell: (t) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-bold text-sky-700">{t.transfer_number}</span>
          <span className="text-[10px] text-neutral-400">
            {new Date(t.shipped_at).toLocaleDateString('es-VE')}
          </span>
        </div>
      ),
    },
    {
      header: 'Origen (Despacho)',
      cell: (t) => (
        <div className="flex flex-col text-xs max-w-[160px]">
          <span className="font-semibold text-neutral-900 truncate">{t.origin_warehouse_name}</span>
          <span className="text-[10px] text-neutral-400 truncate">{t.origin_branch_name}</span>
        </div>
      ),
    },
    {
      header: 'Destino (Recepción)',
      cell: (t) => (
        <div className="flex flex-col text-xs max-w-[160px]">
          <span className="font-semibold text-neutral-900 truncate">{t.destination_warehouse_name}</span>
          <span className="text-[10px] text-neutral-400 truncate">{t.destination_branch_name}</span>
        </div>
      ),
    },
    {
      header: 'Items / Costo',
      cell: (t) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-bold text-neutral-800">{t.total_items} prod(s)</span>
          <span className="text-[11px] text-neutral-500">${Number(t.total_cost).toFixed(2)}</span>
        </div>
      ),
    },
    {
      header: 'Despachado por',
      cell: (t) => (
        <div className="flex flex-col text-xs">
          <span className="text-neutral-700">{t.shipped_by_name}</span>
          <span className="text-[10px] text-neutral-400 font-mono">
            {new Date(t.shipped_at).toLocaleTimeString('es-VE')}
          </span>
        </div>
      ),
    },
    {
      header: 'Estado',
      accessorKey: 'status',
      cell: (t) => (
        <Badge variant={t.status === 'RECEIVED' ? 'success' : t.status === 'IN_TRANSIT' ? 'warning' : 'neutral'}>
          {t.status === 'RECEIVED' ? 'RECIBIDO' : t.status === 'IN_TRANSIT' ? 'EN TRÁNSITO' : 'CANCELADO'}
        </Badge>
      ),
    },
    {
      header: 'Acción',
      cell: (t) =>
        t.status === 'IN_TRANSIT' ? (
          <Button
            size="sm"
            onClick={() => {
              setSelectedTransfer(t);
              setShowReceiveModal(true);
            }}
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            Recepcionar
          </Button>
        ) : (
          <span className="text-[11px] text-neutral-400 italic">Completado</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
              Traslados entre Depósitos y Sucursales
            </h1>
            <Badge variant="info">CONTROL DE TRÁNSITO</Badge>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Gestión de envíos de stock entre depósitos centrales, pisos de venta y sucursales con trazabilidad dual.
          </p>
        </div>

        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo Traslado
        </Button>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Total Traslados</span>
          <div className="text-2xl font-bold font-mono text-neutral-900">{transfers.length}</div>
          <div className="text-[11px] text-neutral-400">Histórico de transferencias</div>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">En Tránsito (Pendientes)</span>
          <div className="text-2xl font-bold font-mono text-amber-600">
            {transfers.filter((t) => t.status === 'IN_TRANSIT').length}
          </div>
          <div className="text-[11px] text-neutral-400">Mercancía despachada sin recibir</div>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Traslados Recibidos</span>
          <div className="text-2xl font-bold font-mono text-emerald-600">
            {transfers.filter((t) => t.status === 'RECEIVED').length}
          </div>
          <div className="text-[11px] text-neutral-400">Completados en destino</div>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Valor en Tránsito ($)</span>
          <div className="text-2xl font-bold font-mono text-sky-700">
            $
            {transfers
              .filter((t) => t.status === 'IN_TRANSIT')
              .reduce((sum, t) => sum + Number(t.total_cost), 0)
              .toFixed(2)}
          </div>
          <div className="text-[11px] text-neutral-400">Capital circulando entre almacenes</div>
        </Card>
      </div>

      {/* Filtros de Pestaña */}
      <div className="flex border-b border-neutral-200 text-xs font-semibold gap-6">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`pb-2.5 transition-colors border-b-2 ${
            statusFilter === 'ALL'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Todos los Traslados ({transfers.length})
        </button>
        <button
          onClick={() => setStatusFilter('IN_TRANSIT')}
          className={`pb-2.5 transition-colors border-b-2 ${
            statusFilter === 'IN_TRANSIT'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          En Tránsito ({transfers.filter((t) => t.status === 'IN_TRANSIT').length})
        </button>
        <button
          onClick={() => setStatusFilter('RECEIVED')}
          className={`pb-2.5 transition-colors border-b-2 ${
            statusFilter === 'RECEIVED'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Recibidos ({transfers.filter((t) => t.status === 'RECEIVED').length})
        </button>
      </div>

      {/* Tabla de Traslados */}
      <Card className="p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-8 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
          </div>
        ) : (
          <DataTable
            data={filteredTransfers}
            columns={columns}
            searchPlaceholder="Buscar por N° traslado o depósito..."
            searchKey="transfer_number"
          />
        )}
      </Card>

      {/* Modal: Crear Traslado */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-neutral-900">Despacho de Traslado entre Depósitos</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Depósito Origen (Despacha)</label>
                  <select
                    value={originWarehouseId}
                    onChange={(e) => setOriginWarehouseId(e.target.value)}
                    className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Depósito Destino (Recibe)</label>
                  <select
                    value={destWarehouseId}
                    onChange={(e) => setDestWarehouseId(e.target.value)}
                    className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Observaciones / Guía de Envío</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Ej: Despacho en pickup de la empresa, chofer Carlos Mendoza"
                  className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs"
                />
              </div>

              {/* Agregar Producto */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                <span className="font-semibold text-neutral-800 block">Agregar Producto a Trasladar:</span>
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <label className="text-[11px] text-neutral-500 block mb-1">Producto</label>
                    <select
                      value={newProductId}
                      onChange={(e) => setNewProductId(e.target.value)}
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
                    <label className="text-[11px] text-neutral-500 block mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(parseFloat(e.target.value) || 1)}
                      className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-3">
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
                  Productos en la Guía de Traslado ({items.length}):
                </span>
                <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {items.map((it, idx) => (
                    <div key={idx} className="p-2.5 bg-white flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-neutral-900">{it.productName}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">{it.sku}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-xs text-sky-700">
                          {it.quantity} unidades
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
              <Button variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={submitting || items.length === 0} onClick={handleCreateTransfer}>
                <Truck className="w-4 h-4 mr-1.5" />
                Despachar Mercancía en Tránsito
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Recepcionar Traslado */}
      {showReceiveModal && selectedTransfer && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Recepcionar Traslado {selectedTransfer.transfer_number}
                </h3>
              </div>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-neutral-600">
                Al confirmar la recepción, la mercancía se acreditará automáticamente en el stock del depósito destino (
                <strong>{selectedTransfer.destination_warehouse_name}</strong>) y quedará registrada en el Kardex.
              </p>

              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>Origen:</span>
                  <span className="font-semibold text-neutral-800">{selectedTransfer.origin_warehouse_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Despachado por:</span>
                  <span>{selectedTransfer.shipped_by_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Items:</span>
                  <span>{selectedTransfer.total_items} producto(s)</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Notas de Recepción / Conforme</label>
                <input
                  type="text"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="Ej: Mercancía verificada y en perfecto estado"
                  className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
              <Button variant="outline" size="sm" onClick={() => setShowReceiveModal(false)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={submitting} onClick={handleReceiveTransfer}>
                <Check className="w-4 h-4 mr-1.5" />
                Confirmar Recepción en Almacén
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
