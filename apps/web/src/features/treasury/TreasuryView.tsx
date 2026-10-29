import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { toast } from "sonner";
import {
  Landmark,
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  DollarSign,
  TrendingUp,
  TrendingDown,
  X,
  CreditCard,
  Building2,
  Calendar,
  Filter,
  Check,
} from "lucide-react";
import {
  formatNumber,
  formatCurrency,
  formatMoneyUSD,
  formatMoneyVES,
  parseFormattedNumber,
} from "@ero/shared";
import { Modal } from "../../components/ui/Modal";

export interface BankAccount {
  id: string;
  bankId: string;
  bankCode: string;
  bankName: string;
  branchId?: string | null;
  branchName?: string;
  accountNumber: string;
  accountType: "CURRENT" | "SAVINGS" | "CUSTODY_USD";
  currency: "USD" | "VES";
  description: string;
  currentBalance: number;
  bookBalance: number;
  unclearedDeposits: number;
  unclearedWithdrawals: number;
  transitBalance: number;
  realBalance: number;
  clearedBalance: number;
  isActive: boolean;
  pendingReconciliationsCount: number;
  lastReconciliation?: {
    id: string;
    periodStart: string;
    periodEnd: string;
    statementBalance: number;
    difference: number;
    status: string;
    createdAt: string;
  } | null;
}

export interface BankMovement {
  id: string;
  accountId: string;
  movementType:
    | "DEPOSIT"
    | "WITHDRAWAL"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "CHECK"
    | "FEE"
    | "TAX_DEBIT";
  amount: number;
  balanceAfter: number;
  movementDate: string;
  referenceNumber?: string;
  concept: string;
  isReconciled: boolean;
}

export interface BankOption {
  id: string;
  code: string;
  name: string;
}

export interface BranchOption {
  id: string;
  name: string;
  code?: string;
}

export const TreasuryView: React.FC = () => {
  const navigate = useNavigate();
  const { token, hasPermission, activeBranchId } = useAuthStore();

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    activeBranchId || "all",
  );
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [movements, setMovements] = useState<BankMovement[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [filterReconciled, setFilterReconciled] = useState<
    "ALL" | "PENDING" | "RECONCILED"
  >("ALL");

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Form: Nueva Cuenta
  const [accountForm, setAccountForm] = useState({
    bankId: "",
    branchId: "" as string,
    accountNumber: "",
    accountType: "CURRENT" as "CURRENT" | "SAVINGS" | "CUSTODY_USD",
    currency: "VES" as "USD" | "VES",
    description: "",
    initialBalance: 0,
  });

  // Form: Nuevo Movimiento
  const [movementForm, setMovementForm] = useState({
    accountId: "",
    movementType: "DEPOSIT" as "DEPOSIT" | "WITHDRAWAL" | "FEE" | "TAX_DEBIT",
    amount: 0,
    referenceNumber: "",
    concept: "",
  });

  // Form: Transferencia
  const [transferForm, setTransferForm] = useState({
    originAccountId: "",
    destinationAccountId: "",
    amount: 0,
    exchangeRate: 36.5,
    referenceNumber: "",
    concept: "",
  });

  const canCreate = hasPermission("treasury", "create");
  const canReconcile = hasPermission("treasury", "reconcile");

  // Cargar lista de sucursales
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch("/api/auth/branches", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setBranches(json.data);
          }
        }
      } catch {
        // En caso de fallo silencioso
      }
    };
    fetchBranches();
  }, [token]);

  // Cargar datos de tesorería y cuentas
  const fetchTreasuryData = async () => {
    setLoading(true);
    try {
      const branchParam =
        selectedBranchId && selectedBranchId !== "all"
          ? `?branchId=${encodeURIComponent(selectedBranchId)}`
          : "";

      const [accRes, banksRes, sumRes] = await Promise.all([
        fetch(`/api/treasury/accounts${branchParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/treasury/banks", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/treasury/summary${branchParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (accRes.ok && banksRes.ok) {
        const accJson = await accRes.json();
        const banksJson = await banksRes.json();
        const accList: BankAccount[] = accJson.data || [];
        setAccounts(accList);
        setBanks(banksJson.data || []);

        if (sumRes.ok) {
          const sumJson = await sumRes.json();
          setSummary(sumJson.data || null);
        }

        // Cargar movimientos de la cuenta seleccionada o de la primera
        const targetAccountId =
          selectedAccountId !== "all"
            ? selectedAccountId
            : accList.length > 0
              ? accList[0].id
              : null;

        if (targetAccountId) {
          const movRes = await fetch(
            `/api/treasury/accounts/${targetAccountId}/movements`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (movRes.ok) {
            const movJson = await movRes.json();
            const list = Array.isArray(movJson.data)
              ? movJson.data
              : movJson.data?.movements || [];
            setMovements(list);
          }
        } else {
          setMovements([]);
        }
      } else {
        setAccounts([]);
        setBanks([]);
        setMovements([]);
      }
    } catch {
      setAccounts([]);
      setBanks([]);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreasuryData();
  }, [selectedBranchId, selectedAccountId]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !accountForm.bankId ||
      !accountForm.accountNumber ||
      !accountForm.description
    ) {
      toast.error("Completa los campos obligatorios de la cuenta");
      return;
    }

    try {
      const res = await fetch("/api/treasury/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...accountForm,
          branchId: accountForm.branchId || undefined,
        }),
      });

      if (res.ok) {
        toast.success("Cuenta bancaria agregada exitosamente");
        setIsAccountModalOpen(false);
        fetchTreasuryData();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || "Error al guardar la cuenta");
      }
    } catch {
      toast.error("Error de comunicación con el servidor");
    }
  };

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !movementForm.accountId ||
      movementForm.amount <= 0 ||
      !movementForm.concept
    ) {
      toast.error("Ingresa una cuenta, monto positivo y concepto");
      return;
    }

    try {
      const res = await fetch("/api/treasury/movements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(movementForm),
      });

      if (res.ok) {
        toast.success("Movimiento registrado exitosamente");
        setIsMovementModalOpen(false);
        setMovementForm({
          accountId: accounts[0]?.id || "",
          movementType: "DEPOSIT",
          amount: 0,
          referenceNumber: "",
          concept: "",
        });
        fetchTreasuryData();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || "Error al asentar el movimiento");
      }
    } catch {
      toast.error("Error de comunicación al asentar movimiento");
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !transferForm.originAccountId ||
      !transferForm.destinationAccountId ||
      transferForm.amount <= 0 ||
      !transferForm.concept
    ) {
      toast.error("Completa los campos requeridos para la transferencia");
      return;
    }

    if (transferForm.originAccountId === transferForm.destinationAccountId) {
      toast.error("La cuenta origen y destino deben ser distintas");
      return;
    }

    try {
      const res = await fetch("/api/treasury/transfers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(transferForm),
      });

      if (res.ok) {
        toast.success("Transferencia ejecutada exitosamente");
        setIsTransferModalOpen(false);
        fetchTreasuryData();
      } else {
        const json = await res.json();
        toast.error(
          json.error?.message || "Error al ejecutar la transferencia",
        );
      }
    } catch {
      toast.error("Error de comunicación al transferir fondos");
    }
  };

  // Alternar conciliación individual de un movimiento
  const handleToggleReconcile = async (
    movementId: string,
    currentStatus: boolean,
  ) => {
    try {
      const res = await fetch(
        `/api/treasury/movements/${movementId}/toggle-reconcile`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ isReconciled: !currentStatus }),
        },
      );

      if (res.ok) {
        toast.success(
          currentStatus
            ? "Movimiento marcado como pendiente"
            : "Movimiento conciliado",
        );
        fetchTreasuryData();
      } else {
        toast.error("Error al actualizar el estado de conciliación");
      }
    } catch {
      toast.error("Error de comunicación con el servidor");
    }
  };

  // Totales de disponibilidad en divisas y bolívares
  const totalUsdReal =
    summary?.totalUsdReal ??
    accounts
      .filter((a) => a.currency === "USD")
      .reduce((sum, a) => sum + (a.realBalance || a.currentBalance), 0);

  const totalUsdBook =
    summary?.totalUsdBook ??
    accounts
      .filter((a) => a.currency === "USD")
      .reduce((sum, a) => sum + a.currentBalance, 0);

  const totalVesReal =
    summary?.totalVesReal ??
    accounts
      .filter((a) => a.currency === "VES")
      .reduce((sum, a) => sum + (a.realBalance || a.currentBalance), 0);

  const totalVesBook =
    summary?.totalVesBook ??
    accounts
      .filter((a) => a.currency === "VES")
      .reduce((sum, a) => sum + a.currentBalance, 0);

  const totalPendingRec =
    summary?.pendingReconciliationsCount ??
    accounts.reduce((sum, a) => sum + (a.pendingReconciliationsCount || 0), 0);

  // Filtrado de movimientos en libros
  const filteredMovements = movements.filter((m) => {
    const matchesAccount =
      selectedAccountId === "all" || m.accountId === selectedAccountId;
    const matchesSearch =
      !search.trim() ||
      m.concept.toLowerCase().includes(search.toLowerCase()) ||
      (m.referenceNumber &&
        m.referenceNumber.toLowerCase().includes(search.toLowerCase()));
    const matchesReconciled =
      filterReconciled === "ALL" ||
      (filterReconciled === "RECONCILED" && m.isReconciled) ||
      (filterReconciled === "PENDING" && !m.isReconciled);

    return matchesAccount && matchesSearch && matchesReconciled;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
            <Landmark className="w-5 h-5 text-sky-600" />
            Tesorería y Disponibilidad Bancaria
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Control de cuentas corrientes, custodia en divisas, saldo real
            bancario y conciliación por sucursal
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {canReconcile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/treasury/reconcile")}
              className="flex-1 sm:flex-none rounded-lg"
            >
              <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
              Conciliación Bancaria
            </Button>
          )}
          {canCreate && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTransferForm({
                    originAccountId: accounts[0]?.id || "",
                    destinationAccountId: accounts[1]?.id || "",
                    amount: 0,
                    exchangeRate: 36.5,
                    referenceNumber: "",
                    concept: "",
                  });
                  setIsTransferModalOpen(true);
                }}
                className="flex-1 sm:flex-none rounded-lg"
              >
                <ArrowRightLeft className="w-4 h-4 mr-1 text-neutral-300" />
                Transferir
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setMovementForm({
                    accountId: accounts[0]?.id || "",
                    movementType: "DEPOSIT",
                    amount: 0,
                    referenceNumber: "",
                    concept: "",
                  });
                  setIsMovementModalOpen(true);
                }}
                className="flex-1 sm:flex-none rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
              >
                <Plus className="w-4 h-4 mr-1" />
                Movimiento
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Selector de Sucursal */}
      <div className="flex items-center justify-between gap-4 p-3 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 ">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-neutral-500" />
          <span className="text-xs font-semibold text-neutral-400">
            Filtro por Sucursal:
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-72">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">Todas las Sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards: Saldo Real y Libros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Disponible Divisas USD */}
        <Card className="p-4 border-l-4 border-l-sky-600 dark:border-l-sky-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-sky-200 dark:border-sky-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Saldo Real en Divisas (USD)
              </p>
              <p className="text-2xl font-bold text-sky-600 mt-1 font-mono">
                {formatMoneyUSD(totalUsdReal)}
              </p>
              <div className="text-[11px] text-neutral-500 mt-1 font-mono">
                <span>En Libros: {formatMoneyUSD(totalUsdBook)}</span>
              </div>
            </div>
            <div className="p-2 bg-sky-50 rounded-lg text-sky-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Disponible Bolívares VES */}
        <Card className="p-4 border-l-4 border-l-emerald-600 dark:border-l-emerald-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Saldo Real en Bolívares (VES)
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">
                {formatMoneyVES(totalVesReal)}
              </p>
              <div className="text-[11px] text-neutral-500 mt-1 font-mono">
                <span>En Libros: {formatMoneyVES(totalVesBook)}</span>
              </div>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Cuentas Operativas */}
        <Card className="p-4 border-l-4 border-l-neutral-600 dark:border-l-neutral-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Cuentas Bancarias
              </p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {accounts.length}
              </p>
              <span className="text-[11px] text-neutral-400">
                {selectedBranchId === "all"
                  ? "Todas las sucursales"
                  : "Sucursal seleccionada"}
              </span>
            </div>
            <div className="p-2 bg-neutral-100 rounded-lg text-neutral-300">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Movimientos por Conciliar */}
        <Card className="p-4 border-l-4 border-l-orange-600 dark:border-l-orange-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Partidas Flotantes
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {totalPendingRec}
              </p>
              <span className="text-[11px] text-neutral-400">
                Movimientos en tránsito
              </span>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Bank Accounts Grid */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2 dark:text-neutral-100">
            <Building2 className="w-4 h-4 text-orange-600" />
            Cuentas Bancarias y Disponibilidad Real
          </h2>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setAccountForm({
                  bankId: banks[0]?.id || "",
                  branchId: selectedBranchId !== "all" ? selectedBranchId : "",
                  accountNumber: "",
                  accountType: "CURRENT",
                  currency: "VES",
                  description: "",
                  initialBalance: 0,
                });
                setIsAccountModalOpen(true);
              }}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar Cuenta
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-40 bg-neutral-100 rounded-lg animate-pulse"
              />
            ))
          ) : accounts.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-lg text-xs">
              No hay cuentas bancarias registradas para la sucursal
              seleccionada.
            </div>
          ) : (
            accounts.map((acc) => (
              <Card
                key={acc.id}
                className="p-4 border-neutral-200 hover:border-neutral-300 transition-colors flex flex-col justify-between rounded-lg"
              >
                <div>
                  {/* Bank Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-neutral-900 block">
                        {acc.bankName}
                      </span>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {acc.accountNumber.replace(/(\d{4})/g, "$1 ").trim()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={acc.currency === "USD" ? "info" : "success"}
                      >
                        {acc.currency}
                      </Badge>
                    </div>
                  </div>

                  {/* Sucursal y Descripción */}
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <p className="text-neutral-400 font-medium truncate">
                      {acc.description}
                    </p>
                    <span className="text-[10px] bg-sky-50/60 dark:bg-sky-950/30  border border-sky-200 dark:border-sky-800  px-1.5 py-0.5 rounded font-medium">
                      {acc.branchName || "Global"}
                    </span>
                  </div>

                  {/* Saldo Real vs Libros */}
                  <div className="mt-3 p-2.5 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[11px] font-semibold text-sky-500">
                        Saldo Real Bancario:
                      </span>
                      <span className="text-base font-bold font-mono text-sky-500">
                        {formatCurrency(acc.realBalance, acc.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-xs text-neutral-500 font-mono pt-1 border-t border-neutral-200">
                      <span className="text-[10px] font-sans">
                        Saldo en Libros:
                      </span>
                      <span>
                        {formatCurrency(acc.currentBalance, acc.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Desglose de Tránsito */}
                  {(acc.unclearedDeposits > 0 ||
                    acc.unclearedWithdrawals > 0) && (
                    <div className="mt-2 text-[10px] font-mono flex justify-between text-neutral-500">
                      {acc.unclearedDeposits > 0 && (
                        <span className="text-emerald-400">
                          +{formatNumber(acc.unclearedDeposits)} cobros
                          flotantes
                        </span>
                      )}
                      {acc.unclearedWithdrawals > 0 && (
                        <span className="text-red-700">
                          -{formatNumber(acc.unclearedWithdrawals)} pagos
                          flotantes
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Acciones */}
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className="text-[10px] text-amber-600 font-medium">
                    {acc.pendingReconciliationsCount > 0
                      ? `${acc.pendingReconciliationsCount} sin conciliar`
                      : "Cuadrada"}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/treasury/reconcile?accountId=${acc.id}`)
                    }
                    className="text-xs text-sky-600 hover:text-sky-800 font-semibold inline-flex items-center gap-1"
                  >
                    Conciliar &rarr;
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Movements Table */}
      <Card className="border-neutral-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por concepto o ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="text-xs h-8 px-2.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">Todas las cuentas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} ({a.currency})
                </option>
              ))}
            </select>

            <select
              value={filterReconciled}
              onChange={(e) => setFilterReconciled(e.target.value as any)}
              className="text-xs h-8 px-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PENDING">Solo Pendientes</option>
              <option value="RECONCILED">Solo Conciliados</option>
            </select>
          </div>

          <span className="text-xs text-neutral-500 font-medium">
            {filteredMovements.length} movimientos en libro
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-400 uppercase  tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-3">Tipo Movimiento</th>
                <th className="py-2.5 px-3">Referencia</th>
                <th className="py-2.5 px-3">Concepto / Descripción</th>
                <th className="py-2.5 px-3 text-right">Monto</th>
                <th className="py-2.5 px-3 text-right">Saldo Posterior</th>
                <th className="py-2.5 px-3 text-center">Conciliación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 ">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-600 animate-pulse
                  "
                  >
                    <td colSpan={7} className="py-3 px-3">
                      <div className="h-4 bg-neutral-100 rounded" />
                    </td>
                  </tr>
                ))
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-neutral-400">
                    No se registran movimientos bancarios para el filtro
                    aplicado.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isPositive = m.amount > 0;
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-600 animate-pulse
                      "
                    >
                      <td className="py-2.5 px-3 font-mono text-neutral-300">
                        {new Date(m.movementDate).toLocaleDateString("es-VE")}{" "}
                        <span className="text-neutral-400">
                          {new Date(m.movementDate).toLocaleTimeString(
                            "es-VE",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-semibold uppercase text-neutral-500">
                          {m.movementType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-neutral-400">
                        {m.referenceNumber || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-400 truncate max-w-xs">
                        {m.concept}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-semibold ${
                          isPositive ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {formatNumber(m.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-neutral-400">
                        {formatNumber(m.balanceAfter)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleReconcile(m.id, m.isReconciled)
                          }
                          className="focus:outline-none"
                          title="Haz clic para conciliar / desconciliar"
                        >
                          <Badge
                            variant={m.isReconciled ? "success" : "warning"}
                          >
                            {m.isReconciled ? "Conciliado" : "Pendiente"}
                          </Badge>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Crear Cuenta Bancaria */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Registrar Cuenta Bancaria"
        description="Gestión de cuentas corrientes, custodia y saldos por sucursal"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsAccountModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              form="createAccountForm"
              type="submit"
              variant="primary"
            >
              Guardar Cuenta
            </Button>
          </div>
        }
      >
        <form
          id="createAccountForm"
          onSubmit={handleCreateAccount}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Institución Bancaria
            </label>
            <select
              value={accountForm.bankId}
              onChange={(e) =>
                setAccountForm({ ...accountForm, bankId: e.target.value })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              <option value="">Selecciona un banco</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} - {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Sucursal Asignada
            </label>
            <select
              value={accountForm.branchId}
              onChange={(e) =>
                setAccountForm({ ...accountForm, branchId: e.target.value })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">
                Global (Disponible en todas las sucursales)
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Número de Cuenta (20 dígitos)"
            placeholder="01340000000000000000"
            maxLength={20}
            value={accountForm.accountNumber}
            onChange={(e) =>
              setAccountForm({ ...accountForm, accountNumber: e.target.value })
            }
            className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Tipo de Cuenta
              </label>
              <select
                value={accountForm.accountType}
                onChange={(e) =>
                  setAccountForm({
                    ...accountForm,
                    accountType: e.target.value as any,
                  })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="CURRENT">Corriente</option>
                <option value="SAVINGS">Ahorros</option>
                <option value="CUSTODY_USD">Custodia Divisas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Moneda
              </label>
              <select
                value={accountForm.currency}
                onChange={(e) =>
                  setAccountForm({
                    ...accountForm,
                    currency: e.target.value as any,
                  })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="VES">Bolívares (VES)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
          </div>

          <Input
            label="Descripción o Alias"
            placeholder="Ej. Banesco Operativa Principal"
            value={accountForm.description}
            onChange={(e) =>
              setAccountForm({ ...accountForm, description: e.target.value })
            }
            className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            required
          />

          <Input
            label="Saldo Inicial en Libros"
            type="number"
            step="0.01"
            value={accountForm.initialBalance}
            onChange={(e) =>
              setAccountForm({
                ...accountForm,
                initialBalance: Number(e.target.value),
              })
            }
            className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </form>
      </Modal>

      {/* Modal: Registrar Movimiento */}
      <Modal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        title="Registrar Movimiento Bancario"
        description="Ingreso o egreso manual fuera de ventas/compras"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsMovementModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              form="registerMovementForm"
              type="submit"
              variant="primary"
            >
              Guardar Movimiento
            </Button>
          </div>
        }
      >
        <form
          id="registerMovementForm"
          onSubmit={handleRegisterMovement}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Cuenta Bancaria
            </label>
            <select
              value={movementForm.accountId}
              onChange={(e) =>
                setMovementForm({ ...movementForm, accountId: e.target.value })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} - {a.currency} (
                  {formatCurrency(a.currentBalance, a.currency)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Tipo de Operación
              </label>
              <select
                value={movementForm.movementType}
                onChange={(e) =>
                  setMovementForm({
                    ...movementForm,
                    movementType: e.target.value as any,
                  })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              >
                <option value="DEPOSIT">Depósito / Ingreso (+)</option>
                <option value="WITHDRAWAL">Retiro / Egreso (-)</option>
                <option value="FEE">Comisión Bancaria (-)</option>
                <option value="TAX_DEBIT">Débito Fiscal IGTF (-)</option>
              </select>
            </div>

            <Input
              label="Monto"
              type="number"
              placeholder="0,00"
              value={movementForm.amount === 0 ? "" : movementForm.amount}
              onChange={(e) =>
                setMovementForm({
                  ...movementForm,
                  amount: parseFormattedNumber(e.target.value),
                })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          <Input
            type="text"
            label="Referencia Bancaria"
            placeholder="Ej. REF-10928374"
            value={movementForm.referenceNumber}
            onChange={(e) =>
              setMovementForm({
                ...movementForm,
                referenceNumber: e.target.value,
              })
            }
          />

          <Input
            label="Concepto"
            placeholder="Ej. Cobro de servicios bancarios o aporte de caja"
            value={movementForm.concept}
            onChange={(e) =>
              setMovementForm({ ...movementForm, concept: e.target.value })
            }
            className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            required
          />
        </form>
      </Modal>

      {/* Modal: Transferencia entre Cuentas */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transferir entre Cuentas Propias"
        description="Traspaso de fondos interbancario o cambio de divisa"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              form="transferFormEl"
              type="submit"
              variant="primary"
            >
              Ejecutar Transferencia
            </Button>
          </div>
        }
      >
        <form
          id="transferFormEl"
          onSubmit={handleTransfer}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Cuenta de Origen (Débito)
            </label>
            <select
              value={transferForm.originAccountId}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  originAccountId: e.target.value,
                })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} ({a.currency}) - Real:{" "}
                  {formatCurrency(a.realBalance, a.currency)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Cuenta de Destino (Crédito)
            </label>
            <select
              value={transferForm.destinationAccountId}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  destinationAccountId: e.target.value,
                })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} ({a.currency})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monto a Transferir"
              type="number"
              placeholder="0,00"
              value={transferForm.amount === 0 ? "" : transferForm.amount}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  amount: parseFormattedNumber(e.target.value),
                })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
            <Input
              label="Tasa de Cambio BCV"
              type="number"
              placeholder="0,00"
              value={
                transferForm.exchangeRate === 0 ? "" : transferForm.exchangeRate
              }
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  exchangeRate: parseFormattedNumber(e.target.value),
                })
              }
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          <Input
            label="Referencia de la Operación"
            placeholder="Ej. TRF-009988"
            value={transferForm.referenceNumber}
            onChange={(e) =>
              setTransferForm({
                ...transferForm,
                referenceNumber: e.target.value,
              })
            }
          />

          <Input
            label="Concepto"
            placeholder="Ej. Venta de divisas para pago de nómina"
            value={transferForm.concept}
            onChange={(e) =>
              setTransferForm({ ...transferForm, concept: e.target.value })
            }
            required
          />
        </form>
      </Modal>
    </div>
  );
};
