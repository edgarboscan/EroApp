import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import { Building2, Warehouse, ArrowRight, Check } from 'lucide-react';

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  isDefault?: boolean;
}

interface BranchOption {
  id: string;
  code: string;
  name: string;
  isMain?: boolean;
  warehouses: WarehouseOption[];
}

const DEFAULT_BRANCHES: BranchOption[] = [
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    code: 'SUC-01',
    name: 'Sucursal Principal Caracas',
    isMain: true,
    warehouses: [
      { id: 'w1111111-1111-1111-1111-111111111111', code: 'ALM-01', name: 'Almacén Central Mayorista', isDefault: true },
      { id: 'w2222222-2222-2222-2222-222222222222', code: 'TIENDA-01', name: 'Depósito Piso de Venta', isDefault: false },
    ],
  },
  {
    id: 'b2222222-2222-2222-2222-222222222222',
    code: 'SUC-02',
    name: 'Sucursal Este - Las Mercedes',
    isMain: false,
    warehouses: [
      { id: 'w3333333-3333-3333-3333-333333333333', code: 'ALM-02', name: 'Almacén Las Mercedes', isDefault: true },
    ],
  },
];

export const SelectBranchView: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, activeBranchId, activeWarehouseId, setActiveBranch } = useAuthStore();

  const [branches, setBranches] = useState<BranchOption[]>(DEFAULT_BRANCHES);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    activeBranchId || DEFAULT_BRANCHES[0].id
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    activeWarehouseId || DEFAULT_BRANCHES[0].warehouses[0].id
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBranches = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/auth/branches', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setBranches(json.data);
          // Si no hay sucursal seleccionada, seleccionar la principal o primera
          if (!activeBranchId) {
            const initialBranch = json.data.find((b: BranchOption) => b.isMain) || json.data[0];
            setSelectedBranchId(initialBranch.id);
            if (initialBranch.warehouses.length > 0) {
              const defaultWh = initialBranch.warehouses.find((w: WarehouseOption) => w.isDefault) || initialBranch.warehouses[0];
              setSelectedWarehouseId(defaultWh.id);
            }
          }
        }
      } catch {
        // Usar default branches si la API está desconectada
      }
    };

    fetchBranches();
  }, [token, activeBranchId]);

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    const branch = branches.find((b) => b.id === branchId);
    if (branch && branch.warehouses.length > 0) {
      const defaultWh = branch.warehouses.find((w) => w.isDefault) || branch.warehouses[0];
      setSelectedWarehouseId(defaultWh.id);
    }
  };

  const handleConfirm = () => {
    setIsLoading(true);
    setActiveBranch(selectedBranchId, selectedWarehouseId);
    toast.success('Sucursal y depósito activados correctamente');
    setTimeout(() => {
      setIsLoading(false);
      navigate('/dashboard', { replace: true });
    }, 400);
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <Card className="p-6 sm:p-8">
          <div className="border-b border-neutral-200 pb-4 mb-6">
            <h1 className="text-base font-bold text-neutral-900">Selección de Sucursal y Depósito</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Bienvenido, <span className="font-semibold text-neutral-800">{user?.fullName || user?.username}</span>. Seleccione el entorno operativo de trabajo.
            </p>
          </div>

          <div className="space-y-6">
            {/* Paso 1: Sucursales */}
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-2">
                1. Sucursal Activa
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {branches.map((b) => {
                  const isSelected = b.id === selectedBranchId;
                  return (
                    <div
                      key={b.id}
                      onClick={() => handleBranchChange(b.id)}
                      className={`p-4 rounded-lg border text-left cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-500'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono text-neutral-500">{b.code}</span>
                        {b.isMain && (
                          <span className="text-[10px] bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded font-medium">
                            Principal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-sky-700' : 'text-neutral-500'}`} />
                        <span className="text-xs font-bold text-neutral-900 line-clamp-1">{b.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Paso 2: Depósitos */}
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-2">
                2. Depósito de Inventario Asociado
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeBranch.warehouses.map((w) => {
                  const isSelected = w.id === selectedWarehouseId;
                  return (
                    <div
                      key={w.id}
                      onClick={() => setSelectedWarehouseId(w.id)}
                      className={`p-3.5 rounded-lg border text-left cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-500'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-mono text-neutral-500">{w.code}</span>
                        {isSelected && <Check className="w-4 h-4 text-sky-600" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Warehouse className={`w-4 h-4 shrink-0 ${isSelected ? 'text-sky-700' : 'text-neutral-500'}`} />
                        <span className="text-xs font-semibold text-neutral-900">{w.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumen */}
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs flex items-center justify-between">
              <span className="text-neutral-500">Operaciones enlazadas a:</span>
              <span className="font-semibold text-neutral-800">
                {activeBranch.name} • {activeBranch.warehouses.find((w) => w.id === selectedWarehouseId)?.name || 'Depósito'}
              </span>
            </div>

            <Button
              onClick={handleConfirm}
              className="w-full h-11 text-sm font-semibold"
              isLoading={isLoading}
            >
              <span>Confirmar y Entrar al Sistema</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
