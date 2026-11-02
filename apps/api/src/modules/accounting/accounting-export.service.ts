import XLSX from 'xlsx';
import Papa from 'papaparse';

export class AccountingExportService {
  /**
   * Genera un Buffer Excel (.xlsx) a partir de una o varias hojas
   */
  static toExcelBuffer(sheets: { sheetName: string; rows: any[] }[]): Buffer {
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const ws = XLSX.utils.json_to_sheet(sheet.rows);
      XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.substring(0, 31));
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Genera texto CSV con BOM UTF-8 para apertura impecable en Excel
   */
  static toCsvString(rows: any[]): string {
    const csv = Papa.unparse(rows);
    return '\uFEFF' + csv;
  }

  // ============================================================================
  // 1. CATÁLOGO DE CUENTAS
  // ============================================================================
  static formatAccountsData(accounts: any[]) {
    return accounts.map((acc) => ({
      'Código Contable': acc.code,
      'Nombre de la Cuenta': acc.name,
      'Nivel': acc.level,
      'Tipo de Cuenta': acc.account_type,
      'Naturaleza': acc.nature === 'DEBIT' ? 'Deudora' : 'Acreedora',
      'Moneda': acc.currency || 'VES',
      'Acepta Movimientos': acc.is_movement ? 'Sí (Detalle)' : 'No (Totalizadora / Grupo)',
      'Estado': acc.is_active ? 'Activa' : 'Inactiva',
      'Saldo Actual (Bs)': Number(acc.current_balance || 0).toFixed(2),
      'Saldo Actual ($)': Number(acc.current_balance_usd || 0).toFixed(2),
      'Descripción / Propósito': acc.description || '',
    }));
  }

  // ============================================================================
  // 2. LIBRO DIARIO LEGAL
  // ============================================================================
  static formatJournalData(entries: any[]) {
    const flatRows: any[] = [];
    for (const entry of entries) {
      if (entry.lines && entry.lines.length > 0) {
        for (const line of entry.lines) {
          flatRows.push({
            'N° Asiento': entry.entry_number,
            'Fecha': entry.entry_date,
            'Tipo Comprobante': entry.entry_type,
            'Estado Legal': entry.status === 'POSTED' ? 'Asentado' : entry.status === 'DRAFT' ? 'Borrador' : 'Anulado',
            'Glosa / Concepto General': entry.description || '',
            'Código Cuenta': line.account_code || '',
            'Nombre Cuenta': line.account_name || '',
            'Detalle Línea': line.description || '',
            'Referencia': line.reference || '',
            'Débito (Bs)': Number(line.debit || 0).toFixed(2),
            'Crédito (Bs)': Number(line.credit || 0).toFixed(2),
            'Tasa BCV': Number(line.exchange_rate || entry.exchange_rate || 1).toFixed(4),
            'Débito ($)': Number(line.debit_usd || 0).toFixed(2),
            'Crédito ($)': Number(line.credit_usd || 0).toFixed(2),
          });
        }
      } else {
        flatRows.push({
          'N° Asiento': entry.entry_number,
          'Fecha': entry.entry_date,
          'Tipo Comprobante': entry.entry_type,
          'Estado Legal': entry.status === 'POSTED' ? 'Asentado' : entry.status === 'DRAFT' ? 'Borrador' : 'Anulado',
          'Glosa / Concepto General': entry.description || '',
          'Código Cuenta': '',
          'Nombre Cuenta': '',
          'Detalle Línea': '',
          'Referencia': '',
          'Débito (Bs)': Number(entry.total_debit || 0).toFixed(2),
          'Crédito (Bs)': Number(entry.total_credit || 0).toFixed(2),
          'Tasa BCV': Number(entry.exchange_rate || 1).toFixed(4),
          'Débito ($)': Number(entry.total_debit_usd || 0).toFixed(2),
          'Crédito ($)': Number(entry.total_credit_usd || 0).toFixed(2),
        });
      }
    }
    return flatRows;
  }

  // ============================================================================
  // 3. LIBRO MAYOR ANALÍTICO
  // ============================================================================
  static formatGeneralLedgerData(ledgerResult: any) {
    const flatRows: any[] = [];
    const accounts = ledgerResult.accounts || (Array.isArray(ledgerResult) ? ledgerResult : []);
    for (const acc of accounts) {
      // Fila de saldo inicial
      flatRows.push({
        'Código Cuenta': acc.account_code || acc.code,
        'Nombre Cuenta': acc.account_name || acc.name,
        'Fecha': 'Saldo Inicial',
        'N° Comprobante': '-',
        'Glosa / Concepto': 'SALDO INICIAL ACUMULADO',
        'Débito (Bs)': '-',
        'Crédito (Bs)': '-',
        'Saldo Acumulado (Bs)': Number(acc.initial_balance || 0).toFixed(2),
        'Saldo Acumulado ($)': Number(acc.initial_balance_usd || 0).toFixed(2),
      });

      const movements = acc.movements || acc.lines || [];
      for (const mov of movements) {
        flatRows.push({
          'Código Cuenta': acc.account_code || acc.code,
          'Nombre Cuenta': acc.account_name || acc.name,
          'Fecha': mov.entry_date || mov.date,
          'N° Comprobante': mov.entry_number || '',
          'Glosa / Concepto': mov.description || mov.concept || '',
          'Débito (Bs)': Number(mov.debit || 0).toFixed(2),
          'Crédito (Bs)': Number(mov.credit || 0).toFixed(2),
          'Saldo Acumulado (Bs)': Number(mov.running_balance ?? mov.balance ?? 0).toFixed(2),
          'Saldo Acumulado ($)': Number(mov.running_balance_usd ?? mov.balance_usd ?? 0).toFixed(2),
        });
      }

      // Fila de saldo final
      flatRows.push({
        'Código Cuenta': acc.account_code || acc.code,
        'Nombre Cuenta': acc.account_name || acc.name,
        'Fecha': 'Saldo Final',
        'N° Comprobante': '-',
        'Glosa / Concepto': 'SALDO FINAL DE PERÍODO',
        'Débito (Bs)': Number(acc.total_debit || 0).toFixed(2),
        'Crédito (Bs)': Number(acc.total_credit || 0).toFixed(2),
        'Saldo Acumulado (Bs)': Number(acc.final_balance ?? acc.current_balance ?? 0).toFixed(2),
        'Saldo Acumulado ($)': Number(acc.final_balance_usd ?? acc.current_balance_usd ?? 0).toFixed(2),
      });
    }
    return flatRows;
  }

  // ============================================================================
  // 4. BALANCE DE COMPROBACIÓN DE SUMAS Y SALDOS
  // ============================================================================
  static formatTrialBalanceData(tbResult: any) {
    const items = tbResult.items || tbResult.accounts || (Array.isArray(tbResult) ? tbResult : []);
    return items.map((row: any) => ({
      'Código': row.code,
      'Nombre de Cuenta': row.name,
      'Nivel': row.level,
      'Es Movimiento': row.is_movement ? 'Sí' : 'No (Grupo)',
      'Saldo Anterior Débito (Bs)': Number(row.initial_debit || (row.initial_balance > 0 ? row.initial_balance : 0)).toFixed(2),
      'Saldo Anterior Crédito (Bs)': Number(row.initial_credit || (row.initial_balance < 0 ? Math.abs(row.initial_balance) : 0)).toFixed(2),
      'Movimientos Débito (Bs)': Number(row.period_debit || row.debit || 0).toFixed(2),
      'Movimientos Crédito (Bs)': Number(row.period_credit || row.credit || 0).toFixed(2),
      'Saldo Final Deudor (Bs)': Number(row.final_debit || (row.final_balance > 0 ? row.final_balance : 0)).toFixed(2),
      'Saldo Final Acreedor (Bs)': Number(row.final_credit || (row.final_balance < 0 ? Math.abs(row.final_balance) : 0)).toFixed(2),
      'Saldo Final Neto ($)': Number(row.final_balance_usd || 0).toFixed(2),
    }));
  }

  // ============================================================================
  // 5. ESTADOS FINANCIEROS
  // ============================================================================
  static formatBalanceSheetData(bsData: any) {
    const flatRows: any[] = [];
    
    const pushGroup = (groupName: string, items: any[]) => {
      if (!items || items.length === 0) return;
      for (const item of items) {
        flatRows.push({
          'Clasificación / Grupo': groupName,
          'Código': item.code || '',
          'Nombre / Rubro': item.name || '',
          'Saldo en Bolívares (VES)': Number(item.balance || item.amount || 0).toFixed(2),
          'Saldo en Dólares (USD)': Number(item.balance_usd || item.amount_usd || 0).toFixed(2),
          'Ajuste Inflación VEN-NIF (Bs)': item.inflation_adjustment ? Number(item.inflation_adjustment).toFixed(2) : '0.00',
        });
      }
    };

    pushGroup('Activo Corriente', bsData.currentAssets || bsData.current_assets || []);
    pushGroup('Activo No Corriente', bsData.nonCurrentAssets || bsData.non_current_assets || []);
    pushGroup('Pasivo Corriente', bsData.currentLiabilities || bsData.current_liabilities || []);
    pushGroup('Pasivo No Corriente', bsData.nonCurrentLiabilities || bsData.non_current_liabilities || []);
    pushGroup('Patrimonio Neto', bsData.equity || []);

    // Resumen de Ecuación Patrimonial
    flatRows.push({
      'Clasificación / Grupo': 'TOTAL ACTIVO',
      'Código': '1',
      'Nombre / Rubro': 'TOTAL GENERAL DEL ACTIVO',
      'Saldo en Bolívares (VES)': Number(bsData.totalAssets || bsData.total_assets || 0).toFixed(2),
      'Saldo en Dólares (USD)': Number(bsData.totalAssetsUSD || bsData.total_assets_usd || 0).toFixed(2),
      'Ajuste Inflación VEN-NIF (Bs)': '-',
    });
    flatRows.push({
      'Clasificación / Grupo': 'TOTAL PASIVO Y PATRIMONIO',
      'Código': '2 + 3',
      'Nombre / Rubro': 'TOTAL GENERAL PASIVO + PATRIMONIO',
      'Saldo en Bolívares (VES)': Number(bsData.totalLiabilitiesAndEquity || bsData.total_liabilities_and_equity || 0).toFixed(2),
      'Saldo en Dólares (USD)': Number(bsData.totalLiabilitiesAndEquityUSD || bsData.total_liabilities_and_equity_usd || 0).toFixed(2),
      'Ajuste Inflación VEN-NIF (Bs)': '-',
    });

    return flatRows;
  }

  static formatIncomeStatementData(isData: any) {
    const flatRows: any[] = [];
    const pushSection = (sectionName: string, items: any[]) => {
      if (!items || items.length === 0) return;
      for (const item of items) {
        flatRows.push({
          'Sección': sectionName,
          'Código': item.code || '',
          'Concepto': item.name || '',
          'Monto en Bolívares (VES)': Number(item.balance || item.amount || 0).toFixed(2),
          'Monto en Dólares (USD)': Number(item.balance_usd || item.amount_usd || 0).toFixed(2),
        });
      }
    };

    pushSection('Ingresos de Actividades Ordinarias', isData.revenues || []);
    pushSection('Costo de Ventas y Servicios', isData.costOfSales || isData.cost_of_sales || []);
    pushSection('Gastos de Operación y Administración', isData.operatingExpenses || isData.operating_expenses || []);
    pushSection('Otros Ingresos / Gastos y Finanzas', isData.otherItems || isData.other_items || []);

    flatRows.push({
      'Sección': 'RESULTADO DEL EJERCICIO',
      'Código': '5 - 6',
      'Concepto': 'UTILIDAD / PÉRDIDA NETA DEL PERÍODO',
      'Monto en Bolívares (VES)': Number(isData.netIncome || isData.net_income || 0).toFixed(2),
      'Monto en Dólares (USD)': Number(isData.netIncomeUSD || isData.net_income_usd || 0).toFixed(2),
    });

    return flatRows;
  }

  static formatCashFlowData(cfData: any) {
    const flatRows: any[] = [];
    const pushActivities = (category: string, items: any[]) => {
      if (!items || items.length === 0) return;
      for (const item of items) {
        flatRows.push({
          'Actividad': category,
          'Concepto': item.concept || item.name || '',
          'Flujo Neto (VES)': Number(item.amount || item.balance || 0).toFixed(2),
          'Flujo Neto (USD)': Number(item.amount_usd || item.balance_usd || 0).toFixed(2),
        });
      }
    };

    pushActivities('Actividades de Operación', cfData.operatingActivities || cfData.operating || []);
    pushActivities('Actividades de Inversión', cfData.investingActivities || cfData.investing || []);
    pushActivities('Actividades de Financiamiento', cfData.financingActivities || cfData.financing || []);

    flatRows.push({
      'Actividad': 'VARIACIÓN TOTAL DE EFECTIVO',
      'Concepto': 'Incremento / Disminución Neto en Efectivo',
      'Flujo Neto (VES)': Number(cfData.netCashFlow || cfData.net_cash_flow || 0).toFixed(2),
      'Flujo Neto (USD)': Number(cfData.netCashFlowUSD || cfData.net_cash_flow_usd || 0).toFixed(2),
    });

    return flatRows;
  }

  static formatEquityChangesData(ecData: any) {
    const items = ecData.items || ecData.equity_items || (Array.isArray(ecData) ? ecData : []);
    return items.map((item: any) => ({
      'Rubro Patrimonial': item.name || item.concept,
      'Saldo Inicial (VES)': Number(item.initialBalance || item.initial_balance || 0).toFixed(2),
      'Aumentos / Aportes (VES)': Number(item.increases || 0).toFixed(2),
      'Disminuciones / Dividendos (VES)': Number(item.decreases || 0).toFixed(2),
      'Resultado del Ejercicio (VES)': Number(item.periodResult || item.period_result || 0).toFixed(2),
      'Saldo Final (VES)': Number(item.finalBalance || item.final_balance || 0).toFixed(2),
      'Saldo Final (USD)': Number(item.finalBalanceUSD || item.final_balance_usd || 0).toFixed(2),
    }));
  }

  static formatFinancialNotesData(notesData: any) {
    const notes = notesData.notes || (Array.isArray(notesData) ? notesData : []);
    return notes.map((n: any, idx: number) => ({
      'N° de Nota': n.number || idx + 1,
      'Título / Rubro Revelado': n.title || '',
      'Base Técnica (VEN-NIF / NIIF)': n.standard || 'VEN-NIF PYME',
      'Contenido y Revelación Legal': n.content || n.description || '',
    }));
  }
}

