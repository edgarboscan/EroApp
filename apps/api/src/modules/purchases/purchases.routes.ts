import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createPurchaseOrderSchema,
  createGoodsReceiptSchema,
  convertReceiptToInvoiceSchema,
} from '@ero/shared';
import { PurchasesService } from './purchases.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { generatePurchaseOrderPDF, generateGoodsReceiptPDF } from '../reports/reports-pdf';
import { ReportsService } from '../reports/reports.service';

export const purchasesRouter = new Hono<AppEnv>();

// ==========================================
// Rutas de Órdenes de Compra (Purchase Orders)
// ==========================================

purchasesRouter.get('/orders', authenticate, authorize('purchases', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const status = c.req.query('status');

  try {
    const orders = await PurchasesService.getOrders(user.companyId, branchId, status);
    return c.json({ success: true, data: orders });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PURCHASE_ORDERS_FETCH_FAILED', message: error.message } }, 500);
  }
});

purchasesRouter.get('/orders/:id', authenticate, authorize('purchases', 'read'), async (c) => {
  const user = c.get('user');
  const orderId = c.req.param('id')!;

  try {
    const order = await PurchasesService.getOrderById(user.companyId, orderId);
    if (!order) {
      return c.json({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Orden de compra no encontrada' } }, 404);
    }
    return c.json({ success: true, data: order });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'ORDER_FETCH_FAILED', message: error.message } }, 500);
  }
});

purchasesRouter.get('/orders/:id/pdf', authenticate, authorize('purchases', 'read'), async (c) => {
  const user = c.get('user');
  const orderId = c.req.param('id')!;

  try {
    const order = await PurchasesService.getOrderById(user.companyId, orderId);
    if (!order) {
      return c.json({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Orden de compra no encontrada' } }, 404);
    }

    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generatePurchaseOrderPDF({
      company,
      order,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="orden_compra_${order.orderNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Purchase Order PDF Error]', error);
    return c.json({ success: false, error: { code: 'ORDER_PDF_FAILED', message: error.message } }, 500);
  }
});

purchasesRouter.post(
  '/orders',
  authenticate,
  authorize('purchases', 'create'),
  zValidator('json', createPurchaseOrderSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues || [];
      const errorMsg = issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ') || 'Datos de orden de compra inválidos';
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errorMsg,
          issues: result.error.issues,
        },
      }, 400);
    }
  }),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const branchId = body.branchId || user.branchId;

    try {
      const result = await PurchasesService.createOrder(user.companyId, user.sub, {
        ...body,
        branchId,
      });
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'ORDER_CREATION_FAILED', message: error.message } }, 400);
    }
  }
);

purchasesRouter.put('/orders/:id/confirm', authenticate, authorize('purchases', 'create'), async (c) => {
  const user = c.get('user');
  const orderId = c.req.param('id')!;

  try {
    const result = await PurchasesService.confirmOrder(user.companyId, orderId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'ORDER_CONFIRMATION_FAILED', message: error.message } }, 400);
  }
});

purchasesRouter.put('/orders/:id/cancel', authenticate, authorize('purchases', 'create'), async (c) => {
  const user = c.get('user');
  const orderId = c.req.param('id')!;

  try {
    const result = await PurchasesService.cancelOrder(user.companyId, orderId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'ORDER_CANCELLATION_FAILED', message: error.message } }, 400);
  }
});

// ==========================================
// Rutas de Recepción de Mercancías (Goods Receipts)
// ==========================================

purchasesRouter.get('/receipts', authenticate, authorize('purchases', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const warehouseId = c.req.query('warehouseId');

  try {
    const receipts = await PurchasesService.getReceipts(user.companyId, branchId, warehouseId);
    return c.json({ success: true, data: receipts });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'RECEIPTS_FETCH_FAILED', message: error.message } }, 500);
  }
});

purchasesRouter.get('/receipts/:id', authenticate, authorize('purchases', 'read'), async (c) => {
  const user = c.get('user');
  const receiptId = c.req.param('id')!;

  try {
    const receipt = await PurchasesService.getReceiptById(user.companyId, receiptId);
    if (!receipt) {
      return c.json({ success: false, error: { code: 'RECEIPT_NOT_FOUND', message: 'Recepción no encontrada' } }, 404);
    }
    return c.json({ success: true, data: receipt });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'RECEIPT_FETCH_FAILED', message: error.message } }, 500);
  }
});

purchasesRouter.get('/receipts/:id/pdf', authenticate, authorize('purchases', 'read'), async (c) => {
  const user = c.get('user');
  const receiptId = c.req.param('id')!;

  try {
    const receipt = await PurchasesService.getReceiptById(user.companyId, receiptId);
    if (!receipt) {
      return c.json({ success: false, error: { code: 'RECEIPT_NOT_FOUND', message: 'Recepción no encontrada' } }, 404);
    }

    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generateGoodsReceiptPDF({
      company,
      receipt,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="recepcion_${receipt.receiptNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Goods Receipt PDF Error]', error);
    return c.json({ success: false, error: { code: 'RECEIPT_PDF_FAILED', message: error.message } }, 500);
  }
});

purchasesRouter.post(
  '/receipts',
  authenticate,
  authorize('purchases', 'create'),
  zValidator('json', createGoodsReceiptSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues || [];
      const errorMsg = issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ') || 'Datos de recepción de mercancía inválidos';
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errorMsg,
          issues: result.error.issues,
        },
      }, 400);
    }
  }),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const branchId = body.branchId || user.branchId;

    try {
      const result = await PurchasesService.createReceipt(user.companyId, user.sub, {
        ...body,
        branchId,
      });
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'RECEIPT_CREATION_FAILED', message: error.message } }, 400);
    }
  }
);

purchasesRouter.post(
  '/receipts/to-invoice',
  authenticate,
  authorize('purchases', 'create'),
  zValidator('json', convertReceiptToInvoiceSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues || [];
      const errorMsg = issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ') || 'Datos para convertir a factura inválidos';
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errorMsg,
          issues: result.error.issues,
        },
      }, 400);
    }
  }),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await PurchasesService.convertReceiptToInvoice(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'RECEIPT_INVOICE_CONVERSION_FAILED', message: error.message } }, 400);
    }
  }
);
