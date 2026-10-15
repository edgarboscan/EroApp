import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Printer, Copy, Check, X, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoneyUSD } from '../../utils/formatters';

export interface FiscalReportData {
  id?: string;
  reportType: 'X' | 'Z';
  zNumber?: number | null;
  cashRegisterCode: string;
  fiscalPrinterSerial: string;
  reportDate: string;
  invoicesCount: number;
  firstInvoiceNumber: string;
  lastInvoiceNumber: string;
  baseExempt: number;
  baseTaxableGeneral: number;
  taxGeneral: number;
  igtfAmount: number;
  totalSales: number;
  formattedText?: string;
}

interface FiscalReportModalProps {
  data: FiscalReportData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FiscalReportModal: React.FC<FiscalReportModalProps> = ({ data, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  const handleCopy = () => {
    if (data.formattedText) {
      navigator.clipboard.writeText(data.formattedText);
      setCopied(true);
      toast.success('Texto del reporte copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(data.reportDate).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = new Date(data.reportDate).toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                {data.reportType === 'Z'
                  ? `Reporte Fiscal Z (Cierre Diario SENIAT ${data.zNumber ? `N° ${data.zNumber}` : ''})`
                  : 'Reporte Fiscal X (Corte Parcial de Auditoría)'}
              </h3>
              <p className="text-xs text-neutral-500">
                Caja {data.cashRegisterCode} • Serial: {data.fiscalPrinterSerial}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ticket Térmico Emulado */}
        <div className="flex-1 p-5 overflow-y-auto bg-neutral-100/70 flex justify-center">
          <div className="w-full max-w-sm bg-white p-5 rounded-lg shadow-sm border border-neutral-200 font-mono text-[11px] leading-tight text-neutral-800 space-y-3 print:border-none print:shadow-none print:p-0">
            {/* Header Ticket */}
            <div className="text-center space-y-0.5 border-b border-dashed border-neutral-300 pb-3">
              <div className="font-bold text-xs">DISTRIBUIDORA ERO VE C.A.</div>
              <div>RIF: J-40123456-7</div>
              <div>SUCURSAL PRINCIPAL CARACAS</div>
              <div>AV. FRANCISCO DE MIRANDA, TORRE ERO, CHACAO</div>
              <div className="text-[10px] text-neutral-500">ZONA POSTAL 1060 - CARACAS, VENEZUELA</div>
            </div>

            {/* Document Details */}
            <div className="text-center font-bold text-xs py-1 border-b border-dashed border-neutral-300">
              {data.reportType === 'Z' ? '*** REPORTE DE CIERRE FISCAL (Z) ***' : '*** REPORTE PARCIAL DE CAJA (X) ***'}
            </div>

            <div className="space-y-1">
              {data.reportType === 'Z' && (
                <div className="flex justify-between font-bold">
                  <span>NUMERO REPORTE Z:</span>
                  <span>Z-{data.zNumber?.toString().padStart(4, '0')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>CAJA REGISTRADORA:</span>
                <span>{data.cashRegisterCode}</span>
              </div>
              <div className="flex justify-between">
                <span>SERIAL IMPRESORA:</span>
                <span>{data.fiscalPrinterSerial}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA DE EMISIÓN:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>HORA DE EMISIÓN:</span>
                <span>{formattedTime}</span>
              </div>
            </div>

            {/* Invoice Range */}
            <div className="border-t border-b border-dashed border-neutral-300 py-2 space-y-1">
              <div className="flex justify-between">
                <span>PRIMERA FACTURA:</span>
                <span className="font-bold">{data.firstInvoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>ULTIMA FACTURA:</span>
                <span className="font-bold">{data.lastInvoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>CANT. DOCUMENTOS:</span>
                <span className="font-bold">{data.invoicesCount}</span>
              </div>
            </div>

            {/* Fiscal Breakdown */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span>VENTAS EXENTAS (E):</span>
                <span>{formatMoneyUSD(data.baseExempt)}</span>
              </div>
              <div className="flex justify-between">
                <span>BASE IMPONIBLE (G 16%):</span>
                <span>{formatMoneyUSD(data.baseTaxableGeneral)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>IMPUESTO IVA (16%):</span>
                <span>{formatMoneyUSD(data.taxGeneral)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>IMPUESTO IGTF (3% DIVISAS):</span>
                <span>{formatMoneyUSD(data.igtfAmount)}</span>
              </div>
            </div>

            {/* Total */}
            <div className="border-t-2 border-neutral-800 pt-2 flex justify-between font-bold text-xs">
              <span>TOTAL VENTAS BRUTAS:</span>
              <span>{formatMoneyUSD(data.totalSales)}</span>
            </div>

            {/* Fiscal Footer */}
            <div className="border-t border-dashed border-neutral-300 pt-3 text-center space-y-0.5 text-[9px] text-neutral-500">
              <div>MEMORIA FISCAL AUDITADA</div>
              <div>COMPROBANTE EMITIDO CONFORME A PROVIDENCIA</div>
              <div>ADMINISTRATIVA SENIAT SNAT/2011/00071</div>
              <div className="font-bold pt-1">*** FIN DEL COMPROBANTE FISCAL ***</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-1 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copiado' : 'Copiar Texto'}
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir Ticket
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
