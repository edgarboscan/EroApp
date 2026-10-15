import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  FileText,
  Search,
  Download,
  Plus,
  Printer,
  Calendar,
  Building2,
  DollarSign,
  AlertCircle,
  X,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { WithholdingVoucherModal, WithholdingVoucherData } from './WithholdingVoucherModal';
import { STANDARD_ISLR_CONCEPTS, formatMoneyUSD } from '@ero/shared';

interface WithholdingItem {
  id: string;
  type: 'IVA' | 'ISLR';
  branchId: string;
  branchName: string;
  supplierId: string;
  supplierRif: string;
  supplierName: string;
  purchaseInvoiceId: string;
  voucherNumber: string;
  taxPeriod: string;
  fortnight?: 'FIRST' | 'SECOND';
  conceptCode?: string;
  conceptDescription?: string;
  personType?: string;
  invoiceNumber: string;
  controlNumber: string;
  invoiceDate: string;
  totalInvoiceAmount: number;
  taxableBaseAmount: number;
  exemptAmount?: number;
  taxRate?: number;
  ratePercentage?: number;
  taxAmount?: number;
  retainedPercentage?: number;
  retainedAmount: number;
  status: string;
  createdAt: string;
}

interface PendingInvoice {
  id: string;
  branchId: string;
  branchName: string;
  supplierId: string;
  supplierRif: string;
  supplierName: string;
  supplierIsResident: boolean;
  supplierIslrConceptCode?: string;
  invoiceNumber: string;
  controlNumber: string;
  invoiceDate: string;
  currency: string;
  exchangeRate: number;
  baseExemptAmount: number;
  baseTaxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  hasIvaWithholding: boolean;
  hasIslrWithholding: boolean;
}

const DEMO_WITHHOLDINGS: WithholdingItem[] = [
  {
    id: 'w1',
    type: 'IVA',
    branchId: 'b1',
    branchName: 'Sucursal Principal Caracas',
    supplierId: 's1',
    supplierRif: 'J-30555666-0',
    supplierName: 'ALIMENTOS POLAR COMERCIAL C.A.',
    purchaseInvoiceId: 'pi1',
    voucherNumber: '20260900000001',
    taxPeriod: '2026-09',
    fortnight: 'FIRST',
    invoiceNumber: 'FACT-POLAR-9812',
    controlNumber: '00-0981234',
    invoiceDate: '2026-09-14',
    totalInvoiceAmount: 1254.80,
    exemptAmount: 350.00,
    taxableBaseAmount: 780.00,
    taxRate: 16.00,
    taxAmount: 124.80,
    retainedPercentage: 75.00,
    retainedAmount: 93.60,
    status: 'EMITTED',
    createdAt: '2026-09-14T10:00:00Z',
  },
  {
    id: 'w2',
    type: 'ISLR',
    branchId: 'b1',
    branchName: 'Sucursal Principal Caracas',
    supplierId: 's1',
    supplierRif: 'J-30555666-0',
    supplierName: 'ALIMENTOS POLAR COMERCIAL C.A.',
    purchaseInvoiceId: 'pi1',
    voucherNumber: '20260900000001',
    taxPeriod: '2026-09',
    conceptCode: 'SERV_TRANS',
    conceptDescription: 'Servicio de Transporte y Envíos',
    personType: 'PJD',
    invoiceNumber: 'FACT-POLAR-9812',
    controlNumber: '00-0981234',
    invoiceDate: '2026-09-14',
    totalInvoiceAmount: 1254.80,
    taxableBaseAmount: 780.00,
    ratePercentage: 5.00,
    retainedAmount: 39.00,
    status: 'EMITTED',
    createdAt: '2026-09-14T10:05:00Z',
  },
];

const DEMO_PENDING_INVOICES: PendingInvoice[] = [
  {
    id: 'pi2',
    branchId: 'b1',
    branchName: 'Sucursal Principal Caracas',
    supplierId: 's2',
    supplierRif: 'J-00033322-1',
    supplierName: 'MONDELEZ VENEZUELA C.A.',
    supplierIsResident: true,
    supplierIslrConceptCode: 'SERV_IND',
    invoiceNumber: 'FACT-MDLZ-4410',
    controlNumber: '00-0044102',
    invoiceDate: '2026-08-15',
    currency: 'USD',
    exchangeRate: 36.20,
    baseExemptAmount: 0.00,
    baseTaxableAmount: 1500.00,
    taxAmount: 240.00,
    totalAmount: 1740.00,
    hasIvaWithholding: false,
    hasIslrWithholding: false,
  },
];

export const WithholdingsView: React.FC = () => {
  const { activeBranchId } = useAuthStore();
  const [withholdings, setWithholdings] = useState<WithholdingItem[]>(DEMO_WITHHOLDINGS);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>(DEMO_PENDING_INVOICES);
  const [loading, setLoading] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IVA' | 'ISLR'>('ALL');
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const [period, setPeriod] = useState(currentPeriod);
  const [search, setSearch] = useState('');

  // Modals
  const [voucherModalData, setVoucherModalData] = useState<WithholdingVoucherData | null>(null);
  const [showEmitModal, setShowEmitModal] = useState(false);

  // Emission Form State
  const [emitType, setEmitType] = useState<'IVA' | 'ISLR'>('IVA');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [retainedPercentage, setRetainedPercentage] = useState<number>(75);
  const [fortnight, setFortnight] = useState<'FIRST' | 'SECOND'>('FIRST');
  const [conceptCode, setConceptCode] = useState('SERV_TRANS');
  const [ratePercentage, setRatePercentage] = useState(5);
  const [personType, setPersonType] = useState('PJD');
  const [subtractingFactor, setSubtractingFactor] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Data
  useEffect(() => {
    fetchWithholdings();
    fetchPendingInvoices();
  }, [typeFilter, period, activeBranchId]);

  const fetchWithholdings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'ALL') params.append('type', typeFilter);
      if (period) params.append('period', period);
      if (activeBranchId) params.append('branchId', activeBranchId);

      const res = await fetch(`/api/taxes/withholdings?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const combined = [
            ...(json.data.ivaWithholdings || []),
            ...(json.data.islrWithholdings || []),
          ];
          setWithholdings(combined.length > 0 ? combined : DEMO_WITHHOLDINGS);
        }
      }
    } catch {
      // Fallback a demo data
      setWithholdings(DEMO_WITHHOLDINGS);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingInvoices = async () => {
    try {
      const params = new URLSearchParams();
      if (activeBranchId) params.append('branchId', activeBranchId);
      const res = await fetch(`/api/taxes/pending-invoices?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setPendingInvoices(json.data.length > 0 ? json.data : DEMO_PENDING_INVOICES);
        }
      }
    } catch {
      setPendingInvoices(DEMO_PENDING_INVOICES);
    }
  };

  // Selected Invoice Details
  const selectedInvoice = pendingInvoices.find((i) => i.id === selectedInvoiceId);

  // Live calculations for emission preview
  const previewIvaRetained = selectedInvoice
    ? Number(((selectedInvoice.taxAmount * retainedPercentage) / 100).toFixed(2))
    : 0;

  const previewIslrRetained = selectedInvoice
    ? Math.max(0, Number((((selectedInvoice.baseTaxableAmount * ratePercentage) / 100) - subtractingFactor).toFixed(2)))
    : 0;

  const handleEmitWithholding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) {
      toast.error('Debe seleccionar una factura de compra');
      return;
    }

    setIsSubmitting(true);
    try {
      if (emitType === 'IVA') {
        const res = await fetch('/api/taxes/withholdings/iva', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchaseInvoiceId: selectedInvoiceId,
            retainedPercentage,
            fortnight,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Error al emitir retención de IVA');
        }
        toast.success(`Comprobante de IVA ${json.data.voucherNumber} generado`);
      } else {
        const concept = STANDARD_ISLR_CONCEPTS.find((c) => c.code === conceptCode);
        const res = await fetch('/api/taxes/withholdings/islr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchaseInvoiceId: selectedInvoiceId,
            conceptCode,
            conceptDescription: concept?.name || 'Servicios Profesionales / Técnicos',
            personType,
            ratePercentage,
            subtractingFactor,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Error al emitir retención de ISLR');
        }
        toast.success(`Comprobante de ISLR ${json.data.voucherNumber} generado`);
      }

      setShowEmitModal(false);
      setSelectedInvoiceId('');
      fetchWithholdings();
      fetchPendingInvoices();
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la retención');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportSENIAT = async (type: 'ISLR' | 'IVA') => {
    try {
      const res = await fetch(`/api/taxes/export/seniat?period=${period}&type=${type}`);
      if (!res.ok) throw new Error('Error al descargar archivo SENIAT');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'ISLR' ? `ISLR_${period.replace('-', '')}.xml` : `IVA_${period.replace('-', '')}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Archivo oficial SENIAT (${type}) descargado`);
    } catch (err: any) {
      toast.error(err.message || 'Error al exportar archivo SENIAT');
    }
  };

  const handleAnnul = async (item: WithholdingItem) => {
    if (!window.confirm(`¿Confirma anular el comprobante ${item.voucherNumber} de ${item.type}?`)) {
      return;
    }

    try {
      const res = await fetch('/api/taxes/withholdings/annul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al anular');
      }
      toast.success('Comprobante anulado');
      fetchWithholdings();
    } catch (err: any) {
      toast.error(err.message || 'Error al anular comprobante');
    }
  };

  // KPIs
  const activeItems = withholdings.filter((w) => w.status !== 'ANNULLED');
  const totalIvaRetained = activeItems
    .filter((w) => w.type === 'IVA')
    .reduce((sum, w) => sum + w.retainedAmount, 0);
  const totalIslrRetained = activeItems
    .filter((w) => w.type === 'ISLR')
    .reduce((sum, w) => sum + w.retainedAmount, 0);
  const totalRetained = totalIvaRetained + totalIslrRetained;

  // Search Filter
  const filteredWithholdings = withholdings.filter((w) => {
    const q = search.toLowerCase();
    const matchesSearch =
      w.voucherNumber.toLowerCase().includes(q) ||
      w.supplierName.toLowerCase().includes(q) ||
      w.supplierRif.toLowerCase().includes(q) ||
      w.invoiceNumber.toLowerCase().includes(q);
    const matchesType = typeFilter === 'ALL' || w.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" />
            Retenciones Tributarias SENIAT (IVA e ISLR)
          </h1>
          <p className="text-sm text-neutral-500">
            Control de comprobantes fiscales, retenciones a proveedores y declaraciones oficiales
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportSENIAT('IVA')}
            className="flex-1 sm:flex-none"
          >
            <Download className="w-4 h-4 mr-1 text-neutral-600" />
            TXT IVA
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportSENIAT('ISLR')}
            className="flex-1 sm:flex-none"
          >
            <Download className="w-4 h-4 mr-1 text-neutral-600" />
            XML ISLR
          </Button>
          <Button
            size="sm"
            onClick={() => setShowEmitModal(true)}
            className="flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4 mr-1" />
            Emitir Retención
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Retenciones IVA
            </p>
            <Badge variant="info">
              IVA 75%/100%
            </Badge>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2 font-mono">
            {formatMoneyUSD(totalIvaRetained)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Acumulado en período seleccionado</p>
        </Card>

        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Retenciones ISLR
            </p>
            <Badge variant="success">
              Dec. 1808
            </Badge>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2 font-mono">
            {formatMoneyUSD(totalIslrRetained)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Servicios, fletes y honorarios</p>
        </Card>

        <Card className="p-4 border-neutral-200 bg-neutral-900 text-white">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Total Retenido SENIAT
          </p>
          <p className="text-2xl font-bold text-white mt-2 font-mono">
            {formatMoneyUSD(totalRetained)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Pasivo fiscal por enterar al fisco</p>
        </Card>

        <Card className="p-4 border-neutral-200">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Comprobantes Emitidos
          </p>
          <p className="text-2xl font-bold text-neutral-900 mt-2 font-mono">
            {activeItems.length}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {pendingInvoices.length} facturas con retención pendiente
          </p>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-neutral-200 overflow-hidden">
        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-neutral-200 bg-neutral-50/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter Buttons */}
            <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  typeFilter === 'ALL'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('IVA')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  typeFilter === 'IVA'
                    ? 'bg-sky-600 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                IVA
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('ISLR')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  typeFilter === 'ISLR'
                    ? 'bg-emerald-600 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                ISLR
              </button>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs text-neutral-600">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>Período:</span>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-transparent font-medium text-neutral-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar proveedor, RIF o comprobante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50 border-b border-neutral-200 font-semibold text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">N° Comprobante</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Período</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">Factura Afectada</th>
                <th className="py-3 px-4 text-right">Base Imponible</th>
                <th className="py-3 px-4 text-right">Tasa / %</th>
                <th className="py-3 px-4 text-right">Monto Retenido</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-24"></div></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-12"></div></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-16"></div></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-36"></div></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-20"></div></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-16 ml-auto"></div></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-12 ml-auto"></div></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-16 ml-auto"></div></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-16 mx-auto"></div></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredWithholdings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-neutral-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    <p className="text-sm font-medium text-neutral-600">No se encontraron comprobantes</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      No hay retenciones registradas en el período seleccionado
                    </p>
                  </td>
                </tr>
              ) : (
                filteredWithholdings.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-neutral-900">
                      <button
                        type="button"
                        onClick={() => setVoucherModalData(item as WithholdingVoucherData)}
                        className="hover:underline text-sky-600 text-left font-semibold"
                      >
                        {item.voucherNumber}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      {item.type === 'IVA' ? (
                        <Badge variant="info" className="text-[10px]">
                          IVA {item.retainedPercentage}%
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px]">
                          ISLR {item.ratePercentage}%
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600">
                      {item.taxPeriod}
                      {item.fortnight && (
                        <span className="block text-[10px] text-neutral-400">
                          {item.fortnight === 'FIRST' ? '1ra Q' : '2da Q'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-neutral-900">{item.supplierName}</p>
                      <p className="text-[10px] font-mono text-neutral-400">{item.supplierRif}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono text-neutral-900">{item.invoiceNumber}</p>
                      <p className="text-[10px] text-neutral-400">Ctrl: {item.controlNumber}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-900">
                      {formatMoneyUSD(item.taxableBaseAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-600">
                      {item.type === 'IVA' ? `${item.retainedPercentage}%` : `${item.ratePercentage}%`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                      {formatMoneyUSD(item.retainedAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.status === 'ANNULLED' ? (
                        <Badge variant="danger" className="text-[10px]">
                          Anulado
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px]">
                          Emitido
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVoucherModalData(item as WithholdingVoucherData)}
                          className="h-7 px-2 text-xs"
                          title="Ver / Imprimir Comprobante"
                        >
                          <Printer className="w-3.5 h-3.5 text-neutral-600" />
                        </Button>
                        {item.status !== 'ANNULLED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAnnul(item)}
                            className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Anular Comprobante"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Emission Modal */}
      {showEmitModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" />
                Emitir Comprobante de Retención
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setShowEmitModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleEmitWithholding} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div>
                <label className="block font-medium text-neutral-700 mb-1">
                  Tipo de Retención
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEmitType('IVA')}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                      emitType === 'IVA'
                        ? 'border-sky-600 bg-sky-50 text-sky-700'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    Retención de IVA (75% / 100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmitType('ISLR')}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                      emitType === 'ISLR'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    Retención de ISLR (Dec. 1808)
                  </button>
                </div>
              </div>

              {/* Purchase Invoice Picker */}
              <div>
                <label className="block font-medium text-neutral-700 mb-1">
                  Factura de Compra Afectada *
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full py-2 px-3 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                >
                  <option value="">-- Seleccionar factura de compra pendiente --</option>
                  {pendingInvoices
                    .filter((inv) => (emitType === 'IVA' ? !inv.hasIvaWithholding : !inv.hasIslrWithholding))
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} - {inv.supplierName} ({inv.supplierRif}) - Total: ${inv.totalAmount}
                      </option>
                    ))}
                </select>
              </div>

              {/* Invoice details summary if selected */}
              {selectedInvoice && (
                <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-neutral-500">Proveedor:</span>{' '}
                    <span className="font-semibold text-neutral-800">{selectedInvoice.supplierName}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">RIF:</span>{' '}
                    <span className="font-mono text-neutral-800">{selectedInvoice.supplierRif}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Base Imponible:</span>{' '}
                    <span className="font-mono font-semibold text-neutral-800">
                      {formatMoneyUSD(selectedInvoice.baseTaxableAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Monto IVA:</span>{' '}
                    <span className="font-mono font-semibold text-neutral-800">
                      {formatMoneyUSD(selectedInvoice.taxAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* IVA specific fields */}
              {emitType === 'IVA' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-neutral-700 mb-1">
                      Porcentaje de Retención
                    </label>
                    <select
                      value={retainedPercentage}
                      onChange={(e) => setRetainedPercentage(Number(e.target.value))}
                      className="w-full py-2 px-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value={75}>75% (General Sujetos Especiales)</option>
                      <option value={100}>100% (Designación Especial / Contribuyente Sin RIF)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-neutral-700 mb-1">
                      Quincena Fiscal
                    </label>
                    <select
                      value={fortnight}
                      onChange={(e) => setFortnight(e.target.value as 'FIRST' | 'SECOND')}
                      className="w-full py-2 px-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="FIRST">1ra Quincena (Días 1 al 15)</option>
                      <option value="SECOND">2da Quincena (Días 16 al último)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ISLR specific fields */}
              {emitType === 'ISLR' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-medium text-neutral-700 mb-1">
                      Concepto SENIAT (Decreto 1808)
                    </label>
                    <select
                      value={conceptCode}
                      onChange={(e) => {
                        setConceptCode(e.target.value);
                        const c = STANDARD_ISLR_CONCEPTS.find((item) => item.code === e.target.value);
                        if (c) {
                          setRatePercentage(personType === 'PJD' ? c.defaultRatePJD : c.defaultRatePNR);
                        }
                      }}
                      className="w-full py-2 px-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {STANDARD_ISLR_CONCEPTS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">
                        Tipo Persona
                      </label>
                      <select
                        value={personType}
                        onChange={(e) => setPersonType(e.target.value)}
                        className="w-full py-2 px-2 border border-neutral-300 rounded-lg text-xs"
                      >
                        <option value="PJD">PJ Domiciliada</option>
                        <option value="PNR">PN Residente</option>
                        <option value="PJND">PJ No Domiciliada</option>
                        <option value="PNNR">PN No Residente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">
                        Tarifa Retención (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={ratePercentage}
                        onChange={(e) => setRatePercentage(Number(e.target.value))}
                        className="w-full py-2 px-2 border border-neutral-300 rounded-lg font-mono text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">
                        Sustraendo (Bs/USD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={subtractingFactor}
                        onChange={(e) => setSubtractingFactor(Number(e.target.value))}
                        className="w-full py-2 px-2 border border-neutral-300 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Total Retained Preview Box */}
              <div className="p-3 bg-neutral-900 text-white rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-400">Total Impuesto a Retener</p>
                  <p className="text-lg font-bold font-mono">
                    {emitType === 'IVA'
                      ? formatMoneyUSD(previewIvaRetained)
                      : formatMoneyUSD(previewIslrRetained)}
                  </p>
                </div>
                <Badge variant="neutral" className="text-[10px]">
                  Correlativo automático YYYYMM
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmitModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  {isSubmitting ? 'Emitiendo...' : 'Confirmar y Emitir Comprobante'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Voucher Preview / Print Modal */}
      <WithholdingVoucherModal
        voucher={voucherModalData}
        onClose={() => setVoucherModalData(null)}
      />
    </div>
  );
};
