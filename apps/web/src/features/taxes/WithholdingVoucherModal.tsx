import React from 'react';
import { Button } from '../../components/ui/Button';
import { Printer, X, FileText } from 'lucide-react';
import { formatMoneyUSD } from '@ero/shared';

export interface WithholdingVoucherData {
  id: string;
  type: 'IVA' | 'ISLR';
  voucherNumber: string;
  taxPeriod: string;
  fortnight?: 'FIRST' | 'SECOND';
  conceptCode?: string;
  conceptDescription?: string;
  personType?: string;
  invoiceNumber: string;
  controlNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierRif: string;
  totalInvoiceAmount: number;
  taxableBaseAmount: number;
  exemptAmount?: number;
  taxRate?: number;
  ratePercentage?: number;
  taxAmount?: number;
  retainedPercentage?: number;
  retainedAmount: number;
  status: string;
  createdAt?: string;
}

interface Props {
  voucher: WithholdingVoucherData | null;
  onClose: () => void;
}

export const WithholdingVoucherModal: React.FC<Props> = ({ voucher, onClose }) => {
  if (!voucher) return null;

  const handlePrint = () => {
    window.print();
  };

  const isIVA = voucher.type === 'IVA';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-3xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Top actions toolbar */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-semibold text-neutral-900">
              Comprobante Oficial SENIAT ({voucher.type})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" />
              Imprimir
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div className="p-4 sm:p-6 bg-white border border-neutral-300 rounded-lg text-neutral-800 space-y-4 text-xs font-sans">
          {/* Header Title */}
          <div className="text-center border-b border-neutral-300 pb-3">
            <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide text-neutral-900">
              {isIVA
                ? 'COMPROBANTE DE RETENCIÓN DEL IMPUESTO AL VALOR AGREGADO (IVA)'
                : 'COMPROBANTE DE RETENCIÓN DE IMPUESTO SOBRE LA RENTA (ISLR)'}
            </h1>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {isIVA
                ? '(Ley de IVA - Providencia Administrativa SENIAT SNAT/2015/0049 - Art. 16)'
                : '(Reglamento de la Ley de ISLR en materia de Retenciones - Decreto N° 1808)'}
            </p>
          </div>

          {/* Identification Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
            <div>
              <p className="font-semibold text-neutral-900 text-[11px] uppercase tracking-wider mb-1">
                Agente de Retención
              </p>
              <p className="font-bold text-neutral-800">DISTRIBUIDORA ERO VE, C.A.</p>
              <p className="text-neutral-600">RIF: J-40123456-7</p>
              <p className="text-neutral-600">Av. Francisco de Miranda, Caracas, Venezuela</p>
            </div>
            <div>
              <p className="font-semibold text-neutral-900 text-[11px] uppercase tracking-wider mb-1">
                Datos del Comprobante
              </p>
              <p>
                <span className="font-semibold">N° Comprobante:</span>{' '}
                <span className="font-mono font-bold text-neutral-900">{voucher.voucherNumber}</span>
              </p>
              <p>
                <span className="font-semibold">Período Fiscal:</span>{' '}
                <span className="font-mono">{voucher.taxPeriod}</span>
                {voucher.fortnight && (
                  <span className="ml-1 text-neutral-500">
                    ({voucher.fortnight === 'FIRST' ? '1ra Quincena' : '2da Quincena'})
                  </span>
                )}
              </p>
              <p>
                <span className="font-semibold">Fecha Emisión:</span>{' '}
                {new Date().toLocaleDateString('es-VE')}
              </p>
            </div>
          </div>

          {/* Supplier Section */}
          <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
            <p className="font-semibold text-neutral-900 text-[11px] uppercase tracking-wider mb-1">
              Sujeto Retenido (Proveedor)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <p>
                <span className="font-semibold">Nombre / Razón Social:</span> {voucher.supplierName}
              </p>
              <p>
                <span className="font-semibold">RIF:</span> {voucher.supplierRif}
              </p>
            </div>
          </div>

          {/* Voucher Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-neutral-300 text-[11px]">
              <thead className="bg-neutral-100 text-neutral-700 font-semibold">
                <tr>
                  <th className="border border-neutral-300 p-2 text-left">Factura</th>
                  <th className="border border-neutral-300 p-2 text-left">Control</th>
                  <th className="border border-neutral-300 p-2 text-center">Fecha</th>
                  <th className="border border-neutral-300 p-2 text-right">Total Factura</th>
                  <th className="border border-neutral-300 p-2 text-right">Base Imponible</th>
                  {isIVA ? (
                    <>
                      <th className="border border-neutral-300 p-2 text-right">Alícuota</th>
                      <th className="border border-neutral-300 p-2 text-right">IVA Total</th>
                      <th className="border border-neutral-300 p-2 text-right">% Ret.</th>
                    </>
                  ) : (
                    <>
                      <th className="border border-neutral-300 p-2 text-left">Concepto</th>
                      <th className="border border-neutral-300 p-2 text-right">Tarifa</th>
                    </>
                  )}
                  <th className="border border-neutral-300 p-2 text-right bg-neutral-200 font-bold">
                    Monto Retenido
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-neutral-300 p-2 font-mono font-medium">{voucher.invoiceNumber}</td>
                  <td className="border border-neutral-300 p-2 font-mono">{voucher.controlNumber}</td>
                  <td className="border border-neutral-300 p-2 text-center">
                    {new Date(voucher.invoiceDate).toLocaleDateString('es-VE')}
                  </td>
                  <td className="border border-neutral-300 p-2 text-right font-mono">
                    {formatMoneyUSD(voucher.totalInvoiceAmount)}
                  </td>
                  <td className="border border-neutral-300 p-2 text-right font-mono">
                    {formatMoneyUSD(voucher.taxableBaseAmount)}
                  </td>
                  {isIVA ? (
                    <>
                      <td className="border border-neutral-300 p-2 text-right">{voucher.taxRate || 16}%</td>
                      <td className="border border-neutral-300 p-2 text-right font-mono">
                        {formatMoneyUSD(voucher.taxAmount || 0)}
                      </td>
                      <td className="border border-neutral-300 p-2 text-right">{voucher.retainedPercentage || 75}%</td>
                    </>
                  ) : (
                    <>
                      <td className="border border-neutral-300 p-2">
                        {voucher.conceptCode} - {voucher.conceptDescription}
                      </td>
                      <td className="border border-neutral-300 p-2 text-right">{voucher.ratePercentage}%</td>
                    </>
                  )}
                  <td className="border border-neutral-300 p-2 text-right bg-neutral-100 font-bold font-mono text-neutral-900">
                    {formatMoneyUSD(voucher.retainedAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legal Footnote */}
          <div className="text-[10px] text-neutral-500 leading-tight">
            {isIVA ? (
              <p>
                Este comprobante se emite según lo dispuesto en el artículo 16 de la Providencia
                Administrativa N° SNAT/2015/0049, la cual designa a los Sujetos Pasivos Especiales como
                agentes de retención del Impuesto al Valor Agregado.
              </p>
            ) : (
              <p>
                Este comprobante se emite en cumplimiento de las disposiciones establecidas en el Decreto
                N° 1808 contentivo del Reglamento Parcial de la Ley de Impuesto Sobre la Renta en materia
                de Retenciones.
              </p>
            )}
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
            <div>
              <div className="border-t border-neutral-400 mx-auto w-48 pt-1">
                <p className="font-bold text-neutral-800">AGENTE DE RETENCIÓN</p>
                <p className="text-[10px] text-neutral-500">Firma y Sello Autorizado</p>
              </div>
            </div>
            <div>
              <div className="border-t border-neutral-400 mx-auto w-48 pt-1">
                <p className="font-bold text-neutral-800">SUJETO RETENIDO</p>
                <p className="text-[10px] text-neutral-500">Firma, C.I. y Fecha de Recepción</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 print:hidden">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />
            Imprimir Comprobante
          </Button>
        </div>
      </div>
    </div>
  );
};
