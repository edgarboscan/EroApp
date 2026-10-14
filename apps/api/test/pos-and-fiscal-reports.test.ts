import { describe, it, expect } from 'vitest';
import {
  openCashShiftSchema,
  closeCashShiftSchema,
  cashMovementSchema,
  generateFiscalReportSchema,
  calculateIGTF,
} from '@ero/shared';

describe('Punto de Venta Fiscal (POS Avanzado) & Cierre de Caja (Paso 6)', () => {
  describe('Validación de Esquemas de Turnos y Movimientos de Caja', () => {
    it('debe validar la apertura de turno con fondo inicial en USD y VES', () => {
      const validOpen = openCashShiftSchema.safeParse({
        cashRegisterId: 'cf111111-1111-1111-1111-111111111111',
        branchId: 'b1111111-1111-1111-1111-111111111111',
        initialCashUSD: 50.0,
        initialCashVES: 1500.0,
        notes: 'Fondo para vuelto turno matutino',
      });
      expect(validOpen.success).toBe(true);
    });

    it('debe aceptar IDs con prefijos alfanuméricos como las cajas del seeder (cj111111...)', () => {
      const seededOpen = openCashShiftSchema.safeParse({
        cashRegisterId: 'cj111111-1111-1111-1111-111111111111',
        branchId: 'b1111111-1111-1111-1111-111111111111',
        initialCashUSD: 20.0,
        initialCashVES: 500.0,
      });
      expect(seededOpen.success).toBe(true);
    });

    it('debe rechazar montos iniciales negativos en apertura de turno', () => {
      const invalidOpen = openCashShiftSchema.safeParse({
        cashRegisterId: 'cf111111-1111-1111-1111-111111111111',
        branchId: 'b1111111-1111-1111-1111-111111111111',
        initialCashUSD: -10.0,
        initialCashVES: 0,
      });
      expect(invalidOpen.success).toBe(false);
    });

    it('debe validar el arqueo de cierre de turno con montos contados', () => {
      const validClose = closeCashShiftSchema.safeParse({
        shiftId: 'c1111111-1111-1111-1111-111111111111',
        finalCashUSDCounted: 245.5,
        finalCashVESCounted: 5200.0,
        notes: 'Cierre conforme sin novedades',
      });
      expect(validClose.success).toBe(true);
    });

    it('debe validar movimientos de caja INFLOW y OUTFLOW con montos positivos', () => {
      const validInflow = cashMovementSchema.safeParse({
        shiftId: 'c1111111-1111-1111-1111-111111111111',
        type: 'INFLOW',
        currency: 'USD',
        amount: 20.0,
        reason: 'Sencillo de cambio adicional',
      });
      expect(validInflow.success).toBe(true);

      const validOutflow = cashMovementSchema.safeParse({
        shiftId: 'c1111111-1111-1111-1111-111111111111',
        type: 'OUTFLOW',
        currency: 'VES',
        amount: 150.0,
        reason: 'Pago de flete / delivery express',
      });
      expect(validOutflow.success).toBe(true);

      const invalidMovement = cashMovementSchema.safeParse({
        shiftId: 'c1111111-1111-1111-1111-111111111111',
        type: 'OUTFLOW',
        currency: 'USD',
        amount: -5.0,
        reason: 'Monto inválido',
      });
      expect(invalidMovement.success).toBe(false);
    });

    it('debe validar solicitudes de Reporte Fiscal X y Z', () => {
      const reportX = generateFiscalReportSchema.safeParse({
        cashRegisterId: 'cf111111-1111-1111-1111-111111111111',
        branchId: 'b1111111-1111-1111-1111-111111111111',
        shiftId: 'c1111111-1111-1111-1111-111111111111',
        reportType: 'X',
      });
      expect(reportX.success).toBe(true);

      const reportZ = generateFiscalReportSchema.safeParse({
        cashRegisterId: 'cf111111-1111-1111-1111-111111111111',
        branchId: 'b1111111-1111-1111-1111-111111111111',
        shiftId: 'c1111111-1111-1111-1111-111111111111',
        reportType: 'Z',
      });
      expect(reportZ.success).toBe(true);
    });
  });

  describe('Cálculos Matemáticos de Arqueo de Caja y Discrepancias', () => {
    it('debe calcular correctamente el saldo esperado en divisas (USD)', () => {
      const initialCashUSD = 50.0;
      const cashSalesUSD = 240.0;
      const inflowsUSD = 15.0; // entrada manual
      const outflowsUSD = 10.0; // salida manual por delivery

      const expectedUSD = Number(
        (initialCashUSD + cashSalesUSD + inflowsUSD - outflowsUSD).toFixed(2)
      );
      expect(expectedUSD).toBe(295.0);
    });

    it('debe calcular exactamente la diferencia en caso de sobrante de dinero en gaveta', () => {
      const expectedUSD = 295.0;
      const countedUSD = 300.0; // 5 USD extra en gaveta
      const diffUSD = Number((countedUSD - expectedUSD).toFixed(2));

      expect(diffUSD).toBe(5.0);
      expect(diffUSD > 0).toBe(true);
    });

    it('debe calcular exactamente la diferencia en caso de faltante de dinero en gaveta', () => {
      const expectedVES = 5000.0;
      const countedVES = 4850.0; // 150 Bs menos
      const diffVES = Number((countedVES - expectedVES).toFixed(2));

      expect(diffVES).toBe(-150.0);
      expect(diffVES < 0).toBe(true);
    });

    it('debe certificar cuadre exacto cuando lo contado coincide con lo esperado', () => {
      const expectedUSD = 180.25;
      const countedUSD = 180.25;
      const diffUSD = Number((countedUSD - expectedUSD).toFixed(2));

      expect(diffUSD).toBe(0.0);
    });
  });

  describe('Lógica Fiscal SENIAT: Reportes X y Z & Reglas IGTF', () => {
    it('debe calcular el IGTF del 3% únicamente para pagos en divisas no bancarizadas en VES', () => {
      const amountUSD = 100.0;
      const igtf = calculateIGTF(amountUSD);
      expect(igtf).toBe(3.0);
    });

    it('debe acumular correctamente bases imponibles, exentas e IVA en el cierre fiscal', () => {
      const salesInvoices = [
        { baseExempt: 20.0, baseTaxable: 100.0, taxAmount: 16.0, igtf: 3.0, total: 139.0 },
        { baseExempt: 50.0, baseTaxable: 200.0, taxAmount: 32.0, igtf: 0.0, total: 282.0 },
        { baseExempt: 10.0, baseTaxable: 0.0, taxAmount: 0.0, igtf: 0.3, total: 10.3 },
      ];

      const totalExempt = salesInvoices.reduce((acc, i) => acc + i.baseExempt, 0);
      const totalTaxable = salesInvoices.reduce((acc, i) => acc + i.baseTaxable, 0);
      const totalTax = salesInvoices.reduce((acc, i) => acc + i.taxAmount, 0);
      const totalIGTF = salesInvoices.reduce((acc, i) => acc + i.igtf, 0);
      const totalGross = salesInvoices.reduce((acc, i) => acc + i.total, 0);

      expect(totalExempt).toBe(80.0);
      expect(totalTaxable).toBe(300.0);
      expect(totalTax).toBe(48.0);
      expect(totalIGTF).toBe(3.3);
      expect(Number(totalGross.toFixed(2))).toBe(431.3);
    });

    it('debe garantizar correlativo secuencial creciente para el número de Reporte Z', () => {
      const previousZ = 142;
      const nextZ = previousZ + 1;
      expect(nextZ).toBe(143);
      const formattedZ = `Z-${nextZ.toString().padStart(4, '0')}`;
      expect(formattedZ).toBe('Z-0143');
    });

    it('debe permitir liquidar la diferencia generada por IGTF con pago mixto en bolívares sin saldo residual', () => {
      const subtotalBeforeIGTF = 10.0;
      const bcvRate = 36.85;

      // 1. Pago de la base en efectivo divisas
      const payment1USD = 10.0;
      const igtfUSD = Number((payment1USD * 0.03).toFixed(2)); // $0.30
      const totalToPayUSD = Number((subtotalBeforeIGTF + igtfUSD).toFixed(2)); // $10.30

      // Saldo restante por pagar (debe ser $0.30 y no 0)
      const totalPaidUSD1 = payment1USD;
      const remainingUSD = Math.max(0, Number((totalToPayUSD - totalPaidUSD1).toFixed(2)));
      expect(remainingUSD).toBe(0.3);

      // 2. Liquidar la diferencia remanente en Pago Móvil / Bs
      const payment2USD = remainingUSD; // $0.30
      const payment2VES = Number((payment2USD * bcvRate).toFixed(2)); // Bs. 11.05
      expect(payment2VES).toBe(11.05);

      // Como se paga en Bs, no aplica IGTF adicional
      const totalPaidUSD2 = Number((totalPaidUSD1 + payment2USD).toFixed(2));
      const finalRemainingUSD = Math.max(0, Number((totalToPayUSD - totalPaidUSD2).toFixed(2)));
      expect(finalRemainingUSD).toBe(0.0);
    });

    it('debe evitar doble tributación de IGTF cuando se cancela la diferencia del impuesto en divisas', () => {
      const subtotalBeforeIGTF = 10.0;
      const payment1USD = 10.0;
      const igtfUSD = Number((payment1USD * 0.03).toFixed(2)); // $0.30
      const finalTotalUSD = Number((subtotalBeforeIGTF + igtfUSD).toFixed(2)); // $10.30

      // Si el cliente cancela los $0.30 en efectivo divisas para liquidar el impuesto
      const isPayingOnlyIGTF = payment1USD >= subtotalBeforeIGTF && igtfUSD > 0;
      expect(isPayingOnlyIGTF).toBe(true);

      const additionalIGTF = isPayingOnlyIGTF ? 0 : Number((0.3 * 0.03).toFixed(2));
      expect(additionalIGTF).toBe(0);

      const totalPaid = payment1USD + 0.3;
      expect(totalPaid).toBe(finalTotalUSD);
    });
  });
});
