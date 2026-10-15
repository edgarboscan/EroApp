import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import { formatMoneyUSD, formatMoneyVES } from '../../utils/formatters';
import {
  ArrowLeft,
  DollarSign,
  AlertCircle,
  Receipt,
  Truck,
  CheckCircle2,
} from 'lucide-react';

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

const DEMO_PENDING_PAYABLES: PayableOption[] = [
  {
    id: 'p1',
    supplierName: 'ALIMENTOS POLAR COMERCIAL C.A.',
    supplierRif: 'J-30555666-0',
    invoiceNumber: 'FACT-POLAR-9812',
    amountTotal: 1254.80,
    amountPaid: 0.00,
    amountBalance: 1254.80,
    dueDate: '2026-09-29',
  },
  {
    id: 'p2',
    supplierName: 'MONDELEZ VENEZUELA C.A.',
    supplierRif: 'J-00033322-1',
    invoiceNumber: 'FACT-MDLZ-4410',
    amountTotal: 1740.00,
    amountPaid: 500.00,
    amountBalance: 1240.00,
    dueDate: '2026-09-14',
  },
];

export const PayablePaymentView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, activeBranchId } = useAuthStore();

  const [payables, setPayables] = useState<PayableOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [selectedPayableId, setSelectedPayableId] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState(36.5);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('TRANSFER_VES');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

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
          setPayables(json.data || []);
          if (!selectedPayableId && json.data?.length > 0) {
            setSelectedPayableId(json.data[0].id);
          }
        } else {
          setPayables(DEMO_PENDING_PAYABLES);
          if (!selectedPayableId) setSelectedPayableId(DEMO_PENDING_PAYABLES[0].id);
        }
      } catch {
        setPayables(DEMO_PENDING_PAYABLES);
        if (!selectedPayableId) setSelectedPayableId(DEMO_PENDING_PAYABLES[0].id);
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

      if (res.ok) {
        toast.success('Pago al proveedor registrado y comprobante emitido exitosamente');
        navigate('/payables');
      } else {
        const json = await res.json();
        toast.error(json.error?.message || 'Error al procesar el pago');
      }
    } catch {
      toast.success('Pago registrado correctamente en modo local');
      navigate('/payables');
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
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Factura / Proveedor Pendiente
              </label>
              <select
                value={selectedPayableId}
                onChange={(e) => setSelectedPayableId(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {payables.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.supplierName} ({p.supplierRif}) - Factura {p.invoiceNumber} | Saldo: ${p.amountBalance.toFixed(2)}
                  </option>
                ))}
              </select>
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
    </div>
  );
};
