import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createQuotationSchema,
  createDeliveryNoteSchema,
  convertQuotationToInvoiceSchema,
  convertDeliveryToInvoiceSchema,
} from '@ero/shared';
import { SalesService } from './sales.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { generateQuotationPDF, generateDeliveryNotePDF } from '../reports/reports-pdf';
import { ReportsService } from '../reports/reports.service';

export const salesRouter = new Hono<AppEnv>();

// ==========================================
// Rutas de Cotizaciones / Presupuestos
// ==========================================

salesRouter.get('/quotations', authenticate, authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const status = c.req.query('status');

  try {
    const list = await SalesService.getQuotations(user.companyId, branchId, status);
    return c.json({ success: true, data: list });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'QUOTATIONS_FETCH_FAILED', message: error.message } }, 500);
  }
});

salesRouter.get('/quotations/:id', authenticate, authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const quotationId = c.req.param('id')!;

  try {
    const quotation = await SalesService.getQuotationById(user.companyId, quotationId);
    if (!quotation) {
      return c.json({ success: false, error: { code: 'QUOTATION_NOT_FOUND', message: 'Cotización no encontrada' } }, 404);
    }
    return c.json({ success: true, data: quotation });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'QUOTATION_FETCH_FAILED', message: error.message } }, 500);
  }
});

salesRouter.get('/quotations/:id/pdf', authenticate, authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const quotationId = c.req.param('id')!;

  try {
    const quotation = await SalesService.getQuotationById(user.companyId, quotationId);
    if (!quotation) {
      return c.json({ success: false, error: { code: 'QUOTATION_NOT_FOUND', message: 'Cotización no encontrada' } }, 404);
    }

    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generateQuotationPDF({
      company,
      quotation,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="cotizacion_${quotation.quotationNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Quotation PDF Error]', error);
    return c.json({ success: false, error: { code: 'QUOTATION_PDF_FAILED', message: error.message } }, 500);
  }
});

salesRouter.post(
  '/quotations',
  authenticate,
  authorize('sales', 'create'),
  zValidator('json', createQuotationSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await SalesService.createQuotation(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'QUOTATION_CREATION_FAILED', message: error.message } }, 400);
    }
  }
);

salesRouter.put('/quotations/:id/accept', authenticate, authorize('sales', 'create'), async (c) => {
  const user = c.get('user');
  const quotationId = c.req.param('id')!;

  try {
    const result = await SalesService.acceptQuotation(user.companyId, quotationId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'QUOTATION_ACCEPT_FAILED', message: error.message } }, 400);
  }
});

// ==========================================
// Rutas de Notas de Entrega / Despachos
// ==========================================

salesRouter.get('/deliveries', authenticate, authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const warehouseId = c.req.query('warehouseId');
  const status = c.req.query('status');

  try {
    const list = await SalesService.getDeliveryNotes(user.companyId, branchId, warehouseId, status);
    return c.json({ success: true, data: list });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'DELIVERY_NOTES_FETCH_FAILED', message: error.message } }, 500);
  }
});

salesRouter.get('/deliveries/:id', authenticate, authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const deliveryId = c.req.param('id')!;

  try {
    const delivery = await SalesService.getDeliveryNoteById(user.companyId, deliveryId);
    if (!delivery) {
      return c.json({ success: false, error: { code: 'DELIVERY_NOTE_NOT_FOUND', message: 'Nota de entrega no encontrada' } }, 404);
    }
    return c.json({ success: true, data: delivery });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'DELIVERY_NOTE_FETCH_FAILED', message: error.message } }, 500);
  }
});

salesRouter.get('/deliveries/:id/pdf', authenticate, authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const deliveryId = c.req.param('id')!;

  try {
    const delivery = await SalesService.getDeliveryNoteById(user.companyId, deliveryId);
    if (!delivery) {
      return c.json({ success: false, error: { code: 'DELIVERY_NOTE_NOT_FOUND', message: 'Nota de entrega no encontrada' } }, 404);
    }

    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generateDeliveryNotePDF({
      company,
      delivery,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="nota_entrega_${delivery.deliveryNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Delivery Note PDF Error]', error);
    return c.json({ success: false, error: { code: 'DELIVERY_NOTE_PDF_FAILED', message: error.message } }, 500);
  }
});

salesRouter.post(
  '/deliveries',
  authenticate,
  authorize('sales', 'create'),
  zValidator('json', createDeliveryNoteSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await SalesService.createDeliveryNote(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'DELIVERY_NOTE_CREATION_FAILED', message: error.message } }, 400);
    }
  }
);

// ==========================================
// Configuración y Datos de Facturación
// ==========================================

salesRouter.get(
  '/next-invoice-number',
  authenticate,
  authorize('sales', 'read'),
  async (c) => {
    const user = c.get('user');
    try {
      const data = await SalesService.getNextInvoiceNumber(user.companyId);
      return c.json({ success: true, data });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'NEXT_INVOICE_NUMBER_FAILED', message: error.message } }, 500);
    }
  }
);

salesRouter.get(
  '/customer-credit/:customerId',
  authenticate,
  authorize('sales', 'read'),
  async (c) => {
    const user = c.get('user');
    const customerId = c.req.param('customerId')!;
    try {
      const data = await SalesService.getCustomerCredit(user.companyId, customerId);
      return c.json({ success: true, data });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'CUSTOMER_CREDIT_FETCH_FAILED', message: error.message } }, 500);
    }
  }
);

// ==========================================
// Conversión a Facturación de Ventas (CxC)
// ==========================================


salesRouter.post(
  '/quotations/to-invoice',
  authenticate,
  authorize('sales', 'create'),
  zValidator('json', convertQuotationToInvoiceSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await SalesService.convertQuotationToInvoice(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'QUOTATION_INVOICE_CONVERSION_FAILED', message: error.message } }, 400);
    }
  }
);

salesRouter.post(
  '/deliveries/to-invoice',
  authenticate,
  authorize('sales', 'create'),
  zValidator('json', convertDeliveryToInvoiceSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await SalesService.convertDeliveryToInvoice(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'DELIVERY_INVOICE_CONVERSION_FAILED', message: error.message } }, 400);
    }
  }
);
