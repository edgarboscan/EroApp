import { describe, it, expect } from 'vitest';
import {
  createQuotationSchema,
  createDeliveryNoteSchema,
  convertQuotationToInvoiceSchema,
  convertDeliveryToInvoiceSchema,
} from '@ero/shared';

describe('Módulo de Ventas & Despachos Administrativos (Paso 9)', () => {
  const validBranchId = '00000000-0000-0000-0000-000000000000';
  const validCustomerId = '11111111-1111-1111-1111-111111111111';
  const validWarehouseId = '22222222-2222-2222-2222-222222222222';
  const validProductId = '33333333-3333-3333-3333-333333333333';
  const validQuotationId = '44444444-4444-4444-4444-444444444444';
  const validDeliveryId = '55555555-5555-5555-5555-555555555555';

  describe('Validación de Esquema de Cotizaciones / Presupuestos Comerciales', () => {
    it('debe validar exitosamente un presupuesto con múltiples líneas, tasa de cambio y vigencia', () => {
      const result = createQuotationSchema.safeParse({
        branchId: validBranchId,
        customerId: validCustomerId,
        validUntilDate: '2026-10-30',
        currency: 'USD',
        exchangeRate: 36.85,
        notes: 'Presupuesto para suministro de equipos informáticos',
        items: [
          {
            productId: validProductId,
            quantity: 5,
            unitPrice: 120.5,
            taxRate: 16.0,
            discountPercent: 5.0,
            notes: 'Monitores 24 pulgadas FHD',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar una cotización sin ítems de productos', () => {
      const result = createQuotationSchema.safeParse({
        branchId: validBranchId,
        customerId: validCustomerId,
        validUntilDate: '2026-10-30',
        items: [],
      });
      expect(result.success).toBe(false);
    });

    it('debe rechazar cotizaciones con cantidades no positivas o precios negativos', () => {
      const invalidQuantity = createQuotationSchema.safeParse({
        branchId: validBranchId,
        customerId: validCustomerId,
        validUntilDate: '2026-10-30',
        items: [
          {
            productId: validProductId,
            quantity: 0,
            unitPrice: 100,
          },
        ],
      });
      expect(invalidQuantity.success).toBe(false);

      const invalidPrice = createQuotationSchema.safeParse({
        branchId: validBranchId,
        customerId: validCustomerId,
        validUntilDate: '2026-10-30',
        items: [
          {
            productId: validProductId,
            quantity: 2,
            unitPrice: -15,
          },
        ],
      });
      expect(invalidPrice.success).toBe(false);
    });

    it('debe validar la conversión de cotización a factura con validación de crédito y almacén de rebaja', () => {
      const cashInvoice = convertQuotationToInvoiceSchema.safeParse({
        quotationId: validQuotationId,
        warehouseId: validWarehouseId,
        invoiceNumber: 'FAC-00000101',
        controlNumber: '00-00000101',
        invoiceMode: 'normal_printer',
        isCredit: false,
        notes: 'Pago de contado verificado',
      });
      expect(cashInvoice.success).toBe(true);

      const creditInvoice = convertQuotationToInvoiceSchema.safeParse({
        quotationId: validQuotationId,
        warehouseId: validWarehouseId,
        invoiceNumber: 'FAC-00000102',
        controlNumber: '00-00000102',
        invoiceMode: 'normal_printer',
        isCredit: true,
        dueDate: '2026-11-15',
        notes: 'Crédito comercial a 30 días',
      });
      expect(creditInvoice.success).toBe(true);
    });
  });

  describe('Validación de Esquema de Notas de Entrega / Despacho Físico de Inventario', () => {
    it('debe validar una nota de entrega física con depósito, chofer, placa y líneas de despacho', () => {
      const result = createDeliveryNoteSchema.safeParse({
        branchId: validBranchId,
        customerId: validCustomerId,
        warehouseId: validWarehouseId,
        driverName: 'Carlos Mendoza',
        vehiclePlate: 'A82BC3D',
        currency: 'USD',
        exchangeRate: 36.85,
        notes: 'Despacho matutino ruta centro',
        items: [
          {
            productId: validProductId,
            quantityDelivered: 50,
            unitPrice: 12.0,
            notes: 'Despacho verificado por almacenero',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar una nota de entrega sin almacén origen de despacho', () => {
      const result = createDeliveryNoteSchema.safeParse({
        branchId: validBranchId,
        customerId: validCustomerId,
        items: [
          {
            productId: validProductId,
            quantityDelivered: 10,
            unitPrice: 5.0,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('debe rechazar una nota de entrega con cantidades negativas o sin ítems', () => {
      const emptyItems = createDeliveryNoteSchema.safeParse({
        branchId: validBranchId,
        customerId: validCustomerId,
        warehouseId: validWarehouseId,
        items: [],
      });
      expect(emptyItems.success).toBe(false);

      const negativeQty = createDeliveryNoteSchema.safeParse({
        branchId: validBranchId,
        customerId: validCustomerId,
        warehouseId: validWarehouseId,
        items: [
          {
            productId: validProductId,
            quantityDelivered: -2,
            unitPrice: 10,
          },
        ],
      });
      expect(negativeQty.success).toBe(false);
    });

    it('debe validar la conversión de nota de entrega a factura fiscal sin duplicar rebaja de stock', () => {
      const result = convertDeliveryToInvoiceSchema.safeParse({
        deliveryNoteId: validDeliveryId,
        invoiceNumber: 'FAC-00000201',
        controlNumber: '00-00000201',
        invoiceMode: 'normal_printer',
        isCredit: false,
        notes: 'Facturación posterior a entrega conforme',
      });
      expect(result.success).toBe(true);
    });

    it('debe validar facturación a crédito de una nota de entrega con fecha de vencimiento', () => {
      const result = convertDeliveryToInvoiceSchema.safeParse({
        deliveryNoteId: validDeliveryId,
        invoiceNumber: 'FAC-00000202',
        controlNumber: '00-00000202',
        invoiceMode: 'normal_printer',
        isCredit: true,
        dueDate: '2026-11-20',
        notes: 'Facturado a crédito tras recepción conforme de mercancía',
      });
      expect(result.success).toBe(true);
    });
  });
});
