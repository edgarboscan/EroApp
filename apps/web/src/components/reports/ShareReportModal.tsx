import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Share2, Users, Search, Check, Send, Loader2, FileText } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { toast } from 'sonner';

export interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle: string;
  reportEndpoint: string;
}

interface UserOption {
  id: string;
  username: string;
  fullName?: string;
  email: string;
  roleName?: string;
}

export const ShareReportModal: React.FC<ShareReportModalProps> = ({
  isOpen,
  onClose,
  reportTitle,
  reportEndpoint,
}) => {
  const token = useAuthStore((s) => s.token);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedUserIds([]);
      setMessage('');
      setSearchTerm('');
      return;
    }

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch('/api/config/users', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            // Excluir al usuario actual de la lista para compartir
            const otherUsers = json.data.filter((u: any) => u.id !== currentUserId && u.isActive !== false);
            setUsers(
              otherUsers.map((u: any) => ({
                id: u.id,
                username: u.username,
                fullName: u.fullName || u.full_name,
                email: u.email,
                roleName: u.roleName || u.role_name,
              }))
            );
          }
        }
      } catch {
        toast.error('Error al cargar la lista de usuarios de la empresa');
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isOpen, currentUserId, token]);

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.username.toLowerCase().includes(term) ||
      (u.fullName && u.fullName.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.roleName && u.roleName.toLowerCase().includes(term))
    );
  });

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      toast.error('Seleccione al menos un usuario destinatario');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/notifications/share-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetUserIds: selectedUserIds,
          reportTitle,
          reportEndpoint,
          message: message.trim() || null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          `Reporte compartido exitosamente con ${selectedUserIds.length} usuario(s)`
        );
        useNotificationStore.getState().pollNotifications(false);
        onClose();
      } else {
        toast.error(json.error?.message || 'Error al compartir reporte');
      }
    } catch {
      toast.error('Error de red al compartir reporte');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compartir Reporte con Usuarios"
      subtitle="Envía este documento al centro de notificaciones de los colaboradores seleccionados."
      icon={<Share2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleShare} className="space-y-4">
        {/* Resumen del Reporte */}
        <div className="flex items-center gap-3 p-3 bg-sky-50/60 dark:bg-sky-950/30 rounded-lg border border-sky-100 dark:border-sky-900/40">
          <div className="p-2 bg-sky-100 dark:bg-sky-900/50 rounded-lg text-sky-700 dark:text-sky-300 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold uppercase tracking-wider block">
              Documento Seleccionado
            </span>
            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate block">
              {reportTitle}
            </span>
          </div>
        </div>

        {/* Buscador de Usuarios y Selección Rápida */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-neutral-500" />
              <span>Destinatarios ({selectedUserIds.length} seleccionados) *</span>
            </label>
            {filteredUsers.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer font-medium"
              >
                {selectedUserIds.length === filteredUsers.length
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos'}
              </button>
            )}
          </div>

          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, usuario o rol..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg max-h-44 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
            {loadingUsers ? (
              <div className="p-6 flex flex-col items-center justify-center gap-2 text-neutral-400">
                <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
                <span className="text-xs">Cargando usuarios...</span>
              </div>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((u) => {
                const isSelected = selectedUserIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleSelectUser(u.id)}
                    className={`p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-sky-50/70 dark:bg-sky-950/40'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {u.fullName || u.username}
                        </span>
                        {u.roleName && (
                          <Badge variant="neutral" className="text-[10px] py-0">
                            {u.roleName}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono block truncate">
                        {u.email}
                      </span>
                    </div>

                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-sky-600 border-sky-600 text-white'
                          : 'border-neutral-300 dark:border-neutral-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-neutral-400">
                No se encontraron usuarios disponibles
              </div>
            )}
          </div>
        </div>

        {/* Nota / Comentario Opcional */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Nota o Mensaje Opcional
          </label>
          <textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ej: Favor revisar las diferencias del turno y cuadre de POS..."
            maxLength={500}
            className="w-full text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-neutral-400"
          />
          <div className="text-right text-[10px] text-neutral-400 mt-0.5">
            {message.length} / 500 caracteres
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={isSending}
            disabled={selectedUserIds.length === 0}
            className="flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compartir ({selectedUserIds.length})</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};

