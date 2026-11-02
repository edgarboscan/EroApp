import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  Package,
  Layers,
  Search,
  Download,
  AlertTriangle,
  Coins,
  DollarSign,
  Calendar,
  Building2,
  FolderTree,
  Boxes,
  Tags,
  RefreshCw,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD, formatMoneyVES, formatNumber } from '../../utils/formatters';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import { HierarchySearchModal, HierarchySelection } from '../../components/search';

export type KardexModel = 'physical' | 'valued';
export type KardexCurrency = 'BOTH' | 'USD' | 'VES';

interface HierarchyOption {
  id: string;
  code: string;
  name: string;
}

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
  departmentId?: string | null;
  departmentName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  subgroupId?: string | null;
  subgroupName?: string | null;
  movementType: 'IN' | 'OUT' | 'ADJUST_IN' | 'ADJUST_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'SALE' | 'PURCHASE';
  quantity: number;
  // Costos
  unitCost: number;
  totalCost: number;
  unitCostUSD: number;
  totalCostUSD: number;
  unitCostVES: number;
  totalCostVES: number;
  // Precios
  unitPrice: number;
  totalPrice: number;
  unitPriceUSD: number;
  totalPriceUSD: number;
  unitPriceVES: number;
  totalPriceVES: number;
  // Stock y valoración de saldo
  previousStock: number;
  newStock: number;
  stockValueUSD: number;
  stockValueVES: number;
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
  const [bcvRate, setBcvRate] = useState<number>(1);

  // Modelos y Moneda
  const [model, setModel] = useState<KardexModel>('physical');
  const [currency, setCurrency] = useState<KardexCurrency>('BOTH');

  // Filtros de Jerarquía
  const [departments, setDepartments] = useState<HierarchyOption[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  const [groups, setGroups] = useState<HierarchyOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  const [subgroups, setSubgroups] = useState<HierarchyOption[]>([]);
  const [selectedSubgroup, setSelectedSubgroup] = useState<string>('');

  // Filtros estándar
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false);

  const handleHierarchySelect = async (sel: HierarchySelection) => {
    if (sel.level === 'none') {
      setSelectedDepartment('');
      setSelectedGroup('');
      setSelectedSubgroup('');
      return;
    }

    if (sel.departmentId) {
      setSelectedDepartment(sel.departmentId);
      if (sel.groupId) {
        try {
          const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
          const res = await fetch(`/api/inventory/groups?departmentId=${sel.departmentId}`, { headers });
          if (res.ok) {
            const json = await res.json();
            setGroups(Array.isArray(json.data) ? json.data : []);
          }
          setSelectedGroup(sel.groupId);

          if (sel.subgroupId) {
            const subRes = await fetch(`/api/inventory/subgroups?groupId=${sel.groupId}`, { headers });
            if (subRes.ok) {
              const subJson = await subRes.json();
              setSubgroups(Array.isArray(subJson.data) ? subJson.data : []);
            }
            setSelectedSubgroup(sel.subgroupId);
          } else {
            setSelectedSubgroup('');
          }
        } catch {
          // Fallback silencioso
        }
      } else {
        setSelectedGroup('');
        setSelectedSubgroup('');
      }
    }
  };

  // Cargar departamentos disponibles
  const fetchDepartments = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch('/api/inventory/departments', { headers });
      if (res.ok) {
        const json = await res.json();
        setDepartments(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setDepartments([]);
    }
  }, [token]);

  // Cargar grupos dependientes del departamento seleccionado
  const fetchGroups = useCallback(async (deptId: string) => {
    if (!deptId) {
      setGroups([]);
      setSelectedGroup('');
      setSubgroups([]);
      setSelectedSubgroup('');
      return;
    }
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/groups?departmentId=${deptId}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setGroups(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setGroups([]);
    }
  }, [token]);

  // Cargar subgrupos dependientes del grupo seleccionado
  const fetchSubgroups = useCallback(async (grpId: string) => {
    if (!grpId) {
      setSubgroups([]);
      setSelectedSubgroup('');
      return;
    }
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/subgroups?groupId=${grpId}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setSubgroups(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setSubgroups([]);
    }
  }, [token]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    fetchGroups(selectedDepartment);
  }, [selectedDepartment, fetchGroups]);

  useEffect(() => {
    fetchSubgroups(selectedGroup);
  }, [selectedGroup, fetchSubgroups]);

  // Consulta de datos de Kardex
  const fetchKardexData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append('branchId', activeBranchId);
      if (activeWarehouseId) params.append('warehouseId', activeWarehouseId);
      if (selectedDepartment) params.append('departmentId', selectedDepartment);
      if (selectedGroup) params.append('groupId', selectedGroup);
      if (selectedSubgroup) params.append('subgroupId', selectedSubgroup);
      if (selectedType !== 'ALL') params.append('movementType', selectedType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('model', model);
      params.append('currency', currency);

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/kardex?${params.toString()}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setMovements(Array.isArray(json.data.movements) ? json.data.movements : []);
          if (json.data.summary?.bcvRate) {
            setBcvRate(Number(json.data.summary.bcvRate) || 1);
          }
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
  }, [
    activeBranchId,
    activeWarehouseId,
    selectedDepartment,
    selectedGroup,
    selectedSubgroup,
    selectedType,
    startDate,
    endDate,
    model,
    currency,
    token,
  ]);

  const fetchAlertsData = useCallback(async () => {
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
  }, [activeBranchId, activeWarehouseId, token]);

  useEffect(() => {
    fetchKardexData();
    fetchAlertsData();
  }, [fetchKardexData, fetchAlertsData]);

  // Filtro de búsqueda en memoria
  const filtered = useMemo(() => {
    if (!search.trim()) return movements;
    const term = search.toLowerCase();
    return movements.filter((m) => {
      return (
        m.productName.toLowerCase().includes(term) ||
        m.sku.toLowerCase().includes(term) ||
        (m.referenceDocument && m.referenceDocument.toLowerCase().includes(term)) ||
        (m.departmentName && m.departmentName.toLowerCase().includes(term)) ||
        (m.groupName && m.groupName.toLowerCase().includes(term)) ||
        (m.userName && m.userName.toLowerCase().includes(term))
      );
    });
  }, [movements, search]);

  // Cálculos agregados para Tarjetas KPI
  const { totalInQty, totalOutQty, totalInCostUSD, totalOutCostUSD, totalInCostVES, totalOutCostVES } = useMemo(() => {
    let inQty = 0;
    let outQty = 0;
    let inCostUSD = 0;
    let outCostUSD = 0;
    let inCostVES = 0;
    let outCostVES = 0;

    for (const m of filtered) {
      const isEntry = ['IN', 'ADJUST_IN', 'TRANSFER_IN', 'PURCHASE'].includes(m.movementType);
      const cUSD = Number(m.totalCostUSD ?? m.totalCost ?? 0);
      const cVES = Number(m.totalCostVES ?? (cUSD * bcvRate));

      if (isEntry) {
        inQty += m.quantity;
        inCostUSD += cUSD;
        inCostVES += cVES;
      } else {
        outQty += m.quantity;
        outCostUSD += cUSD;
        outCostVES += cVES;
      }
    }

    return {
      totalInQty: inQty,
      totalOutQty: outQty,
      totalInCostUSD: inCostUSD,
      totalOutCostUSD: outCostUSD,
      totalInCostVES: inCostVES,
      totalOutCostVES: outCostVES,
    };
  }, [filtered, bcvRate]);

  const netQty = totalInQty - totalOutQty;
  const netCostUSD = totalInCostUSD - totalOutCostUSD;
  const netCostVES = totalInCostVES - totalOutCostVES;

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

  // Definición de columnas según el Modelo activo (Físico vs Valorado)
  const columns: Column<KardexMovement>[] = useMemo(() => {
    // Columnas comunes a ambos modelos
    const baseColumns: Column<KardexMovement>[] = [
      {
        header: 'Fecha / Hora',
        accessorKey: 'createdAt',
        cell: (m) => (
          <div className="flex flex-col text-xs font-mono">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              {new Date(m.createdAt).toLocaleDateString('es-VE')}
            </span>
            <span className="text-[10px] text-neutral-400">
              {new Date(m.createdAt).toLocaleTimeString('es-VE')}
            </span>
          </div>
        ),
      },
      {
        header: 'Producto & Clasificación',
        accessorKey: 'productName',
        cell: (m) => (
          <div className="flex flex-col text-xs max-w-xs">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1">{m.productName}</span>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-neutral-500">
              <span className="font-mono text-neutral-400">{m.sku}</span>
              {(m.departmentName || m.groupName) && (
                <>
                  <span>&bull;</span>
                  <span className="truncate max-w-[130px]" title={`${m.departmentName || ''} / ${m.groupName || ''}`}>
                    {[m.departmentName, m.groupName].filter(Boolean).join(' / ')}
                  </span>
                </>
              )}
            </div>
          </div>
        ),
      },
      {
        header: 'Depósito',
        accessorKey: 'warehouseName',
        cell: (m) => (
          <div className="text-xs text-neutral-600 dark:text-neutral-300 truncate max-w-[130px]">
            {m.warehouseName}
          </div>
        ),
      },
      {
        header: 'Tipo Movimiento',
        accessorKey: 'movementType',
        cell: (m) => getMovementBadge(m.movementType),
      },
    ];

    if (model === 'physical') {
      // ========================================================
      // MODELO 1: FÍSICO / OPERATIVO (SIN PRECIOS NI COSTOS)
      // ========================================================
      return [
        ...baseColumns,
        {
          header: 'Entrada (+)',
          cell: (m) => {
            const isEntry = ['IN', 'ADJUST_IN', 'TRANSFER_IN', 'PURCHASE'].includes(m.movementType);
            return (
              <span className={`font-mono text-xs ${isEntry ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-neutral-300 dark:text-neutral-600'}`}>
                {isEntry ? `+${formatNumber(m.quantity)} ${m.unitOfMeasure}` : '-'}
              </span>
            );
          },
        },
        {
          header: 'Salida (-)',
          cell: (m) => {
            const isExit = ['OUT', 'ADJUST_OUT', 'TRANSFER_OUT', 'SALE'].includes(m.movementType);
            return (
              <span className={`font-mono text-xs ${isExit ? 'font-bold text-red-600 dark:text-red-400' : 'text-neutral-300 dark:text-neutral-600'}`}>
                {isExit ? `-${formatNumber(m.quantity)} ${m.unitOfMeasure}` : '-'}
              </span>
            );
          },
        },
        {
          header: 'Saldo Stock',
          cell: (m) => (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-neutral-400">{formatNumber(m.previousStock)}</span>
              <span className="text-neutral-300">→</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatNumber(m.newStock)}</span>
            </div>
          ),
        },
        {
          header: 'Documento / Motivo',
          cell: (m) => (
            <div className="flex flex-col text-xs max-w-xs">
              <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">{m.referenceDocument || 'S/D'}</span>
              <span className="text-[11px] text-neutral-500 truncate">{m.reason || 'Sin observación'}</span>
            </div>
          ),
        },
        {
          header: 'Operador',
          accessorKey: 'userName',
          cell: (m) => <span className="text-xs text-neutral-600 dark:text-neutral-400">{m.userName}</span>,
        },
      ];
    }

    // ========================================================
    // MODELO 2: VALORADO Y MONETIZADO (CON COSTOS Y PRECIOS)
    // ========================================================
    const valuedColumns: Column<KardexMovement>[] = [
      ...baseColumns,
      {
        header: 'Cantidad',
        accessorKey: 'quantity',
        cell: (m) => {
          const isEntry = ['IN', 'ADJUST_IN', 'TRANSFER_IN', 'PURCHASE'].includes(m.movementType);
          return (
            <span className={`font-mono font-bold text-xs ${isEntry ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {isEntry ? `+${formatNumber(m.quantity)}` : `-${formatNumber(m.quantity)}`} {m.unitOfMeasure}
            </span>
          );
        },
      },
      {
        header: 'Saldo Stock',
        cell: (m) => (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-neutral-400">{formatNumber(m.previousStock)}</span>
            <span className="text-neutral-300">→</span>
            <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatNumber(m.newStock)}</span>
          </div>
        ),
      },
    ];

    if (currency === 'USD') {
      valuedColumns.push(
        {
          header: 'Costo Unit. ($)',
          accessorKey: 'unitCostUSD',
          cell: (m) => <span className="font-mono text-xs">{formatMoneyUSD(m.unitCostUSD)}</span>,
        },
        {
          header: 'Total Costo ($)',
          accessorKey: 'totalCostUSD',
          cell: (m) => <span className="font-mono font-bold text-xs">{formatMoneyUSD(m.totalCostUSD)}</span>,
        },
        {
          header: 'Precio Unit. ($)',
          accessorKey: 'unitPriceUSD',
          cell: (m) => <span className="font-mono text-xs text-sky-700 dark:text-sky-400">{formatMoneyUSD(m.unitPriceUSD)}</span>,
        },
        {
          header: 'Total Precio ($)',
          accessorKey: 'totalPriceUSD',
          cell: (m) => <span className="font-mono font-bold text-xs text-sky-700 dark:text-sky-400">{formatMoneyUSD(m.totalPriceUSD)}</span>,
        },
        {
          header: 'Valor Saldo ($)',
          accessorKey: 'stockValueUSD',
          cell: (m) => <span className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100">{formatMoneyUSD(m.stockValueUSD)}</span>,
        },
      );
    } else if (currency === 'VES') {
      valuedColumns.push(
        {
          header: 'Costo Unit. (Bs.)',
          accessorKey: 'unitCostVES',
          cell: (m) => <span className="font-mono text-xs">{formatMoneyVES(m.unitCostVES)}</span>,
        },
        {
          header: 'Total Costo (Bs.)',
          accessorKey: 'totalCostVES',
          cell: (m) => <span className="font-mono font-bold text-xs">{formatMoneyVES(m.totalCostVES)}</span>,
        },
        {
          header: 'Precio Unit. (Bs.)',
          accessorKey: 'unitPriceVES',
          cell: (m) => <span className="font-mono text-xs text-sky-700 dark:text-sky-400">{formatMoneyVES(m.unitPriceVES)}</span>,
        },
        {
          header: 'Total Precio (Bs.)',
          accessorKey: 'totalPriceVES',
          cell: (m) => <span className="font-mono font-bold text-xs text-sky-700 dark:text-sky-400">{formatMoneyVES(m.totalPriceVES)}</span>,
        },
        {
          header: 'Valor Saldo (Bs.)',
          accessorKey: 'stockValueVES',
          cell: (m) => <span className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100">{formatMoneyVES(m.stockValueVES)}</span>,
        },
      );
    } else {
      // Modo Bimonetario (BOTH)
      valuedColumns.push(
        {
          header: 'Costo Unitario ($ / Bs.)',
          cell: (m) => (
            <div className="flex flex-col text-xs font-mono">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{formatMoneyUSD(m.unitCostUSD)}</span>
              <span className="text-[10px] text-neutral-500">{formatMoneyVES(m.unitCostVES)}</span>
            </div>
          ),
        },
        {
          header: 'Total Costo ($ / Bs.)',
          cell: (m) => (
            <div className="flex flex-col text-xs font-mono font-bold">
              <span className="text-neutral-900 dark:text-neutral-100">{formatMoneyUSD(m.totalCostUSD)}</span>
              <span className="text-[10px] text-neutral-500 font-normal">{formatMoneyVES(m.totalCostVES)}</span>
            </div>
          ),
        },
        {
          header: 'Precio Unitario ($ / Bs.)',
          cell: (m) => (
            <div className="flex flex-col text-xs font-mono">
              <span className="font-medium text-sky-700 dark:text-sky-400">{formatMoneyUSD(m.unitPriceUSD)}</span>
              <span className="text-[10px] text-neutral-500">{formatMoneyVES(m.unitPriceVES)}</span>
            </div>
          ),
        },
        {
          header: 'Total Precio ($ / Bs.)',
          cell: (m) => (
            <div className="flex flex-col text-xs font-mono font-bold">
              <span className="text-sky-700 dark:text-sky-400">{formatMoneyUSD(m.totalPriceUSD)}</span>
              <span className="text-[10px] text-neutral-500 font-normal">{formatMoneyVES(m.totalPriceVES)}</span>
            </div>
          ),
        },
        {
          header: 'Valor Saldo ($ / Bs.)',
          cell: (m) => (
            <div className="flex flex-col text-xs font-mono font-bold">
              <span className="text-neutral-900 dark:text-neutral-100">{formatMoneyUSD(m.stockValueUSD)}</span>
              <span className="text-[10px] text-neutral-500 font-normal">{formatMoneyVES(m.stockValueVES)}</span>
            </div>
          ),
        },
      );
    }

    valuedColumns.push(
      {
        header: 'Documento / Motivo',
        cell: (m) => (
          <div className="flex flex-col text-xs max-w-xs">
            <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">{m.referenceDocument || 'S/D'}</span>
            <span className="text-[11px] text-neutral-500 truncate">{m.reason || 'Sin observación'}</span>
          </div>
        ),
      },
      {
        header: 'Operador',
        accessorKey: 'userName',
        cell: (m) => <span className="text-xs text-neutral-600 dark:text-neutral-400">{m.userName}</span>,
      },
    );

    return valuedColumns;
  }, [model, currency]);

  // Exportar CSV según el modelo activo
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];

    if (model === 'physical') {
      headers = [
        'Fecha',
        'SKU',
        'Producto',
        'Departamento',
        'Grupo',
        'Deposito',
        'Tipo Movimiento',
        'Entrada',
        'Salida',
        'Stock Previo',
        'Nuevo Stock',
        'Unidad',
        'Documento',
        'Motivo',
        'Usuario',
      ];

      rows = filtered.map((m) => {
        const isEntry = ['IN', 'ADJUST_IN', 'TRANSFER_IN', 'PURCHASE'].includes(m.movementType);
        return [
          new Date(m.createdAt).toISOString(),
          m.sku,
          `"${m.productName}"`,
          `"${m.departmentName || ''}"`,
          `"${m.groupName || ''}"`,
          `"${m.warehouseName}"`,
          m.movementType,
          isEntry ? m.quantity : 0,
          !isEntry ? m.quantity : 0,
          m.previousStock,
          m.newStock,
          m.unitOfMeasure,
          `"${m.referenceDocument || ''}"`,
          `"${m.reason || ''}"`,
          `"${m.userName}"`,
        ];
      });
    } else {
      headers = [
        'Fecha',
        'SKU',
        'Producto',
        'Departamento',
        'Grupo',
        'Deposito',
        'Tipo Movimiento',
        'Cantidad',
        'Unidad',
        'Stock Previo',
        'Nuevo Stock',
        'Costo Unitario ($)',
        'Total Costo ($)',
        'Costo Unitario (Bs.)',
        'Total Costo (Bs.)',
        'Precio Unitario ($)',
        'Total Precio ($)',
        'Precio Unitario (Bs.)',
        'Total Precio (Bs.)',
        'Valor Saldo ($)',
        'Valor Saldo (Bs.)',
        'Documento',
        'Motivo',
        'Usuario',
      ];

      rows = filtered.map((m) => [
        new Date(m.createdAt).toISOString(),
        m.sku,
        `"${m.productName}"`,
        `"${m.departmentName || ''}"`,
        `"${m.groupName || ''}"`,
        `"${m.warehouseName}"`,
        m.movementType,
        m.quantity,
        m.unitOfMeasure,
        m.previousStock,
        m.newStock,
        m.unitCostUSD,
        m.totalCostUSD,
        m.unitCostVES,
        m.totalCostVES,
        m.unitPriceUSD,
        m.totalPriceUSD,
        m.unitPriceVES,
        m.totalPriceVES,
        m.stockValueUSD,
        m.stockValueVES,
        `"${m.referenceDocument || ''}"`,
        `"${m.reason || ''}"`,
        `"${m.userName}"`,
      ]);
    }

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kardex_${model}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Kardex (${model === 'physical' ? 'Físico' : 'Monetizado'}) exportado a CSV`);
  };

  const pdfEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.append('format', 'pdf');
    params.append('model', model);
    params.append('currency', currency);
    if (activeBranchId) params.append('branchId', activeBranchId);
    if (activeWarehouseId) params.append('warehouseId', activeWarehouseId);
    if (selectedDepartment) params.append('departmentId', selectedDepartment);
    if (selectedGroup) params.append('groupId', selectedGroup);
    if (selectedSubgroup) params.append('subgroupId', selectedSubgroup);
    if (selectedType !== 'ALL') params.append('movementType', selectedType);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return `/api/inventory/kardex?${params.toString()}`;
  }, [
    model,
    currency,
    activeBranchId,
    activeWarehouseId,
    selectedDepartment,
    selectedGroup,
    selectedSubgroup,
    selectedType,
    startDate,
    endDate,
  ]);

  return (
    <div className="space-y-6">
      {/* Encabezado y Selector de Modelo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Kardex de Inventario
            </h1>
            <Badge variant={model === 'physical' ? 'neutral' : 'info'}>
              {model === 'physical' ? 'MODELO FÍSICO (UNIDADES)' : 'MODELO VALORADO & MONETIZADO'}
            </Badge>
            {model === 'valued' && (
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Tasa BCV: Bs. {bcvRate.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {model === 'physical'
              ? 'Trazabilidad cronológica de entradas, salidas y existencias físicas en unidades sin valoración contable.'
              : 'Trazabilidad completa con valoración ponderada continua de costos y precios en moneda nacional y extranjera.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de Modelos: Físico vs Valorado */}
          <div className="flex items-center p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
            <button
              type="button"
              onClick={() => setModel('physical')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                model === 'physical'
                  ? 'bg-white dark:bg-[#1E1F21] text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              1. Físico (Solo Unidades)
            </button>
            <button
              type="button"
              onClick={() => setModel('valued')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                model === 'valued'
                  ? 'bg-white dark:bg-[#1E1F21] text-sky-700 dark:text-sky-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              2. Valorado (Costos & Precios)
            </button>
          </div>

          {/* Selector de Moneda (Habilitado en Modelo Valorado) */}
          {model === 'valued' && (
            <div className="flex items-center p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
              <button
                type="button"
                onClick={() => setCurrency('BOTH')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  currency === 'BOTH'
                    ? 'bg-white dark:bg-[#1E1F21] text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Bimonetario (Dólares y Bolívares)"
              >
                Ambas ($ / Bs.)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  currency === 'USD'
                    ? 'bg-white dark:bg-[#1E1F21] text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Dólares USD"
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('VES')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  currency === 'VES'
                    ? 'bg-white dark:bg-[#1E1F21] text-sky-700 dark:text-sky-400 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Bolívares VES"
              >
                VES (Bs.)
              </button>
            </div>
          )}

          <Button size="sm" variant="outline" onClick={handleExportCSV} className="text-xs">
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            CSV
          </Button>

          <Button size="sm" onClick={() => setShowPdfModal(true)} className="text-xs">
            <Eye className="w-4 h-4 mr-1.5" />
            Ver PDF Oficial
          </Button>
        </div>
      </div>

      {/* Banner de Alertas de Stock Crítico */}
      {stockAlerts.length > 0 && (
        <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800/60 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>
              Alertas de Stock Crítico / Agotado ({stockAlerts.length} productos requieren atención)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stockAlerts.slice(0, 3).map((a) => (
              <div
                key={a.productId}
                className="bg-white dark:bg-[#1E1F21] p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 text-xs flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[180px]">
                    {a.productName}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Stock:{' '}
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {a.availableStock} {a.unitOfMeasure}
                    </span>{' '}
                    (Mín: {a.minStock})
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

      {/* Tarjetas KPI con convención border-l-4 según Modelo */}
      {model === 'physical' ? (
        // ========================================================
        // KPIS DEL MODELO FÍSICO (SOLO CANTIDADES)
        // ========================================================
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Total Movimientos
            </span>
            <div className="text-2xl font-bold font-mono text-[#007BFF] dark:text-[#3D91FF] mt-1">
              {filtered.length}
            </div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
              Operaciones auditadas en período
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Unidades Ingresadas
            </span>
            <div className="text-2xl font-bold font-mono text-[#28A745] dark:text-[#4ADE80] mt-1">
              +{formatNumber(totalInQty)}
            </div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
              Compras, traslados y ajustes de entrada (+)
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Unidades Salientes
            </span>
            <div className="text-2xl font-bold font-mono text-[#b28500] dark:text-[#FBBF24] mt-1">
              -{formatNumber(totalOutQty)}
            </div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
              Ventas POS, traslados y mermas (-)
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Saldo Neto en Unidades
            </span>
            <div className={`text-2xl font-bold font-mono mt-1 ${netQty >= 0 ? 'text-[#17A2B8] dark:text-[#38C9DD]' : 'text-red-600 dark:text-red-400'}`}>
              {netQty >= 0 ? `+${formatNumber(netQty)}` : formatNumber(netQty)}
            </div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
              Flujo físico neto del inventario
            </div>
          </Card>
        </div>
      ) : (
        // ========================================================
        // KPIS DEL MODELO VALORADO Y MONETIZADO
        // ========================================================
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Total Movimientos
            </span>
            <div className="text-2xl font-bold font-mono text-[#007BFF] dark:text-[#3D91FF] mt-1">
              {filtered.length}
            </div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
              Tasa BCV: Bs. {bcvRate.toFixed(2)}
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Costo Total Ingresos
            </span>
            <div className="text-2xl font-bold font-mono text-[#28A745] dark:text-[#4ADE80] mt-1">
              {currency === 'VES'
                ? formatMoneyVES(totalInCostVES)
                : formatMoneyUSD(totalInCostUSD)}
            </div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 truncate">
              {currency === 'BOTH' ? `Eq: ${formatMoneyVES(totalInCostVES)}` : `+${formatNumber(totalInQty)} unds`}
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Costo Total Egresos
            </span>
            <div className="text-2xl font-bold font-mono text-[#b28500] dark:text-[#FBBF24] mt-1">
              {currency === 'VES'
                ? formatMoneyVES(totalOutCostVES)
                : formatMoneyUSD(totalOutCostUSD)}
            </div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 truncate">
              {currency === 'BOTH' ? `Eq: ${formatMoneyVES(totalOutCostVES)}` : `-${formatNumber(totalOutQty)} unds`}
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Flujo Neto Monetizado
            </span>
            <div className="text-2xl font-bold font-mono text-[#17A2B8] dark:text-[#38C9DD] mt-1">
              {currency === 'VES'
                ? formatMoneyVES(netCostVES)
                : formatMoneyUSD(netCostUSD)}
            </div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 truncate">
              {currency === 'BOTH' ? `Eq: ${formatMoneyVES(netCostVES)}` : `Neto: ${netQty >= 0 ? `+${formatNumber(netQty)}` : formatNumber(netQty)} und.`}
            </div>
          </Card>
        </div>
      )}

      {/* Barra de Filtros Multifuncional (Jerarquía + Fechas + Tipo + Búsqueda) */}
      <div className="p-4 rounded-lg bg-neutral-50 dark:bg-[#1E1F21] border border-neutral-200 dark:border-neutral-800 space-y-3">
        {/* Cabecera de Jerarquía con botón modal */}
        <div className="flex items-center justify-between pb-1 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-sky-600" />
            Filtro Jerárquico de Clasificación:
          </span>
          <button
            type="button"
            onClick={() => setIsHierarchyModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800 rounded-lg transition-colors cursor-pointer"
            title="Abrir modal interactivo de búsqueda de jerarquía"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar en Jerarquía...</span>
          </button>
        </div>

        {/* Fila 1: Filtros de Jerarquía de Productos (Departamento → Grupo → Subgrupo) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
              <FolderTree className="w-3.5 h-3.5 text-sky-600" />
              1. Departamento:
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007BFF]"
            >
              <option value="">Todos los Departamentos</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5 text-emerald-600" />
              2. Grupo:
            </label>
            <select
              value={selectedGroup}
              disabled={!selectedDepartment}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007BFF] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedDepartment ? 'Todos los Grupos' : 'Seleccione departamento primero'}
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} - {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
              <Tags className="w-3.5 h-3.5 text-indigo-600" />
              3. Subgrupo:
            </label>
            <select
              value={selectedSubgroup}
              disabled={!selectedGroup}
              onChange={(e) => setSelectedSubgroup(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007BFF] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedGroup ? 'Todos los Subgrupos' : 'Seleccione grupo primero'}
              </option>
              {subgroups.map((sg) => (
                <option key={sg.id} value={sg.id}>
                  {sg.code} - {sg.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila 2: Búsqueda de Texto + Tipo de Movimiento + Rango de Fechas */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por producto, SKU, clasificación o documento..."
              className="w-full h-8 pl-9 pr-3 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007BFF]"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-8 px-2.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007BFF]"
          >
            <option value="ALL">Todos los Movimientos</option>
            <option value="PURCHASE">Compras Proveedor (+)</option>
            <option value="SALE">Ventas en Caja POS (-)</option>
            <option value="TRANSFER_IN">Traslados Entrantes (+)</option>
            <option value="TRANSFER_OUT">Traslados Salientes (-)</option>
            <option value="ADJUST_IN">Ajustes Entrada (+)</option>
            <option value="ADJUST_OUT">Ajustes Salida (Merma -)</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007BFF]"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            <span>Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007BFF]"
            />
          </div>

          {(selectedDepartment || selectedGroup || selectedSubgroup || selectedType !== 'ALL' || startDate || endDate || search) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedDepartment('');
                setSelectedGroup('');
                setSelectedSubgroup('');
                setSelectedType('ALL');
                setStartDate('');
                setEndDate('');
                setSearch('');
              }}
              className="text-xs h-8"
            >
              Limpiar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* Tabla del Kardex con Scroll Horizontal Seguro */}
      <Card className="p-4">
        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <DataTable
            data={filtered}
            columns={columns}
            searchPlaceholder="Filtrar en resultados..."
          />
        )}
      </Card>

      {/* Modal Visor / Descarga PDF Oficial con Soporte de Ambos Modelos */}
      <PdfViewerModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        title={
          model === 'physical'
            ? 'Kardex de Inventario Físico'
            : 'Kardex de Inventario Valorado & Monetizado'
        }
        subtitle={
          model === 'physical'
            ? 'Trazabilidad cronológica de entradas, salidas y existencias físicas en unidades sin valoración contable'
            : `Control continuo de movimientos con valoración ponderada en ${currency === 'VES' ? 'Bolívares (VES)' : currency === 'USD' ? 'Dólares (USD)' : 'Dólares y Bolívares (Ambas)'}`
        }
        endpoint={pdfEndpoint}
        filename={`kardex_${model}_${new Date().toISOString().slice(0, 10)}.pdf`}
      />

      {/* Modal de Búsqueda y Selección de Jerarquía de Productos */}
      <HierarchySearchModal
        isOpen={isHierarchyModalOpen}
        onClose={() => setIsHierarchyModalOpen(false)}
        onSelect={handleHierarchySelect}
        initialDepartmentId={selectedDepartment}
        initialGroupId={selectedGroup}
        initialSubgroupId={selectedSubgroup}
        selectionMode="any"
        title="Buscar Clasificación en Kardex"
        subtitle="Seleccione Departamento, Grupo o Subgrupo para auditar sus movimientos"
      />
    </div>
  );
};
