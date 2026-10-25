import React, { useState, useEffect, useCallback } from 'react';
import { Search, ArrowRight, Clock } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

interface ImportRestaurantOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportOrder: (order: any) => void;
  token: string | null;
  activeBranchId: string | null;
  currentImportedOrderId?: string | null;
}

export const ImportRestaurantOrderModal: React.FC<ImportRestaurantOrderModalProps> = ({
  isOpen,
  onClose,
  onImportOrder,
  token,
  activeBranchId,
  currentImportedOrderId,
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
        // Excluir estrictamente cualquier comanda facturada o ya en carrito
        const unbilledOnly = data.data.filter(
          (o: any) =>
            o.is_invoiced !== 1 &&
            o.is_invoiced !== true &&
            !o.pos_invoice_id &&
            (!currentImportedOrderId || o.id !== currentImportedOrderId)
        );
        setOrders(unbilledOnly);
        if (unbilledOnly.length > 0 && !selectedOrderId) {
          setSelectedOrderId(unbilledOnly[0].id);
        }
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, selectedOrderId, currentImportedOrderId]);

  useEffect(() => {
    if (isOpen) {
      fetchUnbilledOrders();
    }
  }, [isOpen, fetchUnbilledOrders]);

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    // Regla estricta: las comandas ya facturadas nunca deben aparecer
    if (o.is_invoiced === 1 || o.is_invoiced === true || Boolean(o.pos_invoice_id)) {
      return false;
    }
    if (currentImportedOrderId && o.id === currentImportedOrderId) {
      return false;
    }
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importar Comanda de Restaurante para Facturación"
      subtitle="Selecciona una comanda cerrada pendiente para transferir sus consumos al ticket POS"
      size="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {selectedOrder ? (
              <span>Comanda seleccionada: <strong className="text-neutral-800 dark:text-neutral-200">{selectedOrder.order_number}</strong></span>
            ) : (
              <span>Ninguna comanda seleccionada</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              size="sm"
              disabled={!selectedOrder}
              onClick={handleConfirmImport}
            >
              <ArrowRight className="w-4 h-4 mr-1.5" />
              Cargar y Facturar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por número de comanda, mesa o mozo..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 text-sm focus-visible:ring-2 focus-visible:ring-sky-500"
          />
        </div>

        {/* Content Body: Split list & detail */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden min-h-[380px]">
          {/* Order list */}
          <div className="overflow-y-auto p-3 space-y-2 max-h-[420px] bg-neutral-50/50 dark:bg-neutral-900/40 border-r border-neutral-200 dark:border-neutral-800">
            {isLoading ? (
              <div className="py-16 text-center text-xs text-neutral-500 dark:text-neutral-400">
                Cargando comandas cerradas pendientes...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-xs text-neutral-500 dark:text-neutral-400">
                No hay comandas de restaurante pendientes por facturar.
              </div>
            ) : (
              filteredOrders.map((o) => {
                const isSelected = selectedOrderId === o.id;
                const orderTip = Number(o.tip_usd || 0);
                const orderTotalWithTip = Number(o.total_usd) + orderTip;
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 ring-1 ring-sky-400/30'
                        : 'bg-white dark:bg-neutral-800/80 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                        {o.table_name || `Mesa ${o.table_number}`}
                      </span>
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sky-600 dark:text-sky-400 font-semibold">
                        {o.order_number}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                      <span>Mozo: {o.waiter_name || 'Sin asignar'}</span>
                      <div className="text-right">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono block">
                          ${orderTotalWithTip.toFixed(2)}
                        </span>
                        {orderTip > 0 && (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                            (incl. ${orderTip.toFixed(2)} propina)
                          </span>
                        )}
                      </div>
                    </div>

                    {o.customer_name && (
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                        Cliente: <strong className="text-neutral-700 dark:text-neutral-300">{o.customer_name}</strong>
                      </div>
                    )}

                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Cerrada: {o.closed_at ? new Date(o.closed_at).toLocaleTimeString('es-VE') : 'Reciente'}</span>
                      <span>•</span>
                      <span>{o.items?.length || 0} productos</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Order Detail */}
          <div className="overflow-y-auto p-4 flex flex-col justify-between max-h-[420px] bg-white dark:bg-neutral-900">
            {selectedOrder ? (
              <div className="space-y-4">
                <div className="border-b border-neutral-200 dark:border-neutral-800 pb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                      {selectedOrder.table_name || `Mesa ${selectedOrder.table_number}`}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-medium">
                      Comanda Cerrada
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Comanda: <strong className="text-neutral-800 dark:text-neutral-200">{selectedOrder.order_number}</strong></span>
                    <span>Mozo: <strong className="text-neutral-800 dark:text-neutral-200">{selectedOrder.waiter_name || 'N/A'}</strong></span>
                    {selectedOrder.customer_name && (
                      <span>Cliente: <strong className="text-neutral-800 dark:text-neutral-200">{selectedOrder.customer_name}</strong></span>
                    )}
                  </div>
                </div>

                {/* Items list */}
                <div>
                  <h4 className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
                    Productos a Facturar ({selectedOrder.items?.length || 0})
                  </h4>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {selectedOrder.items?.map((it: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700"
                      >
                        <div className="flex-1 mr-2 min-w-0">
                          <span className="text-neutral-900 dark:text-neutral-100 font-medium block truncate">{it.product_name}</span>
                          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            {it.customer_name ? `(${it.customer_name}) • ` : ''}
                            {it.quantity} x ${Number(it.unit_price_usd).toFixed(2)}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                          ${Number(it.subtotal_usd).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Propina voluntaria registrada en el cierre de comanda */}
                {Number(selectedOrder.tip_usd || 0) > 0 && (
                  <div className="border-t border-neutral-200 dark:border-neutral-800 pt-2.5">
                    <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <div>
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300 block">
                          Propina del Servicio (Restaurante):
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                          Exenta de IVA • Registrada por el personal de sala
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 block">
                          +${Number(selectedOrder.tip_usd).toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Total a facturar */}
                <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 block">Total a Facturar:</span>
                    {Number(selectedOrder.tip_usd || 0) > 0 && (
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                        Consumo: ${Number(selectedOrder.total_usd).toFixed(2)} + Propina: ${Number(selectedOrder.tip_usd).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      ${(Number(selectedOrder.total_usd) + Number(selectedOrder.tip_usd || 0)).toFixed(2)}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                      Bs. {((Number(selectedOrder.total_usd) + Number(selectedOrder.tip_usd || 0)) * Number(selectedOrder.exchange_rate || 1)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-neutral-500 dark:text-neutral-400 text-xs">
                Selecciona una comanda de la lista para ver el detalle de consumo.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
