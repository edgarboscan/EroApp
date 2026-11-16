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
  cashRegisterCode?: string;
  companyTradeName?: string;
  companyLegalName?: string;
  companyRif?: string;
  companyAddress?: string;
  companyPhone?: string;
  customerName: string;
  customerRif: string;
  customerAddress?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discountPercent?: number;
    discountAmount?: number;
    total: number;
  }>;
  baseExempt: number;
  baseTaxable: number;
  taxAmount: number;
  igtfAmount: number;
  totalDiscountUSD?: number;
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
  printerType?: string;
  printerName?: string | null;
}

export const FiscalInvoiceModal: React.FC<FiscalInvoiceModalProps> = ({
  isOpen,
  data,
  onClose,
  isFiscal = true,
  printerType = 'thermal_80mm',
  printerName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  // Calculo de total de descuento acumulado si no vino precalculado
  const computedTotalDiscount =
    data.totalDiscountUSD !== undefined && data.totalDiscountUSD > 0
      ? Number(data.totalDiscountUSD)
      : data.items.reduce((acc, item) => {
          const itemDiscountPct = Number(item.discountPercent || 0);
          const itemDiscountAmt = Number(
            item.discountAmount !== undefined && item.discountAmount > 0
              ? item.discountAmount
              : itemDiscountPct > 0
                ? ((item.quantity * item.unitPrice * itemDiscountPct) / 100).toFixed(2)
                : 0
          );
          return acc + itemDiscountAmt;
        }, 0);

  const handlePrint = () => {
    const ticketElement = document.getElementById('printable-thermal-ticket');
    if (!ticketElement) {
      window.print();
      return;
    }

    // Remover cualquier iframe de impresión previo que haya quedado en el DOM
    const existingFrame = document.getElementById('ticket-print-iframe');
    if (existingFrame) {
      existingFrame.remove();
    }

    const printFrame = document.createElement('iframe');
    printFrame.id = 'ticket-print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '350px';
    printFrame.style.height = '350px';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0.01';
    printFrame.style.pointerEvents = 'none';
    printFrame.style.zIndex = '-9999';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    const paperWidth = printerType === 'thermal_58mm' ? '58mm' : '80mm';
    const contentWidth = printerType === 'thermal_58mm' ? '48mm' : '72mm';

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${isFiscal ? 'Factura Fiscal' : 'Ticket de Venta'} - ${data.invoiceNumber}</title>
          <style>
            @page {
              size: ${paperWidth} auto;
              margin: 0mm;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              color: #000000 !important;
              background-color: transparent !important;
              box-shadow: none !important;
              text-shadow: none !important;
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            body {
              width: ${contentWidth} !important;
              margin: 0 auto !important;
              padding: 4mm 1.5mm !important;
              font-family: monospace, ui-monospace, "Courier New", Courier, monospace !important;
              font-size: 11px !important;
              line-height: 1.25 !important;
            }
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .text-left { text-align: left !important; }
            .font-bold { font-weight: 700 !important; }
            .font-semibold { font-weight: 600 !important; }
            .font-medium { font-weight: 500 !important; }
            .font-mono { font-family: monospace, ui-monospace, "Courier New", Courier, monospace !important; }
            .uppercase { text-transform: uppercase !important; }
            .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
            
            .flex { display: flex !important; }
            .justify-between { justify-content: space-between !important; }
            .justify-center { justify-content: center !important; }
            .items-start { align-items: flex-start !important; }
            .items-center { align-items: center !important; }
            
            .w-full { width: 100% !important; }
            .w-1\\/2 { width: 50% !important; }
            .w-1\\/4 { width: 25% !important; }
            
            .border-b { border-bottom: 1px solid #000000 !important; }
            .border-t { border-top: 1px solid #000000 !important; }
            .border-dashed { border-style: dashed !important; }
            .border-dotted { border-style: dotted !important; }
            
            .space-y-0\\.5 > * + * { margin-top: 2px !important; }
            .space-y-1 > * + * { margin-top: 4px !important; }
            .space-y-3 > * + * { margin-top: 10px !important; }
            
            .p-0 { padding: 0 !important; }
            .py-0\\.5 { padding-top: 2px !important; padding-bottom: 2px !important; }
            .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
            .pb-1 { padding-bottom: 4px !important; }
            .pb-2 { padding-bottom: 6px !important; }
            .pb-3 { padding-bottom: 8px !important; }
            .pt-1 { padding-top: 4px !important; }
            .pt-2 { padding-top: 6px !important; }
            .pt-3 { padding-top: 8px !important; }
            .pr-1 { padding-right: 4px !important; }
            .pl-1 { padding-left: 4px !important; }
            
            .text-xs { font-size: 12px !important; }
            .text-\\[11px\\] { font-size: 11px !important; }
            .text-\\[10px\\] { font-size: 10px !important; }
            .text-\\[9px\\] { font-size: 9px !important; }
            .text-\\[8px\\] { font-size: 8px !important; }
            .leading-tight { line-height: 1.25 !important; }
            .leading-snug { line-height: 1.35 !important; }
          </style>
        </head>
        <body>
          <div id="printable-thermal-ticket">
            ${ticketElement.innerHTML}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.error('Error al imprimir ticket:', err);
        window.print();
      } finally {
        setTimeout(() => {
          try {
            printFrame.remove();
          } catch {}
        }, 1500);
      }
    }, 250);
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
    <>
      {/* Reglas de impresión en caso de activación por teclado (Ctrl+P) */}
      <style>{`
        @media print {
          @page {
            size: ${printerType === 'thermal_58mm' ? '58mm' : '80mm'} auto;
            margin: 0;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body > *:not(#ticket-print-iframe):not([role="dialog"]) {
            display: none !important;
          }
          [role="dialog"] {
            position: static !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          [role="dialog"] > div:first-child {
            display: none !important;
          }
          [role="dialog"] > div:last-child {
            box-shadow: none !important;
            border: none !important;
            max-height: none !important;
            max-width: ${printerType === 'thermal_58mm' ? '58mm' : '80mm'} !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: transparent !important;
            overflow: visible !important;
          }
          [role="dialog"] .border-b:has(button),
          [role="dialog"] .shrink-0,
          .print\\:hidden {
            display: none !important;
          }
          #printable-thermal-ticket {
            display: block !important;
            visibility: visible !important;
            border: none !important;
            box-shadow: none !important;
            width: ${printerType === 'thermal_58mm' ? '48mm' : '72mm'} !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          #printable-thermal-ticket * {
            visibility: visible !important;
            color: #000000 !important;
          }
        }
      `}</style>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isFiscal ? 'Factura Fiscal Homologada SENIAT' : 'Ticket de Venta'}
        subtitle={`${isFiscal ? 'Factura' : 'Comprobante'}: ${data.invoiceNumber} • Control: ${data.controlNumber}${!isFiscal && printerName ? ` • Impresora: ${printerName}` : ''}`}
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
          <div
            id="printable-thermal-ticket"
            className="w-full bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] leading-tight text-neutral-800 dark:text-neutral-200 space-y-3 print:border-none print:shadow-none print:p-0 print:bg-white print:text-black"
          >
            {/* Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-3">
              <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100 uppercase print:text-black">
                {data.companyTradeName || data.companyLegalName || 'DISTRIBUIDORA ERO VE C.A.'}
              </div>
              {data.companyLegalName && data.companyTradeName && data.companyLegalName.toUpperCase() !== data.companyTradeName.toUpperCase() && (
                <div className="text-[10px] text-neutral-600 dark:text-neutral-400 uppercase">
                  {data.companyLegalName}
                </div>
              )}
              <div className="text-neutral-600 dark:text-neutral-400 font-mono text-[10px]">
                RIF: {data.companyRif || 'J-40123456-7'}
              </div>
              {data.companyAddress && (
                <div className="text-neutral-600 dark:text-neutral-400 uppercase leading-tight text-[10px]">
                  {data.companyAddress}
                </div>
              )}
              {data.companyPhone && (
                <div className="text-neutral-600 dark:text-neutral-400 font-mono text-[10px]">
                  TEL: {data.companyPhone}
                </div>
              )}
              <div className="pt-2 font-bold text-neutral-900 dark:text-neutral-100">
                {isFiscal ? 'FACTURA FISCAL HOMOLOGADA' : 'TICKET DE VENTA'}
              </div>
              <div className="text-neutral-700 dark:text-neutral-300 font-mono">N° {data.invoiceNumber}</div>
              <div className="text-neutral-600 dark:text-neutral-400 font-mono">N° CONTROL: {data.controlNumber}</div>
              <div className="text-neutral-600 dark:text-neutral-400">FECHA: {new Date(data.invoiceDate).toLocaleString('es-VE')}</div>
              <div className="text-neutral-600 dark:text-neutral-400 font-mono">
                CAJA: {data.cashRegisterCode || 'CAJA-01'} • CAJERO: {data.cashierName}
              </div>
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
            <div className="space-y-1 py-1">
              {data.items.map((item, idx) => {
                const itemDiscountPct = Number(item.discountPercent || 0);
                const itemDiscountAmt = Number(
                  item.discountAmount !== undefined && item.discountAmount > 0
                    ? item.discountAmount
                    : itemDiscountPct > 0
                      ? ((item.quantity * item.unitPrice * itemDiscountPct) / 100).toFixed(2)
                      : 0
                );
                const hasDiscount = itemDiscountPct > 0 || itemDiscountAmt > 0;

                return (
                  <div key={idx} className="space-y-0.5 py-0.5 border-b border-dotted border-neutral-100 dark:border-neutral-800 last:border-b-0">
                    <div className="flex justify-between items-start text-[10px]">
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
                    {hasDiscount && (
                      <div className="flex justify-between items-center text-[9px] text-emerald-700 dark:text-emerald-400 font-mono pl-1">
                        <span>
                          Desc: -{itemDiscountPct > 0 ? `${itemDiscountPct}%` : ''}{itemDiscountAmt > 0 ? ` (-${formatMoneyUSD(itemDiscountAmt)})` : ''}
                        </span>
                        <span>-{formatMoneyUSD(itemDiscountAmt)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-neutral-300 dark:border-neutral-700 pt-2 space-y-1">
              {computedTotalDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                  <span>TOTAL DESCUENTO:</span>
                  <span className="font-mono">-{formatMoneyUSD(computedTotalDiscount)}</span>
                </div>
              )}
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
    </>
  );
};
