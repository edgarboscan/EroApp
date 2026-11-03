import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { playChatSound, playNotificationSound } from '../services/soundService';
import { requestNotificationPermission, showBrowserNotification } from '../services/browserNotificationService';
import { NotificationItem } from '@ero/shared';

export function useRealtimeSync() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const openSharedReport = useNotificationStore((s) => s.openSharedReport);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token || !user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Solicitar permiso de notificaciones de escritorio en segundo plano
    requestNotificationPermission().catch(() => {});

    // Construir conexión EventSource (SSE)
    const streamUrl = `/api/realtime/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    // 1. Mensaje de Chat entrante
    es.addEventListener('chat:message', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const { senderName, text, conversationId, unreadTotal } = data;

        // Sonido de chat
        playChatSound();

        // Alerta Toast interactiva
        toast('Mensaje de ' + (senderName || 'Colaborador'), {
          description: text && text.length > 80 ? text.substring(0, 80) + '...' : text,
          duration: 7000,
          action: {
            label: 'Responder',
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent('ero:open_chat', {
                  detail: { conversationId },
                })
              );
            },
          },
        });

        // Notificación nativa si la pestaña no está visible
        showBrowserNotification(`Nuevo mensaje de ${senderName || 'Colaborador'}`, {
          body: text,
          tag: `chat_${conversationId}`,
          onClick: () => {
            window.dispatchEvent(
              new CustomEvent('ero:open_chat', {
                detail: { conversationId },
              })
            );
          },
        });

        // Notificar a componentes locales (ChatButton, ChatModal)
        window.dispatchEvent(
          new CustomEvent('ero:chat:new_message', {
            detail: data,
          })
        );

        if (typeof unreadTotal === 'number') {
          window.dispatchEvent(
            new CustomEvent('ero:chat:unread_update', {
              detail: { unreadTotal },
            })
          );
        }
      } catch (err) {
        console.error('[RealtimeSync] Error procesando chat:message:', err);
      }
    });

    // 2. Actualización de contador de chat no leídos
    es.addEventListener('chat:unread', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        window.dispatchEvent(
          new CustomEvent('ero:chat:unread_update', {
            detail: data,
          })
        );
      } catch {}
    });

    // 3. Confirmación de lectura (doble check)
    es.addEventListener('chat:read', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        window.dispatchEvent(
          new CustomEvent('ero:chat:read_receipt', {
            detail: data,
          })
        );
      } catch {}
    });

    // 4. Notificaciones del sistema y reportes compartidos
    es.addEventListener('notification:new', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const item: NotificationItem = data.notification;

        if (!item) return;

        // Sonido de campana
        playNotificationSound();

        // Actualizar store global de notificaciones
        useNotificationStore.setState((prev) => {
          const exists = prev.notifications.some((n) => n.id === item.id);
          if (exists) return prev;
          return {
            notifications: [item, ...prev.notifications],
            unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : prev.unreadCount + 1,
          };
        });

        // Mostrar Toast según el tipo de notificación
        const reportEndpoint = item.data?.reportEndpoint;
        const reportTitle = item.data?.reportTitle || item.title;

        if (item.type === 'REPORT_SHARED' && reportEndpoint) {
          toast.info(item.title, {
            description: item.message,
            duration: 9000,
            action: {
              label: 'Ver Reporte',
              onClick: () => {
                openSharedReport(reportEndpoint, reportTitle);
              },
            },
          });
        } else if (item.type === 'LOW_STOCK' || item.type === 'FISCAL_ALERT') {
          toast.warning(item.title, {
            description: item.message,
            duration: 7000,
          });
        } else if (item.type === 'PURCHASE_ORDER_APPROVED') {
          toast.success(item.title, {
            description: item.message,
            duration: 6000,
          });
        } else {
          toast.info(item.title, {
            description: item.message,
            duration: 6000,
          });
        }

        // Notificación nativa de escritorio
        showBrowserNotification(item.title, {
          body: item.message,
          tag: `notif_${item.id}`,
          onClick: () => {
            if (item.type === 'REPORT_SHARED' && reportEndpoint) {
              openSharedReport(reportEndpoint, reportTitle);
            }
          },
        });
      } catch (err) {
        console.error('[RealtimeSync] Error procesando notification:new:', err);
      }
    });

    // 5. Manejador de errores
    es.onerror = () => {
      // EventSource intentará reconectar automáticamente
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [token, user, openSharedReport]);
}

