import { z } from 'zod';

export const notificationTypes = [
  'REPORT_SHARED',
  'LOW_STOCK',
  'CASH_SHIFT_CLOSED',
  'CREDIT_LIMIT_EXCEEDED',
  'PURCHASE_ORDER_APPROVED',
  'FISCAL_ALERT',
  'SYSTEM',
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export const notificationTypeLabels: Record<NotificationType, { label: string; description: string }> = {
  REPORT_SHARED: {
    label: 'Reportes Compartidos',
    description: 'Avisos cuando otro usuario te comparte un reporte o documento en el visor',
  },
  LOW_STOCK: {
    label: 'Alertas de Inventario Crítico',
    description: 'Productos con existencia por debajo del stock mínimo o en nivel cero',
  },
  CASH_SHIFT_CLOSED: {
    label: 'Cierres de Caja & Arqueos (X / Z)',
    description: 'Notificación de turnos de caja cerrados con lotes POS o diferencias registradas',
  },
  CREDIT_LIMIT_EXCEEDED: {
    label: 'Crédito y Cobranzas',
    description: 'Ventas que exceden el límite de crédito o clientes con facturas en mora',
  },
  PURCHASE_ORDER_APPROVED: {
    label: 'Compras & Recepciones',
    description: 'Órdenes de compra autorizadas y recepción de mercancía en almacenes',
  },
  FISCAL_ALERT: {
    label: 'Alertas SENIAT & Fiscales',
    description: 'Emisión de comprobantes de retención, cierre de libros de ventas y compras',
  },
  SYSTEM: {
    label: 'Avisos del Sistema & Licencias',
    description: 'Vencimiento de licencias, actualizaciones de tasa oficial BCV y comunicados',
  },
};

export const shareReportSchema = z.object({
  targetUserIds: z.array(z.string().min(1)).min(1, 'Debe seleccionar al menos un usuario destinatario'),
  reportTitle: z.string().min(1, 'El título del reporte es obligatorio'),
  reportEndpoint: z.string().min(1, 'La ruta del reporte es obligatoria'),
  message: z.string().max(500, 'El mensaje no puede superar 500 caracteres').optional().nullable(),
});

export type ShareReportInput = z.infer<typeof shareReportSchema>;

export const sendEmailReportSchema = z.object({
  recipientEmail: z.string().trim().email('Dirección de correo electrónico inválida'),
  recipientName: z.string().trim().min(1, 'El nombre del destinatario es obligatorio'),
  recipientType: z.enum(['customer', 'supplier', 'custom']).default('custom'),
  subject: z.string().trim().min(1, 'El asunto del correo es obligatorio').max(200),
  message: z.string().max(4000).optional().nullable(),
  reportEndpoint: z.string().optional().nullable(),
  reportTitle: z.string().optional().nullable(),
  attachPdf: z.coerce.boolean().default(true),
  pdfBase64: z.string().optional().nullable(),
  pdfFilename: z.string().optional().nullable(),
});

export type SendEmailReportInput = z.infer<typeof sendEmailReportSchema>;

export const sendDirectEmailSchema = z.object({
  recipientEmail: z.string().trim().min(1, 'Dirección de correo electrónico requerida'),
  recipientName: z.string().optional().nullable(),
  recipientType: z.enum(['customer', 'supplier', 'custom', 'user']).default('custom'),
  cc: z.string().optional().nullable(),
  bcc: z.string().optional().nullable(),
  subject: z.string().trim().min(1, 'El asunto del correo es obligatorio').max(200),
  message: z.string().min(1, 'El mensaje es obligatorio').max(10000),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        content: z.string(),
        contentType: z.string().optional(),
      })
    )
    .optional()
    .nullable(),
});

export type SendDirectEmailInput = z.infer<typeof sendDirectEmailSchema>;

export const userNotificationPreferenceItemSchema = z.object({
  type: z.enum(notificationTypes),
  inApp: z.coerce.boolean(),
  email: z.coerce.boolean(),
});

export const updateNotificationPreferencesSchema = z.object({
  preferences: z.array(userNotificationPreferenceItemSchema),
});

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
export type UserNotificationPreferenceItem = z.infer<typeof userNotificationPreferenceItemSchema>;

export interface NotificationItem {
  id: string;
  companyId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: {
    reportEndpoint?: string;
    reportTitle?: string;
    sharedBy?: string;
    sharedAt?: string;
    [key: string]: any;
  } | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface EmailLogItem {
  id: string;
  companyId: string;
  senderUserId?: string | null;
  senderName?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  recipientType: 'customer' | 'supplier' | 'custom' | 'user';
  subject: string;
  body?: string | null;
  reportTitle?: string | null;
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  errorMessage?: string | null;
  hasAttachments: boolean;
  attachmentsCount: number;
  attachmentNames?: string[] | null;
  createdAt: string;
  // Aliases para compatibilidad snake_case
  recipient_email?: string;
  recipient_name?: string;
  report_title?: string;
  error_message?: string;
  sender_name?: string;
  created_at?: string;
  has_attachments?: boolean;
  attachments_count?: number;
}

