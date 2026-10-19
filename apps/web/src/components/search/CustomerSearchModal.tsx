import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Users, Check, AlertCircle, Phone, Mail, MapPin } from 'lucide-react';
import { useEscapeKey } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD } from '@ero/shared';

export interface CustomerSearchItem {
  id: string;
  name: string;
  doc?: string;
  documentId?: string;
  rif?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditEnabled?: boolean;
  creditLimit?: number;
  creditDays?: number;
}

export interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: CustomerSearchItem) => void;
  customers?: CustomerSearchItem[];
  title?: string;
  subtitle?: string;
}

export const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  customers: initialCustomers,
  title = 'Directorio y Búsqueda de Clientes',
  subtitle = 'Busca por Cédula / RIF, Razón Social o Teléfono',
}) => {
  const { token } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [customerList, setCustomerList] = useState<CustomerSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose, isOpen);

  // Cargar clientes si no se proveyeron como props
  useEffect(() => {
    if (!isOpen) return;

    if (initialCustomers && initialCustomers.length > 0) {
      setCustomerList(initialCustomers);
      return;
    }

    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch('/api/customers', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setCustomerList(json.data);
          }
        }
      } catch {
        // En caso de fallo de red
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [isOpen, initialCustomers, token]);

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
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return customerList;

    return customerList.filter((c) => {
      const doc = (c.doc || c.documentId || c.rif || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      return doc.includes(term) || name.includes(term) || phone.includes(term) || email.includes(term);
    });
  }, [customerList, searchTerm]);

  if (!isOpen) return null;

  const handleSelectItem = (cust: CustomerSearchItem) => {
    onSelect(cust);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-lg border border-neutral-200 shadow-2xl flex flex-col overflow-hidden z-10 my-auto">
        {/* Header fijo */}
        <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-neutral-100 text-neutral-700 rounded-lg shrink-0">
              <Users className="w-5 h-5 text-neutral-700" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-semibold text-neutral-900 truncate">{title}</h3>
              <p className="text-xs text-neutral-500 truncate">{subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 cursor-pointer"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de búsqueda interactiva */}
        <div className="p-3 sm:px-5 bg-neutral-50 border-b border-neutral-200 shrink-0 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cédula, RIF, razón social o teléfono..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-neutral-400 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5 rounded cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Badge variant="neutral" className="shrink-0 text-xs font-mono">
            {filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente' : 'clientes'}
          </Badge>
        </div>

        {/* Cuerpo scrolleable con tabla de resultados */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-xs">
          {loading ? (
            <div className="py-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-2">
              <Users className="w-8 h-8 animate-pulse text-neutral-300" />
              <span>Cargando directorio de clientes...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-200 rounded-lg bg-neutral-50/50">
              <AlertCircle className="w-7 h-7 text-neutral-400" />
              <span className="font-medium text-neutral-700">No se encontraron clientes coincidentes</span>
              <span className="text-[11px] text-neutral-400 max-w-sm">
                Intenta con otro número de documento o nombre del cliente.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-neutral-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-32">Documento / RIF</th>
                    <th className="py-2.5 px-3">Nombre / Razón Social</th>
                    <th className="py-2.5 px-3 w-40">Contacto</th>
                    <th className="py-2.5 px-3 w-36 text-center">Condición de Crédito</th>
                    <th className="py-2.5 px-3 w-24 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredCustomers.map((c) => {
                    const docNumber = c.doc || c.documentId || c.rif || 'S/D';

                    return (
                      <tr
                        key={c.id}
                        onClick={() => handleSelectItem(c)}
                        className="hover:bg-neutral-50 cursor-pointer transition-colors group"
                      >
                        <td className="py-2.5 px-3 font-mono font-medium text-neutral-800">
                          <span className="bg-neutral-100 text-neutral-800 px-1.5 py-0.5 rounded text-[11px]">
                            {docNumber}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-900 group-hover:text-sky-700 transition-colors">
                            {c.name}
                          </div>
                          {c.address && (
                            <div className="text-[11px] text-neutral-400 truncate max-w-xs flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{c.address}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          {c.phone && (
                            <div className="flex items-center gap-1 text-[11px] font-mono">
                              <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span>{c.phone}</span>
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-1 text-[11px] text-neutral-400 truncate max-w-[140px]">
                              <Mail className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </div>
                          )}
                          {!c.phone && !c.email && <span className="text-neutral-400 text-[11px]">-</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {c.creditEnabled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Crédito: {formatMoneyUSD(Number(c.creditLimit || 0))}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-500 border border-neutral-200">
                              Contado
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectItem(c);
                            }}
                            className="text-xs py-1 px-2.5 group-hover:bg-sky-50 group-hover:border-sky-300 group-hover:text-sky-700"
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
        <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-neutral-500">
            Haz clic en cualquier cliente o pulsa <kbd className="px-1 py-0.5 bg-white border border-neutral-300 rounded text-[10px] font-mono">Esc</kbd> para salir
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
