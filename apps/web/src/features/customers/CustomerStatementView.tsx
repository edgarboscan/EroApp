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
  ArrowRightLeft,
} from 'lucide-react';
import { formatMoneyUSD } from '../../utils/formatters';

export const CustomerStatementView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [statement, setStatement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatement = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/customers/${id}/statement`, {
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
      <div className="flex flex-col gap-6">
        <div className="h-8 bg-neutral-200 rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-24 bg-neutral-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/customers')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Clientes
          </Button>
        </div>
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h2 className="text-sm font-semibold text-neutral-800">Sin información</h2>
          <p className="text-xs text-neutral-500 mt-1">
            No se encontró información o estado de cuenta para el cliente seleccionado.
          </p>
        </Card>
      </div>
    );
  }

  const { customer, invoices, notes = [] } = statement;

  const totalCreditAvailableUSD = notes
    .filter((n: any) => n.type === 'CREDIT' && n.status === 'ACTIVE')
    .reduce((acc: number, n: any) => acc + (Number(n.amountBalance) || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Botón Volver y Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/customers')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Clientes
          </Button>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              Estado de Cuenta: {customer.name}
            </h1>
            <p className="text-xs text-neutral-500 font-mono">
              RIF/Doc: {customer.docType}-{customer.docNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/sales/credit-debit-notes')}
          >
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            Notas de Crédito / Débito
          </Button>
          <Button
            onClick={() => navigate('/receivables/collections')}
            disabled={customer.currentBalance <= 0}
          >
            <CreditCard className="w-4 h-4 mr-1.5" />
            Registrar Cobranza
          </Button>
        </div>
      </div>

      {/* KPI Cards Financieros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium">Límite de Crédito</div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">
            {formatMoneyUSD(customer.creditLimit)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Plazo de pago: {customer.paymentTermsDays} días
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium">Saldo Deudor Actual</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {formatMoneyUSD(customer.currentBalance)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {customer.currentBalance > 0 ? 'Facturas y débitos por cobrar' : 'Al día'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium">Saldo a Favor (NC)</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {formatMoneyUSD(totalCreditAvailableUSD)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Disponible para compensar
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium">Crédito Comercial Libre</div>
          <div className="text-2xl font-bold text-sky-700 mt-1">
            {formatMoneyUSD(Math.max(0, customer.availableCredit))}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Margen para compras a crédito
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium">Condición Fiscal</div>
          <div className="mt-2">
            <Badge variant={customer.isSpecialTaxpayer ? 'warning' : 'neutral'}>
              {customer.isSpecialTaxpayer ? 'Contribuyente Especial' : 'Contribuyente Ordinario'}
            </Badge>
          </div>
          <div className="text-[11px] text-neutral-400 mt-2 truncate">
            {customer.email || 'Sin correo registrado'}
          </div>
        </Card>
      </div>

      {/* Histórico de Facturas y CxC */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50/70 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
            Historial de Facturación y Cuentas por Cobrar
          </h2>
          <span className="text-xs text-neutral-500">{invoices.length} registro(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-4">Factura / Control</th>
                <th className="py-2.5 px-4">Fecha Emisión</th>
                <th className="py-2.5 px-4">Vencimiento</th>
                <th className="py-2.5 px-4 text-right">Monto Total</th>
                <th className="py-2.5 px-4 text-right">Pagado</th>
                <th className="py-2.5 px-4 text-right">Saldo Deudor</th>
                <th className="py-2.5 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    No existen facturas asociadas a este cliente
                  </td>
                </tr>
              ) : (
                invoices.map((inv: any) => {
                  const isOverdue = inv.receivable && inv.receivable.daysOverdue > 0 && inv.status !== 'PAID';
                  return (
                    <tr key={inv.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-neutral-900">{inv.invoiceNumber}</div>
                        {inv.controlNumber && (
                          <div className="text-[10px] text-neutral-400 font-mono">Control: {inv.controlNumber}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {new Date(inv.invoiceDate).toLocaleDateString('es-VE')}
                      </td>
                      <td className="py-3 px-4">
                        {inv.receivable ? (
                          <div className={isOverdue ? 'text-red-700 font-semibold' : 'text-neutral-600'}>
                            {new Date(inv.receivable.dueDate).toLocaleDateString('es-VE')}
                            {isOverdue && (
                              <span className="block text-[10px] text-red-600">
                                ({inv.receivable.daysOverdue} días vencido)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400">Contado</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-neutral-900">
                        {formatMoneyUSD(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-medium">
                        {formatMoneyUSD(inv.receivable?.amountPaid ?? inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                        {formatMoneyUSD(inv.receivable?.amountBalance ?? 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            inv.status === 'PAID'
                              ? 'success'
                              : isOverdue
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {inv.status === 'PAID' ? 'Cobrada' : isOverdue ? 'Vencida' : 'Pendiente'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Histórico de Notas de Crédito & Débito */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-neutral-500" />
            <h2 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
              Notas de Crédito & Débito del Cliente
            </h2>
          </div>
          <span className="text-xs text-neutral-500">{notes.length} documento(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-4">Tipo</th>
                <th className="py-2.5 px-4">Nº Nota / Control</th>
                <th className="py-2.5 px-4">Fecha</th>
                <th className="py-2.5 px-4">Factura Afectada</th>
                <th className="py-2.5 px-4">Motivo</th>
                <th className="py-2.5 px-4 text-right">Monto Total</th>
                <th className="py-2.5 px-4 text-right">Compensado</th>
                <th className="py-2.5 px-4 text-right">Saldo Remanente</th>
                <th className="py-2.5 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {notes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-400">
                    No existen Notas de Crédito ni de Débito registradas para este cliente
                  </td>
                </tr>
              ) : (
                notes.map((note: any) => {
                  const isCredit = note.type === 'CREDIT';
                  return (
                    <tr key={note.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4">
                        <Badge variant={isCredit ? 'success' : 'info'}>
                          {isCredit ? 'Crédito' : 'Débito'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-neutral-900">{note.noteNumber}</div>
                        {note.controlNumber && (
                          <div className="text-[10px] text-neutral-400 font-mono">Control: {note.controlNumber}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {new Date(note.issueDate).toLocaleDateString('es-VE')}
                      </td>
                      <td className="py-3 px-4">
                        {note.affectedInvoiceNumber ? (
                          <span className="font-mono text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-lg text-[11px]">
                            {note.affectedInvoiceNumber}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic text-[11px]">General</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-neutral-700" title={note.reasonDescription}>
                        {note.reasonDescription || note.reasonType}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-neutral-900">
                        {formatMoneyUSD(note.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-medium">
                        {formatMoneyUSD(note.amountApplied)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {isCredit ? (
                          note.amountBalance > 0.005 ? (
                            <span className="text-emerald-700">{formatMoneyUSD(note.amountBalance)}</span>
                          ) : (
                            <span className="text-neutral-400">$0.00</span>
                          )
                        ) : (
                          <span className="text-neutral-800">
                            {formatMoneyUSD(note.totalAmount - note.amountApplied)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            note.status === 'ANNULLED'
                              ? 'danger'
                              : note.status === 'APPLIED'
                              ? 'neutral'
                              : 'success'
                          }
                        >
                          {note.status === 'ANNULLED'
                            ? 'Anulada'
                            : note.status === 'APPLIED'
                            ? 'Saldada'
                            : 'Activa'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
