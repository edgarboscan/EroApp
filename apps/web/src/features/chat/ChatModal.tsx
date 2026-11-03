import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Send,
  Smile,
  Search,
  UserPlus,
  Check,
  CheckCheck,
  MessageSquare,
  Clock,
  ArrowLeft,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { EmojiPicker } from './EmojiPicker';

interface ChatUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_name: string;
  last_login_at: string | null;
}

interface ConversationItem {
  id: string;
  company_id: string;
  other_user: ChatUser;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
}

interface ChatMessageItem {
  id: string;
  conversation_id: string;
  company_id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  is_read: number;
  read_at: string | null;
  created_at: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationRead?: () => void;
  initialConversationId?: string | null;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  onConversationRead,
  initialConversationId,
}) => {
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState<boolean>(false);
  const [isLoadingConvs, setIsLoadingConvs] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [convSearch, setConvSearch] = useState<string>('');

  // Modo nuevo chat
  const [isNewChatOpen, setIsNewChatOpen] = useState<boolean>(false);
  const [availableUsers, setAvailableUsers] = useState<ChatUser[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Genera iniciales a partir del nombre completo
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Color de fondo para avatar
  const getAvatarBg = (id: string) => {
    const colors = [
      'bg-blue-600',
      'bg-sky-600',
      'bg-indigo-600',
      'bg-amber-600',
      'bg-rose-600',
      'bg-teal-600',
      'bg-purple-600',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Formato relativo de fecha
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
    if (isYesterday) {
      return 'Ayer';
    }
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  };

  const selectedConversationRef = useRef<ConversationItem | null>(null);
  selectedConversationRef.current = selectedConversation;

  const onConversationReadRef = useRef(onConversationRead);
  onConversationReadRef.current = onConversationRead;

  // Cargar lista de conversaciones
  const fetchConversations = useCallback(
    async (showLoading = false) => {
      if (!token) return;
      if (showLoading) setIsLoadingConvs(true);
      try {
        const res = await fetch('/api/chat/conversations', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setConversations(data.data);
          // Si hay una conversación activa, actualizar sus datos sin disparar loop
          const currentSelectedId = selectedConversationRef.current?.id;
          if (currentSelectedId) {
            const updated = data.data.find((c: ConversationItem) => c.id === currentSelectedId);
            if (updated) {
              setSelectedConversation((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
            }
          }
        }
      } catch {
        // Silencioso en polling
      } finally {
        if (showLoading) setIsLoadingConvs(false);
      }
    },
    [token]
  );

  // Cargar mensajes de la conversación activa
  const fetchMessages = useCallback(
    async (convId: string, showLoading = false) => {
      if (!token || !convId) return;
      if (showLoading) setIsLoadingMessages(true);
      try {
        const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setMessages(data.data);
          // Notificar actualización de no leídos al padre
          onConversationReadRef.current?.();
        }
      } catch {
        // Silencioso en polling
      } finally {
        if (showLoading) setIsLoadingMessages(false);
      }
    },
    [token]
  );

  // Scroll al último mensaje
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Cerrar modal al presionar la tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Efecto cuando abre el modal
  useEffect(() => {
    if (isOpen) {
      fetchConversations(true);
    } else {
      setSelectedConversation(null);
      setIsNewChatOpen(false);
      setIsEmojiPickerOpen(false);
    }
  }, [isOpen, fetchConversations]);

  // Polling de conversaciones y mensajes activos cada 4 segundos
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      fetchConversations(false);
      const activeId = selectedConversationRef.current?.id;
      if (activeId) {
        fetchMessages(activeId, false);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, fetchConversations, fetchMessages]);

  // Seleccionar automáticamente conversación si se solicita vía prop
  useEffect(() => {
    if (isOpen && initialConversationId && conversations.length > 0) {
      const target = conversations.find((c) => c.id === initialConversationId);
      if (target) {
        setSelectedConversation(target);
      }
    }
  }, [isOpen, initialConversationId, conversations]);

  // Suscripción a eventos en tiempo real cuando el modal está montado
  useEffect(() => {
    const handleLiveMessage = (e: Event) => {
      const customEvent = e as CustomEvent<{
        message?: ChatMessageItem;
        conversationId?: string;
      }>;
      const { message, conversationId } = customEvent.detail || {};
      if (!message || !conversationId) return;

      // Si el mensaje pertenece a la conversación actualmente en pantalla
      if (selectedConversationRef.current?.id === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        setTimeout(() => scrollToBottom(true), 50);
        // Notificar que se leyó
        onConversationReadRef.current?.();
      } else {
        // Si pertenece a otra conversación, refrescar el listado lateral
        fetchConversations(false);
      }
    };

    const handleReadReceipt = (e: Event) => {
      const customEvent = e as CustomEvent<{ conversationId?: string }>;
      if (selectedConversationRef.current?.id === customEvent.detail?.conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.sender_id === currentUser?.id ? { ...m, is_read: 1 } : m))
        );
      }
    };

    window.addEventListener('ero:chat:new_message', handleLiveMessage);
    window.addEventListener('ero:chat:read_receipt', handleReadReceipt);

    return () => {
      window.removeEventListener('ero:chat:new_message', handleLiveMessage);
      window.removeEventListener('ero:chat:read_receipt', handleReadReceipt);
    };
  }, [fetchConversations, currentUser?.id]);

  // Cuando cambia la conversación seleccionada, cargar sus mensajes
  useEffect(() => {
    if (selectedConversation?.id) {
      fetchMessages(selectedConversation.id, true);
      setTimeout(() => scrollToBottom(false), 150);
      inputRef.current?.focus();
    } else {
      setMessages([]);
    }
  }, [selectedConversation?.id, fetchMessages]);

  // Scroll automático al llegar mensajes nuevos
  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length]);

  // Búsqueda de usuarios para nuevo chat
  const searchUsers = async (query = '') => {
    if (!token) return;
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`/api/chat/users?search=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableUsers(data.data);
      }
    } catch {
      // Manejar error silenciosamente
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Abrir nuevo chat
  const handleOpenNewChat = () => {
    setIsNewChatOpen(true);
    setUserSearchTerm('');
    searchUsers('');
  };

  // Seleccionar usuario para chatear
  const handleStartChatWithUser = async (user: ChatUser) => {
    if (!token) return;
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId: user.id }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setIsNewChatOpen(false);
        setSelectedConversation(data.data);
        fetchConversations(false);
      }
    } catch {
      // Error
    }
  };

  // Enviar mensaje
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text || !selectedConversation || !token || isSending) return;

    setIsSending(true);
    setInputMessage('');
    setIsEmojiPickerOpen(false);

    // Optimistic UI insert
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessageItem = {
      id: tempId,
      conversation_id: selectedConversation.id,
      company_id: selectedConversation.company_id,
      sender_id: currentUser?.id || '',
      recipient_id: selectedConversation.other_user.id,
      message: text,
      is_read: 0,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        // Reemplazar mensaje temporal con el real
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data.data : m)));
        fetchConversations(false);
      }
    } catch {
      // Revertir optimistic si falló
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // Inserción de emoticón en el input
  const handleSelectEmoji = (emoji: string) => {
    setInputMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // Filtrado de conversaciones por búsqueda local
  const filteredConversations = conversations.filter((c) => {
    if (!convSearch.trim()) return true;
    const term = convSearch.toLowerCase();
    return (
      c.other_user.full_name.toLowerCase().includes(term) ||
      c.other_user.username.toLowerCase().includes(term) ||
      (c.last_message && c.last_message.toLowerCase().includes(term))
    );
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[650px] max-h-[92vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Principal del Modal */}
        <div className="flex items-center justify-between px-4 py-3 bg-sky-700 text-white select-none shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-800/80 rounded-lg">
              <MessageSquare className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide">Chat Interno</h2>
              <p className="text-[11px] text-sky-100">
                Mensajería institucional instantánea entre usuarios
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-sky-200 hover:text-white hover:bg-sky-800/60 rounded-lg transition-colors cursor-pointer"
            title="Cerrar chat (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo Dividido (Layout WhatsApp Web) */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Panel Izquierdo: Lista de Conversaciones y Usuarios */}
          <div
            className={`w-full sm:w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900/60 shrink-0 ${
              selectedConversation ? 'hidden sm:flex' : 'flex'
            }`}
          >
            {/* Acciones Superiores de Lista */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Conversaciones
                </span>
                <button
                  type="button"
                  onClick={handleOpenNewChat}
                  className="flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 px-2 py-1 bg-sky-50 dark:bg-sky-950/60 rounded-lg border border-sky-200 dark:border-sky-800 transition-colors cursor-pointer"
                  title="Iniciar nueva conversación con un usuario"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Nuevo Chat</span>
                </button>
              </div>

              {/* Barra de Búsqueda */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  placeholder="Buscar chat o contacto..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Listado de Conversaciones */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
              {isLoadingConvs && (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-sm w-3/4" />
                        <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-sm w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoadingConvs && filteredConversations.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 p-4 text-center">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-2">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    No hay conversaciones activas
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Usa &quot;Nuevo Chat&quot; para buscar un usuario
                  </p>
                </div>
              )}

              {!isLoadingConvs &&
                filteredConversations.map((conv) => {
                  const isSelected = selectedConversation?.id === conv.id;
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => {
                        setSelectedConversation(conv);
                        setIsNewChatOpen(false);
                      }}
                      className={`w-full p-3 flex items-start gap-3 text-left transition-colors cursor-pointer border-l-3 ${
                        isSelected
                          ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-600 dark:border-sky-500'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800/70 border-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-xs shrink-0 ${getAvatarBg(
                          conv.other_user.id
                        )}`}
                      >
                        {getInitials(conv.other_user.full_name)}
                      </div>

                      {/* Detalles del Chat */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                            {conv.other_user.full_name}
                          </span>
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                          <span className="truncate flex-1">
                            {conv.last_message || 'Conversación iniciada'}
                          </span>
                          {conv.unread_count > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sky-600 text-white rounded-full shrink-0">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>

                        <span className="inline-block mt-0.5 text-[9px] font-medium text-gray-400 dark:text-gray-500 truncate">
                          {conv.other_user.role_name}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Panel Derecho: Área de Chat o Selección */}
          <div
            className={`flex-1 flex flex-col bg-gray-100 dark:bg-gray-950 relative ${
              !selectedConversation ? 'hidden sm:flex' : 'flex'
            }`}
          >
            {selectedConversation ? (
              <>
                {/* Cabecera del Chat Activo */}
                <div className="px-4 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedConversation(null)}
                      className="p-1 sm:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
                      title="Volver a la lista de chats"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-xs shrink-0 ${getAvatarBg(
                        selectedConversation.other_user.id
                      )}`}
                    >
                      {getInitials(selectedConversation.other_user.full_name)}
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                        {selectedConversation.other_user.full_name}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-sky-600 dark:text-sky-400">
                          {selectedConversation.other_user.role_name}
                        </span>
                        <span>•</span>
                        <span>@{selectedConversation.other_user.username}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contenedor de Mensajes */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isLoadingMessages && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-xs text-gray-400">
                      <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
                      Cargando mensajes...
                    </div>
                  )}

                  {!isLoadingMessages && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 mb-2">
                        <MessageSquare className="w-6 h-6 text-sky-600" />
                      </div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        No hay mensajes anteriores
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Escribe un mensaje o emoticón para comenzar la conversación
                      </p>
                    </div>
                  )}

                  {messages.map((msg, index) => {
                    const isMine = msg.sender_id === currentUser?.id;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const showDateHeader =
                      !prevMsg ||
                      new Date(prevMsg.created_at).toDateString() !==
                        new Date(msg.created_at).toDateString();

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateHeader && (
                          <div className="flex justify-center my-2">
                            <span className="px-2.5 py-0.5 text-[10px] font-medium bg-gray-200/80 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full shadow-2xs">
                              {new Date(msg.created_at).toLocaleDateString([], {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          </div>
                        )}

                        <div
                          className={`flex flex-col ${
                            isMine ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] sm:max-w-[70%] rounded-lg px-3 py-2 text-xs shadow-2xs ${
                              isMine
                                ? 'bg-sky-600 dark:bg-sky-700 text-white rounded-tr-none'
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words leading-relaxed text-xs">
                              {msg.message}
                            </p>
                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                                isMine ? 'text-sky-100' : 'text-gray-400'
                              }`}
                            >
                              <span>
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {isMine && (
                                <span>
                                  {msg.is_read ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Barra de Entrada de Mensajes */}
                <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0 relative">
                  {isEmojiPickerOpen && (
                    <EmojiPicker
                      onSelectEmoji={handleSelectEmoji}
                      onClose={() => setIsEmojiPickerOpen(false)}
                    />
                  )}

                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                        isEmojiPickerOpen
                          ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      title="Insertar emoticones"
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    <input
                      ref={inputRef}
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Escribe un mensaje aquí..."
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      autoFocus
                    />

                    <button
                      type="submit"
                      disabled={!inputMessage.trim() || isSending}
                      className="p-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white rounded-lg transition-colors cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-sky-400"
                      title="Enviar mensaje (Enter)"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              // Estado Inicial Vacío
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
                <div className="w-16 h-16 rounded-full bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-4 border border-sky-100 dark:border-sky-800">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Bandeja de Mensajes
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mb-4">
                  Selecciona una conversación existente de la lista o busca un usuario para iniciar un nuevo chat.
                </p>
                <button
                  type="button"
                  onClick={handleOpenNewChat}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Nuevo Chat</span>
                </button>
              </div>
            )}
          </div>

          {/* Modal / Overlay Flotante de Nuevo Chat (Búsqueda de usuarios) */}
          {isNewChatOpen && (
            <div className="absolute inset-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs flex flex-col animate-in fade-in duration-100">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    Iniciar Conversación con un Usuario
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Input de Búsqueda de Usuario */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => {
                      setUserSearchTerm(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    placeholder="Buscar por nombre, usuario o email..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Lista de Usuarios */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-2">
                {isLoadingUsers && (
                  <div className="p-8 text-center text-xs text-gray-400">
                    Buscando usuarios activos...
                  </div>
                )}

                {!isLoadingUsers && availableUsers.length === 0 && (
                  <div className="p-8 text-center text-xs text-gray-400">
                    No se encontraron usuarios activos que coincidan con la búsqueda.
                  </div>
                )}

                {!isLoadingUsers &&
                  availableUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleStartChatWithUser(u)}
                      className="w-full p-2.5 flex items-center justify-between hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-xs shrink-0 ${getAvatarBg(
                            u.id
                          )}`}
                        >
                          {getInitials(u.full_name)}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {u.full_name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            @{u.username} • {u.email}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
                          {u.role_name}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
