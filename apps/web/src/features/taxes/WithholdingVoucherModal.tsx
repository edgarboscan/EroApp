import React from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Printer, FileText } from 'lucide-react';
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
    <Modal
      isOpen={Boolean(voucher)}
      onClose={onClose}
      title={`Comprobante Oficial SENIAT (${voucher.type})`}
      subtitle={`N° ${voucher.voucherNumber} • Período: ${voucher.taxPeriod}`}
      size="3xl"
      footer={
        <div className="flex items-center justify-between w-full print:hidden">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.open(`/api/taxes/withholdings/${voucher.id}/pdf`, '_blank');
            }}
            title="Descargar o Ver PDF Oficial"
          >
            <FileText className="w-4 h-4 mr-1 text-sky-600 dark:text-sky-400" />
            Ver PDF Oficial
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" />
              Imprimir Comprobante
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Printable Voucher Paper */}
        <div className="p-4 sm:p-6 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 space-y-4 text-xs font-sans print:border-none print:p-0 print:bg-white print:text-black">
          {/* Header Title */}
          <div className="text-center border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide text-neutral-900 dark:text-neutral-100 print:text-black">
              {isIVA
                ? 'COMPROBANTE DE RETENCIÓN DEL IMPUESTO AL VALOR AGREGADO (IVA)'
                : 'COMPROBANTE DE RETENCIÓN DE IMPUESTO SOBRE LA RENTA (ISLR)'}
            </h1>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 print:text-neutral-600">
              {isIVA
                ? '(Ley de IVA - Providencia Administrativa SENIAT SNAT/2015/0049 - Art. 16)'
                : '(Reglamento de la Ley de ISLR en materia de Retenciones - Decreto N° 1808)'}
            </p>
          </div>

          {/* Identification Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 print:bg-neutral-50">
            <div>
              <p className="font-semibold text-neutral-900 dark:text-neutral-200 text-[11px] uppercase tracking-wider mb-1">
                Agente de Retención
              </p>
              <p className="font-bold text-neutral-900 dark:text-neutral-100">DISTRIBUIDORA ERO VE, C.A.</p>
              <p className="text-neutral-600 dark:text-neutral-400">RIF: J-40123456-7</p>
              <p className="text-neutral-600 dark:text-neutral-400">Av. Francisco de Miranda, Caracas, Venezuela</p>
            </div>
            <div>
              <p className="font-semibold text-neutral-900 dark:text-neutral-200 text-[11px] uppercase tracking-wider mb-1">
                Datos del Comprobante
              </p>
              <p>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">N° Comprobante:</span>{' '}
                <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{voucher.voucherNumber}</span>
              </p>
              <p>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">Período Fiscal:</span>{' '}
                <span className="font-mono text-neutral-800 dark:text-neutral-200">{voucher.taxPeriod}</span>
                {voucher.fortnight && (
                  <span className="ml-1 text-neutral-500 dark:text-neutral-400">
                    ({voucher.fortnight === 'FIRST' ? '1ra Quincena' : '2da Quincena'})
                  </span>
                )}
              </p>
              <p>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">Fecha Emisión:</span>{' '}
                <span className="text-neutral-800 dark:text-neutral-200">{new Date().toLocaleDateString('es-VE')}</span>
              </p>
            </div>
          </div>

          {/* Supplier Section */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 print:bg-neutral-50">
            <p className="font-semibold text-neutral-900 dark:text-neutral-200 text-[11px] uppercase tracking-wider mb-1">
              Sujeto Retenido (Proveedor)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <p>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">Nombre / Razón Social:</span>{' '}
                <span className="text-neutral-900 dark:text-neutral-100">{voucher.supplierName}</span>
              </p>
              <p>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">RIF:</span>{' '}
                <span className="font-mono text-neutral-900 dark:text-neutral-100">{voucher.supplierRif}</span>
              </p>
            </div>
          </div>

          {/* Voucher Table */}
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
            <table className="w-full border-collapse text-[11px]">
              <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="p-2 text-left border-r border-neutral-200 dark:border-neutral-700">Factura</th>
                  <th className="p-2 text-left border-r border-neutral-200 dark:border-neutral-700">Control</th>
                  <th className="p-2 text-center border-r border-neutral-200 dark:border-neutral-700">Fecha</th>
                  <th className="p-2 text-right border-r border-neutral-200 dark:border-neutral-700">Total Factura</th>
                  <th className="p-2 text-right border-r border-neutral-200 dark:border-neutral-700">Base Imponible</th>
                  {isIVA ? (
                    <>
                      <th className="p-2 text-right border-r border-neutral-200 dark:border-neutral-700">Alícuota</th>
                      <th className="p-2 text-right border-r border-neutral-200 dark:border-neutral-700">IVA Total</th>
                      <th className="p-2 text-right border-r border-neutral-200 dark:border-neutral-700">% Ret.</th>
                    </>
                  ) : (
                    <>
                      <th className="p-2 text-left border-r border-neutral-200 dark:border-neutral-700">Concepto</th>
                      <th className="p-2 text-right border-r border-neutral-200 dark:border-neutral-700">Tarifa</th>
                    </>
                  )}
                  <th className="p-2 text-right bg-neutral-200/80 dark:bg-neutral-700 font-bold text-neutral-900 dark:text-neutral-100">
                    Monto Retenido
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                <tr>
                  <td className="p-2 font-mono font-medium border-r border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100">{voucher.invoiceNumber}</td>
                  <td className="p-2 font-mono border-r border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">{voucher.controlNumber}</td>
                  <td className="p-2 text-center border-r border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
                    {new Date(voucher.invoiceDate).toLocaleDateString('es-VE')}
                  </td>
                  <td className="p-2 text-right font-mono border-r border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100">
                    {formatMoneyUSD(voucher.totalInvoiceAmount)}
                  </td>
                  <td className="p-2 text-right font-mono border-r border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100">
                    {formatMoneyUSD(voucher.taxableBaseAmount)}
                  </td>
                  {isIVA ? (
                    <>
                      <td className="p-2 text-right border-r border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">{voucher.taxRate || 16}%</td>
                      <td className="p-2 text-right font-mono border-r border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100">
                        {formatMoneyUSD(voucher.taxAmount || 0)}
                      </td>
                      <td className="p-2 text-right border-r border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">{voucher.retainedPercentage || 75}%</td>
                    </>
                  ) : (
                    <>
                      <td className="p-2 border-r border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                        {voucher.conceptCode} - {voucher.conceptDescription}
                      </td>
                      <td className="p-2 text-right border-r border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">{voucher.ratePercentage}%</td>
                    </>
                  )}
                  <td className="p-2 text-right bg-neutral-100 dark:bg-neutral-800/80 font-bold font-mono text-neutral-900 dark:text-emerald-400">
                    {formatMoneyUSD(voucher.retainedAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legal Footnote */}
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
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
              <div className="border-t border-neutral-400 dark:border-neutral-600 mx-auto w-48 pt-1">
                <p className="font-bold text-neutral-800 dark:text-neutral-200">AGENTE DE RETENCIÓN</p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Firma y Sello Autorizado</p>
              </div>
            </div>
            <div>
              <div className="border-t border-neutral-400 dark:border-neutral-600 mx-auto w-48 pt-1">
                <p className="font-bold text-neutral-800 dark:text-neutral-200">SUJETO RETENIDO</p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Firma, C.I. y Fecha de Recepción</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
