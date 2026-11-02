import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { toast } from "sonner";
import {
  CreditCard,
  Search,
  Filter,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  TrendingDown,
  Clock,
} from "lucide-react";
import { formatMoneyUSD } from "@ero/shared";

interface AgingItem {
  receivableId: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerDoc: string;
  customerName: string;
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

export const ReceivablesAgingView: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);

  const [items, setItems] = useState<AgingItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAging = async () => {
      setIsLoading(true);
      try {
        const url = activeBranchId
          ? `/api/receivables/aging?branchId=${activeBranchId}`
          : "/api/receivables/aging";
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json();
        if (json.success && json.data && Array.isArray(json.data.items)) {
          setItems(json.data.items);
        } else {
          setItems([]);
        }
      } catch {
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAging();
  }, [activeBranchId, token]);

  const filteredItems = items.filter(
    (it) =>
      it.customerName.toLowerCase().includes(search.toLowerCase()) ||
      it.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      it.customerDoc.includes(search),
  );

  // Totales
  const grandTotal = items.reduce((acc, it) => acc + it.amountBalance, 0);
  const currentTotal = items.reduce((acc, it) => acc + it.currentDue, 0);
  const days1_30Total = items.reduce((acc, it) => acc + it.days1_30, 0);
  const days31_60Total = items.reduce((acc, it) => acc + it.days31_60, 0);
  const days61_90Total = items.reduce((acc, it) => acc + it.days61_90, 0);
  const days90PlusTotal = items.reduce((acc, it) => acc + it.days90Plus, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Cuentas por Cobrar & Antigüedad de Saldos
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Monitoreo de cartera de crédito, vencimientos y morosidad de
            clientes
          </p>
        </div>

        <Button onClick={() => navigate("/receivables/collections")}>
          <CreditCard className="w-4 h-4 mr-1.5" />
          Registrar Cobranza
        </Button>
      </div>

      {/* Grid de Baldes de Vencimiento (Buckets) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block uppercase tracking-wider">
            Total Cartera
          </span>
          <div className="text-lg font-bold font-mono text-[#007BFF] dark:text-[#3D91FF] mt-1">
            {formatMoneyUSD(grandTotal)}
          </div>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5 block">
            {items.length} facturas
          </span>
        </Card>

        <Card className="p-3 border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block uppercase tracking-wider">
            Corriente
          </span>
          <div className="text-lg font-bold font-mono text-[#28A745] dark:text-[#4ADE80] mt-1">
            {formatMoneyUSD(currentTotal)}
          </div>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 block">
            No vencidas
          </span>
        </Card>

        <Card className="p-3 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block uppercase tracking-wider">
            1 a 30 Días
          </span>
          <div className="text-lg font-bold font-mono text-[#17A2B8] dark:text-[#38C9DD] mt-1">
            {formatMoneyUSD(days1_30Total)}
          </div>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 block">
            Mora leve
          </span>
        </Card>

        <Card className="p-3 border-l-4 border-l-[#FFC107] dark:border-l-[#FBBF24] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block uppercase tracking-wider">
            31 a 60 Días
          </span>
          <div className="text-lg font-bold font-mono text-[#b28500] dark:text-[#FBBF24] mt-1">
            {formatMoneyUSD(days31_60Total)}
          </div>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 block">
            Mora media
          </span>
        </Card>

        <Card className="p-3 border-l-4 border-l-orange-500 dark:border-l-orange-400 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block uppercase tracking-wider">
            61 a 90 Días
          </span>
          <div className="text-lg font-bold font-mono text-orange-600 dark:text-orange-400 mt-1">
            {formatMoneyUSD(days61_90Total)}
          </div>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 block">
            Mora alta
          </span>
        </Card>

        <Card className="p-3 border-l-4 border-l-[#EF4444] dark:border-l-[#F87171] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block uppercase tracking-wider">
            +90 Días
          </span>
          <div className="text-lg font-bold font-mono text-[#EF4444] dark:text-[#F87171] mt-1">
            {formatMoneyUSD(days90PlusTotal)}
          </div>
          <span className="text-[10px] text-[#EF4444] dark:text-[#F87171] font-semibold mt-0.5 block">
            Crítico
          </span>
        </Card>
      </div>

      {/* Buscador y Tabla */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar cliente, RIF o número de factura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {filteredItems.length} cuenta(s) pendiente(s)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-[#F4F6F9] dark:bg-[#18191A] text-neutral-700 dark:text-neutral-300 uppercase font-semibold text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Cliente / RIF</th>
                <th className="py-3 px-4">Factura</th>
                <th className="py-3 px-4">Emisión</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4 text-center">Días Mora</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Saldo Deudor</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-neutral-100 dark:border-neutral-800
 animate-pulse"
                  >
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-40" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-20" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-20" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-12 mx-auto" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-16 ml-auto" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-16 ml-auto" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-16 mx-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-neutral-400 dark:text-neutral-500"
                  >
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
                    <p className="text-xs">
                      No se registran cuentas por cobrar pendientes
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((it) => {
                  const isOverdue = it.daysOverdue > 0;
                  return (
                    <tr
                      key={it.receivableId}
                      className="hover:bg-[#F4F6F9]/80 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {it.customerName}
                        </div>
                        <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                          {it.customerDoc}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#007BFF] dark:text-[#3D91FF]">
                        {it.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                        {new Date(it.invoiceDate).toLocaleDateString("es-VE")}
                      </td>
                      <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                        {new Date(it.dueDate).toLocaleDateString("es-VE")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOverdue ? (
                          <Badge
                            variant={it.daysOverdue > 60 ? "danger" : "warning"}
                          >
                            +{it.daysOverdue} d
                          </Badge>
                        ) : (
                          <Badge variant="success">Al día</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-neutral-600 dark:text-neutral-400 font-mono">
                        {formatMoneyUSD(it.amountTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                        {formatMoneyUSD(it.amountBalance)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate("/receivables/collections", {
                              state: { selectedReceivableId: it.receivableId },
                            })
                          }
                        >
                          Cobrar
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
