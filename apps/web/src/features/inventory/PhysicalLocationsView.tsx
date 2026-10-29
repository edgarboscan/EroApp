import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { DataTable, Column } from "../../components/ui/DataTable";
import {
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Warehouse,
  Boxes,
  FileDown,
  Edit2,
  Trash2,
  Package,
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { formatNumber } from "../../utils/formatters";
import { showConfirmQuestion } from "../../lib/sweetalert";
import {
  ProductSearchModal,
  ProductSearchItem,
} from "../../components/search/ProductSearchModal";

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export interface PhysicalLocationRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode?: string;
  branchId?: string;
  branchName?: string;
  productId?: string | null;
  sku?: string | null;
  productName?: string | null;
  aisle: string;
  shelf?: string | null;
  compartment?: string | null;
  notes?: string | null;
  currentStock: number;
}

interface LocationModalState {
  isOpen: boolean;
  isEditing: boolean;
  id?: string;
  warehouseId: string;
  aisle: string;
  shelf: string;
  compartment: string;
  notes: string;
  productId?: string | null;
  productSku?: string | null;
  productName?: string | null;
}

export const PhysicalLocationsView: React.FC = () => {
  const { token, activeWarehouseId, hasPermission } = useAuthStore();

  const [locations, setLocations] = useState<PhysicalLocationRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("ALL");
  const [occupancyFilter, setOccupancyFilter] = useState<
    "ALL" | "ASSIGNED" | "UNASSIGNED"
  >("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modal de Creación / Edición
  const [modalState, setModalState] = useState<LocationModalState>({
    isOpen: false,
    isEditing: false,
    warehouseId: "",
    aisle: "",
    shelf: "",
    compartment: "",
    notes: "",
    productId: null,
    productSku: null,
    productName: null,
  });

  // Modal de búsqueda de producto
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [assigningLocationId, setAssigningLocationId] = useState<string | null>(
    null,
  );

  // Cargar lista de depósitos
  const fetchWarehouses = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch("/api/config/warehouses", { headers });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : [];
        setWarehouses(list);
      }
    } catch (err) {
      console.error("Error cargando almacenes:", err);
    }
  }, [token]);

  // Cargar ubicaciones físicas
  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      let url = "/api/inventory/warehouse-locations";
      if (selectedWarehouseId && selectedWarehouseId !== "ALL") {
        url += `?warehouseId=${selectedWarehouseId}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error("Error al cargar ubicaciones físicas");
      }
      const json = await res.json();
      setLocations(Array.isArray(json.data) ? json.data : []);
    } catch (err: any) {
      toast.error(err.message || "Error al obtener mapa de ubicaciones");
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedWarehouseId]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Filtrado reactivo en memoria para búsqueda y estado de asignación
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      // Filtro de ocupación
      if (occupancyFilter === "ASSIGNED" && !loc.productId) return false;
      if (occupancyFilter === "UNASSIGNED" && loc.productId) return false;

      // Filtro de texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchAisle = loc.aisle?.toLowerCase().includes(term);
        const matchShelf = loc.shelf?.toLowerCase().includes(term);
        const matchComp = loc.compartment?.toLowerCase().includes(term);
        const matchSku = loc.sku?.toLowerCase().includes(term);
        const matchProd = loc.productName?.toLowerCase().includes(term);
        const matchWh = loc.warehouseName?.toLowerCase().includes(term);
        return (
          matchAisle ||
          matchShelf ||
          matchComp ||
          matchSku ||
          matchProd ||
          matchWh
        );
      }

      return true;
    });
  }, [locations, occupancyFilter, searchTerm]);

  // Métricas de resumen
  const stats = useMemo(() => {
    const total = locations.length;
    const assigned = locations.filter((l) => Boolean(l.productId)).length;
    const unassigned = total - assigned;
    const totalStock = locations.reduce(
      (acc, curr) => acc + (Number(curr.currentStock) || 0),
      0,
    );
    return { total, assigned, unassigned, totalStock };
  }, [locations]);

  // Abrir Modal de Creación
  const handleOpenCreateModal = () => {
    const defaultWh =
      selectedWarehouseId !== "ALL"
        ? selectedWarehouseId
        : warehouses[0]?.id || activeWarehouseId || "";
    setModalState({
      isOpen: true,
      isEditing: false,
      warehouseId: defaultWh,
      aisle: "",
      shelf: "",
      compartment: "",
      notes: "",
      productId: null,
      productSku: null,
      productName: null,
    });
  };

  // Abrir Modal de Edición
  const handleOpenEditModal = (loc: PhysicalLocationRow) => {
    setModalState({
      isOpen: true,
      isEditing: true,
      id: loc.id,
      warehouseId: loc.warehouseId,
      aisle: loc.aisle || "",
      shelf: loc.shelf || "",
      compartment: loc.compartment || "",
      notes: loc.notes || "",
      productId: loc.productId || null,
      productSku: loc.sku || null,
      productName: loc.productName || null,
    });
  };

  // Guardar Ubicación (Crear o Actualizar)
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!modalState.warehouseId) {
      toast.error("Debe seleccionar un almacén o depósito");
      return;
    }
    if (!modalState.aisle.trim()) {
      toast.error("El pasillo es obligatorio");
      return;
    }

    setIsSaving(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        warehouseId: modalState.warehouseId,
        productId: modalState.productId || null,
        aisle: modalState.aisle.trim().toUpperCase(),
        shelf: modalState.shelf.trim().toUpperCase() || null,
        compartment: modalState.compartment.trim().toUpperCase() || null,
        notes: modalState.notes.trim() || null,
      };

      const url = modalState.isEditing
        ? `/api/inventory/warehouse-locations/${modalState.id}`
        : "/api/inventory/warehouse-locations";
      const method = modalState.isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(
          errorJson.error?.message || "Error al guardar la ubicación",
        );
      }

      toast.success(
        modalState.isEditing
          ? "Ubicación física actualizada"
          : "Ubicación física registrada exitosamente",
      );
      setModalState((prev) => ({ ...prev, isOpen: false }));
      fetchLocations();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar ubicación");
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar Ubicación
  const handleDeleteLocation = async (loc: PhysicalLocationRow) => {
    const confirmed = await showConfirmQuestion({
      title: "¿Eliminar Ubicación Física?",
      text: `Se eliminará la ubicación "${loc.aisle} - ${loc.shelf || ""} - ${loc.compartment || ""}" del depósito "${loc.warehouseName}".`,
      confirmButtonText: "Sí, Eliminar",
      isDestructive: true,
    });

    if (!confirmed) return;

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/warehouse-locations/${loc.id}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(
          errorJson.error?.message || "Error al eliminar ubicación",
        );
      }

      toast.success("Ubicación eliminada");
      fetchLocations();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar la ubicación");
    }
  };

  // Asignar producto desde el selector modal
  const handleSelectProduct = async (product: ProductSearchItem) => {
    if (modalState.isOpen) {
      // Asignación en el formulario activo
      setModalState((prev) => ({
        ...prev,
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
      }));
      setIsProductSearchOpen(false);
      return;
    }

    if (assigningLocationId) {
      // Asignación directa a fila existente
      try {
        const loc = locations.find((l) => l.id === assigningLocationId);
        if (!loc) return;

        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const res = await fetch(
          `/api/inventory/warehouse-locations/${loc.id}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({
              warehouseId: loc.warehouseId,
              productId: product.id,
              aisle: loc.aisle,
              shelf: loc.shelf,
              compartment: loc.compartment,
              notes: loc.notes,
            }),
          },
        );

        if (!res.ok)
          throw new Error("No se pudo asignar el producto a la ubicación");

        toast.success(`Producto "${product.name}" asignado a la ubicación`);
        fetchLocations();
      } catch (err: any) {
        toast.error(err.message || "Error al asignar producto");
      } finally {
        setAssigningLocationId(null);
        setIsProductSearchOpen(false);
      }
    }
  };

  // Desasignar producto de ubicación
  const handleUnassignProduct = async (loc: PhysicalLocationRow) => {
    const confirmed = await showConfirmQuestion({
      title: "¿Liberar Ubicación?",
      text: `Se desvinculará el producto "${loc.productName}" de la ubicación ${loc.aisle} / ${loc.shelf || ""}. La ubicación quedará disponible.`,
      confirmButtonText: "Liberar Ubicación",
    });

    if (!confirmed) return;

    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`/api/inventory/warehouse-locations/${loc.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          warehouseId: loc.warehouseId,
          productId: null,
          aisle: loc.aisle,
          shelf: loc.shelf,
          compartment: loc.compartment,
          notes: loc.notes,
        }),
      });

      if (!res.ok) throw new Error("No se pudo liberar la ubicación");

      toast.success("Ubicación liberada");
      fetchLocations();
    } catch (err: any) {
      toast.error(err.message || "Error al liberar ubicación");
    }
  };

  // Exportar mapa a CSV
  const handleExportCSV = () => {
    if (filteredLocations.length === 0) {
      toast.info("No hay ubicaciones para exportar");
      return;
    }

    const headers = [
      "Almacén / Depósito",
      "Pasillo",
      "Estante",
      "Compartimiento",
      "Código SKU",
      "Producto Asignado",
      "Stock Actual (UND)",
      "Notas / Observaciones",
    ];

    const rows = filteredLocations.map((loc) => [
      `"${loc.warehouseName || ""}"`,
      `"${loc.aisle || ""}"`,
      `"${loc.shelf || ""}"`,
      `"${loc.compartment || ""}"`,
      `"${loc.sku || ""}"`,
      `"${(loc.productName || "Sin asignar").replace(/"/g, '""')}"`,
      loc.currentStock || 0,
      `"${(loc.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `mapa_ubicaciones_almacen_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("Mapa de ubicaciones exportado exitosamente");
  };

  // Columnas para la tabla
  const columns: Column<PhysicalLocationRow>[] = [
    {
      header: "Coordenadas Físicas",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-lg text-xs">
              Pasillo: {row.aisle}
            </span>
            {row.shelf && (
              <span className="text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 rounded-lg text-xs">
                Estante: {row.shelf}
              </span>
            )}
            {row.compartment && (
              <span className="text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 rounded-lg text-xs">
                Comp: {row.compartment}
              </span>
            )}
          </div>
          {row.notes && (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 italic">
              {row.notes}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Almacén / Depósito",
      accessorKey: "warehouseName",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Warehouse className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
            {row.warehouseName}
          </span>
        </div>
      ),
    },
    {
      header: "Producto Asignado",
      cell: (row) => {
        if (!row.productId) {
          return (
            <div className="flex items-center gap-2">
              <Badge
                variant="neutral"
                className="border-dashed text-neutral-400 dark:text-neutral-500"
              >
                Ubicación Libre
              </Badge>
              <button
                type="button"
                onClick={() => {
                  setAssigningLocationId(row.id);
                  setIsProductSearchOpen(true);
                }}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
              >
                + Asignar
              </button>
            </div>
          );
        }

        return (
          <div>
            <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>{row.productName}</span>
              <button
                type="button"
                onClick={() => handleUnassignProduct(row)}
                title="Liberar producto de esta ubicación"
                className="text-neutral-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-lg">
                {row.sku}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAssigningLocationId(row.id);
                  setIsProductSearchOpen(true);
                }}
                className="text-[10px] text-neutral-500 hover:text-sky-600 dark:hover:text-sky-400 underline"
              >
                Cambiar
              </button>
            </div>
          </div>
        );
      },
    },
    {
      header: "Stock en Depósito",
      accessorKey: "currentStock",
      cell: (row) => (
        <div>
          {row.productId ? (
            <span
              className={`font-bold text-xs ${
                row.currentStock > 0
                  ? "text-neutral-900 dark:text-neutral-100"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {formatNumber(row.currentStock, { maximumFractionDigits: 2 })} UND
            </span>
          ) : (
            <span className="text-neutral-400 text-xs">—</span>
          )}
        </div>
      ),
    },
    {
      header: "Acciones",
      cell: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenEditModal(row)}
            title="Editar coordenadas"
            className="h-8 w-8 p-0"
          >
            <Edit2 className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteLocation(row)}
            title="Eliminar ubicación"
            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sky-600" />
            Mapa de Ubicaciones Físicas de Inventario
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Localización por Pasillo / Estante / Compartimiento por depósito de
            mercancía
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchLocations}
            disabled={isLoading}
            className="rounded-lg"
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refrescar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            disabled={isLoading || filteredLocations.length === 0}
            className="rounded-lg"
          >
            <FileDown className="w-4 h-4 mr-1.5" />
            Exportar CSV
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="rounded-lg"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nueva Ubicación
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 border-l-4 border-l-sky-600 dark:border-l-sky-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-sky-600 dark:border-sky-400 shadow-sm">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
            Total Ubicaciones
          </span>
          <div className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1">
            {stats.total}
          </div>
        </div>
        <div className="p-3 border-l-4 border-l-emerald-600 dark:border-l-emerald-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-emerald-600 dark:border-emerald-400 shadow-sm">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
            Ubicaciones Asignadas
          </span>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.assigned}
          </div>
        </div>
        <div className="p-3 border-l-4 border-l-purple-600 dark:border-l-purple-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-purple-600 dark:border-purple-400 shadow-sm">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
            Ubicaciones Libres
          </span>
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {stats.unassigned}
          </div>
        </div>
        <div className="p-3 border-l-4 border-l-amber-600 dark:border-l-amber-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-amber-600 dark:border-amber-400 shadow-sm">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
            Stock en Ubicaciones
          </span>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatNumber(stats.totalStock, { maximumFractionDigits: 2 })}{" "}
            <span className="text-xs font-normal text-neutral-500">UND</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="p-4 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Filtrar por Depósito / Almacén
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <option value="ALL">Todos los Depósitos</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Estado de Ocupación
            </label>
            <select
              value={occupancyFilter}
              onChange={(e) => setOccupancyFilter(e.target.value as any)}
              className="w-full h-9 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <option value="ALL">Todas las Ubicaciones</option>
              <option value="ASSIGNED">Ocupadas (Con Producto)</option>
              <option value="UNASSIGNED">Libres (Sin Producto Asignado)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Búsqueda Rápida
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por pasillo, estante o producto..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tabla Principal */}
      <Card>
        <DataTable
          data={filteredLocations}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No se encontraron ubicaciones físicas registradas con los filtros seleccionados."
          onExportCSV={handleExportCSV}
        />
      </Card>

      {/* Modal de Creación / Edición de Ubicación */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={
          modalState.isEditing
            ? "Editar Ubicación Física"
            : "Nueva Ubicación Física"
        }
        subtitle="Especifique las coordenadas físicas de almacenamiento dentro del depósito"
        size="md"
      >
        <form onSubmit={handleSaveLocation} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Almacén / Depósito *
            </label>
            <select
              value={modalState.warehouseId}
              onChange={(e) =>
                setModalState({ ...modalState, warehouseId: e.target.value })
              }
              className="w-full h-10 px-3 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <option value="">Seleccione un depósito...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Pasillo *"
              placeholder="Ej: P-01"
              value={modalState.aisle}
              onChange={(e) =>
                setModalState({ ...modalState, aisle: e.target.value })
              }
              required
            />
            <Input
              label="Estante / Tramo"
              placeholder="Ej: E-02"
              value={modalState.shelf}
              onChange={(e) =>
                setModalState({ ...modalState, shelf: e.target.value })
              }
            />
            <Input
              label="Compartimiento"
              placeholder="Ej: C-05"
              value={modalState.compartment}
              onChange={(e) =>
                setModalState({ ...modalState, compartment: e.target.value })
              }
            />
          </div>

          {/* Producto Asignado (Opcional) */}
          <div className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 space-y-2">
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Producto Asignado (Opcional)
            </label>
            {modalState.productId ? (
              <div className="flex items-center justify-between bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {modalState.productName}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500">
                    SKU: {modalState.productSku}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setModalState((prev) => ({
                      ...prev,
                      productId: null,
                      productSku: null,
                      productName: null,
                    }))
                  }
                  className="h-7 px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Quitar
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  Sin producto asignado (slot libre)
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsProductSearchOpen(true)}
                  className="rounded-lg"
                >
                  <Search className="w-3.5 h-3.5 mr-1" />
                  Buscar Producto
                </Button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Notas u Observaciones
            </label>
            <textarea
              value={modalState.notes}
              onChange={(e) =>
                setModalState({ ...modalState, notes: e.target.value })
              }
              placeholder="Instrucciones especiales de almacenamiento, refrigeración o manipulación..."
              rows={2}
              className="w-full p-2.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setModalState((prev) => ({ ...prev, isOpen: false }))
              }
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {modalState.isEditing
                ? "Actualizar Ubicación"
                : "Crear Ubicación"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Selector de Productos */}
      <ProductSearchModal
        isOpen={isProductSearchOpen}
        onClose={() => {
          setIsProductSearchOpen(false);
          setAssigningLocationId(null);
        }}
        onSelect={handleSelectProduct}
        title="Asignar Producto a Ubicación"
        subtitle="Seleccione el artículo del catálogo para vincular a las coordenadas físicas"
      />
    </div>
  );
};
