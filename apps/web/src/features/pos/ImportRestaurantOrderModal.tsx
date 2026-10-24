import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Utensils, Check, ArrowRight, Clock, Users, DollarSign } from 'lucide-react';

interface ImportRestaurantOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportOrder: (order: any) => void;
  token: string | null;
  activeBranchId: string | null;
}

export const ImportRestaurantOrderModal: React.FC<ImportRestaurantOrderModalProps> = ({
  isOpen,
  onClose,
  onImportOrder,
  token,
  activeBranchId,
}) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const getHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeBranchId ? { 'x-branch-id': activeBranchId } : {}),
    }),
    [token, activeBranchId]
  );

  const fetchUnbilledOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/restaurant/orders-unbilled', {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setOrders(data.data);
        if (data.data.length > 0 && !selectedOrderId) {
          setSelectedOrderId(data.data[0].id);
        }
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Error fetching unbilled restaurant orders:', err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, selectedOrderId]);

  useEffect(() => {
    if (isOpen) {
      fetchUnbilledOrders();
    }
  }, [isOpen, fetchUnbilledOrders]);

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      (o.table_name && o.table_name.toLowerCase().includes(q)) ||
      (o.table_number && o.table_number.toLowerCase().includes(q)) ||
      (o.waiter_name && o.waiter_name.toLowerCase().includes(q)) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q))
    );
  });

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const handleConfirmImport = () => {
    if (!selectedOrder) return;
    onImportOrder(selectedOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">
              Importar Comanda de Restaurante para Facturación
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-800 bg-slate-800/40">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por número de comanda, mesa o mozo..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
        </div>

        {/* Content Body: Split list & detail */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Order list */}
          <div className="overflow-y-auto p-3 space-y-2 max-h-[50vh] md:max-h-none">
            {isLoading ? (
              <div className="py-12 text-center text-slate-400">
                Cargando comandas cerradas pendientes...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No hay comandas de restaurante pendientes por facturar.
              </div>
            ) : (
              filteredOrders.map((o) => {
                const isSelected = selectedOrderId === o.id;
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500/60 ring-1 ring-blue-500/30'
                        : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-sm">
                        {o.table_name || `Mesa ${o.table_number}`}
                      </span>
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-blue-400">
                        {o.order_number}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                      <span>Mozo: {o.waiter_name || 'Sin asignar'}</span>
                      <span className="font-semibold text-emerald-400">
                        ${Number(o.total_usd).toFixed(2)}
                      </span>
                    </div>

                    {o.customer_name && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        Cliente: <strong className="text-slate-300">{o.customer_name}</strong>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Cerrada: {new Date(o.closed_at).toLocaleTimeString()}</span>
                      <span>•</span>
                      <span>{o.items?.length || 0} productos</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Order Detail */}
          <div className="overflow-y-auto p-4 flex flex-col justify-between max-h-[50vh] md:max-h-none bg-slate-900/60">
            {selectedOrder ? (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white">
                      {selectedOrder.table_name || `Mesa ${selectedOrder.table_number}`}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-medium">
                      Comanda Cerrada
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Comanda: <strong className="text-white">{selectedOrder.order_number}</strong></span>
                    <span>Mozo: <strong className="text-white">{selectedOrder.waiter_name || 'N/A'}</strong></span>
                    {selectedOrder.customer_name && (
                      <span>Cliente: <strong className="text-white">{selectedOrder.customer_name}</strong></span>
                    )}
                  </div>
                </div>

                {/* Items list */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Productos a Facturar ({selectedOrder.items?.length || 0})
                  </h4>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {selectedOrder.items?.map((it: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2 rounded bg-slate-800/60 border border-slate-700/60"
                      >
                        <div className="flex-1 mr-2">
                          <span className="text-white font-medium block">{it.product_name}</span>
                          <span className="text-[11px] text-slate-400">
                            {it.customer_name ? `(${it.customer_name}) • ` : ''}
                            {it.quantity} x ${Number(it.unit_price_usd).toFixed(2)}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-emerald-400">
                          ${Number(it.subtotal_usd).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payments already registered in restaurant */}
                {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                  <div className="border-t border-slate-800 pt-3">
                    <span className="text-xs font-semibold text-slate-400 block mb-1">
                      Pagos Registrados en Restaurante:
                    </span>
                    <div className="space-y-1">
                      {selectedOrder.payments.map((p: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs text-slate-300">
                          <span>{p.payment_method_name}</span>
                          <span className="font-mono text-emerald-400">
                            ${Number(p.amount_usd).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="border-t border-slate-800 pt-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-white">Total a Facturar:</span>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-400">
                      ${Number(selectedOrder.total_usd).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400">
                      Bs. {Number(selectedOrder.total_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500 text-sm">
                Selecciona una comanda de la lista para ver el detalle de consumo.
              </div>
            )}

            {/* Import Button */}
            {selectedOrder && (
              <div className="pt-4 border-t border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/30 focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Cargar Comanda al Carrito POS y Facturar</span>
                </button>
              </div>
            )}
          </div>
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
