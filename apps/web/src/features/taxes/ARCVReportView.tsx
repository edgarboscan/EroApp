import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  FileCheck,
  Calendar,
  Download,
  Search,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Building2,
  DollarSign,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';

interface ARCVVoucher {
  id: string;
  voucherNumber: string;
  taxPeriod: string;
  conceptCode: string;
  conceptDescription: string;
  personType: string;
  invoiceNumber: string;
  controlNumber: string;
  invoiceDate: string;
  totalInvoiceAmount: number;
  taxableBaseAmount: number;
  ratePercentage: number;
  subtractingFactor: number;
  islrRetainedAmount: number;
}

interface ARCVSupplier {
  supplierId: string;
  supplierRif: string;
  supplierName: string;
  taxYear: number;
  totalTaxableBase: number;
  totalIslrRetained: number;
  vouchersCount: number;
  vouchers: ARCVVoucher[];
}

const DEMO_ARCV_SUPPLIERS: ARCVSupplier[] = [
  {
    supplierId: 's1',
    supplierRif: 'J-30555666-0',
    supplierName: 'ALIMENTOS POLAR COMERCIAL C.A.',
    taxYear: 2026,
    totalTaxableBase: 780.00,
    totalIslrRetained: 39.00,
    vouchersCount: 1,
    vouchers: [
      {
        id: 'w2',
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
        subtractingFactor: 0.00,
        islrRetainedAmount: 39.00,
      },
    ],
  },
];

export const ARCVReportView: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState<number>(currentYear);
  const [suppliers, setSuppliers] = useState<ARCVSupplier[]>(DEMO_ARCV_SUPPLIERS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);

  // Print Modal
  const [selectedSupplierForPrint, setSelectedSupplierForPrint] = useState<ARCVSupplier | null>(null);

  useEffect(() => {
    fetchARCVReport();
  }, [taxYear]);

  const fetchARCVReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/taxes/arcv?year=${taxYear}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && json.data.suppliers) {
          setSuppliers(json.data.suppliers.length > 0 ? json.data.suppliers : DEMO_ARCV_SUPPLIERS);
        }
      }
    } catch {
      setSuppliers(DEMO_ARCV_SUPPLIERS);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadXML = async () => {
    try {
      const currentPeriod = `${taxYear}-09`;
      const res = await fetch(`/api/taxes/export/seniat?period=${currentPeriod}&type=ISLR`);
      if (!res.ok) throw new Error('Error al descargar archivo XML');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ISLR_ARCV_${taxYear}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Archivo XML SENIAT (${taxYear}) descargado exitosamente`);
    } catch {
      toast.error('Error al generar XML SENIAT');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedSupplierId(expandedSupplierId === id ? null : id);
  };

  // KPIs
  const totalSuppliersCount = suppliers.length;
  const totalAccumulatedBase = suppliers.reduce((sum, s) => sum + s.totalTaxableBase, 0);
  const totalAccumulatedRetained = suppliers.reduce((sum, s) => sum + s.totalIslrRetained, 0);
  const totalVouchersCount = suppliers.reduce((sum, s) => sum + s.vouchersCount, 0);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      s.supplierRif.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-sky-600" />
            Certificado Anual de Retenciones ISLR (Comprobante ARCV)
          </h1>
          <p className="text-sm text-neutral-500">
            Relación consolidada anual de retenciones de Impuesto Sobre la Renta (Decreto 1808 - Art. 24)
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadXML}
            className="flex-1 sm:flex-none"
          >
            <Download className="w-4 h-4 mr-1 text-sky-600" />
            Descargar XML SENIAT
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-neutral-200">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Proveedores Retenidos
          </p>
          <p className="text-2xl font-bold text-neutral-900 mt-2 font-mono">
            {totalSuppliersCount}
          </p>
          <p className="text-xs text-neutral-500 mt-1">En el ejercicio fiscal {taxYear}</p>
        </Card>

        <Card className="p-4 border-neutral-200">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Base Imponible Acumulada
          </p>
          <p className="text-2xl font-bold text-sky-800 mt-2 font-mono">
            ${totalAccumulatedBase.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Servicios y honorarios</p>
        </Card>

        <Card className="p-4 border-neutral-200 bg-neutral-900 text-white">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Total ISLR Retenido Anual
          </p>
          <p className="text-2xl font-bold text-white mt-2 font-mono">
            ${totalAccumulatedRetained.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Enterado al SENIAT</p>
        </Card>

        <Card className="p-4 border-neutral-200">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Total Comprobantes Emitidos
          </p>
          <p className="text-2xl font-bold text-neutral-900 mt-2 font-mono">
            {totalVouchersCount}
          </p>
          <p className="text-xs text-neutral-500 mt-1">En {taxYear}</p>
        </Card>
      </div>

      {/* Main List Card */}
      <Card className="border-neutral-200 overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-neutral-200 bg-neutral-50/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs text-neutral-600">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>Año Gravable:</span>
              <select
                value={taxYear}
                onChange={(e) => setTaxYear(Number(e.target.value))}
                className="bg-transparent font-medium text-neutral-900 focus:outline-none"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
                <option value={2023}>2023</option>
              </select>
            </div>
            <span className="text-xs text-neutral-500">
              {filteredSuppliers.length} proveedores registrados
            </span>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar proveedor o RIF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Suppliers List with Accordion Details */}
        <div className="divide-y divide-neutral-200">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse space-y-2">
                <div className="h-5 bg-neutral-200 rounded w-1/3"></div>
                <div className="h-4 bg-neutral-200 rounded w-1/4"></div>
              </div>
            ))
          ) : filteredSuppliers.length === 0 ? (
            <div className="py-12 text-center text-neutral-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
              <p className="text-sm font-medium text-neutral-600">No se encontraron retenciones de ISLR</p>
              <p className="text-xs text-neutral-400 mt-1">
                No hay comprobantes de retención emitidos en el año {taxYear}
              </p>
            </div>
          ) : (
            filteredSuppliers.map((sup) => {
              const isExpanded = expandedSupplierId === sup.supplierId;
              return (
                <div key={sup.supplierId} className="transition-colors hover:bg-neutral-50/50">
                  {/* Supplier Summary Row */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-neutral-900">{sup.supplierName}</span>
                        <Badge variant="neutral" className="font-mono text-[10px]">
                          {sup.supplierRif}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500">
                        {sup.vouchersCount} comprobante(s) emitido(s) en el año {taxYear}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] text-neutral-500 uppercase font-semibold">Base Acumulada</p>
                        <p className="text-sm font-mono font-medium text-neutral-800">
                          ${sup.totalTaxableBase.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] text-neutral-500 uppercase font-semibold">ISLR Retenido</p>
                        <p className="text-sm font-mono font-bold text-sky-800">
                          ${sup.totalIslrRetained.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSupplierForPrint(sup)}
                          className="h-8 px-2.5 text-xs"
                          title="Imprimir Certificado ARCV"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1 text-neutral-600" />
                          ARCV
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(sup.supplierId)}
                          className="h-8 w-8 p-0"
                          title={isExpanded ? 'Contraer' : 'Expandir detalle'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Monthly Vouchers Detail Table */}
                  {isExpanded && (
                    <div className="bg-neutral-50 p-4 border-t border-neutral-200">
                      <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
                        Detalle Cronológico de Comprobantes de Retención
                      </p>
                      <div className="overflow-x-auto bg-white rounded-lg border border-neutral-200">
                        <table className="w-full text-left text-xs text-neutral-600">
                          <thead className="bg-neutral-100 border-b border-neutral-200 font-semibold text-neutral-600 uppercase text-[10px]">
                            <tr>
                              <th className="py-2 px-3">Comprobante</th>
                              <th className="py-2 px-3">Período</th>
                              <th className="py-2 px-3">Fecha Factura</th>
                              <th className="py-2 px-3">N° Factura</th>
                              <th className="py-2 px-3">Concepto ISLR</th>
                              <th className="py-2 px-3 text-right">Base Imponible</th>
                              <th className="py-2 px-3 text-right">Tarifa %</th>
                              <th className="py-2 px-3 text-right">Monto Retenido</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {sup.vouchers.map((v) => (
                              <tr key={v.id}>
                                <td className="py-2 px-3 font-mono font-medium text-neutral-900">{v.voucherNumber}</td>
                                <td className="py-2 px-3 font-mono">{v.taxPeriod}</td>
                                <td className="py-2 px-3 text-neutral-700">
                                  {new Date(v.invoiceDate).toLocaleDateString('es-VE')}
                                </td>
                                <td className="py-2 px-3 font-mono">{v.invoiceNumber}</td>
                                <td className="py-2 px-3">
                                  {v.conceptCode} - {v.conceptDescription}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  ${v.taxableBaseAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">{v.ratePercentage}%</td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-sky-800">
                                  ${v.islrRetainedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Official Annual ARCV Certificate Printable Modal */}
      {selectedSupplierForPrint && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 print:hidden">
              <h2 className="text-base font-semibold text-neutral-900">
                Certificado de Retención Anual (Formato AR-CV)
              </h2>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1" />
                  Imprimir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedSupplierForPrint(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Official Formato AR-CV Document */}
            <div className="p-6 bg-white border border-neutral-300 rounded-lg text-neutral-800 space-y-4 text-xs font-sans">
              <div className="text-center border-b border-neutral-300 pb-3">
                <h1 className="text-base font-bold uppercase tracking-wide text-neutral-900">
                  COMPROBANTE DE RETENCIÓN DE IMPUESTO SOBRE LA RENTA
                </h1>
                <p className="text-xs font-semibold text-neutral-700 mt-0.5">
                  CERTIFICADO ANUAL AR-CV - EJERCICIO GRAVABLE {taxYear}
                </p>
                <p className="text-[10px] text-neutral-500">
                  (Artículo 24 del Decreto N° 1808 - Reglamento de la Ley de ISLR)
                </p>
              </div>

              {/* Data Table Agent and Subject */}
              <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <p className="font-bold text-[11px] text-neutral-900 mb-1">AGENTE DE RETENCIÓN</p>
                  <p className="font-semibold text-neutral-800">DISTRIBUIDORA ERO VE, C.A.</p>
                  <p className="text-neutral-600">RIF: J-40123456-7</p>
                  <p className="text-neutral-600">Caracas, Venezuela</p>
                </div>
                <div>
                  <p className="font-bold text-[11px] text-neutral-900 mb-1">BENEFICIARIO (SUJETO RETENIDO)</p>
                  <p className="font-semibold text-neutral-800">{selectedSupplierForPrint.supplierName}</p>
                  <p className="text-neutral-600">RIF: {selectedSupplierForPrint.supplierRif}</p>
                  <p className="text-neutral-600">Período Fiscal: 01/01/{taxYear} al 31/12/{taxYear}</p>
                </div>
              </div>

              {/* Table of Monthly Operations */}
              <table className="w-full border-collapse border border-neutral-300 text-[11px]">
                <thead className="bg-neutral-100 font-semibold">
                  <tr>
                    <th className="border border-neutral-300 p-2 text-left">N° Comprobante</th>
                    <th className="border border-neutral-300 p-2 text-left">Factura</th>
                    <th className="border border-neutral-300 p-2 text-center">Fecha</th>
                    <th className="border border-neutral-300 p-2 text-left">Concepto</th>
                    <th className="border border-neutral-300 p-2 text-right">Base Imponible</th>
                    <th className="border border-neutral-300 p-2 text-right">%</th>
                    <th className="border border-neutral-300 p-2 text-right bg-neutral-200">ISLR Retenido</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSupplierForPrint.vouchers.map((v) => (
                    <tr key={v.id}>
                      <td className="border border-neutral-300 p-2 font-mono">{v.voucherNumber}</td>
                      <td className="border border-neutral-300 p-2 font-mono">{v.invoiceNumber}</td>
                      <td className="border border-neutral-300 p-2 text-center">
                        {new Date(v.invoiceDate).toLocaleDateString('es-VE')}
                      </td>
                      <td className="border border-neutral-300 p-2">{v.conceptDescription}</td>
                      <td className="border border-neutral-300 p-2 text-right font-mono">
                        ${v.taxableBaseAmount.toFixed(2)}
                      </td>
                      <td className="border border-neutral-300 p-2 text-right font-mono">{v.ratePercentage}%</td>
                      <td className="border border-neutral-300 p-2 text-right font-mono font-bold bg-neutral-100">
                        ${v.islrRetainedAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-neutral-100 font-bold border-t-2 border-neutral-300">
                  <tr>
                    <td colSpan={4} className="border border-neutral-300 p-2 text-right uppercase">
                      Totales Anuales Acumulados:
                    </td>
                    <td className="border border-neutral-300 p-2 text-right font-mono text-sky-800">
                      ${selectedSupplierForPrint.totalTaxableBase.toFixed(2)}
                    </td>
                    <td className="border border-neutral-300 p-2"></td>
                    <td className="border border-neutral-300 p-2 text-right font-mono font-bold text-sky-900 bg-neutral-200">
                      ${selectedSupplierForPrint.totalIslrRetained.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-10 text-center text-xs">
                <div>
                  <div className="border-t border-neutral-400 mx-auto w-48 pt-1">
                    <p className="font-bold text-neutral-800">AGENTE DE RETENCIÓN</p>
                    <p className="text-[10px] text-neutral-500">Firma y Sello del Pagador</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-neutral-400 mx-auto w-48 pt-1">
                    <p className="font-bold text-neutral-800">SUJETO RETENIDO</p>
                    <p className="text-[10px] text-neutral-500">Firma y C.I. del Beneficiario</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 print:hidden">
              <Button variant="outline" size="sm" onClick={() => setSelectedSupplierForPrint(null)}>
                Cerrar
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-1" />
                Imprimir Certificado
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
