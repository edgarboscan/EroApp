import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Package, Check, ArrowUpDown, Filter, AlertCircle } from 'lucide-react';
import { useEscapeKey } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD, formatMoneyVES, formatExchangeRate } from '@ero/shared';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';

export interface ProductSearchItem {
  id: string;
  sku: string;
  name: string;
  barcode?: string;
  categoryName?: string;
  category?: string;
  unitOfMeasure?: string;
  basePrice?: number;
  salePrice?: number;
  defaultCost?: number;
  cost?: number;
  costPrice?: number;
  taxRate?: number;
  availableStock?: number;
  stock?: number;
  minStock?: number;
}

export interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: ProductSearchItem) => void;
  products?: ProductSearchItem[];
  title?: string;
  subtitle?: string;
  mode?: 'sale' | 'purchase' | 'transfer' | 'general';
}

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  products: initialProducts,
  title = 'Buscador de Productos en Catálogo',
  subtitle = 'Busca por código SKU, código de barras o nombre comercial',
  mode = 'general',
}) => {
  const { token, activeBranchId } = useAuthStore();
  const exchangeRate = useExchangeRateStore((s) => s.rate);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalog, setCatalog] = useState<ProductSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose, isOpen);

  // Cargar catálogo si no se proveyó
  useEffect(() => {
    if (!isOpen) return;

    if (initialProducts && initialProducts.length > 0) {
      setCatalog(initialProducts);
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch('/api/inventory/products', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setCatalog(json.data);
          }
        }
      } catch {
        // En caso de fallo de red
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [isOpen, initialProducts, token]);

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
  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return catalog;

    return catalog.filter((p) => {
      const matchSku = p.sku?.toLowerCase().includes(term);
      const matchName = p.name?.toLowerCase().includes(term);
      const matchBarcode = p.barcode?.toLowerCase().includes(term);
      const matchCategory = (p.categoryName || p.category)?.toLowerCase().includes(term);
      return matchSku || matchName || matchBarcode || matchCategory;
    });
  }, [catalog, searchTerm]);

  if (!isOpen) return null;

  const handleSelectItem = (prod: ProductSearchItem) => {
    onSelect(prod);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-lg border border-neutral-200 shadow-2xl flex flex-col overflow-hidden z-10 my-auto">
        {/* Header fijo */}
        <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-neutral-100 text-neutral-700 rounded-lg shrink-0">
              <Package className="w-5 h-5 text-neutral-700" />
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
              placeholder="Buscar por código SKU, código de barras o nombre del producto..."
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
            {filteredProducts.length} {filteredProducts.length === 1 ? 'coincidencia' : 'coincidencias'}
          </Badge>
        </div>

        {/* Cuerpo scrolleable con tabla de resultados */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-xs">
          {loading ? (
            <div className="py-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-2">
              <Package className="w-8 h-8 animate-pulse text-neutral-300" />
              <span>Cargando catálogo de productos...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-200 rounded-lg bg-neutral-50/50">
              <AlertCircle className="w-7 h-7 text-neutral-400" />
              <span className="font-medium text-neutral-700">No se encontraron productos coincidentes</span>
              <span className="text-[11px] text-neutral-400 max-w-sm">
                Intenta con otro término de búsqueda o verifica que el producto esté registrado en el catálogo maestro.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-neutral-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-28">Código SKU</th>
                    <th className="py-2.5 px-3">Producto / Descripción</th>
                    {mode !== 'purchase' && (
                      <th className="py-2.5 px-3 w-28 text-center">Disponibilidad</th>
                    )}
                    <th className="py-2.5 px-3 w-36 text-right">
                      {mode === 'purchase' ? 'Costo Ref. (USD)' : 'Precio Base (USD)'}
                    </th>
                    <th className="py-2.5 px-3 w-24 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredProducts.map((p) => {
                    const priceUSD = Number(p.basePrice ?? p.salePrice ?? 0);
                    const costUSD = Number(p.defaultCost ?? p.cost ?? p.costPrice ?? 0);
                    const stock = Number(p.availableStock ?? p.stock ?? 0);

                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleSelectItem(p)}
                        className="hover:bg-neutral-50 cursor-pointer transition-colors group"
                      >
                        <td className="py-2.5 px-3 font-mono font-medium text-neutral-800">
                          <span className="bg-neutral-100 text-neutral-800 px-1.5 py-0.5 rounded text-[11px]">
                            {p.sku}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-neutral-900 group-hover:text-sky-700 transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-2">
                            {p.barcode && <span>Barras: {p.barcode}</span>}
                            {(p.categoryName || p.category) && (
                              <span>• {p.categoryName || p.category}</span>
                            )}
                          </div>
                        </td>
                        {mode !== 'purchase' && (
                          <td className="py-2.5 px-3 text-center">
                            {stock > 10 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {stock} disp.
                              </span>
                            ) : stock > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                {stock} bajo
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-500 border border-neutral-200">
                                0 stock
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-right">
                          {mode === 'purchase' ? (
                            <div>
                              <span className="font-mono font-bold text-neutral-900">
                                {formatMoneyUSD(costUSD)}
                              </span>
                              {exchangeRate > 0 && (
                                <div className="text-[10px] text-neutral-400 font-mono">
                                  {formatMoneyVES(costUSD * exchangeRate)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="font-mono font-bold text-neutral-900">
                                {formatMoneyUSD(priceUSD)}
                              </span>
                              {exchangeRate > 0 && (
                                <div className="text-[10px] text-neutral-400 font-mono">
                                  {formatMoneyVES(priceUSD * exchangeRate)}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectItem(p);
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
            Haz clic en cualquier fila o pulsa <kbd className="px-1 py-0.5 bg-white border border-neutral-300 rounded text-[10px] font-mono">Esc</kbd> para salir
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
