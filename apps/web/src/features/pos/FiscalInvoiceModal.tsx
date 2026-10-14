import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Printer, Copy, Check, X, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

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
}

export const FiscalInvoiceModal: React.FC<FiscalInvoiceModalProps> = ({ isOpen, data, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const text = `FACTURA FISCAL N° ${data.invoiceNumber}\nCONTROL: ${data.controlNumber}\nCLIENTE: ${data.customerName} (${data.customerRif})\nTOTAL: $${data.totalUSD.toFixed(2)} (Bs. ${data.totalVES.toFixed(2)})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Detalle de factura copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-emerald-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Venta Facturada con Éxito</h3>
              <p className="text-xs text-neutral-600 font-mono">
                Factura: {data.invoiceNumber} • Control: {data.controlNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Emulated Thermal Ticket */}
        <div className="flex-1 p-5 overflow-y-auto bg-neutral-100/70 flex justify-center">
          <div className="w-full bg-white p-5 rounded-lg shadow-sm border border-neutral-200 font-mono text-[11px] leading-tight text-neutral-800 space-y-3 print:border-none print:shadow-none print:p-0">
            {/* Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-neutral-300 pb-3">
              <div className="font-bold text-xs">DISTRIBUIDORA ERO VE C.A.</div>
              <div>RIF: J-40123456-7</div>
              <div>SUCURSAL PRINCIPAL CARACAS</div>
              <div>AV. FRANCISCO DE MIRANDA, TORRE ERO, CHACAO</div>
              <div className="text-[10px] text-neutral-500">CARACAS, VENEZUELA</div>
            </div>

            {/* Invoice Info */}
            <div className="space-y-1 py-1 border-b border-dashed border-neutral-300">
              <div className="flex justify-between font-bold">
                <span>FACTURA SENIAT:</span>
                <span>{data.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>NRO. CONTROL:</span>
                <span>{data.controlNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA:</span>
                <span>{new Date(data.invoiceDate).toLocaleString('es-VE')}</span>
              </div>
              <div className="flex justify-between">
                <span>CAJERO:</span>
                <span>{data.cashierName}</span>
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-1 py-1 border-b border-dashed border-neutral-300">
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-semibold text-right max-w-[180px] truncate">{data.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>RIF / CI:</span>
                <span>{data.customerRif}</span>
              </div>
              {data.customerAddress && (
                <div className="text-[10px] text-neutral-500 truncate">
                  DIR: {data.customerAddress}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2 py-1 border-b border-dashed border-neutral-300">
              <div className="text-[10px] font-bold text-neutral-500 grid grid-cols-12">
                <span className="col-span-6">DESCRIPCIÓN</span>
                <span className="col-span-2 text-center">CANT</span>
                <span className="col-span-2 text-right">PRECIO</span>
                <span className="col-span-2 text-right">TOTAL</span>
              </div>
              {data.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 text-[11px] items-baseline">
                  <div className="col-span-6 truncate pr-1">
                    <span>{it.name}</span>
                    <span className="text-[9px] text-neutral-400 block">
                      {it.taxRate === 0 ? '(E)' : `(IVA ${it.taxRate}%)`}
                    </span>
                  </div>
                  <div className="col-span-2 text-center">{it.quantity}</div>
                  <div className="col-span-2 text-right">${it.unitPrice.toFixed(2)}</div>
                  <div className="col-span-2 text-right font-semibold">${it.total.toFixed(2)}</div>
                </div>
              ))}
            </div>

            {/* Tax Summary */}
            <div className="space-y-1 text-right">
              {data.baseExempt > 0 && (
                <div className="flex justify-between">
                  <span>EXENTO (E):</span>
                  <span>${data.baseExempt.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>BASE IMPONIBLE (G 16%):</span>
                <span>${data.baseTaxable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA (16%):</span>
                <span>${data.taxAmount.toFixed(2)}</span>
              </div>
              {data.igtfAmount > 0 && (
                <div className="flex justify-between text-indigo-700 font-semibold">
                  <span>IGTF (3% DIVISAS):</span>
                  <span>${data.igtfAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t-2 border-neutral-800 pt-1.5 flex justify-between font-bold text-xs">
                <span>TOTAL A PAGAR:</span>
                <span>${data.totalUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-500 text-[10px]">
                <span>TASA BCV: Bs. {data.exchangeRate.toFixed(2)}</span>
                <span>Bs. {data.totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Payments */}
            <div className="border-t border-dashed border-neutral-300 pt-2 space-y-1">
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Formas de Pago:</span>
              {data.payments.map((p, idx) => (
                <div key={idx} className="flex justify-between text-[10px]">
                  <span>{p.method}:</span>
                  <span>${p.amountUSD.toFixed(2)} {p.amountVES > 0 ? `(Bs. ${p.amountVES.toFixed(2)})` : ''}</span>
                </div>
              ))}
            </div>

            {/* Fiscal Footer */}
            <div className="border-t border-dashed border-neutral-300 pt-3 text-center space-y-0.5 text-[9px] text-neutral-500">
              <div className="font-bold">GRACIAS POR SU COMPRA</div>
              <div>DOCUMENTO EMITIDO BAJO FORMATO FISCAL HOMOLOGADO</div>
              <div className="text-[8px]">PROV. SENIAT SNAT/2011/00071</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-1 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1" />}
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
      </div>
    </div>
  );
};
