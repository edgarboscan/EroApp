import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { RestaurantTableClosure } from '@ero/shared';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Historial de Cierres de Mesas"
      subtitle="Auditoría de mesas facturadas y cerradas en sala"
      size="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Total registros: <strong className="text-neutral-800 dark:text-neutral-200">{filteredClosures.length}</strong>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Filters and Summary */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por mesa, comanda o mozo..."
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>

            <div className="relative">
              <Calendar className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>

            {selectedDate && (
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate('')}
                >
                  Limpiar Filtro de Fecha
                </Button>
              </div>
            )}
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 block">Mesas Cerradas</span>
              <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{filteredClosures.length}</span>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 block">Total Facturado</span>
              <span className="text-lg font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                ${totalCollectedUsd.toFixed(2)}
              </span>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 block">Total Propinas</span>
              <span className="text-lg font-semibold font-mono text-amber-600 dark:text-amber-400">${totalTipsUsd.toFixed(2)}</span>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 block">Promedio x Mesa</span>
              <span className="text-lg font-semibold font-mono text-sky-600 dark:text-sky-400">
                $
                {filteredClosures.length > 0
                  ? (totalCollectedUsd / filteredClosures.length).toFixed(2)
                  : '0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Closures list */}
        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-neutral-500 dark:text-neutral-400">Cargando registros de cierres...</div>
          ) : filteredClosures.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-500 dark:text-neutral-400">
              No se encontraron registros de cierre con los filtros aplicados.
            </div>
          ) : (
            filteredClosures.map((closure) => {
              const isExpanded = expandedClosureId === closure.id;
              const paymentSummary = Array.isArray(closure.payment_summary)
                ? closure.payment_summary
                : [];

              return (
                <div
                  key={closure.id}
                  className="border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 rounded-lg overflow-hidden transition-all shadow-xs"
                >
                  <div
                    onClick={() => toggleExpand(closure.id)}
                    className="p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex flex-col items-center justify-center text-xs">
                        <span className="font-bold text-sky-700 dark:text-sky-300">{closure.table_number}</span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{closure.zone.slice(0, 3)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{closure.table_name}</span>
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                            {closure.order_number}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-2 mt-0.5">
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
                        <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          ${closure.total_usd.toFixed(2)}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                          Bs. {closure.total_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      {closure.tip_usd > 0 && (
                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-semibold block">
                            Propina
                          </span>
                          <span className="text-xs font-mono text-amber-700 dark:text-amber-300 font-medium">
                            ${closure.tip_usd.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="text-neutral-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/60 text-xs space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-neutral-600 dark:text-neutral-300">
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Hora Apertura:</span>
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            {new Date(closure.opened_at).toLocaleString('es-VE')}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Hora Cierre:</span>
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            {new Date(closure.closed_at).toLocaleString('es-VE')}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Cerrado por:</span>
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            {closure.closed_by_user_name || 'Sistema'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400 block text-[11px]">Comensales / Ítems:</span>
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            {closure.customer_count} personas • {closure.item_count} ítems
                          </span>
                        </div>
                      </div>

                      {/* Payment Breakdown */}
                      {paymentSummary.length > 0 && (
                        <div className="pt-2">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                            Desglose de Formas de Pago Aplicadas:
                          </span>
                          <div className="space-y-1 bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                            {paymentSummary.map((p: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                                <span>
                                  {p.payment_method_name}{' '}
                                  {p.is_credit ? '(Crédito CxC)' : ''}
                                  {p.reference ? ` [Ref: ${p.reference}]` : ''}
                                </span>
                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
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
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-0.5">
                            Observaciones de Cierre:
                          </span>
                          <p className="text-neutral-600 dark:text-neutral-300 italic bg-white dark:bg-neutral-900 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800">
                            {closure.closure_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
