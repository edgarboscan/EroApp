import React, { useState, useEffect, useMemo } from "react";
import { DataTable, Column } from "../../components/ui/DataTable";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { PdfViewerModal } from "../../components/ui/PdfViewerModal";
import {
  Plus,
  MapPin,
  FileDown,
  RefreshCw,
  Search,
  Package,
  Layers,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { formatMoneyUSD, formatNumber } from "../../utils/formatters";

interface ProductItem {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  productType?: string;
  departmentId?: string;
  departmentName?: string;
  groupId?: string;
  groupName?: string;
  subgroupId?: string;
  subgroupName?: string;
  costPrice: number;
  basePrice: number;
  taxRate: number;
  taxInclusive?: boolean;
  minStock?: number;
  maxStock?: number;
  currentStock: number;
  aisle?: string;
  shelf?: string;
  compartment?: string;
  isActive?: boolean;
}

interface Department {
  id: string;
  name: string;
}

interface Group {
  id: string;
  departmentId: string;
  name: string;
}

export const ProductCatalog: React.FC = () => {
  const { token, activeWarehouseId } = useAuthStore();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<
    "all" | "in_stock" | "low_stock" | "out_of_stock"
  >("all");

  // Modal de Exportación y Visualización PDF
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  const fetchHierarchy = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [depRes, grpRes] = await Promise.all([
        fetch("/api/inventory/departments", { headers }),
        fetch("/api/inventory/groups", { headers }),
      ]);
      if (depRes.ok) {
        const depJson = await depRes.json();
        setDepartments(depJson.data || []);
      }
      if (grpRes.ok) {
        const grpJson = await grpRes.json();
        setGroups(grpJson.data || []);
      }
    } catch {
      // Ignorar fallos de jerarquía en caso de que esté vacía
    }
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const params = new URLSearchParams();
      if (activeWarehouseId) params.append("warehouseId", activeWarehouseId);
      if (selectedDepartment) params.append("departmentId", selectedDepartment);
      if (selectedGroup) params.append("groupId", selectedGroup);
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const url = `/api/inventory/products?${params.toString()}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error("No se pudo cargar el catálogo de productos");
      }
      const json = await res.json();
      setProducts(json.data || []);
    } catch (err: any) {
      setError(err.message || "Error al obtener productos");
      toast.error("Error al cargar productos");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHierarchy();
  }, [token]);

  useEffect(() => {
    fetchProducts();
  }, [token, activeWarehouseId, selectedDepartment, selectedGroup]);

  // Filtrado reactivo en cliente (para stock y búsqueda rápida)
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Filtro de stock
      if (stockFilter === "in_stock" && (p.currentStock || 0) <= 0)
        return false;
      if (stockFilter === "out_of_stock" && (p.currentStock || 0) > 0)
        return false;
      if (stockFilter === "low_stock") {
        const min = p.minStock || 5;
        if ((p.currentStock || 0) > min) return false;
      }

      // Filtro de búsqueda local
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchSku = p.sku?.toLowerCase().includes(term);
        const matchName = p.name?.toLowerCase().includes(term);
        const matchBarcode = p.barcode?.toLowerCase().includes(term);
        const matchDept = p.departmentName?.toLowerCase().includes(term);
        if (!matchSku && !matchName && !matchBarcode && !matchDept)
          return false;
      }

      return true;
    });
  }, [products, stockFilter, searchTerm]);

  const pdfEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (activeWarehouseId) params.append("warehouseId", activeWarehouseId);
    if (selectedDepartment) params.append("departmentId", selectedDepartment);
    if (selectedGroup) params.append("groupId", selectedGroup);
    if (searchTerm.trim()) params.append("search", searchTerm.trim());
    return `/api/inventory/products/pdf?${params.toString()}`;
  }, [activeWarehouseId, selectedDepartment, selectedGroup, searchTerm]);

  // Exportar CSV
  const handleExportCSV = () => {
    if (filteredProducts.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }

    const headers = [
      "SKU",
      "Código de Barras",
      "Producto",
      "Departamento",
      "Grupo",
      "Subgrupo",
      "Costo ($)",
      "Precio Base ($)",
      "Tasa IVA (%)",
      "PVP Final ($)",
      "Stock Actual",
      "Pasillo",
      "Estante",
      "Compartimiento",
    ];

    const rows = filteredProducts.map((p) => {
      const taxMultiplier = 1 + (p.taxRate || 0) / 100;
      const finalPrice = (p.basePrice || 0) * taxMultiplier;
      return [
        `"${p.sku || ""}"`,
        `"${p.barcode || ""}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.departmentName || ""}"`,
        `"${p.groupName || ""}"`,
        `"${p.subgroupName || ""}"`,
        (p.costPrice || 0).toFixed(2),
        (p.basePrice || 0).toFixed(2),
        (p.taxRate || 0).toFixed(2),
        finalPrice.toFixed(2),
        p.currentStock || 0,
        `"${p.aisle || ""}"`,
        `"${p.shelf || ""}"`,
        `"${p.compartment || ""}"`,
      ].join(",");
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `catalogo_productos_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("Archivo CSV exportado exitosamente");
  };

  const columns: Column<ProductItem>[] = [
    {
      header: "Producto / SKU",
      cell: (row) => {
        return (
          <div>
            <div className="font-semibold text-neutral-900">{row.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-mono text-neutral-500">
                {row.sku}
              </span>
              {row.barcode && (
                <span className="text-xs font-mono text-neutral-400 bg-neutral-100 px-1 py-0.2 rounded-lg">
                  {row.barcode}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Jerarquía",
      cell: (row) => (
        <div className="text-xs">
          <span className="font-medium text-neutral-800">
            {row.departmentName || "General"}
          </span>
          {row.groupName && (
            <>
              <span className="text-neutral-400"> › </span>
              <span className="text-neutral-600">{row.groupName}</span>
            </>
          )}
          {row.subgroupName && (
            <>
              <span className="text-neutral-400"> › </span>
              <span className="text-neutral-500">{row.subgroupName}</span>
            </>
          )}
        </div>
      ),
    },
    {
      header: "Ubicación Física",
      cell: (row) =>
        row.aisle ? (
          <div className="flex items-center gap-1.5 text-xs text-neutral-700">
            <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>
              {row.aisle}
              {row.shelf ? ` • ${row.shelf}` : ""}
              {row.compartment ? ` • ${row.compartment}` : ""}
            </span>
          </div>
        ) : (
          <span className="text-xs text-neutral-400 italic">Sin ubicación</span>
        ),
    },
    {
      header: "Costo ($)",
      accessorKey: "costPrice",
      cell: (row) => (
        <span className="text-xs font-mono text-neutral-600">
          {formatMoneyUSD(row.costPrice || 0)}
        </span>
      ),
    },
    {
      header: "Base ($)",
      accessorKey: "basePrice",
      cell: (row) => (
        <span className="text-xs font-mono text-neutral-800">
          {formatMoneyUSD(row.basePrice || 0)}
        </span>
      ),
    },
    {
      header: "IVA",
      cell: (row) => {
        const rate = row.taxRate ?? 16;
        return (
          <Badge variant={rate === 0 ? "neutral" : "info"}>
            {rate === 0 ? "Exento" : `${rate}%`}
          </Badge>
        );
      },
    },
    {
      header: "PVP Final ($)",
      cell: (row) => {
        const rate = row.taxRate ?? 16;
        const finalPrice = (row.basePrice || 0) * (1 + rate / 100);
        return (
          <span className="font-bold text-neutral-900 text-sm">
            {formatMoneyUSD(finalPrice)}
          </span>
        );
      },
    },
    {
      header: "Stock Actual",
      cell: (row) => {
        const stock = row.currentStock || 0;
        const min = row.minStock || 5;
        let colorClass = "text-neutral-900";
        if (stock <= 0) colorClass = "text-red-600 font-bold";
        else if (stock <= min) colorClass = "text-amber-600 font-semibold";

        return (
          <span className={`text-xs ${colorClass}`}>
            {formatNumber(stock, { maximumFractionDigits: 2 })} UND
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">
            Catálogo de Productos e Inventario
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Gestión de artículos, precios oficiales, valoración de existencias y
            reportes imprimibles
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPdfModalOpen(true)}
            disabled={isLoading}
            className="rounded-lg"
          >
            <FileDown className="w-4 h-4 mr-1.5 text-neutral-600" />
            Reporte PDF
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            disabled={isLoading || filteredProducts.length === 0}
            className="rounded-lg"
          >
            <Layers className="w-4 h-4 mr-1.5 text-neutral-600" />
            Exportar CSV
          </Button>

          <Button
            size="sm"
            onClick={() => toast.info("Formulario de nuevo producto")}
            className="rounded-lg"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="p-4 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Buscar Producto
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Nombre, SKU o código de barra..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Filtro por Departamento */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Departamento
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setSelectedGroup("");
              }}
              className="w-full py-2 px-3 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            >
              <option value="">Todos los Departamentos</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Grupo */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Grupo / Categoría
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              disabled={!selectedDepartment && groups.length > 0}
              className="w-full py-2 px-3 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              <option value="">Todos los Grupos</option>
              {groups
                .filter(
                  (g) =>
                    !selectedDepartment ||
                    g.departmentId === selectedDepartment,
                )
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Estado de Existencias */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Filtro de Stock
            </label>
            <select
              value={stockFilter}
              onChange={(e: any) => setStockFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            >
              <option value="all">Todas las existencias</option>
              <option value="in_stock">Solo con Stock Positivo</option>
              <option value="low_stock">Stock Bajo / Crítico</option>
              <option value="out_of_stock">Agotados (Stock 0)</option>
            </select>
          </div>
        </div>

        {/* Resumen rápido de conteos */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-3 border-t border-neutral-100 text-xs text-neutral-500">
          <div className="flex items-center gap-4">
            <span>
              Artículos listados:{" "}
              <strong className="text-neutral-800">
                {filteredProducts.length}
              </strong>
            </span>
            <span>
              Con existencias:{" "}
              <strong className="text-emerald-700">
                {
                  filteredProducts.filter((p) => (p.currentStock || 0) > 0)
                    .length
                }
              </strong>
            </span>
            <span>
              Agotados:{" "}
              <strong className="text-red-700">
                {
                  filteredProducts.filter((p) => (p.currentStock || 0) <= 0)
                    .length
                }
              </strong>
            </span>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearchTerm("");
              setSelectedDepartment("");
              setSelectedGroup("");
              setStockFilter("all");
              fetchProducts();
            }}
            className="h-7 text-xs text-neutral-600 hover:text-neutral-900"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Restablecer Filtros
          </Button>
        </div>
      </Card>

      {/* Error inline */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla Principal */}
      <Card className="rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-neutral-700">
              No se encontraron productos
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Verifique los criterios de búsqueda o los filtros aplicados en el
              catálogo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              data={filteredProducts}
              columns={columns}
              searchPlaceholder="Filtrar por texto en pantalla..."
              searchKey="name"
            />
          </div>
        )}
      </Card>

      {/* Modal de Previsualización e Impresión de PDF */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title="Catálogo de Productos e Inventario"
        subtitle="Documento formal con detalle de inventario, costos y precios al público"
        endpoint={isPdfModalOpen ? pdfEndpoint : null}
        filename={`catalogo_productos_${new Date().toISOString().slice(0, 10)}.pdf`}
      />
    </div>
  );
};
