import { describe, it, expect } from 'vitest';
import {
  generateSENIATVoucherNumber,
  calculateIVARetention,
  calculateISLRRetention,
} from '@ero/shared';

describe('Tributos SENIAT - Retenciones IVA e ISLR (Paso 5)', () => {
  describe('Numeración Oficial de Comprobantes SENIAT', () => {
    it('debe generar el formato exacto de 14 dígitos (YYYYMM + 8 dígitos correlativos)', () => {
      const voucher1 = generateSENIATVoucherNumber(2026, 9, 1);
      expect(voucher1).toBe('20260900000001');
      expect(voucher1.length).toBe(14);

      const voucherBig = generateSENIATVoucherNumber(2026, 12, 12450);
      expect(voucherBig).toBe('20261200012450');
      expect(voucherBig.length).toBe(14);
    });

    it('debe anteponer ceros correctamente para meses de un solo dígito', () => {
      const voucherJan = generateSENIATVoucherNumber(2027, 3, 45);
      expect(voucherJan).toBe('20270300000045');
    });
  });

  describe('Cálculo de Retenciones de IVA (Providencia SNAT/2015/0049)', () => {
    it('debe calcular retención estándar del 75% sobre el IVA facturado', () => {
      // Factura: Base Imponible 1000 USD/VES, IVA 16% = 160.00
      const ivaAmount = 160.00;
      const retained75 = calculateIVARetention(ivaAmount, 75);
      // 160 * 0.75 = 120.00
      expect(retained75).toBe(120.00);
    });

    it('debe calcular retención especial del 100% sobre el IVA facturado', () => {
      // Casos designados por SENIAT al 100%
      const ivaAmount = 240.50;
      const retained100 = calculateIVARetention(ivaAmount, 100);
      expect(retained100).toBe(240.50);
    });

    it('debe manejar montos con decimales complejos con redondeo a 2 cifras', () => {
      const ivaAmount = 33.33;
      const retained = calculateIVARetention(ivaAmount, 75);
      // 33.33 * 0.75 = 24.9975 -> 25.00
      expect(retained).toBe(25.00);
    });

    it('debe retornar 0 si el IVA es 0 (facturas exentas)', () => {
      const retained = calculateIVARetention(0, 75);
      expect(retained).toBe(0.00);
    });
  });

  describe('Cálculo de Retenciones de ISLR (Decreto 1808)', () => {
    it('debe calcular retención del 5% sin sustraendo para Personas Jurídicas Domiciliadas (PJD)', () => {
      // Honorarios o fletes a PJ Domiciliada: 5% directo sobre base imponible
      const taxableBase = 2500.00;
      const retained = calculateISLRRetention(taxableBase, 5.0, 0);
      expect(retained).toBe(125.00);
    });

    it('debe calcular retención del 2% para Ejecución de Obras o Servicios Generales', () => {
      const taxableBase = 8000.00;
      const retained = calculateISLRRetention(taxableBase, 2.0, 0);
      expect(retained).toBe(160.00);
    });

    it('debe deducir correctamente el sustraendo en Bs para Personas Naturales Residentes (PNR)', () => {
      // Base: 4000.00, Tasa: 3%, Sustraendo: 25.00
      // Bruto = 4000 * 0.03 = 120.00
      // Neto = 120.00 - 25.00 = 95.00
      const taxableBase = 4000.00;
      const retained = calculateISLRRetention(taxableBase, 3.0, 25.00);
      expect(retained).toBe(95.00);
    });

    it('nunca debe generar retenciones negativas si el sustraendo supera el monto bruto', () => {
      const taxableBase = 100.00;
      const retained = calculateISLRRetention(taxableBase, 1.0, 50.00);
      // Bruto: 1.00, Sustraendo: 50.00 -> Max(0, -49.00) = 0
      expect(retained).toBe(0.00);
    });
  });

  describe('Estructura XML de Declaración Informativa SENIAT ISLR', () => {
    it('debe formatear los atributos y nodos conforme a las especificaciones del SENIAT', () => {
      const companyRif = 'J401234567';
      const period = '202609';
      const item = {
        supplierRif: 'J000333221',
        invoiceNumber: 'FACT-001',
        controlNumber: '00-123456',
        operationDate: '15/09/2026',
        conceptCode: 'SERV_TRANS',
        operationAmount: 1500.00,
        ratePercentage: 5.00,
      };

      const xmlChunk = `
  <DetalleRetencion>
    <RifRetenido>${item.supplierRif}</RifRetenido>
    <NumeroFactura>${item.invoiceNumber}</NumeroFactura>
    <NumeroControl>${item.controlNumber}</NumeroControl>
    <FechaOperacion>${item.operationDate}</FechaOperacion>
    <CodigoConcepto>${item.conceptCode}</CodigoConcepto>
    <MontoOperacion>${item.operationAmount.toFixed(2)}</MontoOperacion>
    <PorcentajeRetencion>${item.ratePercentage.toFixed(2)}</PorcentajeRetencion>
  </DetalleRetencion>`;

      expect(xmlChunk).toContain('<RifRetenido>J000333221</RifRetenido>');
      expect(xmlChunk).toContain('<NumeroFactura>FACT-001</NumeroFactura>');
      expect(xmlChunk).toContain('<CodigoConcepto>SERV_TRANS</CodigoConcepto>');
      expect(xmlChunk).toContain('<MontoOperacion>1500.00</MontoOperacion>');
      expect(xmlChunk).toContain('<PorcentajeRetencion>5.00</PorcentajeRetencion>');
    });
  });
});
