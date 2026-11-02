import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  Layers,
  Filter,
  DollarSign,
  Printer,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyVES } from '@ero/shared';
import { downloadAccountingFile } from './accountingExportHelper';

interface TrialBalanceAccount {
  id: string;
  code: string;
  name: string;
  level: number;
  accountType: string;
  normalBalance: 'DEBIT' | 'CREDIT';
  acceptsPostings: boolean;
  initialDebit: number;
  initialCredit: number;
  initialBalance: number;
  periodDebit: number;
  periodCredit: number;
  finalDebit: number;
  finalCredit: number;
  finalBalance: number;
}

export const TrialBalanceView: React.FC = () => {
  const token = useAuthStore((s) => s.token);

  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [level, setLevel] = useState<number>(4);
  const [includeZeroBalance, setIncludeZeroBalance] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isBalanced, setIsBalanced] = useState(true);
  const [totals, setTotals] = useState<any>({
    totalInitialDebit: 0,
    totalInitialCredit: 0,
    totalPeriodDebit: 0,
    totalPeriodCredit: 0,
    totalFinalDebit: 0,
    totalFinalCredit: 0,
  });
  const [accounts, setAccounts] = useState<TrialBalanceAccount[]>([]);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    fetchTrialBalance();
  }, [startDate, endDate, level, includeZeroBalance]);

  const fetchTrialBalance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('level', String(level));
      params.append('includeZeroBalance', String(includeZeroBalance));

      const res = await fetch(`/api/accounting/trial-balance?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setIsBalanced(json.data.isBalanced);
          setTotals(json.data.totals);
          setAccounts(json.data.accounts);
        }
      }
    } catch {
      toast.error('Error al generar Balance de Comprobación');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExporting(format);
    const params = new URLSearchParams();
    params.set('format', format);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('level', String(level));
    params.set('includeZeroBalance', String(includeZeroBalance));

    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    await downloadAccountingFile(
      `/api/accounting/trial-balance?${params.toString()}`,
      `balance_comprobacion_${startDate || 'inicio'}_${endDate || 'fin'}.${ext}`,
      token
    );
    setExporting(null);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#007BFF] dark:text-[#3D91FF]" />
            Balance de Comprobación de Sumas y Saldos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Control obligatorio de cuadre numérico (Débitos = Créditos) y verificación previa al balance general
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setPdfModalOpen(true)}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg hover:border-[#007BFF] dark:hover:border-[#3D91FF]"
            title="Ver Balance de Comprobación en formato oficial PDF"
          >
            <FileText className="w-4 h-4 text-[#007BFF] dark:text-[#3D91FF]" />
            PDF
          </Button>

          <Button
            variant="outline"
            disabled={exporting !== null}
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg hover:border-[#28A745] dark:hover:border-[#4ADE80]"
            title="Exportar a Microsoft Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#28A745] dark:text-[#4ADE80]" />
            {exporting === 'xlsx' ? 'Generando...' : 'Excel'}
          </Button>

          <Button
            variant="outline"
            disabled={exporting !== null}
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg"
            title="Exportar archivo CSV con codificación UTF-8"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            {exporting === 'csv' ? 'Generando...' : 'CSV'}
          </Button>
        </div>
      </div>

      {/* Tarjeta de Estado de Cuadre */}
      <Card
        className={`p-4 rounded-lg border ${
          isBalanced
            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
            : 'bg-red-50/70 dark:bg-red-950/20 border-red-300 dark:border-red-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            {isBalanced ? (
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[#28A745] dark:text-[#4ADE80]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
            )}
            <div>
              <h2 className="font-bold text-sm text-[#333333] dark:text-[#E0E0E0]">
                {isBalanced
                  ? 'Balanza de Comprobación Cuadrada y Equilibrada Legalmente'
                  : 'Atención: Existen diferencias en la balanza de comprobación'}
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {isBalanced
                  ? 'La sumatoria total de cargos debitados coincide exactamente con los abonos acreditados del ejercicio.'
                  : 'Revise los comprobantes de diario para ubicar partidas con desbalance contable.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 font-mono text-xs">
            <div className="text-right">
              <span className="text-gray-500 block">Total Débitos:</span>
              <span className="font-bold text-[#007BFF] dark:text-[#3D91FF] text-sm">
                {formatMoneyVES(totals.totalPeriodDebit)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-500 block">Total Créditos:</span>
              <span className="font-bold text-[#007BFF] dark:text-[#3D91FF] text-sm">
                {formatMoneyVES(totals.totalPeriodCredit)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Barra de Filtros */}
      <Card className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Nivel de Profundidad
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-sm"
            >
              <option value={1}>Nivel 1 - Grupos (Activo, Pasivo, etc.)</option>
              <option value={2}>Nivel 2 - Subgrupos</option>
              <option value={3}>Nivel 3 - Rubros</option>
              <option value={4}>Nivel 4 - Cuentas de Mayor</option>
              <option value={5}>Nivel 5 - Todo el detalle analítico</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Fecha Desde
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Fecha Hasta
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg text-sm"
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeZeroBalance}
                onChange={(e) => setIncludeZeroBalance(e.target.checked)}
                className="rounded border-gray-300 text-[#007BFF] focus:ring-[#007BFF]"
              />
              <span>Mostrar cuentas sin saldo / movimiento</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Tabla de Sumas y Saldos */}
      <Card className="rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F4F6F9] dark:bg-[#18191A] uppercase font-semibold text-gray-600 dark:text-gray-400 sticky top-0 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4 w-32" rowSpan={2}>Código</th>
                <th className="py-3 px-4" rowSpan={2}>Nombre de la Cuenta</th>
                <th className="py-2 px-4 text-center border-b border-gray-200 dark:border-gray-700" colSpan={2}>
                  Movimientos del Período
                </th>
                <th className="py-2 px-4 text-center border-b border-gray-200 dark:border-gray-700" colSpan={2}>
                  Saldos Finales al Cierre
                </th>
              </tr>
              <tr>
                <th className="py-2 px-4 text-right w-36">Débitos (Debe)</th>
                <th className="py-2 px-4 text-right w-36">Créditos (Haber)</th>
                <th className="py-2 px-4 text-right w-36">Saldo Deudor</th>
                <th className="py-2 px-4 text-right w-36">Saldo Acreedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#242526]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    Calculando balance de sumas y saldos...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No existen saldos acumulados en las fechas seleccionadas.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const isTitle = acc.level <= 2;
                  const isDebitNormal = acc.normalBalance === 'DEBIT';
                  const finalDeudor = isDebitNormal && acc.finalBalance > 0 ? acc.finalBalance : 0;
                  const finalAcreedor = !isDebitNormal && acc.finalBalance > 0 ? acc.finalBalance : 0;

                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                        isTitle ? 'font-bold bg-gray-50/40 dark:bg-gray-800/20' : ''
                      }`}
                    >
                      <td className="py-2 px-4 whitespace-nowrap font-mono text-xs">
                        <span className={acc.acceptsPostings ? 'text-[#007BFF] dark:text-[#3D91FF]' : 'text-gray-600 dark:text-gray-300'}>
                          {acc.code}
                        </span>
                      </td>

                      <td className="py-2 px-4 text-[#333333] dark:text-[#E0E0E0]">
                        <span style={{ marginLeft: `${(acc.level - 1) * 0.75}rem` }}>
                          {acc.name}
                        </span>
                      </td>

                      <td className="py-2 px-4 text-right font-mono">
                        {acc.periodDebit > 0 ? `${formatMoneyVES(acc.periodDebit)}` : '-'}
                      </td>

                      <td className="py-2 px-4 text-right font-mono">
                        {acc.periodCredit > 0 ? `${formatMoneyVES(acc.periodCredit)}` : '-'}
                      </td>

                      <td className="py-2 px-4 text-right font-mono font-medium">
                        {finalDeudor > 0 ? `${formatMoneyVES(finalDeudor)}` : '-'}
                      </td>

                      <td className="py-2 px-4 text-right font-mono font-medium">
                        {finalAcreedor > 0 ? `${formatMoneyVES(finalAcreedor)}` : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-[#F4F6F9] dark:bg-[#18191A] font-bold text-xs border-t-2 border-gray-300 dark:border-gray-700">
              <tr>
                <td colSpan={2} className="py-3 px-4 text-right uppercase text-gray-700 dark:text-gray-300">
                  Sumas Iguales de Comprobación:
                </td>
                <td className="py-3 px-4 text-right font-mono text-[#007BFF] dark:text-[#3D91FF]">
                  {formatMoneyVES(totals.totalPeriodDebit)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-[#007BFF] dark:text-[#3D91FF]">
                  {formatMoneyVES(totals.totalPeriodCredit)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-[#28A745] dark:text-[#4ADE80]">
                  {formatMoneyVES(totals.totalFinalDebit)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-[#28A745] dark:text-[#4ADE80]">
                  {formatMoneyVES(totals.totalFinalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Visor PDF Oficial */}
      <PdfViewerModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title="Balance de Comprobación de Sumas y Saldos"
        subtitle={`Período oficial ${startDate} al ${endDate} (Nivel ${level})`}
        endpoint={`/api/accounting/trial-balance?format=pdf&startDate=${startDate}&endDate=${endDate}&level=${level}&includeZeroBalance=${includeZeroBalance}`}
        filename="balance_de_comprobacion.pdf"
      />
    </div>
  );
};
export default TrialBalanceView;

