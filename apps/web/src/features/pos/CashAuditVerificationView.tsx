import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { DataTable, Column } from "../../components/ui/DataTable";
import {
  ShieldCheck,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  DollarSign,
  Plus,
  Trash2,
  X,
  Printer,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Receipt,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import {
  formatMoneyUSD,
  formatMoneyVES,
  parseFormattedNumber,
} from "@ero/shared";
import { PdfViewerModal } from "../../components/ui/PdfViewerModal";

interface ShiftAuditItem {
  id: string;
  cashRegisterId: string;
  cashRegisterCode: string;
  cashRegisterName: string;
  branchId: string;
  branchName: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt: string;
  initialCashUSD: number;
  initialCashVES: number;
  finalCashUSDExpected: number;
  finalCashVESExpected: number;
  finalCashUSDCounted: number;
  finalCashVESCounted: number;
  differenceUSD: number;
  differenceVES: number;
  hasDiscrepancy: boolean;
  auditReportText?: string | null;
  verificationStatus:
    | "PENDING"
    | "VERIFIED"
    | "DEPOSITED"
    | "DISCREPANCY_REVIEW";
  verifiedByUserId?: string | null;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
  notes?: string | null;
  depositsCount: number;
  totalDepositedUSD: number;
  totalDepositedVES: number;
}

interface PaymentBreakdown {
  method: string;
  txCount: number;
  totalUSD: number;
  totalVES: number;
}

interface MovementItem {
  id: string;
  type: "INFLOW" | "OUTFLOW";
  currency: "USD" | "VES";
  amount: number;
  reason: string;
  userName: string;
  createdAt: string;
}

interface DepositRecord {
  id: string;
  bankAccountId: string;
  bankName: string;
  accountNumber: string;
  accountCurrency: "USD" | "VES";
  depositType: string;
  amount: number;
  currency: "USD" | "VES";
  depositDate: string;
  referenceNumber: string;
  notes?: string | null;
  userName: string;
  createdAt: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  discrepancyUSD: number;
  discrepancyVES: number;
  isResolved: boolean;
  cashierName: string;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

interface ShiftAuditDetails {
  shift: ShiftAuditItem & {
    summary: {
      cashSalesUSD: number;
      cashSalesVES: number;
      pagomovilVES: number;
      debitVES: number;
      creditVES: number;
      zelleUSD: number;
      otherVES: number;
      otherUSD: number;
      totalCollectedVES: number;
      totalCollectedUSD: number;
    };
  };
  paymentsBreakdown: PaymentBreakdown[];
  movements: MovementItem[];
  deposits: DepositRecord[];
  notifications: NotificationItem[];
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    totalUSD: number;
    totalVES: number;
    status: string;
    createdAt: string;
    clientName: string;
    clientTaxId: string;
  }>;
}

interface BankAccountOption {
  id: string;
  bankName: string;
  accountNumber: string;
  currency: "USD" | "VES";
  currentBalance: number;
  description?: string;
}

interface DepositDraftItem {
  id: string;
  bankAccountId: string;
  depositType:
    | "CASH_USD"
    | "CASH_VES"
    | "POS_BATCH"
    | "PAGO_MOVIL"
    | "TRANSFER"
    | "ZELLE"
    | "OTHER";
  amount: number;
  currency: "USD" | "VES";
  depositDate: string;
  referenceNumber: string;
  notes: string;
}

export const CashAuditVerificationView: React.FC = () => {
  const navigate = useNavigate();
  const { activeBranchId, token, user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shifts, setShifts] = useState<ShiftAuditItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Filtros
  const [verificationStatusFilter, setVerificationStatusFilter] =
    useState<string>("ALL");
  const [discrepancyFilter, setDiscrepancyFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modales
  const [selectedShiftForAudit, setSelectedShiftForAudit] =
    useState<ShiftAuditItem | null>(null);
  const [auditDetails, setAuditDetails] = useState<ShiftAuditDetails | null>(
    null,
  );
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form de Dictamen de Auditoría
  const [auditVerdictStatus, setAuditVerdictStatus] = useState<
    "VERIFIED" | "DISCREPANCY_REVIEW"
  >("VERIFIED");
  const [auditVerdictNotes, setAuditVerdictNotes] = useState("");
  const [auditResolveNotif, setAuditResolveNotif] = useState(true);

  // Modal de Depósitos
  const [selectedShiftForDeposits, setSelectedShiftForDeposits] =
    useState<ShiftAuditItem | null>(null);
  const [depositDrafts, setDepositDrafts] = useState<DepositDraftItem[]>([]);

  // Modal de PDF
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

  // Modal de Notificaciones Pendientes
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [resolvingNotificationId, setResolvingNotificationId] = useState<
    string | null
  >(null);
  const [notificationResolutionNotes, setNotificationResolutionNotes] =
    useState("");

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const params = new URLSearchParams();
      if (activeBranchId) params.append("branchId", activeBranchId);
      if (verificationStatusFilter !== "ALL")
        params.append("verificationStatus", verificationStatusFilter);
      if (discrepancyFilter === "CON_DISCREPANCIA")
        params.append("hasDiscrepancy", "true");
      if (discrepancyFilter === "CUADRADOS")
        params.append("hasDiscrepancy", "false");
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const [shiftsRes, accsRes, notifsRes] = await Promise.all([
        fetch(`/api/pos/shifts/audit?${params.toString()}`, { headers }),
        fetch("/api/treasury/accounts", { headers }),
        fetch("/api/pos/audit-notifications", { headers }),
      ]);

      if (shiftsRes.ok) {
        const json = await shiftsRes.json();
        if (json.success && Array.isArray(json.data)) {
          setShifts(json.data);
        }
      }

      if (accsRes.ok) {
        const json = await accsRes.json();
        if (json.success && Array.isArray(json.data)) {
          setBankAccounts(json.data);
        }
      }

      if (notifsRes.ok) {
        const json = await notifsRes.json();
        if (json.success && Array.isArray(json.data)) {
          setNotifications(json.data);
        }
      }
    } catch {
      toast.error("Error al cargar la información de auditoría de turnos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [
    activeBranchId,
    verificationStatusFilter,
    discrepancyFilter,
    startDate,
    endDate,
  ]);

  // Abrir modal de detalles y auditoría
  const handleOpenAuditModal = async (shift: ShiftAuditItem) => {
    setSelectedShiftForAudit(shift);
    setAuditVerdictStatus(
      shift.hasDiscrepancy ? "DISCREPANCY_REVIEW" : "VERIFIED",
    );
    setAuditVerdictNotes(shift.verificationNotes || "");
    setAuditResolveNotif(true);
    setLoadingDetails(true);

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/pos/shifts/${shift.id}/audit-details`, {
        headers,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.error?.message || "Error al obtener detalle del turno",
        );
      }
      setAuditDetails(json.data);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar detalles de auditoría");
      setSelectedShiftForAudit(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Guardar dictamen de verificación
  const handleSaveAuditVerdict = async () => {
    if (!selectedShiftForAudit) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/pos/shifts/${selectedShiftForAudit.id}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            shiftId: selectedShiftForAudit.id,
            status: auditVerdictStatus,
            notes: auditVerdictNotes || null,
            resolveNotification: auditResolveNotif,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.error?.message || "Error al guardar dictamen de verificación",
        );
      }

      toast.success("Dictamen de auditoría guardado exitosamente");
      setSelectedShiftForAudit(null);
      setAuditDetails(null);
      fetchAuditData();
    } catch (err: any) {
      toast.error(err.message || "Error al dictaminar verificación");
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de depósitos bancarios
  const handleOpenDepositsModal = async (shift: ShiftAuditItem) => {
    if (shift.verificationStatus === "DEPOSITED") {
      toast.info(
        "Este turno de caja ya tiene sus depósitos bancarios registrados en su totalidad.",
      );
      return;
    }
    setSelectedShiftForDeposits(shift);
    setLoadingDetails(true);

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/pos/shifts/${shift.id}/audit-details`, {
        headers,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Error al obtener detalle");
      }

      const det: ShiftAuditDetails = json.data;
      setAuditDetails(det);

      // Pre-poblar sugerencias de depósitos basados en la recaudación del turno
      const initialDrafts: DepositDraftItem[] = [];
      const todayIso = new Date().toISOString().slice(0, 10);

      // 1. Sugerencia Efectivo USD (si hay efectivo contado)
      if (shift.finalCashUSDCounted > 0) {
        const defaultUSDAcc = bankAccounts.find((a) => a.currency === "USD");
        initialDrafts.push({
          id: crypto.randomUUID(),
          bankAccountId: defaultUSDAcc?.id || "",
          depositType: "CASH_USD",
          amount: shift.finalCashUSDCounted,
          currency: "USD",
          depositDate: todayIso,
          referenceNumber: "",
          notes: `Efectivo Divisas Cierre #${shift.id.slice(0, 8)} (${shift.cashRegisterCode})`,
        });
      }

      // 2. Sugerencia Efectivo VES (si hay efectivo contado)
      if (shift.finalCashVESCounted > 0) {
        const defaultVESAcc = bankAccounts.find((a) => a.currency === "VES");
        initialDrafts.push({
          id: crypto.randomUUID(),
          bankAccountId: defaultVESAcc?.id || "",
          depositType: "CASH_VES",
          amount: shift.finalCashVESCounted,
          currency: "VES",
          depositDate: todayIso,
          referenceNumber: "",
          notes: `Efectivo Bolívares Cierre #${shift.id.slice(0, 8)} (${shift.cashRegisterCode})`,
        });
      }

      // 3. Sugerencia Lote POS (Tarjetas de Débito / Crédito)
      const debitVES =
        det.paymentsBreakdown.find((p) => p.method === "DEBIT_CARD")
          ?.totalVES || 0;
      const creditVES =
        det.paymentsBreakdown.find((p) => p.method === "CREDIT_CARD")
          ?.totalVES || 0;
      const posBatchVES = Number((debitVES + creditVES).toFixed(2));
      if (posBatchVES > 0) {
        const defaultVESAcc = bankAccounts.find((a) => a.currency === "VES");
        initialDrafts.push({
          id: crypto.randomUUID(),
          bankAccountId: defaultVESAcc?.id || "",
          depositType: "POS_BATCH",
          amount: posBatchVES,
          currency: "VES",
          depositDate: todayIso,
          referenceNumber: "",
          notes: `Liquidación Lote Puntos de Venta Turno #${shift.id.slice(0, 8)}`,
        });
      }

      // 4. Pago Móvil consolidado
      const pmVES =
        det.paymentsBreakdown.find((p) => p.method === "PAGO_MOVIL")
          ?.totalVES || 0;
      if (pmVES > 0) {
        const defaultVESAcc = bankAccounts.find((a) => a.currency === "VES");
        initialDrafts.push({
          id: crypto.randomUUID(),
          bankAccountId: defaultVESAcc?.id || "",
          depositType: "PAGO_MOVIL",
          amount: pmVES,
          currency: "VES",
          depositDate: todayIso,
          referenceNumber: "",
          notes: `Recaudación Pago Móvil Turno #${shift.id.slice(0, 8)}`,
        });
      }

      setDepositDrafts(
        initialDrafts.length > 0
          ? initialDrafts
          : [
              {
                id: crypto.randomUUID(),
                bankAccountId: "",
                depositType: "CASH_VES",
                amount: 0,
                currency: "VES",
                depositDate: todayIso,
                referenceNumber: "",
                notes: "",
              },
            ],
      );
    } catch (err: any) {
      toast.error(err.message || "Error al preparar depósito");
      setSelectedShiftForDeposits(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Agregar una línea al borrador de depósitos
  const handleAddDepositDraft = () => {
    setDepositDrafts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        bankAccountId: "",
        depositType: "CASH_VES",
        amount: 0,
        currency: "VES",
        depositDate: new Date().toISOString().slice(0, 10),
        referenceNumber: "",
        notes: "",
      },
    ]);
  };

  // Eliminar línea de depósito
  const handleRemoveDepositDraft = (id: string) => {
    setDepositDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  // Guardar depósitos bancarios
  const handleSaveDeposits = async () => {
    if (!selectedShiftForDeposits) return;
    if (depositDrafts.length === 0) {
      toast.error("Debe incluir al menos un depósito bancario");
      return;
    }

    for (const d of depositDrafts) {
      if (!d.bankAccountId) {
        toast.error(
          "Debe seleccionar la cuenta bancaria de destino para cada depósito",
        );
        return;
      }
      if (d.amount <= 0) {
        toast.error("El monto a depositar debe ser mayor a 0");
        return;
      }
      if (!d.referenceNumber.trim()) {
        toast.error("Debe indicar el número de referencia o planilla bancaria");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/pos/shifts/${selectedShiftForDeposits.id}/deposits`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            shiftId: selectedShiftForDeposits.id,
            deposits: depositDrafts.map((d) => ({
              bankAccountId: d.bankAccountId,
              depositType: d.depositType,
              amount: d.amount,
              currency: d.currency,
              depositDate: d.depositDate,
              referenceNumber: d.referenceNumber.trim(),
              notes: d.notes || null,
            })),
            markAsDeposited: true,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Error al registrar depósitos");
      }

      toast.success(
        "Depósitos bancarios registrados exitosamente. Los saldos fueron actualizados en Tesorería y listos para conciliación.",
      );
      setSelectedShiftForDeposits(null);
      setDepositDrafts([]);
      fetchAuditData();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar depósitos");
    } finally {
      setSubmitting(false);
    }
  };

  // Resolver notificación de discrepancia
  const handleResolveNotification = async (notificationId: string) => {
    if (!notificationResolutionNotes.trim()) {
      toast.error("Debe ingresar la justificación de resolución");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/pos/audit-notifications/${notificationId}/resolve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            notificationId,
            resolutionNotes: notificationResolutionNotes.trim(),
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Error al resolver alerta");
      }

      toast.success("Alerta de auditoría resuelta");
      setResolvingNotificationId(null);
      setNotificationResolutionNotes("");
      fetchAuditData();
    } catch (err: any) {
      toast.error(err.message || "Error al resolver alerta");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const totalPending = shifts.filter(
      (s) => s.verificationStatus === "PENDING",
    ).length;
    const totalDiscrepancies = shifts.filter((s) => s.hasDiscrepancy).length;
    const totalDeposited = shifts.filter(
      (s) => s.verificationStatus === "DEPOSITED",
    ).length;
    const sumUSD = shifts.reduce((acc, s) => acc + s.totalDepositedUSD, 0);
    const sumVES = shifts.reduce((acc, s) => acc + s.totalDepositedVES, 0);

    return {
      totalPending,
      totalDiscrepancies,
      totalDeposited,
      sumUSD,
      sumVES,
      totalAlerts: notifications.length,
    };
  }, [shifts, notifications]);

  // Filtrado de turnos
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      return (
        s.id.toLowerCase().includes(q) ||
        s.cashRegisterCode.toLowerCase().includes(q) ||
        s.cashRegisterName.toLowerCase().includes(q) ||
        s.cashierName.toLowerCase().includes(q) ||
        s.branchName.toLowerCase().includes(q)
      );
    });
  }, [shifts, searchTerm]);

  // Columnas de la tabla principal de turnos
  const columns: Column<ShiftAuditItem>[] = [
    {
      header: "Turno / Cierre",
      cell: (r) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-bold text-neutral-300">
            #{r.id.slice(0, 8)}
          </span>
          <span className="text-[11px] text-neutral-500">
            {r.closedAt
              ? new Date(r.closedAt).toLocaleDateString("es-VE")
              : "En curso"}
          </span>
          <span className="text-[10px] text-neutral-400">
            {r.closedAt ? new Date(r.closedAt).toLocaleTimeString("es-VE") : ""}
          </span>
        </div>
      ),
    },
    {
      header: "Caja & Cajero",
      cell: (r) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-neutral-300">
            {r.cashRegisterCode} - {r.cashRegisterName}
          </span>
          <span className="text-[11px] text-neutral-500">
            Cajero: {r.cashierName}
          </span>
          <span className="text-[10px] text-neutral-400">
            Sucursal: {r.branchName}
          </span>
        </div>
      ),
    },
    {
      header: "Arqueo Efectivo ($)",
      cell: (r) => (
        <div className="flex flex-col text-xs font-mono">
          <div className="flex justify-between gap-2 text-[11px]">
            <span className="text-neutral-400">Esp:</span>
            <span>{formatMoneyUSD(r.finalCashUSDExpected)}</span>
          </div>
          <div className="flex justify-between gap-2 font-medium">
            <span className="text-neutral-400">Cont:</span>
            <span>{formatMoneyUSD(r.finalCashUSDCounted)}</span>
          </div>
          {r.differenceUSD !== 0 ? (
            <span
              className={
                r.differenceUSD > 0
                  ? "text-sky-600 font-bold"
                  : "text-red-600 font-bold"
              }
            >
              {r.differenceUSD > 0
                ? `+${formatMoneyUSD(r.differenceUSD)}`
                : `-${formatMoneyUSD(Math.abs(r.differenceUSD))}`}
            </span>
          ) : (
            <span className="text-emerald-600 text-[10px]">Cuadrado</span>
          )}
        </div>
      ),
    },
    {
      header: "Arqueo Efectivo (Bs)",
      cell: (r) => (
        <div className="flex flex-col text-xs font-mono">
          <div className="flex justify-between gap-2 text-[11px]">
            <span className="text-neutral-400">Esp:</span>
            <span>{formatMoneyVES(r.finalCashVESExpected)}</span>
          </div>
          <div className="flex justify-between gap-2 font-medium">
            <span className="text-neutral-400">Cont:</span>
            <span>{formatMoneyVES(r.finalCashVESCounted)}</span>
          </div>
          {r.differenceVES !== 0 ? (
            <span
              className={
                r.differenceVES > 0
                  ? "text-sky-600 font-bold"
                  : "text-red-600 font-bold"
              }
            >
              {r.differenceVES > 0
                ? `+${formatMoneyVES(r.differenceVES)}`
                : `-${formatMoneyVES(Math.abs(r.differenceVES))}`}
            </span>
          ) : (
            <span className="text-emerald-600 text-[10px]">Cuadrado</span>
          )}
        </div>
      ),
    },
    {
      header: "Estado Auditoría",
      cell: (r) => {
        let variant: "neutral" | "success" | "warning" | "danger" | "info" =
          "neutral";
        let label = "Pendiente";
        if (r.verificationStatus === "VERIFIED") {
          variant = "info";
          label = "Verificado";
        } else if (r.verificationStatus === "DEPOSITED") {
          variant = "success";
          label = "Depositado";
        } else if (r.verificationStatus === "DISCREPANCY_REVIEW") {
          variant = "danger";
          label = "En Revisión";
        }

        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge variant={variant}>{label}</Badge>
            {r.hasDiscrepancy ? (
              <Badge variant="warning" className="text-[10px]">
                Con Diferencia
              </Badge>
            ) : (
              <Badge variant="success" className="text-[10px]">
                Sin Diferencias
              </Badge>
            )}
            {r.verifiedByName && (
              <span className="text-[10px] text-neutral-400">
                Por: {r.verifiedByName}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Depósitos Bancarios",
      cell: (r) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-semibold text-neutral-300">
            {r.depositsCount} depósito(s)
          </span>
          {r.totalDepositedUSD > 0 && (
            <span className="text-[11px] text-emerald-200 font-medium">
              USD {formatMoneyUSD(r.totalDepositedUSD)}
            </span>
          )}
          {r.totalDepositedVES > 0 && (
            <span className="text-[11px] text-sky-200 font-medium">
              VES {formatMoneyVES(r.totalDepositedVES)}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Acciones",
      cell: (r) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenAuditModal(r)}
            title="Auditar arqueo y dictaminar estado"
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-sky-600" />
            Auditar
          </Button>
          {r.verificationStatus === "DEPOSITED" ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
              title="Este turno ya fue depositado en su totalidad en cuentas bancarias"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Depositado
            </span>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleOpenDepositsModal(r)}
              title="Registrar depósitos en cuentas bancarias para conciliación"
            >
              <Building2 className="w-3.5 h-3.5 mr-1" />
              Depositar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setPdfModal({
                isOpen: true,
                endpoint: `/api/pos/shifts/${r.id}/pdf`,
                title: `Acta de Cierre - Turno #${r.id.slice(0, 8)}`,
                filename: `cierre_caja_${r.id}.pdf`,
              })
            }
            title="Descargar comprobante oficial"
          >
            <Printer className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Encabezado y Navegación Rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Verificación de Arqueos & Depósitos Bancarios
            </h1>
            {kpis.totalAlerts > 0 && (
              <Badge variant="danger" className="animate-pulse">
                {kpis.totalAlerts} Alerta(s) de Discrepancia
              </Badge>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Supervisión y control de cierres de caja. Verifique el arqueo
            físico, dictamine diferencias y registre los depósitos en cuentas
            bancarias para la conciliación de Tesorería.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {kpis.totalAlerts > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNotificationsModal(true)}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <AlertTriangle className="w-4 h-4 mr-1.5 text-red-600" />
              Ver Alertas ({kpis.totalAlerts})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/pos/cash-register")}
          >
            Ir a Cierre & Arqueo Cajero
          </Button>
        </div>
      </div>

      {/* Tarjetas de Métricas KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">
              Pendientes Auditoría
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 font-mono mt-1">
            {kpis.totalPending}
          </p>
          <span className="text-[11px] text-neutral-400">
            Turnos cerrados por verificar
          </span>
        </Card>

        <Card className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">
              Discrepancias / Alertas
            </span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600 font-mono mt-1">
            {kpis.totalDiscrepancies}
          </p>
          <span className="text-[11px] text-neutral-400">
            Con faltante o sobrante
          </span>
        </Card>

        <Card className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">
              Depósitos Bancarios USD
            </span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 font-mono mt-1">
            {formatMoneyUSD(kpis.sumUSD)}
          </p>
          <span className="text-[11px] text-neutral-400">
            Registrado en Tesorería
          </span>
        </Card>

        <Card className="p-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-sky-200 dark:border-sky-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">
              Depósitos Bancarios VES
            </span>
            <TrendingUp className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 font-mono mt-1">
            {formatMoneyVES(kpis.sumVES)}
          </p>
          <span className="text-[11px] text-neutral-400">
            Listo para conciliación
          </span>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="p-3.5 rounded-lg border border-neutral-200 bg-white space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-neutral-600 font-medium mb-1">
              Buscar por Turno, Caja o Cajero
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Código, caja, cajero..."
                className="w-full h-9 pl-8 pr-3 border border-neutral-300 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-600 font-medium mb-1">
              Estado de Verificación
            </label>
            <select
              value={verificationStatusFilter}
              onChange={(e) => setVerificationStatusFilter(e.target.value)}
              className="w-full appearance-none pl-9 pr-8 py-2 text-sm text-neutral-400 border border-neutral-400 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-700 cursor-pointer disabled:opacity-50"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PENDING">Pendientes de Verificación</option>
              <option value="VERIFIED">Verificados (Dictaminados)</option>
              <option value="DEPOSITED">Depositados en Banco</option>
              <option value="DISCREPANCY_REVIEW">
                En Revisión de Discrepancia
              </option>
            </select>
          </div>

          <div>
            <label className="block text-neutral-600 font-medium mb-1">
              Cuadre / Discrepancias
            </label>
            <select
              value={discrepancyFilter}
              onChange={(e) => setDiscrepancyFilter(e.target.value)}
              className="w-full appearance-none pl-9 pr-8 py-2 text-sm text-neutral-400 border border-neutral-400 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-700 cursor-pointer disabled:opacity-50"
            >
              <option value="ALL">Todos los Turnos</option>
              <option value="CON_DISCREPANCIA">
                Solo con Discrepancia (Faltante/Sobrante)
              </option>
              <option value="CUADRADOS">Solo Cuadrados (Diferencia = 0)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-neutral-600 font-medium mb-1">
                Desde
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-2 border border-neutral-400 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-neutral-600 font-medium mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-9 px-2 border border-neutral-400 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tabla de Turnos Auditables */}
      <Card className="rounded-lg border border-neutral-200 overflow-hidden bg-white">
        <DataTable
          columns={columns}
          data={filteredShifts}
          isLoading={loading}
          emptyMessage="No se encontraron turnos cerrados con los criterios de búsqueda seleccionados."
        />
      </Card>

      {/* MODAL 1: Auditoría Detallada y Dictamen */}
      {selectedShiftForAudit && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Auditoría de Turno #{selectedShiftForAudit.id.slice(0, 8)} -{" "}
                  {selectedShiftForAudit.cashRegisterCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedShiftForAudit(null);
                  setAuditDetails(null);
                }}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {loadingDetails ? (
                <div className="space-y-3 py-6">
                  <div className="h-4 bg-neutral-200 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-neutral-200 rounded animate-pulse w-1/2" />
                  <div className="h-16 bg-neutral-100 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  {/* Reporte de Auditoría Automático si hubo discrepancia */}
                  {selectedShiftForAudit.hasDiscrepancy && (
                    <div className="p-3.5 bg-red-50 rounded-lg border border-red-300 space-y-1.5">
                      <div className="flex items-center gap-2 text-red-900 font-bold">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Alerta de Discrepancia Registrada al Cierre</span>
                      </div>
                      <p className="text-[11px] text-red-800 whitespace-pre-line font-mono bg-white p-2.5 rounded border border-red-200">
                        {selectedShiftForAudit.auditReportText ||
                          "Discrepancia detectada entre efectivo esperado y contado."}
                      </p>
                    </div>
                  )}

                  {/* Resumen del Arqueo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1.5">
                      <span className="font-bold text-neutral-800 text-xs">
                        Cuadre Efectivo USD ($)
                      </span>
                      <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                        <div>
                          <span className="text-neutral-400 block text-[10px]">
                            Inicial:
                          </span>
                          <span>
                            {formatMoneyUSD(
                              selectedShiftForAudit.initialCashUSD,
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px]">
                            Esperado:
                          </span>
                          <span>
                            {formatMoneyUSD(
                              selectedShiftForAudit.finalCashUSDExpected,
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px]">
                            Contado:
                          </span>
                          <span className="font-bold">
                            {formatMoneyUSD(
                              selectedShiftForAudit.finalCashUSDCounted,
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="pt-1 flex items-center justify-between border-t border-neutral-200">
                        <span className="text-[11px] text-neutral-500">
                          Diferencia:
                        </span>
                        <Badge
                          variant={
                            selectedShiftForAudit.differenceUSD === 0
                              ? "success"
                              : "danger"
                          }
                        >
                          {selectedShiftForAudit.differenceUSD === 0
                            ? "Cuadrado"
                            : `${selectedShiftForAudit.differenceUSD > 0 ? "+" : ""}${formatMoneyUSD(selectedShiftForAudit.differenceUSD)}`}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1.5">
                      <span className="font-bold text-neutral-800 text-xs">
                        Cuadre Efectivo VES (Bs)
                      </span>
                      <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                        <div>
                          <span className="text-neutral-400 block text-[10px]">
                            Inicial:
                          </span>
                          <span>
                            {formatMoneyVES(
                              selectedShiftForAudit.initialCashVES,
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px]">
                            Esperado:
                          </span>
                          <span>
                            {formatMoneyVES(
                              selectedShiftForAudit.finalCashVESExpected,
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px]">
                            Contado:
                          </span>
                          <span className="font-bold">
                            {formatMoneyVES(
                              selectedShiftForAudit.finalCashVESCounted,
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="pt-1 flex items-center justify-between border-t border-neutral-200">
                        <span className="text-[11px] text-neutral-500">
                          Diferencia:
                        </span>
                        <Badge
                          variant={
                            selectedShiftForAudit.differenceVES === 0
                              ? "success"
                              : "danger"
                          }
                        >
                          {selectedShiftForAudit.differenceVES === 0
                            ? "Cuadrado"
                            : `${selectedShiftForAudit.differenceVES > 0 ? "+" : ""}${formatMoneyVES(selectedShiftForAudit.differenceVES)}`}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Desglose de Ventas por Método de Pago */}
                  {auditDetails &&
                    auditDetails.paymentsBreakdown.length > 0 && (
                      <div className="space-y-2">
                        <span className="font-bold text-neutral-800 text-xs">
                          Recaudación por Método de Pago (
                          {auditDetails.invoices.length} facturas)
                        </span>
                        <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                              <tr>
                                <th className="px-3 py-2">Método</th>
                                <th className="px-3 py-2 text-center">
                                  Transacciones
                                </th>
                                <th className="px-3 py-2 text-right">
                                  Monto USD
                                </th>
                                <th className="px-3 py-2 text-right">
                                  Monto VES
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 font-mono">
                              {auditDetails.paymentsBreakdown.map((p) => (
                                <tr
                                  key={p.method}
                                  className="hover:bg-neutral-50"
                                >
                                  <td className="px-3 py-1.5 font-sans font-medium text-neutral-900">
                                    {p.method}
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    {p.txCount}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-medium">
                                    {formatMoneyUSD(p.totalUSD)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-medium">
                                    {formatMoneyVES(p.totalVES)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  {/* Movimientos de Caja (Entradas y Salidas) */}
                  {auditDetails && auditDetails.movements.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-bold text-neutral-800 text-xs">
                        Movimientos Manuales Registrados
                      </span>
                      <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                            <tr>
                              <th className="px-3 py-1.5">Tipo</th>
                              <th className="px-3 py-1.5">Monto</th>
                              <th className="px-3 py-1.5">Motivo</th>
                              <th className="px-3 py-1.5">Usuario</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 font-mono">
                            {auditDetails.movements.map((m) => (
                              <tr key={m.id}>
                                <td className="px-3 py-1.5 font-sans">
                                  <Badge
                                    variant={
                                      m.type === "INFLOW" ? "success" : "danger"
                                    }
                                  >
                                    {m.type === "INFLOW" ? "Entrada" : "Salida"}
                                  </Badge>
                                </td>
                                <td className="px-3 py-1.5 font-bold">
                                  {m.currency === "USD"
                                    ? formatMoneyUSD(m.amount)
                                    : formatMoneyVES(m.amount)}
                                </td>
                                <td className="px-3 py-1.5 font-sans">
                                  {m.reason}
                                </td>
                                <td className="px-3 py-1.5 font-sans text-neutral-500">
                                  {m.userName}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Depósitos ya vinculados */}
                  {auditDetails && auditDetails.deposits.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-bold text-neutral-800 text-xs">
                        Depósitos Bancarios Registrados
                      </span>
                      <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                            <tr>
                              <th className="px-3 py-1.5">Banco / Cuenta</th>
                              <th className="px-3 py-1.5">Tipo</th>
                              <th className="px-3 py-1.5 text-right">Monto</th>
                              <th className="px-3 py-1.5">Referencia</th>
                              <th className="px-3 py-1.5">Depositante</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 font-mono">
                            {auditDetails.deposits.map((d) => (
                              <tr key={d.id}>
                                <td className="px-3 py-1.5 font-sans">
                                  {d.bankName} (...{d.accountNumber.slice(-4)})
                                </td>
                                <td className="px-3 py-1.5 font-sans text-[11px]">
                                  {d.depositType}
                                </td>
                                <td className="px-3 py-1.5 text-right font-bold text-emerald-700">
                                  {d.currency === "USD"
                                    ? formatMoneyUSD(d.amount)
                                    : formatMoneyVES(d.amount)}
                                </td>
                                <td className="px-3 py-1.5">
                                  {d.referenceNumber}
                                </td>
                                <td className="px-3 py-1.5 font-sans text-neutral-500">
                                  {d.userName}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Formulario de Dictamen del Supervisor */}
                  <div className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                    <span className="font-bold text-neutral-900 text-xs block">
                      Dictamen de Verificación y Auditoría
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-neutral-600 font-medium mb-1">
                          Estado de Auditoría
                        </label>
                        {selectedShiftForAudit.verificationStatus ===
                        "DEPOSITED" ? (
                          <div className="h-9 px-3 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              Depositado en Cuentas Bancarias (Definitivo)
                            </span>
                          </div>
                        ) : (
                          <select
                            value={auditVerdictStatus}
                            onChange={(e) =>
                              setAuditVerdictStatus(e.target.value as any)
                            }
                            className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
                          >
                            <option value="VERIFIED">
                              Verificado & Conforme
                            </option>
                            <option value="DISCREPANCY_REVIEW">
                              En Revisión de Discrepancia
                            </option>
                            <option value="PENDING">Pendiente</option>
                          </select>
                        )}
                      </div>

                      {selectedShiftForAudit.hasDiscrepancy && (
                        <div className="flex items-center gap-2 pt-6">
                          <input
                            type="checkbox"
                            id="resolveNotif"
                            checked={auditResolveNotif}
                            onChange={(e) =>
                              setAuditResolveNotif(e.target.checked)
                            }
                            className="w-4 h-4 text-sky-600 rounded border-neutral-300"
                          />
                          <label
                            htmlFor="resolveNotif"
                            className="text-neutral-700 text-xs font-medium cursor-pointer"
                          >
                            Marcar alerta de auditoría como resuelta
                          </label>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-neutral-600 font-medium mb-1">
                        Notas de Supervisión / Justificación del Dictamen
                      </label>
                      <textarea
                        rows={2}
                        value={auditVerdictNotes}
                        onChange={(e) => setAuditVerdictNotes(e.target.value)}
                        placeholder="Ej: Conteo físico verificado en bóveda; diferencia justificada por billete roto devuelto."
                        className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedShiftForAudit(null);
                  setAuditDetails(null);
                }}
              >
                Cerrar
              </Button>
              {selectedShiftForAudit.verificationStatus !== "DEPOSITED" && (
                <Button
                  size="sm"
                  disabled={submitting || loadingDetails}
                  onClick={handleSaveAuditVerdict}
                >
                  Guardar Dictamen
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Registrar Depósitos Bancarios del Turno */}
      {selectedShiftForDeposits && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Registrar Depósitos Bancarios - Turno #
                  {selectedShiftForDeposits.id.slice(0, 8)} (
                  {selectedShiftForDeposits.cashRegisterCode})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedShiftForDeposits(null);
                  setDepositDrafts([]);
                }}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-lg text-neutral-700 leading-relaxed text-[11px]">
                Asigne los fondos recaudados en este turno a las cuentas
                bancarias de la empresa. Cada depósito generará un movimiento de
                tipo <strong>DEPOSIT</strong> en Tesorería, actualizando el
                saldo bancario y dejándolo disponible para la{" "}
                <strong>conciliación bancaria</strong>.
              </div>

              {/* Botón para agregar línea */}
              <div className="flex justify-between items-center">
                <span className="font-bold text-neutral-800 text-xs">
                  Líneas de Depósito a Registrar
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddDepositDraft}
                >
                  <Plus className="w-3.5 h-3.5 mr-1 text-sky-600" />
                  Agregar Línea de Depósito
                </Button>
              </div>

              {/* Lista de Líneas de Depósito */}
              <div className="space-y-3">
                {depositDrafts.map((draft, idx) => (
                  <div
                    key={draft.id}
                    className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2.5 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-800 text-xs">
                        Depósito #{idx + 1}
                      </span>
                      {depositDrafts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDepositDraft(draft.id)}
                          className="text-neutral-400 hover:text-red-600 cursor-pointer p-1 rounded"
                          title="Eliminar esta línea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                      {/* Cuenta Bancaria */}
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1 font-medium">
                          Cuenta Bancaria Destino:
                        </label>
                        <select
                          value={draft.bankAccountId}
                          onChange={(e) => {
                            const accId = e.target.value;
                            const acc = bankAccounts.find(
                              (a) => a.id === accId,
                            );
                            setDepositDrafts((prev) =>
                              prev.map((d) =>
                                d.id === draft.id
                                  ? {
                                      ...d,
                                      bankAccountId: accId,
                                      currency: acc ? acc.currency : d.currency,
                                    }
                                  : d,
                              ),
                            );
                          }}
                          className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          <option value="">Seleccione cuenta...</option>
                          {bankAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.bankName} ({a.currency}) - ...
                              {a.accountNumber.slice(-4)} [Saldo:{" "}
                              {a.currency === "USD"
                                ? formatMoneyUSD(a.currentBalance)
                                : formatMoneyVES(a.currentBalance)}
                              ]
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Tipo de Depósito */}
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1 font-medium">
                          Tipo de Depósito:
                        </label>
                        <select
                          value={draft.depositType}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            const isUsd = val === "CASH_USD" || val === "ZELLE";
                            setDepositDrafts((prev) =>
                              prev.map((d) =>
                                d.id === draft.id
                                  ? {
                                      ...d,
                                      depositType: val,
                                      currency: isUsd ? "USD" : d.currency,
                                    }
                                  : d,
                              ),
                            );
                          }}
                          className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          <option value="CASH_USD">
                            Efectivo Divisas (USD)
                          </option>
                          <option value="CASH_VES">
                            Efectivo Bolívares (VES)
                          </option>
                          <option value="POS_BATCH">
                            Lote Punto de Venta (POS)
                          </option>
                          <option value="PAGO_MOVIL">Pago Móvil</option>
                          <option value="ZELLE">Zelle (USD)</option>
                          <option value="TRANSFER">
                            Transferencia Bancaria
                          </option>
                          <option value="OTHER">Otro Depósito</option>
                        </select>
                      </div>

                      {/* Monto y Moneda */}
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1 font-medium">
                          Monto ({draft.currency}):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={draft.amount || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setDepositDrafts((prev) =>
                              prev.map((d) =>
                                d.id === draft.id ? { ...d, amount: val } : d,
                              ),
                            );
                          }}
                          className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold focus-visible:ring-2 focus-visible:ring-sky-500"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Nro de Referencia */}
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1 font-medium">
                          Nro. de Referencia / Comprobante:
                        </label>
                        <input
                          type="text"
                          value={draft.referenceNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDepositDrafts((prev) =>
                              prev.map((d) =>
                                d.id === draft.id
                                  ? { ...d, referenceNumber: val }
                                  : d,
                              ),
                            );
                          }}
                          className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
                          placeholder="Ej: DEP-89201 o LOTE-449"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-neutral-500 mb-0.5">
                          Fecha de Depósito:
                        </label>
                        <input
                          type="date"
                          value={draft.depositDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDepositDrafts((prev) =>
                              prev.map((d) =>
                                d.id === draft.id
                                  ? { ...d, depositDate: val }
                                  : d,
                              ),
                            );
                          }}
                          className="w-full h-7 px-2 border border-neutral-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-500 mb-0.5">
                          Concepto / Notas:
                        </label>
                        <input
                          type="text"
                          value={draft.notes}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDepositDrafts((prev) =>
                              prev.map((d) =>
                                d.id === draft.id ? { ...d, notes: val } : d,
                              ),
                            );
                          }}
                          className="w-full h-7 px-2 border border-neutral-300 rounded-lg text-xs"
                          placeholder="Notas adicionales..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedShiftForDeposits(null);
                  setDepositDrafts([]);
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={submitting}
                onClick={handleSaveDeposits}
              >
                Confirmar y Registrar en Tesorería
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Lista de Alertas / Notificaciones de Auditoría */}
      {showNotificationsModal && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Alertas de Discrepancia en Arqueos ({notifications.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNotificationsModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {notifications.length === 0 ? (
                <p className="text-center text-neutral-400 py-8">
                  No hay alertas de discrepancia pendientes.
                </p>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3.5 rounded-lg border border-red-200 bg-red-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-red-950">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {new Date(notif.createdAt).toLocaleString("es-VE")}
                      </span>
                    </div>
                    <p className="text-neutral-700 leading-relaxed text-[11px]">
                      {notif.message}
                    </p>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      Cajero responsable:{" "}
                      <span className="font-sans font-semibold text-neutral-800">
                        {notif.cashierName}
                      </span>
                    </div>

                    {resolvingNotificationId === notif.id ? (
                      <div className="pt-2 space-y-2 border-t border-red-200">
                        <textarea
                          rows={2}
                          value={notificationResolutionNotes}
                          onChange={(e) =>
                            setNotificationResolutionNotes(e.target.value)
                          }
                          placeholder="Ingrese justificación de resolución (ej. verificado con supervisor)..."
                          className="w-full p-2 border border-neutral-300 rounded-lg text-xs bg-white"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setResolvingNotificationId(null);
                              setNotificationResolutionNotes("");
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            disabled={submitting}
                            onClick={() => handleResolveNotification(notif.id)}
                          >
                            Confirmar Resolución
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setResolvingNotificationId(notif.id);
                            setNotificationResolutionNotes("");
                          }}
                          className="border-neutral-300"
                        >
                          Resolver Alerta
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-50 flex justify-end shrink-0">
              <Button
                size="sm"
                onClick={() => setShowNotificationsModal(false)}
              >
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visor de PDF */}
      {pdfModal.isOpen && pdfModal.endpoint && (
        <PdfViewerModal
          isOpen={pdfModal.isOpen}
          onClose={() =>
            setPdfModal({ isOpen: false, endpoint: null, title: "" })
          }
          endpoint={pdfModal.endpoint}
          title={pdfModal.title}
          filename={pdfModal.filename}
        />
      )}
    </div>
  );
};
