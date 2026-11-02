import { jsPDF } from 'jspdf';
import autoTableImport from 'jspdf-autotable';
import { CompanyPdfInfo, BasePdfOptions, ReportsPdfEngine } from '../reports/reports-pdf';
import { formatMoneyVES, formatMoneyUSD } from '@ero/shared';

const autoTable = (typeof autoTableImport === 'function'
  ? autoTableImport
  : (autoTableImport as any).default || autoTableImport) as typeof autoTableImport;

export class AccountingPdfEngine {
  private static readonly COLOR_PRIMARY = [15, 23, 42] as [number, number, number]; // Slate-900
  private static readonly COLOR_HEADER = [30, 41, 59] as [number, number, number]; // Slate-800
  private static readonly COLOR_ACCENT = [0, 123, 255] as [number, number, number]; // Primary Blue
  private static readonly COLOR_MUTED = [100, 116, 139] as [number, number, number]; // Slate-500
  private static readonly COLOR_BORDER = [226, 232, 240] as [number, number, number]; // Slate-200
  private static readonly COLOR_BG_LIGHT = [248, 250, 252] as [number, number, number]; // Slate-50
  private static readonly COLOR_TOTALS = [241, 245, 249] as [number, number, number]; // Slate-100

  /**
   * Inicializa el documento oficial de contabilidad con encabezado legal
   */
  private static initDoc(
    company: CompanyPdfInfo,
    title: string,
    subtitle: string,
    userName: string,
    orientation: 'portrait' | 'landscape' = 'portrait',
    periodText?: string
  ): { doc: jsPDF; startY: number; pageWidth: number; pageHeight: number } {
    const { doc, startY, pageWidth, pageHeight } = ReportsPdfEngine.initDocument(company, {
      title,
      subtitle,
      userName,
      orientation,
      periodText,
    });
    return { doc, startY, pageWidth, pageHeight };
  }

  /**
   * Finaliza el PDF agregando numeración de páginas legal y pie de auditoría
   */
  private static finalizeDoc(doc: jsPDF): Buffer {
    return ReportsPdfEngine.finalize(doc);
  }

  // ==========================================================================
  // 1. REPORTE DEL PLAN / CATÁLOGO DE CUENTAS (VEN-NIF)
  // ==========================================================================
  static generateChartOfAccountsPDF(
    accounts: any[],
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDoc(
      company,
      'CATÁLOGO GENERAL DE CUENTAS CONTABLES (PLAN DE CUENTAS)',
      'Estructura Jerárquica Oficial bajo Normativa VEN-NIF / NIIF para PYMES',
      userName,
      'portrait'
    );

    const tableData = accounts.map((acc) => {
      const isHeader = acc.level <= 2;
      const indentation = '  '.repeat(Math.max(0, acc.level - 1));
      const typeMap: Record<string, string> = {
        ASSET: 'Activo',
        LIABILITY: 'Pasivo',
        EQUITY: 'Patrimonio',
        REVENUE: 'Ingreso',
        COST: 'Costo',
        EXPENSE: 'Gasto',
        ORDER: 'Orden',
      };

      return [
        acc.code,
        `${indentation}${acc.name}`,
        typeMap[acc.accountType] || acc.accountType,
        acc.normalBalance === 'DEBIT' ? 'Deudor' : 'Acreedor',
        acc.acceptsPostings ? 'Detalle' : 'Grupo',
        acc.isMonetary ? 'Monetaria' : 'No Monet.',
        acc.acceptsPostings || acc.balanceVes !== 0 ? `${formatMoneyVES(acc.balanceVes)}` : '-',
      ];
    });

    autoTable(doc, {
      startY: startY + 4,
      head: [
        ['Código', 'Nombre / Título de la Cuenta', 'Tipo', 'Naturaleza', 'Nivel', 'VEN-NIF', 'Saldo Actual (VES)'],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left',
      },
      styles: {
        font: 'helvetica',
        fontSize: 6.8,
        cellPadding: 1.8,
        lineColor: this.COLOR_BORDER,
        lineWidth: 0.15,
        textColor: this.COLOR_PRIMARY,
      },
      columnStyles: {
        0: { fontStyle: 'bold', font: 'courier', cellWidth: 26 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 18 },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 28, halign: 'right', font: 'courier', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        const rowAcc = accounts[data.row.index];
        if (rowAcc && rowAcc.level <= 2 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [245, 247, 250];
        }
      },
      margin: { left: 14, right: 14, bottom: 20 },
    });

    return this.finalizeDoc(doc);
  }

  // ==========================================================================
  // 2. REPORTE DEL LIBRO DIARIO LEGAL (CÓDIGO DE COMERCIO ART. 32-38)
  // ==========================================================================
  static generateJournalReportPDF(
    entries: any[],
    company: CompanyPdfInfo,
    userName: string,
    periodText?: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDoc(
      company,
      'LIBRO DIARIO LEGAL DE CONTABILIDAD',
      'Registro Cronológico Obligatorio de Operaciones (Código de Comercio Venezolano Art. 32 al 38)',
      userName,
      'landscape',
      periodText || 'Ejercicio Económico en Curso'
    );

    let currentY = startY + 4;

    const totalDebits = entries.reduce((s, e) => s + (e.totalDebitVes || 0), 0);
    const totalCredits = entries.reduce((s, e) => s + (e.totalCreditVes || 0), 0);

    // Iterar cada asiento con su bloque de partida doble
    const tableRows: any[] = [];
    for (const entry of entries) {
      // Fila de encabezado de comprobante estructurada por columnas para evitar solapamientos
      const statusLabel =
        entry.status === 'POSTED'
          ? 'ASENTADO LEGAL'
          : entry.status === 'ANNULLED'
          ? 'ANULADO'
          : 'BORRADOR';
      const statusColor: [number, number, number] =
        entry.status === 'POSTED'
          ? [16, 120, 70]
          : entry.status === 'ANNULLED'
          ? [180, 40, 40]
          : [100, 116, 139];

      tableRows.push([
        {
          content: `${entry.entryNumber || 'ASIENTO'}`,
          styles: {
            fillColor: [240, 244, 248],
            font: 'courier',
            fontStyle: 'bold',
            textColor: this.COLOR_PRIMARY,
            fontSize: 7.2,
          },
        },
        {
          content: `Fecha: ${entry.entryDate || '-'}`,
          styles: {
            fillColor: [240, 244, 248],
            fontStyle: 'bold',
            textColor: [51, 65, 85],
            fontSize: 7,
          },
        },
        {
          content: `Concepto: ${entry.concept || 'Sin descripción'}`,
          styles: {
            fillColor: [240, 244, 248],
            fontStyle: 'bold',
            textColor: [15, 23, 42],
            fontSize: 7,
          },
        },
        {
          content: statusLabel,
          styles: {
            fillColor: [240, 244, 248],
            halign: 'center',
            fontStyle: 'bold',
            textColor: statusColor,
            fontSize: 6.8,
          },
        },
        {
          content: `Tasa BCV: ${formatMoneyVES(entry.exchangeRate || 1)}`,
          colSpan: 2,
          styles: {
            fillColor: [240, 244, 248],
            halign: 'right',
            font: 'courier',
            fontStyle: 'bold',
            textColor: this.COLOR_PRIMARY,
            fontSize: 7,
          },
        },
      ]);

      if (entry.lines && entry.lines.length > 0) {
        for (const line of entry.lines) {
          tableRows.push([
            line.accountCode || '',
            line.accountName || '',
            line.description || entry.concept,
            line.referenceDoc || '-',
            line.debitVes > 0 ? `${formatMoneyVES(line.debitVes)}` : '-',
            line.creditVes > 0 ? `${formatMoneyVES(line.creditVes)}` : '-',
          ]);
        }
      }

      // Fila de totales del asiento
      tableRows.push([
        {
          content: 'TOTAL COMPROBANTE:',
          colSpan: 4,
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 7, fillColor: [250, 250, 250] },
        },
        {
          content: `${formatMoneyVES(entry.totalDebitVes)}`,
          styles: { halign: 'right', fontStyle: 'bold', font: 'courier', fontSize: 7, fillColor: [250, 250, 250] },
        },
        {
          content: `${formatMoneyVES(entry.totalCreditVes)}`,
          styles: { halign: 'right', fontStyle: 'bold', font: 'courier', fontSize: 7, fillColor: [250, 250, 250] },
        },
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [
        ['Código Cuenta', 'Nombre de la Cuenta', 'Glosa / Detalle del Asiento', 'Doc. Ref.', 'Debe / Débito (VES)', 'Haber / Crédito (VES)'],
      ],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      styles: {
        font: 'helvetica',
        fontSize: 6.8,
        cellPadding: 1.6,
        lineColor: this.COLOR_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { font: 'courier', fontStyle: 'bold', cellWidth: 30 },
        1: { cellWidth: 56 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 24, font: 'courier', halign: 'center' },
        4: { cellWidth: 34, halign: 'right', font: 'courier' },
        5: { cellWidth: 34, halign: 'right', font: 'courier' },
      },
      margin: { left: 14, right: 14, bottom: 20 },
    });

    return this.finalizeDoc(doc);
  }

  // ==========================================================================
  // 3. COMPROBANTE CONTABLE INDIVIDUAL (VOUCHER DE DIARIO)
  // ==========================================================================
  static generateJournalVoucherPDF(
    entry: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDoc(
      company,
      `COMPROBANTE DE DIARIO CONTABLE: ${entry.entryNumber}`,
      `Tipo de Asiento: ${entry.entryType} | Fecha de Asiento: ${entry.entryDate} | Tasa Oficial BCV: ${formatMoneyVES(entry.exchangeRate)}`,
      userName,
      'portrait'
    );

    let currentY = startY + 4;

    // Resumen en recuadro del concepto
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY, pageWidth - 28, 14, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 14, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
    doc.text('CONCEPTO / GLOSA GENERAL:', 18, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(entry.concept || 'Sin descripción', 18, currentY + 10);

    currentY += 18;

    const lines = entry.lines || [];
    const tableData = lines.map((l: any) => [
      l.accountCode || '',
      l.accountName || '',
      l.description || entry.concept,
      l.referenceDoc || '-',
      l.debitVes > 0 ? `${formatMoneyVES(l.debitVes)}` : '-',
      l.creditVes > 0 ? `${formatMoneyVES(l.creditVes)}` : '-',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        ['Código Cuenta', 'Nombre de la Cuenta', 'Detalle de la Operación', 'Doc. Ref.', 'Débito (VES)', 'Crédito (VES)'],
      ],
      body: tableData,
      foot: [
        [
          { content: 'TOTALES CUADRADOS (PARTIDA DOBLE):', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${formatMoneyVES(entry.totalDebitVes)}`, styles: { halign: 'right', fontStyle: 'bold', font: 'courier' } },
          { content: `${formatMoneyVES(entry.totalCreditVes)}`, styles: { halign: 'right', fontStyle: 'bold', font: 'courier' } },
        ],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: this.COLOR_PRIMARY,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: 2,
        lineColor: this.COLOR_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { font: 'courier', fontStyle: 'bold', cellWidth: 26 },
        1: { cellWidth: 45 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 20, font: 'courier' },
        4: { cellWidth: 28, halign: 'right', font: 'courier' },
        5: { cellWidth: 28, halign: 'right', font: 'courier' },
      },
      margin: { left: 14, right: 14, bottom: 35 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;

    // Firmas reglamentarias
    ReportsPdfEngine.drawSignatureBoxes(
      doc,
      finalY,
      [
        { title: 'ELABORADO POR', subtitle: entry.createdByName || userName },
        { title: 'REVISADO POR', subtitle: 'Contador General' },
        { title: 'ASENTADO Y APROBADO', subtitle: entry.postedByName || 'Administración' },
      ],
      pageWidth
    );

    return this.finalizeDoc(doc);
  }

  // ==========================================================================
  // 4. REPORTE DEL LIBRO MAYOR ANALÍTICO
  // ==========================================================================
  static generateGeneralLedgerReportPDF(
    ledgerData: any,
    company: CompanyPdfInfo,
    userName: string,
    periodText?: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDoc(
      company,
      'LIBRO MAYOR ANALÍTICO DE CONTABILIDAD',
      'Movimientos Analíticos y Saldos Progresivos Acumulados por Cuenta',
      userName,
      'landscape',
      periodText || 'Período Contable Seleccionado'
    );

    let currentY = startY + 4;
    const tableRows: any[] = [];
    const accounts = Array.isArray(ledgerData) ? ledgerData : (ledgerData.accounts || []);

    for (const item of accounts) {
      const isDebitNormal = item.account.normalBalance === 'DEBIT';

      // Cabecera de la cuenta
      tableRows.push([
        {
          content: `CUENTA: ${item.account.code} - ${item.account.name.toUpperCase()}   |   Naturaleza: ${isDebitNormal ? 'DEUDORA' : 'ACREEDORA'}   |   SALDO INICIAL AL INICIO: ${formatMoneyVES(item.initialBalanceVes)}`,
          colSpan: 7,
          styles: {
            fillColor: [235, 242, 250],
            fontStyle: 'bold',
            textColor: this.COLOR_PRIMARY,
            fontSize: 7.2,
          },
        },
      ]);

      if (item.movements && item.movements.length > 0) {
        for (const mov of item.movements) {
          tableRows.push([
            mov.entryDate,
            mov.entryNumber,
            mov.description || mov.concept,
            mov.referenceDoc || '-',
            mov.debitVes > 0 ? `${formatMoneyVES(mov.debitVes)}` : '-',
            mov.creditVes > 0 ? `${formatMoneyVES(mov.creditVes)}` : '-',
            `${formatMoneyVES(mov.runningBalanceVes)}`,
          ]);
        }
      } else {
        tableRows.push([
          {
            content: 'Sin movimientos registrados en el período analizado.',
            colSpan: 7,
            styles: { halign: 'center', textColor: this.COLOR_MUTED, fontStyle: 'italic', fontSize: 6.8 },
          },
        ]);
      }

      // Subtotales de la cuenta
      tableRows.push([
        {
          content: `SUMAS DE PERÍODO Y SALDO FINAL DE ${item.account.code}:`,
          colSpan: 4,
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 7, fillColor: [248, 250, 252] },
        },
        {
          content: `${formatMoneyVES(item.totalPeriodDebitVes)}`,
          styles: { halign: 'right', fontStyle: 'bold', font: 'courier', fontSize: 7, fillColor: [248, 250, 252] },
        },
        {
          content: `${formatMoneyVES(item.totalPeriodCreditVes)}`,
          styles: { halign: 'right', fontStyle: 'bold', font: 'courier', fontSize: 7, fillColor: [248, 250, 252] },
        },
        {
          content: `${formatMoneyVES(item.endingBalanceVes)}`,
          styles: { halign: 'right', fontStyle: 'bold', font: 'courier', fontSize: 7.2, fillColor: [240, 245, 250], textColor: [0, 123, 255] },
        },
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [
        ['Fecha', 'Comprobante', 'Concepto / Glosa de la Operación', 'Doc. Ref.', 'Débitos (VES)', 'Créditos (VES)', 'Saldo Progresivo'],
      ],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      styles: {
        font: 'helvetica',
        fontSize: 6.8,
        cellPadding: 1.6,
        lineColor: this.COLOR_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 26, font: 'courier', fontStyle: 'bold' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 22, font: 'courier' },
        4: { cellWidth: 30, halign: 'right', font: 'courier' },
        5: { cellWidth: 30, halign: 'right', font: 'courier' },
        6: { cellWidth: 32, halign: 'right', font: 'courier', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 20 },
    });

    return this.finalizeDoc(doc);
  }

  // ==========================================================================
  // 5. REPORTE DE BALANCE DE COMPROBACIÓN DE SUMAS Y SALDOS
  // ==========================================================================
  static generateTrialBalanceReportPDF(
    trialData: any,
    company: CompanyPdfInfo,
    userName: string,
    periodText?: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDoc(
      company,
      'BALANCE DE COMPROBACIÓN DE SUMAS Y SALDOS',
      'Comprobación Cuadrada de Partida Doble conforme a Normas Contables Venezolanas',
      userName,
      'landscape',
      periodText || 'Ejercicio Económico'
    );

    let currentY = startY + 4;
    const accounts = trialData.accounts || [];
    const totals = trialData.totals || {};

    const tableRows = accounts.map((acc: any) => {
      const isTitle = acc.level <= 2;
      const indentation = '  '.repeat(Math.max(0, acc.level - 1));
      const isDebitNormal = acc.normalBalance === 'DEBIT';
      const finalDeudor = isDebitNormal && acc.finalBalance > 0 ? acc.finalBalance : 0;
      const finalAcreedor = !isDebitNormal && acc.finalBalance > 0 ? acc.finalBalance : 0;

      return [
        acc.code,
        `${indentation}${acc.name}`,
        acc.periodDebit > 0 ? `${formatMoneyVES(acc.periodDebit)}` : '-',
        acc.periodCredit > 0 ? `${formatMoneyVES(acc.periodCredit)}` : '-',
        finalDeudor > 0 ? `${formatMoneyVES(finalDeudor)}` : '-',
        finalAcreedor > 0 ? `${formatMoneyVES(finalAcreedor)}` : '-',
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          { content: 'Código Cuenta', rowSpan: 2 },
          { content: 'Nombre o Título de la Cuenta', rowSpan: 2 },
          { content: 'Movimientos del Período', colSpan: 2, styles: { halign: 'center' } },
          { content: 'Saldos al Cierre', colSpan: 2, styles: { halign: 'center' } },
        ],
        ['Débitos (Debe)', 'Créditos (Haber)', 'Saldo Deudor', 'Saldo Acreedor'],
      ],
      body: tableRows,
      foot: [
        [
          { content: 'SUMAS IGUALES DE COMPROBACIÓN:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${formatMoneyVES(totals.totalPeriodDebit || 0)}`, styles: { halign: 'right', fontStyle: 'bold', font: 'courier' } },
          { content: `${formatMoneyVES(totals.totalPeriodCredit || 0)}`, styles: { halign: 'right', fontStyle: 'bold', font: 'courier' } },
          { content: `${formatMoneyVES(totals.totalFinalDebit || 0)}`, styles: { halign: 'right', fontStyle: 'bold', font: 'courier', textColor: [40, 167, 69] } },
          { content: `${formatMoneyVES(totals.totalFinalCredit || 0)}`, styles: { halign: 'right', fontStyle: 'bold', font: 'courier', textColor: [40, 167, 69] } },
        ],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: this.COLOR_PRIMARY,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      styles: {
        font: 'helvetica',
        fontSize: 6.8,
        cellPadding: 1.8,
        lineColor: this.COLOR_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { font: 'courier', fontStyle: 'bold', cellWidth: 28 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'right', font: 'courier' },
        3: { cellWidth: 35, halign: 'right', font: 'courier' },
        4: { cellWidth: 35, halign: 'right', font: 'courier', fontStyle: 'bold' },
        5: { cellWidth: 35, halign: 'right', font: 'courier', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        const rowAcc = accounts[data.row.index];
        if (rowAcc && rowAcc.level <= 2 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [245, 247, 250];
        }
      },
      margin: { left: 14, right: 14, bottom: 20 },
    });

    return this.finalizeDoc(doc);
  }

  // ==========================================================================
  // 6. ESTADO DE SITUACIÓN FINANCIERA (BALANCE GENERAL) BAJO VEN-NIF
  // ==========================================================================
  static generateBalanceSheetPDF(
    bs: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const subtitle = bs.isReexpressed
      ? `Valores Reexpresados a Moneda Constante por Efectos de Inflación (VEN-NIF B-10) al ${bs.asOfDate}`
      : `Valores Históricos Nominales al ${bs.asOfDate}`;

    const { doc, startY, pageWidth } = this.initDoc(
      company,
      'ESTADO DE SITUACIÓN FINANCIERA (BALANCE GENERAL)',
      subtitle,
      userName,
      'portrait',
      `Fecha de Corte: ${bs.asOfDate}`
    );

    let currentY = startY + 4;

    const tableRows: any[] = [];

    // ACTIVO
    tableRows.push([
      { content: '1. ACTIVO', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [235, 242, 250], textColor: [0, 123, 255] } },
    ]);
    tableRows.push([
      { content: '1.1 ACTIVO CORRIENTE', colSpan: 2, styles: { fontStyle: 'bold', textColor: this.COLOR_PRIMARY } },
    ]);
    for (const a of bs.currentAssets || []) {
      tableRows.push([`   ${a.name}`, `${formatMoneyVES(a.balance)}`]);
    }
    tableRows.push([
      { content: 'TOTAL ACTIVO CORRIENTE:', styles: { fontStyle: 'bold', halign: 'right' } },
      { content: `${formatMoneyVES(bs.totalCurrentAssets)}`, styles: { fontStyle: 'bold', font: 'courier' } },
    ]);

    tableRows.push([
      { content: '1.2 ACTIVO NO CORRIENTE (PROPIEDADES, PLANTA Y EQUIPOS)', colSpan: 2, styles: { fontStyle: 'bold', textColor: this.COLOR_PRIMARY } },
    ]);
    for (const a of bs.nonCurrentAssets || []) {
      tableRows.push([`   ${a.name}`, `${formatMoneyVES(a.balance)}`]);
    }
    tableRows.push([
      { content: 'TOTAL ACTIVO NO CORRIENTE:', styles: { fontStyle: 'bold', halign: 'right' } },
      { content: `${formatMoneyVES(bs.totalNonCurrentAssets)}`, styles: { fontStyle: 'bold', font: 'courier' } },
    ]);

    tableRows.push([
      { content: 'TOTAL DEL ACTIVO:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 248, 255], textColor: [0, 123, 255] } },
      { content: `${formatMoneyVES(bs.totalAssets)}`, styles: { fontStyle: 'bold', font: 'courier', fillColor: [240, 248, 255], textColor: [0, 123, 255] } },
    ]);

    // PASIVO
    tableRows.push([
      { content: '2. PASIVO', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [255, 250, 235], textColor: [180, 110, 0] } },
    ]);
    tableRows.push([
      { content: '2.1 PASIVO CORRIENTE (OBLIGACIONES A CORTO PLAZO)', colSpan: 2, styles: { fontStyle: 'bold', textColor: this.COLOR_PRIMARY } },
    ]);
    for (const a of bs.currentLiabilities || []) {
      tableRows.push([`   ${a.name}`, `${formatMoneyVES(a.balance)}`]);
    }
    tableRows.push([
      { content: 'TOTAL PASIVO CORRIENTE:', styles: { fontStyle: 'bold', halign: 'right' } },
      { content: `${formatMoneyVES(bs.totalCurrentLiabilities)}`, styles: { fontStyle: 'bold', font: 'courier' } },
    ]);

    if (bs.nonCurrentLiabilities && bs.nonCurrentLiabilities.length > 0) {
      tableRows.push([
        { content: '2.2 PASIVO NO CORRIENTE', colSpan: 2, styles: { fontStyle: 'bold', textColor: this.COLOR_PRIMARY } },
      ]);
      for (const a of bs.nonCurrentLiabilities) {
        tableRows.push([`   ${a.name}`, `${formatMoneyVES(a.balance)}`]);
      }
      tableRows.push([
        { content: 'TOTAL PASIVO NO CORRIENTE:', styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `${formatMoneyVES(bs.totalNonCurrentLiabilities)}`, styles: { fontStyle: 'bold', font: 'courier' } },
      ]);
    }

    tableRows.push([
      { content: 'TOTAL DEL PASIVO:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 250, 240] } },
      { content: `${formatMoneyVES(bs.totalLiabilities)}`, styles: { fontStyle: 'bold', font: 'courier', fillColor: [255, 250, 240] } },
    ]);

    // PATRIMONIO
    tableRows.push([
      { content: '3. PATRIMONIO NETO', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [235, 250, 240], textColor: [40, 167, 69] } },
    ]);
    for (const a of bs.equityAccounts || []) {
      tableRows.push([`   ${a.name}`, `${formatMoneyVES(a.balance)}`]);
    }
    tableRows.push([
      { content: '   Resultado Neto del Ejercicio Económico', styles: { fontStyle: 'bold', textColor: [0, 123, 255] } },
      { content: `${formatMoneyVES(bs.currentPeriodNetIncome)}`, styles: { fontStyle: 'bold', font: 'courier', textColor: [0, 123, 255] } },
    ]);
    tableRows.push([
      { content: 'TOTAL PATRIMONIO NETO:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 250, 245] } },
      { content: `${formatMoneyVES(bs.totalEquity)}`, styles: { fontStyle: 'bold', font: 'courier', fillColor: [240, 250, 245] } },
    ]);

    // TOTAL PASIVO Y PATRIMONIO
    tableRows.push([
      { content: 'TOTAL PASIVO Y PATRIMONIO:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 240, 255], textColor: this.COLOR_PRIMARY, fontSize: 8 } },
      { content: `${formatMoneyVES(bs.totalLiabilitiesAndEquity)}`, styles: { fontStyle: 'bold', font: 'courier', fillColor: [230, 240, 255], textColor: this.COLOR_PRIMARY, fontSize: 8 } },
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Rubros del Balance General', 'Importe al Cierre (VES)']],
      body: tableRows,
      theme: 'plain',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        font: 'helvetica',
        fontSize: 7.2,
        cellPadding: 1.8,
        lineColor: this.COLOR_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 45, halign: 'right', font: 'courier' },
      },
      margin: { left: 14, right: 14, bottom: 35 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    ReportsPdfEngine.drawSignatureBoxes(
      doc,
      finalY,
      [
        { title: 'CONTADOR PÚBLICO COLEGIADO', subtitle: 'CPC Lic. Responsable' },
        { title: 'REPRESENTANTE LEGAL', subtitle: company.legalName || 'Gerente General' },
        { title: 'COMISARIO MERCANTIL', subtitle: 'Lic. Comisario CPC' },
      ],
      pageWidth
    );

    return this.finalizeDoc(doc);
  }

  // ==========================================================================
  // 7. ESTADO DE RESULTADOS INTEGRAL (GANANCIAS Y PÉRDIDAS)
  // ==========================================================================
  static generateIncomeStatementPDF(
    pnl: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDoc(
      company,
      'ESTADO DE RESULTADOS INTEGRAL (GANANCIAS Y PÉRDIDAS)',
      `Período Comprendido del ${pnl.startDate} al ${pnl.endDate}`,
      userName,
      'portrait',
      `Del ${pnl.startDate} al ${pnl.endDate}`
    );

    let currentY = startY + 4;

    const tableRows = [
      ['INGRESOS OPERACIONALES DE ACTIVIDADES ORDINARIAS', `${formatMoneyVES(pnl.totalRevenue)}`],
      ['Menos: Costo de Mercancía Vendida y Despachada', `(${formatMoneyVES(pnl.totalCostOfSales)})`],
      [
        { content: 'UTILIDAD BRUTA EN VENTAS:', styles: { fontStyle: 'bold', fillColor: [240, 250, 245], textColor: [40, 167, 69] } },
        { content: `${formatMoneyVES(pnl.grossProfit)}`, styles: { fontStyle: 'bold', font: 'courier', fillColor: [240, 250, 245], textColor: [40, 167, 69] } },
      ],
      ['Menos: Gastos Operacionales de Administración', `(${formatMoneyVES(pnl.totalOperatingExpenses)})`],
      [
        { content: 'UTILIDAD OPERACIONAL:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
        { content: `${formatMoneyVES(pnl.operatingProfit)}`, styles: { fontStyle: 'bold', font: 'courier', fillColor: [245, 247, 250] } },
      ],
      ['Ingresos Financieros / Ganancia Cambiaria BCV', `${formatMoneyVES(pnl.totalFinancialRevenue)}`],
      ['Menos: Gastos Financieros / Pérdida Cambiaria / IGTF', `(${formatMoneyVES(pnl.totalFinancialExpenses)})`],
      [
        { content: 'UTILIDAD ANTES DE IMPUESTOS Y RESERVA:', styles: { fontStyle: 'bold' } },
        { content: `${formatMoneyVES(pnl.netIncomeBeforeTaxes)}`, styles: { fontStyle: 'bold', font: 'courier' } },
      ],
      ['Provisión Estimada Impuesto Sobre la Renta (ISLR - SENIAT)', `(${formatMoneyVES(pnl.estimatedIslr)})`],
      [
        { content: 'UTILIDAD NETA DEL EJERCICIO ECONÓMICO:', styles: { fontStyle: 'bold', fontSize: 8, fillColor: [230, 240, 255], textColor: [0, 123, 255] } },
        { content: `${formatMoneyVES(pnl.netIncome)}`, styles: { fontStyle: 'bold', fontSize: 8, font: 'courier', fillColor: [230, 240, 255], textColor: [0, 123, 255] } },
      ],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Partidas del Estado de Rendimiento Financiero', 'Monto del Ejercicio (VES)']],
      body: tableRows as any,
      theme: 'grid',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2.2,
        lineColor: this.COLOR_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 48, halign: 'right', font: 'courier' },
      },
      margin: { left: 14, right: 14, bottom: 35 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    ReportsPdfEngine.drawSignatureBoxes(
      doc,
      finalY,
      [
        { title: 'CONTADOR PÚBLICO COLEGIADO', subtitle: 'CPC Lic. Responsable' },
        { title: 'REPRESENTANTE LEGAL', subtitle: company.legalName || 'Gerente General' },
        { title: 'COMISARIO MERCANTIL', subtitle: 'Lic. Comisario CPC' },
      ],
      pageWidth
    );

    return this.finalizeDoc(doc);
  }

  // ==========================================================================
  // 8. ESTADO DE FLUJOS DE EFECTIVO (MÉTODO INDIRECTO)
  // ==========================================================================
  static generateCashFlowPDF(
    cf: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDoc(
      company,
      'ESTADO DE FLUJOS DE EFECTIVO (MÉTODO INDIRECTO)',
      `Del ${cf.startDate} al ${cf.endDate} - Normativa NIIF / VEN-NIF`,
      userName,
      'portrait'
    );

    let currentY = startY + 4;

    const tableRows = [
      [{ content: '1. ACTIVIDADES DE OPERACIÓN', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 245, 250] } }],
      ['   Utilidad / Ganancia Neta del Ejercicio', `${formatMoneyVES(cf.operatingActivities?.netIncome || 0)}`],
      ['   Ajuste por partidas que no requieren efectivo (Depreciaciones)', `${formatMoneyVES(cf.operatingActivities?.depreciationAdjustment || 0)}`],
      [
        { content: 'FLUJO NETO PROVENIENTE DE OPERACIONES:', styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `${formatMoneyVES(cf.operatingActivities?.operatingCashFlow || 0)}`, styles: { fontStyle: 'bold', font: 'courier', textColor: [40, 167, 69] } },
      ],
      [{ content: '2. ACTIVIDADES DE INVERSIÓN Y FINANCIAMIENTO', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 245, 250] } }],
      ['   Flujo de Efectivo en Actividades de Inversión y Financiamiento', 'Bs. 0,00'],
      [
        { content: 'AUMENTO / (DISMINUCIÓN) NETO DE EFECTIVO:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 247, 250] } },
        { content: `${formatMoneyVES(cf.netCashIncrease || 0)}`, styles: { fontStyle: 'bold', font: 'courier', fillColor: [245, 247, 250] } },
      ],
      ['Efectivo y Equivalentes de Efectivo al Inicio del Ejercicio', `${formatMoneyVES(cf.initialCash || 0)}`],
      [
        { content: 'EFECTIVO Y EQUIVALENTES DE EFECTIVO AL CIERRE:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 240, 255], textColor: [0, 123, 255], fontSize: 8 } },
        { content: `${formatMoneyVES(cf.finalCash || 0)}`, styles: { fontStyle: 'bold', font: 'courier', fillColor: [230, 240, 255], textColor: [0, 123, 255], fontSize: 8 } },
      ],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Concepto del Flujo de Fondos', 'Importe del Período (VES)']],
      body: tableRows as any,
      theme: 'grid',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2.2,
        lineColor: this.COLOR_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 48, halign: 'right', font: 'courier' },
      },
      margin: { left: 14, right: 14, bottom: 35 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    ReportsPdfEngine.drawSignatureBoxes(
      doc,
      finalY,
      [
        { title: 'CONTADOR PÚBLICO COLEGIADO', subtitle: 'CPC Lic. Responsable' },
        { title: 'REPRESENTANTE LEGAL', subtitle: company.legalName || 'Gerente General' },
      ],
      pageWidth
    );

    return this.finalizeDoc(doc);
  }

  // ==========================================================================
  // 9. ESTADO DE CAMBIOS EN EL PATRIMONIO
  // ==========================================================================
  static generateEquityChangesPDF(
    eq: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDoc(
      company,
      'ESTADO DE CAMBIOS EN EL PATRIMONIO NETO',
      `Al ${eq.asOfDate} - Normativa VEN-NIF y Código de Comercio Venezolano`,
      userName,
      'portrait'
    );

    let currentY = startY + 4;

    const tableRows = [
      ['Capital Social Suscrito y Pagado', `${formatMoneyVES(eq.capitalSocial || 0)}`],
      ['Reserva Legal Estatutaria (Art. 262 Código de Comercio)', `${formatMoneyVES(eq.reservaLegal || 0)}`],
      ['Utilidades No Distribuidas de Ejercicios Anteriores', `${formatMoneyVES(eq.utilidadesAcumuladas || 0)}`],
      ['Resultado Neto del Ejercicio en Curso', `${formatMoneyVES(eq.resultadoEjercicio || 0)}`],
      [
        { content: 'TOTAL PATRIMONIO NETO:', styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 245, 235], textColor: [40, 167, 69], fontSize: 8 } },
        { content: `${formatMoneyVES(eq.totalEquity || 0)}`, styles: { fontStyle: 'bold', font: 'courier', fillColor: [230, 245, 235], textColor: [40, 167, 69], fontSize: 8 } },
      ],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Componente del Patrimonio', 'Monto al Cierre (VES)']],
      body: tableRows as any,
      theme: 'grid',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2.2,
        lineColor: this.COLOR_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 48, halign: 'right', font: 'courier' },
      },
      margin: { left: 14, right: 14, bottom: 35 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    ReportsPdfEngine.drawSignatureBoxes(
      doc,
      finalY,
      [
        { title: 'CONTADOR PÚBLICO COLEGIADO', subtitle: 'CPC Lic. Responsable' },
        { title: 'REPRESENTANTE LEGAL', subtitle: company.legalName || 'Gerente General' },
      ],
      pageWidth
    );

    return this.finalizeDoc(doc);
  }

  // ==========================================================================
  // 10. NOTAS REVELATORIAS A LOS ESTADOS FINANCIEROS
  // ==========================================================================
  static generateFinancialNotesPDF(
    notesData: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth, pageHeight } = this.initDoc(
      company,
      'NOTAS REVELATORIAS A LOS ESTADOS FINANCIEROS',
      `Ejercicio Económico Terminado al ${notesData.asOfDate} - Normas VEN-NIF (FCCPV)`,
      userName,
      'portrait'
    );

    let currentY = startY + 6;
    const marginX = 14;
    const maxWidth = pageWidth - marginX * 2;

    const notes = notesData.notes || [];

    for (const note of notes) {
      // Verificar espacio en página
      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = 25;
      }

      // Título de la nota
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(this.COLOR_ACCENT[0], this.COLOR_ACCENT[1], this.COLOR_ACCENT[2]);
      doc.text(`NOTA ${note.number}. ${note.title.toUpperCase()}`, marginX, currentY);
      currentY += 4.5;

      // Contenido
      if (note.content) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
        const lines = doc.splitTextToSize(note.content, maxWidth);
        doc.text(lines, marginX, currentY);
        currentY += lines.length * 3.5 + 4;
      }

      // Subsecciones
      if (note.subsections && note.subsections.length > 0) {
        for (const sub of note.subsections) {
          if (currentY > pageHeight - 25) {
            doc.addPage();
            currentY = 25;
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(this.COLOR_HEADER[0], this.COLOR_HEADER[1], this.COLOR_HEADER[2]);
          doc.text(`• ${sub.subtitle}:`, marginX + 3, currentY);
          currentY += 3.5;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.2);
          doc.setTextColor(this.COLOR_MUTED[0], this.COLOR_MUTED[1], this.COLOR_MUTED[2]);
          const subLines = doc.splitTextToSize(sub.text, maxWidth - 6);
          doc.text(subLines, marginX + 6, currentY);
          currentY += subLines.length * 3.2 + 3;
        }
      }

      currentY += 3;
    }

    return this.finalizeDoc(doc);
  }
}
