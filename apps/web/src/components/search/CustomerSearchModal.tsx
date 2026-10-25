import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Users, Check, AlertCircle, Phone, Mail, MapPin, Ban } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD } from '@ero/shared';

export interface CustomerSearchItem {
  id: string;
  name: string;
  doc?: string;
  docType?: string;
  docNumber?: string;
  documentId?: string;
  rif?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditEnabled?: boolean;
  creditLimit?: number;
  creditDays?: number;
  isActive?: boolean;
  isBlocked?: boolean;
  is_blocked?: boolean | number;
  status?: string;
  blockReason?: string;
  block_reason?: string;
}

export interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: CustomerSearchItem) => void;
  customers?: CustomerSearchItem[];
  title?: string;
  subtitle?: string;
  allowBlocked?: boolean;
}

export const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  customers: initialCustomers,
  title = 'Directorio y Búsqueda de Clientes',
  subtitle = 'Busca por Cédula / RIF, Razón Social o Teléfono',
  allowBlocked = false,
}) => {
  const { token } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [customerList, setCustomerList] = useState<CustomerSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);


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
    const isBlocked = Boolean(cust.isBlocked || cust.is_blocked || cust.status === 'BLOCKED');
    if (isBlocked && !allowBlocked) {
      return;
    }
    onSelect(cust);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={<Users className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />}
      maxWidth="max-w-4xl"
      className="max-h-[92vh]"
      contentClassName="p-0 flex flex-col flex-1 overflow-hidden"
      footer={
        <div className="flex items-center justify-between w-full text-xs text-neutral-500 dark:text-neutral-400">
          <span className="text-[11px]">
            Haz clic en cualquier cliente o pulsa <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-[10px] font-mono text-neutral-700 dark:text-neutral-300">Esc</kbd> para salir
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      {/* Barra de búsqueda interactiva */}
      <div className="p-3 sm:px-5 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700 shrink-0 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cédula, RIF, razón social o teléfono..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-0.5 rounded cursor-pointer"
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
          <div className="py-16 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center justify-center gap-2">
            <Users className="w-8 h-8 animate-pulse text-neutral-300 dark:text-neutral-600" />
            <span>Cargando directorio de clientes...</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-800/40">
            <AlertCircle className="w-7 h-7 text-neutral-400 dark:text-neutral-500" />
            <span className="font-medium text-neutral-700 dark:text-neutral-300">No se encontraron clientes coincidentes</span>
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-sm">
              Intenta con otro número de documento o nombre del cliente.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold border-b border-neutral-200 dark:border-neutral-700 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-32">Documento / RIF</th>
                  <th className="py-2.5 px-3">Nombre / Razón Social</th>
                  <th className="py-2.5 px-3 w-40">Contacto</th>
                  <th className="py-2.5 px-3 w-36 text-center">Condición de Crédito</th>
                  <th className="py-2.5 px-3 w-24 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredCustomers.map((c) => {
                  const docNumber = c.doc || c.documentId || c.rif || (c.docType && c.docNumber ? `${c.docType}-${c.docNumber}` : 'S/D');
                  const isBlocked = Boolean(c.isBlocked || c.is_blocked || c.status === 'BLOCKED');
                  const blockReason = c.blockReason || c.block_reason;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => {
                        if (isBlocked && !allowBlocked) return;
                        handleSelectItem(c);
                      }}
                      className={`transition-colors group ${
                        isBlocked
                          ? 'bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/60 dark:hover:bg-red-950/30 cursor-not-allowed'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-neutral-800 dark:text-neutral-200">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                          isBlocked
                            ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                        }`}>
                          {docNumber}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold transition-colors ${
                            isBlocked
                              ? 'text-neutral-700 dark:text-neutral-300'
                              : 'text-neutral-900 dark:text-neutral-100 group-hover:text-sky-600 dark:group-hover:text-sky-400'
                          }`}>
                            {c.name}
                          </span>
                          {isBlocked && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                              <Ban className="w-3 h-3 shrink-0" />
                              BLOQUEADO
                            </span>
                          )}
                        </div>
                        {isBlocked && blockReason && (
                          <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 font-medium">
                            Motivo: {blockReason}
                          </div>
                        )}
                        {c.address && (
                          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate max-w-xs flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{c.address}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">
                        {c.phone && (
                          <div className="flex items-center gap-1 text-[11px] font-mono">
                            <Phone className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500 truncate max-w-[140px]">
                            <Mail className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </div>
                        )}
                        {!c.phone && !c.email && <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">-</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {c.creditEnabled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Crédito: {formatMoneyUSD(Number(c.creditLimit || 0))}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                            Contado
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isBlocked && !allowBlocked ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled
                            className="text-xs py-1 px-2.5 opacity-60 cursor-not-allowed bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                            title={blockReason || 'Cliente bloqueado'}
                          >
                            <Ban className="w-3.5 h-3.5 mr-1 shrink-0" />
                            Bloqueado
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectItem(c);
                            }}
                            className="text-xs py-1 px-2.5 group-hover:bg-sky-50 dark:group-hover:bg-sky-950/40 group-hover:border-sky-300 dark:group-hover:border-sky-700 group-hover:text-sky-700 dark:group-hover:text-sky-300"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Elegir
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
