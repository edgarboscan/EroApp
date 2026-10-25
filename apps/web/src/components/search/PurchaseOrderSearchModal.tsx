import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, ShoppingCart, Check, Calendar, Building2, PackageCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatMoneyUSD, formatMoneyVES } from '../../utils/formatters';

export interface PurchaseOrderSearchItem {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  supplierRif: string;
  branchId?: string;
  branchName?: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  currency: 'USD' | 'VES';
  exchangeRate: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  itemsCount?: number;
  notes?: string | null;
}

export interface PurchaseOrderSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (order: PurchaseOrderSearchItem) => void;
  orders?: PurchaseOrderSearchItem[];
  supplierId?: string;
  title?: string;
  subtitle?: string;
}

export const PurchaseOrderSearchModal: React.FC<PurchaseOrderSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  orders = [],
  supplierId,
  title = 'Importar Orden de Compra',
  subtitle = 'Selecciona una orden de compra para verificar lo ordenado contra lo recibido físicamente',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [filterBySupplier, setFilterBySupplier] = useState(Boolean(supplierId));
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setFilterBySupplier(Boolean(supplierId));
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, supplierId]);

  const receivableOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === 'CANCELLED' || o.status === 'RECEIVED') return false;
      if (!includeDrafts && o.status === 'DRAFT') return false;
      return true;
    });
  }, [orders, includeDrafts]);

  const filteredOrders = useMemo(() => {
    let list = receivableOrders;

    if (filterBySupplier && supplierId) {
      list = list.filter((o) => o.supplierId === supplierId);
    }

    const term = searchTerm.trim().toLowerCase();
    if (!term) return list;

    return list.filter((o) => {
      const num = (o.orderNumber || '').toLowerCase();
      const sup = (o.supplierName || '').toLowerCase();
      const rif = (o.supplierRif || '').toLowerCase();
      const branch = (o.branchName || '').toLowerCase();
      return (
        num.includes(term) ||
        sup.includes(term) ||
        rif.includes(term) ||
        branch.includes(term)
      );
    });
  }, [receivableOrders, filterBySupplier, supplierId, searchTerm]);

  if (!isOpen) return null;

  const handleSelect = (order: PurchaseOrderSearchItem) => {
    onSelect(order);
    onClose();
  };

  const renderStatusBadge = (status: PurchaseOrderSearchItem['status']) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral">Borrador</Badge>;
      case 'CONFIRMED':
        return <Badge variant="info">Confirmada</Badge>;
      case 'PARTIALLY_RECEIVED':
        return <Badge variant="warning">Recepción Parcial</Badge>;
      case 'RECEIVED':
        return <Badge variant="success">Completada</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="4xl"
    >
      <div className="space-y-4">
        {/* Barra de Búsqueda y Filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por Nº de orden (ej. OC-2026-0001), proveedor o RIF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDrafts}
                onChange={(e) => setIncludeDrafts(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span>Incluir borradores</span>
            </label>

            {supplierId && (
              <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterBySupplier}
                  onChange={(e) => setFilterBySupplier(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span>Solo proveedor actual</span>
              </label>
            )}
          </div>
        </div>

        {/* Tabla de Resultados */}
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg max-h-96">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10 font-medium">
              <tr>
                <th className="py-2.5 px-3">Nº Orden</th>
                <th className="py-2.5 px-3">Proveedor & RIF</th>
                <th className="py-2.5 px-3">Fecha & Entrega</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Monto Total</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No se encontraron órdenes de compra disponibles para recibir</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {filterBySupplier
                        ? 'Prueba desmarcando "Solo proveedor actual" o verifica que la orden esté en estado Confirmada'
                        : 'Asegúrate de que existan órdenes en estado Confirmada o Parcialmente Recibida'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-semibold text-sky-700 dark:text-sky-400">
                      {order.orderNumber}
                      {order.branchName && (
                        <span className="block text-[10px] font-normal text-neutral-500">
                          {order.branchName}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">
                        {order.supplierName}
                      </p>
                      <p className="font-mono text-[10px] text-neutral-500">{order.supplierRif}</p>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                      <p>{new Date(order.orderDate).toLocaleDateString('es-VE')}</p>
                      {order.expectedDeliveryDate && (
                        <span className="text-[10px] text-neutral-500 block">
                          Est: {order.expectedDeliveryDate}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">{renderStatusBadge(order.status)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {formatMoneyUSD(order.totalAmount)}
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        {formatMoneyVES(order.totalAmount * order.exchangeRate)}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSelect(order)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 ml-auto"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Importar</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pie informativo */}
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 border-t border-neutral-200 dark:border-neutral-700">
          <span>{filteredOrders.length} orden(es) disponible(s) para recepción</span>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
