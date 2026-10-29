import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { toast } from "sonner";
import { showConfirmQuestion } from "../../lib/sweetalert";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  Building2,
  Calendar,
  Check,
  RefreshCw,
  Search,
  Filter,
  Plus,
  History,
  FileText,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
  X,
} from "lucide-react";
import { formatNumber, formatCurrency } from "@ero/shared";

export interface BankAccount {
  id: string;
  bankId?: string;
  bankCode?: string;
  bankName: string;
  branchId?: string | null;
  branchName?: string;
  accountNumber: string;
  accountType?: string;
  currency: "USD" | "VES";
  description?: string;
  currentBalance: number;
  bookBalance: number;
  unclearedDeposits: number;
  unclearedWithdrawals: number;
  transitBalance: number;
  realBalance: number;
  clearedBalance: number;
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

export interface StatementLine {
  date: string;
  referenceNumber: string;
  description: string;
  amount: number;
  matchedMovementId?: string;
}

export interface ReconciliationHistoryRecord {
  id: string;
  accountId: string;
  userId: string;
  userName: string;
  periodStart: string;
  periodEnd: string;
  initialBookBalance: number;
  finalBookBalance: number;
  bankStatementBalance: number;
  difference: number;
  status: "RECONCILED" | "DISCREPANCY" | "IN_PROGRESS";
  notes?: string | null;
  createdAt: string;
}

export interface BranchOption {
  id: string;
  name: string;
  code?: string;
}

export const BankReconciliationView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, activeBranchId } = useAuthStore();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const defaultPeriodStart = `${currentYear}-${currentMonth}-01`;
  const defaultPeriodEnd = now.toISOString().slice(0, 10);

  // Vista activa: 'RECONCILIATION' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<"RECONCILIATION" | "HISTORY">(
    "RECONCILIATION",
  );

  // Sucursales y cuentas
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    activeBranchId || "all",
  );
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    searchParams.get("accountId") || "",
  );

  // Parámetros de conciliación
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);
  const [statementEndingBalance, setStatementEndingBalance] =
    useState<number>(0);
  const [reconciliationNotes, setReconciliationNotes] = useState("");

  // Extracto bancario
  const [csvText, setCsvText] = useState("");
  const [parsedLines, setParsedLines] = useState<StatementLine[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Movimientos en libros
  const [bookMovements, setBookMovements] = useState<any[]>([]);
  const [selectedMovementIds, setSelectedMovementIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filtros de movimientos en libros
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "PENDING" | "RECONCILED"
  >("ALL");
  const [filterType, setFilterType] = useState<"ALL" | "INFLOW" | "OUTFLOW">(
    "ALL",
  );
  const [filterMinAmount, setFilterMinAmount] = useState<string>("");
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>("");

  // Historial de conciliaciones
  const [historyRecords, setHistoryRecords] = useState<
    ReconciliationHistoryRecord[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal para registrar ajuste bancario (comisión / impuesto / nota)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    movementType: "FEE" as "FEE" | "TAX_DEBIT" | "DEPOSIT" | "WITHDRAWAL",
    amount: 0,
    referenceNumber: "",
    concept: "",
    movementDate: new Date().toISOString().slice(0, 10),
  });

  // Cargar sucursales
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

  // Cargar cuentas bancarias (filtradas por sucursal si corresponde)
  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const url =
        selectedBranchId && selectedBranchId !== "all"
          ? `/api/treasury/accounts?branchId=${encodeURIComponent(selectedBranchId)}`
          : "/api/treasury/accounts";

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        const list: BankAccount[] = json.data || [];
        setAccounts(list);
        if (list.length > 0) {
          if (
            !selectedAccountId ||
            !list.some((a) => a.id === selectedAccountId)
          ) {
            setSelectedAccountId(list[0].id);
          }
        } else {
          setSelectedAccountId("");
        }
      } else {
        setAccounts([]);
        setSelectedAccountId("");
      }
    } catch {
      setAccounts([]);
      setSelectedAccountId("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [selectedBranchId, token]);

  const activeAccount = accounts.find((a) => a.id === selectedAccountId);

  // Sincronizar saldo de extracto inicial con saldo real/libros de la cuenta seleccionada
  useEffect(() => {
    if (activeAccount) {
      setStatementEndingBalance(activeAccount.currentBalance);
    }
  }, [activeAccount?.id]);

  // Cargar movimientos en libros de la cuenta con filtros
  const fetchMovements = async () => {
    if (!selectedAccountId) {
      setBookMovements([]);
      return;
    }
    setLoadingMovements(true);
    try {
      const params = new URLSearchParams();
      if (periodStart) params.append("fromDate", periodStart);
      if (periodEnd) params.append("toDate", periodEnd);
      if (filterStatus === "PENDING") params.append("isReconciled", "false");
      if (filterStatus === "RECONCILED") params.append("isReconciled", "true");
      if (filterType === "INFLOW") params.append("direction", "INFLOW");
      if (filterType === "OUTFLOW") params.append("direction", "OUTFLOW");
      if (filterSearch.trim()) params.append("search", filterSearch.trim());
      if (filterMinAmount) params.append("minAmount", filterMinAmount);
      if (filterMaxAmount) params.append("maxAmount", filterMaxAmount);

      const res = await fetch(
        `/api/treasury/accounts/${selectedAccountId}/movements?${params.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data)
          ? json.data
          : json.data?.movements || [];
        setBookMovements(list);
      } else {
        setBookMovements([]);
      }
    } catch {
      setBookMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [
    selectedAccountId,
    periodStart,
    periodEnd,
    filterStatus,
    filterType,
    filterSearch,
    filterMinAmount,
    filterMaxAmount,
    token,
  ]);

  // Cargar historial de conciliaciones
  const fetchHistory = async () => {
    if (!selectedAccountId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/treasury/accounts/${selectedAccountId}/reconciliations`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (res.ok) {
        const json = await res.json();
        setHistoryRecords(json.data || []);
      } else {
        setHistoryRecords([]);
      }
    } catch {
      setHistoryRecords([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "HISTORY" && selectedAccountId) {
      fetchHistory();
    }
  }, [activeTab, selectedAccountId]);

  // Cálculos de saldo contable y real
  const bookBalance = activeAccount ? activeAccount.currentBalance : 0;
  const unclearedDeposits = activeAccount ? activeAccount.unclearedDeposits : 0;
  const unclearedWithdrawals = activeAccount
    ? activeAccount.unclearedWithdrawals
    : 0;
  const realBalance = activeAccount ? activeAccount.realBalance : bookBalance;

  // Diferencia de cuadre entre saldo extracto y saldo en libros
  const difference = Number((statementEndingBalance - bookBalance).toFixed(2));
  const isBalanced = Math.abs(difference) < 0.01;

  // Atajos de rango de fechas
  const setQuickDateRange = (
    type: "THIS_MONTH" | "LAST_MONTH" | "LAST_30_DAYS" | "THIS_YEAR",
  ) => {
    const d = new Date();
    if (type === "THIS_MONTH") {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      setPeriodStart(`${y}-${m}-01`);
      setPeriodEnd(d.toISOString().slice(0, 10));
    } else if (type === "LAST_MONTH") {
      const firstDayPrevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(d.getFullYear(), d.getMonth(), 0);
      setPeriodStart(firstDayPrevMonth.toISOString().slice(0, 10));
      setPeriodEnd(lastDayPrevMonth.toISOString().slice(0, 10));
    } else if (type === "LAST_30_DAYS") {
      const prev30 = new Date();
      prev30.setDate(prev30.getDate() - 30);
      setPeriodStart(prev30.toISOString().slice(0, 10));
      setPeriodEnd(d.toISOString().slice(0, 10));
    } else if (type === "THIS_YEAR") {
      setPeriodStart(`${d.getFullYear()}-01-01`);
      setPeriodEnd(d.toISOString().slice(0, 10));
    }
  };

  // Procesar archivo o texto del extracto bancario
  const parseStatementContent = (rawText: string, showNotification = true) => {
    if (!rawText.trim()) {
      setParsedLines([]);
      if (showNotification) toast.error("El contenido del extracto está vacío");
      return;
    }

    const lines = rawText.trim().split(/\r?\n/);
    const result: StatementLine[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      // Detección automática de delimitador: coma, punto y coma, o tabulador
      let parts: string[] = [];
      if (line.includes(";")) {
        parts = line.split(";");
      } else if (line.includes("\t")) {
        parts = line.split("\t");
      } else {
        parts = line.split(",");
      }

      if (parts.length >= 3) {
        const datePart = parts[0]?.trim() || "";
        const refPart = parts[1]?.trim() || "";
        const descPart =
          parts.length >= 4 ? parts[2]?.trim() || "" : "Movimiento bancario";
        const rawAmount =
          parts.length >= 4 ? parts[3]?.trim() : parts[2]?.trim();
        const amountNum =
          parseFloat(rawAmount?.replace(/\s/g, "").replace(",", ".") || "0") ||
          0;

        result.push({
          date: datePart,
          referenceNumber: refPart,
          description: descPart,
          amount: amountNum,
        });
      }
    }

    // Auto-emparejar con movimientos en libros disponibles
    const matched = result.map((line) => {
      const lineRef = line.referenceNumber.toLowerCase().trim();
      const lineRefSuffix = lineRef.length >= 4 ? lineRef.slice(-6) : lineRef;

      const found = bookMovements.find((m) => {
        const mRef = (m.referenceNumber || "").toLowerCase().trim();
        const mRefSuffix = mRef.length >= 4 ? mRef.slice(-6) : mRef;
        const refMatch =
          lineRef &&
          mRef &&
          (lineRef === mRef || (lineRefSuffix && mRef.endsWith(lineRefSuffix)));
        const amountMatch = Math.abs(Number(m.amount) - line.amount) < 0.01;
        return refMatch || amountMatch;
      });

      return {
        ...line,
        matchedMovementId: found ? found.id : undefined,
      };
    });

    setParsedLines(matched);
    if (showNotification) {
      toast.success(
        `Se importaron ${matched.length} registros del extracto bancario`,
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      setCsvText(text);
      parseStatementContent(text, true);
    };
    reader.onerror = () => toast.error("Error al leer el archivo de extracto");
    reader.readAsText(file);
  };

  // Conciliar o desconciliar movimiento individual directamente
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
        fetchMovements();
        fetchAccounts();
      } else {
        toast.error("Error al actualizar el estado de conciliación");
      }
    } catch {
      toast.error("Error de comunicación con el servidor");
    }
  };

  // Conciliar o desconciliar en lote
  const handleBulkReconcile = async (isReconciled: boolean) => {
    if (selectedMovementIds.length === 0) {
      toast.error("Selecciona al menos un movimiento para conciliar en lote");
      return;
    }

    try {
      const res = await fetch("/api/treasury/movements/bulk-reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          movementIds: selectedMovementIds,
          isReconciled,
        }),
      });

      if (res.ok) {
        toast.success(
          isReconciled
            ? `${selectedMovementIds.length} movimiento(s) conciliado(s) exitosamente`
            : `${selectedMovementIds.length} movimiento(s) marcados como pendientes`,
        );
        setSelectedMovementIds([]);
        fetchMovements();
        fetchAccounts();
      } else {
        toast.error("Error al procesar la conciliación en lote");
      }
    } catch {
      toast.error("Error de comunicación con el servidor");
    }
  };

  // Pasar movimiento en libros al extracto
  const addMovementToCsv = (m: any) => {
    const dateStr =
      (m.movementDate || "").slice(0, 10) ||
      new Date().toISOString().slice(0, 10);
    const refStr = m.referenceNumber || `REF-${m.id.slice(0, 6)}`;
    const conceptStr = (m.concept || "Movimiento").replace(/[,;]/g, " ");
    const amountStr = Number(m.amount).toFixed(2);
    const newLine = `${dateStr}, ${refStr}, ${conceptStr}, ${amountStr}`;

    setCsvText((prev) => (prev ? `${prev.trim()}\n${newLine}` : newLine));
    setParsedLines((prev) => [
      ...prev,
      {
        date: dateStr,
        referenceNumber: refStr,
        description: conceptStr,
        amount: Number(m.amount),
        matchedMovementId: m.id,
      },
    ]);
    toast.success(`Movimiento ${refStr} agregado al extracto`);
  };

  // Registrar ajuste rápido en libros desde la conciliación
  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !adjustForm.amount ||
      adjustForm.amount <= 0 ||
      !adjustForm.concept.trim()
    ) {
      toast.error("Indica un monto positivo y el concepto del ajuste");
      return;
    }

    try {
      const res = await fetch("/api/treasury/movements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          movementType: adjustForm.movementType,
          amount: adjustForm.amount,
          referenceNumber: adjustForm.referenceNumber || undefined,
          concept: adjustForm.concept.trim(),
          movementDate: adjustForm.movementDate || new Date().toISOString(),
          isReconciled: true, // Auto-conciliado porque viene del extracto
        }),
      });

      if (res.ok) {
        toast.success("Ajuste bancario registrado y conciliado en libros");
        setIsAdjustModalOpen(false);
        setAdjustForm({
          movementType: "FEE",
          amount: 0,
          referenceNumber: "",
          concept: "",
          movementDate: new Date().toISOString().slice(0, 10),
        });
        fetchMovements();
        fetchAccounts();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || "Error al registrar el movimiento");
      }
    } catch {
      toast.error("Error al comunicar con el servidor");
    }
  };

  // Abrir modal de ajuste prellenado desde línea no coincidente del extracto
  const handleOpenAdjustFromStatement = (line: StatementLine) => {
    setAdjustForm({
      movementType: line.amount < 0 ? "FEE" : "DEPOSIT",
      amount: Math.abs(line.amount),
      referenceNumber: line.referenceNumber || "",
      concept: line.description || "Cargo/Abono según extracto bancario",
      movementDate: line.date || new Date().toISOString().slice(0, 10),
    });
    setIsAdjustModalOpen(true);
  };

  // Guardar y procesar la conciliación formal
  const handleReconcile = async () => {
    if (parsedLines.length === 0) {
      toast.error(
        "Importa al menos un movimiento del extracto bancario para asentar la conciliación",
      );
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: "¿Procesar conciliación bancaria?",
      text: isBalanced
        ? "La conciliación está cuadrada con saldo cero de diferencia."
        : `Se registrará la conciliación con una diferencia de cuadre de ${activeAccount?.currency || ""} ${difference}.`,
      confirmButtonText: "Sí, procesar conciliación",
      cancelButtonText: "Cancelar",
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/treasury/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          periodStart,
          periodEnd,
          statementEndingBalance,
          statementItems: parsedLines,
          notes:
            reconciliationNotes ||
            (isBalanced
              ? "Conciliación mensual cuadrada conforme"
              : `Conciliación registrada con diferencia de ${activeAccount?.currency} ${difference}`),
        }),
      });

      if (res.ok) {
        toast.success("Conciliación bancaria asentada exitosamente");
        setParsedLines([]);
        setCsvText("");
        fetchAccounts();
        fetchMovements();
        setActiveTab("HISTORY");
      } else {
        const json = await res.json();
        toast.error(json.error?.message || "Error al ejecutar la conciliación");
      }
    } catch {
      toast.error(
        "Error de comunicación al procesar la conciliación en el servidor",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const allSelected =
    bookMovements.length > 0 &&
    selectedMovementIds.length === bookMovements.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedMovementIds([]);
    } else {
      setSelectedMovementIds(bookMovements.map((m) => m.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedMovementIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-200 pb-4">
        <div>
          <button
            type="button"
            onClick={() => navigate("/treasury")}
            className="inline-flex items-center text-xs font-medium text-neutral-500 hover:text-neutral-400 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Volver a Tesorería
          </button>
          <h1 className="text-xl font-bold text-neutral-400 dark:text-neutral-100 tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Conciliación Bancaria y Disponibilidad
          </h1>
          <p
            className="text-xs text-neutral-500 dark:text-neutral-400 mt-1
"
          >
            Cruce de movimientos contables de sucursales, partidas en tránsito y
            saldo real bancario
          </p>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-sky-50/60 dark:bg-sky-950/30 p-1 rounded-lg border border-sky-200 dark:border-sky-800 font-medium ">
            <button
              type="button"
              onClick={() => setActiveTab("RECONCILIATION")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "RECONCILIATION"
                  ? "bg-white text-sky-600 dark:bg-sky-950 dark:text-sky-300 shadow-sm font-semibold"
                  : "text-neutral-500 hover:text-neutral-400"
              }`}
            >
              Conciliación Activa
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("HISTORY")}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === "HISTORY"
                  ? "bg-white text-sky-600 dark:bg-sky-950 dark:text-sky-300 shadow-sm font-semibold"
                  : "text-neutral-500 hover:text-neutral-400"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Historial de Cierres
            </button>
          </div>

          {activeTab === "RECONCILIATION" && (
            <Button
              size="sm"
              onClick={handleReconcile}
              isLoading={submitting}
              disabled={parsedLines.length === 0}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="w-4 h-4 mr-1" />
              Asentar Conciliación
            </Button>
          )}
        </div>
      </div>

      {/* Account & Branch Filters Header */}
      <Card className="p-4 border-neutral-200 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Sucursal */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Sucursal Asignada
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
            >
              <option value="all">Todas las Sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cuenta Bancaria */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Cuenta a Conciliar
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium font-mono"
            >
              {accounts.length === 0 && (
                <option value="">Sin cuentas en esta sucursal</option>
              )}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} - {a.currency} ({a.accountNumber.slice(-4)}) •{" "}
                  {a.branchName}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha Inicio */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Período Desde
            </label>
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Fecha Fin */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Período Hasta
            </label>
            <Input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100 flex-wrap">
          <span className="text-[11px] text-neutral-400 font-medium">
            Atajos de Período:
          </span>
          <button
            type="button"
            onClick={() => setQuickDateRange("THIS_MONTH")}
            className="text-[11px] px-2 py-0.5 rounded bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-950 transition-colors"
          >
            Este Mes
          </button>
          <button
            type="button"
            onClick={() => setQuickDateRange("LAST_MONTH")}
            className="text-[11px] px-2 py-0.5 rounded bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-950 transition-colors"
          >
            Mes Anterior
          </button>
          <button
            type="button"
            onClick={() => setQuickDateRange("LAST_30_DAYS")}
            className="text-[11px] px-2 py-0.5 rounded bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-950 transition-colors"
          >
            Últimos 30 días
          </button>
          <button
            type="button"
            onClick={() => setQuickDateRange("THIS_YEAR")}
            className="text-[11px] px-2 py-0.5 rounded bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-950 transition-colors"
          >
            Año Actual
          </button>
        </div>
      </Card>

      {/* Financial Health & Real Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo en Libros */}
        <Card className="p-4 p-3 border-l-4 border-l-netural-600 dark:border-l-netural-400  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-netural-200 dark:border-neutral-800">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
            Saldo en Libros ERP
          </span>
          <p className="text-2xl font-bold font-mono text-neutral-400 mt-1">
            {formatCurrency(bookBalance, activeAccount?.currency || "VES")}
          </p>
          <span className="text-[11px] text-neutral-400">
            Contabilidad registrada
          </span>
        </Card>

        {/* Partidas en Tránsito */}
        <Card className="p-4 p-3 border-l-4 border-l-amber-600 dark:border-l-amber-600  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-amber-200 dark:border-amber-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-500 uppercase tracking-wider block">
              En Tránsito (Flotante)
            </span>
            <Badge variant="neutral" className="text-[10px]">
              {activeAccount?.pendingReconciliationsCount || 0} pendientes
            </Badge>
          </div>
          <div className="mt-2 space-y-1 text-xs font-mono">
            <div className="flex justify-between text-emerald-700">
              <span className="text-[11px] font-sans text-neutral-500">
                (+) Depósitos flotantes:
              </span>
              <span>+{formatNumber(unclearedDeposits)}</span>
            </div>
            <div className="flex justify-between text-red-700">
              <span className="text-[11px] font-sans text-neutral-500">
                (-) Egresos no cobrados:
              </span>
              <span>-{formatNumber(unclearedWithdrawals)}</span>
            </div>
          </div>
        </Card>

        {/* Saldo Real Bancario */}
        <Card className="p-4 p-3 border-l-4 border-l-sky-600 dark:border-l-sky-600  bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-sky-200 dark:border-sky-800">
          <span className="text-xs font-semibold text-sky-600 uppercase tracking-wider block">
            Saldo Real Bancario (Disponible)
          </span>
          <p className="text-2xl font-bold font-mono text-sky-700 mt-1">
            {formatCurrency(realBalance, activeAccount?.currency || "VES")}
          </p>
          <span className="text-[11px] text-sky-600">
            Disponibilidad compensada estimada
          </span>
        </Card>

        {/* Saldo según Extracto y Diferencia */}
        <Card
          className={`p-4 border rounded-lg ${
            isBalanced
              ? "border-l-4 border-l-emerald-600 dark:border-l-emerald-600  bg-neutral-50 border-emerald-200 bg-emerald-50/20"
              : "border-l-4 border-l-red-600 dark:border-l-red-600 bg-neutral-50 border-red-200 bg-red-50/20 "
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500 block">
                Diferencia de Cuadre
              </span>
              <p
                className={`text-2xl font-bold font-mono mt-1 ${
                  isBalanced ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatCurrency(difference, activeAccount?.currency || "VES")}
              </p>
              <span className="text-[11px] text-neutral-500">
                {isBalanced
                  ? "Conciliación exacta"
                  : "Partidas pendientes o discrepancia"}
              </span>
            </div>
            <div
              className={`p-2 rounded-lg ${
                isBalanced
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {isBalanced ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
          </div>
        </Card>
      </div>

      {activeTab === "HISTORY" ? (
        /* VISTA: HISTORIAL DE CONCILIACIONES */
        <Card className="border-neutral-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-neutral-200 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-neutral-400 flex items-center gap-2">
                <History className="w-4 h-4 text-neutral-600" />
                Historial de Cierres de Conciliación Bancaria
              </h2>
              <p className="text-[11px] text-neutral-500">
                Auditoría histórica de cierres periódicos para{" "}
                {activeAccount?.bankName} ({activeAccount?.accountNumber})
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="text-xs rounded-lg"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1 ${loadingHistory ? "animate-spin" : ""}`}
              />
              Refrescar
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">Fecha de Cierre</th>
                  <th className="py-2.5 px-3">Período Conciliado</th>
                  <th className="py-2.5 px-3">Usuario Auditor</th>
                  <th className="py-2.5 px-3 text-right">Saldo Libros</th>
                  <th className="py-2.5 px-3 text-right">Saldo Extracto</th>
                  <th className="py-2.5 px-3 text-right">Diferencia</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 ">
                {historyRecords.length === 0 ? (
                  <tr className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/60 animate-pulse text-neutral-700 dark:text-neutral-300">
                    <td
                      colSpan={8}
                      className="text-center py-8 text-neutral-400"
                    >
                      No se han registrado conciliaciones históricas para esta
                      cuenta bancaria.
                    </td>
                  </tr>
                ) : (
                  historyRecords.map((h) => (
                    <tr
                      key={h.id}
                      className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300"
                    >
                      <td className="py-2.5 px-3 font-semibold uppercase text-neutral-600 dark:text-neutral-400 font-mono">
                        {h.createdAt ? h.createdAt.slice(0, 10) : "—"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold uppercase text-neutral-600 dark:text-neutral-400 font-mono">
                        {h.periodStart} al {h.periodEnd}
                      </td>
                      <td className="py-2.5 px-3 font-semibold uppercase text-neutral-600 dark:text-neutral-400 text-neutral-400 font-medium">
                        {h.userName}
                      </td>
                      <td className="py-2.5 px-3 text-right  font-semibold uppercase text-neutral-600 dark:text-neutral-400 font-mono">
                        {formatNumber(h.finalBookBalance)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold uppercase text-neutral-600 dark:text-neutral-400 font-mono">
                        {formatNumber(h.bankStatementBalance)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-semibold ${
                          h.difference === 0
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        {formatNumber(h.difference)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant={
                            h.status === "RECONCILED" ? "success" : "danger"
                          }
                        >
                          {h.status === "RECONCILED"
                            ? "Cuadrada"
                            : "Discrepancia"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-semibold uppercase text-neutral-600 break-words bdark:text-neutral-400 max-w-xs">
                        {h.notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* VISTA: CONCILIACIÓN ACTIVA (MOVIMIENTOS EN LIBROS + EXTRACTO) */
        <div className="space-y-6">
          {/* MOVIMIENTOS EN LIBROS ERP */}
          <Card className="border-neutral-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-neutral-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  Movimientos en Libros del ERP (Cierres POS, Cobros, Pagos y
                  Depósitos)
                </h2>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Partidas registradas en el sistema para conciliar contra el
                  extracto bancario
                </p>
              </div>

              {/* Acciones en Lote & Ajuste Rápido */}
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                {selectedMovementIds.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg">
                    <span className="text-[11px] text-neutral-600 px-1 font-semibold">
                      {selectedMovementIds.length} selec.
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleBulkReconcile(true)}
                      className="text-xs py-1 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Conciliar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkReconcile(false)}
                      className="text-xs py-1 px-2.5 rounded-md"
                    >
                      Desconciliar
                    </Button>
                  </div>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAdjustModalOpen(true)}
                  className="rounded-lg text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Registrar Ajuste en Libros
                </Button>
              </div>
            </div>

            {/* Barra de Filtros de Movimientos en Libros */}
            <div className="p-2 my-2 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg   grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {/* Buscador */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <Input
                  type="text"
                  placeholder="Buscar ref o concepto..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Filtro de Estado */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full py-1.5 px-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-sky-500"
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="PENDING">Solo Pendientes</option>
                  <option value="RECONCILED">Solo Conciliados</option>
                </select>
              </div>

              {/* Filtro de Tipo */}
              <div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full py-1.5 px-2  text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-sky-500"
                >
                  <option value="ALL">Ingresos y Egresos</option>
                  <option value="INFLOW">Solo Ingresos (+)</option>
                  <option value="OUTFLOW">Solo Egresos (-)</option>
                </select>
              </div>

              {/* Filtro de Monto */}
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filterMinAmount}
                  onChange={(e) => setFilterMinAmount(e.target.value)}
                  className="w-1/2 py-1.5 px-2 w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-sky-500 font-mono"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filterMaxAmount}
                  onChange={(e) => setFilterMaxAmount(e.target.value)}
                  className="w-1/2 py-1.5 px-2 w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-sky-500 font-mono"
                />
              </div>
            </div>

            {/* Tabla de Movimientos en Libros */}
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <Input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-neutral-300 text-neutral-400 focus:ring-0"
                      />
                    </th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Referencia</th>
                    <th className="py-2.5 px-3">Concepto ERP</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {loadingMovements ? (
                    <tr className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/60 animate-pulse text-neutral-700 dark:text-neutral-300">
                      <td
                        colSpan={8}
                        className="text-center py-6 text-neutral-400"
                      >
                        Cargando movimientos...
                      </td>
                    </tr>
                  ) : bookMovements.length === 0 ? (
                    <tr className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/60 animate-pulse text-neutral-700 dark:text-neutral-300">
                      <td
                        colSpan={8}
                        className="text-center py-6 text-neutral-400"
                      >
                        No hay movimientos en libros registrados con los filtros
                        seleccionados.
                      </td>
                    </tr>
                  ) : (
                    bookMovements.map((m) => {
                      const isSelected = selectedMovementIds.includes(m.id);
                      return (
                        <tr
                          key={m.id}
                          className={`transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/60 ${
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-medium"
                              : "text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          <td className="py-2 px-3">
                            <Input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(m.id)}
                              className="rounded border-neutral-300 text-neutral-400 focus:ring-0"
                            />
                          </td>
                          <td className="py-2 px-3 text-[12px] font-semibold uppercase text-neutral-600 dark:text-neutral-400 font-mono">
                            {(m.movementDate || "").slice(0, 10)}
                          </td>
                          <td className="py-2 px-3 text-[12px] font-semibold uppercase text-neutral-600 dark:text-neutral-400 font-mono">
                            {m.movementType}
                          </td>
                          <td className="py-2 px-3 text-[12px] font-semibold uppercase text-neutral-600 dark:text-neutral-400 font-mono">
                            {m.referenceNumber || "—"}
                          </td>
                          <td className="py-2 px-3 text-[12px] font-semibold uppercase text-neutral-600 dark:text-neutral-400  break-word">
                            {m.concept}
                          </td>
                          <td
                            className={`py-2 px-3 text-[12px] font-semibold uppercase font-mono  font-semibold ${
                              m.amount > 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {m.amount > 0 ? "+" : ""}
                            {formatNumber(m.amount)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleReconcile(m.id, m.isReconciled)
                              }
                              className="focus:outline-none"
                              title="Haz clic para alternar conciliación"
                            >
                              <Badge
                                className="hover:bg-sky-400 hover:dark:bg-sky-800 text-neutral-600 dark:text-neutral-400"
                                variant={m.isReconciled ? "success" : "neutral"}
                              >
                                {m.isReconciled ? "Conciliado" : "Pendiente"}
                              </Badge>
                            </button>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => addMovementToCsv(m)}
                              className="text-[11px] text-neutral-600 dark:text-neutral-400 hover:text-sky-400 font-medium underline"
                              title="Pasar esta partida al extracto de prueba"
                            >
                              Pasar a Extracto
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

          {/* IMPORTACIÓN Y EXTRACTO BANCARIO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel de Importación (1 Columna) */}
            <Card className="p-4 border-neutral-200 rounded-lg space-y-4">
              <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
                <h2 className="text-sm font-semibold text-neutral-400 flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-sky-600" />
                  Cargar Extracto Bancario
                </h2>
                <button
                  type="button"
                  onClick={() => parseStatementContent(csvText, true)}
                  className="text-xs text-sky-600 font-semibold hover:text-sky-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-procesar
                </button>
              </div>

              {/* Botón para Subir Archivo Real */}
              <div>
                <Input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-lg text-xs flex items-center justify-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4 text-neutral-600" />
                  Examinar Archivo (.csv / .txt)
                </Button>
              </div>

              {/* Pegar Texto */}
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                  O pegar texto del extracto (separado por coma, punto y coma o
                  tab):
                </label>
                <textarea
                  rows={4}
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    parseStatementContent(e.target.value, false);
                  }}
                  className="w-full p-2.5 text-xs font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  placeholder="2026-10-25, 0001234, Depósito cliente, 50000.00&#10;2026-10-26, COM-099, Comisión bancaria, -15.50"
                />
                <span className="text-[10px] text-neutral-400 block mt-1">
                  Formato: Fecha, Referencia, Descripción, Monto
                </span>
              </div>

              {/* Saldo Final y Notas */}
              <div className="space-y-3 pt-2 border-t border-neutral-100">
                <Input
                  label={`Saldo Final Declarado en Extracto (${activeAccount?.currency || "VES"})`}
                  className="w-full text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                  type="number"
                  step="0.01"
                  value={statementEndingBalance}
                  onChange={(e) =>
                    setStatementEndingBalance(Number(e.target.value))
                  }
                />

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">
                    Observaciones del Cierre
                  </label>
                  <textarea
                    rows={2}
                    value={reconciliationNotes}
                    onChange={(e) => setReconciliationNotes(e.target.value)}
                    placeholder="Notas o justificación de diferencias..."
                    className="w-full p-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
              </div>
            </Card>

            {/* Cruce Extracto vs Libros (2 Columnas) */}
            <Card className="lg:col-span-2 border-neutral-200 rounded-lg overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-neutral-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-400 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Líneas del Extracto & Cruce Automático
                    </h2>
                    <p className="text-[11px] text-neutral-500">
                      Comparación automática entre partidas bancarias y
                      movimientos del ERP
                    </p>
                  </div>
                  <Badge variant={parsedLines.length > 0 ? "info" : "neutral"}>
                    {parsedLines.length} registros
                  </Badge>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs text-neutral-600">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-[10px] uppercase font-semibold text-neutral-500 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Referencia</th>
                        <th className="py-2.5 px-3">Concepto Bancario</th>
                        <th className="py-2.5 px-3 text-right">
                          Monto Extracto
                        </th>
                        <th className="py-2.5 px-3 text-center">
                          Coincidencia en Libros
                        </th>
                        <th className="py-2.5 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {parsedLines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center py-10 text-neutral-400"
                          >
                            No se han cargado movimientos desde el extracto
                            bancario.
                          </td>
                        </tr>
                      ) : (
                        parsedLines.map((line, idx) => {
                          const hasMatch = Boolean(line.matchedMovementId);
                          const matchedMovement = hasMatch
                            ? bookMovements.find(
                                (m) => m.id === line.matchedMovementId,
                              )
                            : null;

                          return (
                            <tr key={idx} className="hover:bg-neutral-50">
                              <td className="py-2.5 px-3 font-mono">
                                {line.date}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-neutral-400">
                                {line.referenceNumber}
                              </td>
                              <td className="py-2.5 px-3 text-neutral-400">
                                {line.description}
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-mono font-semibold ${
                                  line.amount > 0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }`}
                              >
                                {line.amount > 0 ? "+" : ""}
                                {formatNumber(line.amount)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {hasMatch ? (
                                  <Badge variant="success">
                                    Coincide:{" "}
                                    {matchedMovement?.referenceNumber ||
                                      "Movimiento"}
                                  </Badge>
                                ) : (
                                  <Badge variant="warning">
                                    Sin registrar en ERP
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {!hasMatch && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenAdjustFromStatement(line)
                                    }
                                    className="text-[11px] text-sky-600 hover:text-sky-800 font-medium underline"
                                    title="Registrar esta partida directamente en libros"
                                  >
                                    Crear en ERP
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumen al pie del cruce */}
              <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex justify-between items-center text-xs text-neutral-600">
                <span>
                  Coincidentes:{" "}
                  <strong className="text-emerald-700">
                    {parsedLines.filter((l) => l.matchedMovementId).length}
                  </strong>{" "}
                  • Sin registrar:{" "}
                  <strong className="text-amber-700">
                    {parsedLines.filter((l) => !l.matchedMovementId).length}
                  </strong>
                </span>
                <span className="font-mono font-semibold">
                  Total Extracto:{" "}
                  {formatCurrency(
                    parsedLines.reduce((sum, l) => sum + l.amount, 0),
                    activeAccount?.currency || "VES",
                  )}
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Modal: Registrar Ajuste Rápido en Libros */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Registrar Ajuste en Libros (Comisión, Impuesto o Abono)"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveAdjust} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Tipo de Movimiento
            </label>
            <select
              value={adjustForm.movementType}
              onChange={(e) =>
                setAdjustForm({
                  ...adjustForm,
                  movementType: e.target.value as any,
                })
              }
              className="w-full h-9 px-3 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none"
            >
              <option value="FEE">Comisión Bancaria (-)</option>
              <option value="TAX_DEBIT">Débito Tributario / IGTF (-)</option>
              <option value="WITHDRAWAL">Retiro / Nota de Débito (-)</option>
              <option value="DEPOSIT">
                Depósito / Nota de Crédito / Interés (+)
              </option>
            </select>
          </div>

          <Input
            label="Fecha del Movimiento"
            type="date"
            value={adjustForm.movementDate}
            onChange={(e) =>
              setAdjustForm({ ...adjustForm, movementDate: e.target.value })
            }
            required
          />

          <Input
            label="Referencia Bancaria"
            type="text"
            value={adjustForm.referenceNumber}
            onChange={(e) =>
              setAdjustForm({ ...adjustForm, referenceNumber: e.target.value })
            }
            placeholder="Ej: COM-884920"
          />

          <Input
            label="Concepto / Justificación"
            type="text"
            value={adjustForm.concept}
            onChange={(e) =>
              setAdjustForm({ ...adjustForm, concept: e.target.value })
            }
            placeholder="Ej: Comisión mensual por mantenimiento de cuenta"
            required
          />

          <Input
            label={`Monto (${activeAccount?.currency || "VES"})`}
            type="number"
            step="0.01"
            min="0.01"
            value={adjustForm.amount || ""}
            onChange={(e) =>
              setAdjustForm({
                ...adjustForm,
                amount: parseFloat(e.target.value) || 0,
              })
            }
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAdjustModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" variant="primary">
              Guardar y Conciliar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
