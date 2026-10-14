import { describe, it, expect } from 'vitest';

export function calculateAgingBucket(dueDate: Date, balance: number, referenceDate: Date = new Date()) {
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

export function applyCollectionPayment(amountTotal: number, currentPaid: number, paymentAmount: number) {
  const currentBalance = amountTotal - currentPaid;
  if (paymentAmount <= 0) {
    throw new Error('El monto del cobro debe ser positivo');
  }
  if (paymentAmount > currentBalance + 0.001) {
    throw new Error('El monto del cobro no puede exceder el saldo deudor');
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

describe('Motor de Antigüedad de Saldos (Aging CxC)', () => {
  const refDate = new Date('2026-09-29T12:00:00Z');

  it('Clasifica como CORRIENTE (sin mora) facturas con vencimiento futuro', () => {
    const futureDue = new Date('2026-10-15T12:00:00Z');
    const result = calculateAgingBucket(futureDue, 1500.0, refDate);
    expect(result.bucket).toBe('CURRENT');
    expect(result.currentDue).toBe(1500.0);
    expect(result.days1_30).toBe(0);
  });

  it('Clasifica en balde 1 a 30 días facturas vencidas hace 15 días', () => {
    const due15DaysAgo = new Date('2026-09-14T12:00:00Z');
    const result = calculateAgingBucket(due15DaysAgo, 800.0, refDate);
    expect(result.bucket).toBe('DAYS_1_30');
    expect(result.daysOverdue).toBe(15);
    expect(result.days1_30).toBe(800.0);
    expect(result.currentDue).toBe(0);
  });

  it('Clasifica en balde 31 a 60 días facturas vencidas hace 45 días', () => {
    const due45DaysAgo = new Date('2026-08-15T12:00:00Z');
    const result = calculateAgingBucket(due45DaysAgo, 1200.0, refDate);
    expect(result.bucket).toBe('DAYS_31_60');
    expect(result.daysOverdue).toBe(45);
    expect(result.days31_60).toBe(1200.0);
  });

  it('Clasifica en balde 61 a 90 días facturas vencidas hace 75 días', () => {
    const due75DaysAgo = new Date('2026-07-16T12:00:00Z');
    const result = calculateAgingBucket(due75DaysAgo, 500.0, refDate);
    expect(result.bucket).toBe('DAYS_61_90');
    expect(result.daysOverdue).toBe(75);
    expect(result.days61_90).toBe(500.0);
  });

  it('Clasifica en balde +90 días (crítico) facturas vencidas hace más de 90 días', () => {
    const due100DaysAgo = new Date('2026-06-21T12:00:00Z');
    const result = calculateAgingBucket(due100DaysAgo, 2000.0, refDate);
    expect(result.bucket).toBe('DAYS_90_PLUS');
    expect(result.daysOverdue).toBe(100);
    expect(result.days90Plus).toBe(2000.0);
  });
});

describe('Aplicación de Pagos y Cobranzas CxC', () => {
  it('Aplica abono parcial y actualiza el saldo deudor a PARTIAL', () => {
    const result = applyCollectionPayment(1420.50, 0, 420.50);
    expect(result.amountPaid).toBe(420.50);
    expect(result.amountBalance).toBe(1000.00);
    expect(result.status).toBe('PARTIAL');
    expect(result.isPaidInFull).toBe(false);
  });

  it('Saldar en su totalidad actualiza el estado a PAID con saldo cero', () => {
    const result = applyCollectionPayment(1000.00, 400.00, 600.00);
    expect(result.amountPaid).toBe(1000.00);
    expect(result.amountBalance).toBe(0);
    expect(result.status).toBe('PAID');
    expect(result.isPaidInFull).toBe(true);
  });

  it('Rechaza cobros que superen el saldo pendiente', () => {
    expect(() => applyCollectionPayment(500.00, 100.00, 450.00)).toThrow(
      'El monto del cobro no puede exceder el saldo deudor'
    );
  });
});
