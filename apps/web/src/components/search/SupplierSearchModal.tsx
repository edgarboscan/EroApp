import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Truck, Check, AlertCircle, Phone, Mail, User } from 'lucide-react';
import { useEscapeKey } from '../ui/Modal';
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

  useEscapeKey(onClose, isOpen);

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
    <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-lg border border-neutral-200 shadow-2xl flex flex-col overflow-hidden z-10 my-auto">
        {/* Header fijo */}
        <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-neutral-100 text-neutral-700 rounded-lg shrink-0">
              <Truck className="w-5 h-5 text-neutral-700" />
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
              placeholder="Buscar por RIF (ej. J-12345678-9), razón social o contacto..."
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
            {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'proveedor' : 'proveedores'}
          </Badge>
        </div>

        {/* Cuerpo scrolleable con tabla de resultados */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-xs">
          {loading ? (
            <div className="py-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-2">
              <Truck className="w-8 h-8 animate-pulse text-neutral-300" />
              <span>Cargando directorio de proveedores...</span>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-200 rounded-lg bg-neutral-50/50">
              <AlertCircle className="w-7 h-7 text-neutral-400" />
              <span className="font-medium text-neutral-700">No se encontraron proveedores coincidentes</span>
              <span className="text-[11px] text-neutral-400 max-w-sm">
                Intenta con otro término de búsqueda o número de RIF.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-neutral-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-36">RIF Fiscal</th>
                    <th className="py-2.5 px-3">Razón Social / Proveedor</th>
                    <th className="py-2.5 px-3 w-40">Contacto</th>
                    <th className="py-2.5 px-3 w-36 text-center">Plazo de Pago</th>
                    <th className="py-2.5 px-3 w-24 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredSuppliers.map((s) => {
                    const rifNumber = s.rif || 'S/D';
                    const contact = s.contactPerson || s.contactName;

                    return (
                      <tr
                        key={s.id}
                        onClick={() => handleSelectItem(s)}
                        className="hover:bg-neutral-50 cursor-pointer transition-colors group"
                      >
                        <td className="py-2.5 px-3 font-mono font-medium text-neutral-800">
                          <span className="bg-neutral-100 text-neutral-800 px-1.5 py-0.5 rounded text-[11px]">
                            {rifNumber}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-900 group-hover:text-sky-700 transition-colors">
                            {s.name}
                          </div>
                          {s.address && (
                            <div className="text-[11px] text-neutral-400 truncate max-w-xs mt-0.5">
                              {s.address}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          {contact && (
                            <div className="flex items-center gap-1 text-[11px] text-neutral-700 font-medium">
                              <User className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="truncate">{contact}</span>
                            </div>
                          )}
                          {s.phone && (
                            <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-500">
                              <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span>{s.phone}</span>
                            </div>
                          )}
                          {s.email && (
                            <div className="flex items-center gap-1 text-[11px] text-neutral-400 truncate max-w-[140px]">
                              <Mail className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="truncate">{s.email}</span>
                            </div>
                          )}
                          {!contact && !s.phone && !s.email && <span className="text-neutral-400 text-[11px]">-</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {s.paymentTermsDays ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                              {s.paymentTermsDays} días crédito
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-50 text-neutral-500 border border-neutral-200">
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
            Haz clic en cualquier proveedor o pulsa <kbd className="px-1 py-0.5 bg-white border border-neutral-300 rounded text-[10px] font-mono">Esc</kbd> para salir
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
