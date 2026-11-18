import React, { useEffect, useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import {
  Mail,
  Send,
  Users,
  Building,
  UserCheck,
  Paperclip,
  Trash2,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useMailComposerStore, MailAttachmentItem } from '../../stores/mailComposerStore';
import { toast } from 'sonner';

type RecipientDirectoryType = 'customer' | 'supplier' | 'user' | 'custom';

interface DirectoryContact {
  id: string;
  name: string;
  email: string;
  subtitle?: string;
  type: RecipientDirectoryType;
}

interface EmailLogEntry {
  id: string;
  recipientEmail?: string;
  recipient_email?: string;
  recipientName?: string;
  recipient_name?: string;
  recipientType?: string;
  recipient_type?: string;
  subject: string;
  body?: string;
  reportTitle?: string;
  report_title?: string;
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  errorMessage?: string;
  error_message?: string;
  hasAttachments?: boolean;
  has_attachments?: boolean;
  attachmentsCount?: number;
  attachments_count?: number;
  attachmentNames?: string[];
  createdAt?: string;
  created_at?: string;
  senderName?: string;
  sender_name?: string;
}

const EMAIL_TEMPLATES = [
  {
    id: 'account_statement',
    title: 'Estado de Cuenta & Cobranza',
    subject: 'Estado de Cuenta y Notificación de Saldo - ERO ERP',
    body: 'Estimado cliente,\n\nPor medio de la presente le hacemos llegar el resumen actualizado de su estado de cuenta comercial. Le agradecemos verificar las partidas detalladas y proceder con la conciliación del saldo pendiente a la brevedad posible.\n\nQuedamos a su disposición para cualquier aclaratoria contable o administrativa.\n\nAtentamente,\nDepartamento de Administración y Cobranzas',
  },
  {
    id: 'invoice_delivery',
    title: 'Envío de Factura / Documento Mercantil',
    subject: 'Emisión de Factura Fiscal y Documento de Entrega - ERO ERP',
    body: 'Estimado cliente,\n\nAdjunto a este correo encontrará el documento fiscal correspondiente a su más reciente operación comercial con nuestra empresa. Este comprobante cuenta con validez legal y certificación oficial.\n\nAgradecemos confirmar la recepción del mismo.\n\nAtentamente,\nGerencia de Ventas y Facturación',
  },
  {
    id: 'retention_proof',
    title: 'Comprobante de Retención IVA / ISLR',
    subject: 'Comprobante Oficial de Retención de Impuestos (SENIAT) - ERO ERP',
    body: 'Estimado proveedor,\n\nCumpliendo con las normativas tributarias vigentes del SENIAT, le hacemos entrega del comprobante formal de retención practicada sobre su última factura de servicios / suministros.\n\nPor favor proceda a registrar el crédito fiscal correspondiente en su declaración periódica.\n\nAtentamente,\nDepartamento de Tributos y Finanzas',
  },
  {
    id: 'quotation_proposal',
    title: 'Cotización / Propuesta Comercial',
    subject: 'Cotización de Productos y Servicios - ERO ERP',
    body: 'Estimado cliente,\n\nEs un placer saludarle. En atención a su solicitud, le presentamos nuestra cotización comercial con los precios, condiciones de entrega y vigencia estipuladas para los rubros solicitados.\n\nEsperamos que esta propuesta sea de su agrado para formalizar la orden de pedido.\n\nAtentamente,\nEquipo de Atención Comercial',
  },
];

export const MailComposerModal: React.FC = () => {
  const { isOpen, initialData, closeComposer } = useMailComposerStore();
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  // Formulario
  const [recipientType, setRecipientType] = useState<RecipientDirectoryType>('custom');
  const [directoryContacts, setDirectoryContacts] = useState<DirectoryContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<MailAttachmentItem[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Estado SMTP
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    host: string;
    port: number;
    user: string;
    senderName: string;
  } | null>(null);
  const [testingSmtp, setTestingSmtp] = useState(false);

  // Historial
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializar datos al abrir modal
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      if (initialData.to) setRecipientEmail(initialData.to);
      if (initialData.toName) setRecipientName(initialData.toName);
      if (initialData.recipientType) setRecipientType(initialData.recipientType);
      if (initialData.subject) setSubject(initialData.subject);
      if (initialData.message) setMessage(initialData.message);
      if (initialData.attachments && initialData.attachments.length > 0) {
        setAttachments(initialData.attachments);
      }
    } else {
      setRecipientEmail('');
      setRecipientName('');
      setCc('');
      setBcc('');
      setSubject('');
      setMessage('');
      setAttachments([]);
      setSelectedContactId('');
    }

    // Consultar estado SMTP
    fetchSmtpStatus();
  }, [isOpen, initialData]);

  const fetchSmtpStatus = async () => {
    try {
      const res = await fetch('/api/notifications/mail-status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.success && json.data?.status) {
        setSmtpStatus(json.data.status);
      }
    } catch {}
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    try {
      const res = await fetch('/api/notifications/mail-status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.success && json.data?.connection) {
        if (json.data.connection.ok) {
          toast.success(json.data.connection.message);
        } else {
          toast.error(json.data.connection.message);
        }
        if (json.data.status) setSmtpStatus(json.data.status);
      } else {
        toast.error('No se pudo verificar el estado del servidor de correo');
      }
    } catch {
      toast.error('Error de red al comprobar el servidor SMTP');
    } finally {
      setTestingSmtp(false);
    }
  };

  // Cargar contactos del directorio al cambiar de tipo
  useEffect(() => {
    if (!isOpen || recipientType === 'custom') return;

    const loadDirectory = async () => {
      setLoadingDirectory(true);
      try {
        let endpoint = '';
        if (recipientType === 'customer') endpoint = '/api/customers';
        else if (recipientType === 'supplier') endpoint = '/api/suppliers';
        else if (recipientType === 'user') endpoint = '/api/config/users';

        const res = await fetch(endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const mapped: DirectoryContact[] = [];
            json.data.forEach((item: any) => {
              const email = (item.email || '').trim();
              if (email && email.includes('@')) {
                const name = item.legalName || item.legal_name || item.name || item.fullName || item.username;
                mapped.push({
                  id: item.id,
                  name,
                  email,
                  subtitle: item.rif || item.roleName || item.role || item.documentNumber || '',
                  type: recipientType,
                });
              }
            });
            setDirectoryContacts(mapped);
          }
        }
      } catch {
        setDirectoryContacts([]);
      } finally {
        setLoadingDirectory(false);
      }
    };

    loadDirectory();
  }, [isOpen, recipientType, token]);

  // Al seleccionar contacto del directorio
  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    const found = directoryContacts.find((c) => c.id === contactId);
    if (found) {
      setRecipientName(found.name);
      setRecipientEmail(found.email);
    }
  };

  // Cargar plantilla rápida
  const handleApplyTemplate = (tmplId: string) => {
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === tmplId);
    if (tmpl) {
      setSubject(tmpl.subject);
      setMessage(tmpl.body);
      toast.success(`Plantilla "${tmpl.title}" aplicada`);
    }
  };

  // Adjuntar archivos desde disco
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: MailAttachmentItem[] = [...attachments];

    Array.from(files).forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`El archivo "${file.name}" supera el límite de 15MB`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const resultStr = reader.result as string;
        const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;

        newAttachments.push({
          filename: file.name,
          content: base64,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        });

        setAttachments([...newAttachments]);
        toast.success(`Archivo adjuntado: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Cargar historial de correos enviados
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/notifications/email-logs', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setEmailLogs(json.data);
      } else {
        setEmailLogs([]);
      }
    } catch {
      setEmailLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      fetchLogs();
    }
  }, [isOpen, activeTab]);

  // Enviar correo directo
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientEmail.trim() || !recipientEmail.includes('@')) {
      toast.error('Ingrese un correo electrónico de destino válido');
      return;
    }
    if (!subject.trim()) {
      toast.error('El asunto del correo es obligatorio');
      return;
    }
    if (!message.trim()) {
      toast.error('El cuerpo del mensaje no puede estar vacío');
      return;
    }

    setIsSending(true);
    try {
      const payload = {
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName.trim() || recipientEmail.trim(),
        recipientType,
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
        attachments:
          attachments.length > 0
            ? attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                contentType: a.contentType,
              }))
            : undefined,
      };

      const res = await fetch('/api/notifications/send-direct-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          `Correo electrónico enviado exitosamente a ${recipientEmail}`
        );
        closeComposer();
      } else {
        toast.error(json.error?.message || 'Error al enviar el correo');
      }
    } catch {
      toast.error('Error de red al procesar el envío del correo');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeComposer}
      title="Redactor de Correos Electrónicos"
      subtitle="Envío directo de comunicados oficiales, estados de cuenta y documentos adjuntos."
      icon={<Mail className="w-5 h-5 text-[#007BFF] dark:text-[#3D91FF]" />}
      maxWidth="max-w-3xl"
      className="max-h-[92vh] flex flex-col"
      contentClassName="p-0 flex flex-col flex-1 overflow-hidden bg-white dark:bg-[#1E1F21]"
    >
      {/* Barra de pestañas */}
      <div className="flex items-center justify-between px-5 pt-3 border-b border-gray-200 dark:border-gray-800 bg-[#F8FAFC] dark:bg-[#18191A]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'compose'
                ? 'border-[#007BFF] text-[#007BFF] dark:text-[#3D91FF]'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Redactar Correo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#007BFF] text-[#007BFF] dark:text-[#3D91FF]'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Historial de Envíos</span>
          </button>
        </div>

        {/* Indicador de Estado SMTP */}
        <div className="flex items-center gap-2 pb-1">
          {smtpStatus?.configured ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>SMTP Gmail Conectado</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>SMTP No Configurado</span>
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleTestSmtp}
            disabled={testingSmtp}
            title="Probar conexión en vivo con el servidor de correo"
            className="text-[10px] h-6 px-2 text-neutral-600 dark:text-neutral-400"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${testingSmtp ? 'animate-spin' : ''}`} />
            <span>Test SMTP</span>
          </Button>
        </div>
      </div>

      {activeTab === 'compose' ? (
        <form onSubmit={handleSendEmail} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Selector de Directorio / Tipo de Destinatario */}
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Destinatario
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRecipientType('customer');
                  setSelectedContactId('');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  recipientType === 'customer'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-[#007BFF] text-[#007BFF] dark:text-[#3D91FF]'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
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
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  recipientType === 'supplier'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-[#007BFF] text-[#007BFF] dark:text-[#3D91FF]'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Proveedor</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRecipientType('user');
                  setSelectedContactId('');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  recipientType === 'user'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-[#007BFF] text-[#007BFF] dark:text-[#3D91FF]'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Equipo Interno</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRecipientType('custom');
                  setSelectedContactId('');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  recipientType === 'custom'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-[#007BFF] text-[#007BFF] dark:text-[#3D91FF]'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Directo / Libre</span>
              </button>
            </div>
          </div>

          {/* Desplegable de Directorio */}
          {recipientType !== 'custom' && (
            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Seleccionar del Directorio (
                {recipientType === 'customer'
                  ? 'Clientes'
                  : recipientType === 'supplier'
                    ? 'Proveedores'
                    : 'Usuarios'}
                )
              </label>
              {loadingDirectory ? (
                <div className="py-2 text-xs text-gray-400">Cargando directorio...</div>
              ) : (
                <select
                  value={selectedContactId}
                  onChange={(e) => handleSelectContact(e.target.value)}
                  className="w-full h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Seleccionar contacto registrado --</option>
                  {directoryContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.subtitle ? `(${c.subtitle})` : ''} — {c.email}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Nombre y Correo Electrónico */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Para (Correo Electrónico) *
              </label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="cliente@empresa.com"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Nombre del Destinatario
              </label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Ej: Inversiones Los Andes C.A."
              />
            </div>
          </div>

          {/* Opciones de Copia CC / CCO */}
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setShowCc(!showCc)}
              className="text-[#007BFF] dark:text-[#3D91FF] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>{showCc ? '- Quitar CC' : '+ Agregar CC (Copia)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBcc(!showBcc)}
              className="text-[#007BFF] dark:text-[#3D91FF] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>{showBcc ? '- Quitar CCO' : '+ Agregar CCO (Copia Oculta)'}</span>
            </button>
          </div>

          {showCc && (
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                CC (Copia a)
              </label>
              <Input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="administracion@empresa.com, contador@empresa.com"
              />
            </div>
          )}

          {showBcc && (
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                CCO (Copia Oculta)
              </label>
              <Input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="auditoria@miempresa.com"
              />
            </div>
          )}

          {/* Plantillas Rápidas de Mensaje */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-800 space-y-1.5">
            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Plantillas Rápidas de Redacción</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {EMAIL_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl.id)}
                  className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-[11px] text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-400 cursor-pointer transition-colors"
                >
                  {tmpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Asunto */}
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Asunto del Mensaje *
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto formal del correo..."
              required
            />
          </div>

          {/* Mensaje */}
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Cuerpo del Mensaje *
            </label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escriba aquí el contenido del correo..."
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
              required
            />
          </div>

          {/* Archivos Adjuntos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-semibold text-gray-700 dark:text-gray-300">
                Archivos Adjuntos ({attachments.length})
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Adjuntar Archivo</span>
              </Button>
            </div>

            {attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 block truncate text-[11px]">
                          {att.filename}
                        </span>
                        {att.sizeBytes && (
                          <span className="text-[10px] text-gray-400 block">
                            {(att.sizeBytes / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="p-1 text-gray-400 hover:text-red-500 cursor-pointer transition-colors"
                      title="Quitar archivo adjunto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Firma y Remitente */}
          <div className="pt-2 text-[11px] text-gray-500 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span>
              Remitente: <strong>{currentUser?.fullName || currentUser?.username}</strong> ({smtpStatus?.user || 'edgarboscan@gmail.com'})
            </span>
            <span className="italic">Plantilla Oficial ERO ERP VE</span>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" size="sm" onClick={closeComposer} disabled={isSending}>
              Descartar
            </Button>
            <Button type="submit" size="sm" isLoading={isSending} className="flex items-center gap-1.5 bg-[#007BFF] hover:bg-[#0056b3] text-white">
              <Send className="w-3.5 h-3.5" />
              <span>Enviar Correo Directo</span>
            </Button>
          </div>
        </form>
      ) : (
        /* Pestaña de Historial de Envíos */
        <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              Registro de Auditoría de Envíos Realizados
            </span>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loadingLogs} className="h-7 text-xs">
              <RefreshCw className={`w-3 h-3 mr-1 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </Button>
          </div>

          {loadingLogs ? (
            <div className="py-12 text-center text-gray-400">Cargando bitácora de correos...</div>
          ) : emailLogs.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              No hay registros de correos enviados recientemente.
            </div>
          ) : (
            <div className="space-y-2">
              {emailLogs.map((log) => {
                const recipientEmail = log.recipientEmail || log.recipient_email || '';
                const recipientName =
                  log.recipientName || log.recipient_name || recipientEmail || 'Destinatario no especificado';
                const reportTitle = log.reportTitle || log.report_title;
                const isReport = Boolean(reportTitle && reportTitle !== 'Mensaje Directo');
                const hasAttachments = Boolean(
                  log.hasAttachments ||
                    log.has_attachments ||
                    isReport ||
                    (log.attachmentsCount && log.attachmentsCount > 0) ||
                    (log.attachments_count && log.attachments_count > 0)
                );
                const attachmentsCount =
                  log.attachmentsCount || log.attachments_count || (hasAttachments ? 1 : 0);
                const attachmentNames =
                  log.attachmentNames && log.attachmentNames.length > 0
                    ? log.attachmentNames
                    : isReport && reportTitle
                      ? [`${reportTitle}.pdf`]
                      : [];
                const rawDate = log.createdAt || log.created_at;
                const parsedDate = rawDate ? new Date(rawDate) : null;
                const dateFormatted =
                  parsedDate && !isNaN(parsedDate.getTime())
                    ? parsedDate.toLocaleString('es-VE', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })
                    : 'Fecha reciente';

                return (
                  <div
                    key={log.id}
                    className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="font-semibold text-gray-900 dark:text-gray-100 truncate text-xs">
                          {log.subject || '(Sin Asunto)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isReport && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                            Visor PDF
                          </span>
                        )}
                        <Badge
                          variant={
                            log.status === 'SENT'
                              ? 'success'
                              : log.status === 'SIMULATED'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {log.status === 'SENT' ? 'Enviado' : log.status === 'SIMULATED' ? 'Simulado' : 'Fallido'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-600 dark:text-gray-400 gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-gray-400">Para:</span>
                        <strong className="text-gray-800 dark:text-gray-200">{recipientName}</strong>
                        {recipientEmail && (
                          <span className="text-gray-500 font-mono text-[10px]">&lt;{recipientEmail}&gt;</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 font-mono text-[10px]">
                        <Clock className="w-3 h-3" />
                        <span>{dateFormatted}</span>
                      </div>
                    </div>

                    {/* Indicador de Archivos Adjuntos y Documentos */}
                    <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-gray-100 dark:border-gray-800/60 text-[11px]">
                      {hasAttachments ? (
                        <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/50 text-[10px] font-medium">
                          <Paperclip className="w-3 h-3 shrink-0" />
                          <span>
                            {attachmentsCount} adjunto(s)
                            {attachmentNames.length > 0 ? `: ${attachmentNames.join(', ')}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[10px] italic">Sin archivos adjuntos</span>
                      )}

                      {reportTitle && isReport && (
                        <span className="text-[10px] text-gray-600 dark:text-gray-400">
                          Documento: <strong className="font-medium text-gray-800 dark:text-gray-200">{reportTitle}</strong>
                        </span>
                      )}
                    </div>

                    {log.errorMessage || log.error_message ? (
                      <div className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-900/50">
                        Error: {log.errorMessage || log.error_message}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
