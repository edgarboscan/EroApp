import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore, isSuperAdminRole, isWaiterRole } from "../../stores/authStore";
import { showConfirmQuestion } from "../../lib/sweetalert";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { toast } from "sonner";
import {
  Building2,
  Warehouse,
  ArrowRight,
  Check,
  LogOut,
  RefreshCw,
  Lock,
  Store,
} from "lucide-react";
import { getDefaultAppRoute } from "../../lib/navigation";

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

export const SelectBranchView: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    token,
    activeBranchId,
    activeWarehouseId,
    activeCashRegisterId,
    setActiveBranch,
    logout,
  } = useAuthStore();

  const isWaiter = isWaiterRole(user?.role);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    activeBranchId || "",
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    activeWarehouseId || "",
  );
  const [registers, setRegisters] = useState<CashRegisterOption[]>([]);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>(
    activeCashRegisterId || "",
  );
  const [isFetchingRegisters, setIsFetchingRegisters] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchBranches = useCallback(async () => {
    setIsFetching(true);
    try {
      let loadedBranches: BranchOption[] = [];

      if (token) {
        const response = await fetch("/api/auth/branches", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const json = await response.json();
          if (
            json.success &&
            Array.isArray(json.data) &&
            json.data.length > 0
          ) {
            const isSuper = isSuperAdminRole(user?.role);
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
              if (
                userWarehouseIds.length > 0 &&
                user?.canSwitchWarehouses === false
              ) {
                userBranches = userBranches.map((b: BranchOption) => ({
                  ...b,
                  warehouses: b.warehouses.filter((w: WarehouseOption) =>
                    userWarehouseIds.includes(w.id),
                  ),
                }));
              }
            }

            loadedBranches = userBranches;
          }
        }
      }

      setBranches(loadedBranches);

      if (loadedBranches.length > 0) {
        // Selección de sucursal desde base de datos
        let currentBranch = loadedBranches.find(
          (b) => b.id === (selectedBranchId || activeBranchId),
        );
        if (!currentBranch) {
          currentBranch =
            loadedBranches.find((b) => b.isMain) || loadedBranches[0];
        }

        if (currentBranch) {
          setSelectedBranchId(currentBranch.id);

          const currentWhs = currentBranch.warehouses || [];
          if (currentWhs.length > 0) {
            const currentWh =
              currentWhs.find(
                (w) => w.id === (selectedWarehouseId || activeWarehouseId),
              ) ||
              currentWhs.find((w) => w.isDefault) ||
              currentWhs[0];
            if (currentWh) {
              setSelectedWarehouseId(currentWh.id);
            }
          } else {
            setSelectedWarehouseId("");
          }
        }
      } else {
        setSelectedBranchId("");
        setSelectedWarehouseId("");
      }
    } catch {
      setBranches([]);
      setSelectedBranchId("");
      setSelectedWarehouseId("");
    } finally {
      setIsFetching(false);
    }
  }, [
    token,
    user,
    activeBranchId,
    activeWarehouseId,
    selectedBranchId,
    selectedWarehouseId,
  ]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (!selectedBranchId || !token) {
      setRegisters([]);
      setSelectedCashRegisterId("");
      return;
    }

    let isMounted = true;
    const fetchRegisters = async () => {
      setIsFetchingRegisters(true);
      try {
        const queryParam = isWaiter
          ? `?branchId=${selectedBranchId}&acceptsOrders=true`
          : `?branchId=${selectedBranchId}`;
        const res = await fetch(`/api/pos/registers${queryParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.success && Array.isArray(json.data)) {
            let list: CashRegisterOption[] = json.data;
            if (isWaiter) {
              list = list.filter((r: any) => r.acceptsOrders !== false);
            }
            setRegisters(list);

            if (list.length > 0) {
              const current = list.find(
                (r) => r.id === (selectedCashRegisterId || activeCashRegisterId),
              );
              if (current) {
                setSelectedCashRegisterId(current.id);
              } else {
                const openOne =
                  list.find(
                    (r) =>
                      r.status?.toUpperCase() === "OPEN" ||
                      r.status?.toLowerCase() === "open",
                  ) || list[0];
                setSelectedCashRegisterId(openOne.id);
              }
            } else {
              setSelectedCashRegisterId("");
            }
          }
        }
      } catch {
        if (isMounted) setRegisters([]);
      } finally {
        if (isMounted) setIsFetchingRegisters(false);
      }
    };

    fetchRegisters();
    return () => {
      isMounted = false;
    };
  }, [selectedBranchId, token, isWaiter, activeCashRegisterId]);

  const isSuper = isSuperAdminRole(user?.role);
  const activeBranch =
    branches.find((b) => b.id === selectedBranchId) || branches[0] || null;
  const activeWarehouses = activeBranch?.warehouses || [];

  const canSwitchBranch =
    isSuper ||
    (user?.allBranches !== false ? branches.length > 1 : branches.length > 1);
  const canSwitchWarehouse =
    isSuper ||
    (user?.canSwitchWarehouses !== false && activeWarehouses.length > 1);

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
    toast.success("Entorno de trabajo activado correctamente");
    setTimeout(() => {
      setIsSubmitting(false);
      const targetRoute = isWaiter
        ? "/restaurant/orders"
        : getDefaultAppRoute(useAuthStore.getState().hasPermission);
      navigate(targetRoute, { replace: true });
    }, 300);
  };

  const handleLogout = async () => {
    const confirmed = await showConfirmQuestion({
      title: "¿Seguro que desea cerrar sesión?",
      text: "¿Estás seguro de que deseas cerrar sesión?",
      confirmButtonText: "Sí, cerrar sesión",
      cancelButtonText: "Cancelar",
      icon: "question",
    });
    if (!confirmed) return;
    logout("Cierre voluntario de sesión");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <Card className="p-6 sm:p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Selección de Sucursal y Depósito
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Bienvenido,{" "}
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {user?.fullName || user?.username}
                </span>
                . Seleccione el entorno operativo de trabajo.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Estado de Carga con Skeletons */}
          {isFetching ? (
            <div className="space-y-6">
              <div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-28 mb-3 animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="h-20 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
                  <div className="h-20 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
                </div>
              </div>
              <div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-44 mb-3 animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="h-16 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
                  <div className="h-16 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
                </div>
              </div>
              <div className="h-10 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
              <div className="h-11 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            </div>
          ) : branches.length === 0 ? (
            /* Estado Vacío Explícito */
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  No hay sucursales disponibles
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
                  Tu usuario no tiene sucursales asignadas en esta empresa o no
                  hay registros activos. Contacte al administrador.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={fetchBranches}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  <span>Reintentar</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  <span>Cambiar cuenta</span>
                </Button>
              </div>
            </div>
          ) : (
            /* Formulario Principal de Selección */
            <div className="space-y-6">
              {/* Paso 1: Sucursales */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {branches.map((b) => {
                    const isSelected = b.id === selectedBranchId;
                    return (
                      <div
                        key={b.id}
                        onClick={
                          canSwitchBranch
                            ? () => handleBranchChange(b.id)
                            : undefined
                        }
                        className={`p-4 rounded-lg border text-left transition-colors ${
                          canSwitchBranch ? "cursor-pointer" : "cursor-default"
                        } ${
                          isSelected
                            ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/20 ring-2 ring-sky-500"
                            : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
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

              {/* Paso 2: Depósitos */}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeWarehouses.map((w) => {
                      const isSelected = w.id === selectedWarehouseId;
                      return (
                        <div
                          key={w.id}
                          onClick={
                            canSwitchWarehouse
                              ? () => setSelectedWarehouseId(w.id)
                              : undefined
                          }
                          className={`p-3.5 rounded-lg border text-left transition-colors ${
                            canSwitchWarehouse
                              ? "cursor-pointer"
                              : "cursor-default"
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
                            {isSelected && (
                              <Check className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                            )}
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
                  <div className="p-4 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg text-center text-xs text-neutral-500 dark:text-neutral-400">
                    Esta sucursal no posee depósitos asociados activos.
                  </div>
                )}
              </div>

              {/* Paso 3: Caja Registradora para Comandas y Ventas */}
              {(registers.length > 0 || isWaiter) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                      3. Caja Registradora {isWaiter ? "(Comandas de Restaurante)" : "Asignada (Opcional)"}
                    </label>
                    {isWaiter && (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        Solo cajas que aceptan comandas
                      </span>
                    )}
                  </div>

                  {isFetchingRegisters ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="h-16 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
                      <div className="h-16 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
                    </div>
                  ) : registers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {registers.map((r) => {
                        const isSelected = r.id === selectedCashRegisterId;
                        const isOpen =
                          r.status?.toUpperCase() === "OPEN" ||
                          r.status?.toLowerCase() === "open";
                        return (
                          <div
                            key={r.id}
                            onClick={() => setSelectedCashRegisterId(r.id)}
                            className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                              isSelected
                                ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/20 ring-2 ring-sky-500"
                                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                                {r.code}
                              </span>
                              <div className="flex items-center gap-1.5">
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
                    <div className="p-4 border border-dashed border-amber-200 dark:border-amber-800/60 rounded-lg text-center text-xs text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                      {isWaiter
                        ? "No hay cajas configuradas para aceptar comandas en esta sucursal. Contacte al administrador."
                        : "No hay cajas registradoras activas en esta sucursal."}
                    </div>
                  )}
                </div>
              )}

              {/* Resumen */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs flex items-center justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">
                  Operaciones enlazadas a:
                </span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {activeBranch ? (
                    <>
                      {activeBranch.name} •{" "}
                      {activeWarehouses.find(
                        (w) => w.id === selectedWarehouseId,
                      )?.name || "Depósito no asignado"}
                      {selectedCashRegisterId && (
                        <>
                          {" "}•{" "}
                          <span className="text-sky-600 dark:text-sky-400">
                            {registers.find((r) => r.id === selectedCashRegisterId)?.name || "Caja asignada"}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    "Sin selección"
                  )}
                </span>
              </div>

              <Button
                onClick={handleConfirm}
                className="w-full h-11 text-sm font-semibold rounded-lg"
                isLoading={isSubmitting}
                disabled={
                  !selectedBranchId ||
                  (activeWarehouses.length > 0 && !selectedWarehouseId) ||
                  (isWaiter && (registers.length === 0 || !selectedCashRegisterId))
                }
              >
                <span>Confirmar y Entrar al Sistema</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
