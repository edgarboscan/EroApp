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
import { formatMoneyUSD, formatNumber } from '../../utils/formatters';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';

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

export const KardexView: React.FC = () => {
  const { activeBranchId, activeWarehouseId, token } = useAuthStore();
  const [movements, setMovements] = useState<KardexMovement[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);

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
        if (json.success && Array.isArray(json.data?.movements)) {
          setMovements(json.data.movements);
        } else {
          setMovements([]);
        }
      } else {
        setMovements([]);
      }
    } catch {
      setMovements([]);
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
          setStockAlerts(json.data);
        } else {
          setStockAlerts([]);
        }
      } else {
        setStockAlerts([]);
      }
    } catch {
      setStockAlerts([]);
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
          <span className="font-semibold text-neutral-400">
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
          <span className={`font-mono font-bold text-xs ${isEntry ? 'text-emerald-600' : 'text-neutral-400'}`}>
            {isEntry ? `+${formatNumber(m.quantity)}` : `-${formatNumber(m.quantity)}`} {m.unitOfMeasure}
          </span>
        );
      },
    },
    {
      header: 'Costo Unit.',
      accessorKey: 'unitCost',
      cell: (m) => <span className="font-mono text-xs">{formatMoneyUSD(m.unitCost)}</span>,
    },
    {
      header: 'Costo Total',
      accessorKey: 'totalCost',
      cell: (m) => <span className="font-mono font-bold text-xs">{formatMoneyUSD(m.totalCost)}</span>,
    },
    {
      header: 'Saldo Stock',
      cell: (m) => (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-neutral-400">{formatNumber(m.previousStock)}</span>
          <span className="text-neutral-300">→</span>
          <span className="font-bold text-neutral-900">{formatNumber(m.newStock)}</span>
        </div>
      ),
    },
    {
      header: 'Documento / Motivo',
      cell: (m) => (
        <div className="flex flex-col text-xs max-w-xs">
          <span className="font-mono font-semibold text-neutral-400">{m.referenceDocument || 'S/D'}</span>
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
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Kardex Valorizado de Inventario
            </h1>
            <Badge variant="info">MÉTODO PONDERADO</Badge>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Registro cronológico de entradas, salidas, transferencias y ajustes
            de stock con valoración contable continua.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1.5" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={() => setShowPdfModal(true)}>
            <Download className="w-4 h-4 mr-1.5" />
            Ver / Descargar PDF
          </Button>
        </div>
      </div>

      {/* Banner de Alertas de Stock Crítico */}
      {stockAlerts.length > 0 && (
        <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>
              Alertas de Stock Crítico / Agotado ({stockAlerts.length} productos
              requieren atención)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stockAlerts.slice(0, 3).map((a) => (
              <div
                key={a.productId}
                className="bg-red-100 p-2.5 rounded-lg border border-amber-200 text-xs flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold text-neutral-900 truncate max-w-[180px]">
                    {a.productName}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Stock:{" "}
                    <span className="font-bold text-red-600">
                      {a.availableStock}
                    </span>{" "}
                    (Mín: {a.minStock})
                  </div>
                </div>
                <Badge
                  variant={a.status === "OUT_OF_STOCK" ? "danger" : "warning"}
                >
                  {a.status === "OUT_OF_STOCK" ? "Agotado" : "Reordenar"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tarjetas de Métricas de Movimiento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1 border-l-4 border-l-sky-600 dark:border-l-sky-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-sky-200 dark:border-sky-800">
          <span className="text-xs text-neutral-500">Total Movimientos</span>
          <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400">
            {filtered.length}
          </div>
          <div className="text-[11px] text-neutral-400">
            Operaciones auditadas
          </div>
        </Card>

        <Card className="p-4 space-y-1 border-l-4 border-l-emerald-600 dark:border-l-emerald-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-emerald-200 dark:border-emerald-400">
          <span className="text-xs text-neutral-500">Unidades Ingresadas</span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            +{formatNumber(totalInQty)}
          </div>
          <div className="text-[11px] text-neutral-400">
            Compras, traslados y ajustes +
          </div>
        </Card>

        <Card className="p-4 space-y-1 border-l-4 border-l-amber-600 dark:border-l-amber-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-amber-200 dark:border-amber-800">
          <span className="text-xs text-neutral-500">Unidades Salientes</span>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            -{formatNumber(totalOutQty)}
          </div>
          <div className="text-[11px] text-neutral-400">
            Ventas, traslados y mermas -
          </div>
        </Card>

        <Card className="p-4 space-y-1 border-l-4 border-l-sky-600 dark:border-l-purple-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-purple-600 dark:border-purple-400">
          <span className="text-xs text-neutral-500">
            Costo Acumulado Registrado
          </span>
          <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
            {formatMoneyUSD(totalCostValue)}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-400">
            Valoración total transacciones
          </div>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 ">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, SKU o documento..."
            className="w-full h-8 pl-9 pr-3 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="h-8 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
            className="h-8 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
          <span>Hasta:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
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

      {/* Modal Visor / Descarga PDF Kardex Valorizado */}
      <PdfViewerModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        title="Kardex Valorizado de Inventario"
        subtitle="Movimientos cronológicos con valoración ponderada y saldo físico continuo"
        endpoint={`/api/inventory/kardex?format=pdf${activeBranchId ? `&branchId=${activeBranchId}` : ""}${activeWarehouseId ? `&warehouseId=${activeWarehouseId}` : ""}${selectedType !== "ALL" ? `&movementType=${selectedType}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`}
        filename={`kardex_inventario_${new Date().toISOString().slice(0, 10)}.pdf`}
      />
    </div>
  );
};
