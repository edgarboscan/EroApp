import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { ChatModal } from './ChatModal';

export const ChatButton: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);

  const canUseChat = Boolean(
    user?.role === 'super_admin' ||
    user?.role === 'Super Administrador' ||
    user?.role === 'Administrador' ||
    hasPermission('chat', 'read')
  );

  const fetchUnreadTotal = useCallback(async () => {
    if (!token || !canUseChat) return;
    try {
      const res = await fetch('/api/chat/unread-total', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setUnreadTotal(data.data.unreadTotal || 0);
      }
    } catch {
      // Silencioso
    }
  }, [token, canUseChat]);

  // Polling regular cada 15 segundos
  useEffect(() => {
    if (!canUseChat) return;
    fetchUnreadTotal();
    const interval = setInterval(fetchUnreadTotal, 15000);
    return () => clearInterval(interval);
  }, [canUseChat, fetchUnreadTotal]);

  if (!canUseChat) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="relative flex items-center justify-center p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500"
        title="Chat Interno entre Usuarios"
        aria-label="Abrir chat interno"
      >
        <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-white bg-emerald-600 rounded-full animate-in zoom-in shadow-xs">
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        )}
      </button>

      <ChatModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchUnreadTotal();
        }}
        onConversationRead={fetchUnreadTotal}
      />
    </>
  );
};
