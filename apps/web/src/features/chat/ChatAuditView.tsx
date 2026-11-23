import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  User,
  MessageSquare,
  RefreshCw,
  Download,
  Clock,
  ArrowRight,
  Eye,
  CheckCheck,
  Check,
  Trash2,
  Users,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface ChatAuditUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_name: string;
  last_login_at: string | null;
}

interface AuditConversation {
  id: string;
  company_id: string;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  created_by?: string | null;
  user1: ChatAuditUser | null;
  user2: ChatAuditUser | null;
  participant_names?: string | null;
  last_message: string | null;
  last_message_at: string;
  total_messages: number;
  created_at: string;
}

interface AuditMessageDetail {
  id: string;
  conversation_id: string;
  company_id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  is_read: number;
  read_at: string | null;
  created_at: string;
  sender_name: string;
  sender_username: string;
  sender_role: string;
  recipient_name: string | null;
  recipient_username: string | null;
  recipient_role: string | null;
}

export const ChatAuditView: React.FC = () => {
  const token = useAuthStore((s) => s.token);

  const [conversations, setConversations] = useState<AuditConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<AuditConversation | null>(null);
  const [transcript, setTranscript] = useState<AuditMessageDetail[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('');
  const [usersList, setUsersList] = useState<ChatAuditUser[]>([]);

  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState<boolean>(false);

  // Modal de Depuración por Rango de Fecha
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState<boolean>(false);
  const [purgeDateFrom, setPurgeDateFrom] = useState<string>('');
  const [purgeDateTo, setPurgeDateTo] = useState<string>('');
  const [purgeConfirmationText, setPurgeConfirmationText] = useState<string>('');
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [purgeNotification, setPurgeNotification] = useState<string | null>(null);
  const [purgeErrorMessage, setPurgeErrorMessage] = useState<string | null>(null);

  // Cargar lista de usuarios para filtro
  useEffect(() => {
    if (!token) return;
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/chat/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setUsersList(data.data);
        }
      } catch {
        // Ignorar
      }
    };
    fetchUsers();
  }, [token]);

  const selectedConvRef = useRef<AuditConversation | null>(null);
  selectedConvRef.current = selectedConversation;

  // Cargar lista de conversaciones auditables
  const fetchAuditConversations = useCallback(async () => {
    if (!token) return;
    setIsLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedUserFilter) params.append('userId', selectedUserFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const res = await fetch(`/api/chat/audit/conversations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setConversations(data.data);
        // Si hay una conversación seleccionada, mantenerla actualizada sin disparar re-fetch
        const currentSelectedId = selectedConvRef.current?.id;
        if (currentSelectedId) {
          const match = data.data.find((c: AuditConversation) => c.id === currentSelectedId);
          if (match) {
            setSelectedConversation((prev) => (prev?.id === match.id ? { ...prev, ...match } : prev));
          }
        }
      }
    } catch {
      // Ignorar error
    } finally {
      setIsLoadingList(false);
    }
  }, [token, searchTerm, selectedUserFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchAuditConversations();
  }, [fetchAuditConversations]);

  // Cargar transcripción de conversación seleccionada
  const loadTranscript = async (conv: AuditConversation) => {
    setSelectedConversation(conv);
    if (!token) return;
    setIsLoadingTranscript(true);
    try {
      const res = await fetch(`/api/chat/audit/conversations/${conv.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTranscript(data.data);
      }
    } catch {
      // Ignorar
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  // Exportar transcripción a formato texto / archivo de bitácora
  const handleExportTranscript = () => {
    if (!selectedConversation || transcript.length === 0) return;

    const participantsText =
      selectedConversation.type === 'GROUP'
        ? `Grupo: ${selectedConversation.title || 'Grupo'} (Participantes: ${selectedConversation.participant_names || 'Varios'})`
        : `Participantes: ${selectedConversation.user1?.full_name} (@${selectedConversation.user1?.username} - ${selectedConversation.user1?.role_name}) y ${selectedConversation.user2?.full_name} (@${selectedConversation.user2?.username} - ${selectedConversation.user2?.role_name})`;

    const header = `BITACORA DE CHAT - ERO ERP\nID Conversacion: ${selectedConversation.id}\nTipo: ${selectedConversation.type}\n${participantsText}\nFecha Generacion: ${new Date().toLocaleString()}\nTotal Mensajes: ${transcript.length}\n${'='.repeat(70)}\n\n`;

    const lines = transcript.map((m) => {
      const dateStr = new Date(m.created_at).toLocaleString();
      const readStr = m.is_read ? `[Leido: ${new Date(m.read_at || m.created_at).toLocaleString()}]` : '[No leido]';
      const targetStr = m.recipient_name ? `-> ${m.recipient_name}` : '-> [Todos en el Grupo]';
      return `[${dateStr}] ${m.sender_name} (@${m.sender_username} - ${m.sender_role}) ${targetStr}: \n"${m.message}" ${readStr}\n`;
    });

    const fullText = header + lines.join('\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filenamePrefix =
      selectedConversation.type === 'GROUP'
        ? `bitacora_grupo_${(selectedConversation.title || 'grupo').replace(/\s+/g, '_')}`
        : `bitacora_chat_${selectedConversation.user1?.username || 'u1'}_${selectedConversation.user2?.username || 'u2'}`;
    link.setAttribute('download', `${filenamePrefix}_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Ejecutar depuración de mensajes por rango de fechas
  const handleExecutePurge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purgeDateFrom || !purgeDateTo) {
      setPurgeErrorMessage('Debe especificar tanto la fecha inicial como la fecha final.');
      return;
    }
    if (purgeConfirmationText.trim().toUpperCase() !== 'ELIMINAR') {
      setPurgeErrorMessage('Debe escribir exactamente ELIMINAR para confirmar la operación.');
      return;
    }

    setIsPurging(true);
    setPurgeErrorMessage(null);

    try {
      const res = await fetch('/api/chat/audit/range', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dateFrom: purgeDateFrom,
          dateTo: purgeDateTo,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPurgeNotification(data.message || 'Depuración completada exitosamente.');
        setIsPurgeModalOpen(false);
        setPurgeConfirmationText('');
        setPurgeDateFrom('');
        setPurgeDateTo('');
        setSelectedConversation(null);
        setTranscript([]);
        fetchAuditConversations();
      } else {
        setPurgeErrorMessage(data.error?.message || 'Error al depurar mensajes.');
      }
    } catch (err: any) {
      setPurgeErrorMessage(err.message || 'Error de conexión al depurar mensajes.');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Notificación de Depuración */}
      {purgeNotification && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in">
          <span>{purgeNotification}</span>
          <button
            type="button"
            onClick={() => setPurgeNotification(null)}
            className="p-1 text-emerald-600 hover:text-emerald-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Bitácora & Historial de Chat
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Supervisión institucional, trazabilidad y auditoría de conversaciones directas y grupales entre colaboradores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón de Depuración por Rango de Fecha */}
          <button
            type="button"
            onClick={() => {
              setPurgeErrorMessage(null);
              setPurgeConfirmationText('');
              setIsPurgeModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors shadow-2xs cursor-pointer"
            title="Depurar o purgar mensajes de la bitácora por rango de fecha"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Depurar Bitácora</span>
          </button>

          <button
            type="button"
            onClick={() => fetchAuditConversations()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-2xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Búsqueda por texto o participantes */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar en mensajes, títulos o colaboradores..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Filtro por usuario específico */}
          <div className="relative">
            <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="">Todos los colaboradores</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} (@{u.username})
                </option>
              ))}
            </select>
          </div>

          {/* Fecha Desde */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              title="Fecha desde"
            />
          </div>

          {/* Fecha Hasta */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              title="Fecha hasta"
            />
          </div>
        </div>

        {/* Resumen de filtros aplicados */}
        {(searchTerm || selectedUserFilter || dateFrom || dateTo) && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500">
            <span>Filtros activos aplicados</span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedUserFilter('');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
            >
              Limpiar todos los filtros
            </button>
          </div>
        )}
      </div>

      {/* Disposición Master-Detail (Hilos a la izquierda, Transcripción a la derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[650px]">
        {/* Panel Izquierdo: Lista de Conversaciones Institucionales */}
        <div className="lg:col-span-5 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-2xs flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
              Conversaciones ({conversations.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {isLoadingList && (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded-sm w-3/4" />
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-sm w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {!isLoadingList && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 p-4 text-center text-gray-400">
                <MessageSquare className="w-8 h-8 mb-2" />
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  No se encontraron conversaciones
                </p>
                <p className="text-[11px] text-gray-400">
                  Prueba cambiando los criterios de búsqueda o fecha
                </p>
              </div>
            )}

            {!isLoadingList &&
              conversations.map((c) => {
                const isSelected = selectedConversation?.id === c.id;
                const isGroup = c.type === 'GROUP';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => loadTranscript(c)}
                    className={`w-full p-3 text-left transition-colors cursor-pointer border-l-3 ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 dark:border-emerald-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      {isGroup ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                          <span className="p-1 bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 rounded shrink-0">
                            <Users className="w-3 h-3" />
                          </span>
                          <span className="truncate">{c.title || 'Grupo de Chat'}</span>
                          <span className="text-[10px] font-medium text-sky-600 dark:text-sky-400 shrink-0">
                            [Grupo]
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                          <span className="truncate">{c.user1?.full_name || 'Usuario'}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate">{c.user2?.full_name || 'Usuario'}</span>
                        </div>
                      )}

                      <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                        {new Date(c.last_message_at).toLocaleDateString([], {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </div>

                    {isGroup ? (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mb-1">
                        {c.participant_names || 'Participantes del grupo'}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
                        <span>{c.user1?.role_name || 'Usuario'}</span>
                        <span>•</span>
                        <span>{c.user2?.role_name || 'Usuario'}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <p className="truncate flex-1 pr-2 text-[11px]">
                        {c.last_message || 'Sin mensajes registrados'}
                      </p>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md shrink-0">
                        {c.total_messages} msgs
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Panel Derecho: Transcripción de Auditoría */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-2xs flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Cabecera del Hilo Auditado */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div>
                  {selectedConversation.type === 'GROUP' ? (
                    <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Users className="w-4 h-4 text-sky-600" />
                      <span>{selectedConversation.title || 'Grupo de Chat'}</span>
                    </h3>
                  ) : (
                    <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <span>{selectedConversation.user1?.full_name || 'Usuario 1'}</span>
                      <span className="text-gray-400 font-normal">y</span>
                      <span>{selectedConversation.user2?.full_name || 'Usuario 2'}</span>
                    </h3>
                  )}
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    ID Registro: {selectedConversation.id} • Creado:{' '}
                    {new Date(selectedConversation.created_at).toLocaleDateString()}
                    {selectedConversation.participant_names && (
                      <span> • Integrantes: {selectedConversation.participant_names}</span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportTranscript}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-2xs cursor-pointer"
                  title="Exportar transcripción completa para reporte"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Bitácora</span>
                </button>
              </div>

              {/* Lista Cronológica de Mensajes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-950/40">
                {isLoadingTranscript ? (
                  <div className="flex flex-col items-center justify-center h-full text-xs text-gray-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                    Cargando transcripción de mensajes...
                  </div>
                ) : transcript.length === 0 ? (
                  <div className="text-center py-12 text-xs text-gray-400">
                    No hay mensajes en este registro de conversación.
                  </div>
                ) : (
                  transcript.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] pb-1 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {msg.sender_name}
                          </span>
                          <span className="px-1.5 py-0.2 text-[9px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-sm">
                            {msg.sender_role}
                          </span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {msg.recipient_name || 'Grupo (Todos los integrantes)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-400 text-[10px]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(msg.created_at).toLocaleString([], {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                        {msg.message}
                      </p>

                      <div className="flex justify-end pt-1 text-[10px] text-gray-400">
                        {msg.is_read ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCheck className="w-3 h-3" />
                            Leído el{' '}
                            {new Date(msg.read_at || msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500">
                            <Check className="w-3 h-3" />
                            No leído por el destinatario
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <Eye className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Selecciona una conversación del listado
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Podrás revisar el historial completo de mensajes y descargarlo para auditoría.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmación para Depuración por Rango de Fecha */}
      {isPurgeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isPurging && setIsPurgeModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Depurar Mensajes de Bitácora por Rango
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Esta acción eliminará de forma irreversible todos los mensajes registrados dentro del rango de fechas especificado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isPurging && setIsPurgeModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {purgeErrorMessage && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
                {purgeErrorMessage}
              </div>
            )}

            <form onSubmit={handleExecutePurge} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fecha Inicial *
                  </label>
                  <input
                    type="date"
                    required
                    value={purgeDateFrom}
                    onChange={(e) => setPurgeDateFrom(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fecha Final *
                  </label>
                  <input
                    type="date"
                    required
                    value={purgeDateTo}
                    onChange={(e) => setPurgeDateTo(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Escriba <span className="font-bold text-rose-600 dark:text-rose-400">ELIMINAR</span> para confirmar:
                </label>
                <input
                  type="text"
                  required
                  placeholder="ELIMINAR"
                  value={purgeConfirmationText}
                  onChange={(e) => setPurgeConfirmationText(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  disabled={isPurging}
                  onClick={() => setIsPurgeModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPurging || purgeConfirmationText.trim().toUpperCase() !== 'ELIMINAR' || !purgeDateFrom || !purgeDateTo}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  {isPurging ? 'Depurando...' : 'Confirmar Depuración'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


