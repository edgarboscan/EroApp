import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import {
  CreditCard,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Receipt,
  Building2,
  Search,
  RotateCcw,
} from 'lucide-react';
import { InvoiceSearchModal } from '../../components/search';
import { useEscapeKey } from '../../components/ui/Modal';
import {
  formatNumber,
  formatCurrency,
  formatMoneyUSD,
  formatMoneyVES,
  formatExchangeRate,
} from '@ero/shared';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';

interface BankAccountOption {
  id: string;
  bankName: string;
  accountNumber: string;
  currency: 'USD' | 'VES';
  currentBalance: number;
}

interface ReceivableOption {
  id: string;
  customerId: string;
  customerName: string;
  customerDoc: string;
  invoiceNumber: string;
  documentType?: 'INVOICE' | 'DEBIT_NOTE';
  amountTotal: number;
  amountPaid: number;
  amountBalance: number;
  dueDate: string;
}

export interface PaymentMethodOption {
  id: string;
  code: string;
  name: string;
  currency: 'USD' | 'VES';
  type: 'CASH' | 'CARD' | 'ELECTRONIC' | 'CREDIT' | 'OTHER';
  appliesIGTF: boolean;
  requiresReference: boolean;
  requiresBankAccount: boolean;
  displayOrder: number;
}

export const CollectionsView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const liveRate = useExchangeRateStore((state) => state.rate);

  const initialReceivableId = (location.state as any)?.selectedReceivableId || '';

  const [receivables, setReceivables] = useState<ReceivableOption[]>([]);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>(initialReceivableId);
  const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [paymentMethodCode, setPaymentMethodCode] = useState<string>('PAGO_MOVIL');
  const [isPaymentMethodsLoading, setIsPaymentMethodsLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    endpoint: string | null;
    title: string;
    filename?: string;
  }>({
    isOpen: false,
    endpoint: null,
    title: '',
  });

  useEscapeKey(() => setShowInvoiceSearch(false), showInvoiceSearch);

  const exchangeRateBCV = liveRate && liveRate > 0 ? liveRate : 37.00;

  useEffect(() => {
    const fetchReceivables = async () => {
      try {
        const url = activeBranchId ? `/api/receivables?branchId=${activeBranchId}` : '/api/receivables';
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setReceivables(json.data);
          if (!json.data.some((r: ReceivableOption) => r.id === selectedReceivableId)) {
            setSelectedReceivableId(json.data[0].id);
          }
        } else {
          setReceivables([]);
        }
      } catch {
        setReceivables([]);
      }
    };

    const fetchBankAccounts = async () => {
      try {
        const res = await fetch('/api/treasury/accounts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setBankAccounts(json.data);
            // Pre-seleccionar cuenta bancaria VES por defecto
            const vesAcc = json.data.find((a: BankAccountOption) => a.currency === 'VES');
            if (vesAcc) {
              setSelectedBankAccountId(vesAcc.id);
            }
          }
        }
      } catch {
        // Ignorar
      }
    };

    const fetchPaymentMethods = async () => {
      try {
        setIsPaymentMethodsLoading(true);
        const res = await fetch('/api/receivables/payment-methods', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            setPaymentMethods(json.data);
            const defaultMethod = json.data.find((m: PaymentMethodOption) => m.code === 'PAGO_MOVIL') || json.data[0];
            setPaymentMethodCode(defaultMethod.code);
          }
        }
      } catch {
        // Ignorar
      } finally {
        setIsPaymentMethodsLoading(false);
      }
    };

    fetchReceivables();
    fetchBankAccounts();
    fetchPaymentMethods();
  }, [activeBranchId, token]);

  const [availableCredits, setAvailableCredits] = useState<any[]>([]);

  const selectedReceivable = receivables.find((r) => r.id === selectedReceivableId) || receivables[0];
  const selectedMethod = paymentMethods.find((m) => m.code === paymentMethodCode) || paymentMethods[0];

  // Consultar notas de crédito con saldo a favor del cliente seleccionado
  useEffect(() => {
    if (!selectedReceivable?.customerId) {
      setAvailableCredits([]);
      return;
    }

    fetch(`/api/customer-notes/customer/${selectedReceivable.customerId}/available-credits`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setAvailableCredits(json.data);
        } else {
          setAvailableCredits([]);
        }
      })
      .catch(() => setAvailableCredits([]));
  }, [selectedReceivable?.customerId, token]);

  const totalAvailableCreditUSD = availableCredits.reduce(
    (acc, c) => acc + (Number(c.amountBalance) || 0),
    0
  );

  useEffect(() => {
    if (selectedReceivable) {
      setAmount(selectedReceivable.amountBalance);
    }
  }, [selectedReceivableId, selectedReceivable]);

  const handlePayFull = () => {
    if (selectedReceivable) {
      setAmount(selectedReceivable.amountBalance);
    }
  };

  const handleSelectPaymentMethod = (m: PaymentMethodOption) => {
    setPaymentMethodCode(m.code);

    // Ajustar automáticamente la cuenta bancaria de destino según la moneda del método de pago
    const currentAcc = bankAccounts.find((b) => b.id === selectedBankAccountId);
    if (!currentAcc || currentAcc.currency !== m.currency) {
      const matchingAcc = bankAccounts.find((b) => b.currency === m.currency);
      if (matchingAcc) {
        setSelectedBankAccountId(matchingAcc.id);
      } else if (m.requiresBankAccount && bankAccounts.length > 0) {
        setSelectedBankAccountId(bankAccounts[0].id);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable) return;

    if (amount <= 0) {
      toast.error('El monto debe ser superior a 0');
      return;
    }

    if (amount > selectedReceivable.amountBalance + 0.01) {
      toast.error(`El monto no puede superar el saldo pendiente (${formatMoneyUSD(selectedReceivable.amountBalance)})`);
      return;
    }

    if (selectedMethod?.requiresReference && !referenceNumber.trim()) {
      toast.error(`El número de referencia es obligatorio para pagos con ${selectedMethod.name}`);
      return;
    }

    if (paymentMethodCode === 'NOTA_CREDITO') {
      const creditNote = availableCredits.find((c) => c.noteNumber === referenceNumber || c.id === referenceNumber);
      if (!creditNote) {
        toast.error('Debe seleccionar una Nota de Crédito con saldo a favor para compensar la deuda');
        return;
      }
      if (amount > creditNote.amountBalance + 0.01) {
        toast.error(`El monto a compensar no puede superar el saldo disponible de la Nota de Crédito (${formatMoneyUSD(creditNote.amountBalance)})`);
        return;
      }
    }

    if (selectedMethod?.requiresBankAccount && !selectedBankAccountId) {
      toast.error('Debe seleccionar una cuenta bancaria receptora para generar el movimiento de conciliación bancaria');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/receivables/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receivableId: selectedReceivable.id,
          amount,
          currency: 'USD',
          paymentMethod: selectedMethod ? selectedMethod.code : paymentMethodCode,
          bankAccountId: selectedBankAccountId || undefined,
          exchangeRate: exchangeRateBCV,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al procesar cobranza');
      }

      toast.success('Cobranza registrada exitosamente y fondos acreditados en Tesorería');
      if (json.data?.id) {
        setPdfModal({
          isOpen: true,
          endpoint: `/api/receivables/collections/${json.data.id}/pdf`,
          title: 'Recibo Oficial de Cobranza',
          filename: `recibo_cobro_${json.data.id}.pdf`,
        });
      } else {
        navigate('/receivables');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar cobranza');
    } finally {
      setIsLoading(false);
    }
  };

  const amountVES = amount * exchangeRateBCV;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Botón Volver y Encabezado */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/receivables')}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver a CxC
        </Button>
        <div>
          <h1 className="text-xl font-bold text-neutral-400  dark:text-neutral-100">Registro de Cobranza</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Abono o liquidación de cuentas por cobrar comerciales
          </p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selección de Cuenta por Cobrar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Seleccione la Factura / Cuenta por Cobrar Pendiente
              </label>
              <button
                type="button"
                onClick={() => setShowInvoiceSearch(true)}
                className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Buscar en modal</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedReceivableId}
                onChange={(e) => setSelectedReceivableId(e.target.value)}
                className="flex-1 h-11 px-3 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-400  dark:text-neutral-100 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {receivables.map((r) => {
                  const typeLabel = r.documentType === 'DEBIT_NOTE' ? '[ND]' : '[FAC]';
                  return (
                    <option key={r.id} value={r.id}>
                      {typeLabel} {r.invoiceNumber} — {r.customerName} (Saldo: {formatMoneyUSD(r.amountBalance)})
                    </option>
                  );
                })}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInvoiceSearch(true)}
                title="Buscar factura o cliente pendiente"
                className="h-11 px-3 shrink-0 flex items-center gap-1.5 text-xs"
              >
                <Search className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                <span>Buscar</span>
              </Button>
            </div>
          </div>

          {/* Banner de Saldo a Favor por Notas de Crédito Disponibles */}
          {totalAvailableCreditUSD > 0.005 && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-950 dark:text-emerald-100">
                    Saldo a Favor de Notas de Crédito: {formatMoneyUSD(totalAvailableCreditUSD)}
                  </div>
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                    Este cliente posee {availableCredits.length} Nota(s) de Crédito activas con saldo disponible para compensar esta deuda.
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPaymentMethodCode('NOTA_CREDITO');
                  if (availableCredits.length > 0) {
                    setReferenceNumber(availableCredits[0].noteNumber);
                    const maxUsable = Math.min(selectedReceivable.amountBalance, availableCredits[0].amountBalance);
                    setAmount(Number(maxUsable.toFixed(2)));
                  }
                }}
                className="bg-white dark:bg-neutral-800 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-neutral-700 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Compensar con Nota de Crédito
              </Button>
            </div>
          )}

          {/* Resumen de la Factura Seleccionada */}
          {selectedReceivable && (
            <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block">Cliente:</span>
                <span className="font-semibold text-neutral-400  dark:text-neutral-100 block truncate">
                  {selectedReceivable.customerName}
                </span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                  {selectedReceivable.customerDoc}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block">
                  {selectedReceivable.documentType === 'DEBIT_NOTE' ? 'Tipo Documento:' : 'Monto Original:'}
                </span>
                <span className="font-semibold text-neutral-400  dark:text-neutral-100 block font-mono">
                  {selectedReceivable.documentType === 'DEBIT_NOTE' ? 'Nota de Débito' : formatMoneyUSD(selectedReceivable.amountTotal)}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block">Abonado Previo:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 block font-mono">
                  {formatMoneyUSD(selectedReceivable.amountPaid)}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 dark:text-neutral-400 block">Saldo Pendiente:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400 block font-mono text-sm">
                  {formatMoneyUSD(selectedReceivable.amountBalance)}
                </span>
              </div>
            </div>
          )}

          {/* Medio de Pago Cargado de la Base de Datos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Forma de Pago del Cliente
              </label>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                Configurados en base de datos
              </span>
            </div>

            {isPaymentMethodsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : paymentMethods.length === 0 ? (
              <div className="p-4 bg-neutral-50 dark:bg-neutral-850 rounded-lg border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500 dark:text-neutral-400">
                No se encontraron medios de pago activos en el sistema.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {paymentMethods.map((m) => (
                  <button
                    key={m.id || m.code}
                    type="button"
                    onClick={() => handleSelectPaymentMethod(m)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      paymentMethodCode === m.code
                        ? 'border-sky-600 bg-sky-50/50 dark:bg-sky-950/40 ring-2 ring-sky-500'
                        : 'border-neutral-200 dark:border-neutral-800 bg-sky dark:bg-emerald-950/50 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-neutral-400  dark:text-neutral-100 truncate">
                        {m.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-lg border shrink-0 ${
                          m.currency === 'USD'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                        }`}
                      >
                        {m.currency}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {m.requiresReference && (
                        <span className="text-rose-600 dark:text-rose-400 font-medium">• Ref. requerida</span>
                      )}
                      {m.requiresBankAccount ? (
                        <span className="text-purple-700 dark:text-purple-400 font-medium">• Conciliable</span>
                      ) : (
                        <span>• Caja / Efectivo</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cuenta Bancaria de Destino (Tesorería) */}
          {paymentMethodCode !== 'NOTA_CREDITO' && (
            <div className="p-3.5 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Cuenta Bancaria Receptora (Tesorería)</span>
                  {selectedMethod?.requiresBankAccount && (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold ml-1">
                      * Requerido para conciliación
                    </span>
                  )}
                </label>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Se generará el registro en el libro de banco para la conciliación bancaria
                </span>
              </div>
              <select
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                required={selectedMethod?.requiresBankAccount}
                className={`w-full h-10 px-3 text-xs bg-white dark:bg-neutral-800 text-neutral-400  dark:text-neutral-100 border rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  selectedMethod?.requiresBankAccount && !selectedBankAccountId
                    ? 'border-rose-400 ring-1 ring-rose-200 dark:ring-rose-900'
                    : 'border-neutral-300 dark:border-neutral-700'
                }`}
              >
                {!selectedMethod?.requiresBankAccount && (
                  <option value="">-- Sin acreditar a banco (Caja Chica / Efectivo en Custodia) --</option>
                )}
                {selectedMethod?.requiresBankAccount && (
                  <option value="">-- Seleccione la cuenta bancaria de destino (Obligatorio) --</option>
                )}
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountNumber.slice(-4)} ({b.currency}) • Saldo actual: {formatCurrency(b.currentBalance, b.currency)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Montos y Referencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Monto a Cobrar ($ USD)
                </label>
                <button
                  type="button"
                  onClick={handlePayFull}
                  className="text-[11px] text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 underline font-medium cursor-pointer"
                >
                  Saldar Total
                </button>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                {selectedMethod?.currency === 'VES' ? (
                  <span>
                    Equivalente en Bolívares: <strong className="text-neutral-400  dark:text-neutral-100">{formatMoneyVES(amountVES)}</strong> (Tasa: {formatExchangeRate(exchangeRateBCV, 2)})
                  </span>
                ) : (
                  <span>
                    Equivalente BCV: {formatMoneyVES(amountVES)} (Tasa: {formatExchangeRate(exchangeRateBCV, 2)})
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {paymentMethodCode === 'NOTA_CREDITO'
                    ? 'Nota de Crédito a Aplicar'
                    : 'Número de Referencia / Comprobante'}
                </label>
                {selectedMethod?.requiresReference || paymentMethodCode === 'NOTA_CREDITO' ? (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                    * Obligatorio
                  </span>
                ) : (
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    Opcional
                  </span>
                )}
              </div>
              {paymentMethodCode === 'NOTA_CREDITO' ? (
                availableCredits.length > 0 ? (
                  <select
                    value={referenceNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReferenceNumber(val);
                      const sel = availableCredits.find(
                        (c) => c.noteNumber === val || c.id === val
                      );
                      if (sel && selectedReceivable) {
                        const maxCompensable = Math.min(
                           selectedReceivable.amountBalance,
                           sel.amountBalance
                        );
                        setAmount(Number(maxCompensable.toFixed(2)));
                      }
                    }}
                    required
                    className="w-full h-10 px-3 text-xs bg-white dark:bg-neutral-800 text-neutral-400  dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <option value="">-- Seleccione la Nota de Crédito --</option>
                    {availableCredits.map((c) => (
                      <option key={c.id} value={c.noteNumber}>
                        {c.noteNumber} - Saldo: {formatMoneyUSD(c.amountBalance)} ({c.reasonDescription || c.reasonType})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg">
                    El cliente no posee Notas de Crédito activas con saldo a favor disponible.
                  </div>
                )
              ) : (
                <Input
                  placeholder={
                    selectedMethod?.requiresReference
                      ? 'Ej: Ref 0098421 (Requerido para conciliar)'
                      : 'Ej: Ref 0098421 (Opcional)'
                  }
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  required={selectedMethod?.requiresReference}
                  className={
                    selectedMethod?.requiresReference && !referenceNumber.trim()
                      ? 'border-rose-300 dark:border-rose-700 focus-visible:ring-rose-500'
                      : ''
                  }
                />
              )}
            </div>
          </div>

          <Input
            label="Notas u Observaciones (Opcional)"
            placeholder="Ej: Abono correspondiente a pago quincenal..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/receivables')}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Procesar y Emitir Recibo de Cobro
            </Button>
          </div>
        </form>
      </Card>

      {/* Modal Buscador de Facturas por Cobrar */}
      <InvoiceSearchModal
        isOpen={showInvoiceSearch}
        onClose={() => setShowInvoiceSearch(false)}
        onSelect={(inv) => {
          setSelectedReceivableId(inv.id);
          setShowInvoiceSearch(false);
        }}
        invoices={receivables.map((r) => ({
          id: r.id,
          documentNumber: r.invoiceNumber,
          partyName: r.customerName,
          partyDoc: r.customerDoc,
          dueDate: r.dueDate,
          amountTotal: r.amountTotal,
          amountBalance: r.amountBalance,
        }))}
        mode="receivable"
      />

      {/* Modal Visor / Descarga PDF Recibo de Cobranza */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => {
          setPdfModal((prev) => ({ ...prev, isOpen: false }));
          navigate('/receivables');
        }}
        title={pdfModal.title}
        endpoint={pdfModal.endpoint}
        filename={pdfModal.filename}
      />
    </div>
  );
};
