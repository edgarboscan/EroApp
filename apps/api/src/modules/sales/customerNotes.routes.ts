import { Hono } from 'hono';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { CustomerNotesService } from './customerNotes.service';
import { ReportsService } from '../reports/reports.service';
import { generateCustomerNotePDF } from '../reports/reports-pdf';
import {
  createCustomerNoteSchema,
  applyCustomerCreditNoteSchema,
  annulCustomerNoteSchema,
} from '@ero/shared';

export const customerNotesRouter = new Hono();

// Todos los endpoints requieren autenticación
customerNotesRouter.use('*', authenticate);

// GET / - Listar Notas de Crédito y Débito
customerNotesRouter.get('/', authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || undefined;
  const customerId = c.req.query('customerId') || undefined;
  const type = (c.req.query('type') as 'CREDIT' | 'DEBIT') || undefined;
  const status = (c.req.query('status') as 'ACTIVE' | 'APPLIED' | 'ANNULLED') || undefined;
  const search = c.req.query('search') || undefined;
  const startDate = c.req.query('startDate') || undefined;
  const endDate = c.req.query('endDate') || undefined;

  const notes = await CustomerNotesService.getNotes(user.companyId, {
    branchId,
    customerId,
    type,
    status,
    search,
    startDate,
    endDate,
  });

  return c.json({ success: true, data: notes });
});

// GET /customer/:customerId/available-credits - Notas de Crédito con saldo disponible
customerNotesRouter.get('/customer/:customerId/available-credits', authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const customerId = c.req.param('customerId');
  if (!customerId) {
    return c.json({ success: false, error: { message: 'ID de cliente requerido' } }, 400);
  }
  const credits = await CustomerNotesService.getCustomerAvailableCreditNotes(user.companyId, customerId);
  return c.json({ success: true, data: credits });
});

// GET /customer/:customerId/invoices - Facturas emitidas al cliente
customerNotesRouter.get('/customer/:customerId/invoices', authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const customerId = c.req.param('customerId');
  if (!customerId) {
    return c.json({ success: false, error: { message: 'ID de cliente requerido' } }, 400);
  }
  const invoices = await CustomerNotesService.getCustomerInvoices(user.companyId, customerId);
  return c.json({ success: true, data: invoices });
});

// GET /invoices/:invoiceId/items - Ítems facturados para devolución
customerNotesRouter.get('/invoices/:invoiceId/items', authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const invoiceId = c.req.param('invoiceId');
  if (!invoiceId) {
    return c.json({ success: false, error: { message: 'ID de factura requerido' } }, 400);
  }
  const items = await CustomerNotesService.getInvoiceItems(user.companyId, invoiceId);
  return c.json({ success: true, data: items });
});

// GET /:id - Detalle de una Nota por ID
customerNotesRouter.get('/:id', authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!id) {
    return c.json({ success: false, error: { message: 'ID de nota requerido' } }, 400);
  }
  const note = await CustomerNotesService.getNoteById(user.companyId, id);

  if (!note) {
    return c.json({ success: false, error: { message: 'Nota no encontrada' } }, 404);
  }

  return c.json({ success: true, data: note });
});

// GET /:id/pdf - Visualizar e Imprimir PDF oficial de la Nota (Crédito o Débito)
customerNotesRouter.get('/:id/pdf', authorize('sales', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!id) {
    return c.json({ success: false, error: { message: 'ID de nota requerido' } }, 400);
  }

  const note = await CustomerNotesService.getNoteById(user.companyId, id);
  if (!note) {
    return c.json({ success: false, error: { message: 'Nota no encontrada' } }, 404);
  }

  try {
    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generateCustomerNotePDF({
      company,
      note,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="${note.noteNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Customer Note PDF Error]', error);
    return c.json({ success: false, error: { code: 'CUSTOMER_NOTE_PDF_FAILED', message: error.message } }, 500);
  }
});

// POST / - Crear nueva Nota de Crédito o Débito
customerNotesRouter.post('/', authorize('sales', 'credit_notes'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createCustomerNoteSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          message: 'Datos inválidos para la nota',
          details: parsed.error.format(),
        },
      },
      400
    );
  }

  try {
    const result = await CustomerNotesService.createNote(user.companyId, user.sub, parsed.data);
    return c.json({ success: true, data: result }, 201);
  } catch (err: any) {
    return c.json({ success: false, error: { message: err.message || 'Error al emitir la nota' } }, 400);
  }
});

// POST /apply - Aplicar saldo de Nota de Crédito a Cuenta por Cobrar
customerNotesRouter.post('/apply', authorize('receivables', 'create'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = applyCustomerCreditNoteSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          message: 'Datos inválidos para la aplicación de la Nota de Crédito',
          details: parsed.error.format(),
        },
      },
      400
    );
  }

  try {
    const result = await CustomerNotesService.applyCreditNote(user.companyId, user.sub, parsed.data);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: { message: err.message || 'Error al aplicar Nota de Crédito' } }, 400);
  }
});

// POST /:id/annul - Anular Nota de Crédito o Débito
customerNotesRouter.post('/:id/annul', authorize('sales', 'credit_notes'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!id) {
    return c.json({ success: false, error: { message: 'ID de nota requerido' } }, 400);
  }
  const body = await c.req.json();
  const parsed = annulCustomerNoteSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          message: 'Debe especificar el motivo de anulación',
          details: parsed.error.format(),
        },
      },
      400
    );
  }

  try {
    const result = await CustomerNotesService.annulNote(user.companyId, user.sub, id, parsed.data.reason);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: { message: err.message || 'Error al anular la nota' } }, 400);
  }
});
