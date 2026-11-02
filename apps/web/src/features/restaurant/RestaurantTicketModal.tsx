import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Printer, Copy, Check, FileText, UserCheck, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import type { RestaurantOrder, RestaurantTable, RestaurantSettings } from '@ero/shared';
import { formatMoneyUSD, formatMoneyVES, formatExchangeRate } from '../../utils/formatters';

interface RestaurantTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: RestaurantOrder | null;
  table: RestaurantTable | null;
  settings?: RestaurantSettings | null;
  defaultType?: 'order_ticket' | 'waiter_copy' | 'kitchen_ticket';
}

export const RestaurantTicketModal: React.FC<RestaurantTicketModalProps> = ({
  isOpen,
  onClose,
  order,
  table,
  settings,
  defaultType = 'order_ticket',
}) => {
  const [activeTab, setActiveTab] = useState<'order_ticket' | 'waiter_copy' | 'kitchen_ticket'>(defaultType);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const ticketTitle =
      activeTab === 'order_ticket'
        ? 'RECIBO DE COMANDA (PRECUENTA)'
        : activeTab === 'waiter_copy'
        ? 'COPIA DE COMANDA - SALONERO'
        : 'COMANDA DE PREPARACIÓN (COCINA / BARRA)';

    let text = `${ticketTitle}\n`;
    text += `COMANDA: ${order.order_number}\n`;
    text += `MESA: #${table?.table_number || order.table_number || 'N/A'} - ${table?.name || order.table_name || 'Salón'}\n`;
    text += `MOZO / SALONERO: ${order.waiter_name || 'Sin asignar'}\n`;
    text += `FECHA: ${new Date().toLocaleString('es-VE')}\n`;
    text += `--------------------------------\n`;

    const items = order.items || [];
    items.forEach((item) => {
      text += `${item.quantity}x ${item.product_name} - ${formatMoneyUSD(item.subtotal_usd || (item.unit_price_usd * item.quantity))}\n`;
      if (item.notes) text += `   Nota: ${item.notes}\n`;
    });

    text += `--------------------------------\n`;
    text += `TOTAL USD: ${formatMoneyUSD(order.total_usd)}\n`;
    text += `TOTAL VES: ${formatMoneyVES(order.total_ves)}\n`;
    if (order.exchange_rate && order.exchange_rate > 1) {
      text += `TASA OFICIAL BCV: ${formatExchangeRate(order.exchange_rate)}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Detalle de comanda copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const items = order.items || [];
  const kitchenItems = items.filter((i) => i.station === 'KITCHEN');
  const barItems = items.filter((i) => i.station === 'BAR');
  const displayItems = activeTab === 'kitchen_ticket' ? items : items;

  const tip10USD = order.total_usd * 0.10;
  const tip15USD = order.total_usd * 0.15;
  const exchangeRate = order.exchange_rate || 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        activeTab === 'order_ticket'
          ? 'Recibo de Comanda / Precuenta'
          : activeTab === 'waiter_copy'
          ? 'Copia de Comanda para Salonero'
          : 'Comanda de Cocina / Barra'
      }
      subtitle={`Comanda ${order.order_number} • Mesa #${table?.table_number || order.table_number || ''}`}
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
      <div className="space-y-3">
        {/* Selector de pestañas de ticket */}
        <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('order_ticket')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'order_ticket'
                ? 'bg-white dark:bg-neutral-900 text-sky-700 dark:text-sky-300 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Recibo / Precuenta</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('waiter_copy')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'waiter_copy'
                ? 'bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Copia Salonero</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kitchen_ticket')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'kitchen_ticket'
                ? 'bg-white dark:bg-neutral-900 text-amber-700 dark:text-amber-300 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Cocina / Barra</span>
          </button>
        </div>

        {/* Emulated Thermal Ticket */}
        <div className="p-3 bg-neutral-100 dark:bg-neutral-950/80 rounded-lg flex justify-center">
          <div className="w-full bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] leading-tight text-neutral-800 dark:text-neutral-200 space-y-3 print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
            {/* Header del Ticket */}
            <div className="text-center space-y-0.5 border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-2.5">
              <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100 print:text-black uppercase">
                DISTRIBUIDORA ERO VE - RESTAURANTE
              </div>
              {settings?.ticket_header && (
                <div className="text-[10px] text-neutral-500 italic dark:text-neutral-400">
                  {settings.ticket_header}
                </div>
              )}
              <div className="font-bold text-[11px] mt-1 text-sky-700 dark:text-sky-400 print:text-black">
                {activeTab === 'order_ticket'
                  ? '*** RECIBO DE CONSUMO / PRECUENTA ***'
                  : activeTab === 'waiter_copy'
                  ? '*** COPIA SALONERO / CONTROL DE MESA ***'
                  : '*** COMANDA DE PREPARACIÓN ***'}
              </div>
            </div>

            {/* Metadatos de la Comanda */}
            <div className="space-y-0.5 text-[10px] text-neutral-600 dark:text-neutral-400 border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-2">
              <div className="flex justify-between">
                <span>Comanda:</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Mesa:</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  #{table?.table_number || order.table_number || 'N/A'} - {table?.name || order.table_name || 'Salón'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Salonero / Mozo:</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">{order.waiter_name || 'Sin asignar'}</span>
              </div>
              {order.customer_name && (
                <div className="flex justify-between">
                  <span>Cliente:</span>
                  <span>{order.customer_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Fecha / Hora:</span>
                <span>{new Date().toLocaleString('es-VE')}</span>
              </div>
            </div>

            {/* Listado de Platos / Ítems */}
            <div className="space-y-1.5 border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-2.5">
              <div className="flex justify-between text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400">
                <span>Cant / Descripción</span>
                {activeTab !== 'kitchen_ticket' && <span>Importe</span>}
              </div>

              {displayItems.length === 0 ? (
                <div className="py-2 text-center text-neutral-400 italic text-[10px]">
                  No hay ítems registrados en la comanda
                </div>
              ) : (
                displayItems.map((item, idx) => (
                  <div key={item.id || idx} className="space-y-0.5">
                    <div className="flex justify-between items-start">
                      <span className="flex-1 pr-2">
                        <strong className="text-neutral-900 dark:text-neutral-100">{item.quantity}x</strong>{' '}
                        {item.product_name}
                        {activeTab === 'kitchen_ticket' && (
                          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                            {item.station}
                          </span>
                        )}
                      </span>
                      {activeTab !== 'kitchen_ticket' && (
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 shrink-0">
                          {formatMoneyUSD(item.subtotal_usd || (item.unit_price_usd * item.quantity))}
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 pl-4 italic">
                        ↳ Obs: {item.notes}
                      </div>
                    )}
                    {item.customer_name && (
                      <div className="text-[9px] text-neutral-400 pl-4">
                        Comensal: {item.customer_name}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Totales y Liquidación */}
            {activeTab !== 'kitchen_ticket' ? (
              <div className="space-y-1 text-right border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-2">
                <div className="flex justify-between text-[10px]">
                  <span>Subtotal USD:</span>
                  <span className="font-semibold">{formatMoneyUSD(order.total_usd)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  <span>TOTAL USD:</span>
                  <span>{formatMoneyUSD(order.total_usd)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-sky-700 dark:text-sky-400">
                  <span>TOTAL BS. (BCV):</span>
                  <span>{formatMoneyVES(order.total_ves)}</span>
                </div>
                {exchangeRate > 1 && (
                  <div className="text-[9px] text-neutral-400">
                    Tasa Oficial BCV: {formatExchangeRate(exchangeRate)}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-[10px] text-neutral-500 py-1">
                Total Platos / Bebidas a preparar: {displayItems.reduce((acc, i) => acc + Number(i.quantity), 0)}
              </div>
            )}

            {/* Sugerencia de Propina (Para Recibo de Cliente) */}
            {activeTab === 'order_ticket' && (
              <div className="bg-neutral-50 dark:bg-neutral-800/60 p-2 rounded border border-neutral-200 dark:border-neutral-700 text-[10px] space-y-0.5">
                <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Propina sugerida por buen servicio (Opcional):
                </div>
                <div className="flex justify-between">
                  <span>Propina 10%:</span>
                  <span>{formatMoneyUSD(tip10USD)} ({formatMoneyVES(tip10USD * exchangeRate)})</span>
                </div>
                <div className="flex justify-between">
                  <span>Propina 15%:</span>
                  <span>{formatMoneyUSD(tip15USD)} ({formatMoneyVES(tip15USD * exchangeRate)})</span>
                </div>
              </div>
            )}

            {/* Firma del Salonero (Para Copia Salonero) */}
            {activeTab === 'waiter_copy' && (
              <div className="pt-4 pb-2 text-center text-[10px] space-y-3">
                <div className="border-t border-neutral-400 dark:border-neutral-600 w-36 mx-auto" />
                <div className="text-neutral-500">Firma Salonero / Mesero</div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-[10px] text-neutral-500 dark:text-neutral-400 space-y-0.5 pt-1">
              <div>{settings?.ticket_footer || '¡Gracias por su visita! Vuelva pronto.'}</div>
              <div className="text-[9px] text-neutral-400">Documento no fiscal emitido para control interno</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

