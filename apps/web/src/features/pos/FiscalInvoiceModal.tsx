import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Printer, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoneyUSD, formatMoneyVES, formatExchangeRate } from '../../utils/formatters';

export interface FiscalInvoiceTicketData {
  invoiceId: string;
  invoiceNumber: string;
  controlNumber: string;
  invoiceDate: string;
  cashierName: string;
  customerName: string;
  customerRif: string;
  customerAddress?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
  }>;
  baseExempt: number;
  baseTaxable: number;
  taxAmount: number;
  igtfAmount: number;
  totalUSD: number;
  totalVES: number;
  exchangeRate: number;
  payments: Array<{
    method: string;
    amountUSD: number;
    amountVES: number;
  }>;
}

interface FiscalInvoiceModalProps {
  isOpen: boolean;
  data: FiscalInvoiceTicketData | null;
  onClose: () => void;
  isFiscal?: boolean;
}

export const FiscalInvoiceModal: React.FC<FiscalInvoiceModalProps> = ({
  isOpen,
  data,
  onClose,
  isFiscal = true,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const title = isFiscal ? 'FACTURA FISCAL' : 'TICKET DE VENTA';
    const text = `${title} N° ${data.invoiceNumber}\nCONTROL: ${data.controlNumber}\nCLIENTE: ${data.customerName} (${data.customerRif})\nTOTAL: ${formatMoneyUSD(data.totalUSD)} (${formatMoneyVES(data.totalVES)})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Detalle del ticket copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isFiscal ? 'Factura Fiscal Homologada SENIAT' : 'Ticket de Venta (No Fiscal)'}
      subtitle={`${isFiscal ? 'Factura' : 'Comprobante'}: ${data.invoiceNumber} • Control: ${data.controlNumber}`}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full print:hidden">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-1 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copiado' : 'Copiar'}
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
      {/* Emulated Thermal Ticket */}
      <div className="p-3 bg-neutral-100 dark:bg-neutral-950/80 rounded-lg flex justify-center">
        <div className="w-full bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] leading-tight text-neutral-800 dark:text-neutral-200 space-y-3 print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
          {/* Header */}
          <div className="text-center space-y-0.5 border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-3">
            <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100 print:text-black">DISTRIBUIDORA ERO VE C.A.</div>
            <div className="text-neutral-600 dark:text-neutral-400">RIF: J-40123456-7</div>
            <div className="text-neutral-600 dark:text-neutral-400">SUCURSAL PRINCIPAL CARACAS</div>
            <div className="text-neutral-600 dark:text-neutral-400">AV. FRANCISCO DE MIRANDA, TORRE ERO, CHACAO</div>
            <div className="pt-2 font-bold text-neutral-900 dark:text-neutral-100">
              {isFiscal ? 'FACTURA FISCAL HOMOLOGADA' : 'TICKET DE VENTA'}
            </div>
            <div className="text-neutral-700 dark:text-neutral-300">N° {data.invoiceNumber}</div>
            <div className="text-neutral-600 dark:text-neutral-400">N° CONTROL: {data.controlNumber}</div>
            <div className="text-neutral-600 dark:text-neutral-400">FECHA: {new Date(data.invoiceDate).toLocaleString('es-VE')}</div>
            <div className="text-neutral-600 dark:text-neutral-400">CAJERO: {data.cashierName}</div>
          </div>

          {/* Customer */}
          <div className="border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-2 space-y-0.5">
            <div><span className="font-semibold text-neutral-900 dark:text-neutral-100">CLIENTE:</span> {data.customerName}</div>
            <div><span className="font-semibold text-neutral-900 dark:text-neutral-100">RIF/CI:</span> {data.customerRif}</div>
            {data.customerAddress && <div><span className="font-semibold text-neutral-900 dark:text-neutral-100">DIR:</span> {data.customerAddress}</div>}
          </div>

          {/* Items Header */}
          <div className="border-b border-neutral-300 dark:border-neutral-700 pb-1 flex justify-between font-bold text-[10px] text-neutral-700 dark:text-neutral-300">
            <span className="w-1/2">DESCRIPCION</span>
            <span className="w-1/4 text-right">CANT x PRECIO</span>
            <span className="w-1/4 text-right">TOTAL</span>
          </div>

          {/* Items List */}
          <div className="space-y-1.5 py-1">
            {data.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start text-[10px]">
                <div className="w-1/2 truncate pr-1">
                  <div className="truncate font-medium text-neutral-900 dark:text-neutral-100">{item.name}</div>
                  <div className="text-[9px] text-neutral-500 dark:text-neutral-400">
                    Alícuota: {item.taxRate > 0 ? `${item.taxRate}%` : '(E)'}
                  </div>
                </div>
                <div className="w-1/4 text-right text-neutral-600 dark:text-neutral-300 font-mono">
                  {item.quantity} x {formatMoneyUSD(item.unitPrice)}
                </div>
                <div className="w-1/4 text-right font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                  {formatMoneyUSD(item.total)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-neutral-300 dark:border-neutral-700 pt-2 space-y-1">
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>BASE EXENTA (E):</span>
              <span className="font-mono">{formatMoneyUSD(data.baseExempt)}</span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>BASE IMPONIBLE (G):</span>
              <span className="font-mono">{formatMoneyUSD(data.baseTaxable)}</span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>IVA 16%:</span>
              <span className="font-mono">{formatMoneyUSD(data.taxAmount)}</span>
            </div>
            {data.igtfAmount > 0 && (
              <div className="flex justify-between text-amber-700 dark:text-amber-400">
                <span>IGTF 3%:</span>
                <span className="font-mono font-bold">{formatMoneyUSD(data.igtfAmount)}</span>
              </div>
            )}
            <div className="border-t border-neutral-300 dark:border-neutral-700 pt-1 flex justify-between font-bold text-xs text-neutral-900 dark:text-neutral-100">
              <span>TOTAL USD:</span>
              <span className="font-mono">{formatMoneyUSD(data.totalUSD)}</span>
            </div>
            <div className="flex justify-between text-neutral-500 dark:text-neutral-400 text-[10px]">
              <span>TASA BCV:</span>
              <span className="font-mono">{formatExchangeRate(data.exchangeRate)}</span>
            </div>
            <div className="flex justify-between font-bold text-xs text-sky-700 dark:text-sky-400">
              <span>TOTAL BS.:</span>
              <span className="font-mono">{formatMoneyVES(data.totalVES)}</span>
            </div>
          </div>

          {/* Payments */}
          <div className="border-t border-dashed border-neutral-300 dark:border-neutral-700 pt-2 space-y-1">
            <div className="font-semibold text-[10px] text-neutral-700 dark:text-neutral-300">FORMA DE PAGO:</div>
            {data.payments.map((p, idx) => (
              <div key={idx} className="flex justify-between text-[10px] text-neutral-700 dark:text-neutral-300 font-mono">
                <span>{p.method}:</span>
                <span>{formatMoneyUSD(p.amountUSD)} {p.amountVES > 0 ? `(${formatMoneyVES(p.amountVES)})` : ''}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-dashed border-neutral-300 dark:border-neutral-700 pt-3 text-center space-y-0.5 text-[9px] text-neutral-500 dark:text-neutral-400">
            <div className="font-bold text-neutral-800 dark:text-neutral-200">GRACIAS POR SU COMPRA</div>
            {isFiscal ? (
              <>
                <div>DOCUMENTO EMITIDO BAJO FORMATO FISCAL HOMOLOGADO</div>
                <div className="text-[8px]">PROV. SENIAT SNAT/2011/00071</div>
              </>
            ) : (
              <>
                <div>COMPROBANTE NO FISCAL - CONTROL INTERNO</div>
                <div className="text-[8px]">TICKET DE ENTREGA / VENTA AL PÚBLICO</div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
