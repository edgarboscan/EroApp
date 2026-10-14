import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react';

interface HierarchyNode {
  id: string;
  code: string;
  name: string;
  type: 'department' | 'group' | 'subgroup';
  parentId?: string;
  childrenCount?: number;
}

export const HierarchyManager: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState<string>('d1');
  const [selectedGroup, setSelectedGroup] = useState<string>('g1');

  // Datos mock interactivos de la jerarquía
  const departments: HierarchyNode[] = [
    { id: 'd1', code: 'DEP-ALM', name: 'Alimentos y Víveres', type: 'department', childrenCount: 2 },
    { id: 'd2', code: 'DEP-FER', name: 'Ferretería y Construcción', type: 'department', childrenCount: 1 },
    { id: 'd3', code: 'DEP-ELE', name: 'Electrónica y Tecnología', type: 'department', childrenCount: 1 },
  ];

  const groups: HierarchyNode[] = [
    { id: 'g1', code: 'GRP-LAC', name: 'Lácteos y Derivados', type: 'group', parentId: 'd1', childrenCount: 2 },
    { id: 'g2', code: 'GRP-GRA', name: 'Granos y Cereales', type: 'group', parentId: 'd1', childrenCount: 1 },
    { id: 'g3', code: 'GRP-HER', name: 'Herramientas Manuales', type: 'group', parentId: 'd2', childrenCount: 1 },
  ];

  const subgroups: HierarchyNode[] = [
    { id: 's1', code: 'SUB-LEC', name: 'Leche en Polvo y Líquida', type: 'subgroup', parentId: 'g1' },
    { id: 's2', code: 'SUB-QUE', name: 'Quesos Duros y Semiduros', type: 'subgroup', parentId: 'g1' },
    { id: 's3', code: 'SUB-DES', name: 'Destornilladores de Precisión', type: 'subgroup', parentId: 'g3' },
  ];

  const currentGroups = groups.filter((g) => g.parentId === selectedDept);
  const currentSubgroups = subgroups.filter((s) => s.parentId === selectedGroup);

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Jerarquía de Clasificación de Productos</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Estructura de 3 niveles: Departamento → Grupo → Subgrupo para reportes, filtros y reglas masivas
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
            <Button size="sm" variant="outline">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nuevo
            </Button>
          }
        >
          <div className="space-y-2 mt-2">
            {departments.map((dept) => (
              <div
                key={dept.id}
                onClick={() => {
                  setSelectedDept(dept.id);
                  const firstGrp = groups.find((g) => g.parentId === dept.id);
                  if (firstGrp) setSelectedGroup(firstGrp.id);
                }}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedDept === dept.id
                    ? 'border-sky-600 bg-sky-50/60 ring-1 ring-sky-500'
                    : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <div>
                  <div className="text-xs font-mono text-neutral-400">{dept.code}</div>
                  <div className="text-sm font-semibold text-neutral-900">{dept.name}</div>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <Badge variant="neutral">{dept.childrenCount} grupos</Badge>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Columna 2: Grupos */}
        <Card
          title="2. Grupos"
          subtitle={`Pertenecientes a: ${departments.find((d) => d.id === selectedDept)?.name || ''}`}
          action={
            <Button size="sm" variant="outline">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nuevo
            </Button>
          }
        >
          <div className="space-y-2 mt-2">
            {currentGroups.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-xs">
                No hay grupos registrados en este departamento
              </div>
            ) : (
              currentGroups.map((grp) => (
                <div
                  key={grp.id}
                  onClick={() => setSelectedGroup(grp.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedGroup === grp.id
                      ? 'border-sky-600 bg-sky-50/60 ring-1 ring-sky-500'
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <div>
                    <div className="text-xs font-mono text-neutral-400">{grp.code}</div>
                    <div className="text-sm font-semibold text-neutral-900">{grp.name}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-neutral-400">
                    <Badge variant="neutral">{grp.childrenCount} subgrupos</Badge>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Columna 3: Subgrupos */}
        <Card
          title="3. Subgrupos"
          subtitle={`Pertenecientes a: ${groups.find((g) => g.id === selectedGroup)?.name || ''}`}
          action={
            <Button size="sm" variant="outline">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nuevo
            </Button>
          }
        >
          <div className="space-y-2 mt-2">
            {currentSubgroups.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-xs">
                No hay subgrupos registrados en este grupo
              </div>
            ) : (
              currentSubgroups.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50"
                >
                  <div>
                    <div className="text-xs font-mono text-neutral-400">{sub.code}</div>
                    <div className="text-sm font-semibold text-neutral-900">{sub.name}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1 text-neutral-400 hover:text-neutral-700 rounded">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 text-neutral-400 hover:text-red-600 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
