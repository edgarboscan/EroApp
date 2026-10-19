import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
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
  customerName: string;
  customerDoc: string;
  invoiceNumber: string;
  amountTotal: number;
  amountPaid: number;
  amountBalance: number;
  dueDate: string;
}

export const CollectionsView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);

  const initialReceivableId = (location.state as any)?.selectedReceivableId || '';

  const [receivables, setReceivables] = useState<ReceivableOption[]>([]);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>(initialReceivableId);
  const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH_USD' | 'CASH_VES' | 'PAGO_MOVIL' | 'DEBIT_CARD' | 'ZELLE' | 'TRANSFER'>('PAGO_MOVIL');
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

  const exchangeRateBCV = 37.00;

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
            // Pre-seleccionar cuenta bancaria VES por defecto si el método inicial es PAGO_MOVIL
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

    fetchReceivables();
    fetchBankAccounts();
  }, [activeBranchId, token]);

  const selectedReceivable = receivables.find((r) => r.id === selectedReceivableId) || receivables[0];

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
          paymentMethod,
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
          <h1 className="text-xl font-bold text-neutral-900">Registro de Cobranza</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Abono o liquidación de cuentas por cobrar comerciales
          </p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selección de Cuenta por Cobrar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-neutral-700">
                Seleccione la Factura / Cuenta por Cobrar Pendiente
              </label>
              <button
                type="button"
                onClick={() => setShowInvoiceSearch(true)}
                className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Buscar en modal</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedReceivableId}
                onChange={(e) => setSelectedReceivableId(e.target.value)}
                className="flex-1 h-11 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {receivables.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.invoiceNumber} — {r.customerName} (Saldo: {formatMoneyUSD(r.amountBalance)})
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInvoiceSearch(true)}
                title="Buscar factura o cliente pendiente"
                className="h-11 px-3 shrink-0 flex items-center gap-1.5 text-xs"
              >
                <Search className="w-4 h-4 text-neutral-500" />
                <span>Buscar</span>
              </Button>
            </div>
          </div>

          {/* Resumen de la Factura Seleccionada */}
          {selectedReceivable && (
            <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-neutral-500 block">Cliente:</span>
                <span className="font-semibold text-neutral-900 block truncate">
                  {selectedReceivable.customerName}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {selectedReceivable.customerDoc}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Monto Original:</span>
                <span className="font-semibold text-neutral-900 block font-mono">
                  {formatMoneyUSD(selectedReceivable.amountTotal)}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Abonado Previo:</span>
                <span className="font-semibold text-emerald-700 block font-mono">
                  {formatMoneyUSD(selectedReceivable.amountPaid)}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Saldo Pendiente:</span>
                <span className="font-bold text-amber-700 block font-mono text-sm">
                  {formatMoneyUSD(selectedReceivable.amountBalance)}
                </span>
              </div>
            </div>
          )}

          {/* Medio de Pago */}
          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-2">
              Forma de Pago del Cliente
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'PAGO_MOVIL', label: 'Pago Móvil (Bs)', desc: 'Moneda local' },
                { id: 'CASH_USD', label: 'Efectivo Divisas ($)', desc: 'Dólares en efectivo' },
                { id: 'TRANSFER', label: 'Transferencia Bancaria', desc: 'Bancos nacionales' },
                { id: 'DEBIT_CARD', label: 'Punto de Venta / Débito', desc: 'Tarjeta' },
                { id: 'ZELLE', label: 'Zelle / Int. USD', desc: 'Transferencia electrónica' },
                { id: 'CASH_VES', label: 'Efectivo Bolívares (Bs)', desc: 'Moneda local' },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                    paymentMethod === m.id
                      ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-500'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="text-xs font-semibold text-neutral-900">{m.label}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cuenta Bancaria de Destino (Tesorería) */}
          <div className="p-3.5 bg-sky-50/50 rounded-lg border border-sky-100 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-600" />
                Cuenta Bancaria Receptora (Tesorería)
              </label>
              <span className="text-[10px] text-neutral-500">
                Se reflejará en el libro de banco para conciliación bancaria
              </span>
            </div>
            <select
              value={selectedBankAccountId}
              onChange={(e) => setSelectedBankAccountId(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <option value="">-- Sin acreditar a banco (Caja Chica / Efectivo en Custodia) --</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} - {b.accountNumber.slice(-4)} ({b.currency}) • Saldo actual: {formatCurrency(b.currentBalance, b.currency)}
                </option>
              ))}
            </select>
          </div>

          {/* Montos y Referencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Monto a Cobrar ($ USD)
                </label>
                <button
                  type="button"
                  onClick={handlePayFull}
                  className="text-[11px] text-sky-700 hover:text-sky-800 underline font-medium cursor-pointer"
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
              <div className="text-[11px] text-neutral-500 mt-1 font-mono">
                Equivalente BCV: {formatMoneyVES(amountVES)} (Tasa: {formatExchangeRate(exchangeRateBCV, 2)})
              </div>
            </div>

            <Input
              label="Número de Referencia / Comprobante"
              placeholder="Ej: Ref 0098421"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>

          <Input
            label="Notas u Observaciones (Opcional)"
            placeholder="Ej: Abono correspondiente a pago quincenal..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
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
