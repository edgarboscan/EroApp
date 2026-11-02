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
  message: z.string().max(2000).optional().nullable(),
  reportEndpoint: z.string().min(1, 'La ruta del reporte es obligatoria'),
  reportTitle: z.string().min(1, 'El título del reporte es obligatorio'),
  attachPdf: z.coerce.boolean().default(true),
});

export type SendEmailReportInput = z.infer<typeof sendEmailReportSchema>;

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
  recipientType: 'customer' | 'supplier' | 'custom';
  subject: string;
  body?: string | null;
  reportTitle?: string | null;
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  errorMessage?: string | null;
  createdAt: string;
}

