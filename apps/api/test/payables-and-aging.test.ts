import { describe, it, expect } from 'vitest';

export function calculatePayableAgingBucket(dueDate: Date, balance: number, referenceDate: Date = new Date()) {
  const diffTime = referenceDate.getTime() - dueDate.getTime();
  const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (daysOverdue <= 0) {
    return { bucket: 'CURRENT', daysOverdue, currentDue: balance, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0 };
  } else if (daysOverdue <= 30) {
    return { bucket: 'DAYS_1_30', daysOverdue, currentDue: 0, days1_30: balance, days31_60: 0, days61_90: 0, days90Plus: 0 };
  } else if (daysOverdue <= 60) {
    return { bucket: 'DAYS_31_60', daysOverdue, currentDue: 0, days1_30: 0, days31_60: balance, days61_90: 0, days90Plus: 0 };
  } else if (daysOverdue <= 90) {
    return { bucket: 'DAYS_61_90', daysOverdue, currentDue: 0, days1_30: 0, days31_60: 0, days61_90: balance, days90Plus: 0 };
  } else {
    return { bucket: 'DAYS_90_PLUS', daysOverdue, currentDue: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: balance };
  }
}

export function applyPayablePayment(amountTotal: number, currentPaid: number, paymentAmount: number) {
  const currentBalance = amountTotal - currentPaid;
  if (paymentAmount <= 0) {
    throw new Error('El monto del pago debe ser positivo');
  }
  if (paymentAmount > currentBalance + 0.001) {
    throw new Error('El monto del pago no puede exceder el saldo adeudado');
  }

  const newPaid = currentPaid + paymentAmount;
  const newBalance = amountTotal - newPaid;
  const isPaidInFull = Math.abs(newBalance) < 0.001;

  return {
    amountTotal,
    amountPaid: newPaid,
    amountBalance: isPaidInFull ? 0 : newBalance,
    status: isPaidInFull ? 'PAID' : 'PARTIAL',
    isPaidInFull,
  };
}

describe('Motor de Antigüedad de Saldos (CxP)', () => {
  const refDate = new Date('2026-09-29T12:00:00Z');

  it('Clasifica como CORRIENTE (sin mora) facturas a proveedores por vencer', () => {
    const futureDue = new Date('2026-10-20T12:00:00Z');
    const result = calculatePayableAgingBucket(futureDue, 2500.0, refDate);
    expect(result.bucket).toBe('CURRENT');
    expect(result.currentDue).toBe(2500.0);
    expect(result.days1_30).toBe(0);
  });

  it('Clasifica en balde 1 a 30 días facturas de compra vencidas hace 10 días', () => {
    const due10DaysAgo = new Date('2026-09-19T12:00:00Z');
    const result = calculatePayableAgingBucket(due10DaysAgo, 1200.0, refDate);
    expect(result.bucket).toBe('DAYS_1_30');
    expect(result.daysOverdue).toBe(10);
    expect(result.days1_30).toBe(1200.0);
    expect(result.currentDue).toBe(0);
  });

  it('Clasifica en balde 31 a 60 días deudas vencidas hace 45 días', () => {
    const due45DaysAgo = new Date('2026-08-15T12:00:00Z');
    const result = calculatePayableAgingBucket(due45DaysAgo, 3100.0, refDate);
    expect(result.bucket).toBe('DAYS_31_60');
    expect(result.daysOverdue).toBe(45);
    expect(result.days31_60).toBe(3100.0);
  });

  it('Clasifica en balde 61 a 90 días deudas vencidas hace 75 días', () => {
    const due75DaysAgo = new Date('2026-07-16T12:00:00Z');
    const result = calculatePayableAgingBucket(due75DaysAgo, 950.0, refDate);
    expect(result.bucket).toBe('DAYS_61_90');
    expect(result.daysOverdue).toBe(75);
    expect(result.days61_90).toBe(950.0);
  });

  it('Clasifica en balde +90 días obligaciones vencidas hace más de 3 meses', () => {
    const due120DaysAgo = new Date('2026-05-30T12:00:00Z');
    const result = calculatePayableAgingBucket(due120DaysAgo, 5400.0, refDate);
    expect(result.bucket).toBe('DAYS_90_PLUS');
    expect(result.daysOverdue).toBeGreaterThan(90);
    expect(result.days90Plus).toBe(5400.0);
  });
});

describe('Gestión de Pagos a Proveedores (CxP)', () => {
  it('Aplica abono parcial reduciendo el saldo de la deuda', () => {
    const payable = { total: 2000.0, paid: 500.0 };
    const payment = 700.0;
    const result = applyPayablePayment(payable.total, payable.paid, payment);

    expect(result.amountPaid).toBe(1200.0);
    expect(result.amountBalance).toBe(800.0);
    expect(result.status).toBe('PARTIAL');
    expect(result.isPaidInFull).toBe(false);
  });

  it('Liquida totalmente la cuenta por pagar cuando el monto cubre el saldo exacto', () => {
    const payable = { total: 1000.0, paid: 400.0 };
    const payment = 600.0;
    const result = applyPayablePayment(payable.total, payable.paid, payment);

    expect(result.amountPaid).toBe(1000.0);
    expect(result.amountBalance).toBe(0);
    expect(result.status).toBe('PAID');
    expect(result.isPaidInFull).toBe(true);
  });

  it('Rechaza pagos mayores al saldo deudor pendiente', () => {
    const payable = { total: 1000.0, paid: 900.0 };
    const excessPayment = 150.0;

    expect(() => applyPayablePayment(payable.total, payable.paid, excessPayment)).toThrow(
      'El monto del pago no puede exceder el saldo adeudado'
    );
  });
});
