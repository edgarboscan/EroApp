import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Search,
  Download,
  Printer,
  User,
  BadgeDollarSign,
  Receipt,
  Percent,
  CheckCircle2,
  Clock,
  Filter,
} from 'lucide-react';
import type { RestaurantTipsReport, RestaurantTipItem, WaiterTipsSummary } from '@ero/shared';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import { formatMoneyUSD, formatMoneyVES, formatPercent } from '@ero/shared';

interface RestaurantTipsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  activeBranchId: string | null;
}

export const RestaurantTipsReportModal: React.FC<RestaurantTipsReportModalProps> = ({
  isOpen,
  onClose,
  token,
  activeBranchId,
}) => {
  const [reportData, setReportData] = useState<RestaurantTipsReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedWaiter, setSelectedWaiter] = useState<string>('ALL');
  const [onlyWithTips, setOnlyWithTips] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'BY_WAITER' | 'DETAILED'>('BY_WAITER');

  // Filtros de fecha
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Modal para PDF
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  const getHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeBranchId ? { 'x-branch-id': activeBranchId } : {}),
    }),
    [token, activeBranchId]
  );

  // Manejador de presets de fecha
  const handlePresetChange = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setStartDate(w.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'month') {
      const m = new Date();
      m.setDate(1);
      setStartDate(m.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    }
  };

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/restaurant/tips-report?startDate=${startDate}&endDate=${endDate}&onlyWithTips=${onlyWithTips}`;
      if (selectedWaiter && selectedWaiter !== 'ALL') {
        url += `&waiterName=${encodeURIComponent(selectedWaiter)}`;
      }
      const res = await fetch(url, { headers: getHeaders() });
      const json = await res.json();
      if (json.success && json.data) {
        setReportData(json.data);
      } else {
        setReportData(null);
      }
    } catch {
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, onlyWithTips, selectedWaiter, getHeaders]);

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen, fetchReport]);

  // Lista de meseros únicos para el filtro
  const uniqueWaiters = useMemo(() => {
    if (!reportData?.byWaiter) return [];
    return reportData.byWaiter.map((w) => w.waiterName).filter(Boolean);
  }, [reportData]);

  // Filtrado local en base a searchQuery
  const filteredOrders = useMemo(() => {
    if (!reportData?.orders) return [];
    if (!searchQuery.trim()) return reportData.orders;
    const q = searchQuery.toLowerCase();
    return reportData.orders.filter(
      (o: RestaurantTipItem) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.waiterName.toLowerCase().includes(q) ||
        o.tableName.toLowerCase().includes(q) ||
        o.tableNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.posInvoiceNumber && o.posInvoiceNumber.toLowerCase().includes(q))
    );
  }, [reportData, searchQuery]);

  const filteredWaiters = useMemo(() => {
    if (!reportData?.byWaiter) return [];
    if (!searchQuery.trim()) return reportData.byWaiter;
    const q = searchQuery.toLowerCase();
    return reportData.byWaiter.filter((w: WaiterTipsSummary) =>
      w.waiterName.toLowerCase().includes(q)
    );
  }, [reportData, searchQuery]);

  // Descarga rápida a CSV
  const handleExportCSV = () => {
    if (!reportData?.orders || reportData.orders.length === 0) return;
    const headers = [
      'N° Comanda',
      'Mesero / Generador',
      'Mesa',
      'Área / Salón',
      'Cliente',
      'Fecha Cierre',
      'Consumo ($)',
      'Consumo (Bs)',
      'Propina ($)',
      'Propina (Bs)',
      '% Propina',
      'Factura Fiscal POS',
      'Estado',
    ];

    const rows = reportData.orders.map((o) => [
      `"${o.orderNumber}"`,
      `"${o.waiterName}"`,
      `"${o.tableNumber} - ${o.tableName}"`,
      `"${o.zone}"`,
      `"${o.customerName}"`,
      `"${new Date(o.closedAt).toLocaleString('es-VE')}"`,
      o.subtotalUSD.toFixed(2),
      o.subtotalVES.toFixed(2),
      o.tipUSD.toFixed(2),
      o.tipVES.toFixed(2),
      `"${o.tipPercent}%"`,
      `"${o.posInvoiceNumber || (o.isInvoiced ? 'Facturada' : 'Pendiente')}"`,
      `"${o.isInvoiced ? 'FACTURADA' : 'PENDIENTE'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_propinas_${startDate}_al_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pdfUrl = `/api/reports/restaurant-tips?startDate=${startDate}&endDate=${endDate}&branchId=${activeBranchId || ''}${selectedWaiter !== 'ALL' ? `&waiterName=${encodeURIComponent(selectedWaiter)}` : ''}&onlyWithTips=${onlyWithTips}&format=pdf`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reporte de Propinas por Mesero / Usuario"
      subtitle="Liquidación, auditoría y recaudación de propinas voluntarias por comanda de restaurante"
      size="4xl"
    >
      <div className="space-y-4">
        {/* Barra superior de filtros y presets */}
        <div className="bg-neutral-50 dark:bg-neutral-800/60 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Presets rápidos */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Período:
              </span>
              {(['today', 'yesterday', 'week', 'month', 'custom'] as const).map((p) => {
                const labels: Record<string, string> = {
                  today: 'Hoy',
                  yesterday: 'Ayer',
                  week: 'Últimos 7 días',
                  month: 'Este Mes',
                  custom: 'Personalizado',
                };
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePresetChange(p)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      datePreset === p
                        ? 'bg-sky-600 text-white'
                        : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {labels[p]}
                  </button>
                );
              })}
            </div>

            {/* Acciones de exportación */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={isLoading || !reportData?.orders.length}
                className="flex items-center gap-1.5 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsPdfModalOpen(true)}
                disabled={isLoading || !reportData?.orders.length}
                className="flex items-center gap-1.5 text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir / PDF
              </Button>
            </div>
          </div>

          {/* Filtros detallados de fecha, mesero y búsqueda */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="relative">
              <Calendar className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setStartDate(e.target.value);
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>

            <div className="relative">
              <Calendar className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setEndDate(e.target.value);
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>

            <div className="relative">
              <select
                value={selectedWaiter}
                onChange={(e) => setSelectedWaiter(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <option value="ALL">Todos los Meseros / Usuarios</option>
                {uniqueWaiters.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar comanda, cliente..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 pt-1 border-t border-neutral-200/60 dark:border-neutral-700/60">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyWithTips}
                onChange={(e) => setOnlyWithTips(e.target.checked)}
                className="rounded border-neutral-300 dark:border-neutral-700 text-sky-600 focus:ring-sky-500"
              />
              <span>Mostrar únicamente comandas con propina asignada (&gt; $0.00)</span>
            </label>

            {/* Alternador de vista */}
            <div className="flex items-center gap-1 bg-neutral-200/60 dark:bg-neutral-700/60 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('BY_WAITER')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  viewMode === 'BY_WAITER'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                Por Mesero
              </button>
              <button
                type="button"
                onClick={() => setViewMode('DETAILED')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  viewMode === 'DETAILED'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                Detalle Comandas
              </button>
            </div>
          </div>
        </div>

        {/* Tarjetas de Métricas Globales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-xs">Total Propinas USD</span>
              <BadgeDollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
              ${reportData ? reportData.summary.totalTipsUSD.toFixed(2) : '0.00'}
            </div>
            <div className="text-[11px] text-neutral-400 font-mono">
              Bs. {reportData ? reportData.summary.totalTipsVES.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '0,00'}
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-xs">Comandas con Propina</span>
              <Receipt className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {reportData ? reportData.summary.ordersWithTipCount : 0}
            </div>
            <div className="text-[11px] text-neutral-400">
              de {reportData ? reportData.summary.ordersCount : 0} comandas cerradas
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-xs">Consumo de Mesas</span>
              <BadgeDollarSign className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100">
              ${reportData ? reportData.summary.totalSalesUSD.toFixed(2) : '0.00'}
            </div>
            <div className="text-[11px] text-neutral-400 font-mono">
              Bs. {reportData ? reportData.summary.totalSalesVES.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '0,00'}
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-xs">Promedio de Propina</span>
              <Percent className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">
              ${reportData ? reportData.summary.averageTipUSD.toFixed(2) : '0.00'}
            </div>
            <div className="text-[11px] text-neutral-400">
              {reportData ? reportData.summary.averageTipPercent : 0}% de propina promedio
            </div>
          </div>
        </div>

        {/* Contenido principal según vista */}
        <div className="min-h-[300px]">
          {isLoading ? (
            <div className="py-16 space-y-3">
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
          ) : viewMode === 'BY_WAITER' ? (
            /* VISTA RESUMIDA POR MESERO */
            <div className="space-y-3">
              {filteredWaiters.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg">
                  No se registraron propinas para los filtros y fechas seleccionadas.
                </div>
              ) : (
                <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Mesero / Usuario que Generó Comanda</th>
                        <th className="py-2.5 px-3 text-center">Comandas Totales</th>
                        <th className="py-2.5 px-3 text-center">Con Propina</th>
                        <th className="py-2.5 px-3 text-right">Venta Servida ($)</th>
                        <th className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                          Total Propinas ($)
                        </th>
                        <th className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                          Total Propinas (Bs)
                        </th>
                        <th className="py-2.5 px-3 text-right">Prom. Propina ($)</th>
                        <th className="py-2.5 px-3 text-center">% Promedio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200">
                      {filteredWaiters.map((w: WaiterTipsSummary) => (
                        <tr
                          key={w.waiterName}
                          className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-semibold flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 flex items-center justify-center text-[10px]">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span>{w.waiterName}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">{w.ordersCount}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {w.ordersWithTipCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">${w.totalSalesUSD.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            ${w.totalTipsUSD.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                            Bs. {w.totalTipsVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">${w.averageTipUSD.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {w.averageTipPercent}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-neutral-50 dark:bg-neutral-800/80 font-bold border-t border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100">
                      <tr>
                        <td className="py-2.5 px-3">TOTALES ACUMULADOS:</td>
                        <td className="py-2.5 px-3 text-center font-mono">{reportData?.summary.ordersCount || 0}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">
                          {reportData?.summary.ordersWithTipCount || 0}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          ${reportData?.summary.totalSalesUSD.toFixed(2) || '0.00'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-600 dark:text-amber-400">
                          ${reportData?.summary.totalTipsUSD.toFixed(2) || '0.00'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          Bs. {reportData?.summary.totalTipsVES.toLocaleString('es-VE', { minimumFractionDigits: 2 }) || '0,00'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          ${reportData?.summary.averageTipUSD.toFixed(2) || '0.00'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
                            {reportData?.summary.averageTipPercent || 0}%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* VISTA DETALLADA DE COMANDAS */
            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg">
                  No se encontraron comandas con los criterios de búsqueda aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg max-h-[460px]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">N° Comanda</th>
                        <th className="py-2.5 px-3">Mesero / Generador</th>
                        <th className="py-2.5 px-3">Mesa / Salón</th>
                        <th className="py-2.5 px-3">Fecha y Hora</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3 text-right">Consumo ($)</th>
                        <th className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                          Propina ($)
                        </th>
                        <th className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                          Propina (Bs)
                        </th>
                        <th className="py-2.5 px-3 text-center">%</th>
                        <th className="py-2.5 px-3 text-center">Factura POS</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200">
                      {filteredOrders.map((o: RestaurantTipItem) => (
                        <tr
                          key={o.closureId}
                          className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-mono font-medium text-sky-600 dark:text-sky-400">
                            {o.orderNumber}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                            {o.waiterName}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-neutral-800 dark:text-neutral-200">
                              {o.tableNumber}
                            </span>
                            <span className="text-[11px] text-neutral-400 block">{o.zone}</span>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-500 dark:text-neutral-400 font-mono text-[11px]">
                            {new Date(o.closedAt).toLocaleString('es-VE', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-2.5 px-3 truncate max-w-[140px] text-neutral-700 dark:text-neutral-300">
                            {o.customerName}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">${o.subtotalUSD.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            ${o.tipUSD.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                            Bs. {o.tipVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-neutral-500">
                            {o.tipPercent}%
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {o.posInvoiceNumber ? (
                              <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                                {o.posInvoiceNumber}
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {o.isInvoiced ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                Facturada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Clock className="w-3 h-3" />
                                Pendiente
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal visor interactivo de PDF */}
        {isPdfModalOpen && (
          <PdfViewerModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            endpoint={pdfUrl}
            title="Reporte Oficial de Propinas por Mesero / Usuario"
            filename={`reporte_propinas_${startDate}_al_${endDate}.pdf`}
            token={token}
          />
        )}
      </div>
    </Modal>
  );
};
