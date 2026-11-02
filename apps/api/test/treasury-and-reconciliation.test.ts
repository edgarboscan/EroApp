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

describe('Motor de Reportes de Tesorería & Bancos', () => {
  const mockCompany = {
    rif: 'J-12345678-9',
    legalName: 'HIPERMERCADO CENTRAL ERO C.A.',
    tradeName: 'HIPERMERCADO CENTRAL ERO',
    fiscalAddress: 'Av. Las Delicias, Maracay, Edo. Aragua',
    phone: '+58 243 2345678',
    email: 'tesoreria@erove.com.ve',
    isSpecialTaxpayer: true,
    showLogoInReports: true,
    reportLogoType: 'default' as const,
    customLogoUrl: null,
  };

  it('Calcula la posición global bimonetaria con tasa oficial BCV', () => {
    const bcvRate = 36.85;
    const accounts = [
      { id: '1', bankCode: '0102', bankName: 'Banco de Venezuela', currency: 'VES', currentBalance: 368500.0, transitBalance: 15000.0, realBalance: 383500.0 },
      { id: '2', bankCode: '0105', bankName: 'Banco Mercantil', currency: 'USD', currentBalance: 12500.0, transitBalance: -500.0, realBalance: 12000.0 },
    ];

    const totalVesBook = accounts.filter(a => a.currency === 'VES').reduce((s, a) => s + a.currentBalance, 0);
    const totalUsdBook = accounts.filter(a => a.currency === 'USD').reduce((s, a) => s + a.currentBalance, 0);

    const grandTotalUSD = Number((totalUsdBook + totalVesBook / bcvRate).toFixed(2));
    const grandTotalVES = Number((totalVesBook + totalUsdBook * bcvRate).toFixed(2));

    expect(totalVesBook).toBe(368500.0);
    expect(totalUsdBook).toBe(12500.0);
    // 368500 / 36.85 = 10000 -> 12500 + 10000 = 22500 USD
    expect(grandTotalUSD).toBe(22500.0);
    // 12500 * 36.85 = 460625 -> 368500 + 460625 = 829125 VES
    expect(grandTotalVES).toBe(829125.0);
  });

  it('Calcula la ecuación oficial de conciliación bancaria con partidas en tránsito', () => {
    // Ecuación: Saldo Extracto Bancario + Depósitos en Tránsito - Cheques en Tránsito = Saldo Bancario Ajustado
    const statementBalance = 45000.0;
    const unclearedDeposits = 8500.0; // En libros pero aún no acreditados por el banco
    const unclearedWithdrawals = 3500.0; // En libros pero aún no debitados por el banco
    const finalBookBalance = 50000.0;

    const adjustedBankBalance = Number((statementBalance + unclearedDeposits - unclearedWithdrawals).toFixed(2));
    const difference = Number((adjustedBankBalance - finalBookBalance).toFixed(2));
    const isBalanced = Math.abs(difference) < 0.01;

    expect(adjustedBankBalance).toBe(50000.0);
    expect(difference).toBe(0.0);
    expect(isBalanced).toBe(true);
  });

  it('Calcula el flujo neto de caja operativo consolidando categorías en VES y USD', () => {
    const bcvRate = 36.85;
    const categories = [
      { key: 'POS_SETTLEMENT', label: 'Recaudación Puntos POS', isOutflow: false, ves: 73700.0, usd: 2000.0 },
      { key: 'DEPOSIT', label: 'Cobranzas Facturas CxC', isOutflow: false, ves: 0, usd: 5000.0 },
      { key: 'WITHDRAWAL', label: 'Pago a Proveedores CxP', isOutflow: true, ves: 36850.0, usd: 3000.0 },
      { key: 'FEE', label: 'Comisiones Bancarias', isOutflow: true, ves: 1474.0, usd: 50.0 },
    ];

    const totalInflowsVES = categories.filter(c => !c.isOutflow).reduce((s, c) => s + c.ves, 0);
    const totalOutflowsVES = categories.filter(c => c.isOutflow).reduce((s, c) => s + c.ves, 0);
    const netVES = Number((totalInflowsVES - totalOutflowsVES).toFixed(2));

    const totalInflowsUSD = categories.filter(c => !c.isOutflow).reduce((s, c) => s + c.usd, 0);
    const totalOutflowsUSD = categories.filter(c => c.isOutflow).reduce((s, c) => s + c.usd, 0);
    const netUSD = Number((totalInflowsUSD - totalOutflowsUSD).toFixed(2));

    const grandTotalInflowsUSD = Number((totalInflowsUSD + totalInflowsVES / bcvRate).toFixed(2));
    const grandTotalOutflowsUSD = Number((totalOutflowsUSD + totalOutflowsVES / bcvRate).toFixed(2));
    const grandNetFlowUSD = Number((grandTotalInflowsUSD - grandTotalOutflowsUSD).toFixed(2));

    // 73700 / 36.85 = 2000 -> Inflows USD = 7000 + 2000 = 9000
    expect(grandTotalInflowsUSD).toBe(9000.0);
    // 38324 / 36.85 = 1040 -> Outflows USD = 3050 + 1040 = 4090
    expect(grandTotalOutflowsUSD).toBe(4090.0);
    expect(grandNetFlowUSD).toBe(4910.0);
    expect(netVES).toBe(35376.0);
    expect(netUSD).toBe(3950.0);
  });

  it('Genera los 4 reportes oficiales en formato PDF con encabezado %PDF', async () => {
    const { ReportsPdfEngine } = await import('../src/modules/reports/reports-pdf');

    // 1. Posición de Tesorería PDF
    const treasuryData = {
      accounts: [
        {
          id: 'acc-1',
          bankCode: '0102',
          bankName: 'Banco de Venezuela',
          accountNumber: '01020123456789012345',
          accountType: 'CURRENT',
          currency: 'VES',
          branchName: 'Sede Principal',
          currentBalance: 500000.0,
          transitBalance: 12000.0,
          realBalance: 512000.0,
          equivalentUSD: 13568.52,
          equivalentVES: 500000.0,
        },
      ],
      summary: {
        totalVesBook: 500000.0,
        totalVesReal: 512000.0,
        totalVesTransit: 12000.0,
        totalUsdBook: 0,
        totalUsdReal: 0,
        totalUsdTransit: 0,
        grandTotalUSD: 13568.52,
        grandTotalVES: 500000.0,
        activeAccountsCount: 1,
        bcvRate: 36.85,
      },
      bcvRate: 36.85,
    };
    const pdfTreasury = ReportsPdfEngine.generateTreasuryBalancesPDF(treasuryData, mockCompany, 'Auditor Senior');
    expect(Buffer.isBuffer(pdfTreasury)).toBe(true);
    expect(pdfTreasury.subarray(0, 4).toString()).toBe('%PDF');

    // 2. Cartola de Movimientos Bancarios PDF
    const movementsData = {
      account: {
        id: 'acc-1',
        bankCode: '0102',
        bankName: 'Banco de Venezuela',
        accountNumber: '01020123456789012345',
        accountType: 'CURRENT',
        currency: 'VES',
        currentBalance: 500000.0,
      },
      movements: [
        {
          id: 'mov-1',
          date: '2026-10-31 10:00:00',
          reference: 'DEP-987654',
          type: 'POS_SETTLEMENT',
          concept: 'Lote de Cierre POS Turno Matutino',
          debit: 50000.0,
          credit: 0,
          balanceAfter: 500000.0,
          isReconciled: true,
          userName: 'Cajero Principal',
        },
      ],
      summary: {
        openingBalance: 450000.0,
        totalDebits: 50000.0,
        totalCredits: 0,
        netFlow: 50000.0,
        closingBalance: 500000.0,
        reconciledCount: 1,
        unreconciledCount: 0,
      },
    };
    const pdfMovements = ReportsPdfEngine.generateBankMovementsPDF(movementsData, mockCompany, 'Tesorero General');
    expect(Buffer.isBuffer(pdfMovements)).toBe(true);
    expect(pdfMovements.subarray(0, 4).toString()).toBe('%PDF');

    // 3. Acta Oficial de Conciliación Bancaria PDF
    const recData = {
      account: {
        id: 'acc-1',
        bankCode: '0102',
        bankName: 'Banco de Venezuela',
        accountNumber: '01020123456789012345',
        currency: 'VES',
      },
      reconciliation: {
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        statementBalance: 490000.0,
        initialBookBalance: 450000.0,
        finalBookBalance: 500000.0,
        adjustedBankBalance: 500000.0,
        difference: 0.0,
        status: 'RECONCILED',
        auditorName: 'Contador General Colegiado',
      },
      unclearedDeposits: {
        items: [{ id: 'd-1', date: '2026-10-31', reference: 'TRANS-11', concept: 'Depósito en tránsito', amount: 15000.0 }],
        total: 15000.0,
      },
      unclearedWithdrawals: {
        items: [{ id: 'w-1', date: '2026-10-30', reference: 'CHQ-22', concept: 'Cheque pendiente cobro', amount: 5000.0 }],
        total: 5000.0,
      },
      isBalanced: true,
    };
    const pdfRec = ReportsPdfEngine.generateBankReconciliationPDF(recData, mockCompany, 'Auditor de Cuentas');
    expect(Buffer.isBuffer(pdfRec)).toBe(true);
    expect(pdfRec.subarray(0, 4).toString()).toBe('%PDF');

    // 4. Flujo de Caja Operativo PDF
    const cashFlowData = {
      categories: [
        { key: 'POS_SETTLEMENT', label: 'Puntos POS', isOutflow: false, ves: 50000.0, usd: 1000.0, consolidatedUSD: 2356.85 },
      ],
      dailyBreakdown: [
        { date: '2026-10-31', inflowsVES: 50000.0, outflowsVES: 0, netVES: 50000.0, inflowsUSD: 1000.0, outflowsUSD: 0, netUSD: 1000.0, netConsolidatedUSD: 2356.85 },
      ],
      summary: {
        totalInflowsVES: 50000.0,
        totalOutflowsVES: 0,
        netVES: 50000.0,
        totalInflowsUSD: 1000.0,
        totalOutflowsUSD: 0,
        netUSD: 1000.0,
        grandTotalInflowsUSD: 2356.85,
        grandTotalOutflowsUSD: 0,
        grandNetFlowUSD: 2356.85,
        bcvRate: 36.85,
      },
      bcvRate: 36.85,
    };
    const pdfCashFlow = ReportsPdfEngine.generateCashFlowPDF(cashFlowData, mockCompany, 'Director de Finanzas');
    expect(Buffer.isBuffer(pdfCashFlow)).toBe(true);
    expect(pdfCashFlow.subarray(0, 4).toString()).toBe('%PDF');
  });
});

