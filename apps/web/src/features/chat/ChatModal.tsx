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
  ChevronDown,
  Circle,
  Trash2,
  Info,
  Plus,
  UserMinus,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { EmojiPicker } from './EmojiPicker';

export type ChatStatus = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';

export interface StatusOption {
  value: ChatStatus;
  label: string;
  description: string;
  dotColor: string;
  badgeBg: string;
  textColor: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'ONLINE',
    label: 'En línea',
    description: 'Disponible para interactuar y responder mensajes',
    dotColor: 'bg-emerald-500',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
  {
    value: 'AWAY',
    label: 'Ausente',
    description: 'Temporalmente fuera del puesto de trabajo',
    dotColor: 'bg-amber-500',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  {
    value: 'BUSY',
    label: 'Ocupado',
    description: 'En atención prioritaria, arqueo o reunión',
    dotColor: 'bg-rose-500',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
    textColor: 'text-rose-700 dark:text-rose-400',
  },
  {
    value: 'OFFLINE',
    label: 'Desconectado',
    description: 'Aparecer como desconectado (invisible)',
    dotColor: 'bg-gray-400',
    badgeBg: 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    textColor: 'text-gray-500 dark:text-gray-400',
  },
];

export const getUserStatusConfig = (user?: {
  status?: ChatStatus;
  is_online?: boolean;
  effective_status?: ChatStatus;
}): StatusOption => {
  const isActuallyOnline = user?.is_online ?? false;
  const rawStatus = user?.effective_status || user?.status || (isActuallyOnline ? 'ONLINE' : 'OFFLINE');

  const effective: ChatStatus =
    rawStatus === 'OFFLINE'
      ? 'OFFLINE'
      : rawStatus === 'AWAY'
      ? 'AWAY'
      : rawStatus === 'BUSY'
      ? 'BUSY'
      : isActuallyOnline
      ? 'ONLINE'
      : 'OFFLINE';

  return STATUS_OPTIONS.find((s) => s.value === effective) || STATUS_OPTIONS[3];
};

export interface ChatUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_name: string;
  last_login_at: string | null;
  status?: ChatStatus;
  status_message?: string | null;
  is_online?: boolean;
  effective_status?: ChatStatus;
}

export interface GroupParticipant {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_name: string;
  is_admin: boolean;
  is_online?: boolean;
  status?: ChatStatus;
  effective_status?: ChatStatus;
}

export interface ConversationItem {
  id: string;
  company_id: string;
  type: 'DIRECT' | 'GROUP';
  title?: string | null;
  created_by?: string | null;
  other_user: ChatUser | null;
  participants?: GroupParticipant[];
  participant_count?: number;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
}

export interface ChatMessageItem {
  id: string;
  conversation_id: string;
  company_id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  is_read: number;
  read_at: string | null;
  created_at: string;
  sender_name?: string;
  sender_username?: string;
  sender_role?: string;
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

  // Modo nuevo chat directo
  const [isNewChatOpen, setIsNewChatOpen] = useState<boolean>(false);
  const [availableUsers, setAvailableUsers] = useState<ChatUser[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

  // Modo nuevo grupo
  const [isNewGroupOpen, setIsNewGroupOpen] = useState<boolean>(false);
  const [groupTitle, setGroupTitle] = useState<string>('');
  const [selectedGroupUserIds, setSelectedGroupUserIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Visualizar / Gestionar participantes de grupo
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState<boolean>(false);
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState<boolean>(false);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState<boolean>(false);
  const [usersToAdd, setUsersToAdd] = useState<string[]>([]);

  // Modal para confirmar ocultar / eliminar chat de la lista personal
  const [conversationToHide, setConversationToHide] = useState<ConversationItem | null>(null);
  const [isHidingChat, setIsHidingChat] = useState<boolean>(false);

  // Estado manual de presencia del usuario conectado
  const [myStatus, setMyStatus] = useState<ChatStatus>('ONLINE');
  const [myStatusMessage, setMyStatusMessage] = useState<string>('');
  const [customMessageInput, setCustomMessageInput] = useState<string>('');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState<boolean>(false);
  const [isSavingStatus, setIsSavingStatus] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  // Genera iniciales a partir del nombre completo
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Formato relativo de última conexión
  const formatLastSeen = (lastLoginAt?: string | null) => {
    if (!lastLoginAt) return 'Desconectado';
    const date = new Date(lastLoginAt);
    if (isNaN(date.getTime())) return 'Desconectado';
    return `Últ. vez ${formatTime(lastLoginAt)}`;
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

  // Cargar estado de presencia propio
  const fetchMyStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/chat/my-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMyStatus(data.data.status || 'ONLINE');
        setMyStatusMessage(data.data.statusMessage || '');
        setCustomMessageInput(data.data.statusMessage || '');
      }
    } catch {
      // Silencioso
    }
  }, [token]);

  // Actualizar estado manual del usuario
  const handleUpdateStatus = async (newStatus: ChatStatus, newMsg?: string) => {
    if (!token || isSavingStatus) return;
    setIsSavingStatus(true);
    const msgToSend = newMsg !== undefined ? newMsg : myStatusMessage;
    try {
      const res = await fetch('/api/chat/my-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          message: msgToSend && msgToSend.trim() ? msgToSend.trim() : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMyStatus(newStatus);
        setMyStatusMessage(msgToSend ? msgToSend.trim() : '');
        setIsStatusMenuOpen(false);
      }
    } catch {
      // Silencioso
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Cargar participantes de un grupo
  const fetchGroupParticipants = async (convId: string) => {
    if (!token) return;
    setIsLoadingParticipants(true);
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/participants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setGroupParticipants(data.data);
      }
    } catch {
      // Silencioso
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  // Agregar participantes a un grupo
  const handleAddParticipantsToGroup = async () => {
    if (!token || !selectedConversation || usersToAdd.length === 0) return;
    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation.id}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userIds: usersToAdd }),
      });
      const data = await res.json();
      if (data.success) {
        setUsersToAdd([]);
        setIsAddParticipantOpen(false);
        fetchGroupParticipants(selectedConversation.id);
        fetchConversations(false);
      }
    } catch {
      // Silencioso
    }
  };

  // Expulsar participante o abandonar grupo
  const handleRemoveParticipant = async (targetUserId: string) => {
    if (!token || !selectedConversation) return;
    try {
      const res = await fetch(
        `/api/chat/conversations/${selectedConversation.id}/participants/${targetUserId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (data.success) {
        if (targetUserId === currentUser?.id) {
          setSelectedConversation(null);
          setIsGroupInfoOpen(false);
          fetchConversations(false);
        } else {
          fetchGroupParticipants(selectedConversation.id);
          fetchConversations(false);
        }
      }
    } catch {
      // Silencioso
    }
  };

  // Ocultar / Eliminar conversación de la lista del usuario actual
  const handleConfirmHideChat = async () => {
    if (!token || !conversationToHide || isHidingChat) return;
    setIsHidingChat(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationToHide.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        if (selectedConversation?.id === conversationToHide.id) {
          setSelectedConversation(null);
        }
        setConversationToHide(null);
        fetchConversations(false);
      }
    } catch {
      // Silencioso
    } finally {
      setIsHidingChat(false);
    }
  };

  // Cerrar menú de estado al hacer clic fuera
  useEffect(() => {
    if (!isStatusMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStatusMenuOpen]);

  // Cerrar modal al presionar la tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (conversationToHide) {
          setConversationToHide(null);
          return;
        }
        if (isGroupInfoOpen) {
          setIsGroupInfoOpen(false);
          return;
        }
        if (isNewGroupOpen) {
          setIsNewGroupOpen(false);
          return;
        }
        if (isNewChatOpen) {
          setIsNewChatOpen(false);
          return;
        }
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, conversationToHide, isGroupInfoOpen, isNewGroupOpen, isNewChatOpen, onClose]);

  // Efecto cuando abre el modal
  useEffect(() => {
    if (isOpen) {
      fetchConversations(true);
      fetchMyStatus();
    } else {
      setSelectedConversation(null);
      setIsNewChatOpen(false);
      setIsNewGroupOpen(false);
      setIsGroupInfoOpen(false);
      setIsEmojiPickerOpen(false);
      setIsStatusMenuOpen(false);
      setConversationToHide(null);
    }
  }, [isOpen, fetchConversations, fetchMyStatus]);

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

      if (selectedConversationRef.current?.id === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        setTimeout(() => scrollToBottom(true), 50);
        onConversationReadRef.current?.();
      } else {
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

    const handlePresence = (e: Event) => {
      const customEvent = e as CustomEvent<{
        userId?: string;
        status?: ChatStatus;
        statusMessage?: string | null;
        isOnline?: boolean;
        effectiveStatus?: ChatStatus;
      }>;
      const data = customEvent.detail;
      if (!data || !data.userId) return;

      const { userId, status, statusMessage, isOnline, effectiveStatus } = data;

      if (userId === currentUser?.id) {
        if (status) setMyStatus(status);
        if (statusMessage !== undefined) {
          setMyStatusMessage(statusMessage || '');
          setCustomMessageInput(statusMessage || '');
        }
      }

      const computeEffective = (s?: ChatStatus, online?: boolean, eff?: ChatStatus): ChatStatus => {
        if (eff) return eff;
        if (s === 'OFFLINE') return 'OFFLINE';
        if (s === 'AWAY') return 'AWAY';
        if (s === 'BUSY') return 'BUSY';
        return online ? 'ONLINE' : 'OFFLINE';
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.other_user && c.other_user.id === userId) {
            const newIsOnline = isOnline !== undefined ? isOnline : c.other_user.is_online;
            const newStatus = status ?? c.other_user.status ?? 'ONLINE';
            const newEff = computeEffective(newStatus, newIsOnline, effectiveStatus);
            return {
              ...c,
              other_user: {
                ...c.other_user,
                status: newStatus,
                status_message: statusMessage !== undefined ? statusMessage : c.other_user.status_message,
                is_online: newIsOnline,
                effective_status: newEff,
              },
            };
          }
          return c;
        })
      );

      setSelectedConversation((prev) => {
        if (prev && prev.other_user && prev.other_user.id === userId) {
          const newIsOnline = isOnline !== undefined ? isOnline : prev.other_user.is_online;
          const newStatus = status ?? prev.other_user.status ?? 'ONLINE';
          const newEff = computeEffective(newStatus, newIsOnline, effectiveStatus);
          return {
            ...prev,
            other_user: {
              ...prev.other_user,
              status: newStatus,
              status_message: statusMessage !== undefined ? statusMessage : prev.other_user.status_message,
              is_online: newIsOnline,
              effective_status: newEff,
            },
          };
        }
        return prev;
      });

      setAvailableUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            const newIsOnline = isOnline !== undefined ? isOnline : u.is_online;
            const newStatus = status ?? u.status ?? 'ONLINE';
            const newEff = computeEffective(newStatus, newIsOnline, effectiveStatus);
            return {
              ...u,
              status: newStatus,
              status_message: statusMessage !== undefined ? statusMessage : u.status_message,
              is_online: newIsOnline,
              effective_status: newEff,
            };
          }
          return u;
        })
      );
    };

    window.addEventListener('ero:chat:new_message', handleLiveMessage);
    window.addEventListener('ero:chat:read_receipt', handleReadReceipt);
    window.addEventListener('ero:chat:presence', handlePresence);

    return () => {
      window.removeEventListener('ero:chat:new_message', handleLiveMessage);
      window.removeEventListener('ero:chat:read_receipt', handleReadReceipt);
      window.removeEventListener('ero:chat:presence', handlePresence);
    };
  }, [fetchConversations, currentUser?.id]);

  // Cuando cambia la conversación seleccionada, cargar sus mensajes
  useEffect(() => {
    if (selectedConversation?.id) {
      fetchMessages(selectedConversation.id, true);
      if (selectedConversation.type === 'GROUP') {
        fetchGroupParticipants(selectedConversation.id);
      }
      setTimeout(() => scrollToBottom(false), 150);
      inputRef.current?.focus();
    } else {
      setMessages([]);
      setGroupParticipants([]);
      setIsGroupInfoOpen(false);
    }
  }, [selectedConversation?.id, selectedConversation?.type, fetchMessages]);

  // Scroll automático al llegar mensajes nuevos
  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length]);

  // Búsqueda de usuarios
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
      // Silencioso
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Abrir nuevo chat directo
  const handleOpenNewChat = () => {
    setIsNewChatOpen(true);
    setIsNewGroupOpen(false);
    setUserSearchTerm('');
    searchUsers('');
  };

  // Abrir modal de nuevo grupo
  const handleOpenNewGroup = () => {
    setIsNewGroupOpen(true);
    setIsNewChatOpen(false);
    setGroupTitle('');
    setSelectedGroupUserIds([]);
    setGroupError(null);
    setUserSearchTerm('');
    searchUsers('');
  };

  // Iniciar chat directo con un usuario
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
      // Silencioso
    }
  };

  // Crear grupo institucional con múltiples usuarios
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !groupTitle.trim() || selectedGroupUserIds.length === 0 || isCreatingGroup) {
      setGroupError('Debe ingresar el título del grupo y seleccionar al menos un participante.');
      return;
    }

    setIsCreatingGroup(true);
    setGroupError(null);
    try {
      const res = await fetch('/api/chat/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: groupTitle.trim(),
          participantIds: selectedGroupUserIds,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setIsNewGroupOpen(false);
        setGroupTitle('');
        setSelectedGroupUserIds([]);
        fetchConversations(false);
        setSelectedConversation(data.data);
      } else {
        setGroupError(data.error?.message || 'Error al crear el grupo.');
      }
    } catch (err: any) {
      setGroupError(err.message || 'Error de conexión al crear el grupo.');
    } finally {
      setIsCreatingGroup(false);
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

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessageItem = {
      id: tempId,
      conversation_id: selectedConversation.id,
      company_id: selectedConversation.company_id,
      sender_id: currentUser?.id || '',
      recipient_id: selectedConversation.type === 'DIRECT' ? selectedConversation.other_user?.id || null : null,
      message: text,
      is_read: 0,
      read_at: null,
      created_at: new Date().toISOString(),
      sender_name: currentUser?.fullName || currentUser?.username || 'Yo',
      sender_username: currentUser?.username,
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
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data.data : m)));
        fetchConversations(false);
      }
    } catch {
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
    if (c.type === 'GROUP') {
      return (
        (c.title && c.title.toLowerCase().includes(term)) ||
        (c.last_message && c.last_message.toLowerCase().includes(term))
      );
    }
    if (c.other_user) {
      return (
        c.other_user.full_name.toLowerCase().includes(term) ||
        c.other_user.username.toLowerCase().includes(term) ||
        (c.last_message && c.last_message.toLowerCase().includes(term))
      );
    }
    return false;
  });

  const myStatusCfg = STATUS_OPTIONS.find((s) => s.value === myStatus) || STATUS_OPTIONS[0];

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
        <div className="flex items-center justify-between px-4 py-3 bg-sky-700 text-white select-none shrink-0 relative">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-800/80 rounded-lg">
              <MessageSquare className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide">Chat Interno</h2>
              <p className="text-[11px] text-sky-100">
                Mensajería institucional instantánea, grupos y presencia en línea
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de Estado Manual del Usuario */}
            <div className="relative" ref={statusMenuRef}>
              <button
                type="button"
                onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-sky-800/90 hover:bg-sky-800 text-white rounded-lg border border-sky-600/70 text-xs transition-colors cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-sky-300"
                title="Cambiar mi estado de disponibilidad en el chat"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${myStatusCfg.dotColor} shrink-0 ring-2 ring-white/30`}
                />
                <span className="font-medium hidden sm:inline">{myStatusCfg.label}</span>
                <ChevronDown className="w-3.5 h-3.5 text-sky-200" />
              </button>

              {/* Menú Desplegable de Selección de Estado */}
              {isStatusMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-68 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl py-2 z-50 text-gray-800 dark:text-gray-100 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Mi Estado
                    </p>
                  </div>

                  <div className="p-1 space-y-0.5">
                    {STATUS_OPTIONS.map((opt) => {
                      const isSelected = myStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleUpdateStatus(opt.value)}
                          className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${opt.dotColor} shrink-0 mt-1 ring-2 ring-white dark:ring-gray-900`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{opt.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                              {opt.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Campo de Mensaje de Estado Personalizado */}
                  <div className="p-2.5 border-t border-gray-100 dark:border-gray-800 mt-1">
                    <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Mensaje de estado (opcional):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customMessageInput}
                        onChange={(e) => setCustomMessageInput(e.target.value)}
                        placeholder="Ej. En caja, En reunión..."
                        maxLength={150}
                        className="flex-1 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUpdateStatus(myStatus, customMessageInput);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(myStatus, customMessageInput)}
                        disabled={isSavingStatus}
                        className="px-2.5 py-1 text-[11px] font-medium bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
                      >
                        {isSavingStatus ? '...' : 'OK'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Conversaciones
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleOpenNewChat}
                    className="flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 px-2 py-1 bg-sky-50 dark:bg-sky-950/60 rounded-lg border border-sky-200 dark:border-sky-800 transition-colors cursor-pointer"
                    title="Iniciar nuevo chat directo"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenNewGroup}
                    className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                    title="Crear un nuevo grupo con varios usuarios"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Grupo</span>
                  </button>
                </div>
              </div>

              {/* Barra de Búsqueda */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  placeholder="Buscar chat, grupo o contacto..."
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
                    Usa &quot;Chat&quot; o &quot;Grupo&quot; para iniciar una nueva conversación
                  </p>
                </div>
              )}

              {!isLoadingConvs &&
                filteredConversations.map((conv) => {
                  const isSelected = selectedConversation?.id === conv.id;
                  const isGroup = conv.type === 'GROUP';
                  const statusCfg = conv.other_user ? getUserStatusConfig(conv.other_user) : null;

                  return (
                    <div
                      key={conv.id}
                      className={`group relative w-full p-3 flex items-start gap-3 transition-colors cursor-pointer border-l-3 ${
                        isSelected
                          ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-600 dark:border-sky-500'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800/70 border-transparent'
                      }`}
                      onClick={() => {
                        setSelectedConversation(conv);
                        setIsNewChatOpen(false);
                        setIsNewGroupOpen(false);
                      }}
                    >
                      {/* Avatar */}
                      {isGroup ? (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-sky-700 shrink-0">
                          <Users className="w-5 h-5 text-sky-200" />
                        </div>
                      ) : (
                        <div className="relative shrink-0">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-xs ${getAvatarBg(
                              conv.other_user?.id || conv.id
                            )}`}
                          >
                            {getInitials(conv.other_user?.full_name)}
                          </div>
                          {statusCfg && (
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${statusCfg.dotColor}`}
                              title={
                                conv.other_user?.status_message
                                  ? `${statusCfg.label}: ${conv.other_user.status_message}`
                                  : statusCfg.label
                              }
                            />
                          )}
                        </div>
                      )}

                      {/* Detalles del Chat */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                              {isGroup ? conv.title || 'Grupo' : conv.other_user?.full_name}
                            </span>
                            {isGroup && (
                              <span className="px-1.5 py-0.2 text-[9px] font-medium bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 rounded shrink-0">
                                Grupo
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0 ml-1">
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

                        <div className="flex items-center justify-between mt-0.5 text-[10px]">
                          {isGroup ? (
                            <span className="text-gray-500 dark:text-gray-400 truncate">
                              {conv.participant_count || conv.participants?.length || 2} integrantes
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-medium text-gray-400 dark:text-gray-500 truncate">
                                {conv.other_user?.role_name}
                              </span>
                              {statusCfg && (
                                <>
                                  <span className="text-gray-300 dark:text-gray-700">•</span>
                                  <span className={`font-medium ${statusCfg.textColor} truncate`}>
                                    {statusCfg.label}
                                    {conv.other_user?.status_message ? ` - ${conv.other_user.status_message}` : ''}
                                  </span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Botón rápido para eliminar de mi lista */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConversationToHide(conv);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-600 rounded transition-opacity cursor-pointer shrink-0"
                            title="Eliminar chat de mi lista personal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
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

                    {/* Avatar en cabecera */}
                    {selectedConversation.type === 'GROUP' ? (
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white bg-sky-700 shrink-0">
                        <Users className="w-5 h-5 text-sky-200" />
                      </div>
                    ) : (
                      (() => {
                        const activeStatusCfg = selectedConversation.other_user
                          ? getUserStatusConfig(selectedConversation.other_user)
                          : null;
                        return (
                          <div className="relative shrink-0">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-xs ${getAvatarBg(
                                selectedConversation.other_user?.id || selectedConversation.id
                              )}`}
                            >
                              {getInitials(selectedConversation.other_user?.full_name)}
                            </div>
                            {activeStatusCfg && (
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${activeStatusCfg.dotColor}`}
                                title={
                                  selectedConversation.other_user?.status_message
                                    ? `${activeStatusCfg.label}: ${selectedConversation.other_user.status_message}`
                                    : activeStatusCfg.label
                                }
                              />
                            )}
                          </div>
                        );
                      })()
                    )}

                    <div>
                      {selectedConversation.type === 'GROUP' ? (
                        <>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                              {selectedConversation.title || 'Grupo de Chat'}
                            </h3>
                            <span className="text-[10px] font-medium px-1.5 py-0.2 bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 rounded">
                              Grupo
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            <span>
                              {groupParticipants.length || selectedConversation.participant_count || 'Varios'} participantes
                            </span>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => setIsGroupInfoOpen(true)}
                              className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                            >
                              Ver integrantes
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                              {selectedConversation.other_user?.full_name}
                            </h3>
                            {selectedConversation.other_user?.status_message && (
                              <span className="text-[10px] font-normal px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 truncate max-w-[200px]">
                                {selectedConversation.other_user.status_message}
                              </span>
                            )}
                          </div>
                          {(() => {
                            const activeStatusCfg = selectedConversation.other_user
                              ? getUserStatusConfig(selectedConversation.other_user)
                              : null;
                            if (!activeStatusCfg) return null;
                            return (
                              <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                                <span className="font-medium text-sky-600 dark:text-sky-400">
                                  {selectedConversation.other_user?.role_name}
                                </span>
                                <span>•</span>
                                <span className={`font-medium flex items-center gap-1 ${activeStatusCfg.textColor}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${activeStatusCfg.dotColor}`} />
                                  {activeStatusCfg.label}
                                  {selectedConversation.other_user?.status_message && (
                                    <span className="text-gray-400 font-normal">
                                      - {selectedConversation.other_user.status_message}
                                    </span>
                                  )}
                                  {activeStatusCfg.value === 'OFFLINE' &&
                                    selectedConversation.other_user?.last_login_at && (
                                      <span className="text-gray-400 font-normal">
                                        ({formatLastSeen(selectedConversation.other_user.last_login_at)})
                                      </span>
                                    )}
                                </span>
                                <span>•</span>
                                <span>@{selectedConversation.other_user?.username}</span>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Acciones de Cabecera del Chat */}
                  <div className="flex items-center gap-1.5">
                    {selectedConversation.type === 'GROUP' && (
                      <button
                        type="button"
                        onClick={() => setIsGroupInfoOpen(true)}
                        className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                        title="Ver y gestionar integrantes del grupo"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setConversationToHide(selectedConversation)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar este chat de mi lista personal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`max-w-[80%] sm:max-w-[70%] rounded-lg px-3 py-2 text-xs shadow-2xs ${
                              isMine
                                ? 'bg-sky-600 dark:bg-sky-700 text-white rounded-tr-none'
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-none'
                            }`}
                          >
                            {/* En chats grupales, mostrar el nombre del remitente si no soy yo */}
                            {!isMine && selectedConversation.type === 'GROUP' && (
                              <p className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 mb-1 flex items-center gap-1">
                                <span>{msg.sender_name || 'Participante'}</span>
                                {msg.sender_role && (
                                  <span className="text-[9px] font-normal text-gray-400">
                                    ({msg.sender_role})
                                  </span>
                                )}
                              </p>
                            )}

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
                      placeholder={
                        selectedConversation.type === 'GROUP'
                          ? `Escribe un mensaje para el grupo ${selectedConversation.title || ''}...`
                          : 'Escribe un mensaje aquí...'
                      }
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
                  Selecciona una conversación existente de la lista, o inicia un chat directo o grupal.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenNewChat}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Nuevo Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenNewGroup}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    <span>Nuevo Grupo</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Flotante: Iniciar Chat Directo */}
          {isNewChatOpen && (
            <div className="absolute inset-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs flex flex-col animate-in fade-in duration-100">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-sky-600" />
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
                    No se encontraron usuarios activos con chat habilitado.
                  </div>
                )}

                {!isLoadingUsers &&
                  availableUsers.map((u) => {
                    const uStatusCfg = getUserStatusConfig(u);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleStartChatWithUser(u)}
                        className="w-full p-2.5 flex items-center justify-between hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-xs ${getAvatarBg(
                                u.id
                              )}`}
                            >
                              {getInitials(u.full_name)}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${uStatusCfg.dotColor}`}
                              title={
                                u.status_message ? `${uStatusCfg.label}: ${u.status_message}` : uStatusCfg.label
                              }
                            />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              {u.status_message && (
                                <span className="text-[10px] font-normal px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 truncate max-w-[160px]">
                                  {u.status_message}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                              <span>@{u.username}</span>
                              <span>•</span>
                              <span className={`font-medium ${uStatusCfg.textColor}`}>
                                {uStatusCfg.label}
                                {uStatusCfg.value === 'OFFLINE' && u.last_login_at && (
                                  <span className="text-gray-400 font-normal ml-1">
                                    ({formatLastSeen(u.last_login_at)})
                                  </span>
                                )}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700">
                            {u.role_name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Modal Flotante: Crear Nuevo Grupo */}
          {isNewGroupOpen && (
            <div className="absolute inset-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs flex flex-col animate-in fade-in duration-100">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    Crear Nuevo Grupo de Chat
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewGroupOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {groupError && (
                <div className="m-3 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
                  {groupError}
                </div>
              )}

              <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-gray-200 dark:border-gray-800 space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Título o Nombre del Grupo *
                    </label>
                    <input
                      type="text"
                      required
                      value={groupTitle}
                      onChange={(e) => setGroupTitle(e.target.value)}
                      placeholder="Ej. Operaciones de Caja, Almacén & Logística..."
                      maxLength={150}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Buscar y seleccionar participantes ({selectedGroupUserIds.length} seleccionados):
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={userSearchTerm}
                        onChange={(e) => {
                          setUserSearchTerm(e.target.value);
                          searchUsers(e.target.value);
                        }}
                        placeholder="Buscar por colaborador o cargo..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Lista de selección de participantes */}
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-2">
                  {isLoadingUsers && (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Buscando colaboradores...
                    </div>
                  )}

                  {!isLoadingUsers && availableUsers.length === 0 && (
                    <div className="p-6 text-center text-xs text-gray-400">
                      No hay colaboradores disponibles.
                    </div>
                  )}

                  {!isLoadingUsers &&
                    availableUsers.map((u) => {
                      const isSelected = selectedGroupUserIds.includes(u.id);
                      const uStatusCfg = getUserStatusConfig(u);
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            setSelectedGroupUserIds((prev) =>
                              isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                            );
                          }}
                          className={`w-full p-2.5 flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="relative shrink-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-xs ${getAvatarBg(
                                  u.id
                                )}`}
                              >
                                {getInitials(u.full_name)}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-gray-900 ${uStatusCfg.dotColor}`}
                              />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                {u.full_name}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                @{u.username} • {u.role_name}
                              </p>
                            </div>
                          </div>

                          <span className={`text-[10px] font-medium ${uStatusCfg.textColor}`}>
                            {uStatusCfg.label}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {/* Footer de creación de grupo */}
                <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0">
                  <span className="text-xs text-gray-500">
                    {selectedGroupUserIds.length} usuario(s) seleccionado(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsNewGroupOpen(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingGroup || !groupTitle.trim() || selectedGroupUserIds.length === 0}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
                    >
                      {isCreatingGroup ? 'Creando Grupo...' : 'Crear Grupo'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Modal / Drawer: Ver y Gestionar Integrantes de Grupo */}
          {isGroupInfoOpen && selectedConversation && selectedConversation.type === 'GROUP' && (
            <div className="absolute inset-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs flex flex-col animate-in fade-in duration-100">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    Integrantes del Grupo: {selectedConversation.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsGroupInfoOpen(false);
                    setIsAddParticipantOpen(false);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Botón para agregar más participantes */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/40">
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  Total integrantes: {groupParticipants.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddParticipantOpen(!isAddParticipantOpen);
                    setUsersToAdd([]);
                    searchUsers('');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 rounded-lg hover:bg-sky-100 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Participantes</span>
                </button>
              </div>

              {/* Sub-formulario para agregar integrantes */}
              {isAddParticipantOpen && (
                <div className="p-3 bg-sky-50/60 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-800 space-y-2">
                  <p className="text-[11px] font-semibold text-sky-900 dark:text-sky-200">
                    Seleccione colaboradores para agregar al grupo:
                  </p>
                  <div className="max-h-36 overflow-y-auto divide-y divide-sky-100 dark:divide-sky-900/60 bg-white dark:bg-gray-900 rounded-lg border border-sky-200 dark:border-sky-800 p-1">
                    {availableUsers
                      .filter((u) => !groupParticipants.some((p) => p.id === u.id))
                      .map((u) => {
                        const isChecked = usersToAdd.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setUsersToAdd((prev) =>
                                isChecked ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                              );
                            }}
                            className="p-1.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer text-xs"
                          >
                            <span>
                              {u.full_name} (@{u.username} - {u.role_name})
                            </span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded text-sky-600"
                            />
                          </div>
                        );
                      })}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddParticipantOpen(false)}
                      className="px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={usersToAdd.length === 0}
                      onClick={handleAddParticipantsToGroup}
                      className="px-3 py-1 text-[11px] font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg"
                    >
                      Agregar ({usersToAdd.length})
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Integrantes Actuales */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-2">
                {isLoadingParticipants && (
                  <div className="p-8 text-center text-xs text-gray-400">
                    Cargando integrantes...
                  </div>
                )}

                {!isLoadingParticipants &&
                  groupParticipants.map((p) => {
                    const statusCfg = getUserStatusConfig(p);
                    const isMe = p.id === currentUser?.id;
                    return (
                      <div
                        key={p.id}
                        className="p-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-xs ${getAvatarBg(
                                p.id
                              )}`}
                            >
                              {getInitials(p.full_name)}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-gray-900 ${statusCfg.dotColor}`}
                            />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                              <span>
                                {p.full_name} {isMe && '(Tú)'}
                              </span>
                              {p.is_admin && (
                                <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                                  <Shield className="w-2.5 h-2.5" />
                                  Admin
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              @{p.username} • {p.role_name} •{' '}
                              <span className={statusCfg.textColor}>{statusCfg.label}</span>
                            </p>
                          </div>
                        </div>

                        {/* Botón para abandonar o expulsar */}
                        {isMe ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(p.id)}
                            className="px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800 cursor-pointer"
                          >
                            Abandonar Grupo
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(p.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Expulsar participante"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Modal de Confirmación: Ocultar / Eliminar Chat de la Lista Personal */}
          {conversationToHide && (
            <div
              className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
              onClick={() => !isHidingChat && setConversationToHide(null)}
            >
              <div
                className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl p-5 space-y-3 animate-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      ¿Eliminar conversación de su lista personal?
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      Esta conversación desaparecerá de su bandeja de mensajes hasta que reciba un nuevo mensaje.
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 italic">
                      Nota: Los demás colaboradores y la bitácora institucional conservarán todo el historial intacto.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    disabled={isHidingChat}
                    onClick={() => setConversationToHide(null)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isHidingChat}
                    onClick={handleConfirmHideChat}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
                  >
                    {isHidingChat ? 'Eliminando...' : 'Eliminar de mi lista'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
