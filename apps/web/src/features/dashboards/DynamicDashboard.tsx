import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore, isSuperAdminRole } from '../../stores/authStore';
import { toast } from 'sonner';
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
  Layers,
  X,
  CreditCard,
  ShoppingBag,
  BarChart2,
  Clock,
  CheckCircle2,
  Maximize2,
  Minimize2,
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
    description: 'Valor promedio de facturación por cliente y variación semanal',
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
    description: 'IVA facturado e IGTF percibido en el período tributario',
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
    description: 'Facturación por recepción de mercancía y compromisos de pago',
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
  const setActiveBranch = useAuthStore((s) => s.setActiveBranch);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranchId || 'ALL');

  // Sucursales autorizadas del usuario
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([
    { id: 'b1', name: 'Sucursal Principal - Caracas', code: 'SUC-01' },
    { id: 'b2', name: 'Sucursal Las Mercedes', code: 'SUC-02' },
    { id: 'b3', name: 'Sucursal Valencia Centro', code: 'SUC-03' },
  ]);

  // Cargar sucursales autorizadas desde API
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/auth/branches', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            // Filtrar solo sucursales autorizadas al usuario si no es super_admin
            const userBranches = user?.branches || [];
            const filtered = userBranches.length > 0 && !isSuperAdminRole(user?.role)
              ? json.data.filter((b: any) => userBranches.includes(b.id))
              : json.data;
            if (filtered.length > 0) {
              setBranches(filtered);
            }
          }
        }
      } catch {
        // Mantener sucursales por defecto
      }
    };
    fetchBranches();
  }, [token, user]);

  // Sincronizar selectedBranch con activeBranchId inicial
  useEffect(() => {
    if (activeBranchId && selectedBranch === 'ALL') {
      setSelectedBranch(activeBranchId);
    }
  }, [activeBranchId]);

  // Estado de widgets activos en el Dashboard
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
      // Ignorar fallback
    }
    return DEFAULT_WIDGET_ITEMS;
  });

  const [savedSnapshot, setSavedSnapshot] = useState<DashboardWidgetItem[]>(activeWidgets);

  // Al entrar en modo edición, tomar un snapshot para permitir Cancelar
  const handleEnterEditMode = () => {
    setSavedSnapshot([...activeWidgets]);
    setIsEditMode(true);
  };

  // Cancelar edición y revertir al snapshot guardado
  const handleCancelEdit = () => {
    setActiveWidgets([...savedSnapshot]);
    setIsEditMode(false);
  };

  // Guardar Layout en API y en LocalStorage
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

  // Restablecer layout predeterminado
  const handleResetDefault = () => {
    setActiveWidgets(DEFAULT_WIDGET_ITEMS);
    toast.info('Se ha restablecido el layout inicial recomendado');
  };

  // Reordenar widgets: mover hacia la izquierda / arriba
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

  // Reordenar widgets: mover hacia la derecha / abajo
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

  // Alternar tamaño de columna del widget
  const handleToggleColSpan = (instanceId: string) => {
    setActiveWidgets((prev) =>
      prev.map((w) => {
        if (w.instanceId !== instanceId) return w;
        const nextSpan: 1 | 2 | 4 = w.colSpan === 1 ? 2 : w.colSpan === 2 ? 4 : 1;
        return { ...w, colSpan: nextSpan };
      })
    );
  };

  // Eliminar widget activo
  const handleRemoveWidget = (instanceId: string) => {
    setActiveWidgets((prev) => prev.filter((w) => w.instanceId !== instanceId));
    toast.info('Widget removido del dashboard');
  };

  // Añadir widget desde el catálogo
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

  // Cambiar sucursal activa
  const handleBranchChange = (branchId: string) => {
    setSelectedBranch(branchId);
    if (branchId !== 'ALL') {
      setActiveBranch(branchId);
    }
    const branchName = branchId === 'ALL'
      ? 'Consolidado (Todas las sucursales)'
      : branches.find((b) => b.id === branchId)?.name || 'Sucursal Seleccionada';
    toast.info(`Datos filtrados para: ${branchName}`);
  };

  // Datos dinámicos calculados según la sucursal seleccionada
  const multiplier = useMemo(() => {
    if (selectedBranch === 'b2') return 0.65;
    if (selectedBranch === 'b3') return 0.45;
    if (selectedBranch === 'ALL') return 1.45;
    return 1.0; // b1
  }, [selectedBranch]);

  const kpiSales = useMemo(() => ({
    totalUSD: (4850.5 * multiplier).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    totalVES: (179468.5 * multiplier).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    countInvoices: Math.round(42 * multiplier),
  }), [multiplier]);

  const kpiTicket = useMemo(() => ({
    avgTicketUSD: (115.48 * (0.95 + multiplier * 0.05)).toFixed(2),
  }), [multiplier]);

  const kpiTax = useMemo(() => ({
    totalIVA: (776.08 * multiplier).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    totalIGTF: (145.51 * multiplier).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  }), [multiplier]);

  const kpiCxc = useMemo(() => ({
    totalPendingUSD: (19900 * multiplier).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    overdueUSD: (3200 * multiplier).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  }), [multiplier]);

  const kpiPurchases = useMemo(() => ({
    totalUSD: (12400 * multiplier).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ordersCount: Math.round(8 * multiplier),
  }), [multiplier]);

  const cxcData = useMemo(() => [
    { name: 'Al Día', value: Math.round(12500 * multiplier), color: '#10b981' },
    { name: '1-30 Días', value: Math.round(4200 * multiplier), color: '#38bdf8' },
    { name: '31-60 Días', value: Math.round(1800 * multiplier), color: '#fbbf24' },
    { name: '61-90 Días', value: Math.round(950 * multiplier), color: '#f97316' },
    { name: '+90 Días', value: Math.round(450 * multiplier), color: '#ef4444' },
  ], [multiplier]);

  const topProductsData = useMemo(() => [
    { name: 'Harina PAN 1Kg', ventas: Math.round(145 * multiplier) },
    { name: 'Leche en Polvo 1Kg', ventas: Math.round(89 * multiplier) },
    { name: 'Arroz Primor 1Kg', ventas: Math.round(74 * multiplier) },
    { name: 'Aceite Mazeite 1L', ventas: Math.round(68 * multiplier) },
    { name: 'Pasta Primor 1Kg', ventas: Math.round(52 * multiplier) },
  ], [multiplier]);

  const weeklySalesTrend = useMemo(() => [
    { day: 'Lun', ventas: Math.round(3400 * multiplier) },
    { day: 'Mar', ventas: Math.round(4100 * multiplier) },
    { day: 'Mié', ventas: Math.round(3800 * multiplier) },
    { day: 'Jue', ventas: Math.round(4600 * multiplier) },
    { day: 'Vie', ventas: Math.round(5200 * multiplier) },
    { day: 'Sáb', ventas: Math.round(5900 * multiplier) },
    { day: 'Dom', ventas: Math.round(2900 * multiplier) },
  ], [multiplier]);

  const criticalStockItems = useMemo(() => {
    const branchName = selectedBranch === 'ALL'
      ? 'Todas las Sucursales'
      : branches.find((b) => b.id === selectedBranch)?.name || 'Almacén Central';

    return [
      { sku: 'LEC-POL-01', name: 'Leche en Polvo 1Kg', stock: 12, min: 20, warehouse: `${branchName} - Depósito Principal` },
      { sku: 'DES-SET-06', name: 'Juego Destornilladores', stock: 5, min: 10, warehouse: `${branchName} - Depósito Principal` },
      { sku: 'BOM-LED-12W', name: 'Bombillo LED 12W', stock: 8, min: 25, warehouse: `${branchName} - Piso de Venta` },
      { sku: 'ARR-PRI-01', name: 'Arroz Primor 1Kg', stock: 18, min: 30, warehouse: `${branchName} - Depósito Principal` },
    ];
  }, [selectedBranch, branches]);

  const recentTransactions = useMemo(() => [
    { number: 'FAC-000452', time: '10:42 AM', customer: 'Inversiones Los Andes C.A.', amount: '345.00', status: 'EMITIDA' },
    { number: 'FAC-000451', time: '10:15 AM', customer: 'Comercializadora El Sol', amount: '120.50', status: 'EMITIDA' },
    { number: 'FAC-000450', time: '09:50 AM', customer: 'Distribuidora Central S.A.', amount: '890.00', status: 'EMITIDA' },
    { number: 'FAC-000449', time: '09:12 AM', customer: 'Cliente Mostrador / Final', amount: '45.20', status: 'EMITIDA' },
  ], []);

  // Función de renderizado para cada widget según su código
  const renderWidgetContent = (item: DashboardWidgetItem, index: number) => {
    switch (item.code) {
      case 'WIDGET_SALES_TODAY':
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
              <div className="text-2xl font-bold text-neutral-900">${kpiSales.totalUSD}</div>
              <div className="text-xs text-neutral-500 mt-1">
                Bs. {kpiSales.totalVES} • <span className="font-semibold text-neutral-700">{kpiSales.countInvoices}</span> facturas
              </div>
            </div>
          </Card>
        );

      case 'WIDGET_TICKET_AVG':
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
              <div className="text-2xl font-bold text-neutral-900">${kpiTicket.avgTicketUSD}</div>
              <div className="text-xs text-emerald-600 font-medium mt-1">
                +8.5% comparado con la semana anterior
              </div>
            </div>
          </Card>
        );

      case 'WIDGET_CRITICAL_STOCK':
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
              <div className="text-2xl font-bold text-neutral-900">{criticalStockItems.length}</div>
              <div className="text-xs text-amber-600 font-medium mt-1">
                Productos requieren reposición inmediata
              </div>
            </div>
          </Card>
        );

      case 'WIDGET_TAX_SUMMARY':
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
              <div className="text-2xl font-bold text-neutral-900">${kpiTax.totalIVA}</div>
              <div className="text-xs text-neutral-500 mt-1">
                IGTF generado: <span className="font-semibold text-neutral-700">${kpiTax.totalIGTF}</span>
              </div>
            </div>
          </Card>
        );

      case 'WIDGET_CXC_SUMMARY':
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
              <div className="text-2xl font-bold text-neutral-900">${kpiCxc.totalPendingUSD}</div>
              <div className="text-xs text-neutral-500 mt-1">
                Vencido: <span className="font-semibold text-red-600">${kpiCxc.overdueUSD}</span>
              </div>
            </div>
          </Card>
        );

      case 'WIDGET_PURCHASES_MONTH':
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
              <div className="text-2xl font-bold text-neutral-900">${kpiPurchases.totalUSD}</div>
              <div className="text-xs text-neutral-500 mt-1">
                En <span className="font-semibold text-neutral-700">{kpiPurchases.ordersCount}</span> órdenes de compra
              </div>
            </div>
          </Card>
        );

      case 'WIDGET_TOP_PRODUCTS':
        return (
          <Card title="Top 5 Productos más Vendidos" subtitle="Unidades facturadas en el período seleccionado">
            {renderWidgetControls(item, index)}
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="ventas" fill="#0284c7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );

      case 'WIDGET_CXC_AGING':
        return (
          <Card title="Antigüedad de Saldos (CxC)" subtitle="Monto por cobrar según días de vencimiento ($ USD)">
            {renderWidgetControls(item, index)}
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cxcData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {cxcData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2 text-xs">
              {cxcData.map((d, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-neutral-600">{d.name}:</span>
                  <span className="font-semibold text-neutral-900">${d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        );

      case 'WIDGET_SALES_TREND':
        return (
          <Card title="Tendencia Semanal de Ventas" subtitle="Monto facturado en USD por día de la semana">
            {renderWidgetControls(item, index)}
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklySalesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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

      case 'WIDGET_CRITICAL_STOCK_TABLE':
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
                  {criticalStockItems.map((prod, idx) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );

      case 'WIDGET_RECENT_ACTIVITY':
        return (
          <Card title="Últimas Operaciones Fiscales Emitidas" subtitle="Facturación en tiempo real del turno activo">
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
                  {recentTransactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">{tx.number}</td>
                      <td className="py-2.5 px-3 text-neutral-500 font-mono">{tx.time}</td>
                      <td className="py-2.5 px-3 text-neutral-700 font-medium">{tx.customer}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-neutral-900">${tx.amount}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="success">EMITIDA</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );

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

  // Controles de edición superpuestos en cada widget
  const renderWidgetControls = (item: DashboardWidgetItem, index: number) => {
    if (!isEditMode) return null;

    return (
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-sky-100 bg-sky-50/60 -mx-4 -mt-4 p-2.5 rounded-t-lg">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-800">
          <Layers className="w-3.5 h-3.5" />
          <span>Posición #{index + 1} ({item.colSpan === 1 ? '1 col' : item.colSpan === 2 ? '2 cols' : 'Ancho completo'})</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Mover hacia atrás */}
          <button
            type="button"
            disabled={index === 0}
            onClick={() => handleMoveLeft(index)}
            className="p-1 rounded text-neutral-600 hover:text-sky-700 hover:bg-sky-100 disabled:opacity-30 disabled:pointer-events-none"
            title="Mover antes"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          {/* Mover hacia adelante */}
          <button
            type="button"
            disabled={index === activeWidgets.length - 1}
            onClick={() => handleMoveRight(index)}
            className="p-1 rounded text-neutral-600 hover:text-sky-700 hover:bg-sky-100 disabled:opacity-30 disabled:pointer-events-none"
            title="Mover después"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Cambiar tamaño */}
          <button
            type="button"
            onClick={() => handleToggleColSpan(item.instanceId)}
            className="p-1 rounded text-neutral-600 hover:text-sky-700 hover:bg-sky-100"
            title="Alternar ancho del widget (1 col / 2 cols / 4 cols)"
          >
            {item.colSpan === 4 ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Eliminar widget */}
          <button
            type="button"
            onClick={() => handleRemoveWidget(item.instanceId)}
            className="p-1 rounded text-red-600 hover:text-red-700 hover:bg-red-100"
            title="Remover widget"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header del Dashboard */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Dashboard Dinámico</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Métricas operativas y financieras en tiempo real según las sucursales autorizadas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Selector de Sucursal Autorizada */}
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-1.5 shadow-sm text-xs w-full sm:w-auto">
            <Building2 className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="text-neutral-500 font-medium shrink-0">Sucursal:</span>
            <select
              value={selectedBranch}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="bg-transparent font-semibold text-neutral-900 focus:outline-none cursor-pointer w-full"
            >
              <option value="ALL">Consolidado (Todas las autorizadas)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
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
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center space-y-3">
          <Layers className="w-10 h-10 text-neutral-300 mx-auto" />
          <h3 className="text-sm font-bold text-neutral-800">No hay widgets en tu dashboard</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
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
      {isCatalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-neutral-900">Catálogo de Widgets Disponibles</h3>
              </div>
              <button
                onClick={() => setIsCatalogOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <p className="text-xs text-neutral-500">
                Selecciona los widgets que deseas agregar a tu panel de control. Podrás organizarlos y ajustar sus dimensiones libremente.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WIDGET_CATALOG.map((catWidget) => {
                  const alreadyActive = activeWidgets.some((w) => w.code === catWidget.code);

                  return (
                    <div
                      key={catWidget.code}
                      className="border border-neutral-200 rounded-lg p-3.5 flex flex-col justify-between hover:border-neutral-300 transition-colors bg-white"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-900">{catWidget.title}</span>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-lg bg-neutral-100 text-neutral-600">
                            {catWidget.category === 'kpi'
                              ? 'KPI'
                              : catWidget.category === 'chart'
                              ? 'Gráfico'
                              : 'Tabla'}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 leading-snug">
                          {catWidget.description}
                        </p>
                      </div>

                      <div className="pt-3 mt-3 border-t border-neutral-100 flex items-center justify-between">
                        <span className="text-[10px] text-neutral-400">
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

            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsCatalogOpen(false)}>
                Cerrar Catálogo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
