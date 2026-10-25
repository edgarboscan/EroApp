import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Printer, Copy, Check } from 'lucide-react';
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

  const title = data.reportType === 'Z'
    ? `Reporte Fiscal Z (Cierre Diario SENIAT ${data.zNumber ? `N° ${data.zNumber}` : ''})`
    : 'Reporte Fiscal X (Corte Parcial de Auditoría)';

  const subtitle = `Caja ${data.cashRegisterCode} • Serial: ${data.fiscalPrinterSerial}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full print:hidden">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-1 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4 mr-1" />}
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
      }
    >
      {/* Ticket Térmico Emulado */}
      <div className="p-3 bg-neutral-100 dark:bg-neutral-950/80 rounded-lg flex justify-center">
        <div className="w-full max-w-sm bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] leading-tight text-neutral-800 dark:text-neutral-200 space-y-3 print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
          {/* Header Ticket */}
          <div className="text-center space-y-0.5 border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-3">
            <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100 print:text-black">DISTRIBUIDORA ERO VE C.A.</div>
            <div className="text-neutral-600 dark:text-neutral-400">RIF: J-40123456-7</div>
            <div className="text-neutral-600 dark:text-neutral-400">SUCURSAL PRINCIPAL CARACAS</div>
            <div className="text-neutral-600 dark:text-neutral-400">AV. FRANCISCO DE MIRANDA, TORRE ERO, CHACAO</div>
            <div className="text-[10px] text-neutral-500 dark:text-neutral-400">ZONA POSTAL 1060 - CARACAS, VENEZUELA</div>
          </div>

          {/* Document Details */}
          <div className="text-center font-bold text-xs py-1 border-b border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100">
            {data.reportType === 'Z' ? '*** REPORTE DE CIERRE FISCAL (Z) ***' : '*** REPORTE PARCIAL DE CAJA (X) ***'}
          </div>

          <div className="space-y-1 text-neutral-700 dark:text-neutral-300">
            {data.reportType === 'Z' && (
              <div className="flex justify-between font-bold text-neutral-900 dark:text-neutral-100">
                <span>NUMERO REPORTE Z:</span>
                <span>Z-{data.zNumber?.toString().padStart(4, '0')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>CAJA REGISTRADORA:</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{data.cashRegisterCode}</span>
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
          <div className="border-t border-b border-dashed border-neutral-300 dark:border-neutral-700 py-2 space-y-1 text-neutral-700 dark:text-neutral-300">
            <div className="flex justify-between">
              <span>PRIMERA FACTURA:</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">{data.firstInvoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>ULTIMA FACTURA:</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">{data.lastInvoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>CANT. DOCUMENTOS:</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">{data.invoicesCount}</span>
            </div>
          </div>

          {/* Fiscal Breakdown */}
          <div className="space-y-1.5 text-neutral-700 dark:text-neutral-300">
            <div className="flex justify-between">
              <span>VENTAS EXENTAS (E):</span>
              <span className="font-mono">{formatMoneyUSD(data.baseExempt)}</span>
            </div>
            <div className="flex justify-between">
              <span>BASE IMPONIBLE (G 16%):</span>
              <span className="font-mono">{formatMoneyUSD(data.baseTaxableGeneral)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>IMPUESTO IVA (16%):</span>
              <span className="font-mono">{formatMoneyUSD(data.taxGeneral)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>IMPUESTO IGTF (3% DIVISAS):</span>
              <span className="font-mono">{formatMoneyUSD(data.igtfAmount)}</span>
            </div>
          </div>

          {/* Total */}
          <div className="border-t-2 border-neutral-800 dark:border-neutral-200 pt-2 flex justify-between font-bold text-xs text-neutral-900 dark:text-neutral-100">
            <span>TOTAL VENTAS BRUTAS:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatMoneyUSD(data.totalSales)}</span>
          </div>

          {/* Fiscal Footer */}
          <div className="border-t border-dashed border-neutral-300 dark:border-neutral-700 pt-3 text-center space-y-0.5 text-[9px] text-neutral-500 dark:text-neutral-400">
            <div>MEMORIA FISCAL AUDITADA</div>
            <div>COMPROBANTE EMITIDO CONFORME A PROVIDENCIA</div>
            <div>ADMINISTRATIVA SENIAT SNAT/2011/00071</div>
            <div className="font-bold pt-1 text-neutral-700 dark:text-neutral-300">*** FIN DEL COMPROBANTE FISCAL ***</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
