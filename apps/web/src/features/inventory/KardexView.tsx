import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import {
  Package,
  Layers,
  Search,
  Filter,
  Download,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Warehouse,
  Calendar,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';

interface KardexMovement {
  id: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  sku: string;
  productName: string;
  unitOfMeasure: string;
  movementType: 'IN' | 'OUT' | 'ADJUST_IN' | 'ADJUST_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'SALE' | 'PURCHASE';
  quantity: number;
  unitCost: number;
  totalCost: number;
  previousStock: number;
  newStock: number;
  referenceDocument?: string | null;
  reason?: string | null;
  createdAt: string;
  userName: string;
}

interface StockAlert {
  productId: string;
  sku: string;
  productName: string;
  unitOfMeasure: string;
  warehouseId: string;
  warehouseName: string;
  branchId: string;
  branchName: string;
  minStock: number;
  maxStock: number;
  costPrice: number;
  basePrice: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  status: 'OUT_OF_STOCK' | 'CRITICAL_LOW' | 'OPTIMAL' | 'OVERSTOCK';
  suggestedReorderQuantity: number;
}

const DEMO_MOVEMENTS: KardexMovement[] = [
  {
    id: 'm1',
    branchId: 'b1111111-1111-1111-1111-111111111111',
    branchName: 'Sucursal Principal Caracas',
    warehouseId: 'w1111111-1111-1111-1111-111111111111',
    warehouseName: 'Almacén Central Mayorista',
    productId: 'p1',
    sku: 'HAR-PAN-01',
    productName: 'Harina PAN Blanca 1Kg',
    unitOfMeasure: 'UND',
    movementType: 'PURCHASE',
    quantity: 500,
    unitCost: 1.15,
    totalCost: 575.0,
    previousStock: 120,
    newStock: 620,
    referenceDocument: 'FC-POLAR-9812',
    reason: 'Recepción orden de compra proveedor',
    createdAt: '2026-09-28T09:30:00Z',
    userName: 'Administrador Demo',
  },
  {
    id: 'm2',
    branchId: 'b1111111-1111-1111-1111-111111111111',
    branchName: 'Sucursal Principal Caracas',
    warehouseId: 'w1111111-1111-1111-1111-111111111111',
    warehouseName: 'Almacén Central Mayorista',
    productId: 'p1',
    sku: 'HAR-PAN-01',
    productName: 'Harina PAN Blanca 1Kg',
    unitOfMeasure: 'UND',
    movementType: 'TRANSFER_OUT',
    quantity: 150,
    unitCost: 1.15,
    totalCost: 172.5,
    previousStock: 620,
    newStock: 470,
    referenceDocument: 'TRS-202609-0001',
    reason: 'Traslado a tienda piso de venta',
    createdAt: '2026-09-28T14:15:00Z',
    userName: 'Administrador Demo',
  },
  {
    id: 'm3',
    branchId: 'b1111111-1111-1111-1111-111111111111',
    branchName: 'Sucursal Principal Caracas',
    warehouseId: 'w2222222-2222-2222-2222-222222222222',
    warehouseName: 'Depósito Piso de Venta',
    productId: 'p1',
    sku: 'HAR-PAN-01',
    productName: 'Harina PAN Blanca 1Kg',
    unitOfMeasure: 'UND',
    movementType: 'TRANSFER_IN',
    quantity: 150,
    unitCost: 1.15,
    totalCost: 172.5,
    previousStock: 25,
    newStock: 175,
    referenceDocument: 'TRS-202609-0001',
    reason: 'Recepción de mercancía trasladada',
    createdAt: '2026-09-28T14:45:00Z',
    userName: 'Administrador Demo',
  },
  {
    id: 'm4',
    branchId: 'b1111111-1111-1111-1111-111111111111',
    branchName: 'Sucursal Principal Caracas',
    warehouseId: 'w2222222-2222-2222-2222-222222222222',
    warehouseName: 'Depósito Piso de Venta',
    productId: 'p1',
    sku: 'HAR-PAN-01',
    productName: 'Harina PAN Blanca 1Kg',
    unitOfMeasure: 'UND',
    movementType: 'SALE',
    quantity: 12,
    unitCost: 1.15,
    totalCost: 13.8,
    previousStock: 175,
    newStock: 163,
    referenceDocument: 'FACT-00010450',
    reason: 'Venta por caja POS',
    createdAt: '2026-09-29T10:20:00Z',
    userName: 'Cajero POS',
  },
  {
    id: 'm5',
    branchId: 'b1111111-1111-1111-1111-111111111111',
    branchName: 'Sucursal Principal Caracas',
    warehouseId: 'w2222222-2222-2222-2222-222222222222',
    warehouseName: 'Depósito Piso de Venta',
    productId: 'p2',
    sku: 'LEC-POL-01',
    productName: 'Leche en Polvo Completa 1Kg',
    unitOfMeasure: 'UND',
    movementType: 'ADJUST_OUT',
    quantity: 2,
    unitCost: 7.5,
    totalCost: 15.0,
    previousStock: 8,
    newStock: 6,
    referenceDocument: 'AJU-202609-0001',
    reason: 'Empaque roto por manipulación (Merma)',
    createdAt: '2026-09-29T11:00:00Z',
    userName: 'Administrador Demo',
  },
];

const DEMO_ALERTS: StockAlert[] = [
  {
    productId: 'p2',
    sku: 'LEC-POL-01',
    productName: 'Leche en Polvo Completa 1Kg',
    unitOfMeasure: 'UND',
    warehouseId: 'w2222222-2222-2222-2222-222222222222',
    warehouseName: 'Depósito Piso de Venta',
    branchId: 'b1111111-1111-1111-1111-111111111111',
    branchName: 'Sucursal Principal Caracas',
    minStock: 15,
    maxStock: 80,
    costPrice: 7.5,
    basePrice: 9.2,
    currentStock: 6,
    reservedStock: 0,
    availableStock: 6,
    status: 'CRITICAL_LOW',
    suggestedReorderQuantity: 74,
  },
  {
    productId: 'p8',
    sku: 'CAF-FAM-01',
    productName: 'Café Fama de América 500g',
    unitOfMeasure: 'UND',
    warehouseId: 'w2222222-2222-2222-2222-222222222222',
    warehouseName: 'Depósito Piso de Venta',
    branchId: 'b1111111-1111-1111-1111-111111111111',
    branchName: 'Sucursal Principal Caracas',
    minStock: 20,
    maxStock: 100,
    costPrice: 3.2,
    basePrice: 4.2,
    currentStock: 0,
    reservedStock: 0,
    availableStock: 0,
    status: 'OUT_OF_STOCK',
    suggestedReorderQuantity: 100,
  },
];

export const KardexView: React.FC = () => {
  const { activeBranchId, activeWarehouseId, token } = useAuthStore();
  const [movements, setMovements] = useState<KardexMovement[]>(DEMO_MOVEMENTS);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>(DEMO_ALERTS);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchKardexData();
    fetchAlertsData();
  }, [activeBranchId, activeWarehouseId, selectedType, startDate, endDate]);

  const fetchKardexData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append('branchId', activeBranchId);
      if (activeWarehouseId) params.append('warehouseId', activeWarehouseId);
      if (selectedType !== 'ALL') params.append('movementType', selectedType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/kardex?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.movements) {
          setMovements(json.data.movements.length > 0 ? json.data.movements : DEMO_MOVEMENTS);
        }
      }
    } catch {
      setMovements(DEMO_MOVEMENTS);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertsData = async () => {
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append('branchId', activeBranchId);
      if (activeWarehouseId) params.append('warehouseId', activeWarehouseId);

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/stock-alerts?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setStockAlerts(json.data.length > 0 ? json.data : DEMO_ALERTS);
        }
      }
    } catch {
      setStockAlerts(DEMO_ALERTS);
    }
  };

  // Totales
  const filtered = movements.filter((m) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      m.productName.toLowerCase().includes(term) ||
      m.sku.toLowerCase().includes(term) ||
      (m.referenceDocument && m.referenceDocument.toLowerCase().includes(term))
    );
  });

  const totalInQty = filtered
    .filter((m) => ['IN', 'ADJUST_IN', 'TRANSFER_IN', 'PURCHASE'].includes(m.movementType))
    .reduce((sum, m) => sum + m.quantity, 0);

  const totalOutQty = filtered
    .filter((m) => ['OUT', 'ADJUST_OUT', 'TRANSFER_OUT', 'SALE'].includes(m.movementType))
    .reduce((sum, m) => sum + m.quantity, 0);

  const totalCostValue = filtered.reduce((sum, m) => sum + m.totalCost, 0);

  const getMovementBadge = (type: KardexMovement['movementType']) => {
    switch (type) {
      case 'PURCHASE':
        return <Badge variant="success">COMPRA (+)</Badge>;
      case 'SALE':
        return <Badge variant="info">VENTA (-)</Badge>;
      case 'TRANSFER_IN':
        return <Badge variant="success">TRASLADO ENTRADA (+)</Badge>;
      case 'TRANSFER_OUT':
        return <Badge variant="warning">TRASLADO SALIDA (-)</Badge>;
      case 'ADJUST_IN':
        return <Badge variant="success">AJUSTE ENTRADA (+)</Badge>;
      case 'ADJUST_OUT':
        return <Badge variant="danger">AJUSTE SALIDA (-)</Badge>;
      case 'IN':
        return <Badge variant="success">ENTRADA (+)</Badge>;
      case 'OUT':
        return <Badge variant="neutral">SALIDA (-)</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const columns: Column<KardexMovement>[] = [
    {
      header: 'Fecha / Hora',
      accessorKey: 'createdAt',
      cell: (m) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-semibold text-neutral-800">
            {new Date(m.createdAt).toLocaleDateString('es-VE')}
          </span>
          <span className="text-[10px] text-neutral-400">
            {new Date(m.createdAt).toLocaleTimeString('es-VE')}
          </span>
        </div>
      ),
    },
    {
      header: 'Producto',
      accessorKey: 'productName',
      cell: (m) => (
        <div className="flex flex-col text-xs max-w-xs">
          <span className="font-semibold text-neutral-900 line-clamp-1">{m.productName}</span>
          <span className="font-mono text-[11px] text-neutral-400">{m.sku}</span>
        </div>
      ),
    },
    {
      header: 'Depósito',
      accessorKey: 'warehouseName',
      cell: (m) => (
        <div className="text-xs text-neutral-600 truncate max-w-[140px]">
          {m.warehouseName}
        </div>
      ),
    },
    {
      header: 'Tipo Movimiento',
      accessorKey: 'movementType',
      cell: (m) => getMovementBadge(m.movementType),
    },
    {
      header: 'Cantidad',
      accessorKey: 'quantity',
      cell: (m) => {
        const isEntry = ['IN', 'ADJUST_IN', 'TRANSFER_IN', 'PURCHASE'].includes(m.movementType);
        return (
          <span className={`font-mono font-bold text-xs ${isEntry ? 'text-emerald-600' : 'text-neutral-800'}`}>
            {isEntry ? `+${m.quantity}` : `-${m.quantity}`} {m.unitOfMeasure}
          </span>
        );
      },
    },
    {
      header: 'Costo Unit.',
      accessorKey: 'unitCost',
      cell: (m) => <span className="font-mono text-xs">${m.unitCost.toFixed(2)}</span>,
    },
    {
      header: 'Costo Total',
      accessorKey: 'totalCost',
      cell: (m) => <span className="font-mono font-bold text-xs">${m.totalCost.toFixed(2)}</span>,
    },
    {
      header: 'Saldo Stock',
      cell: (m) => (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-neutral-400">{m.previousStock}</span>
          <span className="text-neutral-300">→</span>
          <span className="font-bold text-neutral-900">{m.newStock}</span>
        </div>
      ),
    },
    {
      header: 'Documento / Motivo',
      cell: (m) => (
        <div className="flex flex-col text-xs max-w-xs">
          <span className="font-mono font-semibold text-neutral-800">{m.referenceDocument || 'S/D'}</span>
          <span className="text-[11px] text-neutral-500 line-clamp-1">{m.reason || 'Sin observación'}</span>
        </div>
      ),
    },
    {
      header: 'Usuario',
      accessorKey: 'userName',
      cell: (m) => <span className="text-xs text-neutral-600">{m.userName}</span>,
    },
  ];

  const handleExportCSV = () => {
    const headers = ['Fecha', 'SKU', 'Producto', 'Deposito', 'Tipo', 'Cantidad', 'Costo Unitario', 'Total', 'Stock Previo', 'Nuevo Stock', 'Documento', 'Motivo', 'Usuario'];
    const rows = filtered.map((m) => [
      new Date(m.createdAt).toISOString(),
      m.sku,
      `"${m.productName}"`,
      `"${m.warehouseName}"`,
      m.movementType,
      m.quantity,
      m.unitCost,
      m.totalCost,
      m.previousStock,
      m.newStock,
      `"${m.referenceDocument || ''}"`,
      `"${m.reason || ''}"`,
      `"${m.userName}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kardex_inventario_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Archivo CSV del Kardex exportado correctamente');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
              Kardex Valorizado de Inventario
            </h1>
            <Badge variant="info">MÉTODO PONDERADO</Badge>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Registro cronológico de entradas, salidas, transferencias y ajustes de stock con valoración contable continua.
          </p>
        </div>

        <Button size="sm" variant="outline" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-1.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Banner de Alertas de Stock Crítico */}
      {stockAlerts.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Alertas de Stock Crítico / Agotado ({stockAlerts.length} productos requieren atención)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stockAlerts.slice(0, 3).map((a) => (
              <div
                key={a.productId}
                className="bg-white p-2.5 rounded-lg border border-amber-200 text-xs flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold text-neutral-900 truncate max-w-[180px]">{a.productName}</div>
                  <div className="text-[11px] text-neutral-500">
                    Stock: <span className="font-bold text-red-600">{a.availableStock}</span> (Mín: {a.minStock})
                  </div>
                </div>
                <Badge variant={a.status === 'OUT_OF_STOCK' ? 'danger' : 'warning'}>
                  {a.status === 'OUT_OF_STOCK' ? 'Agotado' : 'Reordenar'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tarjetas de Métricas de Movimiento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Total Movimientos</span>
          <div className="text-2xl font-bold font-mono text-neutral-900">{filtered.length}</div>
          <div className="text-[11px] text-neutral-400">Operaciones auditadas</div>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Unidades Ingresadas</span>
          <div className="text-2xl font-bold font-mono text-emerald-600">+{totalInQty}</div>
          <div className="text-[11px] text-neutral-400">Compras, traslados y ajustes +</div>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Unidades Salientes</span>
          <div className="text-2xl font-bold font-mono text-amber-600">-{totalOutQty}</div>
          <div className="text-[11px] text-neutral-400">Ventas, traslados y mermas -</div>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-neutral-500">Costo Acumulado Registrado</span>
          <div className="text-2xl font-bold font-mono text-sky-700">${totalCostValue.toFixed(2)}</div>
          <div className="text-[11px] text-neutral-400">Valoración total transacciones</div>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 border border-neutral-200 rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, SKU o documento..."
            className="w-full h-8 pl-9 pr-3 border border-neutral-300 rounded-lg text-xs"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white"
        >
          <option value="ALL">Todos los Movimientos</option>
          <option value="PURCHASE">Compras Proveedor</option>
          <option value="SALE">Ventas en Caja POS</option>
          <option value="TRANSFER_IN">Traslados Entrantes</option>
          <option value="TRANSFER_OUT">Traslados Salientes</option>
          <option value="ADJUST_IN">Ajustes Entrada (+)</option>
          <option value="ADJUST_OUT">Ajustes Salida (Merma -)</option>
        </select>

        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
          <span>Desde:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 px-2 border border-neutral-300 rounded-lg text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
          <span>Hasta:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 px-2 border border-neutral-300 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Tabla del Kardex */}
      <Card className="p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-8 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
          </div>
        ) : (
          <DataTable
            data={filtered}
            columns={columns}
            searchPlaceholder="Filtrar registros..."
          />
        )}
      </Card>
    </div>
  );
};
