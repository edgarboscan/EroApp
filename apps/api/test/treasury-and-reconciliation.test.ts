import { describe, it, expect } from 'vitest';

export function calculateAccountTransfer(
  originBalance: number,
  originCurrency: 'USD' | 'VES',
  destBalance: number,
  destCurrency: 'USD' | 'VES',
  amount: number,
  exchangeRate: number = 1
) {
  if (amount <= 0) {
    throw new Error('El monto a transferir debe ser mayor a 0');
  }
  if (originBalance < amount) {
    throw new Error('Saldo insuficiente en cuenta origen');
  }

  let creditedAmount = amount;
  if (originCurrency === 'USD' && destCurrency === 'VES') {
    creditedAmount = Number((amount * exchangeRate).toFixed(2));
  } else if (originCurrency === 'VES' && destCurrency === 'USD') {
    creditedAmount = Number((amount / exchangeRate).toFixed(2));
  }

  const newOriginBalance = Number((originBalance - amount).toFixed(2));
  const newDestBalance = Number((destBalance + creditedAmount).toFixed(2));

  return {
    debitedAmount: amount,
    creditedAmount,
    newOriginBalance,
    newDestBalance,
  };
}

export function matchStatementMovements(
  bookMovements: Array<{ id: string; amount: number; referenceNumber?: string; isReconciled: boolean }>,
  statementLines: Array<{ referenceNumber: string; amount: number }>,
  statementEndingBalance: number,
  currentBookBalance: number
) {
  const matchedIds: string[] = [];
  const unmatchedLines: any[] = [];

  for (const line of statementLines) {
    const match = bookMovements.find((m) => {
      if (matchedIds.includes(m.id) || m.isReconciled) return false;

      const refMatch =
        line.referenceNumber &&
        m.referenceNumber &&
        line.referenceNumber.trim().toLowerCase() === m.referenceNumber.trim().toLowerCase();

      const amountMatch = Math.abs(m.amount - line.amount) < 0.009;

      return refMatch || amountMatch;
    });

    if (match) {
      matchedIds.push(match.id);
    } else {
      unmatchedLines.push(line);
    }
  }

  const difference = Number((statementEndingBalance - currentBookBalance).toFixed(2));
  const isReconciled = Math.abs(difference) < 0.01 && unmatchedLines.length === 0;

  return {
    matchedCount: matchedIds.length,
    unmatchedCount: unmatchedLines.length,
    difference,
    status: isReconciled ? 'RECONCILED' : 'DISCREPANCY',
  };
}

export function calculateRealBalance(
  bookBalance: number,
  unclearedDeposits: number,
  unclearedWithdrawals: number
) {
  // Saldo Real Bancario = Saldo en Libros + Egresos en Tránsito (no cobrados) - Ingresos en Tránsito (no acreditados)
  return Number((bookBalance + unclearedWithdrawals - unclearedDeposits).toFixed(2));
}

describe('Motor de Tesorería - Disponibilidad y Saldo Real Bancario', () => {
  it('Calcula el saldo real bancario sumando egresos en tránsito y restando ingresos en tránsito', () => {
    // Si el libro marca 10,000, hay un cheque girado de 2,000 no cobrado y un depósito de 1,500 en tránsito
    const real = calculateRealBalance(10000.0, 1500.0, 2000.0);
    // En el banco aún están los 2,000 pero no están los 1,500: 10,000 + 2,000 - 1,500 = 10,500
    expect(real).toBe(10500.0);
  });

  it('Saldo real es idéntico al saldo en libros si no existen partidas en tránsito', () => {
    const real = calculateRealBalance(5000.0, 0, 0);
    expect(real).toBe(5000.0);
  });
});

describe('Motor de Tesorería - Transferencias entre Cuentas', () => {
  it('Ejecuta transferencia entre cuentas de la misma moneda (VES a VES)', () => {
    const res = calculateAccountTransfer(50000.0, 'VES', 10000.0, 'VES', 15000.0);
    expect(res.debitedAmount).toBe(15000.0);
    expect(res.creditedAmount).toBe(15000.0);
    expect(res.newOriginBalance).toBe(35000.0);
    expect(res.newDestBalance).toBe(25000.0);
  });

  it('Ejecuta transferencia bimoneda de USD a cuenta en VES aplicando tasa BCV', () => {
    const rate = 36.5;
    const res = calculateAccountTransfer(1000.0, 'USD', 5000.0, 'VES', 200.0, rate);
    expect(res.debitedAmount).toBe(200.0);
    expect(res.creditedAmount).toBe(7300.0); // 200 * 36.5
    expect(res.newOriginBalance).toBe(800.0);
    expect(res.newDestBalance).toBe(12300.0);
  });

  it('Rechaza transferencias cuando la cuenta de origen no posee fondos suficientes', () => {
    expect(() => calculateAccountTransfer(100.0, 'USD', 500.0, 'USD', 250.0)).toThrow(
      'Saldo insuficiente en cuenta origen'
    );
  });
});

describe('Motor de Conciliación Bancaria Automática', () => {
  it('Concilia exitosamente cuando las referencias coinciden y no hay diferencia en saldos', () => {
    const bookMovements = [
      { id: 'm1', amount: 5000.0, referenceNumber: 'REF-001', isReconciled: false },
      { id: 'm2', amount: -1200.0, referenceNumber: 'REF-002', isReconciled: false },
    ];
    const statement = [
      { referenceNumber: 'REF-001', amount: 5000.0 },
      { referenceNumber: 'REF-002', amount: -1200.0 },
    ];

    const result = matchStatementMovements(bookMovements, statement, 3800.0, 3800.0);
    expect(result.matchedCount).toBe(2);
    expect(result.unmatchedCount).toBe(0);
    expect(result.difference).toBe(0);
    expect(result.status).toBe('RECONCILED');
  });

  it('Detecta discrepancia si hay movimientos en el extracto no registrados en libros', () => {
    const bookMovements = [
      { id: 'm1', amount: 5000.0, referenceNumber: 'REF-001', isReconciled: false },
    ];
    const statement = [
      { referenceNumber: 'REF-001', amount: 5000.0 },
      { referenceNumber: 'COM-BANCARIA', amount: -50.0 }, // Comisión no registrada
    ];

    const result = matchStatementMovements(bookMovements, statement, 4950.0, 5000.0);
    expect(result.matchedCount).toBe(1);
    expect(result.unmatchedCount).toBe(1);
    expect(result.difference).toBe(-50.0);
    expect(result.status).toBe('DISCREPANCY');
  });
});
