import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import { formatMoneyUSD, formatMoneyVES } from '../../utils/formatters';
import { showConfirmQuestion } from '../../lib/sweetalert';
import {
  ArrowLeft,
  DollarSign,
  AlertCircle,
  Receipt,
  Truck,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { InvoiceSearchModal } from '../../components/search';
import { useEscapeKey } from '../../components/ui/Modal';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';

interface PayableOption {
  id: string;
  supplierName: string;
  supplierRif: string;
  invoiceNumber: string;
  amountTotal: number;
  amountPaid: number;
  amountBalance: number;
  dueDate: string;
}

export const PayablePaymentView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, activeBranchId } = useAuthStore();

  const [payables, setPayables] = useState<PayableOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [selectedPayableId, setSelectedPayableId] = useState('');
  const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState(36.5);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('TRANSFER_VES');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
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

  // Check URL query param ?payableId=xxx
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qPayableId = params.get('payableId');
    if (qPayableId) {
      setSelectedPayableId(qPayableId);
    }
  }, [location.search]);

  // Load pending payables
  useEffect(() => {
    const fetchPendingPayables = async () => {
      setLoading(true);
      try {
        const branchParam = activeBranchId ? `?branchId=${activeBranchId}` : '';
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



  const activePayable = payables.find((p) => p.id === selectedPayableId);

  // Auto-fill amount when payable changes
  useEffect(() => {
    if (activePayable) {
      if (currency === 'USD') {
        setAmount(activePayable.amountBalance);
      } else {
        setAmount(Number((activePayable.amountBalance * exchangeRate).toFixed(2)));
      }
    }
  }, [selectedPayableId, currency, exchangeRate]);

  const equivalentUSD = currency === 'USD' ? amount : amount / exchangeRate;
  const equivalentVES = currency === 'VES' ? amount : amount * exchangeRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayableId || amount <= 0) {
      toast.error('Selecciona una cuenta por pagar e introduce un monto válido');
      return;
    }

    if (activePayable && equivalentUSD > activePayable.amountBalance + 0.01) {
      toast.error(
        `El monto ($${equivalentUSD.toFixed(2)}) supera el saldo deudor pendiente ($${activePayable.amountBalance.toFixed(2)})`
      );
      return;
    }

    const confirmed = await showConfirmQuestion({
      title: '¿Confirmar pago a proveedor?',
      text: `¿Confirma el pago por ${currency === 'USD' ? `$${amount.toFixed(2)}` : `Bs. ${amount.toFixed(2)}`} a favor de ${activePayable?.supplierName || 'proveedor seleccionado'}?`,
      confirmButtonText: 'Sí, registrar pago',
      cancelButtonText: 'Cancelar',
      icon: 'question',
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/payables/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payableId: selectedPayableId,
          amount,
          currency,
          exchangeRate,
          paymentMethod,
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Pago al proveedor registrado y comprobante emitido exitosamente');
        if (json.data?.id) {
          setPdfModal({
            isOpen: true,
            endpoint: `/api/payables/payments/${json.data.id}/pdf`,
            title: 'Recibo Oficial de Pago a Proveedor (CxP)',
            filename: `recibo_pago_cxp_${json.data.id}.pdf`,
          });
        } else {
          navigate('/payables');
        }
      } else {
        toast.error(json.error?.message || 'Error al procesar el pago');
      }
    } catch {
      toast.error('Error de red al procesar el pago al proveedor');
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
          onClick={() => navigate('/payables')}
          className="p-2 text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-sky-600" />
            Registrar Pago a Proveedor (CxP)
          </h1>
          <p className="text-xs text-neutral-500">
            Emisión de egreso bancario o en caja con imputación a factura de compra
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payable Selection */}
        <Card className="p-5 border-neutral-200 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-sky-600" />
            1. Selección de Cuenta por Pagar
          </h2>

          {loading ? (
            <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
          ) : payables.length === 0 ? (
            <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              No existen facturas por pagar pendientes en la sucursal activa.
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-700">
                  Factura / Proveedor Pendiente
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
                  value={selectedPayableId}
                  onChange={(e) => setSelectedPayableId(e.target.value)}
                  className="flex-1 h-10 px-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {payables.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.supplierName} ({p.supplierRif}) - Factura {p.invoiceNumber} | Saldo: ${p.amountBalance.toFixed(2)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInvoiceSearch(true)}
                  title="Buscar factura por pagar"
                  className="h-10 px-3 shrink-0 flex items-center gap-1.5 text-xs"
                >
                  <Search className="w-4 h-4 text-neutral-500" />
                  <span>Buscar</span>
                </Button>
              </div>
            </div>
          )}

          {activePayable && (
            <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-neutral-400 block font-medium">Proveedor:</span>
                <span className="font-semibold text-neutral-900">{activePayable.supplierName}</span>
                <span className="text-neutral-500 font-mono block text-[11px]">{activePayable.supplierRif}</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Factura:</span>
                <span className="font-semibold text-neutral-900 font-mono">{activePayable.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Total Factura:</span>
                <span className="font-semibold text-neutral-900 font-mono">{formatMoneyUSD(activePayable.amountTotal)}</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Saldo Pendiente:</span>
                <span className="font-bold text-red-600 font-mono text-sm">{formatMoneyUSD(activePayable.amountBalance)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Currency & Amount */}
        <Card className="p-5 border-neutral-200 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            2. Moneda y Monto a Pagar
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Moneda de Transacción
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                    currency === 'USD'
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  $ USD
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('VES')}
                  className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                    currency === 'VES'
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
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

          <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-sky-900 gap-2">
            <span>Conversión Oficial BCV:</span>
            <div className="font-mono font-bold space-x-3">
              <span>USD: {formatMoneyUSD(equivalentUSD)}</span>
              <span>•</span>
              <span>VES: {formatMoneyVES(equivalentVES)}</span>
            </div>
          </div>
        </Card>

        {/* Payment Method & Reference */}
        <Card className="p-5 border-neutral-200 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-neutral-700" />
            3. Método y Datos Bancarios
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Método de Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
              label="Número de Referencia Bancaria"
              placeholder="Ej. REF-98765432"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>

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
            onClick={() => navigate('/payables')}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            isLoading={submitting}
            disabled={!selectedPayableId || amount <= 0}
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
          navigate('/payables');
        }}
        title={pdfModal.title}
        endpoint={pdfModal.endpoint}
        filename={pdfModal.filename}
      />
    </div>
  );
};
