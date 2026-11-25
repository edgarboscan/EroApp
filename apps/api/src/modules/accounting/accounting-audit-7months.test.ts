import { describe, it, expect, afterAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Cargar .env del monorepo antes de inicializar pool MySQL
for (const envPath of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
]) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

import { AccountingAudit7MonthsService } from './accounting-audit-7months.service';
import { pool } from '../../db';

describe('Auditoría Contable y Fiscal Multi-Mes (Junio - Diciembre 2026)', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('debe simular 7 meses consecutivos, cerrar y bloquear cada período, detectar casos borde y generar reporte .md sin descuadres', async () => {
    const report = await AccountingAudit7MonthsService.runFull7MonthSimulationAndAudit(true);

    expect(report.months).toHaveLength(7);
    expect(report.months.map((m) => m.month)).toEqual([6, 7, 8, 9, 10, 11, 12]);

    for (const m of report.months) {
      expect(m.debitCreditDiffVes).toBeLessThanOrEqual(0.05);
      expect(m.orphanEntriesCount).toBe(0);
      expect(m.outOfRangeEntriesCount).toBe(0);
      expect(m.kardexDiscrepanciesCount).toBe(0);
      expect(m.treasuryDiscrepanciesCount).toBe(0);
      expect(m.salesBookCount).toBe(m.salesInvoicesCount);
      expect(m.purchasesBookCount).toBe(m.purchaseInvoicesCount);
      expect(m.periodStatus).toBe('LOCKED');
      expect(m.auditStatus).toBe('OK');
    }

    expect(report.edgeCases).toHaveLength(3);
    for (const ec of report.edgeCases) {
      expect(ec.detected).toBe(true);
      expect(ec.status).toBe('OK');
    }

    expect(report.overallStatus).toBe('OK');
  }, 60000);
});
