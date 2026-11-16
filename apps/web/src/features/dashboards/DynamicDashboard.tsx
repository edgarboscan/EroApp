import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore, isSuperAdminRole } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
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
  BookOpen,
  Scale,
  FileText,
  PieChart as PieChartIcon,
  Rows3,
  LayoutGrid,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Check,
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
  module: 'sales' | 'inventory' | 'taxes' | 'receivables' | 'purchases' | 'accounting';
  description: string;
  defaultColSpan: 1 | 2 | 4;
  requiredPermission: string;
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
  accountingSummary?: {
    netIncomeUSD: number;
    netIncomeVES: number;
    revenueUSD: number;
    expenseUSD: number;
    isProfit: boolean;
    assetsUSD: number;
    liabilitiesUSD: number;
    totalEntries: number;
    postedEntries: number;
    draftEntries: number;
    recentJournalEntries: {
      number: string;
      date: string;
      concept: string;
      amountUSD: number;
      amountVES: number;
      status: string;
    }[];
    expensesBreakdown: { name: string; value: number; color: string }[];
  };
}

export const WIDGET_CATALOG: CatalogWidget[] = [
  // --- KPIs Principales ---
  {
    code: 'WIDGET_SALES_TODAY',
    title: 'Ventas de Hoy',
    category: 'kpi',
    module: 'sales',
    description: 'Total facturado en USD y VES con conteo de transacciones del día',
    defaultColSpan: 1,
    requiredPermission: 'sales.read',
  },
  {
    code: 'WIDGET_TICKET_AVG',
    title: 'Ticket Promedio',
    category: 'kpi',
    module: 'sales',
    description: 'Valor promedio de facturación por cliente en los últimos 7 días',
    defaultColSpan: 1,
    requiredPermission: 'sales.read',
  },
  {
    code: 'WIDGET_CRITICAL_STOCK',
    title: 'Alerta Stock Crítico',
    category: 'kpi',
    module: 'inventory',
    description: 'Conteo de productos por debajo del punto mínimo de reorden',
    defaultColSpan: 1,
    requiredPermission: 'inventory.read',
  },
  {
    code: 'WIDGET_TAX_SUMMARY',
    title: 'Resumen Fiscal SENIAT',
    category: 'kpi',
    module: 'taxes',
    description: 'IVA facturado e IGTF percibido en el mes en curso',
    defaultColSpan: 1,
    requiredPermission: 'taxes.read',
  },
  {
    code: 'WIDGET_CXC_SUMMARY',
    title: 'Cuentas por Cobrar',
    category: 'kpi',
    module: 'receivables',
    description: 'Saldo total por cobrar y monto actualmente en mora',
    defaultColSpan: 1,
    requiredPermission: 'receivables.read',
  },
  {
    code: 'WIDGET_PURCHASES_MONTH',
    title: 'Compras a Proveedores',
    category: 'kpi',
    module: 'purchases',
    description: 'Facturación por recepción de mercancía y compromisos del mes',
    defaultColSpan: 1,
    requiredPermission: 'purchases.read',
  },

  // --- Widgets de Contabilidad VEN-NIF (KPIs, Tablas y Gráficos) ---
  {
    code: 'WIDGET_ACCOUNTING_RESULT',
    title: 'Resultado Contable (Utilidad)',
    category: 'kpi',
    module: 'accounting',
    description: 'Utilidad neta contable del mes (Ingresos menos Costos y Gastos)',
    defaultColSpan: 1,
    requiredPermission: 'accounting.read',
  },
  {
    code: 'WIDGET_ACCOUNTING_BALANCE',
    title: 'Estructura Patrimonial',
    category: 'kpi',
    module: 'accounting',
    description: 'Total Activos registrados vs Pasivos exigibles del balance',
    defaultColSpan: 1,
    requiredPermission: 'accounting.read',
  },
  {
    code: 'WIDGET_ACCOUNTING_ENTRIES_STATUS',
    title: 'Comprobantes Contables',
    category: 'kpi',
    module: 'accounting',
    description: 'Asientos contables del mes: mayorizados y en borrador',
    defaultColSpan: 1,
    requiredPermission: 'accounting.read',
  },
  {
    code: 'WIDGET_ACCOUNTING_EXPENSES_BREAKDOWN',
    title: 'Distribución de Costos y Gastos',
    category: 'chart',
    module: 'accounting',
    description: 'Gráfico porcentual de los principales rubros de egresos contables',
    defaultColSpan: 2,
    requiredPermission: 'accounting.read',
  },
  {
    code: 'WIDGET_ACCOUNTING_RECENT_ENTRIES',
    title: 'Últimos Asientos Contables',
    category: 'table',
    module: 'accounting',
    description: 'Registro cronológico de los últimos comprobantes de diario emitidos',
    defaultColSpan: 4,
    requiredPermission: 'accounting.read',
  },

  // --- Gráficos Operativos ---
  {
    code: 'WIDGET_TOP_PRODUCTS',
    title: 'Top 5 Productos más Vendidos',
    category: 'chart',
    module: 'sales',
    description: 'Gráfico comparativo de unidades comercializadas por ítem',
    defaultColSpan: 2,
    requiredPermission: 'sales.read',
  },
  {
    code: 'WIDGET_CXC_AGING',
    title: 'Antigüedad de Saldos (CxC)',
    category: 'chart',
    module: 'receivables',
    description: 'Distribución porcentual por tramos de vencimiento de deuda',
    defaultColSpan: 2,
    requiredPermission: 'receivables.read',
  },
  {
    code: 'WIDGET_SALES_TREND',
    title: 'Tendencia Semanal de Facturación',
    category: 'chart',
    module: 'sales',
    description: 'Evolución de ventas diarias durante los últimos 7 días',
    defaultColSpan: 2,
    requiredPermission: 'sales.read',
  },

  // --- Tablas Operativas ---
  {
    code: 'WIDGET_CRITICAL_STOCK_TABLE',
    title: 'Detalle de Stock Crítico',
    category: 'table',
    module: 'inventory',
    description: 'Tabla operativa con SKU, almacén, stock actual y existencia mínima',
    defaultColSpan: 4,
    requiredPermission: 'inventory.read',
  },
  {
    code: 'WIDGET_RECENT_ACTIVITY',
    title: 'Últimas Operaciones Fiscales',
    category: 'table',
    module: 'sales',
    description: 'Registro cronológico en vivo de facturas y notas emitidas',
    defaultColSpan: 4,
    requiredPermission: 'sales.read',
  },
];

const DEFAULT_WIDGET_ITEMS: DashboardWidgetItem[] = [
  { instanceId: 'inst_1', code: 'WIDGET_SALES_TODAY', title: 'Ventas de Hoy', colSpan: 1 },
  { instanceId: 'inst_2', code: 'WIDGET_TICKET_AVG', title: 'Ticket Promedio', colSpan: 1 },
  { instanceId: 'inst_3', code: 'WIDGET_CRITICAL_STOCK', title: 'Alerta Stock Crítico', colSpan: 1 },
  { instanceId: 'inst_4', code: 'WIDGET_TAX_SUMMARY', title: 'Resumen Fiscal SENIAT', colSpan: 1 },
  { instanceId: 'inst_acc_1', code: 'WIDGET_ACCOUNTING_RESULT', title: 'Resultado Contable (Utilidad)', colSpan: 1 },
  { instanceId: 'inst_acc_2', code: 'WIDGET_ACCOUNTING_ENTRIES_STATUS', title: 'Comprobantes Contables', colSpan: 1 },
  { instanceId: 'inst_5', code: 'WIDGET_TOP_PRODUCTS', title: 'Top 5 Productos más Vendidos', colSpan: 2 },
  { instanceId: 'inst_6', code: 'WIDGET_CXC_AGING', title: 'Antigüedad de Saldos (CxC)', colSpan: 2 },
  { instanceId: 'inst_7', code: 'WIDGET_CRITICAL_STOCK_TABLE', title: 'Detalle de Productos en Stock Crítico', colSpan: 4 },
  { instanceId: 'inst_acc_3', code: 'WIDGET_ACCOUNTING_RECENT_ENTRIES', title: 'Últimos Asientos Contables', colSpan: 4 },
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
  const [isManageVisibilityOpen, setIsManageVisibilityOpen] = useState(false);

  // Sucursales y almacenes autorizados
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranchId || 'ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(activeWarehouseId || 'ALL');

  // Preferencia de visualización de filas para KPIs (1 fila o 2 filas)
  const kpiRowsStorageKey = `ero_erp_dashboard_kpi_rows_${user?.id || 'default'}`;
  const [kpiRowsLayout, setKpiRowsLayout] = useState<'1_ROW' | '2_ROWS'>(() => {
    try {
      const saved = localStorage.getItem(kpiRowsStorageKey);
      if (saved === '1_ROW' || saved === '2_ROWS') return saved;
    } catch {}
    return '2_ROWS';
  });

  const handleSetKpiRows = (layout: '1_ROW' | '2_ROWS') => {
    setKpiRowsLayout(layout);
    try {
      localStorage.setItem(kpiRowsStorageKey, layout);
    } catch {}
  };

  // Datos reales en vivo del backend
  const [summaryData, setSummaryData] = useState<DashboardSummaryData | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  const isSuper = isSuperAdminRole(user?.role);

  // Comprueba si el usuario tiene permiso para visualizar determinado widget
  const canUserAccessWidget = (w: CatalogWidget) => {
    if (isSuper) return true;
    switch (w.module) {
      case 'sales':
        return hasPermission('sales', 'read') || hasPermission('pos', 'read');
      case 'inventory':
        return hasPermission('inventory', 'read');
      case 'taxes':
        return hasPermission('taxes', 'read') || hasPermission('config', 'read');
      case 'receivables':
        return hasPermission('receivables', 'read') || hasPermission('sales', 'read');
      case 'purchases':
        return hasPermission('purchases', 'read') || hasPermission('payables', 'read');
      case 'accounting':
        return hasPermission('accounting', 'read');
      default:
        return true;
    }
  };

  // Paleta oficial de colores reactiva al tema Light / Dark
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  const chartColors = useMemo(() => {
    return {
      primary: isDark ? '#3D91FF' : '#007BFF',
      secondary: isDark ? '#38C9DD' : '#17A2B8',
      success: isDark ? '#4ADE80' : '#28A745',
      warning: isDark ? '#FBBF24' : '#FFC107',
      danger: isDark ? '#F87171' : '#DC3545',
      text: isDark ? '#E0E0E0' : '#333333',
      grid: isDark ? '#374151' : '#E5E7EB',
      tooltipBg: isDark ? '#1E1F21' : '#FFFFFF',
      tooltipBorder: isDark ? '#374151' : '#E5E7EB',
    };
  }, [isDark]);

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

            if (!isSuper) {
              const userBranchIds = user?.branches || [];
              if (userBranchIds.length > 0) {
                userBranchesList = userBranchesList.filter((b) => userBranchIds.includes(b.id));
              }

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

              let initialBranchId = activeBranchId;
              if (!initialBranchId || (initialBranchId !== 'ALL' && !userBranchesList.some((b) => b.id === initialBranchId))) {
                initialBranchId = userBranchesList[0].id;
              }
              setSelectedBranch(initialBranchId);

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
      } catch {}
    };

    fetchBranches();
    return () => {
      isMounted = false;
    };
  }, [token, user, isSuper]);

  // Almacenes disponibles para la sucursal seleccionada
  const availableWarehouses = useMemo<WarehouseOption[]>(() => {
    if (selectedBranch === 'ALL') {
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
    } catch {}
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

    // Filtrar los defaults según los permisos actuales del usuario
    const filteredDefaults = DEFAULT_WIDGET_ITEMS.filter((item) => {
      const cat = WIDGET_CATALOG.find((c) => c.code === item.code);
      return cat ? canUserAccessWidget(cat) : true;
    });

    setActiveWidgets(filteredDefaults);
    try {
      localStorage.setItem(storageKey, JSON.stringify(filteredDefaults));
    } catch {}
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
    if (!canUserAccessWidget(widget)) {
      toast.error('No cuenta con autorización para visualizar este widget');
      return;
    }

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

  // Alternar visibilidad de un widget desde el gestor de visibilidad
  const handleToggleWidgetVisibility = (widget: CatalogWidget) => {
    if (!canUserAccessWidget(widget)) {
      toast.error('No cuenta con autorización para activar este widget');
      return;
    }

    const isCurrentlyActive = activeWidgets.some((w) => w.code === widget.code);

    if (isCurrentlyActive) {
      setActiveWidgets((prev) => prev.filter((w) => w.code !== widget.code));
      toast.info(`Widget "${widget.title}" ocultado`);
    } else {
      const newItem: DashboardWidgetItem = {
        instanceId: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code: widget.code,
        title: widget.title,
        colSpan: widget.defaultColSpan,
      };
      setActiveWidgets((prev) => [...prev, newItem]);
      toast.success(`Widget "${widget.title}" activado`);
    }
  };

  // Controles de edición para cada widget
  const renderWidgetControls = (item: DashboardWidgetItem, index: number) => {
    if (!isEditMode) return null;

    return (
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#007BFF]/20 dark:border-[#3D91FF]/25 bg-[#007BFF]/10 dark:bg-[#3D91FF]/15 -mx-4 -mt-4 p-2 rounded-t-lg">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#007BFF] dark:text-[#3D91FF]">
          <Layers className="w-3.5 h-3.5" />
          <span>#{index + 1} ({item.colSpan === 1 ? '1 col' : item.colSpan === 2 ? '2 cols' : 'Ancho'})</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => handleMoveLeft(index)}
            className="p-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-[#007BFF] dark:hover:text-[#3D91FF] hover:bg-[#007BFF]/10 dark:hover:bg-[#3D91FF]/20 disabled:opacity-30 disabled:pointer-events-none"
            title="Mover antes"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={index === activeWidgets.length - 1}
            onClick={() => handleMoveRight(index)}
            className="p-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-[#007BFF] dark:hover:text-[#3D91FF] hover:bg-[#007BFF]/10 dark:hover:bg-[#3D91FF]/20 disabled:opacity-30 disabled:pointer-events-none"
            title="Mover después"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleColSpan(item.instanceId)}
            className="p-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-[#007BFF] dark:hover:text-[#3D91FF] hover:bg-[#007BFF]/10 dark:hover:bg-[#3D91FF]/20"
            title="Alternar ancho de widget"
          >
            {item.colSpan === 4 ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => handleRemoveWidget(item.instanceId)}
            className="p-1 rounded-lg text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
            title="Remover widget"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Altura estricta y uniforme para todos los KPIs
  const KPI_CARD_CLASSES = "h-[148px] min-h-[148px] max-h-[148px] p-4 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col justify-between";

  // Skeleton con la misma altura estricta
  const renderKpiSkeleton = (title: string) => (
    <div className={KPI_CARD_CLASSES}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
      </div>
      <div className="my-auto space-y-2">
        <div className="h-6 w-28 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse" />
      </div>
      <div className="h-3 w-36 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
    </div>
  );

  // Renderizado dinámico de widgets con datos reales
  const renderWidgetContent = (item: DashboardWidgetItem, index: number) => {
    const isKpiCode = [
      'WIDGET_SALES_TODAY',
      'WIDGET_TICKET_AVG',
      'WIDGET_CRITICAL_STOCK',
      'WIDGET_TAX_SUMMARY',
      'WIDGET_CXC_SUMMARY',
      'WIDGET_PURCHASES_MONTH',
      'WIDGET_ACCOUNTING_RESULT',
      'WIDGET_ACCOUNTING_BALANCE',
      'WIDGET_ACCOUNTING_ENTRIES_STATUS',
    ].includes(item.code);

    if (isLoadingSummary && isKpiCode) {
      return renderKpiSkeleton(item.title);
    }

    switch (item.code) {
      case 'WIDGET_SALES_TODAY': {
        const sales = summaryData?.salesToday || { totalUSD: 0, totalVES: 0, countInvoices: 0 };
        return (
          <div className={`${KPI_CARD_CLASSES} border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF]`}>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">
                Ventas de Hoy
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#007BFF]/10 text-[#007BFF] dark:bg-[#3D91FF]/15 dark:text-[#3D91FF] flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="my-auto">
              <div className="text-2xl font-bold font-mono tracking-tight text-[#333333] dark:text-[#E0E0E0] truncate">
                {formatMoneyUSD(sales.totalUSD)}
              </div>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {formatMoneyVES(sales.totalVES)} •{' '}
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                {formatNumber(sales.countInvoices)}
              </span>{' '}
              {sales.countInvoices === 1 ? 'factura' : 'facturas'}
            </div>
          </div>
        );
      }

      case 'WIDGET_TICKET_AVG': {
        const ticket = summaryData?.ticketAvg || { avgTicketUSD: 0, countInvoices: 0 };
        return (
          <div className={`${KPI_CARD_CLASSES} border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80]`}>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">
                Ticket Promedio
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#28A745]/10 text-[#28A745] dark:bg-[#4ADE80]/15 dark:text-[#4ADE80] flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="my-auto">
              <div className="text-2xl font-bold font-mono tracking-tight text-[#333333] dark:text-[#E0E0E0] truncate">
                {formatMoneyUSD(ticket.avgTicketUSD)}
              </div>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {ticket.countInvoices > 0
                ? `Sobre ${ticket.countInvoices} facturas emitidas (7 días)`
                : 'Sin facturación en 7 días'}
            </div>
          </div>
        );
      }

      case 'WIDGET_CRITICAL_STOCK': {
        const critical = summaryData?.criticalStock || { count: 0, items: [] };
        return (
          <div className={`${KPI_CARD_CLASSES} border-l-4 border-l-[#DC3545] dark:border-l-[#F87171]`}>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">
                Alerta Stock Crítico
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#DC3545]/10 text-[#DC3545] dark:bg-[#F87171]/15 dark:text-[#F87171] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="my-auto">
              <div className="text-2xl font-bold font-mono tracking-tight text-[#333333] dark:text-[#E0E0E0] truncate">
                {formatNumber(critical.count)}
              </div>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {critical.count > 0 ? 'Productos bajo el punto de reorden' : 'Existencias en niveles óptimos'}
            </div>
          </div>
        );
      }

      case 'WIDGET_TAX_SUMMARY': {
        const taxes = summaryData?.taxSummary || { totalIVA: 0, totalIGTF: 0 };
        return (
          <div className={`${KPI_CARD_CLASSES} border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD]`}>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">
                Resumen Fiscal SENIAT
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#17A2B8]/10 text-[#17A2B8] dark:bg-[#38C9DD]/15 dark:text-[#38C9DD] flex items-center justify-center shrink-0">
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="my-auto">
              <div className="text-2xl font-bold font-mono tracking-tight text-[#333333] dark:text-[#E0E0E0] truncate">
                {formatMoneyUSD(taxes.totalIVA)}
              </div>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              IVA Débito Fiscal • IGTF: {formatMoneyUSD(taxes.totalIGTF)}
            </div>
          </div>
        );
      }

      case 'WIDGET_CXC_SUMMARY': {
        const cxc = summaryData?.cxcSummary || { totalPendingUSD: 0, overdueUSD: 0, cxcDistribution: [] };
        return (
          <div className={`${KPI_CARD_CLASSES} border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24]`}>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">
                Cuentas por Cobrar
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#FFC107]/10 text-[#B78103] dark:bg-[#FBBF24]/15 dark:text-[#FBBF24] flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="my-auto">
              <div className="text-2xl font-bold font-mono tracking-tight text-[#333333] dark:text-[#E0E0E0] truncate">
                {formatMoneyUSD(cxc.totalPendingUSD)}
              </div>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              Vencido en mora: <span className="font-semibold text-red-600 dark:text-red-400">{formatMoneyUSD(cxc.overdueUSD)}</span>
            </div>
          </div>
        );
      }

      case 'WIDGET_PURCHASES_MONTH': {
        const purchases = summaryData?.purchasesMonth || { totalUSD: 0, ordersCount: 0 };
        return (
          <div className={`${KPI_CARD_CLASSES} border-l-4 border-l-[#6F42C1] dark:border-l-[#A78BFA]`}>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">
                Compras Proveedores
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#6F42C1]/10 text-[#6F42C1] dark:bg-[#A78BFA]/15 dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="my-auto">
              <div className="text-2xl font-bold font-mono tracking-tight text-[#333333] dark:text-[#E0E0E0] truncate">
                {formatMoneyUSD(purchases.totalUSD)}
              </div>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              Facturas del mes: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{formatNumber(purchases.ordersCount)}</span> operaciones
            </div>
          </div>
        );
      }

      // --- WIDGETS CONTABLES VEN-NIF ---
      case 'WIDGET_ACCOUNTING_RESULT': {
        const acct = summaryData?.accountingSummary || {
          netIncomeUSD: 0,
          netIncomeVES: 0,
          revenueUSD: 0,
          expenseUSD: 0,
          isProfit: true,
        };
        const isProfit = acct.netIncomeUSD >= 0;

        return (
          <div className={`${KPI_CARD_CLASSES} border-l-4 ${isProfit ? 'border-l-emerald-500 dark:border-l-emerald-400' : 'border-l-rose-500 dark:border-l-rose-400'}`}>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">
                Resultado Contable
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isProfit ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="my-auto">
              <div className={`text-2xl font-bold font-mono tracking-tight truncate ${isProfit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                {isProfit ? '+' : ''}{formatMoneyUSD(acct.netIncomeUSD)}
              </div>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {formatMoneyVES(acct.netIncomeVES)} • {isProfit ? 'Utilidad del período' : 'Déficit operativo'}
            </div>
          </div>
        );
      }

      case 'WIDGET_ACCOUNTING_BALANCE': {
        const acct = summaryData?.accountingSummary || { assetsUSD: 0, liabilitiesUSD: 0 };
        return (
          <div className={`${KPI_CARD_CLASSES} border-l-4 border-l-indigo-500 dark:border-l-indigo-400`}>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">
                Estructura Patrimonial
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="my-auto">
              <div className="text-2xl font-bold font-mono tracking-tight text-[#333333] dark:text-[#E0E0E0] truncate">
                {formatMoneyUSD(acct.assetsUSD)}
              </div>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              Activo Total • Pasivos: {formatMoneyUSD(acct.liabilitiesUSD)}
            </div>
          </div>
        );
      }

      case 'WIDGET_ACCOUNTING_ENTRIES_STATUS': {
        const acct = summaryData?.accountingSummary || { totalEntries: 0, postedEntries: 0, draftEntries: 0 };
        return (
          <div className={`${KPI_CARD_CLASSES} border-l-4 border-l-teal-500 dark:border-l-teal-400`}>
            {renderWidgetControls(item, index)}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">
                Comprobantes del Mes
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="my-auto">
              <div className="text-2xl font-bold font-mono tracking-tight text-[#333333] dark:text-[#E0E0E0] truncate">
                {formatNumber(acct.totalEntries)}
              </div>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{acct.postedEntries} asentados</span> •{' '}
              <span className="font-medium text-amber-600 dark:text-amber-400">{acct.draftEntries} en borrador</span>
            </div>
          </div>
        );
      }

      case 'WIDGET_ACCOUNTING_EXPENSES_BREAKDOWN': {
        const breakdown = summaryData?.accountingSummary?.expensesBreakdown || [];
        return (
          <Card title="Distribución de Costos y Gastos Contables" subtitle="Desglose por rubros contables del mes">
            {renderWidgetControls(item, index)}
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {breakdown.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartColors.tooltipBg,
                      borderColor: chartColors.tooltipBorder,
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [formatMoneyUSD(Number(val)), 'Total']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
              {breakdown.slice(0, 4).map((entry, idx) => (
                <div key={idx} className="flex items-center gap-1.5 truncate">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-neutral-600 dark:text-neutral-400 truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          </Card>
        );
      }

      case 'WIDGET_ACCOUNTING_RECENT_ENTRIES': {
        const entries = summaryData?.accountingSummary?.recentJournalEntries || [];
        return (
          <Card title="Últimos Asientos Contables Registrados" subtitle="Comprobantes de diario con partida doble">
            {renderWidgetControls(item, index)}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-neutral-500 dark:text-neutral-400 uppercase">
                    <th className="py-2.5 px-3">Comprobante N°</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Glosa / Concepto</th>
                    <th className="py-2.5 px-3 text-right">Monto ($)</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-neutral-400">
                        <Inbox className="w-6 h-6 text-neutral-300 dark:text-neutral-600 mx-auto mb-1.5" />
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">Sin asientos registrados</span>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Aún no se han generado comprobantes contables en el período seleccionado.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    entries.map((ent, idx) => (
                      <tr key={idx} className="hover:bg-[#F4F6F9]/70 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#333333] dark:text-[#E0E0E0]">{ent.number}</td>
                        <td className="py-2.5 px-3 text-neutral-500 dark:text-neutral-400 font-mono">{ent.date}</td>
                        <td className="py-2.5 px-3 text-[#333333] dark:text-[#E0E0E0] font-medium max-w-xs truncate">{ent.concept}</td>
                        <td className="py-2.5 px-3 text-right font-bold font-mono text-[#333333] dark:text-[#E0E0E0]">
                          {formatMoneyUSD(Number(ent.amountUSD))}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={ent.status === 'POSTED' ? 'success' : ent.status === 'DRAFT' ? 'warning' : 'danger'}>
                            {ent.status === 'POSTED' ? 'Asentado' : ent.status === 'DRAFT' ? 'Borrador' : 'Anulado'}
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

      // --- GRÁFICOS Y TABLAS EXISTENTES ---
      case 'WIDGET_TOP_PRODUCTS': {
        const products = summaryData?.topProducts || [];
        return (
          <Card title="Top 5 Productos más Vendidos" subtitle="Volumen de unidades comercializadas en los últimos 30 días">
            {renderWidgetControls(item, index)}
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={products} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartColors.text }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: chartColors.text }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartColors.tooltipBg,
                      borderColor: chartColors.tooltipBorder,
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${val} unidades`, 'Ventas']}
                  />
                  <Bar dataKey="ventas" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      }

      case 'WIDGET_CXC_AGING': {
        const cxcDist = summaryData?.cxcSummary?.cxcDistribution || [];
        return (
          <Card title="Antigüedad de Saldos (CxC)" subtitle="Distribución por días de mora de las cuentas por cobrar">
            {renderWidgetControls(item, index)}
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cxcDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {cxcDist.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartColors.tooltipBg,
                      borderColor: chartColors.tooltipBorder,
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [formatMoneyUSD(Number(val)), 'Saldo']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
              {cxcDist.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-neutral-600 dark:text-neutral-400 truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          </Card>
        );
      }

      case 'WIDGET_SALES_TREND': {
        const trend = summaryData?.weeklySalesTrend || [];
        return (
          <Card title="Tendencia Semanal de Facturación" subtitle="Evolución de ventas diarias durante los últimos 7 días">
            {renderWidgetControls(item, index)}
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: chartColors.text }} />
                  <YAxis tick={{ fontSize: 11, fill: chartColors.text }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartColors.tooltipBg,
                      borderColor: chartColors.tooltipBorder,
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [formatMoneyUSD(Number(val)), 'Total Facturado']}
                  />
                  <Bar dataKey="ventas" fill={chartColors.secondary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      }

      case 'WIDGET_CRITICAL_STOCK_TABLE': {
        const items = summaryData?.criticalStock?.items || [];
        return (
          <Card title="Detalle de Productos en Stock Crítico" subtitle="Ítems por debajo del nivel de existencia mínima">
            {renderWidgetControls(item, index)}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-neutral-500 dark:text-neutral-400 uppercase">
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3">Almacén</th>
                    <th className="py-2.5 px-3 text-right">Existencia</th>
                    <th className="py-2.5 px-3 text-right">Mínimo</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-neutral-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">Sin alertas de existencias</span>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Todos los productos se encuentran por encima de su stock de seguridad.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-[#F4F6F9]/70 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#333333] dark:text-[#E0E0E0]">{it.sku}</td>
                        <td className="py-2.5 px-3 text-[#333333] dark:text-[#E0E0E0] font-medium">{it.name}</td>
                        <td className="py-2.5 px-3 text-neutral-500 dark:text-neutral-400">{it.warehouse}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-red-600 dark:text-red-400 font-mono">
                          {formatNumber(it.stock)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-neutral-500">{formatNumber(it.min)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant="danger">
                            {it.stock <= 0 ? 'Agotado' : 'Crítico'}
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

      case 'WIDGET_RECENT_ACTIVITY': {
        const transactions = summaryData?.recentTransactions || [];
        return (
          <Card title="Últimas Operaciones Fiscales Emitidas" subtitle="Facturación en tiempo real del entorno seleccionado">
            {renderWidgetControls(item, index)}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-neutral-500 dark:text-neutral-400 uppercase">
                    <th className="py-2.5 px-3">N° Documento</th>
                    <th className="py-2.5 px-3">Hora</th>
                    <th className="py-2.5 px-3">Cliente / Razón Social</th>
                    <th className="py-2.5 px-3 text-right">Total Facturado ($)</th>
                    <th className="py-2.5 px-3 text-center">Estado Fiscal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-neutral-400">
                        <Inbox className="w-6 h-6 text-neutral-300 dark:text-neutral-600 mx-auto mb-1.5" />
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">Sin operaciones fiscales</span>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          No se han emitido facturas en esta sucursal o depósito durante la jornada.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-[#F4F6F9]/70 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#333333] dark:text-[#E0E0E0]">{tx.number}</td>
                        <td className="py-2.5 px-3 text-neutral-500 dark:text-neutral-400 font-mono">{tx.time}</td>
                        <td className="py-2.5 px-3 text-[#333333] dark:text-[#E0E0E0] font-medium">{tx.customer}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#333333] dark:text-[#E0E0E0]">
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

  // Separación de Widgets: KPIs vs Otros (Gráficos / Tablas)
  const activeKpis = useMemo(() => {
    return activeWidgets.filter((w) => {
      const cat = WIDGET_CATALOG.find((c) => c.code === w.code);
      return cat?.category === 'kpi' || w.colSpan === 1;
    });
  }, [activeWidgets]);

  const activeNonKpis = useMemo(() => {
    return activeWidgets.filter((w) => {
      const cat = WIDGET_CATALOG.find((c) => c.code === w.code);
      return cat?.category !== 'kpi' && w.colSpan !== 1;
    });
  }, [activeWidgets]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header del Dashboard */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">Dashboard Dinámico</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Métricas operativas, fiscales y contables en tiempo real según el entorno operativo autorizado
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Selector de Filas para KPIs (1 Fila vs 2 Filas) */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 px-1.5 hidden sm:inline">
              KPIs:
            </span>
            <button
              type="button"
              onClick={() => handleSetKpiRows('1_ROW')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                kpiRowsLayout === '1_ROW'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
              title="Visualizar KPIs en 1 fila continua"
            >
              <Rows3 className="w-3.5 h-3.5" />
              <span>1 Fila</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetKpiRows('2_ROWS')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                kpiRowsLayout === '2_ROWS'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
              title="Visualizar KPIs distribuidos en 2 filas"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>2 Filas</span>
            </button>
          </div>

          {/* Botón de Gestión de Visibilidad de Widgets */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsManageVisibilityOpen(true)}
            className="flex items-center gap-1.5 bg-white dark:bg-[#1E1F21] text-xs text-neutral-700 dark:text-neutral-200"
            title="Seleccionar qué widgets mostrar u ocultar en su panel"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
            <span>Gestionar Widgets</span>
          </Button>

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
                Reordenar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de Modo Edición */}
      {isEditMode && (
        <div className="bg-[#007BFF]/10 dark:bg-[#3D91FF]/15 border border-[#007BFF]/25 dark:border-[#3D91FF]/30 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#007BFF] dark:text-[#3D91FF] shrink-0" />
            <span className="text-xs text-[#007BFF] dark:text-[#3D91FF] font-medium">
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

      {/* Renderizado de Widgets */}
      {activeWidgets.length === 0 ? (
        <div className="bg-white dark:bg-[#1E1F21] border border-gray-200 dark:border-gray-800 rounded-lg p-12 text-center space-y-3">
          <Layers className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto" />
          <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No hay widgets en tu dashboard</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
            Has ocultado todos los widgets. Añade o activa widgets desde el catálogo para personalizar tu panel.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button size="sm" onClick={() => setIsManageVisibilityOpen(true)}>
              <SlidersHorizontal className="w-4 h-4 mr-1.5" />
              Configurar Visibilidad
            </Button>
            <Button size="sm" variant="outline" onClick={handleResetDefault}>
              Restaurar Predeterminados
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECCIÓN DE KPIS: Todos con la misma altura estricta y en 1 o 2 filas según la selección */}
          {activeKpis.length > 0 && (
            <div>
              <div
                className={
                  kpiRowsLayout === '1_ROW'
                    ? 'grid grid-flow-col auto-cols-[minmax(240px,1fr)] overflow-x-auto gap-4 pb-2 no-scrollbar'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                }
              >
                {activeKpis.map((item, idx) => (
                  <div key={item.instanceId} className="h-[148px]">
                    {renderWidgetContent(item, idx)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN DE GRÁFICOS Y TABLAS (Widgets medianos y anchos) */}
          {activeNonKpis.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {activeNonKpis.map((item, index) => {
                const colClass =
                  item.colSpan === 4
                    ? 'col-span-1 md:col-span-2 lg:col-span-4'
                    : item.colSpan === 2
                    ? 'col-span-1 md:col-span-2'
                    : 'col-span-1';

                return (
                  <div key={item.instanceId} className={colClass}>
                    {renderWidgetContent(item, activeKpis.length + index)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: GESTIÓN DE VISIBILIDAD DE WIDGETS POR USUARIO */}
      <Modal
        isOpen={isManageVisibilityOpen}
        onClose={() => setIsManageVisibilityOpen(false)}
        title="Gestión de Visibilidad de Widgets"
        subtitle="Activa o desactiva qué componentes deseas visualizar en tu panel de control"
        size="2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="sm" onClick={handleResetDefault}>
              Restablecer Predeterminados
            </Button>
            <Button size="sm" onClick={() => setIsManageVisibilityOpen(false)}>
              Cerrar y Aplicar
            </Button>
          </div>
        }
      >
        <div className="space-y-5 text-xs max-h-[65vh] overflow-y-auto pr-1">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Personaliza tu panel de control marcando los widgets que deseas ver. Los componentes no autorizados según tu rol de usuario permanecerán bloqueados por seguridad.
          </p>

          {/* Categorías de Widgets */}
          {[
            {
              module: 'sales',
              label: 'Ventas & Facturación POS',
              badge: 'Comercial',
            },
            {
              module: 'accounting',
              label: 'Contabilidad Integral VEN-NIF',
              badge: 'Financiero',
            },
            {
              module: 'inventory',
              label: 'Inventario & Almacenes',
              badge: 'Operativo',
            },
            {
              module: 'receivables',
              label: 'Crédito & Cuentas por Cobrar (CxC)',
              badge: 'Cobranzas',
            },
            {
              module: 'purchases',
              label: 'Compras & Proveedores (CxP)',
              badge: 'Abastecimiento',
            },
            {
              module: 'taxes',
              label: 'Régimen Tributario SENIAT',
              badge: 'Fiscal',
            },
          ].map((catGroup) => {
            const groupWidgets = WIDGET_CATALOG.filter((w) => w.module === catGroup.module);
            if (groupWidgets.length === 0) return null;

            return (
              <div key={catGroup.module} className="space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-gray-200 dark:border-gray-800">
                  <span className="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                    {catGroup.label}
                  </span>
                  <Badge variant="neutral">{catGroup.badge}</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groupWidgets.map((w) => {
                    const isAllowed = canUserAccessWidget(w);
                    const isVisible = activeWidgets.some((item) => item.code === w.code);

                    return (
                      <div
                        key={w.code}
                        className={`p-3 rounded-lg border transition-all flex items-start justify-between gap-3 ${
                          !isAllowed
                            ? 'bg-neutral-50 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 opacity-60'
                            : isVisible
                            ? 'bg-[#007BFF]/5 dark:bg-[#3D91FF]/10 border-[#007BFF]/30 dark:border-[#3D91FF]/40'
                            : 'bg-white dark:bg-[#1E1F21] border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">
                              {w.title}
                            </span>
                            {!isAllowed && (
                              <span title="No autorizado por permisos de rol">
                                <Lock className="w-3 h-3 text-neutral-400" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                            {w.description}
                          </p>
                          <span className="text-[10px] text-neutral-400 uppercase font-mono block">
                            {w.category === 'kpi' ? 'Indicador KPI' : w.category === 'chart' ? 'Gráfico' : 'Tabla Operativa'}
                          </span>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          {isAllowed ? (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isVisible}
                              onClick={() => handleToggleWidgetVisibility(w)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                                isVisible ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-neutral-300 dark:bg-neutral-700'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-neutral-900 shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  isVisible ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                              Bloqueado
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* MODAL 2: CATÁLOGO DE WIDGETS DISPONIBLES */}
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
        <div className="space-y-4 text-xs max-h-[65vh] overflow-y-auto pr-1">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Selecciona los widgets que deseas añadir a tu panel de control. Podrás organizarlos y ajustar sus dimensiones libremente.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WIDGET_CATALOG.map((catWidget) => {
              const alreadyActive = activeWidgets.some((w) => w.code === catWidget.code);
              const isAllowed = canUserAccessWidget(catWidget);

              return (
                <div
                  key={catWidget.code}
                  className={`border rounded-lg p-3.5 flex flex-col justify-between transition-colors ${
                    !isAllowed
                      ? 'border-gray-200 dark:border-gray-800 bg-neutral-50 dark:bg-neutral-900/40 opacity-60'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1F21] hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#333333] dark:text-[#E0E0E0]">{catWidget.title}</span>
                        {!isAllowed && <Lock className="w-3 h-3 text-neutral-400" />}
                      </div>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
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

                  <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      {catWidget.defaultColSpan === 1
                        ? '1 columna'
                        : catWidget.defaultColSpan === 2
                        ? '2 columnas'
                        : 'Ancho completo'}
                    </span>
                    {isAllowed ? (
                      <Button
                        size="sm"
                        variant={alreadyActive ? 'outline' : 'primary'}
                        onClick={() => handleAddFromCatalog(catWidget)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        {alreadyActive ? 'Añadir Duplicado' : 'Añadir'}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-neutral-400">Sin acceso</span>
                    )}
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
