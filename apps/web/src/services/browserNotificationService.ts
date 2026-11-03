/**
 * Servicio de Notificaciones Nativas del Navegador (HTML5 Desktop Notifications)
 * Permite alertar al usuario incluso cuando la pestaña del ERP se encuentra minimizada o en segundo plano.
 */

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'default') {
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  return Notification.permission;
}

export function showBrowserNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
  }
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Solo disparar si la ventana no tiene el foco o está oculta para no saturar al usuario
  const isDocumentHidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';
  if (!isDocumentHidden && document.hasFocus()) {
    return; // Ya está mirando la pantalla, las notificaciones in-app bastan
  }

  try {
    const notification = new Notification(title, {
      body: options?.body || '',
      icon: options?.icon || '/favicon.ico',
      tag: options?.tag,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      options?.onClick?.();
    };

    // Auto cerrar a los 8 segundos
    setTimeout(() => {
      try {
        notification.close();
      } catch {}
    }, 8000);
  } catch {
    // Silencioso en caso de bloqueo por sandbox
  }
}

