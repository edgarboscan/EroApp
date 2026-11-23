import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore, isSuperAdminRole } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
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
  Landmark,
  Copy,
  Check,
  Smartphone,
  Clock,
  Send,
} from 'lucide-react';
import { formatMoneyUSD, formatMoneyVES } from '../../utils/formatters';

export const SupplierStatementView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, hasPermission, user } = useAuthStore();
  const canPay = hasPermission('payables', 'create') || hasPermission('treasury', 'create') || isSuperAdminRole(user?.role);

  const [statement, setStatement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchStatement = async () => {
    if (!id) return;
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

  const handleVerifyPayable = async (payableId: string) => {
    setVerifyingId(payableId);
    try {
      const res = await fetch(`/api/payables/${payableId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        toast.success('Factura verificada y enviada a Pagos por Procesar en Tesorería');
        await fetchStatement();
      } else {
        const err = await res.json();
        toast.error(err?.error?.message || 'Error al verificar la factura');
      }
    } catch {
      toast.error('Error de red al verificar la factura');
    } finally {
      setVerifyingId(null);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [id, token]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-neutral-300 dark:bg-neutral-800 rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-neutral-300/80 dark:bg-neutral-800 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-neutral-300/80 dark:bg-neutral-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!statement || !statement.supplier) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/suppliers')}
          className="inline-flex items-center text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Volver al Directorio de Proveedores
        </button>
        <Card className="p-12 text-center">
          <Truck className="w-12 h-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-3" />
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Sin información</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
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
            onClick={() => navigate("/suppliers")}
            className="inline-flex items-center text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Volver al Directorio de Proveedores
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {supplier?.name}
                </h1>
                <Badge variant={supplier?.isResident ? "success" : "neutral"}>
                  {supplier?.isResident ? "Domiciliado" : "No Dom."}
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                RIF: {supplier?.rif} |{" "}
                {supplier?.fiscalAddress || "Sin dirección fiscal"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/supplier-notes")}
            className="w-full sm:w-auto rounded-lg"
          >
            <FileText className="w-4 h-4 mr-1 text-sky-600" />
            Notas Crédito / Débito
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/payables/payments")}
            className="w-full sm:w-auto rounded-lg"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            Registrar Pago a Proveedor
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-[#EF4444] dark:border-l-[#F87171] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Deuda Total Pendiente
              </p>
              <p className="text-2xl font-bold font-mono text-[#EF4444] dark:text-[#F87171] mt-1">
                {formatMoneyUSD(supplier?.currentBalance || 0)}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#EF4444]/10 text-[#EF4444] dark:bg-[#F87171]/15 dark:text-[#F87171] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Límite de Crédito Otorgado
              </p>
              <p className="text-2xl font-bold font-mono text-[#007BFF] dark:text-[#3D91FF] mt-1">
                {formatMoneyUSD(supplier?.creditLimit || 0)}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#007BFF]/10 text-[#007BFF] dark:bg-[#3D91FF]/15 dark:text-[#3D91FF] flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-neutral-400 dark:border-l-neutral-600 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Plazo de Pago Acordado
              </p>
              <p className="text-2xl font-bold font-mono text-[#333333] dark:text-[#E0E0E0] mt-1">
                {supplier?.paymentTermsDays || 0} días
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-neutral-500/10 text-neutral-600 dark:bg-neutral-500/20 dark:text-neutral-300 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Facturas Registradas
              </p>
              <p className="text-2xl font-bold font-mono text-[#17A2B8] dark:text-[#38C9DD] mt-1">
                {invoices.length}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#17A2B8]/10 text-[#17A2B8] dark:bg-[#38C9DD]/15 dark:text-[#38C9DD] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
        </Card>
      </div>

      {/* Supplier Banking Information */}
      <Card className="border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200/80 dark:border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                Información Bancaria para Pagos
              </h2>
              <p className="text-[11px] text-neutral-500">
                Coordenadas registradas para transferencias, pago móvil y divisas
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/suppliers')}
            className="text-xs h-7 self-start sm:self-auto"
          >
            Editar en Directorio
          </Button>
        </div>

        {(!supplier?.bankName && !supplier?.accountNumber && !supplier?.pagoMovilPhone && !supplier?.zelleEmail) ? (
          <div className="p-6 text-center text-xs text-neutral-500">
            Este proveedor no tiene información bancaria registrada actualmente.
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Transferencia Bancaria */}
            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-sky-500" />
                  Cuenta Bancaria
                </span>
                {supplier.accountType && (
                  <Badge variant="neutral" className="text-[10px]">
                    {supplier.accountType === 'CURRENT'
                      ? 'Corriente'
                      : supplier.accountType === 'SAVINGS'
                      ? 'Ahorro'
                      : supplier.accountType === 'CUSTODY_USD'
                      ? 'Custodia USD'
                      : 'Internacional'}
                  </Badge>
                )}
              </div>

              {supplier.accountNumber ? (
                <>
                  <div className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">
                    {supplier.bankName || 'Banco Nacional'}
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-neutral-800 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <span className="font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200 tracking-wider">
                      {supplier.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(supplier.accountNumber, 'statement_acc')}
                      className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                      title="Copiar número de cuenta"
                    >
                      {copiedKey === 'statement_acc' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="text-[11px] text-neutral-500 space-y-0.5">
                    <div>Titular: <span className="font-medium text-neutral-700 dark:text-neutral-300">{supplier.accountHolderName || supplier.name}</span></div>
                    <div>RIF/CI: <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">{supplier.accountHolderId || supplier.rif}</span></div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-neutral-400 italic">No registrada</p>
              )}
            </div>

            {/* Pago Móvil */}
            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                Pago Móvil
              </span>

              {supplier.pagoMovilPhone ? (
                <>
                  <div className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">
                    {supplier.pagoMovilBank || supplier.bankName || 'Banco Nacional'}
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-neutral-800 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <span className="font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      {supplier.pagoMovilPhone}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(supplier.pagoMovilPhone, 'statement_pm')}
                      className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                      title="Copiar teléfono"
                    >
                      {copiedKey === 'statement_pm' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    C.I. / RIF: <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">{supplier.pagoMovilId || supplier.rif}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-neutral-400 italic">No registrado</p>
              )}
            </div>

            {/* Zelle o Divisas */}
            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-purple-500" />
                Zelle / Moneda Extranjera
              </span>

              {supplier.zelleEmail ? (
                <>
                  <div className="flex items-center justify-between bg-white dark:bg-neutral-800 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <span className="font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate pr-1">
                      {supplier.zelleEmail}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(supplier.zelleEmail, 'statement_zelle')}
                      className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer shrink-0"
                      title="Copiar correo Zelle"
                    >
                      {copiedKey === 'statement_zelle' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {supplier.zelleHolderName && (
                    <div className="text-[11px] text-neutral-500">
                      Titular: <span className="font-medium text-neutral-700 dark:text-neutral-300">{supplier.zelleHolderName}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-neutral-400 italic">No registrado</p>
              )}

              {supplier.bankNotes && (
                <div className="pt-1 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
                  <span className="font-medium text-neutral-600 dark:text-neutral-400">Nota:</span> {supplier.bankNotes}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Invoices List */}
      <Card className="border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            Historial de Facturas de Compra (CxP)
          </h2>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {invoices.length} documentos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 uppercase font-bold text-[11px] tracking-wider border-b border-neutral-300 dark:border-neutral-800 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Factura / Control</th>
                <th className="py-3 px-4">Emisión</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4 text-right">Total Factura</th>
                <th className="py-3 px-4 text-right">Amortizado</th>
                <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                <th className="py-3 px-4 text-center">Estatus</th>
                <th className="py-3 px-4 text-center">Verificación CxP</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800/80">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-neutral-600 dark:text-neutral-400 font-medium">
                    No existen facturas de compra registradas para este
                    proveedor.
                  </td>
                </tr>
              ) : (
                invoices.map((inv: any) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-xs text-neutral-700 dark:text-neutral-300 font-mono">
                        Ctrl: {inv.controlNumber || "S/C"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      {new Date(inv.invoiceDate).toLocaleDateString("es-VE")}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono font-medium text-neutral-800 dark:text-neutral-200">
                      {inv.dueDate
                        ? new Date(inv.dueDate).toLocaleDateString("es-VE")
                        : "-"}
                      {inv.daysOverdue > 0 && (
                        <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400">
                          {inv.daysOverdue} días vencido
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                      {formatMoneyUSD(inv.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold">
                      {formatMoneyUSD(inv.amountPaid)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono">
                      {inv.amountBalance > 0 ? (
                        <span className="text-rose-700 dark:text-rose-400">
                          {formatMoneyUSD(inv.amountBalance)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 text-xs">
                          Saldado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        variant={
                          inv.status === "PAID"
                            ? "success"
                            : inv.daysOverdue > 0
                              ? "danger"
                              : "warning"
                        }
                      >
                        {inv.status === "PAID"
                          ? "Pagado"
                          : inv.daysOverdue > 0
                            ? "Vencido"
                            : "Pendiente"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {inv.amountBalance <= 0 ? (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">-</span>
                      ) : inv.isVerified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          Verificada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                          Por Verificar
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {inv.amountBalance > 0 && inv.payableId && (
                        <div className="flex items-center justify-end gap-1.5">
                          {canPay ? (
                            <>
                              {!inv.isVerified && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVerifyPayable(inv.payableId)}
                                  disabled={verifyingId === inv.payableId}
                                  className="h-7 text-xs px-2"
                                  title="Verificar y enviar a Tesorería"
                                >
                                  <Send className="w-3 h-3 mr-1 text-sky-600" />
                                  {verifyingId === inv.payableId ? "..." : "Verificar"}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() =>
                                  navigate(
                                    `/payables/payments?payableId=${inv.payableId}`,
                                  )
                                }
                                className="h-7 text-xs px-2.5"
                              >
                                <DollarSign className="w-3.5 h-3.5 mr-1" />
                                Pagar
                              </Button>
                            </>
                          ) : (
                            <>
                              {!inv.isVerified ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleVerifyPayable(inv.payableId)}
                                  disabled={verifyingId === inv.payableId}
                                  className="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white"
                                >
                                  <Send className="w-3 h-3 mr-1" />
                                  {verifyingId === inv.payableId ? "Procesando..." : "Verificar Factura"}
                                </Button>
                              ) : (
                                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                  En Tesorería
                                </span>
                              )}
                            </>
                          )}
                        </div>
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
      <Card className="border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Historial de Pagos y Egresos Emitidos
          </h2>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {payments.length} transacciones
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 uppercase font-bold text-[11px] tracking-wider border-b border-neutral-300 dark:border-neutral-800 sticky top-0 z-10">
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
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800/80">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-neutral-600 dark:text-neutral-400 font-medium">
                    No se registran pagos realizados a este proveedor aún.
                  </td>
                </tr>
              ) : (
                payments.map((p: any) => (
                  <tr
                    key={p.id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      {new Date(p.createdAt).toLocaleDateString("es-VE")}{" "}
                      <span className="text-neutral-600 dark:text-neutral-400 font-mono text-[11px]">
                        {new Date(p.createdAt).toLocaleTimeString("es-VE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {p.invoiceNumber || "Abono General"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral">{p.method}</Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      {p.referenceNumber || "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                      {formatMoneyUSD(p.amountUsd)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-medium text-neutral-700 dark:text-neutral-300 font-mono">
                      {formatMoneyVES(p.amountVes)}
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-800 dark:text-neutral-200">
                      {p.notes || "-"}
                    </td>
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
