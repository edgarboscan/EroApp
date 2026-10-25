import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  DollarSign,
  ShoppingCart,
  CreditCard,
  Building2,
  TrendingUp,
  User,
  Package,
  Layers,
  ArrowUpDown,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Eye,
  Printer,
  ExternalLink,
  X,
  FileDown,
  Coins,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import {
  formatMoneyUSD,
  formatMoneyVES,
  formatNumber,
  formatCurrency,
} from '@ero/shared';

type ReportTab =
  | 'sales'
  | 'cash_shifts'
  | 'sales_by_product'
  | 'sales_by_cashier'
  | 'sales_book'
  | 'restaurant_tips';

export const ReportsView: React.FC = () => {
  const { token, activeBranchId } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');

  // Filtros Globales
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [isDetailed, setIsDetailed] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // Estados de datos de reportes
  const [salesData, setSalesData] = useState<any>(null);
  const [shiftsData, setShiftsData] = useState<any>(null);
  const [productData, setProductData] = useState<any[]>([]);
  const [cashierData, setCashierData] = useState<any[]>([]);
  const [salesBookData, setSalesBookData] = useState<any[]>([]);
  const [restaurantTipsData, setRestaurantTipsData] = useState<any>(null);
  const [selectedWaiter, setSelectedWaiter] = useState<string>('all');
  const [tipsViewMode, setTipsViewMode] = useState<'summary' | 'detailed'>('summary');

  // Estado para el visor de PDF interactivo
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  useEffect(() => {
    loadActiveReport();
  }, [activeTab, startDate, endDate, selectedMethod, selectedWaiter, activeBranchId]);

  const loadActiveReport = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const branchParam = activeBranchId ? `&branchId=${activeBranchId}` : '';
      const methodParam = selectedMethod !== 'all' ? `&paymentMethod=${selectedMethod}` : '';

      if (activeTab === 'sales') {
        const url = `/api/reports/sales?startDate=${startDate}&endDate=${endDate}${branchParam}${methodParam}&detailed=true`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setSalesData(json.data);
        }
      } else if (activeTab === 'cash_shifts') {
        const url = `/api/reports/cash-shifts?startDate=${startDate}&endDate=${endDate}${branchParam}&detailed=true`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setShiftsData(json.data);
        }
      } else if (activeTab === 'sales_by_product') {
        const url = `/api/reports/sales-by-product?startDate=${startDate}&endDate=${endDate}${branchParam}&limit=50`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) setProductData(json.data);
        }
      } else if (activeTab === 'sales_by_cashier') {
        const url = `/api/reports/sales-by-cashier?startDate=${startDate}&endDate=${endDate}${branchParam}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) setCashierData(json.data);
        }
      } else if (activeTab === 'sales_book') {
        const period = startDate.slice(0, 7);
        const url = `/api/reports/sales-book?period=${period}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) setSalesBookData(json.data);
        }
      } else if (activeTab === 'restaurant_tips') {
        const waiterParam = selectedWaiter !== 'all' ? `&waiterName=${encodeURIComponent(selectedWaiter)}` : '';
        const url = `/api/reports/restaurant-tips?startDate=${startDate}&endDate=${endDate}${branchParam}${waiterParam}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setRestaurantTipsData(json.data);
        }
      }
    } catch {
      toast.error('Error al consultar datos del reporte');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const branchParam = activeBranchId ? `&branchId=${activeBranchId}` : '';
      const methodParam = selectedMethod !== 'all' ? `&paymentMethod=${selectedMethod}` : '';
      let endpoint = '';

      if (activeTab === 'sales') {
        endpoint = `/api/reports/sales?startDate=${startDate}&endDate=${endDate}${branchParam}${methodParam}&detailed=${isDetailed}&export=${format}`;
      } else if (activeTab === 'cash_shifts') {
        endpoint = `/api/reports/cash-shifts?startDate=${startDate}&endDate=${endDate}${branchParam}&detailed=${isDetailed}&export=${format}`;
      } else if (activeTab === 'sales_by_product') {
        endpoint = `/api/reports/sales-by-product?startDate=${startDate}&endDate=${endDate}${branchParam}&export=${format}`;
      } else if (activeTab === 'sales_by_cashier') {
        endpoint = `/api/reports/sales-by-cashier?startDate=${startDate}&endDate=${endDate}${branchParam}&export=${format}`;
      } else if (activeTab === 'sales_book') {
        const period = startDate.slice(0, 7);
        endpoint = `/api/reports/sales-book?period=${period}&export=${format}`;
      } else if (activeTab === 'restaurant_tips') {
        const waiterParam = selectedWaiter !== 'all' ? `&waiterName=${encodeURIComponent(selectedWaiter)}` : '';
        endpoint = `/api/reports/restaurant-tips?startDate=${startDate}&endDate=${endDate}${branchParam}${waiterParam}&export=${format}`;
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(endpoint, { headers });
      if (!res.ok) throw new Error('Error al descargar archivo');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${activeTab}_${startDate}_a_${endDate}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Reporte descargado en formato ${format.toUpperCase()}`);
    } catch {
      toast.error('No se pudo generar la exportación');
    } finally {
      setExporting(false);
    }
  };

  const getPdfEndpoint = () => {
    const branchParam = activeBranchId ? `&branchId=${activeBranchId}` : '';
    const methodParam = selectedMethod !== 'all' ? `&paymentMethod=${selectedMethod}` : '';
    let endpoint = '';

    if (activeTab === 'sales') {
      endpoint = `/api/reports/sales?startDate=${startDate}&endDate=${endDate}${branchParam}${methodParam}&detailed=${isDetailed}&format=pdf`;
    } else if (activeTab === 'cash_shifts') {
      endpoint = `/api/reports/cash-shifts?startDate=${startDate}&endDate=${endDate}${branchParam}&detailed=${isDetailed}&format=pdf`;
    } else if (activeTab === 'sales_by_product') {
      endpoint = `/api/reports/sales-by-product?startDate=${startDate}&endDate=${endDate}${branchParam}&format=pdf`;
    } else if (activeTab === 'sales_by_cashier') {
      endpoint = `/api/reports/sales-by-cashier?startDate=${startDate}&endDate=${endDate}${branchParam}&format=pdf`;
    } else if (activeTab === 'sales_book') {
      const period = startDate.slice(0, 7);
      endpoint = `/api/reports/sales-book?period=${period}&format=pdf`;
    } else if (activeTab === 'restaurant_tips') {
      const waiterParam = selectedWaiter !== 'all' ? `&waiterName=${encodeURIComponent(selectedWaiter)}` : '';
      endpoint = `/api/reports/restaurant-tips?startDate=${startDate}&endDate=${endDate}${branchParam}${waiterParam}&format=pdf`;
    }
    return endpoint;
  };

  const getReportName = () => {
    switch (activeTab) {
      case 'sales':
        return isDetailed ? 'Reporte_Ventas_Detallado' : 'Reporte_Ventas_Resumido';
      case 'cash_shifts':
        return isDetailed ? 'Reporte_Cierres_Caja_Detallado' : 'Reporte_Cierres_Caja_Resumido';
      case 'sales_by_product':
        return 'Reporte_Ventas_Por_Producto';
      case 'sales_by_cashier':
        return 'Reporte_Desempeno_Cajeros';
      case 'sales_book':
        return `Libro_Ventas_SENIAT_${startDate.slice(0, 7)}`;
      case 'restaurant_tips':
        return 'Reporte_Propinas_Restaurante';
      default:
        return 'Reporte_ERP';
    }
  };

  const handleOpenPdfViewer = () => {
    setIsPdfModalOpen(true);
  };

  const handleDownloadPdf = () => {
    window.open(getPdfEndpoint(), '_blank');
  };

  // Filtrado de búsqueda en memoria para tablas
  const filteredSalesInvoices = (salesData?.invoices || []).filter((inv: any) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(s) ||
      inv.customer_name?.toLowerCase().includes(s) ||
      inv.customer_doc?.toLowerCase().includes(s) ||
      inv.cashier_name?.toLowerCase().includes(s) ||
      inv.cash_register_code?.toLowerCase().includes(s)
    );
  });

  const filteredCashShifts = (shiftsData?.shifts || []).filter((s: any) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.cash_register_code?.toLowerCase().includes(q) ||
      s.cashier_name?.toLowerCase().includes(q) ||
      s.branch_name?.toLowerCase().includes(q) ||
      s.notes?.toLowerCase().includes(q) ||
      s.deposit_reference_ves?.toLowerCase().includes(q) ||
      s.deposit_reference_usd?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Centro de Reportes Gerenciales & Fiscales
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Auditoría de ventas, cierres de caja, lotes de punto de venta y libros fiscales SENIAT
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenPdfViewer}
            disabled={loading}
            className="bg-sky-600 hover:bg-sky-700 text-white font-medium"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Ver PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={loading}
          >
            <FileDown className="w-3.5 h-3.5 mr-1.5 text-neutral-600 dark:text-neutral-400" />
            Descargar PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
          >
            <FileText className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
          >
            <Download className="w-3.5 h-3.5 mr-1 text-neutral-500" />
            CSV
          </Button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-neutral-200 gap-6 text-xs font-semibold overflow-x-auto">
        {[
          { id: 'sales', label: 'Reporte de Ventas (Resumido y Detallado)', icon: ShoppingCart },
          { id: 'cash_shifts', label: 'Cierres de Caja & Arqueos (X / Z)', icon: CreditCard },
          { id: 'sales_by_product', label: 'Ventas por Producto', icon: Package },
          { id: 'sales_by_cashier', label: 'Desempeño por Cajero', icon: User },
          { id: 'sales_book', label: 'Libro de Ventas Fiscal (SENIAT)', icon: FileText },
          { id: 'restaurant_tips', label: 'Propinas Restaurante (Por Mesero)', icon: Coins },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ReportTab);
                setSearchTerm('');
              }}
              className={`flex items-center gap-1.5 pb-3 transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-sky-600 text-sky-700 font-bold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros */}
      <div className="p-3.5 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-mono"
            />
          </div>

          {activeTab === 'sales' && (
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Medio:</span>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs"
              >
                <option value="all">Todos los Medios</option>
                <option value="DEBIT_CARD">Punto Débito (Bs)</option>
                <option value="CREDIT_CARD">Punto Crédito (Bs)</option>
                <option value="PAGO_MOVIL">Pago Móvil (Bs)</option>
                <option value="CASH_USD">Efectivo Divisas ($)</option>
                <option value="CASH_VES">Efectivo Bolívares (Bs)</option>
                <option value="ZELLE">Zelle USD</option>
                <option value="BIOPAGO">Biopago BDV</option>
                <option value="CASHEA">Cashea</option>
              </select>
            </div>
          )}

          {activeTab === 'restaurant_tips' && (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Mesero:</span>
              <select
                value={selectedWaiter}
                onChange={(e) => setSelectedWaiter(e.target.value)}
                className="h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs"
              >
                <option value="all">Todos los Meseros</option>
                {(restaurantTipsData?.byWaiter || []).map((w: any) => (
                  <option key={w.waiterName} value={w.waiterName}>
                    {w.waiterName} ({w.ordersCount})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'restaurant_tips' && (
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-300 dark:border-neutral-700">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Vista:</span>
              <button
                type="button"
                onClick={() => setTipsViewMode('summary')}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  tipsViewMode === 'summary'
                    ? 'bg-sky-600 text-white'
                    : 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                Por Mesero
              </button>
              <button
                type="button"
                onClick={() => setTipsViewMode('detailed')}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  tipsViewMode === 'detailed'
                    ? 'bg-sky-600 text-white'
                    : 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                Detalle Comandas
              </button>
            </div>
          )}

          {(activeTab === 'sales' || activeTab === 'cash_shifts') && (
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-300 dark:border-neutral-700">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Vista:</span>
              <button
                type="button"
                onClick={() => setIsDetailed(false)}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  !isDetailed
                    ? 'bg-sky-600 text-white'
                    : 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                Resumido
              </button>
              <button
                type="button"
                onClick={() => setIsDetailed(true)}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  isDetailed
                    ? 'bg-sky-600 text-white'
                    : 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                Detallado
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar en resultados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 pr-3 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 w-48 sm:w-64"
            />
          </div>
          <Button size="sm" variant="outline" onClick={loadActiveReport} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Skeletons de Carga */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
          </div>
          <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
        </div>
      ) : (
        <>
          {/* TAB 1: REPORTE DE VENTAS */}
          {activeTab === 'sales' && salesData && (
            <div className="space-y-6">
              {/* KPIs de Ventas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Ventas Totales ($)
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatMoneyUSD(salesData.summary?.totalSalesUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                    {formatMoneyVES(salesData.summary?.totalSalesVES || 0)}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Facturas Emitidas
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatNumber(salesData.summary?.totalInvoices || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Transacciones fiscales</span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Ticket Promedio
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatMoneyUSD(salesData.summary?.averageTicketUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Promedio por cliente</span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    IVA 16% Total
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatMoneyUSD(salesData.summary?.totalIvaUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Débito Fiscal SENIAT</span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    IGTF 3% Total
                  </span>
                  <span className="text-lg font-bold font-mono text-indigo-700 dark:text-indigo-400 block mt-0.5">
                    {formatMoneyUSD(salesData.summary?.totalIgtfUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Moneda extranjera</span>
                </div>
              </div>

              {/* Desglose por Medio de Pago */}
              {salesData.summary?.paymentMethods && salesData.summary.paymentMethods.length > 0 && (
                <div className="p-3.5 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
                    Recaudación Desglosada por Forma de Pago:
                  </span>
                  <br />
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {salesData.summary.paymentMethods.map((pm: any) => (
                      <div
                        key={pm.method}
                        className="p-2.5 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs"
                      >
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300 block text-[11px] truncate">
                          {pm.method === 'DEBIT_CARD' ? 'Punto Débito (Bs)' :
                           pm.method === 'CREDIT_CARD' ? 'Punto Crédito (Bs)' :
                           pm.method === 'PAGO_MOVIL' ? 'Pago Móvil (Bs)' :
                           pm.method === 'CASH_USD' ? 'Efectivo Divisas ($)' :
                           pm.method === 'CASH_VES' ? 'Efectivo Bs' :
                           pm.method === 'ZELLE' ? 'Zelle ($)' : pm.method}
                        </span>
                        <span className="font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                          {formatMoneyUSD(pm.totalUSD)}
                        </span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono block">
                          {formatMoneyVES(pm.totalVES)}
                        </span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">
                          {pm.count} transacciones
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contenido: Modo Resumido (Día por Día) o Modo Detallado (Factura por Factura) */}
              {!isDetailed ? (
                <Card
                  title="Resumen Diario de Ventas"
                  subtitle="Totales consolidados por fecha, base gravada, IVA e IGTF"
                >
                  <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3 text-center">N° Facturas</th>
                          <th className="py-2.5 px-3 text-right">Base Exenta ($)</th>
                          <th className="py-2.5 px-3 text-right">Base Imponible ($)</th>
                          <th className="py-2.5 px-3 text-right">IVA 16% ($)</th>
                          <th className="py-2.5 px-3 text-right">IGTF 3% ($)</th>
                          <th className="py-2.5 px-3 text-right">Total ($)</th>
                          <th className="py-2.5 px-3 text-right">Total (Bs)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {salesData.dailySummary && salesData.dailySummary.length > 0 ? (
                          salesData.dailySummary.map((d: any) => (
                            <tr key={d.date} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60 font-mono">
                              <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                                {d.date}
                              </td>
                              <td className="py-2.5 px-3 text-center text-neutral-700 dark:text-neutral-300">{d.invoicesCount}</td>
                              <td className="py-2.5 px-3 text-right text-neutral-600 dark:text-neutral-400">
                                {formatMoneyUSD(d.exemptUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-neutral-600 dark:text-neutral-400">
                                {formatMoneyUSD(d.taxableUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-neutral-700 dark:text-neutral-300 font-medium">
                                {formatMoneyUSD(d.ivaUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400 font-medium">
                                {formatMoneyUSD(d.igtfUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-neutral-900 dark:text-neutral-100">
                                {formatMoneyUSD(d.totalUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-sky-800 dark:text-sky-400">
                                {formatMoneyVES(d.totalVES)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                              No hay ventas registradas en el período seleccionado
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card
                  title={`Detalle de Facturas Emitidas (${filteredSalesInvoices.length})`}
                  subtitle="Auditoría individual por cliente, caja, cajero y forma de pago"
                >
                  <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Fecha / Hora</th>
                          <th className="py-2.5 px-3">N° Factura</th>
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Caja / Cajero</th>
                          <th className="py-2.5 px-3">Formas de Pago</th>
                          <th className="py-2.5 px-3 text-right">Base ($)</th>
                          <th className="py-2.5 px-3 text-right">IVA ($)</th>
                          <th className="py-2.5 px-3 text-right">Total ($)</th>
                          <th className="py-2.5 px-3 text-right">Total (Bs)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {filteredSalesInvoices.length > 0 ? (
                          filteredSalesInvoices.map((inv: any) => (
                            <tr key={inv.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                              <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400 font-mono text-[11px] whitespace-nowrap">
                                {new Date(inv.emission_date).toLocaleString('es-VE')}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                {inv.invoice_number}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-neutral-900 dark:text-neutral-100 block truncate max-w-[140px]">
                                  {inv.customer_name}
                                </span>
                                <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400">
                                  {inv.customer_doc}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-medium text-neutral-800 dark:text-neutral-200 block">
                                  {inv.cash_register_code || 'POS'}
                                </span>
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate block">
                                  {inv.cashier_name}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-wrap gap-1 max-w-[180px]">
                                  {inv.payments && inv.payments.length > 0 ? (
                                    inv.payments.map((p: any, idx: number) => (
                                      <span
                                        key={idx}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                                      >
                                        {p.method}: {formatMoneyUSD(p.amountUSD)}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-neutral-400 dark:text-neutral-500 text-[10px]">Sin registro</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                {formatMoneyUSD(inv.taxableUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                                {formatMoneyUSD(inv.ivaUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                {formatMoneyUSD(inv.totalUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800 dark:text-sky-400">
                                {formatMoneyVES(inv.totalVES)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                              No se encontraron facturas con los filtros aplicados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB 2: CIERRES DE TURNO DE CAJA & ARQUEOS */}
          {activeTab === 'cash_shifts' && shiftsData && (
            <div className="space-y-6">
              {/* KPIs de Cierres */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Turnos Realizados
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {shiftsData.summary?.totalShifts || 0}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {shiftsData.summary?.totalClosedShifts || 0} cerrados • {shiftsData.summary?.totalOpenShifts || 0} en curso
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Lotes POS Consolidados
                  </span>
                  <span className="text-lg font-bold font-mono text-sky-700 dark:text-sky-400 block mt-0.5">
                    {formatMoneyVES(shiftsData.summary?.totalPOSBatchVES || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Puntos de venta (Débito + Crédito)</span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Total Recaudado (VES)
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatMoneyVES(shiftsData.summary?.totalCollectedVES || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Efectivo + POS + Pago Móvil</span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Total Recaudado ($)
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatMoneyUSD(shiftsData.summary?.totalCollectedUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Efectivo $ + Zelle</span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Depósitos Bancarios Registrados
                  </span>
                  <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 block mt-0.5">
                    {formatMoneyVES(shiftsData.summary?.totalDepositedVES || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                    {formatMoneyUSD(shiftsData.summary?.totalDepositedUSD || 0)}
                  </span>
                </div>
              </div>

              {/* Tabla de Cierres de Turno y Arqueos */}
              <Card
                title={`Historial de Turnos de Caja & Arqueos (${filteredCashShifts.length})`}
                subtitle="Control de lotes POS, depósitos en bancos de tesorería y cuadres de caja"
              >
                <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Caja / Cajero</th>
                        <th className="py-2.5 px-3">Apertura / Cierre</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3 text-right">Lote POS (Bs)</th>
                        <th className="py-2.5 px-3 text-right">Total Recaudado</th>
                        <th className="py-2.5 px-3">Depósito Bancario (VES)</th>
                        <th className="py-2.5 px-3">Depósito Bancario (USD)</th>
                        <th className="py-2.5 px-3 text-center">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredCashShifts.length > 0 ? (
                        filteredCashShifts.map((s: any) => {
                          const diffUSD = s.difference_usd ?? 0;
                          const diffVES = s.difference_ves ?? 0;
                          const isBalanced = Math.abs(diffUSD) < 0.01 && Math.abs(diffVES) < 0.01;

                          return (
                            <tr key={s.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block font-mono">
                                  {s.cash_register_code}
                                </span>
                                <span className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium block">
                                  {s.cashier_name}
                                </span>
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block">
                                  {s.branch_name}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px]">
                                <span className="text-neutral-700 dark:text-neutral-300 block">
                                  Inic: {new Date(s.opened_at).toLocaleTimeString('es-VE')} ({new Date(s.opened_at).toLocaleDateString('es-VE')})
                                </span>
                                {s.closed_at ? (
                                  <span className="text-neutral-500 dark:text-neutral-400 block">
                                    Cierr: {new Date(s.closed_at).toLocaleTimeString('es-VE')}
                                  </span>
                                ) : (
                                  <span className="text-sky-600 dark:text-sky-400 font-semibold block">En Operación</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge variant={s.status === 'CLOSED' ? 'neutral' : 'success'}>
                                  {s.status === 'CLOSED' ? 'CERRADO' : 'ABIERTO'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800 dark:text-sky-400">
                                {formatMoneyVES(s.posBatchVES || 0)}
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block font-normal">
                                  Déb: {formatMoneyVES(s.debitVES || 0)} • Créd: {formatMoneyVES(s.creditVES || 0)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                  {formatMoneyVES(s.totalCollectedVES || 0)}
                                </span>
                                <span className="text-[11px] text-neutral-600 dark:text-neutral-400 block">
                                  {formatMoneyUSD(s.totalCollectedUSD || 0)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                {s.deposit_amount_ves > 0 ? (
                                  <div className="text-[11px]">
                                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400 block">
                                      {formatMoneyVES(s.deposit_amount_ves)}
                                    </span>
                                    <span className="text-neutral-600 dark:text-neutral-400 block">
                                      {s.deposit_bank_name_ves || 'Banco'} {s.deposit_account_ves ? `(${s.deposit_account_ves.slice(-4)})` : ''}
                                    </span>
                                    {s.deposit_reference_ves && (
                                      <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400 block">
                                        Ref: {s.deposit_reference_ves}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">Sin depósito</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {s.deposit_amount_usd > 0 ? (
                                  <div className="text-[11px]">
                                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400 block">
                                      {formatMoneyUSD(s.deposit_amount_usd)}
                                    </span>
                                    <span className="text-neutral-600 dark:text-neutral-400 block">
                                      {s.deposit_bank_name_usd || 'Custodia USD'}
                                    </span>
                                    {s.deposit_reference_usd && (
                                      <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400 block">
                                        Ref: {s.deposit_reference_usd}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">Sin depósito</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {s.status === 'CLOSED' ? (
                                  <Badge variant={isBalanced ? 'success' : 'danger'}>
                                    {isBalanced
                                      ? 'Cuadrado'
                                      : `${diffUSD !== 0 ? formatMoneyUSD(diffUSD) : ''} ${diffVES !== 0 ? formatMoneyVES(diffVES) : ''}`}
                                  </Badge>
                                ) : (
                                  <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">En curso</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                            No hay turnos registrados en este rango de fechas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 3: VENTAS POR PRODUCTO */}
          {activeTab === 'sales_by_product' && (
            <Card
              title={`Ranking de Ventas por Producto (${productData.length} productos)`}
              subtitle="Top de rotación, unidades facturadas y márgenes de contribución"
            >
              <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3 text-center">Unidades</th>
                      <th className="py-2.5 px-3 text-right">Precio Promedio ($)</th>
                      <th className="py-2.5 px-3 text-right">Total Facturado ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {productData.length > 0 ? (
                      productData.map((p, idx) => (
                        <tr key={p.product_id || idx} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                          <td className="py-2.5 px-3 font-mono text-neutral-400 dark:text-neutral-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                            {p.sku}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                            {p.product_name}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                            {p.category_name || 'General'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-700 dark:text-sky-400">
                            {formatNumber(p.total_units || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                            {formatMoneyUSD(p.average_price_usd || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                            {formatMoneyUSD(p.total_sales_usd || 0)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                          No hay registros de ventas para productos en el período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 4: DESEMPEÑO POR CAJERO */}
          {activeTab === 'sales_by_cashier' && (
            <Card
              title={`Rendimiento por Cajero (${cashierData.length} cajeros)`}
              subtitle="Turnos operados, facturas procesadas, ventas totales y recaudación en POS"
            >
              <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Cajero / Operador</th>
                      <th className="py-2.5 px-3 text-center">Turnos Realizados</th>
                      <th className="py-2.5 px-3 text-center">Facturas Emitidas</th>
                      <th className="py-2.5 px-3 text-right">Lote POS (Bs)</th>
                      <th className="py-2.5 px-3 text-right">Ticket Promedio ($)</th>
                      <th className="py-2.5 px-3 text-right">Venta Total ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {cashierData.length > 0 ? (
                      cashierData.map((c, idx) => (
                        <tr key={c.cashier_id || idx} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                              {c.cashier_name}
                            </span>
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                              ID: {c.cashier_id?.slice(0, 8)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-neutral-700 dark:text-neutral-300">
                            {c.total_shifts || 0}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-700 dark:text-sky-400">
                            {c.total_invoices || 0}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800 dark:text-sky-400">
                            {formatMoneyVES(c.pos_batch_ves || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                            {formatMoneyUSD(c.average_ticket_usd || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                            {formatMoneyUSD(c.total_sales_usd || 0)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                          No hay actividades de cajeros en el período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 5: LIBRO DE VENTAS SENIAT */}
          {activeTab === 'sales_book' && (
            <Card
              title={`Libro de Ventas Fiscal - Período ${startDate.slice(0, 7)}`}
              subtitle="Formato oficial exigido por el SENIAT para Contribuyentes Especiales y Ordinarios"
            >
              <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">RIF / Cédula</th>
                      <th className="py-2.5 px-3">Razón Social</th>
                      <th className="py-2.5 px-3">N° Factura</th>
                      <th className="py-2.5 px-3">N° Control</th>
                      <th className="py-2.5 px-3 text-right">Total ($)</th>
                      <th className="py-2.5 px-3 text-right">Exento</th>
                      <th className="py-2.5 px-3 text-right">Base Imponible</th>
                      <th className="py-2.5 px-3 text-right">IVA (16%)</th>
                      <th className="py-2.5 px-3 text-right">IGTF (3%)</th>
                      <th className="py-2.5 px-3 text-right">IVA Retenido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {salesBookData.length > 0 ? (
                      salesBookData.map((r, idx) => (
                        <tr key={r.id || idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                          <td className="py-2.5 px-3 font-mono text-neutral-600 dark:text-neutral-400">{r.row_num || idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">{r.emission_date?.slice(0, 10)}</td>
                          <td className="py-2.5 px-3 font-mono font-medium text-neutral-700 dark:text-neutral-300">{r.customer_rif || r.rif}</td>
                          <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">{r.customer_name || r.name}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">{r.invoice_number}</td>
                          <td className="py-2.5 px-3 font-mono text-neutral-500 dark:text-neutral-400">{r.control_number || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-neutral-900 dark:text-neutral-100">{formatMoneyUSD(Number(r.total_amount || r.total || 0))}</td>
                          <td className="py-2.5 px-3 text-right text-neutral-600 dark:text-neutral-400">{formatMoneyUSD(Number(r.exempt_amount || r.exempt || 0))}</td>
                          <td className="py-2.5 px-3 text-right text-neutral-600 dark:text-neutral-400">{formatMoneyUSD(Number(r.taxable_amount || r.taxable || 0))}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-neutral-800 dark:text-neutral-200">{formatMoneyUSD(Number(r.tax_amount || r.iva || 0))}</td>
                          <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400 font-medium">{formatMoneyUSD(Number(r.igtf_amount || r.igtf || 0))}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatMoneyUSD(Number(r.retained_amount || r.retained || 0))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                          No hay operaciones registradas en el Libro de Ventas para este período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 6: REPORTE DE PROPINAS DE RESTAURANTE */}
          {activeTab === 'restaurant_tips' && restaurantTipsData && (
            <div className="space-y-6">
              {/* KPIs de Propinas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-amber-200 dark:border-amber-900/60">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Total Propinas ($)
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 block mt-0.5">
                    {formatMoneyUSD(restaurantTipsData.summary?.totalTipsUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                    {formatMoneyVES(restaurantTipsData.summary?.totalTipsVES || 0)}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Comandas con Propina
                  </span>
                  <span className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatNumber(restaurantTipsData.summary?.totalOrdersWithTip || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    de {restaurantTipsData.summary?.totalOrders || 0} comandas cerradas
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Consumo Total Comandas
                  </span>
                  <span className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatMoneyUSD(restaurantTipsData.summary?.totalConsumptionUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Ventas de salón registradas
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
                    Meseros Activos
                  </span>
                  <span className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 block mt-0.5">
                    {(restaurantTipsData.byWaiter || []).length}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Usuarios con propinas
                  </span>
                </div>
              </div>

              {/* Vista: Resumen por Mesero */}
              {tipsViewMode === 'summary' && (
                <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800">
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      Consolidado de Propinas por Mesero / Usuario
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      {restaurantTipsData.byWaiter?.length || 0} meseros en período
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-100/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider font-semibold border-b border-neutral-200 dark:border-neutral-700">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Mesero / Usuario Comanda</th>
                          <th className="py-2.5 px-3 text-center">Comandas</th>
                          <th className="py-2.5 px-3 text-right">Consumo Generado ($)</th>
                          <th className="py-2.5 px-3 text-right">Total Propinas ($)</th>
                          <th className="py-2.5 px-3 text-right">Total Propinas (Bs)</th>
                          <th className="py-2.5 px-3 text-right">Promedio / Comanda</th>
                          <th className="py-2.5 px-3 text-right">% del Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {(restaurantTipsData.byWaiter || []).length > 0 ? (
                          (restaurantTipsData.byWaiter || [])
                            .filter((w: any) =>
                              searchTerm
                                ? w.waiterName?.toLowerCase().includes(searchTerm.toLowerCase())
                                : true
                            )
                            .map((w: any, idx: number) => {
                              const grandTotal = Number(restaurantTipsData.summary?.totalTipsUSD || 0);
                              const pct = grandTotal > 0 ? ((w.totalTipsUSD / grandTotal) * 100).toFixed(1) : '0.0';
                              return (
                                <tr key={w.waiterName || idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                                  <td className="py-2.5 px-3 font-mono text-neutral-500 dark:text-neutral-400">{idx + 1}</td>
                                  <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-neutral-400" />
                                    <span>{w.waiterName}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono font-medium">{w.ordersCount}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                                    {formatMoneyUSD(w.totalConsumptionUSD || 0)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                                    {formatMoneyUSD(w.totalTipsUSD || 0)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                    {formatMoneyVES(w.totalTipsVES || 0)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                    {formatMoneyUSD(w.averageTipUSD || 0)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono">
                                    <Badge variant="neutral" className="text-[10px] font-bold">
                                      {pct}%
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                              No hay propinas registradas para el período seleccionado
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Vista: Detalle por Comanda */}
              {tipsViewMode === 'detailed' && (
                <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800">
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      Detalle de Comandas con Propinas
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      {restaurantTipsData.orders?.length || 0} comandas listadas
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-100/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider font-semibold border-b border-neutral-200 dark:border-neutral-700">
                        <tr>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Comanda</th>
                          <th className="py-2.5 px-3">Mesa / Zona</th>
                          <th className="py-2.5 px-3">Mesero / Creador</th>
                          <th className="py-2.5 px-3">Factura POS</th>
                          <th className="py-2.5 px-3 text-right">Consumo Mesa ($)</th>
                          <th className="py-2.5 px-3 text-right">Propina ($)</th>
                          <th className="py-2.5 px-3 text-right">Propina (Bs)</th>
                          <th className="py-2.5 px-3 text-center">Estado Factura</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {(restaurantTipsData.orders || []).length > 0 ? (
                          (restaurantTipsData.orders || [])
                            .filter((ord: any) => {
                              if (!searchTerm.trim()) return true;
                              const q = searchTerm.toLowerCase();
                              return (
                                ord.orderNumber?.toLowerCase().includes(q) ||
                                ord.tableName?.toLowerCase().includes(q) ||
                                ord.waiterName?.toLowerCase().includes(q) ||
                                ord.posInvoiceNumber?.toLowerCase().includes(q) ||
                                ord.closedByUserName?.toLowerCase().includes(q)
                              );
                            })
                            .map((ord: any) => (
                              <tr key={ord.closureId || ord.orderId} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                                <td className="py-2.5 px-3 font-mono text-neutral-600 dark:text-neutral-400">
                                  {ord.closedAt ? new Date(ord.closedAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                  {ord.orderNumber}
                                </td>
                                <td className="py-2.5 px-3 text-neutral-700 dark:text-neutral-300">
                                  {ord.tableName} {ord.zone ? `(${ord.zone})` : ''}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                                  {ord.waiterName}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-neutral-600 dark:text-neutral-400">
                                  {ord.posInvoiceNumber || <span className="text-neutral-400 italic">No facturada</span>}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                                  {formatMoneyUSD(ord.consumptionUSD || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                                  {formatMoneyUSD(ord.tipUSD || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                  {formatMoneyVES(ord.tipVES || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {ord.isInvoiced ? (
                                    <Badge variant="success" className="text-[10px]">
                                      Facturado POS
                                    </Badge>
                                  ) : (
                                    <Badge variant="warning" className="text-[10px]">
                                      Cerrada Sin Factura
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                              No se encontraron comandas con propina para el filtro aplicado
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal Visor de Reporte en PDF */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title={getReportName().replace(/_/g, ' ')}
        subtitle={`Orientación: ${
          activeTab === 'sales_book' || (activeTab === 'sales' && isDetailed) || (activeTab === 'cash_shifts' && isDetailed)
            ? 'Horizontal (Landscape)'
            : 'Vertical (Portrait)'
        } • Cumplimiento Fiscal SENIAT`}
        endpoint={getPdfEndpoint()}
        filename={`${getReportName()}_${startDate}_a_${endDate}.pdf`}
      />
    </div>
  );
};

