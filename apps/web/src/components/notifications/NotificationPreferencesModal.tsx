import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Bell,
  Mail,
  ShieldCheck,
  FileText,
  AlertTriangle,
  DollarSign,
  CreditCard,
  ShoppingCart,
  Check,
  Loader2,
} from 'lucide-react';
import {
  NotificationType,
  notificationTypes,
  notificationTypeLabels,
  UserNotificationPreferenceItem,
} from '@ero/shared';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';

export interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId?: string;
  targetUserName?: string;
}

const getCategoryIcon = (type: NotificationType) => {
  switch (type) {
    case 'REPORT_SHARED':
      return <FileText className="w-4 h-4 text-sky-500" />;
    case 'LOW_STOCK':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'CASH_SHIFT_CLOSED':
      return <DollarSign className="w-4 h-4 text-emerald-500" />;
    case 'CREDIT_LIMIT_EXCEEDED':
      return <CreditCard className="w-4 h-4 text-purple-500" />;
    case 'PURCHASE_ORDER_APPROVED':
      return <ShoppingCart className="w-4 h-4 text-blue-500" />;
    case 'FISCAL_ALERT':
      return <ShieldCheck className="w-4 h-4 text-rose-500" />;
    case 'SYSTEM':
      return <Bell className="w-4 h-4 text-neutral-500" />;
  }
};

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
  targetUserId,
  targetUserName,
}) => {
  const token = useAuthStore((s) => s.token);
  const [preferences, setPreferences] = useState<UserNotificationPreferenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditingOtherUser = Boolean(targetUserId);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPreferences = async () => {
      setLoading(true);
      try {
        const endpoint = targetUserId
          ? `/api/notifications/preferences/${targetUserId}`
          : '/api/notifications/preferences';

        const res = await fetch(endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setPreferences(json.data);
          }
        } else {
          toast.error('Error al cargar preferencias de notificación');
        }
      } catch {
        toast.error('Error de red al consultar preferencias');
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [isOpen, targetUserId, token]);

  const handleToggle = (type: NotificationType, channel: 'inApp' | 'email') => {
    setPreferences((prev) =>
      prev.map((item) =>
        item.type === type ? { ...item, [channel]: !item[channel] } : item
      )
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const endpoint = targetUserId
        ? `/api/notifications/preferences/${targetUserId}`
        : '/api/notifications/preferences';

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ preferences }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          isEditingOtherUser
            ? `Preferencias de notificación de ${targetUserName || 'usuario'} actualizadas`
            : 'Tus preferencias de notificación se han guardado exitosamente'
        );
        onClose();
      } else {
        toast.error(json.error?.message || 'Error al guardar preferencias');
      }
    } catch {
      toast.error('Error de red al actualizar preferencias');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditingOtherUser
          ? `Configurar Notificaciones: ${targetUserName || 'Usuario'}`
          : 'Preferencias de Notificaciones'
      }
      subtitle={
        isEditingOtherUser
          ? 'Establece qué eventos, reportes y alertas operativas recibirá este usuario en el ERP y por correo.'
          : 'Elige los canales y avisos que deseas recibir en el sistema y por correo electrónico.'
      }
      icon={<Bell className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 text-sky-600 dark:text-sky-400 animate-spin" />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Cargando configuración de alertas y avisos...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-sky-50/60 dark:bg-sky-950/30 p-3 rounded-lg border border-sky-100 dark:border-sky-900/40 text-xs text-neutral-600 dark:text-neutral-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span>
                Personaliza las alertas para evitar sobrecarga y recibir solo lo relevante para tus funciones operativas.
              </span>
            </span>
            <div className="hidden sm:flex items-center gap-4 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <Bell className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                <span>Campana (ERP)</span>
              </span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                <span>Correo Electrónico</span>
              </span>
            </div>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
            {preferences.map((pref) => {
              const meta = notificationTypeLabels[pref.type] || {
                label: pref.type,
                description: 'Evento operativo del sistema ERP',
              };

              return (
                <div
                  key={pref.type}
                  className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0 mt-0.5">
                      {getCategoryIcon(pref.type)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block mt-0.5 leading-snug">
                        {meta.description}
                      </span>
                    </div>
                  </div>

                  {/* Interruptores In-App y Email */}
                  <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                    {/* Canal En App */}
                    <label
                      title="Notificaciones en la campana del ERP"
                      className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={pref.inApp}
                        onChange={() => handleToggle(pref.type, 'inApp')}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 cursor-pointer"
                      />
                      <span className="text-[11px] sm:hidden">Campana</span>
                    </label>

                    {/* Canal Email */}
                    <label
                      title="Envío por correo electrónico"
                      className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={pref.email}
                        onChange={() => handleToggle(pref.type, 'email')}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 cursor-pointer"
                      />
                      <span className="text-[11px] sm:hidden">Correo</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
              {preferences.filter((p) => p.inApp || p.email).length} categorías activas
            </span>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" isLoading={saving} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Preferencias</span>
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};

