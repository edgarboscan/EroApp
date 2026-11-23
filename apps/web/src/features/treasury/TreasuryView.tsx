import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { toast } from "sonner";
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
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
  FileText,
  Copy,
  Smartphone,
  Mail,
  Truck,
  Receipt,
  Clock,
} from "lucide-react";
import {
  formatNumber,
  formatCurrency,
  formatMoneyUSD,
  formatMoneyVES,
  parseFormattedNumber,
} from "@ero/shared";
import { Modal } from "../../components/ui/Modal";
import { showConfirmQuestion } from "../../lib/sweetalert";
import { PdfViewerModal } from "../../components/ui/PdfViewerModal";

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
  const liveRate = useExchangeRateStore((state) => state.rate);
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
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  // Tabs: Movimientos vs Pagos a Proveedores por Procesar
  const [treasuryTab, setTreasuryTab] = useState<"MOVEMENTS" | "PENDING_PAYMENTS">("MOVEMENTS");
  const [pendingPayables, setPendingPayables] = useState<any[]>([]);
  const [pendingPayablesLoading, setPendingPayablesLoading] = useState(false);
  const [payablesSearch, setPayablesSearch] = useState("");

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payableToPay, setPayableToPay] = useState<any | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    endpoint: string | null;
    title: string;
    filename?: string;
  }>({
    isOpen: false,
    endpoint: null,
    title: "",
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Form: Pago a Proveedor desde Tesorería
  const [payForm, setPayForm] = useState({
    bankAccountId: "",
    currency: "USD" as "USD" | "VES",
    exchangeRate: liveRate,
    amount: 0,
    paymentMethod: "TRANSFER_VES",
    referenceNumber: "",
    notes: "",
  });

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
    exchangeRate: liveRate,
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

  const fetchPendingPayables = async () => {
    setPendingPayablesLoading(true);
    try {
      const branchParam =
        selectedBranchId && selectedBranchId !== "all"
          ? `&branchId=${encodeURIComponent(selectedBranchId)}`
          : "";
      const res = await fetch(`/api/payables?isVerified=true${branchParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setPendingPayables(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setPendingPayables([]);
    } finally {
      setPendingPayablesLoading(false);
    }
  };

  useEffect(() => {
    fetchTreasuryData();
    fetchPendingPayables();
  }, [selectedBranchId, selectedAccountId]);

  const handleOpenPayModal = (p: any) => {
    setPayableToPay(p);
    const initialCurrency: "USD" | "VES" = "USD";
    const matchingAcc = accounts.find((a) => a.currency === initialCurrency) || accounts[0];
    setPayForm({
      bankAccountId: matchingAcc ? matchingAcc.id : "",
      currency: initialCurrency,
      exchangeRate: liveRate,
      amount: Number(p.amountBalance || 0),
      paymentMethod: "TRANSFER_USD",
      referenceNumber: "",
      notes: `Pago factura ${p.invoiceNumber} a ${p.supplierName}`,
    });
    setIsPayModalOpen(true);
  };

  const handleCurrencyChange = (newCurrency: "USD" | "VES") => {
    if (!payableToPay) {
      setPayForm((prev) => ({ ...prev, currency: newCurrency }));
      return;
    }
    const balanceUSD = Number(payableToPay.amountBalance || 0);
    const rate = payForm.exchangeRate > 0 ? payForm.exchangeRate : (liveRate || 1);
    const newAmount = newCurrency === "USD" ? balanceUSD : Number((balanceUSD * rate).toFixed(2));

    // Seleccionar cuenta bancaria acorde a la moneda seleccionada
    const matchingAcc = accounts.find((a) => a.currency === newCurrency) || accounts[0];

    // Adaptar método de pago acorde a la moneda
    let newMethod = payForm.paymentMethod;
    if (newCurrency === "USD" && (payForm.paymentMethod === "TRANSFER_VES" || payForm.paymentMethod === "PAGO_MOVIL")) {
      newMethod = "TRANSFER_USD";
    } else if (newCurrency === "VES" && payForm.paymentMethod === "TRANSFER_USD") {
      newMethod = "TRANSFER_VES";
    }

    setPayForm((prev) => ({
      ...prev,
      currency: newCurrency,
      amount: newAmount,
      bankAccountId: matchingAcc ? matchingAcc.id : prev.bankAccountId,
      paymentMethod: newMethod,
    }));
  };

  const handleExchangeRateChange = (newRate: number) => {
    setPayForm((prev) => {
      const updated = { ...prev, exchangeRate: newRate };
      if (prev.currency === "VES" && payableToPay) {
        const balanceUSD = Number(payableToPay.amountBalance || 0);
        updated.amount = Number((balanceUSD * (newRate > 0 ? newRate : 1)).toFixed(2));
      }
      return updated;
    });
  };

  const handleExecuteTreasuryPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payableToPay || payForm.amount <= 0) {
      toast.error("Introduzca un monto válido a pagar");
      return;
    }

    const isBankMethod = ["TRANSFER_VES", "TRANSFER_USD", "PAGO_MOVIL", "ZELLE"].includes(payForm.paymentMethod);
    if (isBankMethod && !payForm.bankAccountId) {
      toast.error("Seleccione la cuenta bancaria de la empresa para debitar el egreso");
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: "¿Ejecutar pago desde Tesorería?",
      text: `¿Confirma el débito por ${payForm.currency === 'USD' ? `$${payForm.amount.toFixed(2)}` : `Bs. ${payForm.amount.toFixed(2)}`} a favor de ${payableToPay.supplierName}?`,
      confirmButtonText: "Sí, ejecutar y asentar pago",
      cancelButtonText: "Cancelar",
      icon: "question",
    });
    if (!confirmed) return;

    setSubmittingPayment(true);
    try {
      const res = await fetch("/api/payables/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payableId: payableToPay.id,
          amount: payForm.amount,
          currency: payForm.currency,
          exchangeRate: payForm.exchangeRate,
          paymentMethod: payForm.paymentMethod,
          bankAccountId: payForm.bankAccountId || undefined,
          referenceNumber: payForm.referenceNumber || undefined,
          notes: payForm.notes || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Pago procesado exitosamente. Se debitó la cuenta bancaria y se generó el asiento en contabilidad.");
        setIsPayModalOpen(false);
        fetchTreasuryData();
        fetchPendingPayables();

        const payId = json.data?.id || json.data?.paymentId;
        if (payId) {
          setPdfModal({
            isOpen: true,
            endpoint: `/api/payables/payments/${payId}/pdf`,
            title: "Comprobante Oficial de Egreso / Pago a Proveedor",
            filename: `recibo_pago_cxp_${payId}.pdf`,
          });
        }
      } else {
        toast.error(json.error?.message || "Error al procesar el pago");
      }
    } catch {
      toast.error("Error de conexión al procesar el pago");
    } finally {
      setSubmittingPayment(false);
    }
  };

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/reports/treasury-balances")}
            className="flex-1 sm:flex-none rounded-lg border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30"
            title="Ver y exportar Reporte Oficial de Posición Bancaria y Liquidez"
          >
            <FileText className="w-4 h-4 mr-1 text-sky-600" />
            Posición Bancaria (PDF)
          </Button>
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
                    exchangeRate: liveRate,
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
                variant="outline"
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
                className="flex items-center gap-2 border-[#007BFF] dark:border-[#3D91FF] rounded-lg bg-blue-50 dark:bg-blue-600/30 hover:bg-border-blue-600 dark:hover:border-blue-500 flex-1 sm:flex-none"
                title="Nuevo Movimiento de Tesorería"
              >
                <Plus className="w-4 h-4 text-blue-600 dark:blue-500 mr-1" />
                Movimiento
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Selector de Sucursal */}
      <div className="flex items-center justify-between gap-4 p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#007BFF] dark:text-[#3D91FF]" />
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Filtro por Sucursal:
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-72">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full text-xs bg-white dark:bg-[#1E1F21] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-[#333333] dark:text-[#E0E0E0] focus:outline-none focus:ring-2 focus:ring-[#007BFF] dark:focus:ring-[#3D91FF]"
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
        <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Saldo Real en Divisas (USD)
              </p>
              <p className="text-2xl font-bold text-[#007BFF] dark:text-[#3D91FF] mt-1 font-mono">
                {formatMoneyUSD(totalUsdReal)}
              </p>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                <span>En Libros: {formatMoneyUSD(totalUsdBook)}</span>
              </div>
            </div>
            <div className="p-2 bg-[#007BFF]/10 text-[#007BFF] dark:bg-[#3D91FF]/15 dark:text-[#3D91FF] rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Disponible Bolívares VES */}
        <Card className="p-4 border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Saldo Real en Bolívares (VES)
              </p>
              <p className="text-2xl font-bold text-[#28A745] dark:text-[#4ADE80] mt-1 font-mono">
                {formatMoneyVES(totalVesReal)}
              </p>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                <span>En Libros: {formatMoneyVES(totalVesBook)}</span>
              </div>
            </div>
            <div className="p-2 bg-[#28A745]/10 text-[#28A745] dark:bg-[#4ADE80]/15 dark:text-[#4ADE80] rounded-lg">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Cuentas Operativas */}
        <Card className="p-4 border-l-4 border-l-neutral-400 dark:border-l-neutral-600 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Cuentas Bancarias
              </p>
              <p className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">
                {accounts.length}
              </p>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                {selectedBranchId === "all"
                  ? "Todas las sucursales"
                  : "Sucursal seleccionada"}
              </span>
            </div>
            <div className="p-2 bg-gray-100 dark:bg-neutral-800 rounded-lg text-neutral-500 dark:text-neutral-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Movimientos por Conciliar */}
        <Card className="p-4 border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Partidas Flotantes
              </p>
              <p className="text-2xl font-bold text-[#b28500] dark:text-[#FBBF24] mt-1">
                {totalPendingRec}
              </p>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                Movimientos en tránsito
              </span>
            </div>
            <div className="p-2 bg-[#FFC107]/15 text-[#b28500] dark:bg-[#FBBF24]/15 dark:text-[#FBBF24] rounded-lg">
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
                className="h-40 rounded-lg animate-pulse"
              />
            ))
          ) : accounts.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-neutral-400 border border-neutral-200 rounded-lg text-xs">
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
                      <span className="text-xs font-bold text-[#333333] dark:text-[#E0E0E0] block">
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
                    <p className="text-neutral-400 dark:text-neutral-500 font-medium truncate">
                      {acc.description}
                    </p>
                    <span className="text-[10px] bg-[#007BFF]/10 dark:bg-[#3D91FF]/15 border border-[#007BFF]/25 dark:border-[#3D91FF]/30 text-[#007BFF] dark:text-[#3D91FF] px-1.5 py-0.5 rounded font-medium">
                      {acc.branchName || "Global"}
                    </span>
                  </div>

                  {/* Saldo Real vs Libros */}
                  <div className="mt-3 p-2.5 bg-[#007BFF]/10 dark:bg-[#3D91FF]/15 rounded-lg border border-[#007BFF]/25 dark:border-[#3D91FF]/30 space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[11px] font-semibold text-[#007BFF] dark:text-[#3D91FF]">
                        Saldo Real Bancario:
                      </span>
                      <span className="text-base font-bold font-mono text-[#007BFF] dark:text-[#3D91FF]">
                        {formatCurrency(acc.realBalance, acc.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-xs text-neutral-500 dark:text-neutral-400 font-mono pt-1 border-t border-gray-200 dark:border-gray-800">
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
                    <div className="mt-2 text-[10px] font-mono flex justify-between text-neutral-500 dark:text-neutral-400">
                      {acc.unclearedDeposits > 0 && (
                        <span className="text-[#28A745] dark:text-[#4ADE80]">
                          +{formatNumber(acc.unclearedDeposits)} cobros
                          flotantes
                        </span>
                      )}
                      {acc.unclearedWithdrawals > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          -{formatNumber(acc.unclearedWithdrawals)} pagos
                          flotantes
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Acciones */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-[10px] text-[#b28500] dark:text-[#FBBF24] font-medium">
                    {acc.pendingReconciliationsCount > 0
                      ? `${acc.pendingReconciliationsCount} sin conciliar`
                      : "Cuadrada"}
                  </span>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/reports/bank-movements?accountId=${acc.id}`)
                      }
                      className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 font-medium inline-flex items-center gap-1 cursor-pointer"
                      title="Ver cartola y movimientos en PDF"
                    >
                      <FileText className="w-3.5 h-3.5 text-neutral-400" />
                      Cartola
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/treasury/reconcile?accountId=${acc.id}`)
                      }
                      className="text-xs text-[#007BFF] hover:text-[#0069d9] dark:text-[#3D91FF] dark:hover:text-[#297be6] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      Conciliar &rarr;
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Selector de Pestañas: Libro de Movimientos vs Pagos a Proveedores por Procesar */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <button
          type="button"
          onClick={() => setTreasuryTab("MOVEMENTS")}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            treasuryTab === "MOVEMENTS"
              ? "bg-sky-600 text-white shadow-xs"
              : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Libro de Movimientos Bancarios
        </button>
        <button
          type="button"
          onClick={() => {
            setTreasuryTab("PENDING_PAYMENTS");
            fetchPendingPayables();
          }}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            treasuryTab === "PENDING_PAYMENTS"
              ? "bg-sky-600 text-white shadow-xs"
              : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          Pagos a Proveedores por Procesar
          {pendingPayables.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-mono font-bold">
              {pendingPayables.length}
            </span>
          )}
        </button>
      </div>

      {treasuryTab === "MOVEMENTS" ? (
        /* Movements Table */
        <Card className="border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-3">
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

            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              {filteredMovements.length} movimientos en libro
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#F4F6F9] dark:bg-[#18191A] text-neutral-700 dark:text-neutral-300 uppercase font-semibold text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-10">
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
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-b border-neutral-100 dark:border-neutral-800 animate-pulse"
                    >
                      <td colSpan={7} className="py-3 px-3">
                        <div className="h-4 bg-neutral-200/80 dark:bg-neutral-800 rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-neutral-500 dark:text-neutral-400">
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
                        className="border-b border-gray-100 dark:border-gray-800/80 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-[#333333] dark:text-[#E0E0E0]">
                          {new Date(m.movementDate).toLocaleDateString("es-VE")}{" "}
                          <span className="text-neutral-500 dark:text-neutral-400">
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
                          <span className="text-[10px] font-semibold uppercase text-neutral-600 dark:text-neutral-400">
                            {m.movementType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                          {m.referenceNumber || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[#333333] dark:text-[#E0E0E0] truncate max-w-xs">
                          {m.concept}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-semibold ${
                            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {formatNumber(m.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#333333] dark:text-[#E0E0E0]">
                          {formatNumber(m.balanceAfter)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleReconcile(m.id, m.isReconciled)
                            }
                            className="focus:outline-none cursor-pointer"
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
      ) : (
        /* Pagos a Proveedores por Procesar */
        <Card className="border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden space-y-4">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar proveedor, RIF o factura..."
                  value={payablesSearch}
                  onChange={(e) => setPayablesSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchPendingPayables}
                className="h-8 text-xs shrink-0"
              >
                Actualizar
              </Button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">
                Total por Desembolsar:
              </span>
              <span className="font-mono font-bold text-red-600 dark:text-red-400 text-sm">
                {formatMoneyUSD(
                  pendingPayables.reduce((acc, p) => acc + (Number(p.amountBalance) || 0), 0)
                )}
              </span>
            </div>
          </div>

          <div className="px-4 py-2.5 bg-sky-50/70 dark:bg-sky-950/40 border-y border-sky-100 dark:border-sky-900/40 flex items-center justify-between gap-2 text-xs text-sky-800 dark:text-sky-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              Solo se muestran facturas previamente verificadas en Cuentas por Pagar (CxP) listas para ejecución de desembolso bancario.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#F4F6F9] dark:bg-[#18191A] text-neutral-700 dark:text-neutral-300 uppercase font-semibold text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">Proveedor</th>
                  <th className="py-2.5 px-3">Factura / Emisión</th>
                  <th className="py-2.5 px-3">Vencimiento</th>
                  <th className="py-2.5 px-3">Datos Bancarios del Proveedor</th>
                  <th className="py-2.5 px-3 text-right">Saldo Pendiente</th>
                  <th className="py-2.5 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {pendingPayablesLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="py-3 px-3">
                        <div className="h-4 bg-neutral-200/80 dark:bg-neutral-800 rounded" />
                      </td>
                    </tr>
                  ))
                ) : pendingPayables.filter((p) => {
                    if (!payablesSearch.trim()) return true;
                    const q = payablesSearch.toLowerCase();
                    return (
                      p.supplierName?.toLowerCase().includes(q) ||
                      p.supplierRif?.toLowerCase().includes(q) ||
                      p.invoiceNumber?.toLowerCase().includes(q)
                    );
                  }).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-neutral-500 dark:text-neutral-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      <p className="font-medium text-xs">No hay pagos a proveedores pendientes por procesar en esta sucursal.</p>
                    </td>
                  </tr>
                ) : (
                  pendingPayables
                    .filter((p) => {
                      if (!payablesSearch.trim()) return true;
                      const q = payablesSearch.toLowerCase();
                      return (
                        p.supplierName?.toLowerCase().includes(q) ||
                        p.supplierRif?.toLowerCase().includes(q) ||
                        p.invoiceNumber?.toLowerCase().includes(q)
                      );
                    })
                    .map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
                            {p.supplierName}
                          </div>
                          <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                            {p.supplierRif}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-mono font-semibold text-neutral-800 dark:text-neutral-200 text-xs">
                            {p.invoiceNumber}
                          </div>
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            {new Date(p.invoiceDate).toLocaleDateString("es-VE")}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-xs">
                          <div className="font-mono text-neutral-700 dark:text-neutral-300">
                            {p.dueDate ? new Date(p.dueDate).toLocaleDateString("es-VE") : "-"}
                          </div>
                          {p.daysOverdue > 0 && (
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400">
                              {p.daysOverdue} días vencido
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-xs">
                          {p.accountNumber ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
                                <CreditCard className="w-3 h-3 text-sky-500" />
                                <span>{p.bankName || "Banco"}</span>
                              </div>
                              <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                                <span>{p.accountNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(p.accountNumber, `table_acc_${p.id}`)}
                                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                                  title="Copiar cuenta"
                                >
                                  {copiedKey === `table_acc_${p.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : p.pagoMovilPhone ? (
                            <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                              <Smartphone className="w-3 h-3 text-emerald-500" />
                              <span>{p.pagoMovilPhone}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(p.pagoMovilPhone, `table_pm_${p.id}`)}
                                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                                title="Copiar teléfono"
                              >
                                {copiedKey === `table_pm_${p.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : p.zelleEmail ? (
                            <div className="flex items-center gap-1 text-[11px] text-neutral-700 dark:text-neutral-300">
                              <Mail className="w-3 h-3 text-purple-500" />
                              <span className="font-mono">{p.zelleEmail}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(p.zelleEmail, `table_zelle_${p.id}`)}
                                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                                title="Copiar Zelle"
                              >
                                {copiedKey === `table_zelle_${p.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-neutral-400 text-[11px] italic">Sin datos bancarios</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="font-mono font-bold text-red-600 dark:text-red-400 text-xs">
                            {formatMoneyUSD(p.amountBalance)}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                            Total: {formatMoneyUSD(p.amountTotal)}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <Button
                            size="sm"
                            onClick={() => handleOpenPayModal(p)}
                            className="h-7 text-xs shadow-xs"
                          >
                            <CreditCard className="w-3 h-3 mr-1" />
                            Pagar
                          </Button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Crear Cuenta Bancaria */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Registrar Cuenta Bancaria"
        description="Gestión de cuentas corrientes, custodia y saldos por sucursal"
        size="xl"
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
        size="xl"
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
        size="xl"
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

      {/* Modal: Ejecutar Pago a Proveedor desde Tesorería */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Ejecutar Pago a Proveedor desde Tesorería"
        description="Emisión de egreso bancario con imputación a factura de compra y asiento contable automático"
        size="3xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsPayModalOpen(false)}
              disabled={submittingPayment}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              form="form-treasury-payment"
              isLoading={submittingPayment}
              disabled={!payForm.amount || payForm.amount <= 0}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Confirmar y Ejecutar Pago
            </Button>
          </div>
        }
      >
        <form
          id="form-treasury-payment"
          onSubmit={handleExecuteTreasuryPayment}
          className="space-y-4"
        >
          {payableToPay && (
            <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block font-medium">Proveedor:</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">{payableToPay.supplierName}</span>
                <span className="font-mono text-neutral-500 block text-[11px]">{payableToPay.supplierRif}</span>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block font-medium">Factura:</span>
                <span className="font-semibold font-mono text-neutral-900 dark:text-neutral-100">{payableToPay.invoiceNumber}</span>
                <span className="text-neutral-500 block text-[11px]">Total: {formatMoneyUSD(payableToPay.amountTotal)}</span>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block font-medium">Saldo Pendiente:</span>
                <span className="font-bold font-mono text-red-600 dark:text-red-400 text-sm">
                  {formatMoneyUSD(payableToPay.amountBalance)}
                </span>
              </div>
            </div>
          )}

          {/* Coordenadas Bancarias del Proveedor */}
          {payableToPay && (payableToPay.accountNumber || payableToPay.pagoMovilPhone || payableToPay.zelleEmail) && (
            <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-xs space-y-1.5">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">
                Coordenadas de Pago del Proveedor:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {payableToPay.accountNumber && (
                  <div className="flex items-center justify-between bg-white dark:bg-neutral-800 p-2 rounded border border-neutral-200 dark:border-neutral-700">
                    <div>
                      <span className="font-medium text-neutral-700 dark:text-neutral-300 block text-[11px]">
                        {payableToPay.bankName || "Banco"}:
                      </span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                        {payableToPay.accountNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(payableToPay.accountNumber, "pay_modal_acc")}
                      className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                      title="Copiar número de cuenta"
                    >
                      {copiedKey === "pay_modal_acc" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
                {payableToPay.pagoMovilPhone && (
                  <div className="flex items-center justify-between bg-white dark:bg-neutral-800 p-2 rounded border border-neutral-200 dark:border-neutral-700">
                    <div>
                      <span className="font-medium text-neutral-700 dark:text-neutral-300 block text-[11px]">
                        Pago Móvil ({payableToPay.pagoMovilBank || "Banco"}):
                      </span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                        {payableToPay.pagoMovilPhone} (CI: {payableToPay.pagoMovilId || payableToPay.supplierRif})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(payableToPay.pagoMovilPhone, "pay_modal_pm")}
                      className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                      title="Copiar teléfono"
                    >
                      {copiedKey === "pay_modal_pm" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
                {payableToPay.zelleEmail && (
                  <div className="flex items-center justify-between bg-white dark:bg-neutral-800 p-2 rounded border border-neutral-200 dark:border-neutral-700">
                    <div>
                      <span className="font-medium text-neutral-700 dark:text-neutral-300 block text-[11px]">
                        Zelle:
                      </span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                        {payableToPay.zelleEmail}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(payableToPay.zelleEmail, "pay_modal_zelle")}
                      className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                      title="Copiar Zelle"
                    >
                      {copiedKey === "pay_modal_zelle" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Selección de Cuenta Bancaria de Origen */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Cuenta Bancaria Emisora (Empresa / Tesorería)
            </label>
            <select
              value={payForm.bankAccountId}
              onChange={(e) => setPayForm({ ...payForm, bankAccountId: e.target.value })}
              className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              required={["TRANSFER_VES", "TRANSFER_USD", "PAGO_MOVIL", "ZELLE"].includes(payForm.paymentMethod)}
            >
              <option value="">Seleccione cuenta bancaria...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bankName} - {acc.accountNumber.slice(-4)} ({acc.currency}) | Saldo: {formatCurrency(acc.currentBalance, acc.currency)}
                </option>
              ))}
            </select>
          </div>

          {/* Moneda y Tasa */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Moneda de Pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCurrencyChange("USD")}
                  className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                    payForm.currency === "USD"
                      ? "bg-sky-600 text-white border-sky-600"
                      : "text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  $ USD
                </button>
                <button
                  type="button"
                  onClick={() => handleCurrencyChange("VES")}
                  className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                    payForm.currency === "VES"
                      ? "bg-sky-600 text-white border-sky-600"
                      : "text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  Bs. VES
                </button>
              </div>
            </div>

            <Input
              label="Tasa de Cambio BCV"
              type="number"
              step="0.01"
              value={payForm.exchangeRate}
              onChange={(e) => handleExchangeRateChange(Number(e.target.value))}
              required
            />

            <Input
              label={`Monto a Pagar (${payForm.currency})`}
              type="number"
              step="0.01"
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
              required
            />
          </div>

          {/* Método y Referencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Método de Pago
              </label>
              <select
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              >
                <option value="TRANSFER_VES">Transferencia Bancaria Nacional (VES)</option>
                <option value="TRANSFER_USD">Transferencia / Cuenta Custodia (USD)</option>
                <option value="PAGO_MOVIL">Pago Móvil Interbancario (VES)</option>
                <option value="CASH_USD">Efectivo Divisas ($ USD)</option>
                <option value="CASH_VES">Efectivo Bolívares (VES)</option>
                <option value="ZELLE">Zelle / Transferencia Internacional</option>
              </select>
            </div>

            <Input
              label="Referencia de la Operación"
              placeholder="Ej. REF-98765432"
              value={payForm.referenceNumber}
              onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
              required={["TRANSFER_VES", "TRANSFER_USD", "PAGO_MOVIL", "ZELLE"].includes(payForm.paymentMethod)}
            />
          </div>

          <Input
            label="Concepto o Notas"
            placeholder="Ej. Liquidación factura de compra a proveedor"
            value={payForm.notes}
            onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
          />
        </form>
      </Modal>

      {/* Modal Visor / Descarga PDF de Recibo de Pago CxP */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        title={pdfModal.title}
        endpoint={pdfModal.endpoint}
        filename={pdfModal.filename}
      />
    </div>
  );
};
