import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  accountSchema,
  journalEntrySchema,
  trialBalanceFilterSchema,
  generalLedgerFilterSchema,
  financialStatementFilterSchema,
  inflationAdjustmentProcessSchema,
  upsertInpcSchema,
  exchangeDifferenceProcessSchema,
  accountingSettingSchema,
  updateAccountingMappingsSchema,
  batchPostingInputSchema,
} from '@ero/shared';
import { AccountingService } from './accounting.service';
import { AccountingAutoPostingService } from './accounting-auto-posting.service';
import { AccountingPdfEngine } from './accounting-pdf';
import { AccountingExportService } from './accounting-export.service';
import { ReportsService } from '../reports/reports.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const accountingRouter = new Hono<AppEnv>();

// ============================================================================
// CATÁLOGO DE CUENTAS (PLAN DE CUENTAS)
// ============================================================================

// GET /api/accounting/accounts - Listado / árbol de cuentas con saldos calculados
accountingRouter.get('/accounts', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const search = c.req.query('search');
  const type = c.req.query('type');
  const levelStr = c.req.query('level');
  const level = levelStr ? parseInt(levelStr, 10) : undefined;
  const activeOnly = c.req.query('activeOnly') === 'true';
  const format = c.req.query('format') || 'json';

  const data = await AccountingService.getAccounts(user.companyId, { search, type, level, activeOnly });

  if (format === 'pdf') {
    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);
    const buffer = AccountingPdfEngine.generateChartOfAccountsPDF(data, company, userName);
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', 'inline; filename="catalogo_de_cuentas.pdf"');
    return c.body(new Uint8Array(buffer));
  }

  if (format === 'xlsx') {
    const flatRows = AccountingExportService.formatAccountsData(data);
    const buffer = AccountingExportService.toExcelBuffer([{ sheetName: 'Catálogo de Cuentas', rows: flatRows }]);
    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    c.header('Content-Disposition', 'attachment; filename="catalogo_de_cuentas.xlsx"');
    return c.body(new Uint8Array(buffer));
  }

  if (format === 'csv') {
    const flatRows = AccountingExportService.formatAccountsData(data);
    const csv = AccountingExportService.toCsvString(flatRows);
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="catalogo_de_cuentas.csv"');
    return c.text(csv);
  }

  return c.json({ success: true, data });
});

// GET /api/accounting/accounts/:id - Detalle de cuenta contable
accountingRouter.get('/accounts/:id', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await AccountingService.getAccountById(user.companyId, id!);
  if (!data) {
    return c.json({ success: false, error: { message: 'Cuenta no encontrada' } }, 404);
  }
  return c.json({ success: true, data });
});

// POST /api/accounting/accounts/seed-default - Inicializar o sembrar el catálogo estándar VEN-NIF
accountingRouter.post('/accounts/seed-default', authenticate, authorize('accounting', 'write'), async (c) => {
  const user = c.get('user');
  const result = await AccountingService.seedDefaultChartOfAccounts(user.companyId);
  return c.json({
    success: true,
    data: result,
    message: `Plan de cuentas estándar VEN-NIF sembrado exitosamente (${result.accountsCreated} cuentas, ${result.mappingsCreated} mapeos).`,
  });
});

// POST /api/accounting/accounts - Crear nueva cuenta en el catálogo
accountingRouter.post(
  '/accounts',
  authenticate,
  authorize('accounting', 'write'),
  zValidator('json', accountSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const data = await AccountingService.createAccount(user.companyId, body);
    return c.json({ success: true, data }, 201);
  }
);

// PUT /api/accounting/accounts/:id - Modificar cuenta
accountingRouter.put(
  '/accounts/:id',
  authenticate,
  authorize('accounting', 'write'),
  zValidator('json', accountSchema.partial()),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const data = await AccountingService.updateAccount(user.companyId, id!, body);
    return c.json({ success: true, data });
  }
);

// DELETE /api/accounting/accounts/:id - Eliminar cuenta (si no tiene movimientos)
accountingRouter.delete('/accounts/:id', authenticate, authorize('accounting', 'write'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await AccountingService.deleteAccount(user.companyId, id!);
  return c.json({ success: true, data });
});

// ============================================================================
// LIBRO DIARIO (JOURNAL ENTRIES / COMPROBANTES)
// ============================================================================

// GET /api/accounting/journal-entries - Listado de asientos con filtros
accountingRouter.get('/journal-entries', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const status = c.req.query('status');
  const type = c.req.query('type');
  const search = c.req.query('search');
  const format = c.req.query('format') || 'json';

  const data = await AccountingService.getJournalEntries(user.companyId, {
    startDate,
    endDate,
    status,
    type,
    search,
  });

  if (format === 'pdf') {
    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);
    const periodText = startDate && endDate ? `Período: ${startDate} al ${endDate}` : undefined;
    const buffer = AccountingPdfEngine.generateJournalReportPDF(data, company, userName, periodText);
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', 'inline; filename="libro_diario_legal.pdf"');
    return c.body(new Uint8Array(buffer));
  }

  if (format === 'xlsx') {
    const flatRows = AccountingExportService.formatJournalData(data);
    const buffer = AccountingExportService.toExcelBuffer([{ sheetName: 'Libro Diario Legal', rows: flatRows }]);
    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    c.header('Content-Disposition', 'attachment; filename="libro_diario_legal.xlsx"');
    return c.body(new Uint8Array(buffer));
  }

  if (format === 'csv') {
    const flatRows = AccountingExportService.formatJournalData(data);
    const csv = AccountingExportService.toCsvString(flatRows);
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="libro_diario_legal.csv"');
    return c.text(csv);
  }

  return c.json({ success: true, data });
});

// GET /api/accounting/journal-entries/:id/pdf - Comprobante de Diario oficial individual con firmas
accountingRouter.get('/journal-entries/:id/pdf', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await AccountingService.getJournalEntryById(user.companyId, id!);
  if (!data) {
    return c.json({ success: false, error: { message: 'Comprobante no encontrado' } }, 404);
  }

  const [company, userName] = await Promise.all([
    ReportsService.getCompanyPdfInfo(user.companyId),
    ReportsService.getUserFullName(user.sub),
  ]);

  const buffer = AccountingPdfEngine.generateJournalVoucherPDF(data, company, userName);
  c.header('Content-Type', 'application/pdf');
  c.header('Content-Disposition', `inline; filename="comprobante_asiento_${data.entryNumber || (data as any).entry_number || id}.pdf"`);
  return c.body(new Uint8Array(buffer));
});

// GET /api/accounting/journal-entries/:id - Asiento individual con desglose de líneas
accountingRouter.get('/journal-entries/:id', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await AccountingService.getJournalEntryById(user.companyId, id!);
  if (!data) {
    return c.json({ success: false, error: { message: 'Comprobante no encontrado' } }, 404);
  }
  return c.json({ success: true, data });
});

// POST /api/accounting/journal-entries - Crear nuevo comprobante (validando partida doble)
accountingRouter.post(
  '/journal-entries',
  authenticate,
  authorize('accounting', 'write'),
  zValidator('json', journalEntrySchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const data = await AccountingService.createJournalEntry(user.companyId, user.sub, body);
    return c.json({ success: true, data }, 201);
  }
);

// POST /api/accounting/journal-entries/:id/post - Asentar legalmente comprobante
accountingRouter.post('/journal-entries/:id/post', authenticate, authorize('accounting', 'post'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await AccountingService.postJournalEntry(user.companyId, user.sub, id!);
  return c.json({ success: true, data });
});

// POST /api/accounting/journal-entries/:id/annul - Anular comprobante (con reverso Código de Comercio)
accountingRouter.post('/journal-entries/:id/annul', authenticate, authorize('accounting', 'write'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason || 'Anulación solicitada por usuario contable';
  const data = await AccountingService.annulJournalEntry(user.companyId, user.sub, id!, reason);
  return c.json({ success: true, data });
});

// ============================================================================
// LIBRO MAYOR (GENERAL LEDGER)
// ============================================================================

// GET /api/accounting/ledger - Movimientos analíticos y saldos progresivos
accountingRouter.get(
  '/ledger',
  authenticate,
  authorize('accounting', 'read'),
  zValidator('query', generalLedgerFilterSchema),
  async (c) => {
    const user = c.get('user');
    const filters = c.req.valid('query');
    const format = c.req.query('format') || 'json';
    const data = await AccountingService.getGeneralLedger(user.companyId, filters);

    if (format === 'pdf') {
      const [company, userName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
      ]);
      const periodText = filters.startDate && filters.endDate ? `Período: ${filters.startDate} al ${filters.endDate}` : undefined;
      const buffer = AccountingPdfEngine.generateGeneralLedgerReportPDF(data, company, userName, periodText);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'inline; filename="libro_mayor_analitico.pdf"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'xlsx') {
      const flatRows = AccountingExportService.formatGeneralLedgerData(data);
      const buffer = AccountingExportService.toExcelBuffer([{ sheetName: 'Libro Mayor Analítico', rows: flatRows }]);
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="libro_mayor_analitico.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = AccountingExportService.formatGeneralLedgerData(data);
      const csv = AccountingExportService.toCsvString(flatRows);
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="libro_mayor_analitico.csv"');
      return c.text(csv);
    }

    return c.json({ success: true, data });
  }
);

// ============================================================================
// BALANCE DE COMPROBACIÓN (SUMAS Y SALDOS)
// ============================================================================

// GET /api/accounting/trial-balance - Balanza de comprobación a N niveles
accountingRouter.get(
  '/trial-balance',
  authenticate,
  authorize('accounting', 'read'),
  zValidator('query', trialBalanceFilterSchema),
  async (c) => {
    const user = c.get('user');
    const filters = c.req.valid('query');
    const format = c.req.query('format') || 'json';
    const data = await AccountingService.getTrialBalance(user.companyId, filters);

    if (format === 'pdf') {
      const [company, userName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
      ]);
      const periodText = filters.startDate && filters.endDate ? `Período: ${filters.startDate} al ${filters.endDate}` : undefined;
      const buffer = AccountingPdfEngine.generateTrialBalanceReportPDF(data, company, userName, periodText);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'inline; filename="balance_de_comprobacion.pdf"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'xlsx') {
      const flatRows = AccountingExportService.formatTrialBalanceData(data);
      const buffer = AccountingExportService.toExcelBuffer([{ sheetName: 'Balance de Comprobación', rows: flatRows }]);
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="balance_de_comprobacion.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = AccountingExportService.formatTrialBalanceData(data);
      const csv = AccountingExportService.toCsvString(flatRows);
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="balance_de_comprobacion.csv"');
      return c.text(csv);
    }

    return c.json({ success: true, data });
  }
);

// ============================================================================
// ESTADOS FINANCIEROS BAJO VEN-NIF / NIIF
// ============================================================================

// GET /api/accounting/financial-statements/balance-sheet (Estado de Situación Financiera)
accountingRouter.get(
  '/financial-statements/balance-sheet',
  authenticate,
  authorize('accounting', 'read'),
  zValidator('query', financialStatementFilterSchema),
  async (c) => {
    const user = c.get('user');
    const filters = c.req.valid('query');
    const format = c.req.query('format') || 'json';
    const data = await AccountingService.getBalanceSheet(user.companyId, filters);

    if (format === 'pdf') {
      const [company, userName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
      ]);
      const buffer = AccountingPdfEngine.generateBalanceSheetPDF(data, company, userName);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'inline; filename="estado_situacion_financiera.pdf"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'xlsx') {
      const flatRows = AccountingExportService.formatBalanceSheetData(data);
      const buffer = AccountingExportService.toExcelBuffer([{ sheetName: 'Situación Financiera', rows: flatRows }]);
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="estado_situacion_financiera.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = AccountingExportService.formatBalanceSheetData(data);
      const csv = AccountingExportService.toCsvString(flatRows);
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="estado_situacion_financiera.csv"');
      return c.text(csv);
    }

    return c.json({ success: true, data });
  }
);

// GET /api/accounting/financial-statements/income-statement (Estado de Resultados Integral)
accountingRouter.get(
  '/financial-statements/income-statement',
  authenticate,
  authorize('accounting', 'read'),
  zValidator('query', financialStatementFilterSchema),
  async (c) => {
    const user = c.get('user');
    const filters = c.req.valid('query');
    const format = c.req.query('format') || 'json';
    const data = await AccountingService.getIncomeStatement(user.companyId, filters);

    if (format === 'pdf') {
      const [company, userName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
      ]);
      const buffer = AccountingPdfEngine.generateIncomeStatementPDF(data, company, userName);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'inline; filename="estado_resultados_integral.pdf"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'xlsx') {
      const flatRows = AccountingExportService.formatIncomeStatementData(data);
      const buffer = AccountingExportService.toExcelBuffer([{ sheetName: 'Resultados Integral', rows: flatRows }]);
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="estado_resultados_integral.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = AccountingExportService.formatIncomeStatementData(data);
      const csv = AccountingExportService.toCsvString(flatRows);
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="estado_resultados_integral.csv"');
      return c.text(csv);
    }

    return c.json({ success: true, data });
  }
);

// GET /api/accounting/financial-statements/cash-flow (Estado de Flujos de Efectivo)
accountingRouter.get(
  '/financial-statements/cash-flow',
  authenticate,
  authorize('accounting', 'read'),
  zValidator('query', financialStatementFilterSchema),
  async (c) => {
    const user = c.get('user');
    const filters = c.req.valid('query');
    const format = c.req.query('format') || 'json';
    const data = await AccountingService.getCashFlowStatement(user.companyId, filters);

    if (format === 'pdf') {
      const [company, userName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
      ]);
      const buffer = AccountingPdfEngine.generateCashFlowPDF(data, company, userName);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'inline; filename="estado_flujos_efectivo.pdf"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'xlsx') {
      const flatRows = AccountingExportService.formatCashFlowData(data);
      const buffer = AccountingExportService.toExcelBuffer([{ sheetName: 'Flujos de Efectivo', rows: flatRows }]);
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="estado_flujos_efectivo.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = AccountingExportService.formatCashFlowData(data);
      const csv = AccountingExportService.toCsvString(flatRows);
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="estado_flujos_efectivo.csv"');
      return c.text(csv);
    }

    return c.json({ success: true, data });
  }
);

// GET /api/accounting/financial-statements/equity-changes (Estado de Cambios en el Patrimonio)
accountingRouter.get(
  '/financial-statements/equity-changes',
  authenticate,
  authorize('accounting', 'read'),
  zValidator('query', financialStatementFilterSchema),
  async (c) => {
    const user = c.get('user');
    const filters = c.req.valid('query');
    const format = c.req.query('format') || 'json';
    const data = await AccountingService.getEquityChangesStatement(user.companyId, filters);

    if (format === 'pdf') {
      const [company, userName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
      ]);
      const buffer = AccountingPdfEngine.generateEquityChangesPDF(data, company, userName);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'inline; filename="estado_cambios_patrimonio.pdf"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'xlsx') {
      const flatRows = AccountingExportService.formatEquityChangesData(data);
      const buffer = AccountingExportService.toExcelBuffer([{ sheetName: 'Cambios Patrimonio', rows: flatRows }]);
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="estado_cambios_patrimonio.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = AccountingExportService.formatEquityChangesData(data);
      const csv = AccountingExportService.toCsvString(flatRows);
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="estado_cambios_patrimonio.csv"');
      return c.text(csv);
    }

    return c.json({ success: true, data });
  }
);

// GET /api/accounting/financial-statements/notes (Notas a los Estados Financieros)
accountingRouter.get(
  '/financial-statements/notes',
  authenticate,
  authorize('accounting', 'read'),
  zValidator('query', financialStatementFilterSchema),
  async (c) => {
    const user = c.get('user');
    const filters = c.req.valid('query');
    const format = c.req.query('format') || 'json';
    const data = await AccountingService.getFinancialNotes(user.companyId, filters);

    if (format === 'pdf') {
      const [company, userName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
      ]);
      const buffer = AccountingPdfEngine.generateFinancialNotesPDF(data, company, userName);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'inline; filename="notas_revelatorias_estados_financieros.pdf"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'xlsx') {
      const flatRows = AccountingExportService.formatFinancialNotesData(data);
      const buffer = AccountingExportService.toExcelBuffer([{ sheetName: 'Notas Revelatorias', rows: flatRows }]);
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="notas_revelatorias_estados_financieros.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = AccountingExportService.formatFinancialNotesData(data);
      const csv = AccountingExportService.toCsvString(flatRows);
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="notas_revelatorias_estados_financieros.csv"');
      return c.text(csv);
    }

    return c.json({ success: true, data });
  }
);

// ============================================================================
// AJUSTE POR INFLACIÓN Y DIFERENCIA EN CAMBIO
// ============================================================================

// GET /api/accounting/inflation/indices - Historial de INPC del BCV
accountingRouter.get('/inflation/indices', authenticate, authorize('accounting', 'read'), async (c) => {
  const data = await AccountingService.getInflationIndices();
  return c.json({ success: true, data });
});

// POST /api/accounting/inflation/indices - Registrar o actualizar índice INPC del BCV
accountingRouter.post(
  '/inflation/indices',
  authenticate,
  authorize('accounting', 'write'),
  zValidator('json', upsertInpcSchema),
  async (c) => {
    const body = c.req.valid('json');
    const data = await AccountingService.upsertInflationIndex(body);
    return c.json({
      success: true,
      data,
      message: `Índice INPC para ${body.year}-${String(body.month).padStart(2, '0')} guardado exitosamente.`,
    });
  }
);

// DELETE /api/accounting/inflation/indices/:id - Eliminar índice INPC
accountingRouter.delete('/inflation/indices/:id', authenticate, authorize('accounting', 'write'), async (c) => {
  const id = c.req.param('id');
  const result = await AccountingService.deleteInflationIndex(id!);
  return c.json({ success: true, data: result, message: 'Índice INPC eliminado correctamente.' });
});

// GET /api/accounting/inflation/calculate - Simulación de Reexpresión VEN-NIF B-10
accountingRouter.get('/inflation/calculate', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const year = parseInt(c.req.query('year') || `${new Date().getFullYear()}`, 10);
  const month = parseInt(c.req.query('month') || `${new Date().getMonth() + 1}`, 10);
  const baseYearStr = c.req.query('baseYear');
  const baseMonthStr = c.req.query('baseMonth');
  const manualBaseInpcStr = c.req.query('manualBaseInpc');

  const baseYear = baseYearStr ? parseInt(baseYearStr, 10) : undefined;
  const baseMonth = baseMonthStr ? parseInt(baseMonthStr, 10) : undefined;
  const manualBaseInpc = manualBaseInpcStr ? parseFloat(manualBaseInpcStr) : undefined;

  const data = await AccountingService.calculateInflationAdjustment(user.companyId, {
    targetYear: year,
    targetMonth: month,
    baseYear,
    baseMonth,
    manualBaseInpc,
  });
  return c.json({ success: true, data });
});

// GET /api/accounting/exchange-diff/calculate - Cálculo de Diferencia en Cambio
accountingRouter.get('/exchange-diff/calculate', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const asOfDate = c.req.query('asOfDate') || new Date().toISOString().split('T')[0];
  const rateBcv = parseFloat(c.req.query('rateBcv') || '1');
  const data = await AccountingService.calculateExchangeDifference(user.companyId, asOfDate, rateBcv);
  return c.json({ success: true, data });
});

// ============================================================================
// PERÍODOS FISCALES Y CIERRES
// ============================================================================

// GET /api/accounting/periods - Lista de períodos fiscales mensuales
accountingRouter.get('/periods', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const data = await AccountingService.getFiscalPeriods(user.companyId);
  return c.json({ success: true, data });
});

// PUT /api/accounting/periods/:id/status - Cambiar estado de período (OPEN, CLOSED, LOCKED)
accountingRouter.put('/periods/:id/status', authenticate, authorize('accounting', 'close'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = await AccountingService.updatePeriodStatus(user.companyId, user.sub, id!, body.status);
  return c.json({ success: true, data });
});

// ============================================================================
// MOTOR DE CONTABILIZACIÓN AUTOMÁTICA
// ============================================================================

// GET /api/accounting/auto-posting/status - Estado del motor y pendientes de contabilización
accountingRouter.get('/auto-posting/status', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const data = await AccountingAutoPostingService.getStatus(user.companyId);
  return c.json({ success: true, data });
});

// GET /api/accounting/auto-posting/settings - Configuración de contabilización
accountingRouter.get('/auto-posting/settings', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const data = await AccountingAutoPostingService.getSettings(user.companyId);
  return c.json({ success: true, data });
});

// PUT /api/accounting/auto-posting/settings - Modificar configuración de contabilización
accountingRouter.put(
  '/auto-posting/settings',
  authenticate,
  authorize('accounting', 'write'),
  zValidator('json', accountingSettingSchema.partial()),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const data = await AccountingAutoPostingService.updateSettings(user.companyId, body);
    return c.json({ success: true, data });
  }
);

// GET /api/accounting/auto-posting/mappings - Listado de mapeos contables por operación
accountingRouter.get('/auto-posting/mappings', authenticate, authorize('accounting', 'read'), async (c) => {
  const user = c.get('user');
  const data = await AccountingAutoPostingService.getMappings(user.companyId);
  return c.json({ success: true, data });
});

// PUT /api/accounting/auto-posting/mappings - Guardar mapeos contables
accountingRouter.put(
  '/auto-posting/mappings',
  authenticate,
  authorize('accounting', 'write'),
  zValidator('json', updateAccountingMappingsSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    await AccountingAutoPostingService.updateMappings(user.companyId, body.mappings);
    const data = await AccountingAutoPostingService.getMappings(user.companyId);
    return c.json({ success: true, data });
  }
);

// POST /api/accounting/auto-posting/post-batch - Contabilización masiva de documentos históricos
accountingRouter.post(
  '/auto-posting/post-batch',
  authenticate,
  authorize('accounting', 'post'),
  zValidator('json', batchPostingInputSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const data = await AccountingAutoPostingService.runBatchPosting(user.companyId, user.sub, body);
    return c.json({ success: true, data });
  }
);

