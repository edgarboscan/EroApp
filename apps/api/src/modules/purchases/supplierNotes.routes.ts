import { Hono } from 'hono';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { SupplierNotesService } from './supplierNotes.service';
import {
  createSupplierNoteSchema,
  applySupplierCreditNoteSchema,
  annulSupplierNoteSchema,
} from '@ero/shared';

export const supplierNotesRouter = new Hono();

// Autenticación obligatoria
supplierNotesRouter.use('*', authenticate);

// GET / - Listar Notas de Crédito y Débito de Proveedores
supplierNotesRouter.get('/', authorize(['purchases.read', 'payables.read']), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || undefined;
  const supplierId = c.req.query('supplierId') || undefined;
  const type = (c.req.query('type') as 'CREDIT' | 'DEBIT') || undefined;
  const status = (c.req.query('status') as 'ACTIVE' | 'APPLIED' | 'ANNULLED') || undefined;
  const search = c.req.query('search') || c.req.query('q') || undefined;
  const startDate = c.req.query('startDate') || undefined;
  const endDate = c.req.query('endDate') || undefined;

  const notes = await SupplierNotesService.getNotes(user.companyId, {
    branchId,
    supplierId,
    type,
    status,
    search,
    startDate,
    endDate,
  });

  return c.json({ success: true, data: notes });
});

// GET /supplier/:supplierId/available-credits - Notas de Crédito con saldo disponible
supplierNotesRouter.get(
  '/supplier/:supplierId/available-credits',
  authorize(['purchases.read', 'payables.read']),
  async (c) => {
    const user = c.get('user');
    const supplierId = c.req.param('supplierId');
    if (!supplierId) {
      return c.json({ success: false, error: { message: 'ID de proveedor requerido' } }, 400);
    }
    const credits = await SupplierNotesService.getSupplierAvailableCreditNotes(user.companyId, supplierId);
    return c.json({ success: true, data: credits });
  }
);

// GET /supplier/:supplierId/invoices - Facturas de compra del proveedor
supplierNotesRouter.get(
  '/supplier/:supplierId/invoices',
  authorize(['purchases.read', 'payables.read']),
  async (c) => {
    const user = c.get('user');
    const supplierId = c.req.param('supplierId');
    if (!supplierId) {
      return c.json({ success: false, error: { message: 'ID de proveedor requerido' } }, 400);
    }
    const invoices = await SupplierNotesService.getSupplierInvoices(user.companyId, supplierId);
    return c.json({ success: true, data: invoices });
  }
);

// GET /invoices/:invoiceId/items - Ítems facturados de compra para procesar devolución
supplierNotesRouter.get(
  '/invoices/:invoiceId/items',
  authorize(['purchases.read', 'payables.read']),
  async (c) => {
    const user = c.get('user');
    const invoiceId = c.req.param('invoiceId');
    if (!invoiceId) {
      return c.json({ success: false, error: { message: 'ID de factura requerido' } }, 400);
    }
    const items = await SupplierNotesService.getInvoiceItems(user.companyId, invoiceId);
    return c.json({ success: true, data: items });
  }
);

// GET /:id - Detalle de una Nota por ID
supplierNotesRouter.get('/:id', authorize(['purchases.read', 'payables.read']), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!id) {
    return c.json({ success: false, error: { message: 'ID de nota requerido' } }, 400);
  }
  const note = await SupplierNotesService.getNoteById(user.companyId, id);

  if (!note) {
    return c.json({ success: false, error: { message: 'Nota no encontrada' } }, 404);
  }

  return c.json({ success: true, data: note });
});

// POST / - Registrar nueva Nota de Crédito o Débito
supplierNotesRouter.post(
  '/',
  authorize(['purchases.create', 'payables.create', 'purchases.update']),
  async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = createSupplierNoteSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Datos inválidos para la nota de proveedor',
            details: parsed.error.format(),
          },
        },
        400
      );
    }

    try {
      const result = await SupplierNotesService.createNote(user.companyId, user.sub, parsed.data);
      return c.json({ success: true, data: result }, 201);
    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message || 'Error al emitir la nota' } }, 400);
    }
  }
);

// POST /apply - Aplicar saldo de Nota de Crédito a Cuenta por Pagar
supplierNotesRouter.post(
  '/apply',
  authorize(['payables.create', 'purchases.create']),
  async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = applySupplierCreditNoteSchema.safeParse(body);

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
      const result = await SupplierNotesService.applyCreditNote(user.companyId, user.sub, parsed.data);
      return c.json({ success: true, data: result });
    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message || 'Error al aplicar Nota de Crédito' } }, 400);
    }
  }
);

// POST /:id/annul - Anular Nota de Crédito o Débito
supplierNotesRouter.post(
  '/:id/annul',
  authorize(['purchases.create', 'payables.create']),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ success: false, error: { message: 'ID de nota requerido' } }, 400);
    }
    const body = await c.req.json();
    const parsed = annulSupplierNoteSchema.safeParse(body);

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
      const result = await SupplierNotesService.annulNote(user.companyId, user.sub, id, parsed.data.reason);
      return c.json({ success: true, data: result });
    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message || 'Error al anular la nota' } }, 400);
    }
  }
);
