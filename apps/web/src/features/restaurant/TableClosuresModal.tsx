import React, { useState, useEffect, useCallback } from 'react';
import { X, Clock, Calendar, Search, DollarSign, Users, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { RestaurantTableClosure } from '@ero/shared';

interface TableClosuresModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  activeBranchId: string | null;
}

export const TableClosuresModal: React.FC<TableClosuresModalProps> = ({
  isOpen,
  onClose,
  token,
  activeBranchId,
}) => {
  const [closures, setClosures] = useState<RestaurantTableClosure[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [expandedClosureId, setExpandedClosureId] = useState<string | null>(null);

  const getHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeBranchId ? { 'x-branch-id': activeBranchId } : {}),
    }),
    [token, activeBranchId]
  );

  const fetchClosures = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/restaurant/closures?limit=100';
      if (selectedDate) {
        url += `&start_date=${selectedDate}&end_date=${selectedDate}`;
      }
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setClosures(data.data);
      }
    } catch (err) {
      console.error('Error fetching closures:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, selectedDate]);

  useEffect(() => {
    if (isOpen) {
      fetchClosures();
    }
  }, [isOpen, fetchClosures]);

  if (!isOpen) return null;

  const filteredClosures = closures.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.table_number.toLowerCase().includes(q) ||
      c.table_name.toLowerCase().includes(q) ||
      c.order_number.toLowerCase().includes(q) ||
      (c.waiter_name && c.waiter_name.toLowerCase().includes(q)) ||
      (c.zone && c.zone.toLowerCase().includes(q))
    );
  });

  const toggleExpand = (id: string) => {
    setExpandedClosureId((prev) => (prev === id ? null : id));
  };

  const totalCollectedUsd = filteredClosures.reduce((acc, c) => acc + (c.total_usd || 0), 0);
  const totalTipsUsd = filteredClosures.reduce((acc, c) => acc + (c.tip_usd || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Historial de Cierres de Mesas</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Summary */}
        <div className="p-4 border-b border-slate-800 bg-slate-800/40 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por mesa, comanda o mozo..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            {selectedDate && (
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:bg-slate-800"
                >
                  Limpiar Filtro de Fecha
                </button>
              </div>
            )}
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 block">Mesas Cerradas</span>
              <span className="text-lg font-semibold text-white">{filteredClosures.length}</span>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 block">Total Facturado / Cobrado</span>
              <span className="text-lg font-semibold text-emerald-400">
                ${totalCollectedUsd.toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 block">Total Propinas</span>
              <span className="text-lg font-semibold text-amber-400">${totalTipsUsd.toFixed(2)}</span>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 block">Promedio x Mesa</span>
              <span className="text-lg font-semibold text-blue-400">
                $
                {filteredClosures.length > 0
                  ? (totalCollectedUsd / filteredClosures.length).toFixed(2)
                  : '0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Closures table */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">Cargando registros de cierres...</div>
          ) : filteredClosures.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No se encontraron registros de cierre con los filtros aplicados.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClosures.map((closure) => {
                const isExpanded = expandedClosureId === closure.id;
                const paymentSummary = Array.isArray(closure.payment_summary)
                  ? closure.payment_summary
                  : [];

                return (
                  <div
                    key={closure.id}
                    className="border border-slate-800 bg-slate-800/40 rounded-lg overflow-hidden transition-all"
                  >
                    <div
                      onClick={() => toggleExpand(closure.id)}
                      className="p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/70 select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-950/80 border border-blue-800/50 flex flex-col items-center justify-center text-xs">
                          <span className="font-bold text-blue-400">{closure.table_number}</span>
                          <span className="text-[10px] text-slate-400">{closure.zone.slice(0, 3)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{closure.table_name}</span>
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
                              {closure.order_number}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Mozo: {closure.waiter_name || 'Sin asignar'}</span>
                            <span>•</span>
                            <span>{new Date(closure.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span>Duración: {closure.duration_minutes} min</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 ml-auto">
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-400">
                            ${closure.total_usd.toFixed(2)}
                          </div>
                          <div className="text-xs text-slate-400">
                            Bs. {closure.total_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        {closure.tip_usd > 0 && (
                          <div className="text-right hidden sm:block">
                            <span className="text-[10px] uppercase text-amber-500 font-semibold block">
                              Propina
                            </span>
                            <span className="text-xs text-amber-400 font-medium">
                              ${closure.tip_usd.toFixed(2)}
                            </span>
                          </div>
                        )}

                        <div className="text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 text-xs space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <span className="text-slate-500 block">Hora de Apertura:</span>
                            <span className="text-slate-300 font-medium">
                              {new Date(closure.opened_at).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Hora de Cierre:</span>
                            <span className="text-slate-300 font-medium">
                              {new Date(closure.closed_at).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Cerrado por:</span>
                            <span className="text-slate-300 font-medium">
                              {closure.closed_by_user_name || 'Sistema'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Comensales / Ítems:</span>
                            <span className="text-slate-300 font-medium">
                              {closure.customer_count} personas • {closure.item_count} ítems
                            </span>
                          </div>
                        </div>

                        {/* Payment Breakdown */}
                        {paymentSummary.length > 0 && (
                          <div className="pt-2">
                            <span className="font-semibold text-slate-400 block mb-1">
                              Desglose de Formas de Pago Aplicadas:
                            </span>
                            <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                              {paymentSummary.map((p: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-slate-300">
                                  <span>
                                    {p.payment_method_name}{' '}
                                    {p.is_credit ? '(Crédito CxC)' : ''}
                                    {p.reference ? ` [Ref: ${p.reference}]` : ''}
                                  </span>
                                  <span className="font-mono text-emerald-400">
                                    ${Number(p.amount_usd || 0).toFixed(2)} (Bs.{' '}
                                    {Number(p.amount_ves || 0).toFixed(2)})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {closure.closure_notes && (
                          <div className="pt-1">
                            <span className="font-semibold text-slate-400 block mb-0.5">
                              Observaciones de Cierre:
                            </span>
                            <p className="text-slate-300 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800">
                              {closure.closure_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
