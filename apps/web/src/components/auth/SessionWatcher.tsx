import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';

export const SessionWatcher: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const recordActivity = useAuthStore((s) => s.recordActivity);
  const checkSessionValidity = useAuthStore((s) => s.checkSessionValidity);
  const sessionExpiredReason = useAuthStore((s) => s.sessionExpiredReason);
  const clearSessionExpiredReason = useAuthStore((s) => s.clearSessionExpiredReason);

  // Mostrar notificación al expirar la sesión
  useEffect(() => {
    if (sessionExpiredReason) {
      toast.error(sessionExpiredReason, { id: 'session-expired', duration: 6000 });
      clearSessionExpiredReason();
    }
  }, [sessionExpiredReason, clearSessionExpiredReason]);

  // Escuchar interacciones para renovar la marca de actividad
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleActivity = () => {
      recordActivity();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    // Verificación periódica cada 30 segundos
    const interval = setInterval(() => {
      checkSessionValidity();
    }, 30_000);

    // Verificar cuando la pestaña recupera el foco
    const handleFocus = () => {
      checkSessionValidity();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, recordActivity, checkSessionValidity]);

  return null;
};
