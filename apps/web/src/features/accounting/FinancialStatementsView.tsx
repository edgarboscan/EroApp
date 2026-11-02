import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import {
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Download,
  Printer,
  TrendingUp,
  DollarSign,
  Layers,
  ArrowRightLeft,
  SlidersHorizontal,
  Info,
  Scale,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyVES } from '@ero/shared';
import { downloadAccountingFile } from './accountingExportHelper';

type StatementTab = 'balance-sheet' | 'income-statement' | 'cash-flow' | 'equity-changes' | 'notes';

export const FinancialStatementsView: React.FC = () => {
  const token = useAuthStore((s) => s.token);

  const [activeTab, setActiveTab] = useState<StatementTab>('balance-sheet');
  const [asOfDate, setAsOfDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [isReexpressed, setIsReexpressed] = useState(false); // VEN-NIF B-10

  const [loading, setLoading] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [incomeStatement, setIncomeStatement] = useState<any>(null);
  const [cashFlow, setCashFlow] = useState<any>(null);
  const [equityChanges, setEquityChanges] = useState<any>(null);
  const [notes, setNotes] = useState<any>(null);

  useEffect(() => {
    fetchCurrentStatement();
  }, [activeTab, asOfDate, startDate, endDate, isReexpressed]);

  const fetchCurrentStatement = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('asOfDate', asOfDate);
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      params.append('isReexpressed', String(isReexpressed));

      const res = await fetch(`/api/accounting/financial-statements/${activeTab}?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          if (activeTab === 'balance-sheet') setBalanceSheet(json.data);
          else if (activeTab === 'income-statement') setIncomeStatement(json.data);
          else if (activeTab === 'cash-flow') setCashFlow(json.data);
          else if (activeTab === 'equity-changes') setEquityChanges(json.data);
          else if (activeTab === 'notes') setNotes(json.data);
        }
      }
    } catch {
      toast.error('Error al cargar estado financiero');
    } finally {
      setLoading(false);
    }
  };

  const getStatementInfo = () => {
    switch (activeTab) {
      case 'balance-sheet':
        return {
          title: 'Estado de Situación Financiera (Balance General)',
          subtitle: `Al ${asOfDate} - Normativa VEN-NIF (FCCPV) y Código de Comercio`,
          filenameBase: `estado_situacion_financiera_${asOfDate}`,
        };
      case 'income-statement':
        return {
          title: 'Estado de Resultados Integral (Ganancias y Pérdidas)',
          subtitle: `Del ${startDate} al ${endDate} - Normativa VEN-NIF (FCCPV)`,
          filenameBase: `estado_resultados_${startDate}_${endDate}`,
        };
      case 'cash-flow':
        return {
          title: 'Estado de Flujos de Efectivo',
          subtitle: `Del ${startDate} al ${endDate} - Método Indirecto (Normativa VEN-NIF)`,
          filenameBase: `flujos_de_efectivo_${startDate}_${endDate}`,
        };
      case 'equity-changes':
        return {
          title: 'Estado de Cambios en el Patrimonio Neto',
          subtitle: `Al ${asOfDate} - Normativa VEN-NIF y Código de Comercio`,
          filenameBase: `cambios_en_patrimonio_${asOfDate}`,
        };
      case 'notes':
        return {
          title: 'Notas Revelatorias a los Estados Financieros',
          subtitle: `Normativa VEN-NIF (FCCPV) - Ejercicio al ${asOfDate}`,
          filenameBase: `notas_estados_financieros_${asOfDate}`,
        };
    }
  };

  const buildStatementQuery = (format: string) => {
    const params = new URLSearchParams();
    params.set('format', format);
    params.set('asOfDate', asOfDate);
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    params.set('isReexpressed', String(isReexpressed));
    return `/api/accounting/financial-statements/${activeTab}?${params.toString()}`;
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExporting(format);
    const info = getStatementInfo();
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    await downloadAccountingFile(
      buildStatementQuery(format),
      `${info.filenameBase}.${ext}`,
      token
    );
    setExporting(null);
  };

  const currentInfo = getStatementInfo();

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#333333] dark:text-[#E0E0E0] flex items-center gap-2">
            <Scale className="w-6 h-6 text-[#007BFF] dark:text-[#3D91FF]" />
            Estados Financieros bajo VEN-NIF / NIIF
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 break-words max-w-[450px]">
            Presentación legal conforme a la Federación de Colegios de
            Contadores Públicos de Venezuela y Código de Comercio
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setPdfModalOpen(true)}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg hover:border-[#007BFF] dark:hover:border-[#3D91FF]"
            title="Ver reporte oficial con firmas en formato PDF"
          >
            <FileText className="w-4 h-4 text-[#007BFF] dark:text-[#3D91FF]" />
            PDF
          </Button>

          <Button
            variant="outline"
            disabled={exporting !== null}
            onClick={() => handleExport("xlsx")}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg hover:border-[#28A745] dark:hover:border-[#4ADE80]"
            title="Exportar a Microsoft Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#28A745] dark:text-[#4ADE80]" />
            {exporting === "xlsx" ? "Generando..." : "Excel"}
          </Button>

          <Button
            variant="outline"
            disabled={exporting !== null}
            onClick={() => handleExport("csv")}
            className="flex items-center gap-2 border-gray-300 dark:border-gray-700 rounded-lg"
            title="Exportar archivo CSV con codificación UTF-8"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            {exporting === "csv" ? "Generando..." : "CSV"}
          </Button>
        </div>
      </div>

      {/* Pestañas de Navegación de Estados Financieros */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab("balance-sheet")}
          className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "balance-sheet"
              ? "border-[#007BFF] text-[#007BFF] dark:border-[#3D91FF] dark:text-[#3D91FF]"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          1. Estado de Situación Financiera
        </button>

        <button
          onClick={() => setActiveTab("income-statement")}
          className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "income-statement"
              ? "border-[#007BFF] text-[#007BFF] dark:border-[#3D91FF] dark:text-[#3D91FF]"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          2. Estado de Resultados Integral
        </button>

        <button
          onClick={() => setActiveTab("cash-flow")}
          className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "cash-flow"
              ? "border-[#007BFF] text-[#007BFF] dark:border-[#3D91FF] dark:text-[#3D91FF]"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          3. Flujos de Efectivo
        </button>

        <button
          onClick={() => setActiveTab("equity-changes")}
          className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "equity-changes"
              ? "border-[#007BFF] text-[#007BFF] dark:border-[#3D91FF] dark:text-[#3D91FF]"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          4. Cambios en el Patrimonio
        </button>

        <button
          onClick={() => setActiveTab("notes")}
          className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "notes"
              ? "border-[#007BFF] text-[#007BFF] dark:border-[#3D91FF] dark:text-[#3D91FF]"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          5. Notas a los Estados Financieros
        </button>
      </div>

      {/* Barra de Filtros y Configuración */}
      <Card className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {activeTab === "balance-sheet" ? (
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Fecha de Corte (Balance)
                </label>
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="rounded-lg text-sm w-44"
                />
              </div>
            ) : (
              <div className="flex gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Fecha Desde
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-lg text-sm w-40"
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
                    className="rounded-lg text-sm w-40"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Selector de Reexpresión por Inflación VEN-NIF B-10 */}
          <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-800">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Método de Presentación:
            </span>
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setIsReexpressed(false)}
                className={`px-3 py-1.5 transition-colors font-medium ${
                  !isReexpressed
                    ? "bg-[#007BFF] text-white"
                    : "bg-white dark:bg-[#242526] text-gray-600 dark:text-gray-400 hover:bg-gray-100"
                }`}
              >
                Valores Históricos (Nominales)
              </button>
              <button
                type="button"
                onClick={() => setIsReexpressed(true)}
                className={`px-3 py-1.5 transition-colors font-medium ${
                  isReexpressed
                    ? "bg-[#007BFF] text-white"
                    : "bg-white dark:bg-[#242526] text-gray-600 dark:text-gray-400 hover:bg-gray-100"
                }`}
              >
                Reexpresado (VEN-NIF B-10 / INPC)
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Contenido según Pestaña */}
      {loading ? (
        <Card className="p-8 text-center text-gray-500 rounded-lg border border-gray-200 dark:border-gray-800">
          Generando y estructurando estados financieros...
        </Card>
      ) : activeTab === "balance-sheet" && balanceSheet ? (
        <div className="space-y-6">
          {/* Ecuación Fundamental Check */}
          <Card
            className={`p-4 rounded-lg border ${
              balanceSheet.isBalanced
                ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                : "bg-red-50/70 dark:bg-red-950/20 border-red-300 dark:border-red-800"
            }`}
          >
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#28A745] dark:text-[#4ADE80]" />
                <span className="font-bold text-[#333333] dark:text-[#E0E0E0] text-sm">
                  Ecuación Patrimonial Fundamental Cuadrada: Activo = Pasivo +
                  Patrimonio
                </span>
              </div>
              <div className="font-mono text-xs flex gap-6">
                <span>
                  Total Activo:{" "}
                  <b>{formatMoneyVES(balanceSheet.totalAssets)}</b>
                </span>
                <span>
                  Total Pasivo + Patr.:{" "}
                  <b>
                    {formatMoneyVES(balanceSheet.totalLiabilitiesAndEquity)}
                  </b>
                </span>
              </div>
            </div>
          </Card>

          {/* Grilla Doble Columna (Activo a la Izquierda / Pasivo y Patrimonio a la Derecha) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna ACTIVO */}
            <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <h2 className="text-base font-bold uppercase tracking-wide border-b border-gray-200 dark:border-gray-800 pb-2 text-[#007BFF] dark:text-[#3D91FF]">
                1. ACTIVO
              </h2>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-xs uppercase text-gray-600 dark:text-gray-300">
                    1.1 ACTIVO CORRIENTE
                  </h3>
                  <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                    {balanceSheet.currentAssets.map((acc: any) => (
                      <div key={acc.id} className="flex justify-between py-1.5">
                        <span className="text-gray-700 dark:text-gray-300">
                          {acc.name}
                        </span>
                        <span className="font-mono font-medium">
                          {formatMoneyVES(acc.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 font-bold text-xs text-gray-800 dark:text-gray-100">
                    <span>Total Activo Corriente:</span>
                    <span className="font-mono">
                      {formatMoneyVES(balanceSheet.totalCurrentAssets)}
                    </span>
                  </div>
                </div>

                <div className="pt-3">
                  <h3 className="font-semibold text-xs uppercase text-gray-600 dark:text-gray-300">
                    1.2 ACTIVO NO CORRIENTE
                  </h3>
                  <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                    {balanceSheet.nonCurrentAssets.map((acc: any) => (
                      <div key={acc.id} className="flex justify-between py-1.5">
                        <span className="text-gray-700 dark:text-gray-300">
                          {acc.name}
                        </span>
                        <span className="font-mono font-medium">
                          {formatMoneyVES(acc.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 font-bold text-xs text-gray-800 dark:text-gray-100">
                    <span>Total Activo No Corriente:</span>
                    <span className="font-mono">
                      {formatMoneyVES(balanceSheet.totalNonCurrentAssets)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-gray-300 dark:border-gray-700 flex justify-between font-bold text-sm text-[#007BFF] dark:text-[#3D91FF]">
                <span>TOTAL ACTIVO:</span>
                <span className="font-mono">
                  {formatMoneyVES(balanceSheet.totalAssets)}
                </span>
              </div>
            </Card>

            {/* Columna PASIVO Y PATRIMONIO */}
            <div className="space-y-6">
              {/* PASIVO */}
              <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h2 className="text-base font-bold uppercase tracking-wide border-b border-gray-200 dark:border-gray-800 pb-2 text-[#FFC107] dark:text-[#FBBF24]">
                  2. PASIVO
                </h2>

                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-xs uppercase text-gray-600 dark:text-gray-300">
                      2.1 PASIVO CORRIENTE (Corto Plazo)
                    </h3>
                    <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                      {balanceSheet.currentLiabilities.map((acc: any) => (
                        <div
                          key={acc.id}
                          className="flex justify-between py-1.5"
                        >
                          <span className="text-gray-700 dark:text-gray-300">
                            {acc.name}
                          </span>
                          <span className="font-mono font-medium">
                            {formatMoneyVES(acc.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 font-bold text-xs">
                      <span>Total Pasivo Corriente:</span>
                      <span className="font-mono">
                        {formatMoneyVES(balanceSheet.totalCurrentLiabilities)}
                      </span>
                    </div>
                  </div>

                  {balanceSheet.nonCurrentLiabilities.length > 0 && (
                    <div className="pt-2">
                      <h3 className="font-semibold text-xs uppercase text-gray-600 dark:text-gray-300">
                        2.2 PASIVO NO CORRIENTE (Largo Plazo)
                      </h3>
                      <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                        {balanceSheet.nonCurrentLiabilities.map((acc: any) => (
                          <div
                            key={acc.id}
                            className="flex justify-between py-1.5"
                          >
                            <span className="text-gray-700 dark:text-gray-300">
                              {acc.name}
                            </span>
                            <span className="font-mono font-medium">
                              {formatMoneyVES(acc.balance)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold text-xs text-gray-800 dark:text-gray-100">
                    <span>TOTAL PASIVO:</span>
                    <span className="font-mono">
                      {formatMoneyVES(balanceSheet.totalLiabilities)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* PATRIMONIO */}
              <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h2 className="text-base font-bold uppercase tracking-wide border-b border-gray-200 dark:border-gray-800 pb-2 text-[#28A745] dark:text-[#4ADE80]">
                  3. PATRIMONIO NETO
                </h2>

                <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {balanceSheet.equityAccounts.map((acc: any) => (
                    <div key={acc.id} className="flex justify-between py-1.5">
                      <span className="text-gray-700 dark:text-gray-300">
                        {acc.name}
                      </span>
                      <span className="font-mono font-medium">
                        {formatMoneyVES(acc.balance)}
                      </span>
                    </div>
                  ))}

                  <div className="flex justify-between py-1.5 font-semibold text-[#007BFF] dark:text-[#3D91FF]">
                    <span>Resultado Neto del Ejercicio en Curso</span>
                    <span className="font-mono">
                      {formatMoneyVES(balanceSheet.currentPeriodNetIncome)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold text-xs text-gray-800 dark:text-gray-100">
                  <span>TOTAL PATRIMONIO:</span>
                  <span className="font-mono">
                    {formatMoneyVES(balanceSheet.totalEquity)}
                  </span>
                </div>

                <div className="pt-3 border-t-2 border-gray-300 dark:border-gray-700 flex justify-between font-bold text-sm text-[#333333] dark:text-[#E0E0E0]">
                  <span>TOTAL PASIVO Y PATRIMONIO:</span>
                  <span className="font-mono">
                    {formatMoneyVES(balanceSheet.totalLiabilitiesAndEquity)}
                  </span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : activeTab === "income-statement" && incomeStatement ? (
        <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm max-w-3xl mx-auto space-y-4">
          <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-bold text-[#333333] dark:text-[#E0E0E0]">
              Estado de Resultados Integral (Ganancias y Pérdidas)
            </h2>
            <p className="text-xs text-gray-500">
              Período comprendido desde {incomeStatement.startDate} hasta{" "}
              {incomeStatement.endDate}
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs space-y-2">
            {/* Ingresos */}
            <div className="pt-2">
              <div className="flex justify-between font-bold text-xs uppercase text-gray-700 dark:text-gray-300">
                <span>Ingresos Operacionales de Ventas:</span>
                <span className="font-mono text-[#007BFF] dark:text-[#3D91FF]">
                  {formatMoneyVES(incomeStatement.totalRevenue)}
                </span>
              </div>
            </div>

            {/* Costo de Ventas */}
            <div className="pt-2">
              <div className="flex justify-between font-bold text-xs uppercase text-gray-700 dark:text-gray-300">
                <span>Menos: Costo de Mercancía Vendida:</span>
                <span className="font-mono text-red-500">
                  ({formatMoneyVES(incomeStatement.totalCostOfSales)})
                </span>
              </div>
            </div>

            {/* Utilidad Bruta */}
            <div className="pt-3 pb-2 bg-gray-50/50 dark:bg-gray-800/30 px-3 rounded-lg flex justify-between font-bold text-sm text-[#28A745] dark:text-[#4ADE80]">
              <span>UTILIDAD BRUTA EN VENTAS:</span>
              <span className="font-mono">
                {formatMoneyVES(incomeStatement.grossProfit)}
              </span>
            </div>

            {/* Gastos Operacionales */}
            <div className="pt-3">
              <div className="flex justify-between font-bold text-xs uppercase text-gray-700 dark:text-gray-300">
                <span>
                  Menos: Gastos Operacionales (Administración y Ventas):
                </span>
                <span className="font-mono text-red-500">
                  ({formatMoneyVES(incomeStatement.totalOperatingExpenses)})
                </span>
              </div>
            </div>

            {/* Utilidad Operativa */}
            <div className="pt-3 pb-2 bg-gray-50/50 dark:bg-gray-800/30 px-3 rounded-lg flex justify-between font-bold text-sm text-gray-800 dark:text-gray-100">
              <span>UTILIDAD OPERATIVA:</span>
              <span className="font-mono">
                {formatMoneyVES(incomeStatement.operatingProfit)}
              </span>
            </div>

            {/* Resultados Financieros y Cambiarios */}
            <div className="pt-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>Ingresos Financieros / Ganancia Cambiaria:</span>
                <span className="font-mono">
                  {formatMoneyVES(incomeStatement.totalFinancialRevenue)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>Gastos Financieros / Pérdida Cambiaria / IGTF:</span>
                <span className="font-mono text-red-500">
                  ({formatMoneyVES(incomeStatement.totalFinancialExpenses)})
                </span>
              </div>
            </div>

            {/* Utilidad Antes de Impuestos */}
            <div className="pt-3 flex justify-between font-bold text-xs">
              <span>UTILIDAD ANTES DE IMPUESTOS:</span>
              <span className="font-mono">
                {formatMoneyVES(incomeStatement.netIncomeBeforeTaxes)}
              </span>
            </div>

            {/* Estimación ISLR */}
            <div className="pt-2 flex justify-between text-xs text-gray-500">
              <span>Provisión Estimada Impuesto Sobre la Renta (ISLR):</span>
              <span className="font-mono text-red-500">
                ({formatMoneyVES(incomeStatement.estimatedIslr)})
              </span>
            </div>

            {/* Utilidad Neta del Ejercicio */}
            <div className="pt-4 pb-2 bg-blue-50/60 dark:bg-blue-950/30 px-4 rounded-lg flex justify-between font-bold text-base text-[#007BFF] dark:text-[#3D91FF] border border-blue-200 dark:border-blue-800">
              <span>UTILIDAD / GANANCIA NETA DEL EJERCICIO:</span>
              <span className="font-mono">
                {formatMoneyVES(incomeStatement.netIncome)}
              </span>
            </div>
          </div>
        </Card>
      ) : activeTab === "cash-flow" && cashFlow ? (
        <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm max-w-3xl mx-auto space-y-4 text-xs">
          <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-bold text-[#333333] dark:text-[#E0E0E0]">
              Estado de Flujos de Efectivo (Método Indirecto NIIF / VEN-NIF)
            </h2>
            <p className="text-xs text-gray-500">
              Del {cashFlow.startDate} al {cashFlow.endDate}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-xs uppercase text-gray-700 dark:text-gray-300 pb-1 border-b border-gray-200 dark:border-gray-700">
                1. Actividades de Operación
              </h3>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between py-1">
                  <span>Ganancia / Utilidad Neta del Ejercicio</span>
                  <span className="font-mono">
                    {formatMoneyVES(cashFlow.operatingActivities.netIncome)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Ajuste por depreciación y partidas no monetarias</span>
                  <span className="font-mono">
                    {formatMoneyVES(
                      cashFlow.operatingActivities.depreciationAdjustment,
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-1 font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span>Flujo Neto Proveniente de Operaciones:</span>
                  <span className="font-mono text-[#28A745]">
                    {formatMoneyVES(
                      cashFlow.operatingActivities.operatingCashFlow,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-xs uppercase text-gray-700 dark:text-gray-300 pb-1 border-b border-gray-200 dark:border-gray-700">
                2. Actividades de Inversión y Financiamiento
              </h3>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between py-1 text-gray-500">
                  <span>
                    Adquisición de Activos Fijos y Pagos de Pasivos Financieros
                  </span>
                  <span className="font-mono">Bs. 0,00</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="font-sans">
                  Saldo de Efectivo y Bancos al Inicio:
                </span>
                <span className="font-bold">
                  {formatMoneyVES(cashFlow.initialCash)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans">
                  Aumento Neto de Efectivo en el Período:
                </span>
                <span className="font-bold text-[#007BFF] dark:text-[#3D91FF]">
                  {formatMoneyVES(cashFlow.netCashIncrease)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-300 dark:border-gray-700 text-sm font-bold text-[#28A745] dark:text-[#4ADE80]">
                <span className="font-sans">
                  Disponibilidad en Caja y Bancos al Cierre:
                </span>
                <span>{formatMoneyVES(cashFlow.finalCash)}</span>
              </div>
            </div>
          </div>
        </Card>
      ) : activeTab === "equity-changes" && equityChanges ? (
        <Card className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm max-w-3xl mx-auto space-y-4">
          <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-bold text-[#333333] dark:text-[#E0E0E0]">
              Estado de Cambios en el Patrimonio
            </h2>
            <p className="text-xs text-gray-500">Al {equityChanges.asOfDate}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F4F6F9] dark:bg-[#18191A] font-semibold text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="py-2.5 px-4">Componente Patrimonial</th>
                  <th className="py-2.5 px-4 text-right">Monto (VES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#242526]">
                <tr>
                  <td className="py-2.5 px-4">
                    Capital Social Suscrito y Pagado
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatMoneyVES(equityChanges.capitalSocial)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4">
                    Reserva Legal Estatutaria (Art. 262 C. Comercio)
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatMoneyVES(equityChanges.reservaLegal)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4">
                    Utilidades Retenidas de Ejercicios Anteriores
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatMoneyVES(equityChanges.utilidadesAcumuladas)}
                  </td>
                </tr>
                <tr className="bg-blue-50/30 dark:bg-blue-950/20 font-semibold text-[#007BFF] dark:text-[#3D91FF]">
                  <td className="py-2.5 px-4">
                    Resultado del Ejercicio Actual
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatMoneyVES(equityChanges.resultadoEjercicio)}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-[#F4F6F9] dark:bg-[#18191A] font-bold border-t-2 border-gray-300 dark:border-gray-700">
                <tr>
                  <td className="py-3 px-4 uppercase text-gray-700 dark:text-gray-300">
                    Total Patrimonio Neto:
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-[#28A745] dark:text-[#4ADE80]">
                    {formatMoneyVES(equityChanges.totalEquity)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : activeTab === "notes" && notes ? (
        <Card className="p-8 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm max-w-4xl mx-auto space-y-6">
          <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold text-[#333333] dark:text-[#E0E0E0]">
              Notas Revelatorias a los Estados Financieros
            </h2>
            <p className="text-xs text-gray-500">
              {notes.company.legal_name} | RIF: {notes.company.rif} | Ejercicio
              terminado al {notes.asOfDate}
            </p>
          </div>

          <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {notes.notes.map((note: any) => (
              <div key={note.number} className="space-y-2">
                <h3 className="font-bold text-sm text-[#007BFF] dark:text-[#3D91FF] flex items-center gap-2">
                  <span>Nota {note.number}.</span>
                  <span>{note.title}</span>
                </h3>
                {note.content && (
                  <p className="text-xs text-justify">{note.content}</p>
                )}
                {note.subsections && (
                  <div className="pl-4 space-y-2 pt-1 border-l-2 border-gray-200 dark:border-gray-700 text-xs">
                    {note.subsections.map((sub: any, idx: number) => (
                      <div key={idx}>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                          {sub.subtitle}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400">
                          {sub.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Visor PDF Oficial */}
      <PdfViewerModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title={currentInfo.title}
        subtitle={currentInfo.subtitle}
        endpoint={buildStatementQuery("pdf")}
        filename={`${currentInfo.filenameBase}.pdf`}
      />
    </div>
  );
};
export default FinancialStatementsView;

