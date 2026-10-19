import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useEscapeKey } from '../../components/ui/Modal';
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
  | 'sales_book';

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

  // Estados para el visor de PDF interactivo
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState<string>('');
  const [loadingPdf, setLoadingPdf] = useState<boolean>(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    loadActiveReport();
  }, [activeTab, startDate, endDate, selectedMethod, activeBranchId]);

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
      default:
        return 'Reporte_ERP';
    }
  };

  const handleOpenPdfViewer = async () => {
    setLoadingPdf(true);
    setIsPdfModalOpen(true);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    try {
      const endpoint = getPdfEndpoint();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(endpoint, { headers });
      if (!res.ok) throw new Error('Error al generar el documento PDF');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(blobUrl);
      setPdfTitle(getReportName().replace(/_/g, ' '));
    } catch {
      toast.error('No se pudo cargar la vista previa del PDF');
      setIsPdfModalOpen(false);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      const endpoint = getPdfEndpoint();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(endpoint, { headers });
      if (!res.ok) throw new Error('Error al descargar PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getReportName()}_${startDate}_a_${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Documento PDF generado y descargado exitosamente');
    } catch {
      toast.error('No se pudo descargar el archivo PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleClosePdfModal = () => {
    setIsPdfModalOpen(false);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
  };

  const handlePrintPdf = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else if (pdfBlobUrl) {
      const win = window.open(pdfBlobUrl, '_blank');
      win?.print();
    }
  };

  useEscapeKey(handleClosePdfModal, isPdfModalOpen);

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
          <h1 className="text-xl font-bold text-neutral-900">
            Centro de Reportes Gerenciales & Fiscales
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Auditoría de ventas, cierres de caja, lotes de punto de venta y libros fiscales SENIAT
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenPdfViewer}
            disabled={loadingPdf || loading}
            className="bg-sky-600 hover:bg-sky-700 text-white font-medium"
          >
            {loadingPdf ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Eye className="w-3.5 h-3.5 mr-1.5" />
            )}
            Ver PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={exporting || loading}
          >
            <FileDown className="w-3.5 h-3.5 mr-1.5 text-neutral-600" />
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
      <div className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
            <span className="font-medium text-neutral-700">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2 border border-neutral-300 rounded-lg bg-white text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-medium text-neutral-700">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2 border border-neutral-300 rounded-lg bg-white text-xs font-mono"
            />
          </div>

          {activeTab === 'sales' && (
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-neutral-500" />
              <span className="font-medium text-neutral-700">Medio:</span>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="h-8 px-2 border border-neutral-300 rounded-lg bg-white text-xs"
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

          {(activeTab === 'sales' || activeTab === 'cash_shifts') && (
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-300">
              <span className="font-medium text-neutral-700">Vista:</span>
              <button
                type="button"
                onClick={() => setIsDetailed(false)}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  !isDetailed
                    ? 'bg-sky-600 text-white'
                    : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
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
                    : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                Detallado
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar en resultados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 pr-3 border border-neutral-300 rounded-lg text-xs bg-white w-48 sm:w-64"
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
            <div className="h-20 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="h-20 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="h-20 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="h-20 bg-neutral-200 rounded-lg animate-pulse" />
          </div>
          <div className="h-64 bg-neutral-200 rounded-lg animate-pulse" />
        </div>
      ) : (
        <>
          {/* TAB 1: REPORTE DE VENTAS */}
          {activeTab === 'sales' && salesData && (
            <div className="space-y-6">
              {/* KPIs de Ventas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    Ventas Totales ($)
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 block mt-0.5">
                    {formatMoneyUSD(salesData.summary?.totalSalesUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {formatMoneyVES(salesData.summary?.totalSalesVES || 0)}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    Facturas Emitidas
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 block mt-0.5">
                    {formatNumber(salesData.summary?.totalInvoices || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500">Transacciones fiscales</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    Ticket Promedio
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 block mt-0.5">
                    {formatMoneyUSD(salesData.summary?.averageTicketUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500">Promedio por cliente</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    IVA 16% Total
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 block mt-0.5">
                    {formatMoneyUSD(salesData.summary?.totalIvaUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500">Débito Fiscal SENIAT</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    IGTF 3% Total
                  </span>
                  <span className="text-lg font-bold font-mono text-indigo-700 block mt-0.5">
                    {formatMoneyUSD(salesData.summary?.totalIgtfUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500">Moneda extranjera</span>
                </div>
              </div>

              {/* Desglose por Medio de Pago */}
              {salesData.summary?.paymentMethods && salesData.summary.paymentMethods.length > 0 && (
                <div className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                  <span className="text-xs font-bold text-neutral-800 block">
                    Recaudación Desglosada por Forma de Pago:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {salesData.summary.paymentMethods.map((pm: any) => (
                      <div
                        key={pm.method}
                        className="p-2.5 bg-white rounded-lg border border-neutral-200 text-xs"
                      >
                        <span className="font-semibold text-neutral-700 block text-[11px] truncate">
                          {pm.method === 'DEBIT_CARD' ? 'Punto Débito (Bs)' :
                           pm.method === 'CREDIT_CARD' ? 'Punto Crédito (Bs)' :
                           pm.method === 'PAGO_MOVIL' ? 'Pago Móvil (Bs)' :
                           pm.method === 'CASH_USD' ? 'Efectivo Divisas ($)' :
                           pm.method === 'CASH_VES' ? 'Efectivo Bs' :
                           pm.method === 'ZELLE' ? 'Zelle ($)' : pm.method}
                        </span>
                        <span className="font-bold font-mono text-neutral-900 block mt-0.5">
                          {formatMoneyUSD(pm.totalUSD)}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono block">
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
                  <div className="overflow-x-auto mt-2 border border-neutral-200 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 border-b border-neutral-200 uppercase text-neutral-600 font-semibold text-[10px] tracking-wider">
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
                      <tbody className="divide-y divide-neutral-100">
                        {salesData.dailySummary && salesData.dailySummary.length > 0 ? (
                          salesData.dailySummary.map((d: any) => (
                            <tr key={d.date} className="hover:bg-neutral-50/60 font-mono">
                              <td className="py-2.5 px-3 font-semibold text-neutral-900">
                                {d.date}
                              </td>
                              <td className="py-2.5 px-3 text-center">{d.invoicesCount}</td>
                              <td className="py-2.5 px-3 text-right text-neutral-600">
                                {formatMoneyUSD(d.exemptUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-neutral-600">
                                {formatMoneyUSD(d.taxableUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-neutral-700 font-medium">
                                {formatMoneyUSD(d.ivaUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-indigo-600 font-medium">
                                {formatMoneyUSD(d.igtfUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-neutral-900">
                                {formatMoneyUSD(d.totalUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-sky-800">
                                {formatMoneyVES(d.totalVES)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-neutral-400">
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
                  <div className="overflow-x-auto mt-2 border border-neutral-200 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 border-b border-neutral-200 uppercase text-neutral-600 font-semibold text-[10px] tracking-wider">
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
                      <tbody className="divide-y divide-neutral-100">
                        {filteredSalesInvoices.length > 0 ? (
                          filteredSalesInvoices.map((inv: any) => (
                            <tr key={inv.id} className="hover:bg-neutral-50/60">
                              <td className="py-2.5 px-3 text-neutral-600 font-mono text-[11px] whitespace-nowrap">
                                {new Date(inv.emission_date).toLocaleString('es-VE')}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">
                                {inv.invoice_number}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-neutral-900 block truncate max-w-[140px]">
                                  {inv.customer_name}
                                </span>
                                <span className="font-mono text-[10px] text-neutral-500">
                                  {inv.customer_doc}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-medium text-neutral-800 block">
                                  {inv.cash_register_code || 'POS'}
                                </span>
                                <span className="text-[10px] text-neutral-500 truncate block">
                                  {inv.cashier_name}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-wrap gap-1 max-w-[180px]">
                                  {inv.payments && inv.payments.length > 0 ? (
                                    inv.payments.map((p: any, idx: number) => (
                                      <span
                                        key={idx}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-100 text-neutral-700"
                                      >
                                        {p.method}: {formatMoneyUSD(p.amountUSD)}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-neutral-400 text-[10px]">Sin registro</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-neutral-600">
                                {formatMoneyUSD(inv.taxableUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-neutral-700">
                                {formatMoneyUSD(inv.ivaUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                                {formatMoneyUSD(inv.totalUSD)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800">
                                {formatMoneyVES(inv.totalVES)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-neutral-400">
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
                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    Turnos Realizados
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 block mt-0.5">
                    {shiftsData.summary?.totalShifts || 0}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {shiftsData.summary?.totalClosedShifts || 0} cerrados • {shiftsData.summary?.totalOpenShifts || 0} en curso
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    Lotes POS Consolidados
                  </span>
                  <span className="text-lg font-bold font-mono text-sky-700 block mt-0.5">
                    {formatMoneyVES(shiftsData.summary?.totalPOSBatchVES || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500">Puntos de venta (Débito + Crédito)</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    Total Recaudado (VES)
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 block mt-0.5">
                    {formatMoneyVES(shiftsData.summary?.totalCollectedVES || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500">Efectivo + POS + Pago Móvil</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    Total Recaudado ($)
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 block mt-0.5">
                    {formatMoneyUSD(shiftsData.summary?.totalCollectedUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500">Efectivo $ + Zelle</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    Depósitos Bancarios Registrados
                  </span>
                  <span className="text-lg font-bold font-mono text-emerald-700 block mt-0.5">
                    {formatMoneyVES(shiftsData.summary?.totalDepositedVES || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {formatMoneyUSD(shiftsData.summary?.totalDepositedUSD || 0)}
                  </span>
                </div>
              </div>

              {/* Tabla de Cierres de Turno y Arqueos */}
              <Card
                title={`Historial de Turnos de Caja & Arqueos (${filteredCashShifts.length})`}
                subtitle="Control de lotes POS, depósitos en bancos de tesorería y cuadres de caja"
              >
                <div className="overflow-x-auto mt-2 border border-neutral-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 border-b border-neutral-200 uppercase text-neutral-600 font-semibold text-[10px] tracking-wider">
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
                    <tbody className="divide-y divide-neutral-100">
                      {filteredCashShifts.length > 0 ? (
                        filteredCashShifts.map((s: any) => {
                          const diffUSD = s.difference_usd ?? 0;
                          const diffVES = s.difference_ves ?? 0;
                          const isBalanced = Math.abs(diffUSD) < 0.01 && Math.abs(diffVES) < 0.01;

                          return (
                            <tr key={s.id} className="hover:bg-neutral-50/60">
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-neutral-900 block font-mono">
                                  {s.cash_register_code}
                                </span>
                                <span className="text-[11px] text-neutral-600 font-medium block">
                                  {s.cashier_name}
                                </span>
                                <span className="text-[10px] text-neutral-400 block">
                                  {s.branch_name}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px]">
                                <span className="text-neutral-700 block">
                                  Inic: {new Date(s.opened_at).toLocaleTimeString('es-VE')} ({new Date(s.opened_at).toLocaleDateString('es-VE')})
                                </span>
                                {s.closed_at ? (
                                  <span className="text-neutral-500 block">
                                    Cierr: {new Date(s.closed_at).toLocaleTimeString('es-VE')}
                                  </span>
                                ) : (
                                  <span className="text-sky-600 font-semibold block">En Operación</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge variant={s.status === 'CLOSED' ? 'neutral' : 'success'}>
                                  {s.status === 'CLOSED' ? 'CERRADO' : 'ABIERTO'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800">
                                {formatMoneyVES(s.posBatchVES || 0)}
                                <span className="text-[10px] text-neutral-400 block font-normal">
                                  Déb: {formatMoneyVES(s.debitVES || 0)} • Créd: {formatMoneyVES(s.creditVES || 0)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="font-bold text-neutral-900 block">
                                  {formatMoneyVES(s.totalCollectedVES || 0)}
                                </span>
                                <span className="text-[11px] text-neutral-600 block">
                                  {formatMoneyUSD(s.totalCollectedUSD || 0)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                {s.deposit_amount_ves > 0 ? (
                                  <div className="text-[11px]">
                                    <span className="font-mono font-bold text-emerald-800 block">
                                      {formatMoneyVES(s.deposit_amount_ves)}
                                    </span>
                                    <span className="text-neutral-600 block">
                                      {s.deposit_bank_name_ves || 'Banco'} {s.deposit_account_ves ? `(${s.deposit_account_ves.slice(-4)})` : ''}
                                    </span>
                                    {s.deposit_reference_ves && (
                                      <span className="font-mono text-[10px] text-neutral-500 block">
                                        Ref: {s.deposit_reference_ves}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-neutral-400 text-[11px]">Sin depósito</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {s.deposit_amount_usd > 0 ? (
                                  <div className="text-[11px]">
                                    <span className="font-mono font-bold text-emerald-800 block">
                                      {formatMoneyUSD(s.deposit_amount_usd)}
                                    </span>
                                    <span className="text-neutral-600 block">
                                      {s.deposit_bank_name_usd || 'Custodia USD'}
                                    </span>
                                    {s.deposit_reference_usd && (
                                      <span className="font-mono text-[10px] text-neutral-500 block">
                                        Ref: {s.deposit_reference_usd}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-neutral-400 text-[11px]">Sin depósito</span>
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
                                  <span className="text-neutral-400 text-[11px]">En curso</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-neutral-400">
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
              <div className="overflow-x-auto mt-2 border border-neutral-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 border-b border-neutral-200 uppercase text-neutral-600 font-semibold text-[10px] tracking-wider">
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
                  <tbody className="divide-y divide-neutral-100">
                    {productData.length > 0 ? (
                      productData.map((p, idx) => (
                        <tr key={p.product_id || idx} className="hover:bg-neutral-50/60">
                          <td className="py-2.5 px-3 font-mono text-neutral-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-800">
                            {p.sku}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-neutral-900">
                            {p.product_name}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600">
                            {p.category_name || 'General'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-700">
                            {formatNumber(p.total_units || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-600">
                            {formatMoneyUSD(p.average_price_usd || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                            {formatMoneyUSD(p.total_sales_usd || 0)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-neutral-400">
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
              <div className="overflow-x-auto mt-2 border border-neutral-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 border-b border-neutral-200 uppercase text-neutral-600 font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Cajero / Operador</th>
                      <th className="py-2.5 px-3 text-center">Turnos Realizados</th>
                      <th className="py-2.5 px-3 text-center">Facturas Emitidas</th>
                      <th className="py-2.5 px-3 text-right">Lote POS (Bs)</th>
                      <th className="py-2.5 px-3 text-right">Ticket Promedio ($)</th>
                      <th className="py-2.5 px-3 text-right">Venta Total ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {cashierData.length > 0 ? (
                      cashierData.map((c, idx) => (
                        <tr key={c.cashier_id || idx} className="hover:bg-neutral-50/60">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-neutral-900 block">
                              {c.cashier_name}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              ID: {c.cashier_id?.slice(0, 8)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {c.total_shifts || 0}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-700">
                            {c.total_invoices || 0}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800">
                            {formatMoneyVES(c.pos_batch_ves || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-600">
                            {formatMoneyUSD(c.average_ticket_usd || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                            {formatMoneyUSD(c.total_sales_usd || 0)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-neutral-400">
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
              <div className="overflow-x-auto mt-2 border border-neutral-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 uppercase text-neutral-600 font-semibold text-[10px] tracking-wider">
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
                  <tbody className="divide-y divide-neutral-100">
                    {salesBookData.length > 0 ? (
                      salesBookData.map((r, idx) => (
                        <tr key={r.id || idx} className="hover:bg-neutral-50/50">
                          <td className="py-2.5 px-3 font-mono">{r.row_num || idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">{r.emission_date?.slice(0, 10)}</td>
                          <td className="py-2.5 px-3 font-mono font-medium text-neutral-700">{r.customer_rif || r.rif}</td>
                          <td className="py-2.5 px-3 font-semibold text-neutral-900">{r.customer_name || r.name}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">{r.invoice_number}</td>
                          <td className="py-2.5 px-3 font-mono text-neutral-500">{r.control_number || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-neutral-900">{formatMoneyUSD(Number(r.total_amount || r.total || 0))}</td>
                          <td className="py-2.5 px-3 text-right text-neutral-600">{formatMoneyUSD(Number(r.exempt_amount || r.exempt || 0))}</td>
                          <td className="py-2.5 px-3 text-right text-neutral-600">{formatMoneyUSD(Number(r.taxable_amount || r.taxable || 0))}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-neutral-800">{formatMoneyUSD(Number(r.tax_amount || r.iva || 0))}</td>
                          <td className="py-2.5 px-3 text-right text-indigo-600 font-medium">{formatMoneyUSD(Number(r.igtf_amount || r.igtf || 0))}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">{formatMoneyUSD(Number(r.retained_amount || r.retained || 0))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-neutral-400">
                          No hay operaciones registradas en el Libro de Ventas para este período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Modal Visor de Reporte en PDF */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-6xl max-h-[92vh] bg-white rounded-lg border border-neutral-200 shadow-2xl flex flex-col overflow-hidden z-10 my-auto">
            {/* Header del Modal */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-neutral-100 text-neutral-700 rounded-lg shrink-0">
                  <FileText className="w-5 h-5 text-neutral-700" />
                </div>
                <div className="truncate">
                  <h3 className="text-sm font-semibold text-neutral-900 truncate">
                    {pdfTitle || 'Vista Previa del Reporte PDF'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span>
                      Orientación:{' '}
                      <strong className="text-neutral-700 font-medium">
                        {activeTab === 'sales_book' || (activeTab === 'sales' && isDetailed) || (activeTab === 'cash_shifts' && isDetailed)
                          ? 'Horizontal (Landscape)'
                          : 'Vertical (Portrait)'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>Cumplimiento Fiscal SENIAT</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClosePdfModal}
                className="text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenedor del Visor */}
            <div className="flex-1 bg-neutral-100 p-2 sm:p-4 overflow-hidden relative min-h-[400px]">
              {loadingPdf ? (
                <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-white rounded-lg border border-neutral-200 p-6">
                  <Loader2 className="w-8 h-8 text-neutral-600 animate-spin" />
                  <p className="text-sm font-semibold text-neutral-800">
                    Generando reporte PDF con diseño ejecutivo...
                  </p>
                  <p className="text-xs text-neutral-500 max-w-sm text-center">
                    Preparando encabezados fiscales, numeración de páginas, tarjetas de resumen y formato{' '}
                    {activeTab === 'sales_book' || (activeTab === 'sales' && isDetailed) || (activeTab === 'cash_shifts' && isDetailed)
                      ? 'horizontal (landscape)'
                      : 'vertical (portrait)'}.
                  </p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  ref={iframeRef}
                  src={pdfBlobUrl}
                  className="w-full h-full rounded-lg border border-neutral-300 bg-white shadow-xs"
                  title="Visor PDF de Reportes"
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-neutral-400">
                  <p className="text-sm">No se ha podido cargar el documento</p>
                </div>
              )}
            </div>

            {/* Pinned Footer */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {pdfBlobUrl && (
                  <a
                    href={pdfBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400"
                    title="Abrir en pestaña nueva"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-neutral-500" />
                    Abrir pestaña
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintPdf}
                  disabled={!pdfBlobUrl}
                  title="Imprimir documento"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Imprimir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={!pdfBlobUrl}
                  title="Descargar archivo PDF"
                >
                  <FileDown className="w-3.5 h-3.5 mr-1.5" />
                  Descargar
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClosePdfModal}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

