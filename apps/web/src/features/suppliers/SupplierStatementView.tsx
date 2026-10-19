import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  CreditCard,
  FileText,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Truck,
  Receipt,
  Phone,
  Mail,
} from 'lucide-react';
import { formatMoneyUSD, formatMoneyVES } from '../../utils/formatters';

export const SupplierStatementView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [statement, setStatement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatement = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/suppliers/${id}/statement`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json();
        if (json.success && json.data) {
          setStatement(json.data);
        } else {
          throw new Error('No se pudo cargar el estado de cuenta');
        }
      } catch {
        setStatement(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatement();
  }, [id, token]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-neutral-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-neutral-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-neutral-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!statement || !statement.supplier) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/suppliers')}
          className="inline-flex items-center text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Volver al Directorio de Proveedores
        </button>
        <Card className="p-12 text-center">
          <Truck className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h2 className="text-sm font-semibold text-neutral-800">Sin información</h2>
          <p className="text-xs text-neutral-500 mt-1">
            No se encontró información o estado de cuenta para el proveedor seleccionado.
          </p>
        </Card>
      </div>
    );
  }

  const supplier = statement.supplier;
  const invoices = statement.invoices || [];
  const payments = statement.payments || [];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Supplier Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/suppliers')}
            className="inline-flex items-center text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Volver al Directorio de Proveedores
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-neutral-100 rounded-lg text-neutral-700">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-900">{supplier?.name}</h1>
                <Badge variant={supplier?.isResident ? 'success' : 'neutral'}>
                  {supplier?.isResident ? 'Domiciliado' : 'No Dom.'}
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 font-mono mt-0.5">
                RIF: {supplier?.rif} | {supplier?.fiscalAddress || 'Sin dirección fiscal'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            onClick={() => navigate('/payables/payments')}
            className="w-full sm:w-auto"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            Registrar Pago a Proveedor
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Deuda Total Pendiente
              </p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatMoneyUSD(supplier?.currentBalance || 0)}
              </p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Límite de Crédito Otorgado
              </p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {formatMoneyUSD(supplier?.creditLimit || 0)}
              </p>
            </div>
            <div className="p-2 bg-neutral-100 rounded-lg text-neutral-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Plazo de Pago Acordado
              </p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {supplier?.paymentTermsDays || 0} días
              </p>
            </div>
            <div className="p-2 bg-neutral-100 rounded-lg text-neutral-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Facturas Registradas
              </p>
              <p className="text-2xl font-bold text-sky-700 mt-1">{invoices.length}</p>
            </div>
            <div className="p-2 bg-sky-50 rounded-lg text-sky-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Invoices List */}
      <Card className="border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-sky-600" />
            Historial de Facturas de Compra (CxP)
          </h2>
          <span className="text-xs text-neutral-500">{invoices.length} documentos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Factura / Control</th>
                <th className="py-3 px-4">Emisión</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4 text-right">Total Factura</th>
                <th className="py-3 px-4 text-right">Amortizado</th>
                <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                <th className="py-3 px-4 text-center">Estatus</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-neutral-400">
                    No existen facturas de compra registradas para este proveedor.
                  </td>
                </tr>
              ) : (
                invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-900 font-mono">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-xs text-neutral-500 font-mono">
                        Ctrl: {inv.controlNumber || 'S/C'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-700">
                      {new Date(inv.invoiceDate).toLocaleDateString('es-VE')}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-VE') : '-'}
                      {inv.daysOverdue > 0 && (
                        <div className="text-[11px] font-bold text-red-600">
                          {inv.daysOverdue} días vencido
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-neutral-900 font-mono">
                      {formatMoneyUSD(inv.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-mono text-xs">
                      {formatMoneyUSD(inv.amountPaid)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono">
                      {inv.amountBalance > 0 ? (
                        <span className="text-red-600">
                          {formatMoneyUSD(inv.amountBalance)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-xs">Saldado</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        variant={
                          inv.status === 'PAID'
                            ? 'success'
                            : inv.daysOverdue > 0
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {inv.status === 'PAID'
                          ? 'Pagado'
                          : inv.daysOverdue > 0
                          ? 'Vencido'
                          : 'Pendiente'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {inv.amountBalance > 0 && inv.payableId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/payables/payments?payableId=${inv.payableId}`)}
                          className="h-7 text-xs"
                        >
                          Pagar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payments History List */}
      <Card className="border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Historial de Pagos y Egresos Emitidos
          </h2>
          <span className="text-xs text-neutral-500">{payments.length} transacciones</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Fecha Pago</th>
                <th className="py-3 px-4">Factura Imputada</th>
                <th className="py-3 px-4">Método de Pago</th>
                <th className="py-3 px-4">Referencia Bancaria</th>
                <th className="py-3 px-4 text-right">Monto ($ USD)</th>
                <th className="py-3 px-4 text-right">Monto (VES)</th>
                <th className="py-3 px-4">Concepto / Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-neutral-400">
                    No se registran pagos realizados a este proveedor aún.
                  </td>
                </tr>
              ) : (
                payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-4 text-xs text-neutral-700">
                      {new Date(p.createdAt).toLocaleDateString('es-VE')}{' '}
                      <span className="text-neutral-400 font-mono">
                        {new Date(p.createdAt).toLocaleTimeString('es-VE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-neutral-900">
                      {p.invoiceNumber || 'Abono General'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral">{p.method}</Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-neutral-600">
                      {p.referenceNumber || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-neutral-900 font-mono">
                      {formatMoneyUSD(p.amountUsd)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-neutral-600 font-mono">
                      {formatMoneyVES(p.amountVes)}
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-500">{p.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
