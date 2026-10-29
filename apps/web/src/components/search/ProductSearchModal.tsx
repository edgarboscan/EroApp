import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Package, Check, ArrowUpDown, Filter, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
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
  currentStock?: number;
  stockWarehouseId?: string;
  stockWarehouseName?: string;
}

export interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: ProductSearchItem) => void;
  products?: ProductSearchItem[];
  title?: string;
  subtitle?: string;
  mode?: 'sale' | 'purchase' | 'transfer' | 'general' | 'pos';
  warehouseId?: string;
  warehouseName?: string;
}

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  products: initialProducts,
  title = 'Buscador de Productos en Catálogo',
  subtitle = 'Busca por código SKU, código de barras o nombre comercial',
  mode = 'general',
  warehouseId,
  warehouseName,
}) => {
  const { token, activeBranchId } = useAuthStore();
  const exchangeRate = useExchangeRateStore((s) => s.rate);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalog, setCatalog] = useState<ProductSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detectedWarehouseName, setDetectedWarehouseName] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar catálogo según depósito de origen, almacén de ventas en POS o almacén predefinido
  useEffect(() => {
    if (!isOpen) return;

    // Si se pasa catálogo manual pero NO se requiere consultar existencia por depósito específico
    if (initialProducts && initialProducts.length > 0 && !warehouseId && mode !== 'transfer' && mode !== 'pos') {
      setCatalog(initialProducts);
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (activeBranchId) headers['X-Branch-Id'] = activeBranchId;

        const params = new URLSearchParams();
        if (warehouseId) {
          params.append('warehouseId', warehouseId);
        } else if (mode === 'pos') {
          params.append('warehouseScope', 'pos');
        } else {
          // Para cualquier otra búsqueda debe mostrar la existencia del almacén predefinido
          params.append('warehouseScope', 'default');
        }
        if (activeBranchId) {
          params.append('branchId', activeBranchId);
        }

        const res = await fetch(`/api/inventory/products?${params.toString()}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setCatalog(json.data);
            if (json.data.length > 0 && json.data[0].stockWarehouseName) {
              setDetectedWarehouseName(json.data[0].stockWarehouseName);
            }
          }
        }
      } catch {
        // En caso de fallo de red
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [isOpen, initialProducts, token, warehouseId, mode, activeBranchId]);

  // Enfocar automáticamente el input de búsqueda al abrir
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const activeWarehouseDisplay = useMemo(() => {
    if (warehouseName) return warehouseName;
    if (detectedWarehouseName) return detectedWarehouseName;
    if (mode === 'transfer') return 'Depósito Origen Seleccionado';
    if (mode === 'pos') return 'Almacén de Ventas';
    return 'Almacén Predefinido';
  }, [warehouseName, detectedWarehouseName, mode]);

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={<Package className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />}
      maxWidth="max-w-4xl"
      className="max-h-[92vh]"
      contentClassName="p-0 flex flex-col flex-1 overflow-hidden"
      footer={
        <div className="flex items-center justify-between w-full text-xs text-neutral-500 dark:text-neutral-400">
          <span className="text-[11px]">
            Haz clic en cualquier fila o pulsa <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-[10px] font-mono text-neutral-700 dark:text-neutral-300">Esc</kbd> para salir
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
            placeholder="Buscar por código SKU, código de barras o descripción del producto..."
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
          {filteredProducts.length} {filteredProducts.length === 1 ? 'ítem' : 'ítems'}
        </Badge>
      </div>

      {/* Indicador de almacén consultado para la disponibilidad */}
      {mode !== 'purchase' && (
        <div className="px-3 sm:px-5 py-1.5 bg-neutral-100/70 dark:bg-neutral-800/40 border-b border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-400 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-medium text-neutral-500 dark:text-neutral-400">Existencia en:</span>
            <strong className="text-neutral-800 dark:text-neutral-200 font-semibold truncate">{activeWarehouseDisplay}</strong>
          </div>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
            {mode === 'transfer'
              ? 'Depósito Origen Seleccionado'
              : mode === 'pos'
              ? 'Almacén Asignado a Ventas'
              : 'Almacén Predefinido'}
          </span>
        </div>
      )}

      {/* Cuerpo scrolleable con tabla de resultados */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-xs">
        {loading ? (
          <div className="py-16 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center justify-center gap-2">
            <Package className="w-8 h-8 animate-pulse text-neutral-300 dark:text-neutral-600" />
            <span>Cargando catálogo de productos...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-800/40">
            <AlertCircle className="w-7 h-7 text-neutral-400 dark:text-neutral-500" />
            <span className="font-medium text-neutral-700 dark:text-neutral-300">No se encontraron productos coincidentes</span>
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-sm">
              Intenta con otro término de búsqueda o verifica que el producto esté registrado en el catálogo maestro.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold border-b border-neutral-200 dark:border-neutral-700 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-28">Código SKU</th>
                  <th className="py-2.5 px-3">Producto / Descripción</th>
                  {mode !== 'purchase' && (
                    <th className="py-2.5 px-3 w-32 text-center">
                      <div>Disponibilidad</div>
                      <div className="text-[9px] font-normal lowercase tracking-normal text-sky-600 dark:text-sky-400 truncate max-w-[120px]">
                        ({activeWarehouseDisplay})
                      </div>
                    </th>
                  )}
                  <th className="py-2.5 px-3 w-36 text-right">
                    {mode === 'purchase' ? 'Costo Ref. (USD)' : 'Precio Base (USD)'}
                  </th>
                  <th className="py-2.5 px-3 w-24 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {filteredProducts.map((p) => {
                    const priceUSD = Number(p.basePrice ?? p.salePrice ?? 0);
                    const costUSD = Number(p.defaultCost ?? p.cost ?? p.costPrice ?? 0);
                    const stock = Number(p.availableStock ?? p.currentStock ?? p.stock ?? 0);

                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleSelectItem(p)}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors group"
                      >
                        <td className="py-2.5 px-3 font-mono font-medium text-neutral-800 dark:text-neutral-200">
                          <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-1.5 py-0.5 rounded text-[11px]">
                            {p.sku}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 flex items-center gap-2">
                            {p.barcode && <span>Barras: {p.barcode}</span>}
                            {(p.categoryName || p.category) && (
                              <span>• {p.categoryName || p.category}</span>
                            )}
                          </div>
                        </td>
                        {mode !== 'purchase' && (
                          <td className="py-2.5 px-3 text-center">
                            {stock > 10 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {stock} disp.
                              </span>
                            ) : stock > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                {stock} bajo
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                                0 stock
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-right">
                          {mode === 'purchase' ? (
                            <div>
                              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                {formatMoneyUSD(costUSD)}
                              </span>
                              {exchangeRate > 0 && (
                                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                                  {formatMoneyVES(costUSD * exchangeRate)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                {formatMoneyUSD(priceUSD)}
                              </span>
                              {exchangeRate > 0 && (
                                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
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
