import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import {
  Mail,
  Users,
  Building,
  FileText,
  Send,
  Loader2,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';

export interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle: string;
  reportEndpoint?: string | null;
  pdfBlobUrl?: string | null;
  filename?: string;
  defaultRecipientEmail?: string;
  defaultRecipientName?: string;
}

type RecipientType = 'customer' | 'supplier' | 'custom';

interface ContactOption {
  id: string;
  name: string;
  rif?: string;
  email: string;
}

export const EmailReportModal: React.FC<EmailReportModalProps> = ({
  isOpen,
  onClose,
  reportTitle,
  reportEndpoint,
  pdfBlobUrl,
  filename,
  defaultRecipientEmail,
  defaultRecipientName,
}) => {
  const token = useAuthStore((s) => s.token);

  const [recipientType, setRecipientType] = useState<RecipientType>('customer');
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [loadingContacts, setLoadingContacts] = useState(false);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachPdf, setAttachPdf] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; host: string; user: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setRecipientEmail('');
      setRecipientName('');
      setSelectedContactId('');
      setMessage('');
      return;
    }

    if (defaultRecipientEmail) {
      setRecipientEmail(defaultRecipientEmail);
      setRecipientType('custom');
    }
    if (defaultRecipientName) {
      setRecipientName(defaultRecipientName);
    }

    setSubject(`Documento Oficial: ${reportTitle} - ERO ERP`);
    setMessage(
      `Estimado cliente/proveedor,\n\nLe hacemos entrega del documento oficial "${reportTitle}" emitido desde nuestro sistema administrativo ERO ERP.\n\nQuedamos a su completa disposición para cualquier información adicional.`
    );

    // Consultar estado SMTP
    fetch('/api/notifications/mail-status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.status) {
          setSmtpStatus(json.data.status);
        }
      })
      .catch(() => {});
  }, [isOpen, reportTitle, defaultRecipientEmail, defaultRecipientName, token]);

  useEffect(() => {
    if (!isOpen || recipientType === 'custom') return;

    const fetchContacts = async () => {
      setLoadingContacts(true);
      try {
        const url = recipientType === 'customer' ? '/api/customers' : '/api/suppliers';
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const list: ContactOption[] = json.data
              .filter((c: any) => c.email && c.email.trim() !== '')
              .map((c: any) => ({
                id: c.id,
                name: c.legalName || c.legal_name || c.name,
                rif: c.rif,
                email: c.email.trim(),
              }));
            setContacts(list);
          }
        }
      } catch {
        toast.error(`Error al cargar lista de ${recipientType === 'customer' ? 'clientes' : 'proveedores'}`);
      } finally {
        setLoadingContacts(false);
      }
    };

    fetchContacts();
  }, [isOpen, recipientType, token]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    const found = contacts.find((c) => c.id === contactId);
    if (found) {
      setRecipientName(found.name);
      setRecipientEmail(found.email);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim() || !recipientEmail.includes('@')) {
      toast.error('Ingrese un correo electrónico válido');
      return;
    }
    if (!recipientName.trim()) {
      toast.error('Ingrese el nombre del destinatario');
      return;
    }
    if (!subject.trim()) {
      toast.error('El asunto del correo es obligatorio');
      return;
    }

    setIsSending(true);
    try {
      let pdfBase64: string | null = null;
      if (attachPdf && pdfBlobUrl) {
        try {
          const blobRes = await fetch(pdfBlobUrl);
          const blob = await blobRes.blob();
          const reader = new FileReader();
          pdfBase64 = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const resStr = reader.result as string;
              resolve(resStr.includes(',') ? resStr.split(',')[1] : resStr);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (bErr) {
          console.warn('No se pudo convertir blob a base64:', bErr);
        }
      }

      const res = await fetch('/api/notifications/send-email-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim(),
          recipientType,
          subject: subject.trim(),
          message: message.trim() || null,
          reportEndpoint: reportEndpoint || null,
          reportTitle: reportTitle || 'Documento Oficial',
          attachPdf,
          pdfBase64,
          pdfFilename: filename || `${(reportTitle || 'documento').replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          `Documento enviado exitosamente por correo a ${recipientName} (${recipientEmail})`
        );
        onClose();
      } else {
        toast.error(json.error?.message || 'Error al enviar reporte por correo');
      }
    } catch {
      toast.error('Error de red al enviar correo');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enviar Documento por Correo Electrónico"
      subtitle="Distribuye este archivo directamente a clientes, proveedores o contactos externos."
      icon={<Mail className="w-5 h-5 text-[#007BFF] dark:text-[#3D91FF]" />}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSendEmail} className="space-y-4">
        {/* Banner de Estado del Servidor SMTP */}
        {smtpStatus && smtpStatus.configured && (
          <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-[11px] text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Servidor SMTP Activo: <strong>{smtpStatus.host}</strong> ({smtpStatus.user})</span>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Envío Directo</span>
          </div>
        )}
        {/* Selector de Tipo de Destinatario */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            Tipo de Destinatario
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setRecipientType('customer');
                setSelectedContactId('');
                setRecipientEmail('');
                setRecipientName('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                recipientType === 'customer'
                  ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-600 text-sky-700 dark:text-sky-400'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Cliente</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRecipientType('supplier');
                setSelectedContactId('');
                setRecipientEmail('');
                setRecipientName('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                recipientType === 'supplier'
                  ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-600 text-sky-700 dark:text-sky-400'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Proveedor</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRecipientType('custom');
                setSelectedContactId('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                recipientType === 'custom'
                  ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-600 text-sky-700 dark:text-sky-400'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Directo / Manual</span>
            </button>
          </div>
        </div>

        {/* Desplegable si es Cliente o Proveedor */}
        {recipientType !== 'custom' && (
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Seleccionar {recipientType === 'customer' ? 'Cliente' : 'Proveedor'} Registrado
            </label>
            {loadingContacts ? (
              <div className="flex items-center gap-2 text-xs text-neutral-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                <span>Cargando directorio...</span>
              </div>
            ) : (
              <select
                value={selectedContactId}
                onChange={(e) => handleSelectContact(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">-- Seleccionar de la lista --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.rif ? `(${c.rif})` : ''} - {c.email}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Nombre y Correo Destinatario */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Nombre Destinatario *
            </label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Ej: Inversiones Los Andes C.A."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Correo Electrónico *
            </label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="contacto@empresa.com"
              required
            />
          </div>
        </div>

        {/* Asunto */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Asunto del Mensaje *
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        {/* Cuerpo del Mensaje */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Mensaje Acompañante
          </label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {/* Adjunto del Reporte */}
        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-neutral-200 dark:bg-neutral-700 rounded text-neutral-700 dark:text-neutral-200">
              <Paperclip className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                {reportTitle}.pdf
              </span>
              <span className="text-[10px] text-neutral-400 block">Documento PDF oficial del sistema</span>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-neutral-600 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={attachPdf}
              onChange={(e) => setAttachPdf(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-neutral-300"
            />
            <span>Adjuntar PDF</span>
          </label>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" isLoading={isSending} className="flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            <span>Enviar por Correo</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};

