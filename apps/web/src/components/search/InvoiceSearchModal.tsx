import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Receipt, Check, AlertCircle, Calendar } from 'lucide-react';
import { useEscapeKey } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatMoneyUSD } from '@ero/shared';

export interface InvoiceSearchItem {
  id: string;
  invoiceNumber?: string;
  documentNumber?: string;
  controlNumber?: string;
  supplierName?: string;
  supplierRif?: string;
  customerName?: string;
  customerDoc?: string;
  partyName?: string;
  partyDoc?: string;
  amountTotal?: number;
  totalAmount?: number;
  amountPaid?: number;
  amountBalance?: number;
  dueDate?: string;
  issueDate?: string;
  createdAt?: string;
  hasIvaWithholding?: boolean;
  hasIslrWithholding?: boolean;
  baseTaxableAmount?: number;
  taxAmount?: number;
  status?: string;
}

export interface InvoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: InvoiceSearchItem) => void;
  items?: InvoiceSearchItem[];
  invoices?: InvoiceSearchItem[];
  title?: string;
  subtitle?: string;
  type?: 'payable' | 'receivable' | 'withholding';
  mode?: 'payable' | 'receivable' | 'withholding';
}

export const InvoiceSearchModal: React.FC<InvoiceSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  items,
  invoices,
  title = 'Búsqueda de Facturas y Documentos',
  subtitle = 'Busca por número de factura, cliente, proveedor o RIF',
  type,
  mode,
}) => {
  const activeType = type || mode || 'payable';
  const effectiveItems = items || invoices || [];
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose, isOpen);

  // Enfocar automáticamente el input de búsqueda al abrir
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filtrado reactivo en memoria
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return effectiveItems;

    return effectiveItems.filter((inv) => {
      const invNum = (inv.invoiceNumber || inv.documentNumber || '').toLowerCase();
      const ctrlNum = (inv.controlNumber || '').toLowerCase();
      const partyName = (inv.supplierName || inv.customerName || inv.partyName || '').toLowerCase();
      const partyDoc = (inv.supplierRif || inv.customerDoc || inv.partyDoc || '').toLowerCase();
      return invNum.includes(term) || ctrlNum.includes(term) || partyName.includes(term) || partyDoc.includes(term);
    });
  }, [effectiveItems, searchTerm]);

  if (!isOpen) return null;

  const handleSelectItem = (item: InvoiceSearchItem) => {
    onSelect(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden z-10 my-auto">
        {/* Header fijo */}
        <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg shrink-0">
              <Receipt className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{title}</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de búsqueda interactiva */}
        <div className="p-3 sm:px-5 bg-neutral-50 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-800 shrink-0 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por número de factura, cliente/proveedor o RIF..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-neutral-400 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 rounded cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Badge variant="neutral" className="shrink-0 text-xs font-mono">
            {filteredItems.length} {filteredItems.length === 1 ? 'documento' : 'documentos'}
          </Badge>
        </div>

        {/* Cuerpo scrolleable con tabla de resultados */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-xs">
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-850/50">
              <AlertCircle className="w-7 h-7 text-neutral-400 dark:text-neutral-500" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">No se encontraron documentos coincidentes</span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-sm">
                Intenta con otro número de factura o nombre del titular.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 font-semibold border-b border-neutral-200 dark:border-neutral-800 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-32">Nº Factura</th>
                    <th className="py-2.5 px-3">{activeType === 'payable' || activeType === 'withholding' ? 'Proveedor' : 'Cliente'}</th>
                    <th className="py-2.5 px-3 w-32 text-center">Vencimiento</th>
                    <th className="py-2.5 px-3 w-32 text-right">Monto Total</th>
                    <th className="py-2.5 px-3 w-32 text-right">Saldo Pendiente</th>
                    <th className="py-2.5 px-3 w-24 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {filteredItems.map((inv) => {
                    const partyName = inv.partyName || inv.supplierName || inv.customerName || 'S/N';
                    const partyDoc = inv.partyDoc || inv.supplierRif || inv.customerDoc || '';
                    const total = Number(inv.amountTotal ?? inv.totalAmount ?? 0);
                    const balance = Number(inv.amountBalance ?? total);
                    const docNumber = inv.documentNumber || inv.invoiceNumber || inv.id.slice(0, 8);

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => handleSelectItem(inv)}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors group"
                      >
                        <td className="py-2.5 px-3 font-mono font-medium text-neutral-800 dark:text-neutral-200">
                          <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-1.5 py-0.5 rounded text-[11px]">
                            {docNumber}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors">
                            {partyName}
                          </div>
                          {partyDoc && (
                            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
                              {partyDoc}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-neutral-600 dark:text-neutral-400">
                          {inv.dueDate ? (
                            <div className="flex items-center justify-center gap-1 text-[11px] font-mono">
                              <Calendar className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
                              <span>{inv.dueDate}</span>
                            </div>
                          ) : (
                            <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-neutral-700 dark:text-neutral-300">
                          {formatMoneyUSD(total)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                          {formatMoneyUSD(balance)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectItem(inv);
                            }}
                            className="text-xs py-1 px-2.5 group-hover:bg-sky-50 dark:group-hover:bg-sky-950/50 group-hover:border-sky-300 dark:group-hover:border-sky-800 group-hover:text-sky-700 dark:group-hover:text-sky-400"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Elegir
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer fijo */}
        <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Haz clic en cualquier documento o pulsa <kbd className="px-1 py-0.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-[10px] font-mono text-neutral-700 dark:text-neutral-300">Esc</kbd> para salir
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
