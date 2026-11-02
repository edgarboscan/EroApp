import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, FolderTree, Layers, ChevronRight, Check, Folder, Tag, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { useAuthStore } from '../../stores/authStore';

export interface DepartmentNode {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  groupsCount?: number;
  productsCount?: number;
}

export interface GroupNode {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  departmentName?: string;
  departmentCode?: string;
  subgroupsCount?: number;
  productsCount?: number;
}

export interface SubgroupNode {
  id: string;
  groupId: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  groupName?: string;
  groupCode?: string;
  departmentId?: string;
  departmentName?: string;
  departmentCode?: string;
  productsCount?: number;
}

export interface HierarchySelection {
  departmentId?: string;
  departmentName?: string;
  departmentCode?: string;
  groupId?: string;
  groupName?: string;
  groupCode?: string;
  subgroupId?: string;
  subgroupName?: string;
  subgroupCode?: string;
  level: 'department' | 'group' | 'subgroup' | 'none';
  fullPath: string;
}

export interface HierarchySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: HierarchySelection) => void;
  title?: string;
  subtitle?: string;
  initialDepartmentId?: string;
  initialGroupId?: string;
  initialSubgroupId?: string;
  selectionMode?: 'any' | 'department_only' | 'group_only' | 'subgroup_only';
  allowClear?: boolean;
}

interface SearchMatchItem {
  id: string;
  level: 'department' | 'group' | 'subgroup';
  code: string;
  name: string;
  description?: string;
  departmentId: string;
  departmentName: string;
  departmentCode?: string;
  groupId?: string;
  groupName?: string;
  groupCode?: string;
  subgroupId?: string;
  subgroupName?: string;
  subgroupCode?: string;
  fullPath: string;
  productsCount?: number;
  childrenCount?: number;
}

export const HierarchySearchModal: React.FC<HierarchySearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Búsqueda y Selección de Jerarquía de Productos',
  subtitle = 'Busque y seleccione el Departamento, Grupo o Subgrupo de clasificación de productos',
  initialDepartmentId = '',
  initialGroupId = '',
  initialSubgroupId = '',
  selectionMode = 'any',
  allowClear = true,
}) => {
  const { token } = useAuthStore();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Datos cargados desde API
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);
  const [groups, setGroups] = useState<GroupNode[]>([]);
  const [subgroups, setSubgroups] = useState<SubgroupNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de búsqueda y navegación en cascada
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDepartmentId, setActiveDepartmentId] = useState<string>(initialDepartmentId);
  const [activeGroupId, setActiveGroupId] = useState<string>(initialGroupId);
  const [activeSubgroupId, setActiveSubgroupId] = useState<string>(initialSubgroupId);

  // Filtros internos por columna en modo explorador
  const [deptFilter, setDeptFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [subgroupFilter, setSubgroupFilter] = useState('');

  // Selección temporal antes de confirmar
  const [selectedNode, setSelectedNode] = useState<{
    level: 'department' | 'group' | 'subgroup' | 'none';
    departmentId?: string;
    departmentName?: string;
    departmentCode?: string;
    groupId?: string;
    groupName?: string;
    groupCode?: string;
    subgroupId?: string;
    subgroupName?: string;
    subgroupCode?: string;
    fullPath: string;
  } | null>(null);

  // Carga de jerarquía completa al abrir
  useEffect(() => {
    if (!isOpen) return;

    // Reset de búsqueda y selección inicial
    setSearchTerm('');
    setDeptFilter('');
    setGroupFilter('');
    setSubgroupFilter('');
    setActiveDepartmentId(initialDepartmentId);
    setActiveGroupId(initialGroupId);
    setActiveSubgroupId(initialSubgroupId);

    const fetchHierarchy = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch('/api/inventory/hierarchy', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setDepartments(json.data.departments || []);
            setGroups(json.data.groups || []);
            setSubgroups(json.data.subgroups || []);
          }
        } else {
          // Fallback a endpoints individuales
          const [deptsRes, groupsRes, subsRes] = await Promise.all([
            fetch('/api/inventory/departments', { headers }),
            fetch('/api/inventory/groups', { headers }),
            fetch('/api/inventory/subgroups', { headers }),
          ]);
          if (deptsRes.ok && groupsRes.ok && subsRes.ok) {
            const deptsJson = await deptsRes.json();
            const groupsJson = await groupsRes.json();
            const subsJson = await subsRes.json();
            setDepartments(deptsJson.data || []);
            setGroups(groupsJson.data || []);
            setSubgroups(subsJson.data || []);
          } else {
            setError('No se pudo cargar la jerarquía de productos.');
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error al conectar con el servidor.');
      } finally {
        setLoading(false);
      }
    };

    fetchHierarchy();
  }, [isOpen, initialDepartmentId, initialGroupId, initialSubgroupId, token]);

  // Enfocar input de búsqueda al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    }
  }, [isOpen]);

  // Si hay selecciones iniciales, configurar el nodo seleccionado
  useEffect(() => {
    if (!isOpen || departments.length === 0) return;

    if (initialSubgroupId) {
      const sub = subgroups.find((s) => s.id === initialSubgroupId);
      if (sub) {
        const grp = groups.find((g) => g.id === sub.groupId);
        const dept = departments.find((d) => d.id === (sub.departmentId || grp?.departmentId));
        setSelectedNode({
          level: 'subgroup',
          departmentId: dept?.id || sub.departmentId,
          departmentName: dept?.name || sub.departmentName,
          departmentCode: dept?.code || sub.departmentCode,
          groupId: grp?.id || sub.groupId,
          groupName: grp?.name || sub.groupName,
          groupCode: grp?.code || sub.groupCode,
          subgroupId: sub.id,
          subgroupName: sub.name,
          subgroupCode: sub.code,
          fullPath: [dept?.name || sub.departmentName, grp?.name || sub.groupName, sub.name].filter(Boolean).join(' > '),
        });
        if (dept) setActiveDepartmentId(dept.id);
        if (grp) setActiveGroupId(grp.id);
        setActiveSubgroupId(sub.id);
        return;
      }
    }

    if (initialGroupId) {
      const grp = groups.find((g) => g.id === initialGroupId);
      if (grp) {
        const dept = departments.find((d) => d.id === grp.departmentId);
        setSelectedNode({
          level: 'group',
          departmentId: dept?.id,
          departmentName: dept?.name,
          departmentCode: dept?.code,
          groupId: grp.id,
          groupName: grp.name,
          groupCode: grp.code,
          fullPath: [dept?.name, grp.name].filter(Boolean).join(' > '),
        });
        if (dept) setActiveDepartmentId(dept.id);
        setActiveGroupId(grp.id);
        return;
      }
    }

    if (initialDepartmentId) {
      const dept = departments.find((d) => d.id === initialDepartmentId);
      if (dept) {
        setSelectedNode({
          level: 'department',
          departmentId: dept.id,
          departmentName: dept.name,
          departmentCode: dept.code,
          fullPath: dept.name,
        });
        setActiveDepartmentId(dept.id);
      }
    }
  }, [isOpen, departments, groups, subgroups, initialDepartmentId, initialGroupId, initialSubgroupId]);

  // Lista unificada para búsqueda global
  const searchResults = useMemo<SearchMatchItem[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];

    const matches: SearchMatchItem[] = [];

    // 1. Departamentos
    if (selectionMode === 'any' || selectionMode === 'department_only') {
      departments.forEach((d) => {
        const matchCode = d.code?.toLowerCase().includes(q);
        const matchName = d.name?.toLowerCase().includes(q);
        const matchDesc = d.description?.toLowerCase().includes(q);
        if (matchCode || matchName || matchDesc) {
          matches.push({
            id: d.id,
            level: 'department',
            code: d.code,
            name: d.name,
            description: d.description,
            departmentId: d.id,
            departmentName: d.name,
            departmentCode: d.code,
            fullPath: d.name,
            productsCount: d.productsCount,
            childrenCount: d.groupsCount,
          });
        }
      });
    }

    // 2. Grupos
    if (selectionMode === 'any' || selectionMode === 'group_only') {
      groups.forEach((g) => {
        const dept = departments.find((d) => d.id === g.departmentId);
        const deptName = dept?.name || g.departmentName || '';
        const deptCode = dept?.code || g.departmentCode || '';
        const matchCode = g.code?.toLowerCase().includes(q);
        const matchName = g.name?.toLowerCase().includes(q);
        const matchDesc = g.description?.toLowerCase().includes(q);
        const matchDept = deptName.toLowerCase().includes(q);
        if (matchCode || matchName || matchDesc || matchDept) {
          matches.push({
            id: g.id,
            level: 'group',
            code: g.code,
            name: g.name,
            description: g.description,
            departmentId: g.departmentId,
            departmentName: deptName,
            departmentCode: deptCode,
            groupId: g.id,
            groupName: g.name,
            groupCode: g.code,
            fullPath: `${deptName} > ${g.name}`,
            productsCount: g.productsCount,
            childrenCount: g.subgroupsCount,
          });
        }
      });
    }

    // 3. Subgrupos
    if (selectionMode === 'any' || selectionMode === 'subgroup_only') {
      subgroups.forEach((s) => {
        const grp = groups.find((g) => g.id === s.groupId);
        const deptId = s.departmentId || grp?.departmentId || '';
        const dept = departments.find((d) => d.id === deptId);
        const deptName = dept?.name || s.departmentName || grp?.departmentName || '';
        const deptCode = dept?.code || s.departmentCode || '';
        const grpName = grp?.name || s.groupName || '';
        const grpCode = grp?.code || s.groupCode || '';

        const matchCode = s.code?.toLowerCase().includes(q);
        const matchName = s.name?.toLowerCase().includes(q);
        const matchDesc = s.description?.toLowerCase().includes(q);
        const matchGrp = grpName.toLowerCase().includes(q);
        const matchDept = deptName.toLowerCase().includes(q);

        if (matchCode || matchName || matchDesc || matchGrp || matchDept) {
          matches.push({
            id: s.id,
            level: 'subgroup',
            code: s.code,
            name: s.name,
            description: s.description,
            departmentId: deptId,
            departmentName: deptName,
            departmentCode: deptCode,
            groupId: s.groupId,
            groupName: grpName,
            groupCode: grpCode,
            subgroupId: s.id,
            subgroupName: s.name,
            subgroupCode: s.code,
            fullPath: `${deptName} > ${grpName} > ${s.name}`,
            productsCount: s.productsCount,
          });
        }
      });
    }

    return matches;
  }, [searchTerm, departments, groups, subgroups, selectionMode]);

  // Grupos filtrados por departamento activo
  const availableGroups = useMemo(() => {
    if (!activeDepartmentId) return [];
    return groups.filter((g) => g.departmentId === activeDepartmentId);
  }, [groups, activeDepartmentId]);

  // Subgrupos filtrados por grupo activo
  const availableSubgroups = useMemo(() => {
    if (!activeGroupId) return [];
    return subgroups.filter((s) => s.groupId === activeGroupId);
  }, [subgroups, activeGroupId]);

  // Filtrado de columnas por texto individual
  const filteredDepartments = useMemo(() => {
    const q = deptFilter.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
    );
  }, [departments, deptFilter]);

  const filteredGroups = useMemo(() => {
    const q = groupFilter.trim().toLowerCase();
    if (!q) return availableGroups;
    return availableGroups.filter(
      (g) => g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q)
    );
  }, [availableGroups, groupFilter]);

  const filteredSubgroups = useMemo(() => {
    const q = subgroupFilter.trim().toLowerCase();
    if (!q) return availableSubgroups;
    return availableSubgroups.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [availableSubgroups, subgroupFilter]);

  // Manejador de selección de un nodo
  const handleSelectDepartment = (dept: DepartmentNode, autoConfirm = false) => {
    setActiveDepartmentId(dept.id);
    setActiveGroupId('');
    setActiveSubgroupId('');

    const node: HierarchySelection = {
      level: 'department',
      departmentId: dept.id,
      departmentName: dept.name,
      departmentCode: dept.code,
      fullPath: dept.name,
    };
    setSelectedNode(node);

    if (autoConfirm && (selectionMode === 'any' || selectionMode === 'department_only')) {
      onSelect(node);
      onClose();
    }
  };

  const handleSelectGroup = (grp: GroupNode, autoConfirm = false) => {
    setActiveGroupId(grp.id);
    setActiveSubgroupId('');

    const dept = departments.find((d) => d.id === grp.departmentId);
    const node: HierarchySelection = {
      level: 'group',
      departmentId: dept?.id || grp.departmentId,
      departmentName: dept?.name || grp.departmentName,
      departmentCode: dept?.code || grp.departmentCode,
      groupId: grp.id,
      groupName: grp.name,
      groupCode: grp.code,
      fullPath: `${dept?.name || grp.departmentName || ''} > ${grp.name}`,
    };
    setSelectedNode(node);

    if (autoConfirm && (selectionMode === 'any' || selectionMode === 'group_only')) {
      onSelect(node);
      onClose();
    }
  };

  const handleSelectSubgroup = (sub: SubgroupNode, autoConfirm = false) => {
    setActiveSubgroupId(sub.id);

    const grp = groups.find((g) => g.id === sub.groupId);
    const deptId = sub.departmentId || grp?.departmentId;
    const dept = departments.find((d) => d.id === deptId);

    const node: HierarchySelection = {
      level: 'subgroup',
      departmentId: dept?.id || deptId,
      departmentName: dept?.name || sub.departmentName || grp?.departmentName,
      departmentCode: dept?.code || sub.departmentCode,
      groupId: grp?.id || sub.groupId,
      groupName: grp?.name || sub.groupName,
      groupCode: grp?.code || sub.groupCode,
      subgroupId: sub.id,
      subgroupName: sub.name,
      subgroupCode: sub.code,
      fullPath: `${dept?.name || sub.departmentName || ''} > ${grp?.name || sub.groupName || ''} > ${sub.name}`,
    };
    setSelectedNode(node);

    if (autoConfirm || selectionMode === 'subgroup_only' || selectionMode === 'any') {
      onSelect(node);
      onClose();
    }
  };

  const handleSelectSearchResult = (item: SearchMatchItem, autoConfirm = false) => {
    const node: HierarchySelection = {
      level: item.level,
      departmentId: item.departmentId,
      departmentName: item.departmentName,
      departmentCode: item.departmentCode,
      groupId: item.groupId,
      groupName: item.groupName,
      groupCode: item.groupCode,
      subgroupId: item.subgroupId,
      subgroupName: item.subgroupName,
      subgroupCode: item.subgroupCode,
      fullPath: item.fullPath,
    };
    setSelectedNode(node);

    if (item.departmentId) setActiveDepartmentId(item.departmentId);
    if (item.groupId) setActiveGroupId(item.groupId);
    if (item.subgroupId) setActiveSubgroupId(item.subgroupId);

    if (autoConfirm) {
      onSelect(node);
      onClose();
    }
  };

  const handleConfirm = () => {
    if (!selectedNode) return;
    onSelect(selectedNode);
    onClose();
  };

  const handleClearSelection = () => {
    const emptyNode: HierarchySelection = {
      level: 'none',
      departmentId: '',
      departmentName: '',
      departmentCode: '',
      groupId: '',
      groupName: '',
      groupCode: '',
      subgroupId: '',
      subgroupName: '',
      subgroupCode: '',
      fullPath: '',
    };
    onSelect(emptyNode);
    onClose();
  };

  const isConfirmDisabled = useMemo(() => {
    if (!selectedNode) return true;
    if (selectionMode === 'department_only' && selectedNode.level !== 'department') return true;
    if (selectionMode === 'group_only' && selectedNode.level !== 'group') return true;
    if (selectionMode === 'subgroup_only' && selectedNode.level !== 'subgroup') return true;
    return false;
  }, [selectedNode, selectionMode]);

  const activeDept = departments.find((d) => d.id === activeDepartmentId);
  const activeGrp = groups.find((g) => g.id === activeGroupId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={<FolderTree className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
      size="5xl"
      className="max-h-[92vh]"
      contentClassName="p-0 flex flex-col flex-1 overflow-hidden"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 truncate max-w-full">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 shrink-0">
              Selección activa:
            </span>
            {selectedNode && selectedNode.level !== 'none' ? (
              <span className="font-mono text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800 truncate">
                {selectedNode.fullPath}
              </span>
            ) : (
              <span className="italic text-neutral-400 dark:text-neutral-500">
                (Ninguna categoría seleccionada)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {allowClear && (
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                Limpiar Selección
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Confirmar Selección
            </Button>
          </div>
        </div>
      }
    >
      {/* Barra de búsqueda global predictiva */}
      <div className="p-3 sm:px-5 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Escriba para buscar por Departamento, Grupo o Subgrupo (código o nombre)..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none"
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
            {searchTerm ? `${searchResults.length} resultados` : `${departments.length} departamentos`}
          </Badge>
        </div>

        {/* Barra de Miga de Pan (Breadcrumbs) interactiva */}
        {!searchTerm && (
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-neutral-500 dark:text-neutral-400 overflow-x-auto py-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveDepartmentId('');
                setActiveGroupId('');
                setActiveSubgroupId('');
              }}
              className="hover:text-sky-600 dark:hover:text-sky-400 font-medium shrink-0 cursor-pointer"
            >
              Catálogo General
            </button>
            {activeDept && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => {
                    setActiveGroupId('');
                    setActiveSubgroupId('');
                  }}
                  className="hover:text-sky-600 dark:hover:text-sky-400 font-medium text-sky-700 dark:text-sky-300 shrink-0 cursor-pointer"
                >
                  {activeDept.name}
                </button>
              </>
            )}
            {activeGrp && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="font-medium text-indigo-700 dark:text-indigo-300 shrink-0">
                  {activeGrp.name}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-y-auto min-h-[380px] max-h-[550px] p-3 sm:p-5">
        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            {error}
          </div>
        ) : searchTerm ? (
          /* ========================================================= */
          /* MODO A: RESULTADOS DE BÚSQUEDA GLOBAL                     */
          /* ========================================================= */
          <div className="space-y-2">
            {searchResults.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-500 dark:text-neutral-400">
                <Search className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                No se encontraron categorías ni subgrupos que coincidan con "{searchTerm}".
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
                {searchResults.map((item) => {
                  const isSelected =
                    (item.level === 'department' && selectedNode?.departmentId === item.departmentId && selectedNode?.level === 'department') ||
                    (item.level === 'group' && selectedNode?.groupId === item.groupId && selectedNode?.level === 'group') ||
                    (item.level === 'subgroup' && selectedNode?.subgroupId === item.subgroupId && selectedNode?.level === 'subgroup');

                  const badgeColor =
                    item.level === 'department'
                      ? 'border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                      : item.level === 'group'
                      ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                      : 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300';

                  const levelLabel =
                    item.level === 'department' ? 'Departamento' : item.level === 'group' ? 'Grupo' : 'Subgrupo';

                  return (
                    <div
                      key={`${item.level}-${item.id}`}
                      onClick={() => handleSelectSearchResult(item, false)}
                      onDoubleClick={() => handleSelectSearchResult(item, true)}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-sky-50/80 dark:bg-sky-950/40 border-l-4 border-l-sky-600'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${badgeColor}`}>
                            {levelLabel}
                          </span>
                          <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                            {item.code}
                          </span>
                          <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 truncate">
                          <span>{item.fullPath}</span>
                          {item.productsCount !== undefined && (
                            <>
                              <span>•</span>
                              <span className="text-neutral-600 dark:text-neutral-300">
                                {item.productsCount} {item.productsCount === 1 ? 'producto' : 'productos'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSearchResult(item, true);
                          }}
                          className="text-[11px] py-1 px-2.5 h-auto"
                        >
                          Seleccionar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* MODO B: EXPLORADOR DE 3 COLUMNAS EN CASCADA               */
          /* ========================================================= */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Columna 1: Departamentos */}
            <div className="flex flex-col border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
              <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    1. Departamentos
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                    {filteredDepartments.length}
                  </span>
                </div>
                <input
                  type="text"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  placeholder="Filtrar departamentos..."
                  className="w-full px-2 py-1 text-[11px] bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60 max-h-[360px]">
                {filteredDepartments.map((dept) => {
                  const isActive = activeDepartmentId === dept.id;
                  const isSelected = selectedNode?.level === 'department' && selectedNode?.departmentId === dept.id;

                  return (
                    <div
                      key={dept.id}
                      onClick={() => handleSelectDepartment(dept, false)}
                      onDoubleClick={() => handleSelectDepartment(dept, true)}
                      className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 font-medium'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300'
                      } ${isSelected ? 'border-l-4 border-l-sky-600' : ''}`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                            {dept.code}
                          </span>
                          <span className="truncate">{dept.name}</span>
                        </div>
                        <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                          <span>{dept.groupsCount || 0} grupos</span>
                          <span>•</span>
                          <span>{dept.productsCount || 0} prods</span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-600' : 'text-neutral-300 dark:text-neutral-600'}`} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Columna 2: Grupos */}
            <div className="flex flex-col border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
              <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    2. Grupos
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                    {filteredGroups.length}
                  </span>
                </div>
                <input
                  type="text"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  placeholder="Filtrar grupos..."
                  disabled={!activeDepartmentId}
                  className="w-full px-2 py-1 text-[11px] bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60 max-h-[360px]">
                {!activeDepartmentId ? (
                  <div className="p-6 text-center text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                    Seleccione un departamento para ver sus grupos
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="p-6 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
                    No hay grupos en este departamento
                  </div>
                ) : (
                  filteredGroups.map((grp) => {
                    const isActive = activeGroupId === grp.id;
                    const isSelected = selectedNode?.level === 'group' && selectedNode?.groupId === grp.id;

                    return (
                      <div
                        key={grp.id}
                        onClick={() => handleSelectGroup(grp, false)}
                        onDoubleClick={() => handleSelectGroup(grp, true)}
                        className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 font-medium'
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300'
                        } ${isSelected ? 'border-l-4 border-l-indigo-600' : ''}`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                              {grp.code}
                            </span>
                            <span className="truncate">{grp.name}</span>
                          </div>
                          <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                            <span>{grp.subgroupsCount || 0} subgrupos</span>
                            <span>•</span>
                            <span>{grp.productsCount || 0} prods</span>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-neutral-300 dark:text-neutral-600'}`} />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Columna 3: Subgrupos */}
            <div className="flex flex-col border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
              <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    3. Subgrupos
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                    {filteredSubgroups.length}
                  </span>
                </div>
                <input
                  type="text"
                  value={subgroupFilter}
                  onChange={(e) => setSubgroupFilter(e.target.value)}
                  placeholder="Filtrar subgrupos..."
                  disabled={!activeGroupId}
                  className="w-full px-2 py-1 text-[11px] bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                />
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60 max-h-[360px]">
                {!activeGroupId ? (
                  <div className="p-6 text-center text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                    Seleccione un grupo para ver sus subgrupos
                  </div>
                ) : filteredSubgroups.length === 0 ? (
                  <div className="p-6 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
                    No hay subgrupos en este grupo
                  </div>
                ) : (
                  filteredSubgroups.map((sub) => {
                    const isSelected = selectedNode?.level === 'subgroup' && selectedNode?.subgroupId === sub.id;

                    return (
                      <div
                        key={sub.id}
                        onClick={() => handleSelectSubgroup(sub, false)}
                        onDoubleClick={() => handleSelectSubgroup(sub, true)}
                        className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-medium border-l-4 border-l-emerald-600'
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                              {sub.code}
                            </span>
                            <span className="truncate">{sub.name}</span>
                          </div>
                          <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                            <span>{sub.productsCount || 0} prods</span>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100">
                            Elegir
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

