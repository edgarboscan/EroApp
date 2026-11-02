import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  FileText,
  AlertTriangle,
  DollarSign,
  CreditCard,
  ShoppingCart,
  ShieldCheck,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { NotificationItem, NotificationType } from '@ero/shared';
import { NotificationPreferencesModal } from './NotificationPreferencesModal';

export const NotificationBell: React.FC = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    pollNotifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    openSharedReport,
  } = useNotificationStore();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Polling continuo en tiempo real (cada 6 segundos + evento de foco / cambio de pestaña)
  useEffect(() => {
    // 1. Verificación inicial inmediata
    pollNotifications(false);

    // 2. Intervalo periódico en tiempo real cada 6 segundos
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        pollNotifications(true);
      }
    }, 6000);

    // 3. Verificación inmediata al reenfocar la ventana o volver a la pestaña del ERP
    const handleRecheck = () => {
      if (document.visibilityState === 'visible') {
        pollNotifications(true);
      }
    };

    window.addEventListener('focus', handleRecheck);
    window.addEventListener('online', handleRecheck);
    document.addEventListener('visibilitychange', handleRecheck);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleRecheck);
      window.removeEventListener('online', handleRecheck);
      document.removeEventListener('visibilitychange', handleRecheck);
    };
  }, [pollNotifications]);

  // Al abrir el popover, refrescar la lista completa
  const handleTogglePopover = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      pollNotifications(false);
    }
  };

  // Cerrar popover al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }

    // Si es un reporte compartido y contiene la ruta, abrirlo en el visor de PDF
    if (notif.data?.reportEndpoint) {
      openSharedReport(
        notif.data.reportEndpoint,
        notif.data.reportTitle || notif.title
      );
      setIsOpen(false);
    }
  };

  const filteredList = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const getIcon = (type: NotificationType) => {
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
      default:
        return <Bell className="w-4 h-4 text-neutral-500" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSecs < 60) return 'Hace un momento';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `Hace ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Botón de la Campana */}
      <button
        type="button"
        onClick={handleTogglePopover}
        title="Centro de Notificaciones"
        className="relative flex items-center justify-center p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <Bell className="w-4 h-4 shrink-0" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Desplegable */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl z-50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-3 flex items-center justify-between bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                Notificaciones
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-mono text-[10px] font-bold">
                  {unreadCount} nuevas
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 ">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  title="Marcar todas como leídas"
                  className="flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Leídas</span>
                </button>
              )}
            </div>
          </div>

          {/* Filtros */}
          <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-medium bg-neutral-50/30 dark:bg-neutral-850/50">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`flex-1 py-1.5 text-center transition-colors cursor-pointer ${
                filter === "all"
                  ? "border-b-2 border-sky-600 font-bold text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`flex-1 py-1.5 text-center transition-colors cursor-pointer ${
                filter === "unread"
                  ? "border-b-2 border-sky-600 font-bold text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              No leídas ({unreadCount})
            </button>
          </div>

          {/* Lista de Notificaciones */}
          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
            {isLoading && notifications.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-400">
                <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
                <span className="text-xs">Cargando avisos...</span>
              </div>
            ) : filteredList.length > 0 ? (
              filteredList.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 flex items-start gap-3 transition-colors cursor-pointer group ${
                    !n.isRead
                      ? "bg-sky-50/40 dark:bg-sky-950/20 hover:bg-sky-50/70 dark:hover:bg-sky-950/40"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shrink-0 mt-0.5 shadow-2xs">
                    {getIcon(n.type)}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs block truncate ${
                          !n.isRead
                            ? "font-bold text-neutral-900 dark:text-neutral-100"
                            : "font-medium text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {n.message}
                    </p>

                    {n.data?.reportEndpoint && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 font-semibold mt-1 hover:underline">
                        <ExternalLink className="w-3 h-3" />
                        <span>Abrir reporte en el visor</span>
                      </span>
                    )}
                  </div>

                  {/* Acciones al pasar el cursor */}
                  <div className="flex items-center gap-1 shrink-0 self-center">
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}
                      title="Eliminar notificación"
                      className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-xs text-neutral-400 dark:text-neutral-500">
                <Bell className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <p>
                  No tienes notificaciones{" "}
                  {filter === "unread" ? "pendientes" : "recientes"}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 flex items-center justify-between hidden">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowPreferencesModal(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] tbg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg font-medium transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-neutral-500" />
              <span>Configurar notificaciones</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Configuración de Preferencias */}
      <NotificationPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />
    </div>
  );
};

