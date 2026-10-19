import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  BookOpen,
  Calendar,
  Download,
  Search,
  Building2,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { formatMoneyUSD } from '@ero/shared';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';

interface PurchasesBookItem {
  rowNum: number;
  invoiceId: string;
  branchId: string;
  branchName: string;
  supplierId: string;
  supplierRif: string;
  supplierName: string;
  invoiceNumber: string;
  controlNumber: string;
  emissionDate: string;
  totalAmount: number;
  baseExemptAmount: number;
  baseTaxableAmount: number;
  taxRate: number;
  taxAmount: number;
  ivaRetainedAmount: number;
  withholdingVoucherNumber: string;
  fiscalPeriod: string;
}

interface PurchasesBookTotals {
  totalPurchases: number;
  totalExempt: number;
  totalTaxable: number;
  totalTax: number;
  totalIvaRetained: number;
}

export const PurchasesBookView: React.FC = () => {
  const { activeBranchId } = useAuthStore();
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const [period, setPeriod] = useState(currentPeriod);
  const [items, setItems] = useState<PurchasesBookItem[]>([]);
  const [totals, setTotals] = useState<PurchasesBookTotals>({
    totalPurchases: 0,
    totalExempt: 0,
    totalTaxable: 0,
    totalTax: 0,
    totalIvaRetained: 0,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);

  useEffect(() => {
    fetchPurchasesBook();
  }, [period, activeBranchId]);

  const fetchPurchasesBook = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('period', period);
      if (activeBranchId) params.append('branchId', activeBranchId);

      const res = await fetch(`/api/taxes/books/purchases?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setItems(json.data.items || []);
          if (json.data.totals) setTotals(json.data.totals);
        } else {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = [
        'Operacion N°',
        'Fecha Emision',
        'RIF Proveedor',
        'Nombre o Razon Social',
        'Numero Factura',
        'Numero Control',
        'Total Compras',
        'Base Exenta',
        'Base Imponible',
        'Alicuota',
        'IVA Credito Fiscal',
        'IVA Retenido',
        'Numero Comprobante Retencion',
      ];

      const rows = items.map((i) => [
        i.rowNum,
        i.emissionDate,
        `"${i.supplierRif}"`,
        `"${i.supplierName}"`,
        `"${i.invoiceNumber}"`,
        `"${i.controlNumber}"`,
        i.totalAmount.toFixed(2),
        i.baseExemptAmount.toFixed(2),
        i.baseTaxableAmount.toFixed(2),
        `${i.taxRate}%`,
        i.taxAmount.toFixed(2),
        i.ivaRetainedAmount.toFixed(2),
        `"${i.withholdingVoucherNumber}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Libro_Compras_SENIAT_${period.replace('-', '')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Libro de Compras exportado a CSV exitosamente');
    } catch {
      toast.error('Error al exportar Libro de Compras');
    }
  };

  const filteredItems = items.filter(
    (i) =>
      i.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      i.supplierRif.toLowerCase().includes(search.toLowerCase()) ||
      i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.withholdingVoucherNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-600" />
            Libro Fiscal de Compras (SENIAT)
          </h1>
          <p className="text-sm text-neutral-500">
            Registro cronológico y obligatorio según Art. 75-77 del Reglamento de la Ley del IVA
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1 text-emerald-600" />
            Exportar CSV / Excel
          </Button>
          <Button
            size="sm"
            onClick={() => setShowPdfModal(true)}
            className="flex-1 sm:flex-none"
          >
            <Download className="w-4 h-4 mr-1" />
            Ver / Descargar PDF
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-3 border-neutral-200">
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Total Compras
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1 font-mono">
            {formatMoneyUSD(totals.totalPurchases)}
          </p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Incluye base + IVA</p>
        </Card>

        <Card className="p-3 border-neutral-200">
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Compras Exentas
          </p>
          <p className="text-xl font-bold text-neutral-700 mt-1 font-mono">
            {formatMoneyUSD(totals.totalExempt)}
          </p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Alícuota 0%</p>
        </Card>

        <Card className="p-3 border-neutral-200">
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Base Imponible (16%)
          </p>
          <p className="text-xl font-bold text-sky-700 mt-1 font-mono">
            {formatMoneyUSD(totals.totalTaxable)}
          </p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Sujeto a crédito fiscal</p>
        </Card>

        <Card className="p-3 border-neutral-200">
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            IVA Crédito Fiscal
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1 font-mono">
            {formatMoneyUSD(totals.totalTax)}
          </p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Deducible en declaración</p>
        </Card>

        <Card className="p-3 border-neutral-200 bg-sky-50/50 border-sky-200">
          <p className="text-[11px] font-semibold text-sky-800 uppercase tracking-wider">
            IVA Retenido Proveedor
          </p>
          <p className="text-xl font-bold text-sky-900 mt-1 font-mono">
            {formatMoneyUSD(totals.totalIvaRetained)}
          </p>
          <p className="text-[10px] text-sky-700 mt-0.5">Retenido al 75% o 100%</p>
        </Card>
      </div>

      {/* Main Ledger Table Card */}
      <Card className="border-neutral-200 overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-neutral-200 bg-neutral-50/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs text-neutral-600">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>Mes / Período:</span>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-transparent font-medium text-neutral-900 focus:outline-none"
              />
            </div>
            <span className="text-xs text-neutral-500">
              {filteredItems.length} operaciones registradas
            </span>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar proveedor, RIF o factura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Semantic Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50 border-b border-neutral-200 font-semibold text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 text-center">Op. N°</th>
                <th className="py-3 px-3">Fecha</th>
                <th className="py-3 px-3">RIF Proveedor</th>
                <th className="py-3 px-3">Nombre o Razón Social</th>
                <th className="py-3 px-3">N° Factura</th>
                <th className="py-3 px-3">N° Control</th>
                <th className="py-3 px-3 text-right">Total Compras</th>
                <th className="py-3 px-3 text-right">Exento</th>
                <th className="py-3 px-3 text-right">Base Imponible</th>
                <th className="py-3 px-3 text-right">Alíc.</th>
                <th className="py-3 px-3 text-right">IVA Crédito</th>
                <th className="py-3 px-3 text-right">IVA Retenido</th>
                <th className="py-3 px-3 text-center">N° Comprobante Ret.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-3 text-center"><div className="h-4 bg-neutral-200 rounded w-6 mx-auto"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-16"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-20"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-32"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-20"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-16"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-16 ml-auto"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-12 ml-auto"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-16 ml-auto"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-8 ml-auto"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-14 ml-auto"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-14 ml-auto"></div></td>
                    <td className="py-3 px-3"><div className="h-4 bg-neutral-200 rounded w-24 mx-auto"></div></td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-neutral-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    <p className="text-sm font-medium text-neutral-600">No hay facturas de compra registradas</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      No se registraron compras durante el período {period}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.invoiceId} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3 px-3 text-center font-mono font-medium text-neutral-500">
                      {item.rowNum}
                    </td>
                    <td className="py-3 px-3 text-neutral-900 whitespace-nowrap">
                      {new Date(item.emissionDate).toLocaleDateString('es-VE')}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-neutral-800">
                      {item.supplierRif}
                    </td>
                    <td className="py-3 px-3 font-medium text-neutral-900 max-w-[200px] truncate" title={item.supplierName}>
                      {item.supplierName}
                    </td>
                    <td className="py-3 px-3 font-mono text-neutral-900">
                      {item.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 font-mono text-neutral-500">
                      {item.controlNumber}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-neutral-900">
                      {formatMoneyUSD(item.totalAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-neutral-600">
                      {formatMoneyUSD(item.baseExemptAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sky-800 font-medium">
                      {formatMoneyUSD(item.baseTaxableAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-neutral-500">
                      {item.taxRate}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-neutral-900">
                      {formatMoneyUSD(item.taxAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-sky-700">
                      {formatMoneyUSD(item.ivaRetainedAmount)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-neutral-600">
                      {item.withholdingVoucherNumber ? (
                        <span className="font-semibold text-sky-600">{item.withholdingVoucherNumber}</span>
                      ) : (
                        <span className="text-neutral-400 italic">No Aplica</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer with Totals */}
            {items.length > 0 && (
              <tfoot className="bg-neutral-100 font-bold border-t-2 border-neutral-300 text-neutral-900">
                <tr>
                  <td colSpan={6} className="py-3 px-3 text-right uppercase text-[11px] tracking-wider">
                    Totales del Período ({period}):
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatMoneyUSD(totals.totalPurchases)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatMoneyUSD(totals.totalExempt)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sky-800">
                    {formatMoneyUSD(totals.totalTaxable)}
                  </td>
                  <td></td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatMoneyUSD(totals.totalTax)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sky-700">
                    {formatMoneyUSD(totals.totalIvaRetained)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Modal Visor / Descarga PDF Libro de Compras SENIAT */}
      <PdfViewerModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        title={`Libro Fiscal de Compras SENIAT - ${period}`}
        subtitle="Formato oficial apaisado según Providencias Administrativas SENIAT"
        endpoint={`/api/taxes/books/purchases?period=${period}${activeBranchId ? `&branchId=${activeBranchId}` : ''}&format=pdf`}
        filename={`Libro_Compras_SENIAT_${period.replace('-', '')}.pdf`}
      />
    </div>
  );
};
