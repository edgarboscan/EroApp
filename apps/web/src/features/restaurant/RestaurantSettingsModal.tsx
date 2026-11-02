import React, { useState, useEffect } from 'react';
import { Settings, Printer, Save, Check, AlertCircle, FileText, UserCheck, Utensils } from 'lucide-react';
import type { RestaurantSettings, UpdateRestaurantSettingsInput } from '@ero/shared';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';

interface RestaurantSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  activeBranchId: string | null;
  onSettingsUpdated?: (settings: RestaurantSettings) => void;
}

export const RestaurantSettingsModal: React.FC<RestaurantSettingsModalProps> = ({
  isOpen,
  onClose,
  token,
  activeBranchId,
  onSettingsUpdated,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState<UpdateRestaurantSettingsInput>({
    print_order_ticket: true,
    print_waiter_copy: true,
    print_kitchen_ticket: true,
    ticket_print_mode: 'prompt',
    ticket_header: '',
    ticket_footer: '',
    branch_id: activeBranchId,
  });

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeBranchId ? { 'x-branch-id': activeBranchId } : {}),
  });

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchSettings = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch('/api/restaurant/settings', { headers: getHeaders() });
        const json = await res.json();
        if (json.success && json.data && isMounted) {
          setForm({
            print_order_ticket: Boolean(json.data.print_order_ticket),
            print_waiter_copy: Boolean(json.data.print_waiter_copy),
            print_kitchen_ticket: Boolean(json.data.print_kitchen_ticket),
            ticket_print_mode: json.data.ticket_print_mode === 'direct' ? 'direct' : 'prompt',
            ticket_header: json.data.ticket_header || '',
            ticket_footer: json.data.ticket_footer || '',
            branch_id: activeBranchId,
          });
        }
      } catch (err: any) {
        if (isMounted) setErrorMessage(err.message || 'Error al cargar configuración de restaurante');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, [isOpen, activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/restaurant/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          ...form,
          branch_id: activeBranchId,
          ticket_header: form.ticket_header?.trim() || null,
          ticket_footer: form.ticket_footer?.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al guardar la configuración');
      }

      toast.success('Configuración de restaurante actualizada exitosamente');
      if (onSettingsUpdated && json.data) {
        onSettingsUpdated(json.data);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar configuración');
      toast.error(err.message || 'Error al guardar configuración');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configuración de Pedidos e Impresión de Comandas"
      subtitle="Defina las políticas de impresión de tickets para clientes, saloneros y cocina"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSaving || isLoading}>
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-10 text-center text-xs text-neutral-400 dark:text-neutral-500">
          Cargando configuración de restaurante...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Opciones de Tickets a Imprimir */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-neutral-900 dark:text-neutral-100">
              Documentos a Imprimir en la Toma de Pedidos
            </label>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Seleccione qué comprobantes térmicos deben generarse al abrir, confirmar o solicitar la cuenta de la comanda:
            </p>

            <div className="space-y-2">
              {/* 1. Recibo de Comanda (Precuenta) */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-neutral-800 transition-colors">
                <input
                  type="checkbox"
                  checked={Boolean(form.print_order_ticket)}
                  onChange={(e) => setForm({ ...form, print_order_ticket: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700"
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100">
                    <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Recibo de Comanda / Precuenta (Para el Cliente)</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Ticket con desglose de consumos, subtotal, propina sugerida y conversión a tasa oficial BCV entregado a los comensales antes de pagar.
                  </span>
                </div>
              </label>

              {/* 2. Copia para el Salonero */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-neutral-800 transition-colors">
                <input
                  type="checkbox"
                  checked={Boolean(form.print_waiter_copy)}
                  onChange={(e) => setForm({ ...form, print_waiter_copy: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700"
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Copia de Comanda para el Salonero / Mesero</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Ticket de control para el mesonero con número de mesa, lista de platos servidos, observaciones y control de servicio de sala.
                  </span>
                </div>
              </label>

              {/* 3. Comanda para Cocina / Barra */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-neutral-800 transition-colors">
                <input
                  type="checkbox"
                  checked={Boolean(form.print_kitchen_ticket)}
                  onChange={(e) => setForm({ ...form, print_kitchen_ticket: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700"
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100">
                    <Utensils className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Comanda de Preparación (Cocina / Barra)</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Imprime la comanda de producción física con notas de preparación (sin cebolla, bien cocido, etc.) al enviar productos desde la mesa.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Modo de Impresión (Directo vs Preguntar) */}
          <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <label className="block text-xs font-bold text-neutral-900 dark:text-neutral-100">
              Modo de Impresión al Gestionar la Comanda *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-colors ${
                  form.ticket_print_mode === 'prompt'
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-neutral-900 dark:text-neutral-100 ring-1 ring-sky-500'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750'
                }`}
              >
                <input
                  type="radio"
                  name="restaurantPrintMode"
                  checked={form.ticket_print_mode === 'prompt'}
                  onChange={() => setForm({ ...form, ticket_print_mode: 'prompt' })}
                  className="w-4 h-4 mt-0.5 text-sky-600 focus:ring-sky-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Preguntar al Usuario</span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Muestra un diálogo de confirmación para decidir si se imprime el recibo o la comanda del salonero.
                  </span>
                </div>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-colors ${
                  form.ticket_print_mode === 'direct'
                    ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-neutral-900 dark:text-neutral-100 ring-1 ring-sky-500'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750'
                }`}
              >
                <input
                  type="radio"
                  name="restaurantPrintMode"
                  checked={form.ticket_print_mode === 'direct'}
                  onChange={() => setForm({ ...form, ticket_print_mode: 'direct' })}
                  className="w-4 h-4 mt-0.5 text-sky-600 focus:ring-sky-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Imprimir Directamente</span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Envía de inmediato a la impresora de ticket configurada sin confirmación adicional.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Encabezado y Pie de Página de Tickets de Restaurante */}
          <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <div>
              <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Encabezado Personalizado del Ticket (Opcional)
              </label>
              <input
                type="text"
                value={form.ticket_header || ''}
                onChange={(e) => setForm({ ...form, ticket_header: e.target.value })}
                placeholder="ej: ¡Bienvenidos a Restaurant & Lounge!"
                maxLength={255}
                className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Pie de Página Personalizado del Ticket (Opcional)
              </label>
              <input
                type="text"
                value={form.ticket_footer || ''}
                onChange={(e) => setForm({ ...form, ticket_footer: e.target.value })}
                placeholder="ej: Propina no incluida. ¡Gracias por su preferencia!"
                maxLength={255}
                className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};

