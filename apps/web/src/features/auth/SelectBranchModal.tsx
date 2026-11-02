import React, { useState, useEffect, useCallback } from "react";
import { useAuthStore, isSuperAdminRole, isWaiterRole } from "../../stores/authStore";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { toast } from "sonner";
import {
  Building2,
  Warehouse,
  Check,
  RefreshCw,
  Lock,
  Store,
  AlertCircle,
} from "lucide-react";

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  isDefault?: boolean;
  isDefaultSales?: boolean;
  isDefaultPurchases?: boolean;
}

interface BranchOption {
  id: string;
  code: string;
  name: string;
  isMain?: boolean;
  warehouses: WarehouseOption[];
}

interface CashRegisterOption {
  id: string;
  code: string;
  name: string;
  status?: string;
  acceptsOrders?: boolean;
}

export interface SelectBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SelectBranchModal: React.FC<SelectBranchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    user,
    token,
    activeBranchId,
    activeWarehouseId,
    activeCashRegisterId,
    setActiveBranch,
    hasPermission,
  } = useAuthStore();

  const isWaiter = isWaiterRole(user?.role);
  const isSuper = isSuperAdminRole(user?.role);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranchId || "");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(activeWarehouseId || "");
  const [registers, setRegisters] = useState<CashRegisterOption[]>([]);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>(activeCashRegisterId || "");
  const [assignedRegisterId, setAssignedRegisterId] = useState<string | null>(null);

  const [isFetchingRegisters, setIsFetchingRegisters] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Inicializar estado cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setSelectedBranchId(activeBranchId || "");
      setSelectedWarehouseId(activeWarehouseId || "");
      setSelectedCashRegisterId(activeCashRegisterId || "");
      setAssignedRegisterId(activeCashRegisterId || null);
    }
  }, [isOpen, activeBranchId, activeWarehouseId, activeCashRegisterId]);

  // Cargar sucursales autorizadas
  const fetchBranches = useCallback(async () => {
    if (!token) return;
    setIsFetching(true);
    try {
      const response = await fetch("/api/auth/branches", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          let userBranches: BranchOption[] = json.data.map((b: any) => ({
            ...b,
            warehouses: Array.isArray(b.warehouses) ? b.warehouses : [],
          }));

          if (!isSuper) {
            const userBranchIds = user?.branches || [];
            if (userBranchIds.length > 0 && user?.allBranches === false) {
              userBranches = userBranches.filter((b: BranchOption) =>
                userBranchIds.includes(b.id),
              );
            }

            const userWarehouseIds = user?.warehouses || [];
            if (userWarehouseIds.length > 0 && user?.canSwitchWarehouses === false) {
              userBranches = userBranches.map((b: BranchOption) => ({
                ...b,
                warehouses: b.warehouses.filter((w: WarehouseOption) =>
                  userWarehouseIds.includes(w.id),
                ),
              }));
            }
          }

          setBranches(userBranches);

          // Si no hay sucursal seleccionada, asignar la activa o la principal
          if (!selectedBranchId || !userBranches.some((b) => b.id === selectedBranchId)) {
            const initialBranch =
              userBranches.find((b) => b.id === activeBranchId) ||
              userBranches.find((b) => b.isMain) ||
              userBranches[0];

            if (initialBranch) {
              setSelectedBranchId(initialBranch.id);
              const whs = initialBranch.warehouses || [];
              const initialWh =
                whs.find((w) => w.id === activeWarehouseId) ||
                whs.find((w) => w.isDefaultSales) ||
                whs.find((w) => w.isDefault) ||
                whs[0];
              if (initialWh) {
                setSelectedWarehouseId(initialWh.id);
              }
            }
          }
        }
      }
    } catch {
      setBranches([]);
    } finally {
      setIsFetching(false);
    }
  }, [token, isSuper, user, activeBranchId, activeWarehouseId, selectedBranchId]);

  useEffect(() => {
    if (isOpen) {
      fetchBranches();
    }
  }, [isOpen, fetchBranches]);

  // Cargar cajas registradoras y verificar asignación activa/turno abierto
  useEffect(() => {
    if (!isOpen || !selectedBranchId || !token) {
      setRegisters([]);
      return;
    }

    let isMounted = true;
    const fetchRegistersAndShift = async () => {
      setIsFetchingRegisters(true);
      try {
        const queryParam = isWaiter
          ? `?branchId=${selectedBranchId}&acceptsOrders=true`
          : `?branchId=${selectedBranchId}`;

        // 1. Cargar cajas de la sucursal
        const res = await fetch(`/api/pos/registers${queryParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let list: CashRegisterOption[] = [];
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            list = json.data;
            if (isWaiter) {
              list = list.filter((r: any) => r.acceptsOrders !== false);
            }
          }
        }

        if (!isMounted) return;
        setRegisters(list);

        // 2. Verificar si el usuario tiene un turno abierto o caja fija asignada
        let userAssignedId: string | null = null;

        // Comprobar turno abierto si tiene permiso de POS
        if (hasPermission('pos', 'read')) {
          try {
            const shiftRes = await fetch(`/api/pos/shifts/current?branchId=${selectedBranchId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (shiftRes.ok) {
              const shiftJson = await shiftRes.json();
              if (shiftJson.success && shiftJson.data?.cashRegisterId) {
                userAssignedId = shiftJson.data.cashRegisterId;
              }
            }
          } catch {
            // Ignorar error al consultar turno
          }
        }

        // Si no tiene turno abierto pero en la sesión ya tiene activa una caja perteneciente a esta sucursal
        if (!userAssignedId && activeCashRegisterId && list.some((r) => r.id === activeCashRegisterId)) {
          userAssignedId = activeCashRegisterId;
        }

        if (!isMounted) return;

        setAssignedRegisterId(userAssignedId);

        if (userAssignedId) {
          // Si el usuario ya tiene una caja asignada, se fija obligatoriamente
          setSelectedCashRegisterId(userAssignedId);
        } else if (list.length > 0) {
          // Si no tiene caja asignada, mantener la seleccionada o seleccionar una por defecto
          const currentValid = list.find((r) => r.id === selectedCashRegisterId);
          if (currentValid) {
            setSelectedCashRegisterId(currentValid.id);
          } else if (isWaiter) {
            const openOne = list.find(
              (r) => r.status?.toUpperCase() === "OPEN" || r.status?.toLowerCase() === "open",
            ) || list[0];
            setSelectedCashRegisterId(openOne.id);
          }
        } else {
          setSelectedCashRegisterId("");
        }
      } catch {
        if (isMounted) setRegisters([]);
      } finally {
        if (isMounted) setIsFetchingRegisters(false);
      }
    };

    fetchRegistersAndShift();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedBranchId, token, isWaiter, hasPermission, activeCashRegisterId]);

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0] || null;
  const activeWarehouses = activeBranch?.warehouses || [];

  const canSwitchBranch =
    isSuper ||
    (user?.allBranches !== false ? branches.length > 1 : (user?.branches || []).length > 1);
  const canSwitchWarehouse =
    isSuper ||
    (user?.canSwitchWarehouses !== false && activeWarehouses.length > 1);

  // Regla: si el usuario ya tiene asignada una caja, no debe permitir seleccionar otra
  const isCashRegisterLocked = Boolean(assignedRegisterId);

  const handleBranchChange = (branchId: string) => {
    if (!canSwitchBranch) return;
    setSelectedBranchId(branchId);
    const branch = branches.find((b) => b.id === branchId);
    if (branch && branch.warehouses && branch.warehouses.length > 0) {
      const defaultWh =
        branch.warehouses.find((w) => w.isDefaultSales) ||
        branch.warehouses.find((w) => w.isDefault) ||
        branch.warehouses[0];
      setSelectedWarehouseId(defaultWh.id);
    } else {
      setSelectedWarehouseId("");
    }
  };

  const handleRegisterSelect = (registerId: string) => {
    if (isCashRegisterLocked && assignedRegisterId !== registerId) {
      toast.warning("Ya tiene una caja asignada a su perfil. No puede seleccionar otra caja.");
      return;
    }
    setSelectedCashRegisterId(registerId);
  };

  const handleConfirm = () => {
    if (!selectedBranchId) {
      toast.error("Debe seleccionar una sucursal para continuar");
      return;
    }

    if (activeWarehouses.length > 0 && !selectedWarehouseId) {
      toast.error("Debe seleccionar un depósito para continuar");
      return;
    }

    if (isWaiter && registers.length > 0 && !selectedCashRegisterId) {
      toast.error("Debe seleccionar una caja para la toma de comandas");
      return;
    }

    if (isWaiter && registers.length === 0) {
      toast.error("No hay cajas disponibles configuradas para aceptar comandas en esta sucursal");
      return;
    }

    setIsSubmitting(true);
    setActiveBranch(
      selectedBranchId,
      selectedWarehouseId || undefined,
      selectedCashRegisterId || null,
    );

    toast.success("Entorno operativo actualizado correctamente");
    setIsSubmitting(false);
    onSuccess?.();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title="Selección de Sucursal, Depósito y Caja"
      description={`Usuario: ${user?.fullName || user?.username}. Modifique el entorno de trabajo actual.`}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            disabled={
              !selectedBranchId ||
              (activeWarehouses.length > 0 && !selectedWarehouseId) ||
              (isWaiter && (registers.length === 0 || !selectedCashRegisterId))
            }
            className="rounded-lg font-semibold"
          >
            Confirmar y Aplicar
          </Button>
        </div>
      }
    >
      {isFetching ? (
        <div className="space-y-5 py-2">
          <div>
            <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-28 mb-3 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-18 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
              <div className="h-18 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
            </div>
          </div>
          <div>
            <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-44 mb-3 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-16 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
              <div className="h-16 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="h-12 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
        </div>
      ) : branches.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
            <Building2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            No hay sucursales disponibles
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
            Su usuario no posee sucursales autorizadas activas en la empresa.
          </p>
          <Button variant="outline" size="sm" onClick={fetchBranches} className="rounded-lg mt-2">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            <span>Reintentar</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-5 py-1">
          {/* 1. Sucursal Activa */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                1. Sucursal Activa
              </label>
              {!canSwitchBranch && (
                <span className="text-[11px] text-neutral-500 flex items-center gap-1 font-medium bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <Lock className="w-3 h-3 text-neutral-400" />
                  Sucursal asignada fija
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {branches.map((b) => {
                const isSelected = b.id === selectedBranchId;
                return (
                  <div
                    key={b.id}
                    onClick={canSwitchBranch ? () => handleBranchChange(b.id) : undefined}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      canSwitchBranch ? "cursor-pointer" : "cursor-default opacity-85"
                    } ${
                      isSelected
                        ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/20 ring-2 ring-sky-500"
                        : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                        {b.code}
                      </span>
                      {b.isMain && (
                        <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-1.5 py-0.5 rounded font-medium">
                          Principal
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2
                        className={`w-4 h-4 shrink-0 ${isSelected ? "text-sky-700 dark:text-sky-400" : "text-neutral-400 dark:text-neutral-500"}`}
                      />
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                        {b.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Depósito de Inventario Asociado */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                2. Depósito de Inventario Asociado
              </label>
              {!canSwitchWarehouse && activeWarehouses.length > 0 && (
                <span className="text-[11px] text-neutral-500 flex items-center gap-1 font-medium bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <Lock className="w-3 h-3 text-neutral-400" />
                  Almacén fijo asignado
                </span>
              )}
            </div>
            {activeWarehouses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeWarehouses.map((w) => {
                  const isSelected = w.id === selectedWarehouseId;
                  return (
                    <div
                      key={w.id}
                      onClick={canSwitchWarehouse ? () => setSelectedWarehouseId(w.id) : undefined}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        canSwitchWarehouse ? "cursor-pointer" : "cursor-default opacity-85"
                      } ${
                        isSelected
                          ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/20 ring-2 ring-sky-500"
                          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                          {w.code}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Warehouse
                          className={`w-4 h-4 shrink-0 ${isSelected ? "text-sky-700 dark:text-sky-400" : "text-neutral-400 dark:text-neutral-500"}`}
                        />
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {w.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg text-center text-xs text-neutral-500 dark:text-neutral-400">
                Esta sucursal no posee depósitos asociados activos.
              </div>
            )}
          </div>

          {/* 3. Caja Registradora */}
          {(registers.length > 0 || isWaiter || isCashRegisterLocked) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  3. Caja Registradora {isWaiter ? "(Comandas de Restaurante)" : "Asignada (Opcional)"}
                </label>
                {isCashRegisterLocked ? (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Lock className="w-3 h-3 text-amber-500" />
                    Caja asignada en uso
                  </span>
                ) : isWaiter ? (
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    Solo cajas habilitadas para comandas
                  </span>
                ) : null}
              </div>

              {isCashRegisterLocked && (
                <div className="mb-2.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    El usuario ya tiene una caja asignada actualmente en esta sucursal. No se permite seleccionar otra caja diferente.
                  </span>
                </div>
              )}

              {isFetchingRegisters ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="h-16 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
                  <div className="h-16 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
                </div>
              ) : registers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {registers.map((r) => {
                    const isSelected = r.id === selectedCashRegisterId;
                    const isLockedThis = isCashRegisterLocked && assignedRegisterId === r.id;
                    const isLockedOther = isCashRegisterLocked && assignedRegisterId !== r.id;
                    const isOpen =
                      r.status?.toUpperCase() === "OPEN" || r.status?.toLowerCase() === "open";

                    return (
                      <div
                        key={r.id}
                        onClick={() => handleRegisterSelect(r.id)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          isLockedOther
                            ? "cursor-not-allowed opacity-50 bg-neutral-100/50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800"
                            : "cursor-pointer"
                        } ${
                          isSelected
                            ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/20 ring-2 ring-sky-500"
                            : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                        }`}
                        title={
                          isLockedOther
                            ? "No puede seleccionar otra caja: ya tiene una caja asignada"
                            : undefined
                        }
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                            {r.code}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isLockedThis && (
                              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" />
                                Asignada
                              </span>
                            )}
                            {isOpen && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                                Abierta
                              </span>
                            )}
                            {isSelected && (
                              <Check className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Store
                            className={`w-4 h-4 shrink-0 ${isSelected ? "text-sky-700 dark:text-sky-400" : "text-neutral-400 dark:text-neutral-500"}`}
                          />
                          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            {r.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 border border-dashed border-amber-200 dark:border-amber-800/60 rounded-lg text-center text-xs text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                  {isWaiter
                    ? "No hay cajas configuradas para aceptar comandas en esta sucursal."
                    : "No hay cajas registradoras activas en esta sucursal."}
                </div>
              )}
            </div>
          )}

          {/* Resumen del entorno operativo */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs flex items-center justify-between">
            <span className="text-neutral-500 dark:text-neutral-400">
              Operaciones enlazadas a:
            </span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 text-right">
              {activeBranch ? (
                <>
                  {activeBranch.name} •{" "}
                  {activeWarehouses.find((w) => w.id === selectedWarehouseId)?.name ||
                    "Depósito no asignado"}
                  {selectedCashRegisterId && (
                    <>
                      {" "}•{" "}
                      <span className="text-sky-600 dark:text-sky-400">
                        {registers.find((r) => r.id === selectedCashRegisterId)?.name ||
                          "Caja asignada"}
                      </span>
                    </>
                  )}
                </>
              ) : (
                "Sin selección"
              )}
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
};

