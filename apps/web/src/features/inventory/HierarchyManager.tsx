import React, { useState, useEffect, useCallback } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import {
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  FolderTree,
  Inbox,
} from "lucide-react";
import { showConfirmQuestion } from "../../lib/sweetalert";
import { useAuthStore } from "../../stores/authStore";
import { toast } from "sonner";

interface HierarchyNode {
  id: string;
  code: string;
  name: string;
  type?: "department" | "group" | "subgroup";
  parentId?: string;
  childrenCount?: number;
}

type HierarchyLevel = "department" | "group" | "subgroup";

interface ModalState {
  isOpen: boolean;
  level: HierarchyLevel;
  isEdit: boolean;
  id?: string;
  code: string;
  name: string;
}

export const HierarchyManager: React.FC = () => {
  const token = useAuthStore((state) => state.token);

  const [departments, setDepartments] = useState<HierarchyNode[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [loadingDepts, setLoadingDepts] = useState<boolean>(true);

  const [groups, setGroups] = useState<HierarchyNode[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);

  const [subgroups, setSubgroups] = useState<HierarchyNode[]>([]);
  const [loadingSubgroups, setLoadingSubgroups] = useState<boolean>(false);

  // Estado del modal para creación / edición
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    level: "department",
    isEdit: false,
    code: "",
    name: "",
  });

  // Cargar departamentos desde la base de datos
  const fetchDepartments = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch("/api/inventory/departments", { headers });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json.data) ? json.data : [];
        setDepartments(data);
        if (data.length > 0) {
          setSelectedDept((prev) =>
            prev && data.some((d: HierarchyNode) => d.id === prev)
              ? prev
              : data[0].id,
          );
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
    async (deptId: string) => {
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
            setSelectedGroup((prev) =>
              prev && data.some((g: HierarchyNode) => g.id === prev)
                ? prev
                : data[0].id,
            );
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

  // Abrir modal de creación
  const handleOpenCreate = (level: HierarchyLevel) => {
    setModalState({
      isOpen: true,
      level,
      isEdit: false,
      code: "",
      name: "",
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
    });
  };

  // Guardar (Crear o Actualizar)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalState.code.trim() || !modalState.name.trim()) {
      toast.error("Código y nombre son obligatorios");
      return;
    }

    const { level, isEdit, id, code, name } = modalState;
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      let url = "";
      let method = isEdit ? "PUT" : "POST";
      let body: Record<string, any> = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
      };

      if (level === "department") {
        url = isEdit
          ? `/api/inventory/departments/${id}`
          : "/api/inventory/departments";
      } else if (level === "group") {
        if (!selectedDept) {
          toast.error("Debe haber un departamento seleccionado");
          return;
        }
        url = isEdit ? `/api/inventory/groups/${id}` : "/api/inventory/groups";
        if (!isEdit) body.departmentId = selectedDept;
      } else {
        if (!selectedGroup) {
          toast.error("Debe haber un grupo seleccionado");
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
      text: `¿Está seguro de que desea eliminar el ${levelName} "${name}"?\n\nSi posee elementos dependientes o productos asociados, el sistema bloqueará la acción para preservar la integridad.`,
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
      return `${action} Grupo (${currentDeptObj?.name || ""})`;
    return `${action} Subgrupo (${currentGroupObj?.name || ""})`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-sky-700" />
            Jerarquía de Clasificación de Productos
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Estructura de 3 niveles: Departamento → Grupo → Subgrupo para
            reportes, filtros y reglas masivas
          </p>
        </div>
      </div>

      {/* Grid de 3 Columnas Jerárquicas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna 1: Departamentos */}
        <Card
          title="1. Departamentos"
          subtitle="Nivel principal de clasificación"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenCreate("department")}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nuevo
            </Button>
          }
        >
          <div className="space-y-2 mt-2">
            {loadingDepts ? (
              <div className="space-y-2 py-2">
                <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
              </div>
            ) : departments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Inbox className="w-8 h-8 text-neutral-400 mb-2" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Sin información
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  No hay departamentos registrados en base de datos
                </p>
              </div>
            ) : (
              departments.map((dept) => (
                <div
                  key={dept.id}
                  onClick={() => setSelectedDept(dept.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDept === dept.id
                      ? "border-sky-600 bg-sky-50/60 dark:bg-sky-950/20 ring-1 ring-sky-500"
                      : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-mono text-neutral-400">
                      {dept.code}
                    </div>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {dept.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="neutral">
                      {dept.childrenCount || 0} grupos
                    </Badge>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit("department", dept);
                      }}
                      className="p-1 text-neutral-400 hover:text-sky-600 rounded focus-visible:ring-2"
                      title="Editar departamento"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete("department", dept.id, dept.name);
                      }}
                      className="p-1 text-neutral-400 hover:text-red-600 rounded focus-visible:ring-2"
                      title="Eliminar departamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-neutral-400 ml-0.5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Columna 2: Grupos */}
        <Card
          title="2. Grupos"
          subtitle={
            currentDeptObj
              ? `Pertenecientes a: ${currentDeptObj.name}`
              : "Seleccione un departamento"
          }
          action={
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
          }
        >
          <div className="space-y-2 mt-2">
            {loadingGroups ? (
              <div className="space-y-2 py-2">
                <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
              </div>
            ) : !selectedDept ? (
              <div className="text-center py-10 text-neutral-400 text-xs">
                Seleccione un departamento para ver sus grupos
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Inbox className="w-8 h-8 text-neutral-400 mb-2" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Sin información
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  No hay grupos registrados en este departamento
                </p>
              </div>
            ) : (
              groups.map((grp) => (
                <div
                  key={grp.id}
                  onClick={() => setSelectedGroup(grp.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedGroup === grp.id
                      ? "border-sky-600 bg-sky-50/60 dark:bg-sky-950/20 ring-1 ring-sky-500"
                      : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-mono text-neutral-400">
                      {grp.code}
                    </div>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {grp.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="neutral">
                      {grp.childrenCount || 0} subgrupos
                    </Badge>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit("group", grp);
                      }}
                      className="p-1 text-neutral-400 hover:text-sky-600 rounded focus-visible:ring-2"
                      title="Editar grupo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete("group", grp.id, grp.name);
                      }}
                      className="p-1 text-neutral-400 hover:text-red-600 rounded focus-visible:ring-2"
                      title="Eliminar grupo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-neutral-400 ml-0.5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Columna 3: Subgrupos */}
        <Card
          title="3. Subgrupos"
          subtitle={
            currentGroupObj
              ? `Pertenecientes a: ${currentGroupObj.name}`
              : "Seleccione un grupo"
          }
          action={
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
          }
        >
          <div className="space-y-2 mt-2">
            {loadingSubgroups ? (
              <div className="space-y-2 py-2">
                <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
              </div>
            ) : !selectedGroup ? (
              <div className="text-center py-10 text-neutral-400 text-xs">
                Seleccione un grupo para ver sus subgrupos
              </div>
            ) : subgroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Inbox className="w-8 h-8 text-neutral-400 mb-2" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Sin información
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  No hay subgrupos registrados en este grupo
                </p>
              </div>
            ) : (
              subgroups.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-mono text-neutral-400">
                      {sub.code}
                    </div>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {sub.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit("subgroup", sub)}
                      className="p-1 text-neutral-400 hover:text-sky-600 rounded focus-visible:ring-2"
                      title="Editar subgrupo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete("subgroup", sub.id, sub.name)}
                      className="p-1 text-neutral-400 hover:text-red-600 rounded focus-visible:ring-2"
                      title="Eliminar subgrupo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Modal para Crear / Editar Nivel de Jerarquía */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={getModalTitle()}
      >
        <form onSubmit={handleSaveModal} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
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
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
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
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setModalState((prev) => ({ ...prev, isOpen: false }))
              }
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {modalState.isEdit ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
