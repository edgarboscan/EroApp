import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Truck, Check, AlertCircle, Phone, Mail, User } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useAuthStore } from '../../stores/authStore';

export interface SupplierSearchItem {
  id: string;
  name: string;
  rif?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  contactName?: string;
  address?: string;
  paymentTermsDays?: number;
}

export interface SupplierSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (supplier: SupplierSearchItem) => void;
  suppliers?: SupplierSearchItem[];
  title?: string;
  subtitle?: string;
}

export const SupplierSearchModal: React.FC<SupplierSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  suppliers: initialSuppliers,
  title = 'Directorio y Búsqueda de Proveedores',
  subtitle = 'Busca por RIF fiscal, Razón Social o Persona de Contacto',
}) => {
  const { token } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierList, setSupplierList] = useState<SupplierSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);


  // Cargar proveedores si no se proveyeron como props
  useEffect(() => {
    if (!isOpen) return;

    if (initialSuppliers && initialSuppliers.length > 0) {
      setSupplierList(initialSuppliers);
      return;
    }

    const fetchSuppliers = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch('/api/suppliers', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setSupplierList(json.data);
          }
        }
      } catch {
        // En caso de fallo de red
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, [isOpen, initialSuppliers, token]);

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
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return supplierList;

    return supplierList.filter((s) => {
      const rif = (s.rif || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      const contact = (s.contactPerson || s.contactName || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      return rif.includes(term) || name.includes(term) || contact.includes(term) || phone.includes(term) || email.includes(term);
    });
  }, [supplierList, searchTerm]);

  if (!isOpen) return null;

  const handleSelectItem = (sup: SupplierSearchItem) => {
    onSelect(sup);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={<Truck className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />}
      maxWidth="max-w-4xl"
      className="max-h-[92vh]"
      contentClassName="p-0 flex flex-col flex-1 overflow-hidden"
      footer={
        <div className="flex items-center justify-between w-full text-xs text-neutral-500 dark:text-neutral-400">
          <span className="text-[11px]">
            Haz clic en cualquier proveedor o pulsa <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-[10px] font-mono text-neutral-700 dark:text-neutral-300">Esc</kbd> para salir
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
            placeholder="Buscar por RIF (ej. J-12345678-9), razón social o contacto..."
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
          {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'proveedor' : 'proveedores'}
        </Badge>
      </div>

      {/* Cuerpo scrolleable con tabla de resultados */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-xs">
        {loading ? (
          <div className="py-16 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center justify-center gap-2">
            <Truck className="w-8 h-8 animate-pulse text-neutral-300 dark:text-neutral-600" />
            <span>Cargando directorio de proveedores...</span>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-800/40">
            <AlertCircle className="w-7 h-7 text-neutral-400 dark:text-neutral-500" />
            <span className="font-medium text-neutral-700 dark:text-neutral-300">No se encontraron proveedores coincidentes</span>
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-sm">
              Intenta con otro término de búsqueda o número de RIF.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold border-b border-neutral-200 dark:border-neutral-700 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-36">RIF Fiscal</th>
                  <th className="py-2.5 px-3">Razón Social / Proveedor</th>
                  <th className="py-2.5 px-3 w-40">Contacto</th>
                  <th className="py-2.5 px-3 w-36 text-center">Plazo de Pago</th>
                  <th className="py-2.5 px-3 w-24 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredSuppliers.map((s) => {
                  const rifNumber = s.rif || 'S/D';
                  const contact = s.contactPerson || s.contactName;

                  return (
                    <tr
                      key={s.id}
                      onClick={() => handleSelectItem(s)}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-neutral-800 dark:text-neutral-200">
                        <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-1.5 py-0.5 rounded text-[11px]">
                          {rifNumber}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {s.name}
                        </div>
                        {s.address && (
                          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate max-w-xs mt-0.5">
                            {s.address}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">
                        {contact && (
                          <div className="flex items-center gap-1 text-[11px] text-neutral-700 dark:text-neutral-200 font-medium">
                            <User className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
                            <span className="truncate">{contact}</span>
                          </div>
                        )}
                        {s.phone && (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                            <Phone className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
                            <span>{s.phone}</span>
                          </div>
                        )}
                        {s.email && (
                          <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500 truncate max-w-[140px]">
                            <Mail className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
                            <span className="truncate">{s.email}</span>
                          </div>
                        )}
                        {!contact && !s.phone && !s.email && <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">-</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {s.paymentTermsDays ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                            {s.paymentTermsDays} días crédito
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
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
                            handleSelectItem(s);
                          }}
                          className="text-xs py-1 px-2.5 group-hover:bg-sky-50 dark:group-hover:bg-sky-950/40 group-hover:border-sky-300 dark:group-hover:border-sky-700 group-hover:text-sky-700 dark:group-hover:text-sky-300"
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
    </Modal>
  );
};
