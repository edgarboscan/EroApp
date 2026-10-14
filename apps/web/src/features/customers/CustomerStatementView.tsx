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
} from 'lucide-react';

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
        // Mock fallback
        setStatement({
          customer: {
            id,
            docType: 'J',
            docNumber: '30999888-1',
            name: 'INVERSIONES EL SOL DE CARACAS C.A.',
            address: 'Av. Libertador, Edif. Centro, Chacao, Caracas',
            phone: '+58 212 999 1122',
            email: 'contacto@elsolcaracas.com',
            isSpecialTaxpayer: true,
            creditEnabled: true,
            creditLimit: 5000.0,
            paymentTermsDays: 30,
            currentBalance: 1420.50,
            availableCredit: 3579.50,
          },
          invoices: [
            {
              id: 'inv-1',
              invoiceNumber: 'FACT-001042',
              controlNumber: '00-001042',
              invoiceDate: '2026-09-15 10:30:00',
              currency: 'USD',
              totalAmount: 1420.50,
              status: 'PENDING',
              isCredit: true,
              receivable: {
                id: 'rec-1',
                amountTotal: 1420.50,
                amountPaid: 0.00,
                amountBalance: 1420.50,
                dueDate: '2026-10-15',
                status: 'PENDING',
                daysOverdue: -16,
              },
            },
            {
              id: 'inv-0',
              invoiceNumber: 'FACT-000980',
              controlNumber: '00-000980',
              invoiceDate: '2026-08-20 14:15:00',
              currency: 'USD',
              totalAmount: 950.00,
              status: 'PAID',
              isCredit: true,
              receivable: {
                id: 'rec-0',
                amountTotal: 950.00,
                amountPaid: 950.00,
                amountBalance: 0.00,
                dueDate: '2026-09-19',
                status: 'PAID',
                daysOverdue: 10,
              },
            },
          ],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatement();
  }, [id, token]);

  if (isLoading || !statement) {
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

  const { customer, invoices } = statement;

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

        <Button
          onClick={() => navigate('/receivables/collections')}
          disabled={customer.currentBalance <= 0}
        >
          <CreditCard className="w-4 h-4 mr-1.5" />
          Registrar Cobranza
        </Button>
      </div>

      {/* KPI Cards Financieros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium">Límite de Crédito</div>
          <div className="text-2xl font-bold text-neutral-900 mt-1">
            ${customer.creditLimit.toFixed(2)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Plazo de pago: {customer.paymentTermsDays} días
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium">Saldo Deudor Actual</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            ${customer.currentBalance.toFixed(2)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {customer.currentBalance > 0 ? 'Facturas pendientes por cobrar' : 'Al día'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-neutral-500 font-medium">Crédito Disponible</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            ${Math.max(0, customer.availableCredit).toFixed(2)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Margen para nuevas compras
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
                        ${inv.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-medium">
                        ${(inv.receivable?.amountPaid ?? inv.totalAmount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                        ${(inv.receivable?.amountBalance ?? 0).toFixed(2)}
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
    </div>
  );
};
