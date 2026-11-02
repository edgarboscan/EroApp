import React, { useState, useEffect, useCallback } from 'react';
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
  user1: ChatAuditUser;
  user2: ChatAuditUser;
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
  recipient_id: string;
  message: string;
  is_read: number;
  read_at: string | null;
  created_at: string;
  sender_name: string;
  sender_username: string;
  sender_role: string;
  recipient_name: string;
  recipient_username: string;
  recipient_role: string;
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
        // Si la conversación seleccionada ya no existe en la lista filtrada, resetear o mantener
        if (selectedConversation) {
          const match = data.data.find((c: AuditConversation) => c.id === selectedConversation.id);
          if (match) setSelectedConversation(match);
        }
      }
    } catch {
      // Ignorar error
    } finally {
      setIsLoadingList(false);
    }
  }, [token, searchTerm, selectedUserFilter, dateFrom, dateTo, selectedConversation]);

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

  // Exportar transcripción a formato texto / CSV
  const handleExportTranscript = () => {
    if (!selectedConversation || transcript.length === 0) return;
    const header = `BITACORA DE CHAT - ERO ERP\nID Conversacion: ${selectedConversation.id}\nParticipantes: ${selectedConversation.user1.full_name} (@${selectedConversation.user1.username} - ${selectedConversation.user1.role_name}) y ${selectedConversation.user2.full_name} (@${selectedConversation.user2.username} - ${selectedConversation.user2.role_name})\nFecha Generacion: ${new Date().toLocaleString()}\nTotal Mensajes: ${transcript.length}\n${'='.repeat(70)}\n\n`;

    const lines = transcript.map((m) => {
      const dateStr = new Date(m.created_at).toLocaleString();
      const readStr = m.is_read ? `[Leido: ${new Date(m.read_at || m.created_at).toLocaleString()}]` : '[No leido]';
      return `[${dateStr}] ${m.sender_name} (@${m.sender_username} - ${m.sender_role}) -> ${m.recipient_name}: \n"${m.message}" ${readStr}\n`;
    });

    const fullText = header + lines.join('\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bitacora_chat_${selectedConversation.user1.username}_${selectedConversation.user2.username}_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
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
            Supervisión institucional, trazabilidad y auditoría de conversaciones internas entre usuarios del sistema.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchAuditConversations()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-2xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
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
              placeholder="Buscar en mensajes o usuarios..."
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
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850 flex items-center justify-between">
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
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                        <span className="truncate">{c.user1.full_name}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="truncate">{c.user2.full_name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                        {new Date(c.last_message_at).toLocaleDateString([], {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
                      <span>{c.user1.role_name}</span>
                      <span>•</span>
                      <span>{c.user2.role_name}</span>
                    </div>

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
              <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span>{selectedConversation.user1.full_name}</span>
                    <span className="text-gray-400 font-normal">y</span>
                    <span>{selectedConversation.user2.full_name}</span>
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    ID Registro: {selectedConversation.id} • Iniciado:{' '}
                    {new Date(selectedConversation.created_at).toLocaleDateString()}
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
                            {msg.recipient_name}
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
    </div>
  );
};

