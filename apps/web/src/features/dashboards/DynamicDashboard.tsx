import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore, isSuperAdminRole } from '../../stores/authStore';
import { toast } from 'sonner';
import { formatMoneyUSD, formatMoneyVES, formatNumber } from '../../utils/formatters';
import { showConfirmQuestion } from '../../lib/sweetalert';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  FileCheck,
  Edit3,
  Plus,
  Save,
  RotateCcw,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Building2,
  Warehouse,
  Lock,
  Layers,
  X,
  CreditCard,
  ShoppingBag,
  Inbox,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Package,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';

export interface DashboardWidgetItem {
  instanceId: string;
  code: string;
  title: string;
  colSpan: 1 | 2 | 4;
}

export interface CatalogWidget {
  code: string;
  title: string;
  category: 'kpi' | 'chart' | 'table';
  description: string;
  defaultColSpan: 1 | 2 | 4;
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  isDefault?: boolean;
  isDefaultSales?: boolean;
  isDefaultPurchases?: boolean;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
  isMain?: boolean;
  warehouses: WarehouseOption[];
}

export interface DashboardSummaryData {
  salesToday: {
    totalUSD: number;
    totalVES: number;
    countInvoices: number;
  };
  ticketAvg: {
    avgTicketUSD: number;
    countInvoices: number;
  };
  taxSummary: {
    totalIVA: number;
    totalIGTF: number;
  };
  cxcSummary: {
    totalPendingUSD: number;
    overdueUSD: number;
    cxcDistribution: { name: string; value: number; color: string }[];
  };
  purchasesMonth: {
    totalUSD: number;
    ordersCount: number;
  };
  topProducts: { name: string; ventas: number }[];
  weeklySalesTrend: { date: string; day: string; ventas: number }[];
  criticalStock: {
    count: number;
    items: {
      sku: string;
      name: string;
      warehouse: string;
      stock: number;
      min: number;
    }[];
  };
  recentTransactions: {
    number: string;
    time: string;
    customer: string;
    amount: number;
    status: string;
  }[];
}

const WIDGET_CATALOG: CatalogWidget[] = [
  {
    code: 'WIDGET_SALES_TODAY',
    title: 'Ventas de Hoy',
    category: 'kpi',
    description: 'Total facturado en USD y VES con conteo de transacciones',
    defaultColSpan: 1,
  },
  {
    code: 'WIDGET_TICKET_AVG',
    title: 'Ticket Promedio',
    category: 'kpi',
    description: 'Valor promedio de facturación por cliente en los últimos 7 días',
    defaultColSpan: 1,
  },
  {
    code: 'WIDGET_CRITICAL_STOCK',
    title: 'Alerta Stock Crítico',
    category: 'kpi',
    description: 'Conteo de productos por debajo del punto de reorden',
    defaultColSpan: 1,
  },
  {
    code: 'WIDGET_TAX_SUMMARY',
    title: 'Resumen Fiscal SENIAT',
    category: 'kpi',
    description: 'IVA facturado e IGTF percibido en el mes en curso',
    defaultColSpan: 1,
  },
  {
    code: 'WIDGET_CXC_SUMMARY',
    title: 'Cuentas por Cobrar Pendientes',
    category: 'kpi',
    description: 'Saldo total por cobrar y monto actualmente vencido',
    defaultColSpan: 1,
  },
  {
    code: 'WIDGET_PURCHASES_MONTH',
    title: 'Compras a Proveedores',
    category: 'kpi',
    description: 'Facturación por recepción de mercancía y compromisos del mes',
    defaultColSpan: 1,
  },
  {
    code: 'WIDGET_TOP_PRODUCTS',
    title: 'Top 5 Productos más Vendidos',
    category: 'chart',
    description: 'Gráfico comparativo de unidades comercializadas por ítem',
    defaultColSpan: 2,
  },
  {
    code: 'WIDGET_CXC_AGING',
    title: 'Antigüedad de Saldos (CxC)',
    category: 'chart',
    description: 'Distribución porcentual por tramos de vencimiento de deuda',
    defaultColSpan: 2,
  },
  {
    code: 'WIDGET_SALES_TREND',
    title: 'Tendencia Semanal de Facturación',
    category: 'chart',
    description: 'Evolución de ventas diarias durante los últimos 7 días',
    defaultColSpan: 2,
  },
  {
    code: 'WIDGET_CRITICAL_STOCK_TABLE',
    title: 'Detalle de Productos en Stock Crítico',
    category: 'table',
    description: 'Tabla operativa con SKU, almacén, stock actual y existencia mínima',
    defaultColSpan: 4,
  },
  {
    code: 'WIDGET_RECENT_ACTIVITY',
    title: 'Últimas Operaciones Fiscales',
    category: 'table',
    description: 'Registro cronológico en vivo de facturas y notas emitidas',
    defaultColSpan: 4,
  },
];

const DEFAULT_WIDGET_ITEMS: DashboardWidgetItem[] = [
  { instanceId: 'inst_1', code: 'WIDGET_SALES_TODAY', title: 'Ventas de Hoy', colSpan: 1 },
  { instanceId: 'inst_2', code: 'WIDGET_TICKET_AVG', title: 'Ticket Promedio', colSpan: 1 },
  { instanceId: 'inst_3', code: 'WIDGET_CRITICAL_STOCK', title: 'Alerta Stock Crítico', colSpan: 1 },
  { instanceId: 'inst_4', code: 'WIDGET_TAX_SUMMARY', title: 'Resumen Fiscal SENIAT', colSpan: 1 },
  { instanceId: 'inst_5', code: 'WIDGET_TOP_PRODUCTS', title: 'Top 5 Productos más Vendidos', colSpan: 2 },
  { instanceId: 'inst_6', code: 'WIDGET_CXC_AGING', title: 'Antigüedad de Saldos (CxC)', colSpan: 2 },
  { instanceId: 'inst_7', code: 'WIDGET_CRITICAL_STOCK_TABLE', title: 'Detalle de Productos en Stock Crítico', colSpan: 4 },
];

export const DynamicDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const activeWarehouseId = useAuthStore((s) => s.activeWarehouseId);
  const setActiveBranch = useAuthStore((s) => s.setActiveBranch);
  const setActiveWarehouse = useAuthStore((s) => s.setActiveWarehouse);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  // Sucursales y almacenes autorizados
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranchId || 'ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(activeWarehouseId || 'ALL');

  // Datos reales en vivo del backend
  const [summaryData, setSummaryData] = useState<DashboardSummaryData | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  const isSuper = isSuperAdminRole(user?.role);

  // Cargar sucursales autorizadas desde API
  useEffect(() => {
    let isMounted = true;
    const fetchBranches = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/auth/branches', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            let userBranchesList: BranchOption[] = json.data;

            // Filtrar solo sucursales autorizadas al usuario si no es super_admin
            if (!isSuper) {
              const userBranchIds = user?.branches || [];
              if (userBranchIds.length > 0) {
                userBranchesList = userBranchesList.filter((b) => userBranchIds.includes(b.id));
              }

              // Filtrar solo depósitos autorizados
              const userWarehouseIds = user?.warehouses || [];
              if (userWarehouseIds.length > 0) {
                userBranchesList = userBranchesList.map((b) => ({
                  ...b,
                  warehouses: b.warehouses.filter((w) => userWarehouseIds.includes(w.id)),
                }));
              }
            }

            if (isMounted && userBranchesList.length > 0) {
              setBranches(userBranchesList);

              // Establecer sucursal seleccionada inicial si no está fijada
              let initialBranchId = activeBranchId;
              if (!initialBranchId || (initialBranchId !== 'ALL' && !userBranchesList.some((b) => b.id === initialBranchId))) {
                initialBranchId = userBranchesList[0].id;
              }
              setSelectedBranch(initialBranchId);

              // Establecer depósito inicial para la sucursal activa
              const branchObj = userBranchesList.find((b) => b.id === initialBranchId);
              if (branchObj && branchObj.warehouses.length > 0) {
                const initialWh = branchObj.warehouses.some((w) => w.id === activeWarehouseId)
                  ? activeWarehouseId!
                  : (branchObj.warehouses.find((w) => w.isDefaultSales)?.id || branchObj.warehouses.find((w) => w.isDefault)?.id || branchObj.warehouses[0].id);
                setSelectedWarehouse(initialWh);
              }
            }
          }
        }
      } catch {
        // En caso de fallo de red
      }
    };

    fetchBranches();
    return () => {
      isMounted = false;
    };
  }, [token, user, isSuper]);

  // Almacenes disponibles para la sucursal seleccionada
  const availableWarehouses = useMemo<WarehouseOption[]>(() => {
    if (selectedBranch === 'ALL') {
      // Consolidar todos los almacenes de todas las sucursales autorizadas
      return branches.flatMap((b) => b.warehouses);
    }
    const currentBranch = branches.find((b) => b.id === selectedBranch);
    return currentBranch ? currentBranch.warehouses : [];
  }, [branches, selectedBranch]);

  // Reglas de permisos para alternar sucursal y depósito
  const canSwitchBranch = useMemo(() => {
    if (isSuper) return true;
    if (hasPermission('branches', 'switch') || hasPermission('config', 'read')) return true;
    return branches.length > 1;
  }, [isSuper, hasPermission, branches.length]);

  const isBranchLocked = !canSwitchBranch || branches.length <= 1;

  const canSwitchWarehouse = useMemo(() => {
    if (isSuper) return true;
    if (hasPermission('warehouses', 'switch') || hasPermission('inventory', 'transfer')) return true;
    return availableWarehouses.length > 1;
  }, [isSuper, hasPermission, availableWarehouses.length]);

  const isWarehouseLocked = !canSwitchWarehouse || availableWarehouses.length <= 1;

  // Cargar datos en vivo del backend para la sucursal y depósito seleccionados
  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
      setIsLoadingSummary(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const params = new URLSearchParams();
        if (selectedBranch) params.set('branchId', selectedBranch);
        if (selectedWarehouse) params.set('warehouseId', selectedWarehouse);

        const res = await fetch(`/api/dashboards/summary?${params.toString()}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && isMounted) {
            setSummaryData(json.data);
          }
        } else if (isMounted) {
          // En caso de respuesta con error, establecer valores seguros en cero
          setSummaryData({
            salesToday: { totalUSD: 0, totalVES: 0, countInvoices: 0 },
            ticketAvg: { avgTicketUSD: 0, countInvoices: 0 },
            taxSummary: { totalIVA: 0, totalIGTF: 0 },
            cxcSummary: { totalPendingUSD: 0, overdueUSD: 0, cxcDistribution: [] },
            purchasesMonth: { totalUSD: 0, ordersCount: 0 },
            topProducts: [],
            weeklySalesTrend: [],
            criticalStock: { count: 0, items: [] },
            recentTransactions: [],
          });
        }
      } catch {
        if (isMounted) {
          setSummaryData({
            salesToday: { totalUSD: 0, totalVES: 0, countInvoices: 0 },
            ticketAvg: { avgTicketUSD: 0, countInvoices: 0 },
            taxSummary: { totalIVA: 0, totalIGTF: 0 },
            cxcSummary: { totalPendingUSD: 0, overdueUSD: 0, cxcDistribution: [] },
            purchasesMonth: { totalUSD: 0, ordersCount: 0 },
            topProducts: [],
            weeklySalesTrend: [],
            criticalStock: { count: 0, items: [] },
            recentTransactions: [],
          });
        }
      } finally {
        if (isMounted) setIsLoadingSummary(false);
      }
    };

    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, [token, selectedBranch, selectedWarehouse]);

  // Manejador del cambio de sucursal
  const handleBranchChange = (branchId: string) => {
    if (isBranchLocked) {
      toast.warning('No tiene autorización para cambiar de sucursal.');
      return;
    }

    setSelectedBranch(branchId);

    // Ajustar depósito para la nueva sucursal seleccionada
    if (branchId !== 'ALL') {
      const branch = branches.find((b) => b.id === branchId);
      if (branch && branch.warehouses.length > 0) {
        const defaultWh =
          branch.warehouses.find((w) => w.isDefaultSales)?.id ||
          branch.warehouses.find((w) => w.isDefault)?.id ||
          branch.warehouses[0].id;
        setSelectedWarehouse(defaultWh);
        setActiveBranch(branchId, defaultWh);
      } else {
        setSelectedWarehouse('ALL');
        setActiveBranch(branchId);
      }
    } else {
      setSelectedWarehouse('ALL');
    }

    const branchName = branchId === 'ALL'
      ? 'Consolidado (Todas las sucursales)'
      : branches.find((b) => b.id === branchId)?.name || 'Sucursal Seleccionada';
    toast.info(`Filtro aplicado: ${branchName}`);
  };

  // Manejador del cambio de depósito
  const handleWarehouseChange = (warehouseId: string) => {
    if (isWarehouseLocked) {
      toast.warning('No tiene autorización para cambiar de depósito.');
      return;
    }

    setSelectedWarehouse(warehouseId);
    if (warehouseId !== 'ALL') {
      setActiveWarehouse(warehouseId);
    }
    const whName = warehouseId === 'ALL'
      ? 'Todos los depósitos'
      : availableWarehouses.find((w) => w.id === warehouseId)?.name || 'Depósito Seleccionado';
    toast.info(`Filtro aplicado: ${whName}`);
  };

  // Layout persistente en LocalStorage y Backend
  const storageKey = `ero_erp_dashboard_layout_${user?.id || 'default'}`;
  const [activeWidgets, setActiveWidgets] = useState<DashboardWidgetItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback a widgets iniciales
    }
    return DEFAULT_WIDGET_ITEMS;
  });

  const [savedSnapshot, setSavedSnapshot] = useState<DashboardWidgetItem[]>(activeWidgets);

  const handleEnterEditMode = () => {
    setSavedSnapshot([...activeWidgets]);
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setActiveWidgets([...savedSnapshot]);
    setIsEditMode(false);
  };

  const handleSaveLayout = async () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(activeWidgets));

      if (token) {
        const layoutPayload = {
          name: 'Dashboard Personalizado',
          items: activeWidgets.map((w, idx) => ({
            widgetId: w.code,
            x: (idx * 2) % 12,
            y: Math.floor((idx * 2) / 12) * 2,
            w: w.colSpan * 3,
            h: 2,
          })),
        };

        await fetch('/api/dashboards/me/layout', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(layoutPayload),
        });
      }

      setSavedSnapshot([...activeWidgets]);
      setIsEditMode(false);
      toast.success('Diseño del dashboard guardado exitosamente');
    } catch {
      setIsEditMode(false);
      toast.success('Diseño guardado localmente en su sesión');
    }
  };

  const handleResetDefault = async () => {
    const confirmed = await showConfirmQuestion({
      title: '¿Restablecer diseño del dashboard?',
      text: 'Se restaurará la distribución original recomendada de los widgets en el dashboard.',
      confirmButtonText: 'Sí, restablecer',
      cancelButtonText: 'Cancelar',
      icon: 'question',
    });
    if (!confirmed) return;

    setActiveWidgets(DEFAULT_WIDGET_ITEMS);
    toast.info('Se ha restablecido el layout inicial recomendado');
  };

  const handleMoveLeft = (index: number) => {
    if (index === 0) return;
    setActiveWidgets((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveRight = (index: number) => {
    if (index === activeWidgets.length - 1) return;
    setActiveWidgets((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleToggleColSpan = (instanceId: string) => {
    setActiveWidgets((prev) =>
      prev.map((w) => {
        if (w.instanceId !== instanceId) return w;
        const nextSpan: 1 | 2 | 4 = w.colSpan === 1 ? 2 : w.colSpan === 2 ? 4 : 1;
        return { ...w, colSpan: nextSpan };
      })
    );
  };

  const handleRemoveWidget = (instanceId: string) => {
    setActiveWidgets((prev) => prev.filter((w) => w.instanceId !== instanceId));
    toast.info('Widget removido del dashboard');
  };

  const handleAddFromCatalog = (widget: CatalogWidget) => {
    const newItem: DashboardWidgetItem = {
      instanceId: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: widget.code,
      title: widget.title,
      colSpan: widget.defaultColSpan,
    };
    setActiveWidgets((prev) => [...prev, newItem]);
    setIsCatalogOpen(false);
    toast.success(`Widget "${widget.title}" agregado al dashboard`);
  };

  // Controles de edición para cada widget
  const renderWidgetControls = (item: DashboardWidgetItem, index: number) => {
    if (!isEditMode) return null;

    return (
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-sky-100 bg-sky-50/60 -mx-4 -mt-4 p-2.5 rounded-t-lg">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-800">
          <Layers className="w-3.5 h-3.5" />
          <span>Posición #{index + 1} ({item.colSpan === 1 ? '1 col' : item.colSpan === 2 ? '2 cols' : 'Ancho completo'})</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => handleMoveLeft(index)}
            className="p-1 rounded-lg text-neutral-600 hover:text-sky-700 hover:bg-sky-100 disabled:opacity-30 disabled:pointer-events-none"
            title="Mover antes"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={index === activeWidgets.length - 1}
            onClick={() => handleMoveRight(index)}
            className="p-1 rounded-lg text-neutral-600 hover:text-sky-700 hover:bg-sky-100 disabled:opacity-30 disabled:pointer-events-none"
            title="Mover después"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleColSpan(item.instanceId)}
            className="p-1 rounded-lg text-neutral-600 hover:text-sky-700 hover:bg-sky-100"
            title="Alternar ancho de widget"
          >
            {item.colSpan === 4 ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => handleRemoveWidget(item.instanceId)}
            className="p-1 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-100"
            title="Remover widget"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Renderizado de Skeleton para reducir layout shift
  const renderKpiSkeleton = (title: string) => (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-neutral-100 animate-pulse" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-7 w-24 bg-neutral-200 rounded-lg animate-pulse" />
        <div className="h-3 w-36 bg-neutral-100 rounded-lg animate-pulse" />
      </div>
    </Card>
  );

  // Renderizado dinámico de widgets con datos reales
  const renderWidgetContent = (item: DashboardWidgetItem, index: number) => {
    if (isLoadingSummary) {
      if (['WIDGET_SALES_TODAY', 'WIDGET_TICKET_AVG', 'WIDGET_CRITICAL_STOCK', 'WIDGET_TAX_SUMMARY', 'WIDGET_CXC_SUMMARY', 'WIDGET_PURCHASES_MONTH'].includes(item.code)) {
        return renderKpiSkeleton(item.title);
      }
    }

    switch (item.code) {
      case 'WIDGET_SALES_TODAY': {
        const sales = summaryData?.salesToday || { totalUSD: 0, totalVES: 0, countInvoices: 0 };
        return (
          <Card>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Ventas de Hoy</span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-neutral-900">{formatMoneyUSD(sales.totalUSD)}</div>
              <div className="text-xs text-neutral-500 mt-1">
                {formatMoneyVES(sales.totalVES)} •{' '}
                <span className="font-semibold text-neutral-700">
                  {formatNumber(sales.countInvoices)}
                </span>{' '}
                {sales.countInvoices === 1 ? 'factura emitida' : 'facturas emitidas'}
              </div>
            </div>
          </Card>
        );
      }

      case 'WIDGET_TICKET_AVG': {
        const ticket = summaryData?.ticketAvg || { avgTicketUSD: 0, countInvoices: 0 };
        return (
          <Card>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Ticket Promedio</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-neutral-900">{formatMoneyUSD(ticket.avgTicketUSD)}</div>
              <div className="text-xs text-neutral-500 font-medium mt-1">
                {ticket.countInvoices > 0
                  ? `Calculado sobre ${ticket.countInvoices} facturas (7 días)`
                  : 'Sin ventas en los últimos 7 días'}
              </div>
            </div>
          </Card>
        );
      }

      case 'WIDGET_CRITICAL_STOCK': {
        const criticalCount = summaryData?.criticalStock?.count || 0;
        return (
          <Card>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Stock Crítico</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-neutral-900">{criticalCount}</div>
              <div className={`text-xs font-medium mt-1 ${criticalCount > 0 ? 'text-amber-600' : 'text-neutral-500'}`}>
                {criticalCount > 0
                  ? 'Productos requieren reposición inmediata'
                  : 'Inventario en niveles óptimos'}
              </div>
            </div>
          </Card>
        );
      }

      case 'WIDGET_TAX_SUMMARY': {
        const tax = summaryData?.taxSummary || { totalIVA: 0, totalIGTF: 0 };
        return (
          <Card>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">IVA Facturado (Mes)</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-neutral-900">{formatMoneyUSD(tax.totalIVA)}</div>
              <div className="text-xs text-neutral-500 mt-1">
                IGTF percibido: <span className="font-semibold text-neutral-700">{formatMoneyUSD(tax.totalIGTF)}</span>
              </div>
            </div>
          </Card>
        );
      }

      case 'WIDGET_CXC_SUMMARY': {
        const cxc = summaryData?.cxcSummary || { totalPendingUSD: 0, overdueUSD: 0, cxcDistribution: [] };
        return (
          <Card>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Cuentas por Cobrar</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-neutral-900">{formatMoneyUSD(cxc.totalPendingUSD)}</div>
              <div className="text-xs text-neutral-500 mt-1">
                Vencido:{' '}
                <span className={`font-semibold ${cxc.overdueUSD > 0 ? 'text-red-600' : 'text-neutral-700'}`}>
                  {formatMoneyUSD(cxc.overdueUSD)}
                </span>
              </div>
            </div>
          </Card>
        );
      }

      case 'WIDGET_PURCHASES_MONTH': {
        const purchases = summaryData?.purchasesMonth || { totalUSD: 0, ordersCount: 0 };
        return (
          <Card>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Compras del Mes</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-neutral-900">{formatMoneyUSD(purchases.totalUSD)}</div>
              <div className="text-xs text-neutral-500 mt-1">
                En <span className="font-semibold text-neutral-700">{purchases.ordersCount}</span> órdenes de compra
              </div>
            </div>
          </Card>
        );
      }

      case 'WIDGET_TOP_PRODUCTS': {
        const topProducts = summaryData?.topProducts || [];
        return (
          <Card title="Top 5 Productos más Vendidos" subtitle="Unidades facturadas en los últimos 30 días">
            {renderWidgetControls(item, index)}
            {topProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-neutral-50/50 rounded-lg border border-dashed border-neutral-200 mt-2">
                <Package className="w-8 h-8 text-neutral-300 mb-2" />
                <p className="text-xs font-semibold text-neutral-700">Sin productos vendidos</p>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-xs">
                  No se registran ventas para la sucursal o depósito seleccionado en los últimos 30 días.
                </p>
              </div>
            ) : (
              <div className="h-64 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="ventas" fill="#0284c7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        );
      }

      case 'WIDGET_CXC_AGING': {
        const cxcDistribution = summaryData?.cxcSummary?.cxcDistribution || [];
        const hasCxC = cxcDistribution.some((d) => d.value > 0);
        return (
          <Card title="Antigüedad de Saldos (CxC)" subtitle="Monto por cobrar según días de vencimiento ($ USD)">
            {renderWidgetControls(item, index)}
            {!hasCxC ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-neutral-50/50 rounded-lg border border-dashed border-neutral-200 mt-2">
                <CreditCard className="w-8 h-8 text-neutral-300 mb-2" />
                <p className="text-xs font-semibold text-neutral-700">Sin cuentas por cobrar pendientes</p>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-xs">
                  Todos los clientes están al día o no existen documentos de crédito registrados.
                </p>
              </div>
            ) : (
              <>
                <div className="h-56 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cxcDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {cxcDistribution.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-2 text-xs">
                  {cxcDistribution.map((d, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-neutral-600">{d.name}:</span>
                      <span className="font-semibold text-neutral-900">{formatMoneyUSD(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        );
      }

      case 'WIDGET_SALES_TREND': {
        const trend = summaryData?.weeklySalesTrend || [];
        const totalTrendSales = trend.reduce((sum, d) => sum + d.ventas, 0);
        return (
          <Card
            title="Tendencia Semanal de Ventas"
            subtitle={`Monto facturado en USD en los últimos 7 días (Total: ${formatMoneyUSD(totalTrendSales)})`}
          >
            {renderWidgetControls(item, index)}
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="ventas" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      }

      case 'WIDGET_CRITICAL_STOCK_TABLE': {
        const items = summaryData?.criticalStock?.items || [];
        return (
          <Card title="Detalle de Productos en Stock Crítico" subtitle="Monitoreo operativo para reposición o traslados">
            {renderWidgetControls(item, index)}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 uppercase">
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3">Depósito</th>
                    <th className="py-2.5 px-3 text-right">Stock Actual</th>
                    <th className="py-2.5 px-3 text-right">Stock Mínimo</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-neutral-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                        <span className="font-semibold text-neutral-700">Niveles de inventario óptimos</span>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          No existen productos por debajo de la existencia mínima requerida.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    items.map((prod, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-neutral-700">{prod.sku}</td>
                        <td className="py-2.5 px-3 font-medium text-neutral-900">{prod.name}</td>
                        <td className="py-2.5 px-3 text-neutral-600">{prod.warehouse}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-red-600">{prod.stock}</td>
                        <td className="py-2.5 px-3 text-right text-neutral-600">{prod.min}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant="danger">Bajo Mínimo</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        );
      }

      case 'WIDGET_RECENT_ACTIVITY': {
        const transactions = summaryData?.recentTransactions || [];
        return (
          <Card title="Últimas Operaciones Fiscales Emitidas" subtitle="Facturación en tiempo real del entorno seleccionado">
            {renderWidgetControls(item, index)}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 uppercase">
                    <th className="py-2.5 px-3">N° Documento</th>
                    <th className="py-2.5 px-3">Hora</th>
                    <th className="py-2.5 px-3">Cliente / Razón Social</th>
                    <th className="py-2.5 px-3 text-right">Total Facturado ($)</th>
                    <th className="py-2.5 px-3 text-center">Estado Fiscal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-neutral-400">
                        <Inbox className="w-6 h-6 text-neutral-300 mx-auto mb-1.5" />
                        <span className="font-semibold text-neutral-700">Sin operaciones fiscales</span>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          No se han emitido facturas en esta sucursal o depósito durante la jornada.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">{tx.number}</td>
                        <td className="py-2.5 px-3 text-neutral-500 font-mono">{tx.time}</td>
                        <td className="py-2.5 px-3 text-neutral-700 font-medium">{tx.customer}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-neutral-900">
                          {formatMoneyUSD(Number(tx.amount))}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={tx.status === 'ANNULLED' ? 'danger' : 'success'}>
                            {tx.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        );
      }

      default:
        return (
          <Card title={item.title}>
            {renderWidgetControls(item, index)}
            <div className="py-8 text-center text-xs text-neutral-400">
              Contenido del widget {item.code}
            </div>
          </Card>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header del Dashboard */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Dashboard Dinámico</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Métricas operativas y financieras en tiempo real según el entorno operativo autorizado
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Selector de Sucursal Autorizada */}
          <div
            className={`flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-1.5 shadow-sm text-xs w-full sm:w-auto ${
              isBranchLocked ? 'opacity-85 bg-neutral-50' : ''
            } hidden`}
          >
            <Building2 className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="text-neutral-500 font-medium shrink-0">Sucursal:</span>
            <select
              value={selectedBranch}
              disabled={isBranchLocked}
              onChange={(e) => handleBranchChange(e.target.value)}
              className={`bg-transparent font-semibold text-neutral-900 focus:outline-none w-full ${
                isBranchLocked ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {isSuper && <option value="ALL">Consolidado (Todas las autorizadas)</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            {isBranchLocked && (
              <span title="Sucursal asignada por perfil (Sin autorización para cambiar)">
                <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              </span>
            )}
          </div>

          {/* Selector de Depósito / Almacén Autorizado */}
          <div
            className={`flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-1.5 shadow-sm text-xs w-full sm:w-auto ${
              isWarehouseLocked ? 'opacity-85 bg-neutral-50' : ''
            } hidden`}
          >
            <Warehouse className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="text-neutral-500 font-medium shrink-0">Depósito:</span>
            <select
              value={selectedWarehouse}
              disabled={isWarehouseLocked}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              className={`bg-transparent font-semibold text-neutral-900 focus:outline-none w-full ${
                isWarehouseLocked ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {(isSuper || canSwitchWarehouse) && <option value="ALL">Todos los depósitos</option>}
              {availableWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
            {isWarehouseLocked && (
              <span title="Depósito asignado por perfil (Sin autorización para cambiar)">
                <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              </span>
            )}
          </div>

          {/* Botones de Personalización */}
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Button variant="outline" size="sm" onClick={handleResetDefault} title="Restablecer layout recomendado">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Restablecer
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveLayout}>
                  <Save className="w-4 h-4 mr-1.5" />
                  Guardar Layout
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={handleEnterEditMode}>
                <Edit3 className="w-4 h-4 mr-1.5" />
                Personalizar Widgets
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de Modo Edición */}
      {isEditMode && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="text-xs text-sky-900 font-medium">
              Modo edición activo: Puedes reordenar con las flechas, cambiar el ancho de columnas, ocultar widgets o añadir nuevos del catálogo.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => setIsCatalogOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Añadir Widget
            </Button>
          </div>
        </div>
      )}

      {/* Grid Dinámico de Widgets */}
      {activeWidgets.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-12 text-center space-y-3">
          <Layers className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto" />
          <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No hay widgets en tu dashboard</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
            Has ocultado todos los widgets. Añade widgets desde el catálogo para personalizar tu panel.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button size="sm" onClick={() => setIsCatalogOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Explorar Catálogo
            </Button>
            <Button size="sm" variant="outline" onClick={handleResetDefault}>
              Restaurar Predeterminados
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeWidgets.map((item, index) => {
            const colClass =
              item.colSpan === 4
                ? 'col-span-1 md:col-span-2 lg:col-span-4'
                : item.colSpan === 2
                ? 'col-span-1 md:col-span-2'
                : 'col-span-1';

            return (
              <div key={item.instanceId} className={colClass}>
                {renderWidgetContent(item, index)}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL / DRAWER CATÁLOGO DE WIDGETS */}
      <Modal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        title="Catálogo de Widgets Disponibles"
        subtitle="Selecciona componentes para agregar a tu panel de control"
        size="2xl"
        footer={
          <Button variant="outline" size="sm" onClick={() => setIsCatalogOpen(false)}>
            Cerrar Catálogo
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Selecciona los widgets que deseas agregar a tu panel de control. Podrás organizarlos y ajustar sus dimensiones libremente.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WIDGET_CATALOG.map((catWidget) => {
              const alreadyActive = activeWidgets.some((w) => w.code === catWidget.code);

              return (
                <div
                  key={catWidget.code}
                  className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3.5 flex flex-col justify-between hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors bg-white dark:bg-neutral-800/60"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{catWidget.title}</span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                        {catWidget.category === 'kpi'
                          ? 'KPI'
                          : catWidget.category === 'chart'
                          ? 'Gráfico'
                          : 'Tabla'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                      {catWidget.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      {catWidget.defaultColSpan === 1
                        ? '1 columna'
                        : catWidget.defaultColSpan === 2
                        ? '2 columnas'
                        : 'Ancho completo'}
                    </span>
                    <Button
                      size="sm"
                      variant={alreadyActive ? 'outline' : 'primary'}
                      onClick={() => handleAddFromCatalog(catWidget)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Añadir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
};
