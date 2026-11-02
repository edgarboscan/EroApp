import { create } from 'zustand';
import { toast } from 'sonner';
import { NotificationItem } from '@ero/shared';
import { useAuthStore } from './authStore';

// Campana auditiva sutil con Web Audio API (sin dependencias de archivos externos)
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Silencioso ante restricciones de política de audio del navegador
  }
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  hasInitialFetch: boolean;
  sharedReportToView: { endpoint: string; title: string } | null;
  pollNotifications: (notifyOnNew?: boolean) => Promise<void>;
  fetchNotifications: (onlyUnread?: boolean) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  openSharedReport: (endpoint: string, title: string) => void;
  closeSharedReport: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  hasInitialFetch: false,
  sharedReportToView: null,

  pollNotifications: async (notifyOnNew = true) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) return;

      const freshList: NotificationItem[] = json.data;
      const currentList = get().notifications;
      const hasInitial = get().hasInitialFetch;
      const currentIds = new Set(currentList.map((n) => n.id));

      // Si no es la primera carga y se solicita alertar de nuevos arribos
      if (notifyOnNew && hasInitial) {
        const newlyArrived = freshList.filter((n) => !n.isRead && !currentIds.has(n.id));

        if (newlyArrived.length > 0) {
          playNotificationChime();

          for (const item of newlyArrived) {
            const reportEndpoint = item.data?.reportEndpoint;
            const reportTitle = item.data?.reportTitle || item.title;

            if (item.type === 'REPORT_SHARED' && reportEndpoint) {
              toast.info(item.title, {
                description: item.message,
                duration: 9000,
                action: {
                  label: 'Ver Reporte',
                  onClick: () => {
                    get().openSharedReport(reportEndpoint, reportTitle);
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
          }
        }
      }

      const unread = json.unreadCount ?? freshList.filter((n) => !n.isRead).length;

      set({
        notifications: freshList,
        unreadCount: unread,
        hasInitialFetch: true,
      });
    } catch {
      // Falla silenciosa de red para evitar interrupciones al usuario durante sondeo en background
    }
  },

  fetchNotifications: async (onlyUnread = false) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    set({ isLoading: true });
    try {
      const url = `/api/notifications${onlyUnread ? '?onlyUnread=true' : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({
            notifications: json.data,
            unreadCount: json.unreadCount ?? json.data.filter((n: NotificationItem) => !n.isRead).length,
            hasInitialFetch: true,
          });
        }
      }
    } catch (error) {
      console.error('[NotificationStore] Error fetching notifications:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      const res = await fetch('/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          set({ unreadCount: Number(json.data.count || 0) });
        }
      }
    } catch {
      // Ignorar fallas silenciosas en polling
    }
  },

  markAsRead: async (id: string) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    // Actualización optimista
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.unreadCount !== undefined) {
          set({ unreadCount: json.data.unreadCount });
        }
      }
    } catch (error) {
      console.error('[NotificationStore] Error marking notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    // Actualización optimista
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      })),
      unreadCount: 0,
    }));

    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('[NotificationStore] Error marking all as read:', error);
    }
  },

  deleteNotification: async (id: string) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const notifToDelete = get().notifications.find((n) => n.id === id);
    const wasUnread = notifToDelete && !notifToDelete.isRead;

    // Actualización optimista
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));

    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('[NotificationStore] Error deleting notification:', error);
    }
  },

  openSharedReport: (endpoint: string, title: string) => {
    set({ sharedReportToView: { endpoint, title } });
  },

  closeSharedReport: () => {
    set({ sharedReportToView: null });
  },
}));

