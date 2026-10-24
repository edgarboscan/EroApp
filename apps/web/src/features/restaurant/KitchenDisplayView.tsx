import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChefHat,
  Wine,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Filter,
  RefreshCw,
  Search,
  Check,
  UtensilsCrossed,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import type { PreparationStation, ItemPreparationStatus } from '@ero/shared';

interface KDSItem {
  id: string;
  order_id: string;
  order_customer_id?: string;
  product_name: string;
  sku?: string;
  quantity: number;
  station: PreparationStation;
  notes?: string;
  status: ItemPreparationStatus;
  created_at: string;
  customer_name?: string;
  order_number: string;
  waiter_id?: string;
  waiter_name?: string;
  table_id: string;
  table_number: string;
  table_name: string;
  zone: string;
}

interface KDSTicket {
  order_id: string;
  order_number: string;
  table_id: string;
  table_number: string;
  table_name: string;
  zone: string;
  waiter_name: string;
  created_at: string;
  items: KDSItem[];
}

export const KitchenDisplayView: React.FC = () => {
  const { token, activeBranchId } = useAuthStore();

  const [items, setItems] = useState<KDSItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filtros
  const [selectedStation, setSelectedStation] = useState<'ALL' | 'KITCHEN' | 'BAR'>('ALL');
  const [selectedWaiter, setSelectedWaiter] = useState<string>('ALL');
  const [selectedTable, setSelectedTable] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Auto-refresh timer
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const getHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Branch-Id': activeBranchId || 'b1111111-1111-1111-1111-111111111111',
    };
  }, [token, activeBranchId]);

  const fetchQueue = useCallback(async (quiet: boolean = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const res = await fetch('/api/restaurant/kds/queue', { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setItems(data.data || []);
        setLastRefreshed(new Date());
      }
    } catch {
      // Ignorar fallos transitorios en polling
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getHeaders]);

  // Polling automático cada 6 segundos para actualización remota
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => {
      fetchQueue(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Actualizar estado de preparación de un ítem
  const handleUpdateStatus = async (itemId: string, newStatus: ItemPreparationStatus) => {
    try {
      const res = await fetch(`/api/restaurant/kds/items/${itemId}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        // Actualizar estado local inmediato para retroalimentación instantánea
        setItems((prev) =>
          prev
            .map((item) => (item.id === itemId ? { ...item, status: newStatus } : item))
            .filter((item) => (newStatus === 'SERVED' ? item.id !== itemId : true))
        );
      }
    } catch {
      // Error manejado
    }
  };

  // Marcar todos los ítems de un ticket como listos
  const handleCompleteTicket = async (ticket: KDSTicket) => {
    for (const item of ticket.items) {
      if (item.status !== 'READY') {
        await handleUpdateStatus(item.id, 'READY');
      }
    }
  };

  // Listas para filtros
  const availableWaiters = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => {
      if (i.waiter_name) map.set(i.waiter_name, i.waiter_name);
    });
    return Array.from(map.values());
  }, [items]);

  const availableTables = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => {
      map.set(i.table_id, `${i.table_name} (#${i.table_number})`);
    });
    return Array.from(map.entries());
  }, [items]);

  // Filtrado de ítems
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchStation = selectedStation === 'ALL' || item.station === selectedStation;
      const matchWaiter = selectedWaiter === 'ALL' || item.waiter_name === selectedWaiter;
      const matchTable = selectedTable === 'ALL' || item.table_id === selectedTable;
      const matchSearch =
        !searchQuery.trim() ||
        item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.table_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchStation && matchWaiter && matchTable && matchSearch;
    });
  }, [items, selectedStation, selectedWaiter, selectedTable, searchQuery]);

  // Agrupar ítems filtrados en Tickets por Comanda / Mesa
  const tickets = useMemo(() => {
    const map = new Map<string, KDSTicket>();

    filteredItems.forEach((item) => {
      if (!map.has(item.order_id)) {
        map.set(item.order_id, {
          order_id: item.order_id,
          order_number: item.order_number,
          table_id: item.table_id,
          table_number: item.table_number,
          table_name: item.table_name,
          zone: item.zone,
          waiter_name: item.waiter_name || 'Sin asignar',
          created_at: item.created_at,
          items: [],
        });
      }
      map.get(item.order_id)!.items.push(item);
    });

    return Array.from(map.values());
  }, [filteredItems]);

  // Cálculo de tiempo transcurrido (minutos)
  const getElapsedMinutes = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 min-h-screen">
      {/* Header KDS */}
      <header className="bg-gray-850 border-b border-gray-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2">
              <span>Pantalla de Preparación KDS (Cocina & Barra)</span>
              <span className="text-xs font-normal text-gray-400">
                • {tickets.length} comandas activas
              </span>
            </h1>
            <p className="text-xs text-gray-400">
              Cola de pedidos en tiempo real • Actualizado a las{' '}
              {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Selector de Estación */}
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
            <button
              onClick={() => setSelectedStation('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedStation === 'ALL'
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Todas</span>
            </button>

            <button
              onClick={() => setSelectedStation('KITCHEN')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedStation === 'KITCHEN'
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>Cocina</span>
            </button>

            <button
              onClick={() => setSelectedStation('BAR')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedStation === 'BAR'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Wine className="w-4 h-4" />
              <span>Barra & Bebidas</span>
            </button>
          </div>

          <button
            onClick={() => fetchQueue()}
            disabled={isRefreshing}
            className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors"
            title="Refrescar cola"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Barra de Filtros secundarios (Mozo, Mesa, Búsqueda) */}
      <div className="bg-gray-850/60 border-b border-gray-800 px-4 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-400 font-medium">Filtrar por:</span>
        </div>

        {/* Filtro por Mozo */}
        <select
          value={selectedWaiter}
          onChange={(e) => setSelectedWaiter(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <option value="ALL">Todos los Mozos</option>
          {availableWaiters.map((w) => (
            <option key={w} value={w}>
              Mozo: {w}
            </option>
          ))}
        </select>

        {/* Filtro por Mesa */}
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <option value="ALL">Todas las Mesas</option>
          {availableTables.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>

        {/* Búsqueda rápida */}
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar plato, mesa u observación..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus-visible:ring-2 focus-visible:ring-amber-500"
          />
        </div>
      </div>

      {/* Contenido Principal: Tickets de Preparación KDS */}
      <main className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-gray-800 rounded-lg border border-gray-700" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
            <CheckCircle className="w-12 h-12 text-emerald-500/40 mb-3" />
            <h2 className="text-base font-bold text-gray-300">¡Todo al día en la estación!</h2>
            <p className="text-xs text-gray-500 mt-1">
              No hay pedidos pendientes en este momento. Las nuevas comandas aparecerán automáticamente aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tickets.map((ticket) => {
              const elapsedMin = getElapsedMinutes(ticket.created_at);
              const isUrgent = elapsedMin >= 15;

              return (
                <div
                  key={ticket.order_id}
                  className={`bg-gray-800 rounded-lg border flex flex-col justify-between shadow-md overflow-hidden ${
                    isUrgent ? 'border-red-500/80' : 'border-gray-700'
                  }`}
                >
                  {/* Encabezado del Ticket */}
                  <div
                    className={`p-3 border-b flex items-center justify-between ${
                      isUrgent
                        ? 'bg-red-950/40 border-red-900/50'
                        : 'bg-gray-750 border-gray-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black bg-amber-500 text-gray-950 px-2 py-0.5 rounded-lg">
                          MESA {ticket.table_number}
                        </span>
                        <span className="text-xs font-semibold text-gray-200">{ticket.table_name}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Mozo: <strong className="text-gray-300">{ticket.waiter_name}</strong> • {ticket.zone}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-xs font-bold flex items-center gap-1 justify-end ${
                          isUrgent ? 'text-red-400 animate-pulse' : 'text-gray-300'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{elapsedMin} min</span>
                      </div>
                      <span className="text-[10px] text-gray-400">{ticket.order_number}</span>
                    </div>
                  </div>

                  {/* Lista de Ítems del Ticket */}
                  <div className="p-3 flex-1 space-y-2 overflow-y-auto max-h-80">
                    {ticket.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-lg border flex flex-col gap-1 transition-colors ${
                          item.status === 'READY'
                            ? 'bg-emerald-950/30 border-emerald-800/50'
                            : item.status === 'PREPARING'
                            ? 'bg-amber-950/30 border-amber-800/50'
                            : 'bg-gray-750/70 border-gray-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-black text-amber-400 bg-gray-900 px-2 py-0.5 rounded-lg">
                              {item.quantity}x
                            </span>
                            <div>
                              <div className="text-xs font-bold text-gray-100">{item.product_name}</div>
                              {item.customer_name && (
                                <div className="text-[10px] text-indigo-300">
                                  Para: {item.customer_name}
                                </div>
                              )}
                            </div>
                          </div>

                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg uppercase ${
                              item.station === 'BAR'
                                ? 'bg-blue-900/60 text-blue-300'
                                : 'bg-amber-900/60 text-amber-300'
                            }`}
                          >
                            {item.station === 'BAR' ? 'Barra' : 'Cocina'}
                          </span>
                        </div>

                        {/* Observaciones resaltadas */}
                        {item.notes && (
                          <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold rounded-lg">
                            Nota: {item.notes}
                          </div>
                        )}

                        {/* Botones de acción rápida de estado */}
                        <div className="mt-1 pt-1.5 border-t border-gray-700/60 flex items-center justify-between gap-1">
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">
                            {item.status === 'PENDING'
                              ? 'En Cola'
                              : item.status === 'PREPARING'
                              ? 'Preparando'
                              : 'Listo'}
                          </span>

                          <div className="flex items-center gap-1">
                            {item.status === 'PENDING' && (
                              <button
                                onClick={() => handleUpdateStatus(item.id, 'PREPARING')}
                                className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
                              >
                                Empezar
                              </button>
                            )}

                            {item.status === 'PREPARING' && (
                              <button
                                onClick={() => handleUpdateStatus(item.id, 'READY')}
                                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Listo</span>
                              </button>
                            )}

                            {item.status === 'READY' && (
                              <button
                                onClick={() => handleUpdateStatus(item.id, 'SERVED')}
                                className="px-2.5 py-1 text-[11px] font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                              >
                                Entregar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pie del Ticket con acción rápida */}
                  <div className="p-2.5 bg-gray-750 border-t border-gray-700 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      {ticket.items.filter((i) => i.status === 'READY').length} / {ticket.items.length} listos
                    </span>

                    <button
                      onClick={() => handleCompleteTicket(ticket)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>Completar Ticket</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
