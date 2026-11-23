import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore, isSuperAdminRole } from "../../stores/authStore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { toast } from "sonner";
import { formatMoneyUSD, formatMoneyVES } from "../../utils/formatters";
import { showConfirmQuestion } from "../../lib/sweetalert";
import {
  ArrowLeft,
  DollarSign,
  AlertCircle,
  Receipt,
  Truck,
  CheckCircle2,
  Search,
  Landmark,
  CreditCard,
  Smartphone,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import { InvoiceSearchModal } from "../../components/search";
import { useEscapeKey } from "../../components/ui/Modal";
import { PdfViewerModal } from "../../components/ui/PdfViewerModal";
import { useExchangeRateStore } from "../../stores/exchangeRateStore";

interface PayableOption {
  id: string;
  supplierName: string;
  supplierRif: string;
  bankName?: string;
  accountNumber?: string;
  accountType?: string;
  accountHolderName?: string;
  accountHolderId?: string;
  pagoMovilBank?: string;
  pagoMovilPhone?: string;
  pagoMovilId?: string;
  zelleEmail?: string;
  zelleHolderName?: string;
  bankNotes?: string;
  invoiceNumber: string;
  amountTotal: number;
  amountPaid: number;
  amountBalance: number;
  dueDate: string;
}

interface CompanyBankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  currency: 'USD' | 'VES';
  currentBalance: number;
  description?: string;
}

export const PayablePaymentView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, activeBranchId, hasPermission, user } = useAuthStore();
  const canPay = hasPermission('payables', 'create') || hasPermission('treasury', 'create') || isSuperAdminRole(user?.role);
  const currentBcvRate = useExchangeRateStore((s) => s.rate);

  const [payables, setPayables] = useState<PayableOption[]>([]);
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [selectedPayableId, setSelectedPayableId] = useState("");
  const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(
      currentBcvRate || 75.5,
    );
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("TRANSFER_VES");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopiedKey(null), 2000);
  };
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

  useEscapeKey(() => setShowInvoiceSearch(false), showInvoiceSearch);

  // Check URL query param ?payableId=xxx
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qPayableId = params.get("payableId");
    if (qPayableId) {
      setSelectedPayableId(qPayableId);
    }
  }, [location.search]);

  // Load pending payables
  useEffect(() => {
    const fetchPendingPayables = async () => {
      setLoading(true);
      try {
        const branchParam = activeBranchId ? `?branchId=${activeBranchId}` : "";
        const res = await fetch(`/api/payables${branchParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const data = Array.isArray(json.data) ? json.data : [];
          setPayables(data);
          if (!selectedPayableId && data.length > 0) {
            setSelectedPayableId(data[0].id);
          }
        } else {
          setPayables([]);
        }
      } catch {
        setPayables([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingPayables();
  }, [activeBranchId]);

  // Load company bank accounts for treasury payment deduction
  useEffect(() => {
    const fetchCompanyBankAccounts = async () => {
      try {
        const res = await fetch('/api/treasury/accounts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const accs = Array.isArray(json.data) ? json.data : [];
          setCompanyBankAccounts(accs);
          // Auto-select first matching currency account
          const match = accs.find((a: CompanyBankAccount) => a.currency === currency);
          if (match) {
            setSelectedBankAccountId(match.id);
          } else if (accs.length > 0) {
            setSelectedBankAccountId(accs[0].id);
          }
        }
      } catch {
        setCompanyBankAccounts([]);
      }
    };

    fetchCompanyBankAccounts();
  }, [token, currency]);

  const activePayable = payables.find((p) => p.id === selectedPayableId);

  // Auto-fill amount when payable changes
  useEffect(() => {
    if (activePayable) {
      if (currency === "USD") {
        setAmount(activePayable.amountBalance);
      } else {
        setAmount(
          Number((activePayable.amountBalance * exchangeRate).toFixed(2)),
        );
      }
    }
  }, [selectedPayableId, currency, exchangeRate]);

  const equivalentUSD = currency === "USD" ? amount : amount / exchangeRate;
  const equivalentVES = currency === "VES" ? amount : amount * exchangeRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPay) {
      toast.error("No cuentas con autorización para realizar pagos directos a proveedores. Debes verificar la factura para que Tesorería la procese.");
      return;
    }
    if (!selectedPayableId || amount <= 0) {
      toast.error(
        "Selecciona una cuenta por pagar e introduce un monto válido",
      );
      return;
    }

    if (activePayable && equivalentUSD > activePayable.amountBalance + 0.01) {
      toast.error(
        `El monto ($${equivalentUSD.toFixed(2)}) supera el saldo deudor pendiente ($${activePayable.amountBalance.toFixed(2)})`,
      );
      return;
    }

    const isBankMethod = ["TRANSFER_VES", "TRANSFER_USD", "PAGO_MOVIL", "ZELLE"].includes(paymentMethod);
    if (isBankMethod && !selectedBankAccountId && companyBankAccounts.length > 0) {
      toast.error("Por favor selecciona la cuenta bancaria de la empresa para realizar el egreso");
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: "¿Confirmar pago a proveedor?",
      text: `¿Confirma el pago por ${currency === "USD" ? `$${amount.toFixed(2)}` : `Bs. ${amount.toFixed(2)}`} a favor de ${activePayable?.supplierName || "proveedor seleccionado"}?`,
      confirmButtonText: "Sí, registrar pago",
      cancelButtonText: "Cancelar",
      icon: "question",
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/payables/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payableId: selectedPayableId,
          amount,
          currency,
          exchangeRate,
          paymentMethod,
          bankAccountId: selectedBankAccountId || undefined,
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          "Pago al proveedor registrado y comprobante emitido exitosamente",
        );
        const payId = json.data?.id || json.data?.paymentId;
        if (payId) {
          setPdfModal({
            isOpen: true,
            endpoint: `/api/payables/payments/${payId}/pdf`,
            title: "Recibo Oficial de Pago a Proveedor (CxP)",
            filename: `recibo_pago_cxp_${payId}.pdf`,
          });
        } else {
          navigate("/payables");
        }
      } else {
        toast.error(json.error?.message || "Error al procesar el pago");
      }
    } catch {
      toast.error("Error de red al procesar el pago al proveedor");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/payables")}
          className="p-2 text-neutral-500 hover:text-neutral-400 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-3 pb-4 border-b border-neutral-200/80 dark:border-neutral-800/80">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200/60 dark:border-sky-800/60 text-sky-600 dark:text-sky-400 shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
                Registrar Pago a Proveedor
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Control de Cuentas por Pagar (CxP) y egresos
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Emisión de egreso bancario o en caja con imputación a factura de
            compra
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {!canPay && (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold">Sin autorización para desembolsos de pago directos</p>
              <p className="mt-0.5">
                Su usuario no cuenta con permisos para emitir pagos directos a proveedores. Puede verificar o procesar las facturas desde el módulo de Cuentas por Pagar (CxP) para que sean enviadas a la bandeja de Pagos a Proveedores por Procesar en Tesorería.
              </p>
            </div>
          </div>
        )}

        {/* Payable Selection */}
        <Card className="p-5 border-neutral-200 dark:border-neutral-800 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
            <Truck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            1. Selección de Cuenta por Pagar
          </h2>

          {loading ? (
            <div className="h-10 bg-neutral-200/80 dark:bg-neutral-800/80 rounded-lg animate-pulse" />
          ) : payables.length === 0 ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 rounded-lg text-xs flex items-center gap-2 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              No existen facturas por pagar pendientes en la sucursal activa.
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Factura / Proveedor Pendiente
                </label>
                <button
                  type="button"
                  onClick={() => setShowInvoiceSearch(true)}
                  className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Buscar</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPayableId}
                  onChange={(e) => setSelectedPayableId(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {payables.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.supplierName} ({p.supplierRif}) - Factura{" "}
                      {p.invoiceNumber} | Saldo: ${p.amountBalance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activePayable && (
            <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block font-medium">
                  Proveedor:
                </span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {activePayable.supplierName}
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 font-mono block text-[11px]">
                  {activePayable.supplierRif}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block font-medium">
                  Factura:
                </span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
                  {activePayable.invoiceNumber}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block font-medium">
                  Total Factura:
                </span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
                  {formatMoneyUSD(activePayable.amountTotal)}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block font-medium">
                  Saldo Pendiente:
                </span>
                <span className="font-bold text-red-600 dark:text-red-400 font-mono text-sm">
                  {formatMoneyUSD(activePayable.amountBalance)}
                </span>
              </div>
            </div>
          )}

          {activePayable && (activePayable.bankName || activePayable.accountNumber || activePayable.pagoMovilPhone || activePayable.zelleEmail) && (
            <div className="mt-3 pt-3 border-t border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-sky-500" />
                  Datos Bancarios Registrados del Proveedor
                </span>
                <span className="text-[10px] text-neutral-500">
                  Haz clic en el icono para copiar al portapapeles
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {/* Cuenta Bancaria */}
                {activePayable.accountNumber ? (
                  <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-xs space-y-1">
                    <div className="flex items-center justify-between text-neutral-500">
                      <span className="font-medium flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-sky-500" />
                        {activePayable.bankName || "Banco Nacional"}
                      </span>
                      <span className="text-[10px]">
                        {activePayable.accountType === "CURRENT"
                          ? "Corriente"
                          : activePayable.accountType === "CUSTODY_USD"
                          ? "Custodia USD"
                          : "Cuenta"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-800 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700">
                      <span className="font-mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200 tracking-wider">
                        {activePayable.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(activePayable.accountNumber!, "pay_acc")}
                        className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                        title="Copiar número de cuenta"
                      >
                        {copiedKey === "pay_acc" ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      Titular: {activePayable.accountHolderName || activePayable.supplierName} ({activePayable.accountHolderId || activePayable.supplierRif})
                    </div>
                  </div>
                ) : null}

                {/* Pago Móvil */}
                {activePayable.pagoMovilPhone ? (
                  <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-xs space-y-1">
                    <div className="text-neutral-500 font-medium flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-emerald-500" />
                      Pago Móvil: {activePayable.pagoMovilBank || activePayable.bankName || "Banco"}
                    </div>
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-800 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700">
                      <span className="font-mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                        {activePayable.pagoMovilPhone}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(activePayable.pagoMovilPhone!, "pay_pm")}
                        className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                        title="Copiar teléfono pago móvil"
                      >
                        {copiedKey === "pay_pm" ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      C.I./RIF: {activePayable.pagoMovilId || activePayable.supplierRif}
                    </div>
                  </div>
                ) : null}

                {/* Zelle */}
                {activePayable.zelleEmail ? (
                  <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-xs space-y-1">
                    <div className="text-neutral-500 font-medium flex items-center gap-1">
                      <Mail className="w-3 h-3 text-purple-500" />
                      Zelle
                    </div>
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-800 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700">
                      <span className="font-mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200 truncate pr-1">
                        {activePayable.zelleEmail}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(activePayable.zelleEmail!, "pay_zelle")}
                        className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer shrink-0"
                        title="Copiar correo Zelle"
                      >
                        {copiedKey === "pay_zelle" ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    {activePayable.zelleHolderName && (
                      <div className="text-[10px] text-neutral-500">
                        Titular: {activePayable.zelleHolderName}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {activePayable.bankNotes && (
                <div className="text-[10px] text-neutral-500 bg-neutral-100/70 dark:bg-neutral-800/60 p-1.5 rounded">
                  <span className="font-medium text-neutral-600 dark:text-neutral-400">Instrucciones bancarias:</span> {activePayable.bankNotes}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Currency & Amount */}
        <Card className="p-5 border-neutral-200 dark:border-neutral-800 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            2. Moneda y Monto a Pagar
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Moneda de Transacción
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency("USD")}
                  className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                    currency === "USD"
                      ? "bg-sky-600 text-white border-sky-600"
                      : "text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  $ USD
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("VES")}
                  className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                    currency === "VES"
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
              value={exchangeRate}
              onChange={(e) => setExchangeRate(Number(e.target.value))}
              required
            />

            <Input
              label={`Monto a Pagar (${currency})`}
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
          </div>

          <div className="bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <span className="text-neutral-600 dark:text-neutral-400 font-medium">Conversión Oficial BCV:</span>
            <div className="font-mono font-bold space-x-3 text-neutral-900 dark:text-neutral-100">
              <span>USD: {formatMoneyUSD(equivalentUSD)}</span>
              <span className="text-neutral-400">•</span>
              <span>VES: {formatMoneyVES(equivalentVES)}</span>
            </div>
          </div>
        </Card>

        {/* Payment Method & Reference */}
        <Card className="p-5 border-neutral-200 dark:border-neutral-800 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            3. Método y Datos Bancarios
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Método de Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              >
                <option value="TRANSFER_VES">
                  Transferencia Bancaria Nacional (VES)
                </option>
                <option value="TRANSFER_USD">
                  Transferencia / Cuenta Custodia (USD)
                </option>
                <option value="PAGO_MOVIL">
                  Pago Móvil Interbancario (VES)
                </option>
                <option value="CASH_USD">Efectivo Divisas ($ USD)</option>
                <option value="CASH_VES">Efectivo Bolívares (VES)</option>
                <option value="ZELLE">
                  Zelle / Transferencia Internacional
                </option>
              </select>
            </div>

            {["TRANSFER_VES", "TRANSFER_USD", "PAGO_MOVIL", "ZELLE"].includes(paymentMethod) ? (
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Cuenta Bancaria Emisora (Empresa / Tesorería)
                </label>
                <select
                  value={selectedBankAccountId}
                  onChange={(e) => setSelectedBankAccountId(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                >
                  <option value="">Seleccione cuenta de egreso...</option>
                  {companyBankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.accountNumber.slice(-4)} ({acc.currency}) | Saldo: ${acc.currentBalance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <Input
                label="Número de Referencia Bancaria"
                placeholder="Ej. REF-98765432"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            )}
          </div>

          {["TRANSFER_VES", "TRANSFER_USD", "PAGO_MOVIL", "ZELLE"].includes(paymentMethod) && (
            <Input
              label="Número de Referencia Bancaria"
              placeholder="Ej. REF-98765432"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              required
            />
          )}

          <Input
            label="Concepto o Notas del Egreso"
            placeholder="Ej. Liquidación factura quincenal según acuerdo comercial"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/payables")}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            isLoading={submitting}
            disabled={!selectedPayableId || amount <= 0 || !canPay}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Confirmar y Emitir Pago
          </Button>
        </div>
      </form>

      {/* Modal Buscador de Facturas por Pagar */}
      <InvoiceSearchModal
        isOpen={showInvoiceSearch}
        onClose={() => setShowInvoiceSearch(false)}
        onSelect={(inv) => {
          setSelectedPayableId(inv.id);
          setShowInvoiceSearch(false);
        }}
        invoices={payables.map((p) => ({
          id: p.id,
          documentNumber: p.invoiceNumber,
          partyName: p.supplierName,
          partyDoc: p.supplierRif,
          dueDate: p.dueDate,
          amountTotal: p.amountTotal,
          amountBalance: p.amountBalance,
        }))}
        mode="payable"
      />

      {/* Modal Visor / Descarga PDF de Recibo de Pago CxP */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => {
          setPdfModal((prev) => ({ ...prev, isOpen: false }));
          navigate("/payables");
        }}
        title={pdfModal.title}
        endpoint={pdfModal.endpoint}
        filename={pdfModal.filename}
      />
    </div>
  );
};
