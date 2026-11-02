import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  FolderTree,
  Boxes,
  Tags,
  Package,
  Search,
  X,
  RefreshCw,
  SearchX,
  Layers,
  ArrowRight,
  FolderOpen,
} from "lucide-react";
import { showConfirmQuestion } from "../../lib/sweetalert";
import { useAuthStore } from "../../stores/authStore";
import { toast } from "sonner";
import { HierarchySearchModal, HierarchySelection } from "../../components/search";

interface HierarchyNode {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type?: "department" | "group" | "subgroup";
  parentId?: string;
  groupsCount?: number;
  subgroupsCount?: number;
  productsCount?: number;
  childrenCount?: number;
  isActive?: boolean;
}

type HierarchyLevel = "department" | "group" | "subgroup";

interface ModalState {
  isOpen: boolean;
  level: HierarchyLevel;
  isEdit: boolean;
  id?: string;
  code: string;
  name: string;
  description: string;
}

const normalizeString = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

export const HierarchyManager: React.FC = () => {
  const token = useAuthStore((state) => state.token);

  // Departamentos
  const [departments, setDepartments] = useState<HierarchyNode[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [loadingDepts, setLoadingDepts] = useState<boolean>(true);
  const [deptSearch, setDeptSearch] = useState<string>("");

  // Grupos
  const [groups, setGroups] = useState<HierarchyNode[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [groupSearch, setGroupSearch] = useState<string>("");

  // Subgrupos
  const [subgroups, setSubgroups] = useState<HierarchyNode[]>([]);
  const [loadingSubgroups, setLoadingSubgroups] = useState<boolean>(false);
  const [subgroupSearch, setSubgroupSearch] = useState<string>("");

  // Modal de búsqueda global de jerarquía
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState<boolean>(false);

  // Modal para creación / edición
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    level: "department",
    isEdit: false,
    code: "",
    name: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Cargar departamentos desde la base de datos
  const fetchDepartments = useCallback(async (selectDefault = false) => {
    setLoadingDepts(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch("/api/inventory/departments", { headers });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json.data) ? json.data : [];
        setDepartments(data);
        if (data.length > 0) {
          setSelectedDept((prev) => {
            if (selectDefault) return data[0].id;
            return prev && data.some((d: HierarchyNode) => d.id === prev)
              ? prev
              : data[0].id;
          });
        } else {
          setSelectedDept(null);
          setGroups([]);
          setSelectedGroup(null);
          setSubgroups([]);
        }
      } else {
        setDepartments([]);
        setSelectedDept(null);
      }
    } catch {
      setDepartments([]);
      setSelectedDept(null);
    } finally {
      setLoadingDepts(false);
    }
  }, [token]);

  // Cargar grupos del departamento seleccionado
  const fetchGroups = useCallback(
    async (deptId: string, selectDefault = false) => {
      setLoadingGroups(true);
      try {
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;
        const res = await fetch(
          `/api/inventory/groups?departmentId=${deptId}`,
          { headers },
        );
        if (res.ok) {
          const json = await res.json();
          const data = Array.isArray(json.data) ? json.data : [];
          setGroups(data);
          if (data.length > 0) {
            setSelectedGroup((prev) => {
              if (selectDefault) return data[0].id;
              return prev && data.some((g: HierarchyNode) => g.id === prev)
                ? prev
                : data[0].id;
            });
          } else {
            setSelectedGroup(null);
            setSubgroups([]);
          }
        } else {
          setGroups([]);
          setSelectedGroup(null);
          setSubgroups([]);
        }
      } catch {
        setGroups([]);
        setSelectedGroup(null);
        setSubgroups([]);
      } finally {
        setLoadingGroups(false);
      }
    },
    [token],
  );

  // Cargar subgrupos del grupo seleccionado
  const fetchSubgroups = useCallback(
    async (grpId: string) => {
      setLoadingSubgroups(true);
      try {
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;
        const res = await fetch(`/api/inventory/subgroups?groupId=${grpId}`, {
          headers,
        });
        if (res.ok) {
          const json = await res.json();
          const data = Array.isArray(json.data) ? json.data : [];
          setSubgroups(data);
        } else {
          setSubgroups([]);
        }
      } catch {
        setSubgroups([]);
      } finally {
        setLoadingSubgroups(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    if (selectedDept) {
      fetchGroups(selectedDept);
    } else {
      setGroups([]);
      setSelectedGroup(null);
      setSubgroups([]);
    }
  }, [selectedDept, fetchGroups]);

  useEffect(() => {
    if (selectedGroup) {
      fetchSubgroups(selectedGroup);
    } else {
      setSubgroups([]);
    }
  }, [selectedGroup, fetchSubgroups]);

  const currentDeptObj = departments.find((d) => d.id === selectedDept);
  const currentGroupObj = groups.find((g) => g.id === selectedGroup);

  // Filtros reactivos con búsqueda por Nombre o Código (insensible a mayúsculas y acentos)
  const filteredDepartments = useMemo(() => {
    if (!deptSearch.trim()) return departments;
    const term = normalizeString(deptSearch);
    return departments.filter(
      (d) =>
        normalizeString(d.name).includes(term) ||
        normalizeString(d.code).includes(term) ||
        (d.description && normalizeString(d.description).includes(term)),
    );
  }, [departments, deptSearch]);

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return groups;
    const term = normalizeString(groupSearch);
    return groups.filter(
      (g) =>
        normalizeString(g.name).includes(term) ||
        normalizeString(g.code).includes(term) ||
        (g.description && normalizeString(g.description).includes(term)),
    );
  }, [groups, groupSearch]);

  const filteredSubgroups = useMemo(() => {
    if (!subgroupSearch.trim()) return subgroups;
    const term = normalizeString(subgroupSearch);
    return subgroups.filter(
      (s) =>
        normalizeString(s.name).includes(term) ||
        normalizeString(s.code).includes(term) ||
        (s.description && normalizeString(s.description).includes(term)),
    );
  }, [subgroups, subgroupSearch]);

  // Totales agregados para KPIs
  const totalGroupsAllDepts = useMemo(() => {
    return departments.reduce(
      (acc, d) => acc + (d.groupsCount ?? d.childrenCount ?? 0),
      0,
    );
  }, [departments]);

  const totalProductsAllDepts = useMemo(() => {
    return departments.reduce((acc, d) => acc + (d.productsCount ?? 0), 0);
  }, [departments]);

  // Recarga manual
  const handleRefreshAll = () => {
    fetchDepartments();
    toast.success("Jerarquía de clasificación actualizada");
  };

  // Abrir modal de creación
  const handleOpenCreate = (level: HierarchyLevel) => {
    setModalState({
      isOpen: true,
      level,
      isEdit: false,
      code: "",
      name: "",
      description: "",
    });
  };

  // Abrir modal de edición
  const handleOpenEdit = (level: HierarchyLevel, item: HierarchyNode) => {
    setModalState({
      isOpen: true,
      level,
      isEdit: true,
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description || "",
    });
  };

  // Guardar (Crear o Actualizar)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalState.code.trim() || !modalState.name.trim()) {
      toast.error("Código y nombre son obligatorios");
      return;
    }

    const { level, isEdit, id, code, name, description } = modalState;
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    setIsSubmitting(true);
    try {
      let url = "";
      const method = isEdit ? "PUT" : "POST";
      const body: Record<string, any> = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || null,
      };

      if (level === "department") {
        url = isEdit
          ? `/api/inventory/departments/${id}`
          : "/api/inventory/departments";
      } else if (level === "group") {
        if (!selectedDept) {
          toast.error("Debe haber un departamento seleccionado");
          setIsSubmitting(false);
          return;
        }
        url = isEdit ? `/api/inventory/groups/${id}` : "/api/inventory/groups";
        if (!isEdit) body.departmentId = selectedDept;
      } else {
        if (!selectedGroup) {
          toast.error("Debe haber un grupo seleccionado");
          setIsSubmitting(false);
          return;
        }
        url = isEdit
          ? `/api/inventory/subgroups/${id}`
          : "/api/inventory/subgroups";
        if (!isEdit) body.groupId = selectedGroup;
      }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          isEdit
            ? `${level === "department" ? "Departamento" : level === "group" ? "Grupo" : "Subgrupo"} actualizado`
            : `${level === "department" ? "Departamento" : level === "group" ? "Grupo" : "Subgrupo"} creado`,
        );
        setModalState((prev) => ({ ...prev, isOpen: false }));

        if (level === "department") {
          fetchDepartments();
        } else if (level === "group") {
          if (selectedDept) fetchGroups(selectedDept);
        } else {
          if (selectedGroup) fetchSubgroups(selectedGroup);
        }
      } else {
        toast.error(json.error?.message || "Error al guardar elemento");
      }
    } catch {
      toast.error("Error de red al procesar la solicitud");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar elemento
  const handleDelete = async (
    level: HierarchyLevel,
    id: string,
    name: string,
  ) => {
    const levelName =
      level === "department"
        ? "departamento"
        : level === "group"
          ? "grupo"
          : "subgrupo";

    const confirmDelete = await showConfirmQuestion({
      title: `¿Eliminar ${levelName}?`,
      text: `¿Está seguro de que desea eliminar el ${levelName} "${name}"?\n\nSi posee elementos dependientes o productos asociados, el sistema bloqueará la acción para preservar la integridad del inventario.`,
      confirmButtonText: "Sí, Eliminar",
      cancelButtonText: "Cancelar",
      icon: "question",
    });

    if (!confirmDelete) return;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    try {
      let url = "";
      if (level === "department") url = `/api/inventory/departments/${id}`;
      else if (level === "group") url = `/api/inventory/groups/${id}`;
      else url = `/api/inventory/subgroups/${id}`;

      const res = await fetch(url, {
        method: "DELETE",
        headers,
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || `${levelName} eliminado correctamente`);
        if (level === "department") {
          fetchDepartments();
        } else if (level === "group") {
          if (selectedDept) fetchGroups(selectedDept);
        } else {
          if (selectedGroup) fetchSubgroups(selectedGroup);
        }
      } else {
        toast.error(
          json.error?.message || `No se pudo eliminar el ${levelName}`,
        );
      }
    } catch {
      toast.error("Error de red al eliminar el elemento");
    }
  };

  const getModalTitle = () => {
    const action = modalState.isEdit ? "Editar" : "Nuevo";
    if (modalState.level === "department") return `${action} Departamento`;
    if (modalState.level === "group")
      return `${action} Grupo en: ${currentDeptObj?.name || ""}`;
    return `${action} Subgrupo en: ${currentGroupObj?.name || ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado y Acciones Principales */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50">
              <FolderTree className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Jerarquía de Clasificación de Productos
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                Estructura canónica de 3 niveles: Departamento → Grupo → Subgrupo para categorización, reportes y reglas fiscales
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsHierarchyModalOpen(true)}
            className="text-xs text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100"
            title="Localizador rápido y buscador interactivo en toda la jerarquía"
          >
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Localizador Rápido
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshAll}
            className="text-xs"
            title="Recargar jerarquía"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen con convención border-l-4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-white dark:bg-[#1E1F21] border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-sky-600 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Departamentos
            </span>
            <span className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
              <FolderTree className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {departments.length}
          </div>
          <p className="text-xs text-neutral-500 mt-1 truncate">
            {totalGroupsAllDepts} grupos vinculados en catálogo
          </p>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-[#1E1F21] border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-emerald-600 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Grupos Activos
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Boxes className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {selectedDept ? groups.length : 0}
          </div>
          <p className="text-xs text-neutral-500 mt-1 truncate">
            {currentDeptObj ? `Depto: ${currentDeptObj.name}` : "Seleccione un departamento"}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-[#1E1F21] border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-indigo-600 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Subgrupos
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Tags className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {selectedGroup ? subgroups.length : 0}
          </div>
          <p className="text-xs text-neutral-500 mt-1 truncate">
            {currentGroupObj ? `Grupo: ${currentGroupObj.name}` : "Seleccione un grupo"}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-[#1E1F21] border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-amber-600 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Productos Clasificados
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {totalProductsAllDepts}
          </div>
          <p className="text-xs text-neutral-500 mt-1 truncate">
            {currentGroupObj
              ? `${subgroups.reduce((acc, s) => acc + (s.productsCount || 0), 0)} en grupo actual`
              : "Asociados a la estructura canónica"}
          </p>
        </div>
      </div>

      {/* Barra de Miga de Pan (Breadcrumbs) de Navegación Activa */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-neutral-50 dark:bg-[#1E1F21] border border-neutral-200 dark:border-neutral-800 text-xs">
        <span className="font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-neutral-400" />
          Ruta Activa:
        </span>

        <button
          type="button"
          onClick={() => {
            if (departments.length > 0 && selectedDept !== departments[0].id) {
              setSelectedDept(departments[0].id);
            }
          }}
          className="font-medium text-neutral-700 dark:text-neutral-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
        >
          Catálogo General
        </button>

        <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />

        {currentDeptObj ? (
          <span className="font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-1">
            <span className="font-mono text-[11px] px-1 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300">
              {currentDeptObj.code}
            </span>
            {currentDeptObj.name}
          </span>
        ) : (
          <span className="text-neutral-400 italic">Sin departamento</span>
        )}

        {currentGroupObj && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <span className="font-mono text-[11px] px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                {currentGroupObj.code}
              </span>
              {currentGroupObj.name}
            </span>
          </>
        )}

        <div className="ml-auto text-neutral-400 text-[11px] hidden sm:block">
          {departments.length} Depts &bull; {totalGroupsAllDepts} Grupos &bull; {totalProductsAllDepts} Productos
        </div>
      </div>

      {/* Grid de 3 Columnas Jerárquicas con Buscadores Integrados */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ======================================================== */}
        {/* COLUMNA 1: DEPARTAMENTOS                                  */}
        {/* ======================================================== */}
        <Card
          title="1. Departamentos"
          subtitle="Nivel principal de clasificación del inventario"
          action={
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                {filteredDepartments.length} de {departments.length}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenCreate("department")}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nuevo
              </Button>
            </div>
          }
        >
          {/* Buscador de Departamentos */}
          <div className="relative mt-2 mb-3">
            <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por código o nombre..."
              value={deptSearch}
              onChange={(e) => setDeptSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-7 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 transition-colors"
            />
            {deptSearch && (
              <button
                type="button"
                onClick={() => setDeptSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 rounded focus-visible:ring-2"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Listado de Departamentos */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {loadingDepts ? (
              <div className="space-y-2 py-1">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : departments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <FolderOpen className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mb-2" />
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Sin departamentos registrados
                </p>
                <p className="text-xs text-neutral-400 mt-0.5 mb-3">
                  Comience agregando el primer nivel de clasificación
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleOpenCreate("department")}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Crear Departamento
                </Button>
              </div>
            ) : filteredDepartments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                <SearchX className="w-7 h-7 text-neutral-400 mb-2" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Sin resultados para &ldquo;{deptSearch}&rdquo;
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5 mb-2">
                  No coincide con código ni nombre de departamento
                </p>
                <button
                  type="button"
                  onClick={() => setDeptSearch("")}
                  className="text-xs text-sky-600 hover:underline font-medium"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              filteredDepartments.map((dept) => {
                const isSelected = selectedDept === dept.id;
                const groupsCount = dept.groupsCount ?? dept.childrenCount ?? 0;
                const productsCount = dept.productsCount ?? 0;

                return (
                  <div
                    key={dept.id}
                    onClick={() => setSelectedDept(dept.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "border-sky-600 bg-sky-50/70 dark:bg-sky-950/30 ring-1 ring-sky-500 shadow-xs"
                        : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1E1F21] hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                    }`}
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`text-[11px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                            isSelected
                              ? "bg-sky-200/80 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                          }`}
                        >
                          {dept.code}
                        </span>
                        {productsCount > 0 && (
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            &bull; {productsCount} {productsCount === 1 ? "prod." : "prods."}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {dept.name}
                      </div>
                      {dept.description && (
                        <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                          {dept.description}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="neutral" className="text-[10px] py-0.5 px-2 font-medium">
                        {groupsCount} {groupsCount === 1 ? "grupo" : "grupos"}
                      </Badge>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit("department", dept);
                        }}
                        className="p-1 text-neutral-400 hover:text-sky-600 dark:hover:text-sky-400 rounded focus-visible:ring-2"
                        title="Editar departamento"
                        aria-label="Editar departamento"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete("department", dept.id, dept.name);
                        }}
                        className="p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded focus-visible:ring-2"
                        title="Eliminar departamento"
                        aria-label="Eliminar departamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${
                          isSelected ? "text-sky-600 transform translate-x-0.5" : "text-neutral-400"
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* ======================================================== */}
        {/* COLUMNA 2: GRUPOS                                        */}
        {/* ======================================================== */}
        <Card
          title="2. Grupos"
          subtitle={
            currentDeptObj
              ? `Subcategorías en: ${currentDeptObj.name}`
              : "Seleccione un departamento"
          }
          action={
            <div className="flex items-center gap-2">
              {selectedDept && (
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  {filteredGroups.length} de {groups.length}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedDept}
                onClick={() => handleOpenCreate("group")}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nuevo
              </Button>
            </div>
          }
        >
          {/* Buscador de Grupos */}
          <div className="relative mt-2 mb-3">
            <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              disabled={!selectedDept}
              placeholder={
                selectedDept
                  ? "Buscar grupo por código o nombre..."
                  : "Seleccione un departamento primero"
              }
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-7 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
            {groupSearch && (
              <button
                type="button"
                onClick={() => setGroupSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 rounded focus-visible:ring-2"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Listado de Grupos */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {loadingGroups ? (
              <div className="space-y-2 py-1">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !selectedDept ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                <ArrowRight className="w-7 h-7 text-neutral-300 dark:text-neutral-600 mb-2 rotate-90 lg:rotate-0" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Departamento no seleccionado
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Elija un departamento de la columna izquierda para desplegar sus grupos
                </p>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Boxes className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mb-2" />
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Sin grupos en este departamento
                </p>
                <p className="text-xs text-neutral-400 mt-0.5 mb-3">
                  Registre el primer grupo para &ldquo;{currentDeptObj?.name}&rdquo;
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleOpenCreate("group")}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Crear Grupo
                </Button>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                <SearchX className="w-7 h-7 text-neutral-400 mb-2" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Sin resultados para &ldquo;{groupSearch}&rdquo;
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5 mb-2">
                  No coincide con grupos del departamento activo
                </p>
                <button
                  type="button"
                  onClick={() => setGroupSearch("")}
                  className="text-xs text-emerald-600 hover:underline font-medium"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              filteredGroups.map((grp) => {
                const isSelected = selectedGroup === grp.id;
                const subgroupsCount = grp.subgroupsCount ?? grp.childrenCount ?? 0;
                const productsCount = grp.productsCount ?? 0;

                return (
                  <div
                    key={grp.id}
                    onClick={() => setSelectedGroup(grp.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 ring-1 ring-emerald-500 shadow-xs"
                        : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1E1F21] hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                    }`}
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`text-[11px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                            isSelected
                              ? "bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                          }`}
                        >
                          {grp.code}
                        </span>
                        {productsCount > 0 && (
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            &bull; {productsCount} {productsCount === 1 ? "prod." : "prods."}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {grp.name}
                      </div>
                      {grp.description && (
                        <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                          {grp.description}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="neutral" className="text-[10px] py-0.5 px-2 font-medium">
                        {subgroupsCount} {subgroupsCount === 1 ? "subgrupo" : "subgrupos"}
                      </Badge>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit("group", grp);
                        }}
                        className="p-1 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded focus-visible:ring-2"
                        title="Editar grupo"
                        aria-label="Editar grupo"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete("group", grp.id, grp.name);
                        }}
                        className="p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded focus-visible:ring-2"
                        title="Eliminar grupo"
                        aria-label="Eliminar grupo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${
                          isSelected ? "text-emerald-600 transform translate-x-0.5" : "text-neutral-400"
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* ======================================================== */}
        {/* COLUMNA 3: SUBGRUPOS                                     */}
        {/* ======================================================== */}
        <Card
          title="3. Subgrupos"
          subtitle={
            currentGroupObj
              ? `Especialidades en: ${currentGroupObj.name}`
              : "Seleccione un grupo"
          }
          action={
            <div className="flex items-center gap-2">
              {selectedGroup && (
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  {filteredSubgroups.length} de {subgroups.length}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedGroup}
                onClick={() => handleOpenCreate("subgroup")}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nuevo
              </Button>
            </div>
          }
        >
          {/* Buscador de Subgrupos */}
          <div className="relative mt-2 mb-3">
            <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              disabled={!selectedGroup}
              placeholder={
                selectedGroup
                  ? "Buscar subgrupo por código o nombre..."
                  : "Seleccione un grupo primero"
              }
              value={subgroupSearch}
              onChange={(e) => setSubgroupSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-7 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
            {subgroupSearch && (
              <button
                type="button"
                onClick={() => setSubgroupSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 rounded focus-visible:ring-2"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Listado de Subgrupos */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {loadingSubgroups ? (
              <div className="space-y-2 py-1">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !selectedGroup ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                <ArrowRight className="w-7 h-7 text-neutral-300 dark:text-neutral-600 mb-2 rotate-90 lg:rotate-0" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Grupo no seleccionado
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Elija un grupo de la columna central para desplegar sus subgrupos
                </p>
              </div>
            ) : subgroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Tags className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mb-2" />
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Sin subgrupos en este grupo
                </p>
                <p className="text-xs text-neutral-400 mt-0.5 mb-3">
                  Registre el nivel final de clasificación para &ldquo;{currentGroupObj?.name}&rdquo;
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleOpenCreate("subgroup")}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Crear Subgrupo
                </Button>
              </div>
            ) : filteredSubgroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                <SearchX className="w-7 h-7 text-neutral-400 mb-2" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Sin resultados para &ldquo;{subgroupSearch}&rdquo;
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5 mb-2">
                  No coincide con subgrupos del grupo activo
                </p>
                <button
                  type="button"
                  onClick={() => setSubgroupSearch("")}
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              filteredSubgroups.map((sub) => {
                const productsCount = sub.productsCount ?? 0;

                return (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1E1F21] hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-mono font-semibold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
                          {sub.code}
                        </span>
                        {productsCount > 0 && (
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            &bull; {productsCount} {productsCount === 1 ? "prod." : "prods."}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {sub.name}
                      </div>
                      {sub.description && (
                        <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                          {sub.description}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit("subgroup", sub)}
                        className="p-1 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded focus-visible:ring-2"
                        title="Editar subgrupo"
                        aria-label="Editar subgrupo"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete("subgroup", sub.id, sub.name)}
                        className="p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded focus-visible:ring-2"
                        title="Eliminar subgrupo"
                        aria-label="Eliminar subgrupo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Modal para Crear / Editar Nivel de Jerarquía */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => {
          if (!isSubmitting) {
            setModalState((prev) => ({ ...prev, isOpen: false }));
          }
        }}
        title={getModalTitle()}
      >
        <form onSubmit={handleSaveModal} className="space-y-4">
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
            {modalState.level === "department" && (
              <span>
                Creando un <strong>Departamento</strong> (Nivel 1). Este nivel agrupa grandes líneas de negocio del inventario.
              </span>
            )}
            {modalState.level === "group" && (
              <span>
                Creando un <strong>Grupo</strong> (Nivel 2) dependiente de <strong>{currentDeptObj?.name}</strong>.
              </span>
            )}
            {modalState.level === "subgroup" && (
              <span>
                Creando un <strong>Subgrupo</strong> (Nivel 3) dependiente de <strong>{currentGroupObj?.name}</strong>.
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Código *
            </label>
            <Input
              placeholder={
                modalState.level === "department"
                  ? "DEP-01"
                  : modalState.level === "group"
                    ? "GRP-01"
                    : "SUB-01"
              }
              value={modalState.code}
              onChange={(e) =>
                setModalState({
                  ...modalState,
                  code: e.target.value.toUpperCase(),
                })
              }
              required
              disabled={isSubmitting}
            />
            <span className="text-[11px] text-neutral-400 mt-1 block">
              Identificador alfanumérico único para auditoría y codificación SKU
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Nombre *
            </label>
            <Input
              placeholder={
                modalState.level === "department"
                  ? "Víveres y Abarrotes"
                  : modalState.level === "group"
                    ? "Enlatados y Conservas"
                    : "Atún y Sardinas"
              }
              value={modalState.name}
              onChange={(e) =>
                setModalState({ ...modalState, name: e.target.value })
              }
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Descripción (Opcional)
            </label>
            <Input
              placeholder="Detalles complementarios o alcance de la clasificación..."
              value={modalState.description}
              onChange={(e) =>
                setModalState({ ...modalState, description: e.target.value })
              }
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() =>
                setModalState((prev) => ({ ...prev, isOpen: false }))
              }
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : modalState.isEdit
                  ? "Actualizar"
                  : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Búsqueda y Localización en la Jerarquía */}
      <HierarchySearchModal
        isOpen={isHierarchyModalOpen}
        onClose={() => setIsHierarchyModalOpen(false)}
        onSelect={(sel) => {
          if (sel.departmentId) {
            setSelectedDept(sel.departmentId);
            if (sel.groupId) {
              setSelectedGroup(sel.groupId);
            }
          }
        }}
        initialDepartmentId={selectedDept || ''}
        initialGroupId={selectedGroup || ''}
        selectionMode="any"
        title="Localizador Rápido de Jerarquía de Productos"
        subtitle="Ubique rápidamente cualquier departamento, grupo o subgrupo para gestionarlo en el panel"
      />
    </div>
  );
};
