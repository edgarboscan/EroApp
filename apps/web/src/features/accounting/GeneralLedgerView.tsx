import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import {
  BookOpen,
  Search,
  Calendar,
  Layers,
  ArrowRightLeft,
  DollarSign,
  Filter,
  Download,
  Eye,
  ChevronDown,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyVES, formatMoneyUSD } from '@ero/shared';
import { useSearchParams } from 'react-router-dom';
import { downloadAccountingFile } from './accountingExportHelper';

interface LedgerMovement {
  id: string;
  entryId: string;
  entryNumber: string;
  entryDate: string;
  concept: string;
  description: string;
  referenceDoc: string | null;
  debitVes: number;
  creditVes: number;
  debitUsd: number;
  creditUsd: number;
  runningBalanceVes: number;
  runningBalanceUsd: number;
}

interface AccountLedger {
  account: {
    id: string;
    code: string;
    name: string;
    normalBalance: 'DEBIT' | 'CREDIT';
    accountType: string;
    classification: string;
  };
  initialBalanceVes: number;
  initialBalanceUsd: number;
  totalPeriodDebitVes: number;
  totalPeriodCreditVes: number;
  endingBalanceVes: number;
  endingBalanceUsd: number;
  movements: LedgerMovement[];
}

export const GeneralLedgerView: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const [searchParams] = useSearchParams();

  const [accountsList, setAccountsList] = useState<{ id: string; code: string; name: string }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(searchParams.get('accountId') || '');
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);

  const [ledgerData, setLedgerData] = useState<AccountLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    fetchAccountsCatalog();
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [selectedAccountId, startDate, endDate]);

  const fetchAccountsCatalog = async () => {
    try {
      const res = await fetch('/api/accounting/accounts?activeOnly=true', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const detailAccounts = json.data
            .filter((a: any) => a.acceptsPostings)
            .map((a: any) => ({ id: a.id, code: a.code, name: a.name }));
          setAccountsList(detailAccounts);
        }
      }
    } catch {
      // Ignorar fallas silenciosas
    }
  };

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedAccountId) params.append('accountId', selectedAccountId);

      const res = await fetch(`/api/accounting/ledger?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.accounts) {
          setLedgerData(json.data.accounts);
        }
      }
    } catch {
      toast.error('Error al consultar Libro Mayor analítico');
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const totalAccountsWithMovements = ledgerData.length;
  const totalDebits = ledgerData.reduce((s, a) => s + a.totalPeriodDebitVes, 0);
  const totalCredits = ledgerData.reduce((s, a) => s + a.totalPeriodCreditVes, 0);

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExporting(format);
    const params = new URLSearchParams();
    params.set('format', format);
    if (selectedAccountId) params.set('accountId', selectedAccountId);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    await downloadAccountingFile(
      `/api/accounting/ledger?${params.toString()}`,
      `libro_mayor_analitico_${startDate || 'inicio'}_${endDate || 'fin'}.${ext}`,
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
            <BookOpen className="w-6 h-6 text-[#007BFF] dark:text-[#3D91FF]" />
            Libro Mayor Analítico
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Resumen cronológico por cuenta contable con saldos iniciales, movimientos progresivos y acumulados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setPdfModalOpen(true)}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg hover:border-[#007BFF] dark:hover:border-[#3D91FF]"
            title="Ver Libro Mayor Analítico en formato oficial PDF"
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Cuentas con Movimiento</p>
              <h3 className="text-2xl font-bold text-[#333333] dark:text-[#E0E0E0] mt-1">{totalAccountsWithMovements}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-[#007BFF] dark:text-[#3D91FF]">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Total Débitos Período</p>
              <h3 className="text-xl font-bold font-mono text-[#333333] dark:text-[#E0E0E0] mt-1">
                {formatMoneyVES(totalDebits)}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-[#28A745] dark:text-[#4ADE80]">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-[#17A2B8] dark:border-l-[#38C9DD] rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Total Créditos Período</p>
              <h3 className="text-xl font-bold font-mono text-[#333333] dark:text-[#E0E0E0] mt-1">
                {formatMoneyVES(totalCredits)}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-[#17A2B8] dark:text-[#38C9DD]">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Filtrar por Cuenta Específica
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#242526] text-[#333333] dark:text-[#E0E0E0] rounded-lg text-sm"
            >
              <option value="">-- Todas las Cuentas del Mayor --</option>
              {accountsList.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name}
                </option>
              ))}
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
        </div>
      </Card>

      {/* Listado Analítico de Cuentas */}
      {loading ? (
        <Card className="p-8 text-center text-gray-500 rounded-lg border border-gray-200 dark:border-gray-800">
          Cargando movimientos analíticos del Libro Mayor...
        </Card>
      ) : ledgerData.length === 0 ? (
        <Card className="p-8 text-center text-gray-500 rounded-lg border border-gray-200 dark:border-gray-800">
          No existen movimientos contables en el rango de fechas seleccionado.
        </Card>
      ) : (
        <div className="space-y-6">
          {ledgerData.map((item) => {
            const isDebitNormal = item.account.normalBalance === 'DEBIT';

            return (
              <Card
                key={item.account.id}
                className="rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
              >
                {/* Cabecera de la Cuenta */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#007BFF] dark:text-[#3D91FF]">
                        {item.account.code}
                      </span>
                      <h2 className="font-bold text-base text-[#333333] dark:text-[#E0E0E0]">
                        {item.account.name}
                      </h2>
                      <Badge variant="neutral" className="text-xs">
                        Naturaleza: {isDebitNormal ? 'Deudora' : 'Acreedora'}
                      </Badge>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    Saldo Inicial al {startDate}:{' '}
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {formatMoneyVES(item.initialBalanceVes)}
                    </span>
                  </div>
                </div>

                {/* Tabla de Movimientos */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#F4F6F9] dark:bg-[#18191A] text-gray-600 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="py-2.5 px-4 w-28">Fecha</th>
                        <th className="py-2.5 px-4 w-32">Comprobante</th>
                        <th className="py-2.5 px-4">Concepto / Glosa</th>
                        <th className="py-2.5 px-4 w-28">Doc. Ref</th>
                        <th className="py-2.5 px-4 text-right w-32">Débito (VES)</th>
                        <th className="py-2.5 px-4 text-right w-32">Crédito (VES)</th>
                        <th className="py-2.5 px-4 text-right w-36">Saldo Acumulado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#242526]">
                      {item.movements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-gray-400">
                            Sin movimientos en el período (Mantiene saldo inicial).
                          </td>
                        </tr>
                      ) : (
                        item.movements.map((mov) => (
                          <tr key={mov.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="py-2 px-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                              {mov.entryDate}
                            </td>
                            <td className="py-2 px-4 whitespace-nowrap font-mono font-medium text-[#007BFF] dark:text-[#3D91FF]">
                              {mov.entryNumber}
                            </td>
                            <td className="py-2 px-4 text-[#333333] dark:text-[#E0E0E0]">
                              <span>{mov.description}</span>
                            </td>
                            <td className="py-2 px-4 font-mono text-gray-500 whitespace-nowrap">
                              {mov.referenceDoc || '-'}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-medium">
                              {mov.debitVes > 0 ? `${formatMoneyVES(mov.debitVes)}` : '-'}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-medium">
                              {mov.creditVes > 0 ? `${formatMoneyVES(mov.creditVes)}` : '-'}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                              {formatMoneyVES(mov.runningBalanceVes)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-[#F4F6F9] dark:bg-[#18191A] font-bold border-t border-gray-300 dark:border-gray-700">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-4 text-right uppercase text-gray-600 dark:text-gray-300">
                          Sumas del Período y Saldo Final al {endDate}:
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[#007BFF] dark:text-[#3D91FF]">
                          {formatMoneyVES(item.totalPeriodDebitVes)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[#007BFF] dark:text-[#3D91FF]">
                          {formatMoneyVES(item.totalPeriodCreditVes)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-base text-[#28A745] dark:text-[#4ADE80]">
                          {formatMoneyVES(item.endingBalanceVes)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Visor PDF Oficial */}
      <PdfViewerModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title="Libro Mayor Analítico de Contabilidad"
        subtitle={`Movimientos y Saldos Acumulados (${startDate} al ${endDate})`}
        endpoint={`/api/accounting/ledger?format=pdf&startDate=${startDate}&endDate=${endDate}${selectedAccountId ? `&accountId=${selectedAccountId}` : ''}`}
        filename="libro_mayor_analitico.pdf"
      />
    </div>
  );
};
export default GeneralLedgerView;
