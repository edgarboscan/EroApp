import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Search,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  TrendingDown,
  Clock,
  Truck,
  Building2,
} from 'lucide-react';
import { formatMoneyUSD } from '../../utils/formatters';

interface AgingItem {
  payableId: string;
  branchId: string;
  branchName: string;
  supplierId: string;
  supplierRif: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;
  amountTotal: number;
  amountPaid: number;
  amountBalance: number;
  currentDue: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
}


export const PayablesAgingView: React.FC = () => {
  const navigate = useNavigate();
  const { token, activeBranchId } = useAuthStore();
  const [items, setItems] = useState<AgingItem[]>([]);
  const [totals, setTotals] = useState({
    current: 0,
    days1_30: 0,
    days31_60: 0,
    days61_90: 0,
    days90Plus: 0,
    grandTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAging = async () => {
    setLoading(true);
    try {
      const branchParam = activeBranchId ? `?branchId=${activeBranchId}` : '';
      const res = await fetch(`/api/payables/aging${branchParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setItems(json.data.items || []);
        setTotals(
          json.data.totals || {
            current: 0,
            days1_30: 0,
            days31_60: 0,
            days61_90: 0,
            days90Plus: 0,
            grandTotal: 0,
          }
        );
      } else {
        setItems([]);
        setTotals({
          current: 0,
          days1_30: 0,
          days31_60: 0,
          days61_90: 0,
          days90Plus: 0,
          grandTotal: 0,
        });
      }
    } catch {
      setItems([]);
      setTotals({
        current: 0,
        days1_30: 0,
        days31_60: 0,
        days61_90: 0,
        days90Plus: 0,
        grandTotal: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAging();
  }, [activeBranchId]);

  const filteredItems = items.filter(
    (i) =>
      i.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      i.supplierRif.toLowerCase().includes(search.toLowerCase()) ||
      i.invoiceNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            <Clock className="w-5 h-5 text-sky-600" />
            Antigüedad de Saldos a Proveedores (CxP)
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Monitoreo y programación de pagos comerciales según tramos de vencimiento
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/suppliers')}
            className="flex-1 sm:flex-none"
          >
            <Truck className="w-4 h-4 mr-1 text-neutral-600" />
            Directorio Proveedores
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/supplier-notes')}
            className="flex-1 sm:flex-none"
          >
            <FileText className="w-4 h-4 mr-1 text-sky-600" />
            Notas Crédito / Débito
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/payables/payments')}
            className="flex-1 sm:flex-none"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            Emitir Pago
          </Button>
        </div>
      </div>

      {/* 6  Buckets KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 border-l-4 border-l-neutral-500  bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Total Deuda CxP
          </p>
          <p className="text-lg font-bold text-neutral-900 mt-1 font-mono">
            {formatMoneyUSD(totals.grandTotal)}
          </p>
          <span className="text-[10px] text-neutral-400">Compromisos vigentes</span>
        </Card>

        <Card className="p-3 border-l-4 border-l-emerald-600  bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-emerald-200 dark:border-emerald-600">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
            Corriente (Al Día)
          </p>
          <p className="text-lg font-bold text-emerald-700 mt-1 font-mono">
            {formatMoneyUSD(totals.current)}
          </p>
          <span className="text-[10px] text-neutral-400">Por vencer</span>
        </Card>

        <Card className="p-3 border-l-4 border-l-amber-600  bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-amber-200 dark:border-amber-600 ">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
            1 - 30 Días
          </p>
          <p className="text-lg font-bold text-amber-700 mt-1 font-mono">
            {formatMoneyUSD(totals.days1_30)}
          </p>
          <span className="text-[10px] text-neutral-400">Vencimiento reciente</span>
        </Card>

        <Card className="p-3 border-l-4 border-l-orange-600  bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-orange-200 dark:border-orange-600 ">
          <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
            31 - 60 Días
          </p>
          <p className="text-lg font-bold text-orange-700 mt-1 font-mono">
            {formatMoneyUSD(totals.days31_60)}
          </p>
          <span className="text-[10px] text-neutral-400">Mora moderada</span>
        </Card>

        <Card className="p-3 border-l-4 border-l-red-600  bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-red-200 dark:border-red-600 ">
          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">
            61 - 90 Días
          </p>
          <p className="text-lg font-bold text-red-700 mt-1 font-mono">
            {formatMoneyUSD(totals.days61_90)}
          </p>
          <span className="text-[10px] text-neutral-400">Mora crítica</span>
        </Card>

        <Card className="p-3 border-l-4 border-l-red-600  bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg border border-red-200 dark:border-red-800 ">
          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">
            + 90 Días
          </p>
          <p className="text-lg font-bold text-red-700 mt-1 font-mono">
            {formatMoneyUSD(totals.days90Plus)}
          </p>
          <span className="text-[10px] text-red-500 font-semibold">Excedida</span>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar proveedor o factura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2  text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <span className="text-xs text-neutral-500">
            Mostrando {filteredItems.length} cuentas por pagar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase  tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">Factura Compra</th>
                <th className="py-3 px-4">Emisión</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4 text-center">Estado Mora</th>
                <th className="py-3 px-4 text-right">Total Factura</th>
                <th className="py-3 px-4 text-right">Amortizado</th>
                <th className="py-3 px-4 text-right">Saldo Deudor</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 ">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-600 animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-4 bg-neutral-200 rounded w-36 mb-1" />
                      <div className="h-3 bg-neutral-100 rounded w-20" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-neutral-200 rounded w-24" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-neutral-200 rounded w-20" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-neutral-200 rounded w-20" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-5 bg-neutral-200 rounded w-16 mx-auto" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-4 bg-neutral-200 rounded w-16 ml-auto" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-4 bg-neutral-200 rounded w-16 ml-auto" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-4 bg-neutral-200 rounded w-16 ml-auto" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-7 bg-neutral-200 rounded w-20 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-neutral-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-neutral-400" />
                    <p className="font-medium text-neutral-700">
                      No hay cuentas por pagar con saldo pendiente
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Todas las obligaciones comerciales se encuentran solventes.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.payableId} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-900">{item.supplierName}</div>
                      <div className="text-xs text-neutral-500 font-mono mt-0.5">
                        {item.supplierRif}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-neutral-900">
                      {item.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-600">
                      {new Date(item.invoiceDate).toLocaleDateString('es-VE')}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono">
                      {new Date(item.dueDate).toLocaleDateString('es-VE')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.daysOverdue <= 0 ? (
                        <Badge variant="success">Corriente</Badge>
                      ) : item.daysOverdue <= 30 ? (
                        <Badge variant="warning">{item.daysOverdue} d mora</Badge>
                      ) : (
                        <Badge variant="danger">{item.daysOverdue} d mora</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium font-mono text-neutral-900">
                      {formatMoneyUSD(item.amountTotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-emerald-600">
                      {formatMoneyUSD(item.amountPaid)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono text-red-600">
                      {formatMoneyUSD(item.amountBalance)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate(`/payables/payments?payableId=${item.payableId}`)
                        }
                        className="h-8 text-xs"
                      >
                        Pagar
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
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
