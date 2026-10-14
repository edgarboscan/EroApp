import { describe, it, expect } from 'vitest';
import {
  calculateFiscalItem,
  calculateIGTF,
  calculateIVARetention,
  applyRounding,
  generateSENIATVoucherNumber,
} from '@ero/shared';

describe('Motor Fiscal Venezolano (SENIAT)', () => {
  it('Calcula correctamente IVA exclusivo (16%)', () => {
    const item = {
      quantity: 2,
      unitPrice: 10.0,
      taxRate: 16.0,
      taxInclusive: false,
    };

    const result = calculateFiscalItem(item);
    expect(result.unitBasePrice).toBe(10.0);
    expect(result.unitTaxAmount).toBe(1.6);
    expect(result.unitFinalPrice).toBe(11.6);
    expect(result.itemBaseAmount).toBe(20.0);
    expect(result.itemTaxAmount).toBe(3.2);
    expect(result.itemTotalAmount).toBe(23.2);
  });

  it('Calcula correctamente IVA inclusivo (16%) extrayendo la base', () => {
    const item = {
      quantity: 1,
      unitPrice: 116.0,
      taxRate: 16.0,
      taxInclusive: true,
    };

    const result = calculateFiscalItem(item);
    expect(result.unitBasePrice).toBe(100.0);
    expect(result.unitTaxAmount).toBe(16.0);
    expect(result.unitFinalPrice).toBe(116.0);
    expect(result.itemBaseAmount).toBe(100.0);
    expect(result.itemTaxAmount).toBe(16.0);
    expect(result.itemTotalAmount).toBe(116.0);
  });

  it('Calcula el 3% de IGTF sobre pagos en divisas / cripto', () => {
    const totalUSD = 150.0;
    const igtf = calculateIGTF(totalUSD, 3.0);
    expect(igtf).toBe(4.5);
  });

  it('Calcula la retención del 75% del IVA facturado', () => {
    const ivaAmount = 16.0;
    const retained = calculateIVARetention(ivaAmount, 75);
    expect(retained).toBe(12.0);
  });

  it('Genera número de comprobante SENIAT con formato YYYYMM + 8 dígitos correlativos', () => {
    const voucher = generateSENIATVoucherNumber(2026, 9, 142);
    expect(voucher).toBe('20260900000142');
  });
});

describe('Reglas de Redondeo y Precios', () => {
  it('Aplica redondeo comercial a múltiplos de 0.05$', () => {
    expect(applyRounding(1.42, 0.05)).toBe(1.40);
    expect(applyRounding(1.44, 0.05)).toBe(1.45);
  });

  it('Aplica redondeo comercial a múltiplos de 0.10$', () => {
    expect(applyRounding(1.44, 0.10)).toBe(1.40);
    expect(applyRounding(1.47, 0.10)).toBe(1.50);
  });

  it('Aplica redondeo a entero superior (1.00$)', () => {
    expect(applyRounding(14.20, 1.00)).toBe(14.00);
    expect(applyRounding(14.60, 1.00)).toBe(15.00);
  });
});
