import { jsPDF } from 'jspdf';
import autoTableImport from 'jspdf-autotable';

const autoTable = (typeof autoTableImport === 'function'
  ? autoTableImport
  : (autoTableImport as any).default || autoTableImport) as typeof autoTableImport;

export interface CompanyPdfInfo {
  legalName?: string;
  tradeName?: string;
  rif?: string;
  fiscalAddress?: string;
  address?: string;
  phone?: string;
  email?: string;
  isSpecialTaxpayer?: boolean;
}

export interface BasePdfOptions {
  title: string;
  subtitle?: string;
  periodText?: string;
  branchName?: string;
  userName: string;
  orientation: 'portrait' | 'landscape';
  auditId?: string;
}

export interface KpiCardItem {
  label: string;
  value: string;
  sub?: string;
}

/**
 * Motor central de generación de documentos PDF modernos y minimalistas
 */
export class ReportsPdfEngine {
  private static readonly COLOR_PRIMARY = [15, 23, 42] as [number, number, number]; // Slate-900
  private static readonly COLOR_HEADER = [30, 41, 59] as [number, number, number]; // Slate-800
  private static readonly COLOR_ACCENT = [2, 132, 199] as [number, number, number]; // Sky-600
  private static readonly COLOR_MUTED = [100, 116, 139] as [number, number, number]; // Slate-500
  private static readonly COLOR_BORDER = [226, 232, 240] as [number, number, number]; // Slate-200
  private static readonly COLOR_BG_LIGHT = [248, 250, 252] as [number, number, number]; // Slate-50
  private static readonly COLOR_TOTALS = [241, 245, 249] as [number, number, number]; // Slate-100

  /**
   * Inicializa el documento con el encabezado moderno y branding de la empresa
   */
  static initDocument(
    company: CompanyPdfInfo,
    options: BasePdfOptions
  ): { doc: jsPDF; startY: number; pageWidth: number; pageHeight: number } {
    const doc = new jsPDF({
      orientation: options.orientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;

    // 1. Franja superior delgada de acento Sky-600
    doc.setFillColor(this.COLOR_ACCENT[0], this.COLOR_ACCENT[1], this.COLOR_ACCENT[2]);
    doc.rect(0, 0, pageWidth, 2.8, 'F');

    // 2. Insignia / Logo corporativo moderno "ERO"
    doc.setFillColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
    doc.roundedRect(marginX, 7.5, 17, 11, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('ERO', marginX + 3.2, 15);
    // Punto azul cielo característico
    doc.setFillColor(14, 165, 233);
    doc.circle(marginX + 13.8, 11.2, 1.1, 'F');

    // 3. Razón Social y Datos Fiscales
    const displayName = (company.tradeName || company.legalName || 'ERO DISTRIBUCION C.A.').toUpperCase();
    doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(displayName, marginX + 21, 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(this.COLOR_MUTED[0], this.COLOR_MUTED[1], this.COLOR_MUTED[2]);
    const rifText = company.rif ? `RIF: ${company.rif}` : 'RIF: J-00000000-0';
    const contribText = company.isSpecialTaxpayer ? '  •  Contribuyente Especial SENIAT' : '';
    doc.text(`${rifText}${contribText}`, marginX + 21, 15.5);

    const addressText = company.fiscalAddress || 'Caracas, Venezuela';
    const phoneText = company.phone ? `  •  Tel: ${company.phone}` : '';
    const cleanAddress = addressText.length > 55 ? `${addressText.slice(0, 52)}...` : addressText;
    doc.text(`${cleanAddress}${phoneText}`, marginX + 21, 19);

    // 4. Bloque lateral derecho de metadatos (Fecha, Usuario, Auditoría)
    const rightColX = pageWidth - marginX;
    const nowStr = new Date().toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    doc.setFontSize(7);
    doc.setTextColor(this.COLOR_MUTED[0], this.COLOR_MUTED[1], this.COLOR_MUTED[2]);
    doc.text('FECHA DE IMPRESIÓN:', rightColX - 60, 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
    doc.text(nowStr, rightColX, 11.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(this.COLOR_MUTED[0], this.COLOR_MUTED[1], this.COLOR_MUTED[2]);
    doc.text('USUARIO EMISOR:', rightColX - 60, 15.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
    const cleanUser = options.userName.length > 25 ? `${options.userName.slice(0, 23)}...` : options.userName;
    doc.text(cleanUser, rightColX, 15.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(this.COLOR_MUTED[0], this.COLOR_MUTED[1], this.COLOR_MUTED[2]);
    doc.text('SUCURSAL / CONTROL:', rightColX - 60, 19);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(this.COLOR_ACCENT[0], this.COLOR_ACCENT[1], this.COLOR_ACCENT[2]);
    const branchLabel = options.branchName || 'Principal';
    const auditLabel = options.auditId ? ` • ${options.auditId}` : '';
    doc.text(`${branchLabel}${auditLabel}`, rightColX, 19, { align: 'right' });

    // 5. Línea divisoria elegante
    doc.setDrawColor(this.COLOR_BORDER[0], this.COLOR_BORDER[1], this.COLOR_BORDER[2]);
    doc.setLineWidth(0.35);
    doc.line(marginX, 22.5, pageWidth - marginX, 22.5);

    // 6. Título y Subtítulo del Reporte
    doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.text(options.title.toUpperCase(), marginX, 29);

    let startY = 32.5;
    if (options.subtitle || options.periodText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(this.COLOR_MUTED[0], this.COLOR_MUTED[1], this.COLOR_MUTED[2]);
      const fullSub = [options.subtitle, options.periodText].filter(Boolean).join('  •  ');
      doc.text(fullSub, marginX, startY);
      startY += 4.5;
    }

    return { doc, startY, pageWidth, pageHeight };
  }

  /**
   * Dibuja tarjetas KPI compactas y modernas antes de la tabla principal
   */
  static drawKpiCards(doc: jsPDF, startY: number, cards: KpiCardItem[], pageWidth: number): number {
    if (!cards || cards.length === 0) return startY;

    const marginX = 14;
    const availableWidth = pageWidth - marginX * 2;
    const gap = 3.5;
    const count = cards.length;
    const cardWidth = (availableWidth - gap * (count - 1)) / count;
    const cardHeight = 13.5;

    cards.forEach((card, idx) => {
      const x = marginX + idx * (cardWidth + gap);

      // Fondo tarjeta
      doc.setFillColor(this.COLOR_BG_LIGHT[0], this.COLOR_BG_LIGHT[1], this.COLOR_BG_LIGHT[2]);
      doc.setDrawColor(this.COLOR_BORDER[0], this.COLOR_BORDER[1], this.COLOR_BORDER[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, startY, cardWidth, cardHeight, 1.2, 1.2, 'FD');

      // Título tarjeta
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(this.COLOR_MUTED[0], this.COLOR_MUTED[1], this.COLOR_MUTED[2]);
      doc.text(card.label.toUpperCase(), x + 2.5, startY + 4.2);

      // Valor principal
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
      doc.text(card.value, x + 2.5, startY + 9.5);

      // Subtexto si existe
      if (card.sub) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(this.COLOR_ACCENT[0], this.COLOR_ACCENT[1], this.COLOR_ACCENT[2]);
        doc.text(card.sub, x + 2.5, startY + 12.2);
      }
    });

    return startY + cardHeight + 4.5;
  }

  /**
   * Finaliza el documento agregando la paginación y pie de página en cada hoja
   */
  static finalize(doc: jsPDF): Buffer {
    const pageCount = (doc as any).getNumberOfPages ? (doc as any).getNumberOfPages() : (doc.internal.pages.length - 1);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Línea divisoria de pie de página
      doc.setDrawColor(this.COLOR_BORDER[0], this.COLOR_BORDER[1], this.COLOR_BORDER[2]);
      doc.setLineWidth(0.3);
      doc.line(marginX, pageHeight - 9, pageWidth - marginX, pageHeight - 9);

      // Leyenda del sistema (Izquierda)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(this.COLOR_MUTED[0], this.COLOR_MUTED[1], this.COLOR_MUTED[2]);
      doc.text(
        'EroApp ERP  •  Sistema de Gestión Empresarial y Cumplimiento Fiscal  •  Documento Oficial Certificado',
        marginX,
        pageHeight - 5.5
      );

      // Paginación (Derecha)
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, pageHeight - 5.5, { align: 'right' });
    }

    return Buffer.from(doc.output('arraybuffer'));
  }

  // ==========================================
  // GENERADORES ESPECÍFICOS POR REPORTE
  // ==========================================

  /**
   * 1. REPORTE DE VENTAS (DETALLADO [HORIZONTAL] O RESUMIDO [VERTICAL])
   */
  static generateSalesReportPDF(
    data: any,
    company: CompanyPdfInfo,
    userName: string,
    options: {
      detailed: boolean;
      startDate?: string;
      endDate?: string;
      branchName?: string;
    }
  ): Buffer {
    const isDetailed = !!options.detailed;
    const orientation = isDetailed ? 'landscape' : 'portrait';
    const periodText = options.startDate && options.endDate ? `Período: ${options.startDate} al ${options.endDate}` : undefined;

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: isDetailed ? 'Reporte Consolidado de Ventas (Detallado)' : 'Reporte Consolidado de Ventas (Resumido)',
      subtitle: 'Auditoría Fiscal de Facturación y Medios de Pago',
      periodText,
      branchName: options.branchName,
      userName,
      orientation,
      auditId: `RPT-VTA-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    });

    // KPI Cards
    const cards: KpiCardItem[] = [
      {
        label: 'Total Facturado USD',
        value: this.fmtUSD(data.summary?.totalUSD),
        sub: 'Base gravable + Exento + IVA',
      },
      {
        label: 'Total Facturado VES',
        value: this.fmtVES(data.summary?.totalVES),
        sub: 'Al tipo de cambio oficial BCV',
      },
      {
        label: 'Facturas Emitidas',
        value: `${data.summary?.totalInvoices || data.invoices?.length || 0} facturas`,
        sub: `${data.summary?.exemptInvoices || 0} exentas`,
      },
      {
        label: 'Ticket Promedio USD',
        value: this.fmtUSD(data.summary?.averageTicketUSD),
        sub: 'Promedio por operación',
      },
    ];

    let currentY = this.drawKpiCards(doc, startY, cards, pageWidth);

    if (isDetailed) {
      // TABLA DETALLADA (HORIZONTAL - 14 COLUMNAS)
      const headers = [
        'Factura',
        'Control',
        'Fecha',
        'Cliente',
        'RIF / CI',
        'Caja',
        'Cajero',
        'Medios Pago',
        'Exento ($)',
        'Base ($)',
        'IVA ($)',
        'IGTF ($)',
        'Total ($)',
        'Total (Bs)',
      ];

      const rows = (data.invoices || []).map((inv: any) => [
        inv.invoice_number,
        inv.control_number || '-',
        inv.emission_date ? String(inv.emission_date).slice(0, 10) : '',
        (inv.customer_name || 'Consumidor Final').slice(0, 20),
        inv.customer_doc || 'V-00000000',
        inv.cash_register_code || inv.cash_register_name || '-',
        (inv.cashier_name || '').slice(0, 15),
        (inv.paymentMethodsSummary || '-').slice(0, 18),
        this.fmtUSD(inv.exemptUSD),
        this.fmtUSD(inv.taxableUSD),
        this.fmtUSD(inv.ivaUSD),
        this.fmtUSD(inv.igtfUSD),
        this.fmtUSD(inv.totalUSD),
        this.fmtVES(inv.totalVES),
      ]);

      const footRow = [
        { content: 'TOTALES CONSOLIDADOS:', colSpan: 8, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        this.fmtUSD(data.summary?.totalExemptUSD),
        this.fmtUSD(data.summary?.totalTaxableUSD),
        this.fmtUSD(data.summary?.totalIvaUSD),
        this.fmtUSD(data.summary?.totalIgtfUSD),
        this.fmtUSD(data.summary?.totalUSD),
        this.fmtVES(data.summary?.totalVES),
      ];

      autoTable(doc, {
        head: [headers],
        body: rows,
        foot: [footRow],
        startY: currentY,
        theme: 'striped',
        headStyles: {
          fillColor: this.COLOR_HEADER,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 6.8,
          halign: 'center',
          cellPadding: 1.8,
        },
        bodyStyles: {
          fontSize: 6.2,
          cellPadding: 1.4,
          textColor: this.COLOR_PRIMARY,
        },
        alternateRowStyles: {
          fillColor: this.COLOR_BG_LIGHT,
        },
        footStyles: {
          fillColor: this.COLOR_TOTALS,
          textColor: this.COLOR_PRIMARY,
          fontStyle: 'bold',
          fontSize: 6.5,
          cellPadding: 1.8,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 17 },
          1: { halign: 'center', cellWidth: 15 },
          2: { halign: 'center', cellWidth: 16 },
          3: { halign: 'left', cellWidth: 32 },
          4: { halign: 'center', cellWidth: 18 },
          5: { halign: 'center', cellWidth: 14 },
          6: { halign: 'left', cellWidth: 20 },
          7: { halign: 'left', cellWidth: 25 },
          8: { halign: 'right', cellWidth: 18 },
          9: { halign: 'right', cellWidth: 18 },
          10: { halign: 'right', cellWidth: 16 },
          11: { halign: 'right', cellWidth: 15 },
          12: { halign: 'right', cellWidth: 21, fontStyle: 'bold' },
          13: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });
    } else {
      // TABLA RESUMIDA (VERTICAL - RESUMEN DIARIO Y MEDIOS DE PAGO)
      const dailyHeaders = ['Fecha', 'Facturas', 'Exento ($)', 'Base Imponible ($)', 'IVA 16% ($)', 'IGTF 3% ($)', 'Total ($)', 'Total (Bs)'];
      const dailyRows = (data.dailySummary || []).map((d: any) => [
        d.date,
        this.fmtQty(d.invoicesCount),
        this.fmtUSD(d.exemptUSD),
        this.fmtUSD(d.taxableUSD),
        this.fmtUSD(d.ivaUSD),
        this.fmtUSD(d.igtfUSD),
        this.fmtUSD(d.totalUSD),
        this.fmtVES(d.totalVES),
      ]);

      const dailyFoot = [
        { content: 'TOTALES:', colSpan: 2, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        this.fmtUSD(data.summary?.totalExemptUSD),
        this.fmtUSD(data.summary?.totalTaxableUSD),
        this.fmtUSD(data.summary?.totalIvaUSD),
        this.fmtUSD(data.summary?.totalIgtfUSD),
        this.fmtUSD(data.summary?.totalUSD),
        this.fmtVES(data.summary?.totalVES),
      ];

      autoTable(doc, {
        head: [dailyHeaders],
        body: dailyRows,
        foot: [dailyFoot],
        startY: currentY,
        theme: 'striped',
        headStyles: {
          fillColor: this.COLOR_HEADER,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 7.2,
          halign: 'center',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 6.8,
          cellPadding: 1.6,
          textColor: this.COLOR_PRIMARY,
        },
        alternateRowStyles: {
          fillColor: this.COLOR_BG_LIGHT,
        },
        footStyles: {
          fillColor: this.COLOR_TOTALS,
          textColor: this.COLOR_PRIMARY,
          fontStyle: 'bold',
          fontSize: 7.2,
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 24 },
          1: { halign: 'center', cellWidth: 16 },
          2: { halign: 'right', cellWidth: 22 },
          3: { halign: 'right', cellWidth: 24 },
          4: { halign: 'right', cellWidth: 20 },
          5: { halign: 'right', cellWidth: 20 },
          6: { halign: 'right', cellWidth: 27, fontStyle: 'bold' },
          7: { halign: 'right', cellWidth: 29, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });

      // Segunda tabla: Desglose por Métodos de Pago
      const nextY = (doc as any).lastAutoTable.finalY + 7;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
      doc.text('DISTRIBUCIÓN POR MEDIOS DE PAGO', 14, nextY);

      const payHeaders = ['Método de Pago', 'Transacciones', 'Monto USD ($)', 'Monto VES (Bs)', '% Participación'];
      const payRows = (data.byPaymentMethod || []).map((pm: any) => [
        pm.method,
        this.fmtQty(pm.count),
        this.fmtUSD(pm.totalUSD),
        this.fmtVES(pm.totalVES),
        this.fmtPct(pm.percentage),
      ]);

      autoTable(doc, {
        head: [payHeaders],
        body: payRows,
        startY: nextY + 3,
        theme: 'striped',
        headStyles: {
          fillColor: this.COLOR_HEADER,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 7.2,
          halign: 'center',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 6.8,
          cellPadding: 1.6,
          textColor: this.COLOR_PRIMARY,
        },
        alternateRowStyles: {
          fillColor: this.COLOR_BG_LIGHT,
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 50 },
          1: { halign: 'center', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 34 },
          3: { halign: 'right', cellWidth: 38 },
          4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });
    }

    return this.finalize(doc);
  }

  /**
   * 2. REPORTE DE CIERRES DE TURNO DE CAJA (ARQUEO X Y Z)
   */
  static generateCashShiftsReportPDF(
    data: any,
    company: CompanyPdfInfo,
    userName: string,
    options: {
      detailed: boolean;
      startDate?: string;
      endDate?: string;
      branchName?: string;
    }
  ): Buffer {
    const isDetailed = !!options.detailed;
    const orientation = isDetailed ? 'landscape' : 'portrait';
    const periodText = options.startDate && options.endDate ? `Período: ${options.startDate} al ${options.endDate}` : undefined;

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: isDetailed ? 'Reporte de Arqueos y Cierres de Turno (Detallado)' : 'Reporte de Cierres de Turno (Resumido)',
      subtitle: 'Control de Efectivo, Lotes POS, Pago Móvil y Depósitos Bancarios',
      periodText,
      branchName: options.branchName,
      userName,
      orientation,
      auditId: `RPT-CRRE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    });

    // KPI Cards
    const cards: KpiCardItem[] = [
      {
        label: 'Total Recaudado VES',
        value: this.fmtVES(data.summary?.totalCollectedVES),
        sub: 'Total ingresos del período',
      },
      {
        label: 'Total Lotes POS',
        value: this.fmtVES(data.summary?.totalPosBatchVES),
        sub: 'Puntos de venta procesados',
      },
      {
        label: 'Total Pago Móvil',
        value: this.fmtVES(data.summary?.totalPagomovilVES),
        sub: 'Transferencias confirmadas',
      },
      {
        label: 'Depósitos Bancarios',
        value: this.fmtVES(data.summary?.totalDepositedVES),
        sub: 'Entregado / depositado en bancos',
      },
    ];

    let currentY = this.drawKpiCards(doc, startY, cards, pageWidth);

    if (isDetailed) {
      // TABLA DETALLADA (HORIZONTAL - 14 COLUMNAS)
      const headers = [
        'ID Turno',
        'Caja',
        'Cajero',
        'Apertura',
        'Cierre',
        'Estado',
        'Lote POS (Bs)',
        'Pago Móvil (Bs)',
        'Efec. Esp. (Bs)',
        'Efec. Cont. (Bs)',
        'Dif. (Bs)',
        'Dif. ($)',
        'Total Recaudado (Bs)',
        'Depósito Banco (Bs)',
      ];

      const rows = (data.shifts || []).map((s: any) => [
        s.id.slice(0, 8),
        `${s.cashRegisterCode}`,
        (s.cashierName || '').slice(0, 16),
        s.openedAt ? String(s.openedAt).slice(0, 16) : '-',
        s.closedAt ? String(s.closedAt).slice(0, 16) : 'EN CURSO',
        s.auditStatus || s.status,
        this.fmtVES(s.revenue?.posBatchVES),
        this.fmtVES(s.revenue?.pagomovilVES),
        this.fmtVES(s.finalCashVESExpected),
        this.fmtVES(s.finalCashVESCounted),
        this.fmtVES(s.differenceVES),
        this.fmtUSD(s.differenceUSD),
        this.fmtVES(s.revenue?.totalCollectedVES),
        this.fmtVES(s.depositAmountVES),
      ]);

      const footRow = [
        { content: 'TOTALES GENERALES:', colSpan: 6, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        this.fmtVES(data.summary?.totalPosBatchVES),
        this.fmtVES(data.summary?.totalPagomovilVES),
        '-',
        '-',
        this.fmtVES(data.summary?.totalDifferenceVES),
        this.fmtUSD(data.summary?.totalDifferenceUSD),
        this.fmtVES(data.summary?.totalCollectedVES),
        this.fmtVES(data.summary?.totalDepositedVES),
      ];

      autoTable(doc, {
        head: [headers],
        body: rows,
        foot: [footRow],
        startY: currentY,
        theme: 'striped',
        headStyles: {
          fillColor: this.COLOR_HEADER,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 6.8,
          halign: 'center',
          cellPadding: 1.8,
        },
        bodyStyles: {
          fontSize: 6.2,
          cellPadding: 1.4,
          textColor: this.COLOR_PRIMARY,
        },
        alternateRowStyles: {
          fillColor: this.COLOR_BG_LIGHT,
        },
        footStyles: {
          fillColor: this.COLOR_TOTALS,
          textColor: this.COLOR_PRIMARY,
          fontStyle: 'bold',
          fontSize: 6.5,
          cellPadding: 1.8,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          1: { halign: 'center', cellWidth: 13 },
          2: { halign: 'left', cellWidth: 22 },
          3: { halign: 'center', cellWidth: 19 },
          4: { halign: 'center', cellWidth: 19 },
          5: { halign: 'center', cellWidth: 16 },
          6: { halign: 'right', cellWidth: 21 },
          7: { halign: 'right', cellWidth: 21 },
          8: { halign: 'right', cellWidth: 20 },
          9: { halign: 'right', cellWidth: 20 },
          10: { halign: 'right', cellWidth: 17 },
          11: { halign: 'right', cellWidth: 15 },
          12: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
          13: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });
    } else {
      // TABLA RESUMIDA (VERTICAL)
      const headers = ['Caja', 'Cajero', 'Turnos', 'Lote POS (Bs)', 'Pago Móvil (Bs)', 'Efec. Contado (Bs)', 'Recaudado (Bs)'];
      const cashierMap = new Map<string, any>();

      (data.shifts || []).forEach((s: any) => {
        const key = `${s.cashRegisterCode}_${s.cashierName}`;
        if (!cashierMap.has(key)) {
          cashierMap.set(key, {
            box: s.cashRegisterCode,
            cashier: s.cashierName,
            count: 0,
            pos: 0,
            pagomovil: 0,
            cash: 0,
            total: 0,
          });
        }
        const item = cashierMap.get(key);
        item.count += 1;
        item.pos += Number(s.revenue?.posBatchVES || 0);
        item.pagomovil += Number(s.revenue?.pagomovilVES || 0);
        item.cash += Number(s.finalCashVESCounted || 0);
        item.total += Number(s.revenue?.totalCollectedVES || 0);
      });

      const rows = Array.from(cashierMap.values()).map((c) => [
        c.box,
        c.cashier,
        this.fmtQty(c.count),
        this.fmtVES(c.pos),
        this.fmtVES(c.pagomovil),
        this.fmtVES(c.cash),
        this.fmtVES(c.total),
      ]);

      const footRow = [
        { content: 'TOTALES:', colSpan: 2, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        this.fmtQty(data.shifts?.length),
        this.fmtVES(data.summary?.totalPosBatchVES),
        this.fmtVES(data.summary?.totalPagomovilVES),
        '-',
        this.fmtVES(data.summary?.totalCollectedVES),
      ];

      autoTable(doc, {
        head: [headers],
        body: rows,
        foot: [footRow],
        startY: currentY,
        theme: 'striped',
        headStyles: {
          fillColor: this.COLOR_HEADER,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 7.2,
          halign: 'center',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 6.8,
          cellPadding: 1.6,
          textColor: this.COLOR_PRIMARY,
        },
        alternateRowStyles: {
          fillColor: this.COLOR_BG_LIGHT,
        },
        footStyles: {
          fillColor: this.COLOR_TOTALS,
          textColor: this.COLOR_PRIMARY,
          fontStyle: 'bold',
          fontSize: 7.2,
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'left', cellWidth: 42 },
          2: { halign: 'center', cellWidth: 18 },
          3: { halign: 'right', cellWidth: 26 },
          4: { halign: 'right', cellWidth: 26 },
          5: { halign: 'right', cellWidth: 26 },
          6: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });
    }

    return this.finalize(doc);
  }

  /**
   * 3. REPORTE DE VENTAS POR PRODUCTO (PORTRAIT / VERTICAL)
   */
  static generateSalesByProductReportPDF(
    data: any[],
    company: CompanyPdfInfo,
    userName: string,
    options: {
      startDate?: string;
      endDate?: string;
      branchName?: string;
    }
  ): Buffer {
    const periodText = options.startDate && options.endDate ? `Período: ${options.startDate} al ${options.endDate}` : undefined;

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'Reporte de Ventas por Producto (Ranking)',
      subtitle: 'Volumen de Rotación, Unidades Vendidas y Facturación',
      periodText,
      branchName: options.branchName,
      userName,
      orientation: 'portrait',
      auditId: `RPT-PROD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    });

    const totalQty = data.reduce((acc, p) => acc + Number(p.totalQtySold || 0), 0);
    const totalUSD = data.reduce((acc, p) => acc + Number(p.totalSalesUSD || 0), 0);
    const totalVES = data.reduce((acc, p) => acc + Number(p.totalSalesVES || 0), 0);
    const totalSubUSD = data.reduce((acc, p) => acc + Number(p.subtotalUSD || 0), 0);
    const totalTaxUSD = data.reduce((acc, p) => acc + Number(p.taxUSD || 0), 0);

    // KPI Cards
    const cards: KpiCardItem[] = [
      {
        label: 'Unidades Vendidas',
        value: this.fmtQty(totalQty),
        sub: 'Total artículos despachados',
      },
      {
        label: 'Productos con Movimiento',
        value: `${data.length} ítems`,
        sub: 'En el período evaluado',
      },
      {
        label: 'Facturación Total USD',
        value: this.fmtUSD(totalUSD),
        sub: 'Ingresos netos por productos',
      },
      {
        label: 'Facturación Total VES',
        value: this.fmtVES(totalVES),
        sub: 'Equivalente en moneda nacional',
      },
    ];

    const currentY = this.drawKpiCards(doc, startY, cards, pageWidth);

    const headers = ['#', 'SKU', 'Producto', 'Departamento', 'Cant.', 'Subtotal ($)', 'IVA ($)', 'Total ($)', 'Total (Bs)'];

    const rows = data.map((p, idx) => [
      String(idx + 1),
      p.sku || '-',
      (p.productName || '').slice(0, 32),
      (p.departmentName || 'Sin Dpto').slice(0, 18),
      this.fmtQty(p.totalQtySold),
      this.fmtUSD(p.subtotalUSD),
      this.fmtUSD(p.taxUSD),
      this.fmtUSD(p.totalSalesUSD),
      this.fmtVES(p.totalSalesVES),
    ]);

    const footRow = [
      { content: 'TOTALES:', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      this.fmtQty(totalQty),
      this.fmtUSD(totalSubUSD),
      this.fmtUSD(totalTaxUSD),
      this.fmtUSD(totalUSD),
      this.fmtVES(totalVES),
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 6.5,
        cellPadding: 1.5,
        textColor: this.COLOR_PRIMARY,
      },
      alternateRowStyles: {
        fillColor: this.COLOR_BG_LIGHT,
      },
      footStyles: {
        fillColor: this.COLOR_TOTALS,
        textColor: this.COLOR_PRIMARY,
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 2,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 18 },
        2: { halign: 'left', cellWidth: 44 },
        3: { halign: 'left', cellWidth: 22 },
        4: { halign: 'right', cellWidth: 14 },
        5: { halign: 'right', cellWidth: 18 },
        6: { halign: 'right', cellWidth: 16 },
        7: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
        8: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    return this.finalize(doc);
  }

  /**
   * 4. REPORTE DE VENTAS POR CAJERO (PORTRAIT / VERTICAL)
   */
  static generateSalesByCashierReportPDF(
    data: any[],
    company: CompanyPdfInfo,
    userName: string,
    options: {
      startDate?: string;
      endDate?: string;
      branchName?: string;
    }
  ): Buffer {
    const periodText = options.startDate && options.endDate ? `Período: ${options.startDate} al ${options.endDate}` : undefined;

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'Reporte de Desempeño por Cajero',
      subtitle: 'Productividad, Facturas Emitidas y Ticket Promedio',
      periodText,
      branchName: options.branchName,
      userName,
      orientation: 'portrait',
      auditId: `RPT-CAJ-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    });

    const totalInvoices = data.reduce((acc, c) => acc + Number(c.invoicesCount || 0), 0);
    const totalUSD = data.reduce((acc, c) => acc + Number(c.totalSalesUSD || 0), 0);
    const totalVES = data.reduce((acc, c) => acc + Number(c.totalSalesVES || 0), 0);
    const avgTicket = totalInvoices > 0 ? totalUSD / totalInvoices : 0;
    const topPerformer = data[0]?.cashierName || 'N/A';

    // KPI Cards
    const cards: KpiCardItem[] = [
      {
        label: 'Cajero Líder',
        value: topPerformer.length > 18 ? `${topPerformer.slice(0, 16)}...` : topPerformer,
        sub: 'Mayor facturación acumulada',
      },
      {
        label: 'Facturas Emitidas',
        value: this.fmtQty(totalInvoices),
        sub: 'Total comprobantes del equipo',
      },
      {
        label: 'Total Facturado USD',
        value: this.fmtUSD(totalUSD),
        sub: 'Ingresos consolidados',
      },
      {
        label: 'Ticket Promedio General',
        value: this.fmtUSD(avgTicket),
        sub: 'Promedio global por factura',
      },
    ];

    const currentY = this.drawKpiCards(doc, startY, cards, pageWidth);

    const headers = ['#', 'Cajero / Operador', 'Sucursal', 'N° Facturas', 'Ticket Prom. ($)', 'Total Ventas ($)', 'Total Ventas (Bs)', '% Part.'];

    const rows = data.map((c, idx) => {
      const share = totalUSD > 0 ? (Number(c.totalSalesUSD || 0) / totalUSD) * 100 : 0;
      return [
        String(idx + 1),
        c.cashierName || '-',
        c.branchName || 'Principal',
        this.fmtQty(c.invoicesCount),
        this.fmtUSD(c.averageTicketUSD),
        this.fmtUSD(c.totalSalesUSD),
        this.fmtVES(c.totalSalesVES),
        this.fmtPct(share),
      ];
    });

    const footRow = [
      { content: 'TOTALES:', colSpan: 3, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      this.fmtQty(totalInvoices),
      this.fmtUSD(avgTicket),
      this.fmtUSD(totalUSD),
      this.fmtVES(totalVES),
      '100.0%',
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7.2,
        halign: 'center',
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 6.8,
        cellPadding: 1.6,
        textColor: this.COLOR_PRIMARY,
      },
      alternateRowStyles: {
        fillColor: this.COLOR_BG_LIGHT,
      },
      footStyles: {
        fillColor: this.COLOR_TOTALS,
        textColor: this.COLOR_PRIMARY,
        fontStyle: 'bold',
        fontSize: 7.2,
        cellPadding: 2,
      },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'left' },
        2: { halign: 'left' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'right', fontStyle: 'bold' },
        7: { halign: 'right' },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    return this.finalize(doc);
  }

  /**
   * 5. LIBRO DE VENTAS FISCAL SENIAT (HORIZONTAL / LANDSCAPE)
   */
  static generateSalesBookReportPDF(
    data: any[],
    company: CompanyPdfInfo,
    userName: string,
    options: {
      period?: string;
    }
  ): Buffer {
    const periodText = options.period ? `Período Fiscal: ${options.period}` : 'Período Fiscal Vigente';

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'Libro de Ventas Fiscal (SENIAT)',
      subtitle: 'Régimen de Impuesto al Valor Agregado (IVA) y Retenciones',
      periodText,
      userName,
      orientation: 'landscape',
      auditId: `SENIAT-LIB-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    });

    const totalVentas = data.reduce((acc, r) => acc + Number(r.total_with_tax || 0), 0);
    const totalExento = data.reduce((acc, r) => acc + Number(r.exempt_sales || 0), 0);
    const totalBase = data.reduce((acc, r) => acc + Number(r.taxable_base || 0), 0);
    const totalIVA = data.reduce((acc, r) => acc + Number(r.tax_amount || 0), 0);
    const totalIGTF = data.reduce((acc, r) => acc + Number(r.igtf_amount || 0), 0);
    const totalRetencion = data.reduce((acc, r) => acc + Number(r.iva_withheld || 0), 0);

    // KPI Cards
    const cards: KpiCardItem[] = [
      {
        label: 'Total Ventas Incl. IVA (Bs)',
        value: this.fmtVES(totalVentas),
        sub: 'Total facturado en el período',
      },
      {
        label: 'Base Imponible (Bs)',
        value: this.fmtVES(totalBase),
        sub: 'Gravada con alícuota general',
      },
      {
        label: 'Débito Fiscal IVA 16% (Bs)',
        value: this.fmtVES(totalIVA),
        sub: 'Impuesto liquidado a enterar',
      },
      {
        label: 'Retenciones IVA / IGTF (Bs)',
        value: this.fmtVES(totalRetencion + totalIGTF),
        sub: `Ret. IVA: ${this.fmtVES(totalRetencion)}`,
      },
    ];

    const currentY = this.drawKpiCards(doc, startY, cards, pageWidth);

    const headers = [
      'Oper N°',
      'Fecha',
      'RIF / CI',
      'Razón Social / Nombre',
      'N° Factura',
      'N° Control',
      'Doc. Afectado',
      'Total Ventas (Bs)',
      'Ventas Exentas (Bs)',
      'Base Imponible (Bs)',
      '% Alic.',
      'Impuesto IVA (Bs)',
      'IGTF 3% (Bs)',
      'Ret. IVA (Bs)',
    ];

    const rows = data.map((r, idx) => [
      String(r.row_num || idx + 1),
      r.emission_date ? String(r.emission_date).slice(0, 10) : '',
      r.customer_doc || 'V-00000000',
      (r.customer_name || 'CONSUMIDOR FINAL').slice(0, 24),
      r.invoice_number || '-',
      r.control_number || '-',
      r.affected_invoice_number || '-',
      this.fmtVES(r.total_with_tax),
      this.fmtVES(r.exempt_sales),
      this.fmtVES(r.taxable_base),
      r.tax_rate ? `${Number(r.tax_rate).toFixed(0)}%` : '16%',
      this.fmtVES(r.tax_amount),
      this.fmtVES(r.igtf_amount),
      this.fmtVES(r.iva_withheld),
    ]);

    const footRow = [
      { content: 'TOTALES LIBRO DE VENTAS:', colSpan: 7, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      this.fmtVES(totalVentas),
      this.fmtVES(totalExento),
      this.fmtVES(totalBase),
      '16%',
      this.fmtVES(totalIVA),
      this.fmtVES(totalIGTF),
      this.fmtVES(totalRetencion),
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 6.5,
        halign: 'center',
        cellPadding: 1.8,
      },
      bodyStyles: {
        fontSize: 6.1,
        cellPadding: 1.4,
        textColor: this.COLOR_PRIMARY,
      },
      alternateRowStyles: {
        fillColor: this.COLOR_BG_LIGHT,
      },
      footStyles: {
        fillColor: this.COLOR_TOTALS,
        textColor: this.COLOR_PRIMARY,
        fontStyle: 'bold',
        fontSize: 6.4,
        cellPadding: 1.8,
      },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'left' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'right', fontStyle: 'bold' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'center' },
        11: { halign: 'right', fontStyle: 'bold' },
        12: { halign: 'right' },
        13: { halign: 'right' },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    return this.finalize(doc);
  }

  /**
   * 6. REPORTE DE INVENTARIO Y JERARQUÍA (LANDSCAPE)
   */
  static generateInventoryHierarchyReportPDF(
    data: any[],
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'Reporte de Inventario por Jerarquía y Ubicación Física',
      subtitle: 'Estructura por Departamentos, Grupos, Stock y Valoración',
      userName,
      orientation: 'landscape',
      auditId: `RPT-INV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    });

    const totalStock = data.reduce((acc, p) => acc + Number(p.stock || p.current_stock || 0), 0);
    const totalValuation = data.reduce((acc, p) => acc + Number(p.stock || 0) * Number(p.sale_price_usd || 0), 0);

    const cards: KpiCardItem[] = [
      {
        label: 'Total Productos Catalogados',
        value: `${data.length} ítems`,
        sub: 'En el maestro de productos',
      },
      {
        label: 'Existencia Total Unidades',
        value: this.fmtQty(totalStock),
        sub: 'Stock físico consolidado',
      },
      {
        label: 'Valoración Estimada USD',
        value: this.fmtUSD(totalValuation),
        sub: 'A precio de venta lista',
      },
    ];

    const currentY = this.drawKpiCards(doc, startY, cards, pageWidth);

    const headers = ['SKU', 'Producto', 'Departamento', 'Grupo / Familia', 'Ubicación Física', 'Stock', 'Precio ($)', 'Valoración ($)'];

    const rows = data.map((p) => {
      const stock = Number(p.stock || p.current_stock || 0);
      const price = Number(p.sale_price_usd || 0);
      return [
        p.sku || '-',
        (p.product_name || p.name || '').slice(0, 36),
        p.department_name || 'Sin Dpto',
        p.group_name || 'Sin Grupo',
        p.physical_location || p.location || 'General',
        this.fmtQty(stock),
        this.fmtUSD(price),
        this.fmtUSD(stock * price),
      ];
    });

    const footRow = [
      { content: 'TOTALES:', colSpan: 5, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      this.fmtQty(totalStock),
      '-',
      this.fmtUSD(totalValuation),
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 6.5,
        cellPadding: 1.6,
        textColor: this.COLOR_PRIMARY,
      },
      alternateRowStyles: {
        fillColor: this.COLOR_BG_LIGHT,
      },
      footStyles: {
        fillColor: this.COLOR_TOTALS,
        textColor: this.COLOR_PRIMARY,
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 2,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 24 },
        1: { halign: 'left', cellWidth: 60 },
        2: { halign: 'left', cellWidth: 35 },
        3: { halign: 'left', cellWidth: 35 },
        4: { halign: 'center', cellWidth: 30 },
        5: { halign: 'right', cellWidth: 22 },
        6: { halign: 'right', cellWidth: 25 },
        7: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    return this.finalize(doc);
  }

  // ==========================================
  // HELPERS DE DISEÑO PARA COMPROBANTES
  // ==========================================

  /**
   * Dibuja cajas de firmas oficiales con líneas y cargos
   */
  static drawSignatureBoxes(
    doc: jsPDF,
    startY: number,
    signatures: { title: string; subtitle?: string }[],
    pageWidth: number
  ): number {
    const marginX = 14;
    const count = signatures.length;
    const gap = 12;
    const availableWidth = pageWidth - marginX * 2;
    const boxWidth = (availableWidth - gap * (count - 1)) / count;
    const boxHeight = 20;

    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = startY;
    if (currentY + boxHeight + 16 > pageHeight) {
      doc.addPage();
      currentY = 25;
    }

    signatures.forEach((sig, idx) => {
      const x = marginX + idx * (boxWidth + gap);
      doc.setDrawColor(this.COLOR_MUTED[0], this.COLOR_MUTED[1], this.COLOR_MUTED[2]);
      doc.setLineWidth(0.35);
      doc.line(x + 6, currentY + 12, x + boxWidth - 6, currentY + 12);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
      doc.text(sig.title, x + boxWidth / 2, currentY + 15.8, { align: 'center' });

      if (sig.subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(this.COLOR_MUTED[0], this.COLOR_MUTED[1], this.COLOR_MUTED[2]);
        doc.text(sig.subtitle, x + boxWidth / 2, currentY + 19, { align: 'center' });
      }
    });

    return currentY + boxHeight + 4;
  }

  /**
   * Dibuja tarjetas de información de dos columnas para comprobantes
   */
  static drawTwoColumnInfoCards(
    doc: jsPDF,
    startY: number,
    cardLeft: { title: string; lines: string[] },
    cardRight: { title: string; lines: string[] },
    pageWidth: number
  ): number {
    const marginX = 14;
    const gap = 4;
    const availableWidth = pageWidth - marginX * 2;
    const cardWidth = (availableWidth - gap) / 2;
    const maxLines = Math.max(cardLeft.lines.length, cardRight.lines.length);
    const cardHeight = 7.5 + maxLines * 4.2;

    [
      { card: cardLeft, x: marginX },
      { card: cardRight, x: marginX + cardWidth + gap },
    ].forEach(({ card, x }) => {
      // Fondo tarjeta
      doc.setFillColor(this.COLOR_BG_LIGHT[0], this.COLOR_BG_LIGHT[1], this.COLOR_BG_LIGHT[2]);
      doc.setDrawColor(this.COLOR_BORDER[0], this.COLOR_BORDER[1], this.COLOR_BORDER[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, startY, cardWidth, cardHeight, 1.2, 1.2, 'FD');

      // Título de la tarjeta
      doc.setFillColor(this.COLOR_HEADER[0], this.COLOR_HEADER[1], this.COLOR_HEADER[2]);
      doc.roundedRect(x, startY, cardWidth, 5.5, 1.2, 1.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(255, 255, 255);
      doc.text(card.title.toUpperCase(), x + 3, startY + 3.8);

      // Líneas de contenido
      let lineY = startY + 9;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
      card.lines.forEach((line) => {
        doc.text(line, x + 3, lineY);
        lineY += 4.2;
      });
    });

    return startY + cardHeight + 4;
  }

  // ==========================================
  // GENERADORES DE COMPROBANTES Y REPORTES (1 A 15)
  // ==========================================

  /**
   * 7. COMPROBANTE OFICIAL DE RETENCIÓN SENIAT (IVA O ISLR)
   */
  static generateWithholdingVoucherPDF(
    voucher: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const isIVA = voucher.type === 'IVA';
    const orientation = 'portrait';

    const title = isIVA
      ? 'COMPROBANTE DE RETENCIÓN DEL IMPUESTO AL VALOR AGREGADO (IVA)'
      : 'COMPROBANTE DE RETENCIÓN DE IMPUESTO SOBRE LA RENTA (ISLR)';

    const subtitle = isIVA
      ? 'Ley de IVA • Providencia Administrativa SENIAT SNAT/2015/0049 (Art. 16)'
      : 'Reglamento de la Ley de ISLR en materia de Retenciones (Decreto N° 1808)';

    const periodText = `N° Comprobante: ${voucher.voucherNumber}  •  Período Fiscal: ${voucher.taxPeriod || '-'}`;

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title,
      subtitle,
      periodText,
      userName,
      orientation,
      auditId: `SENIAT-RET-${voucher.voucherNumber || Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    });

    // Tarjeta Agente de Retención vs Sujeto Retenido
    const agentLines = [
      `Nombre / Razón Social: ${(company.legalName || company.tradeName || 'EMPRESA').toUpperCase()}`,
      `Registro de Información Fiscal (RIF): ${company.rif || 'J-00000000-0'}`,
      `Dirección Fiscal: ${company.fiscalAddress || 'Caracas, Venezuela'}`,
      `Condición: ${company.isSpecialTaxpayer ? 'Contribuyente Especial Designado' : 'Ordinario'}`,
    ];

    const subjectLines = [
      `Nombre / Razón Social: ${(voucher.supplierName || 'PROVEEDOR').toUpperCase()}`,
      `Registro de Información Fiscal (RIF): ${voucher.supplierRif || 'J-00000000-0'}`,
      `Fecha de Emisión del Comprobante: ${voucher.createdAt ? String(voucher.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)}`,
      `Estado del Comprobante: ${voucher.status || 'EMITTED'}`,
    ];

    let currentY = this.drawTwoColumnInfoCards(
      doc,
      startY,
      { title: 'DATOS DEL AGENTE DE RETENCIÓN (COMPRADOR)', lines: agentLines },
      { title: 'DATOS DEL SUJETO RETENIDO (PROVEEDOR)', lines: subjectLines },
      pageWidth
    );

    if (isIVA) {
      const headers = [
        'Oper',
        'Fecha Fact.',
        'N° Factura',
        'N° Control',
        'Total Factura (Bs)',
        'Exento (Bs)',
        'Base Imponible (Bs)',
        '% IVA',
        'Impuesto (Bs)',
        '% Ret.',
        'IVA Retenido (Bs)',
      ];

      const rows = [
        [
          '01',
          voucher.invoiceDate ? String(voucher.invoiceDate).slice(0, 10) : '-',
          voucher.invoiceNumber || '-',
          voucher.controlNumber || '-',
          this.fmtVES(voucher.totalInvoiceAmount),
          this.fmtVES(voucher.exemptAmount),
          this.fmtVES(voucher.taxableBaseAmount),
          `${Number(voucher.taxRate || 16).toFixed(0)}%`,
          this.fmtVES(voucher.ivaAmount),
          `${Number(voucher.retainedPercentage || 75).toFixed(0)}%`,
          this.fmtVES(voucher.retainedAmount),
        ],
      ];

      const footRow = [
        { content: 'TOTALES A ENTERAR AL SENIAT:', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        this.fmtVES(voucher.totalInvoiceAmount),
        this.fmtVES(voucher.exemptAmount),
        this.fmtVES(voucher.taxableBaseAmount),
        '-',
        this.fmtVES(voucher.ivaAmount),
        '-',
        this.fmtVES(voucher.retainedAmount),
      ];

      autoTable(doc, {
        head: [headers],
        body: rows,
        foot: [footRow],
        startY: currentY,
        theme: 'striped',
        headStyles: {
          fillColor: this.COLOR_HEADER,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 6.8,
          halign: 'center',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 6.5,
          cellPadding: 1.6,
          textColor: this.COLOR_PRIMARY,
        },
        footStyles: {
          fillColor: this.COLOR_TOTALS,
          textColor: this.COLOR_PRIMARY,
          fontStyle: 'bold',
          fontSize: 6.8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: 'center' },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'center' },
          8: { halign: 'right' },
          9: { halign: 'center' },
          10: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });
    } else {
      // ISLR
      const headers = [
        'Oper',
        'Fecha Fact.',
        'N° Factura',
        'N° Control',
        'Concepto / Código',
        'Total Factura (Bs)',
        'Base Imponible (Bs)',
        '% Tarifa',
        'Sustraendo (Bs)',
        'ISLR Retenido (Bs)',
      ];

      const conceptText = voucher.conceptDescription
        ? `${voucher.conceptCode || ''} - ${voucher.conceptDescription}`.slice(0, 28)
        : voucher.conceptCode || 'Servicios Profesionales';

      const rows = [
        [
          '01',
          voucher.invoiceDate ? String(voucher.invoiceDate).slice(0, 10) : '-',
          voucher.invoiceNumber || '-',
          voucher.controlNumber || '-',
          conceptText,
          this.fmtVES(voucher.totalInvoiceAmount),
          this.fmtVES(voucher.taxableBaseAmount),
          `${Number(voucher.ratePercentage || 0).toFixed(1)}%`,
          this.fmtVES(voucher.subtractingFactor || 0),
          this.fmtVES(voucher.islrRetainedAmount || voucher.retainedAmount),
        ],
      ];

      const footRow = [
        { content: 'TOTAL RETENCIÓN ISLR:', colSpan: 5, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        this.fmtVES(voucher.totalInvoiceAmount),
        this.fmtVES(voucher.taxableBaseAmount),
        '-',
        '-',
        this.fmtVES(voucher.islrRetainedAmount || voucher.retainedAmount),
      ];

      autoTable(doc, {
        head: [headers],
        body: rows,
        foot: [footRow],
        startY: currentY,
        theme: 'striped',
        headStyles: {
          fillColor: this.COLOR_HEADER,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 6.8,
          halign: 'center',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 6.5,
          cellPadding: 1.6,
          textColor: this.COLOR_PRIMARY,
        },
        footStyles: {
          fillColor: this.COLOR_TOTALS,
          textColor: this.COLOR_PRIMARY,
          fontStyle: 'bold',
          fontSize: 6.8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: 'center' },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'left' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'center' },
          8: { halign: 'right' },
          9: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });
    }

    const nextY = (doc as any).lastAutoTable.finalY + 12;

    this.drawSignatureBoxes(
      doc,
      nextY,
      [
        { title: 'AGENTE DE RETENCIÓN', subtitle: 'Firma y Sello Oficial' },
        { title: 'SUJETO RETENIDO (PROVEEDOR)', subtitle: 'Recibido Conforme (Nombre, C.I., Firma)' },
      ],
      pageWidth
    );

    return this.finalize(doc);
  }

  /**
   * 8. LIBRO DE COMPRAS FISCAL SENIAT (HORIZONTAL / LANDSCAPE)
   */
  static generatePurchasesBookReportPDF(
    data: any,
    company: CompanyPdfInfo,
    userName: string,
    options: {
      period?: string;
    }
  ): Buffer {
    const periodText = options.period ? `Período Fiscal: ${options.period}` : 'Período Fiscal Vigente';

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'Libro de Compras Fiscal (SENIAT)',
      subtitle: 'Régimen de Impuesto al Valor Agregado (IVA) y Crédito Fiscal Comprobado',
      periodText,
      userName,
      orientation: 'landscape',
      auditId: `SENIAT-COM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    });

    const items = data.items || data || [];
    const totals = data.totals || {
      totalPurchases: items.reduce((acc: number, r: any) => acc + Number(r.totalAmount || r.total_amount || 0), 0),
      totalExempt: items.reduce((acc: number, r: any) => acc + Number(r.baseExemptAmount || r.base_exempt_amount || 0), 0),
      totalTaxable: items.reduce((acc: number, r: any) => acc + Number(r.baseTaxableAmount || r.base_taxable_amount || 0), 0),
      totalTax: items.reduce((acc: number, r: any) => acc + Number(r.taxAmount || r.tax_amount || 0), 0),
      totalIvaRetained: items.reduce((acc: number, r: any) => acc + Number(r.ivaRetainedAmount || r.iva_retained_amount || 0), 0),
    };

    const cards: KpiCardItem[] = [
      {
        label: 'Total Compras Incl. IVA (Bs)',
        value: this.fmtVES(totals.totalPurchases),
        sub: 'Total facturado por proveedores',
      },
      {
        label: 'Base Imponible Gravada (Bs)',
        value: this.fmtVES(totals.totalTaxable),
        sub: 'Compras con derecho a crédito',
      },
      {
        label: 'Crédito Fiscal IVA 16% (Bs)',
        value: this.fmtVES(totals.totalTax),
        sub: 'Deducible del débito fiscal',
      },
      {
        label: 'Retenciones IVA Efectuadas (Bs)',
        value: this.fmtVES(totals.totalIvaRetained),
        sub: 'Retenido como agente SENIAT',
      },
    ];

    const currentY = this.drawKpiCards(doc, startY, cards, pageWidth);

    const headers = [
      'Oper',
      'Fecha',
      'RIF Proveedor',
      'Razón Social / Proveedor',
      'N° Factura',
      'N° Control',
      'N° Comp. Ret.',
      'Total Compras (Bs)',
      'Exento (Bs)',
      'Base Imponible (Bs)',
      '% Alic.',
      'Crédito IVA (Bs)',
      'Ret. IVA (Bs)',
    ];

    const rows = items.map((r: any, idx: number) => [
      String(r.rowNum || idx + 1),
      r.emissionDate ? String(r.emissionDate).slice(0, 10) : '',
      r.supplierRif || 'J-00000000',
      (r.supplierName || 'PROVEEDOR').slice(0, 24),
      r.invoiceNumber || '-',
      r.controlNumber || '-',
      r.withholdingVoucherNumber || '-',
      this.fmtVES(r.totalAmount || r.total_amount),
      this.fmtVES(r.baseExemptAmount || r.base_exempt_amount),
      this.fmtVES(r.baseTaxableAmount || r.base_taxable_amount),
      r.taxRate ? `${Number(r.taxRate).toFixed(0)}%` : '16%',
      this.fmtVES(r.taxAmount || r.tax_amount),
      this.fmtVES(r.ivaRetainedAmount || r.iva_retained_amount),
    ]);

    const footRow = [
      { content: 'TOTALES LIBRO DE COMPRAS:', colSpan: 7, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      this.fmtVES(totals.totalPurchases),
      this.fmtVES(totals.totalExempt),
      this.fmtVES(totals.totalTaxable),
      '16%',
      this.fmtVES(totals.totalTax),
      this.fmtVES(totals.totalIvaRetained),
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 6.6,
        halign: 'center',
        cellPadding: 1.8,
      },
      bodyStyles: {
        fontSize: 6.2,
        cellPadding: 1.4,
        textColor: this.COLOR_PRIMARY,
      },
      alternateRowStyles: {
        fillColor: this.COLOR_BG_LIGHT,
      },
      footStyles: {
        fillColor: this.COLOR_TOTALS,
        textColor: this.COLOR_PRIMARY,
        fontStyle: 'bold',
        fontSize: 6.5,
        cellPadding: 1.8,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 16 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'left', cellWidth: 44 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 18 },
        6: { halign: 'center', cellWidth: 22 },
        7: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
        8: { halign: 'right', cellWidth: 20 },
        9: { halign: 'right', cellWidth: 23 },
        10: { halign: 'center', cellWidth: 13 },
        11: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
        12: { halign: 'right', cellWidth: 22 },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    return this.finalize(doc);
  }

  /**
   * 9. CERTIFICADO ANUAL DE RETENCIONES ISLR (COMPROBANTE ARCV)
   */
  static generateARCVReportPDF(
    data: any,
    company: CompanyPdfInfo,
    userName: string,
    options: {
      year: number;
      supplierName?: string;
    }
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'CERTIFICADO ANUAL DE RETENCIONES DE I.S.L.R. (COMPROBANTE ARCV)',
      subtitle: `Relación Anual Acumulada de Retenciones Aplicadas • Ejercicio Fiscal ${options.year}`,
      userName,
      orientation: 'portrait',
      auditId: `ARCV-${options.year}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    });

    const suppliers = data.suppliers || [];
    let currentY = startY;

    suppliers.forEach((sup: any, supIdx: number) => {
      if (supIdx > 0) {
        doc.addPage();
        currentY = 25;
      }

      // Ficha del Sujeto Retenido y Agente
      const agentLines = [
        `Agente de Retención: ${(company.legalName || 'EMPRESA').toUpperCase()}`,
        `RIF: ${company.rif || 'J-00000000-0'}`,
        `Dirección Fiscal: ${company.fiscalAddress || 'Caracas, Venezuela'}`,
      ];

      const supplierLines = [
        `Beneficiario Retenido: ${(sup.supplierName || 'PROVEEDOR').toUpperCase()}`,
        `RIF: ${sup.supplierRif || 'J-00000000-0'}`,
        `Año Gravable Aplicado: ${options.year}`,
      ];

      currentY = this.drawTwoColumnInfoCards(
        doc,
        currentY,
        { title: 'DATOS DEL AGENTE DE RETENCIÓN', lines: agentLines },
        { title: 'DATOS DEL SUJETO BENEFICIARIO RETENIDO', lines: supplierLines },
        pageWidth
      );

      const headers = ['Período', 'N° Comp.', 'Factura', 'Concepto Retención', 'Base Imponible (Bs)', '% Tarifa', 'ISLR Retenido (Bs)'];

      const rows = (sup.vouchers || []).map((v: any) => [
        v.taxPeriod || '-',
        v.voucherNumber || '-',
        v.invoiceNumber || '-',
        (v.conceptDescription || v.conceptCode || 'Servicios').slice(0, 24),
        this.fmtVES(v.taxableBaseAmount),
        `${Number(v.ratePercentage || 0).toFixed(1)}%`,
        this.fmtVES(v.islrRetainedAmount),
      ]);

      const footRow = [
        { content: 'TOTAL ANUAL RETENIDO:', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        this.fmtVES(sup.totalTaxableBase),
        '-',
        this.fmtVES(sup.totalIslrRetained),
      ];

      autoTable(doc, {
        head: [headers],
        body: rows,
        foot: [footRow],
        startY: currentY,
        theme: 'striped',
        headStyles: {
          fillColor: this.COLOR_HEADER,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 6.8,
          halign: 'center',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 6.5,
          cellPadding: 1.6,
          textColor: this.COLOR_PRIMARY,
        },
        footStyles: {
          fillColor: this.COLOR_TOTALS,
          textColor: this.COLOR_PRIMARY,
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 24 },
          2: { halign: 'center', cellWidth: 22 },
          3: { halign: 'left', cellWidth: 46 },
          4: { halign: 'right', cellWidth: 26 },
          5: { halign: 'center', cellWidth: 16 },
          6: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });

      const nextY = (doc as any).lastAutoTable.finalY + 12;

      this.drawSignatureBoxes(
        doc,
        nextY,
        [
          { title: 'AGENTE DE RETENCIÓN', subtitle: 'Firma y Sello Autorizado' },
          { title: 'SUJETO RETENIDO / BENEFICIARIO', subtitle: 'Firma y Cédula de Recepción' },
        ],
        pageWidth
      );
    });

    return this.finalize(doc);
  }

  /**
   * 10. ACTA DE CIERRE Y ARQUEO DE CAJA REGISTRADORA
   */
  static generateCashShiftVoucherPDF(
    shift: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'ACTA DE CIERRE Y ARQUEO DE CAJA REGISTRADORA',
      subtitle: `Control de Operaciones POS, Auditoría de Efectivo y Depósitos a Tesorería`,
      periodText: `Turno ID: ${shift.id?.slice(0, 8)}  •  Caja: ${shift.cashRegisterCode || shift.cashRegisterName || '01'}  •  Cierre: ${shift.closedAt ? String(shift.closedAt).slice(0, 16) : 'EN VIVO'}`,
      userName,
      orientation: 'portrait',
      auditId: `CRRE-${shift.id?.slice(0, 8).toUpperCase()}`,
    });

    const rev = shift.revenue || shift.summary || {};
    const cards: KpiCardItem[] = [
      {
        label: 'Total Recaudado (Bs)',
        value: this.fmtVES(rev.totalCollectedVES),
        sub: 'Ingresos totales del turno',
      },
      {
        label: 'Lote Punto de Venta (Bs)',
        value: this.fmtVES(rev.posBatchVES),
        sub: 'Tarjetas de débito / crédito',
      },
      {
        label: 'Pago Móvil (Bs)',
        value: this.fmtVES(rev.pagomovilVES),
        sub: 'Transferencias confirmadas',
      },
      {
        label: 'Diferencia Efectivo',
        value: `${this.fmtVES(shift.differenceVES)}`,
        sub: Number(shift.differenceVES || 0) === 0 ? 'Cuadre perfecto (0.00)' : Number(shift.differenceVES || 0) > 0 ? 'Sobrante en caja' : 'Faltante en caja',
      },
    ];

    let currentY = this.drawKpiCards(doc, startY, cards, pageWidth);

    const shiftInfoLeft = [
      `Caja Registradora: ${shift.cashRegisterCode || 'C-01'} - ${shift.cashRegisterName || 'Principal'}`,
      `Sucursal: ${shift.branchName || 'Sede Principal'}`,
      `Cajero Operador: ${shift.cashierName || userName}`,
      `Estado de Auditoría: ${shift.auditStatus || shift.status || 'CLOSED'}`,
    ];

    const shiftInfoRight = [
      `Fecha y Hora Apertura: ${shift.openedAt ? String(shift.openedAt).slice(0, 19).replace('T', ' ') : '-'}`,
      `Fecha y Hora Cierre: ${shift.closedAt ? String(shift.closedAt).slice(0, 19).replace('T', ' ') : 'EN CURSO'}`,
      `Observaciones / Notas: ${shift.notes || 'Cierre conforme sin novedades reportadas'}`,
    ];

    currentY = this.drawTwoColumnInfoCards(
      doc,
      currentY,
      { title: 'DATOS DE LA CAJA Y OPERADOR', lines: shiftInfoLeft },
      { title: 'TIEMPOS Y OBSERVACIONES DE AUDITORÍA', lines: shiftInfoRight },
      pageWidth
    );

    // Tabla 1: Conciliación de Efectivo (Arqueo Físico)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
    doc.text('1. CONCILIACIÓN DE EFECTIVO Y ARQUEO FÍSICO (USD / VES)', 14, currentY + 1);

    const cashHeaders = ['Concepto de Arqueo', 'Moneda Divisa USD ($)', 'Moneda Nacional VES (Bs)'];
    const cashRows = [
      ['Fondo Inicial de Caja (Apertura)', this.fmtUSD(shift.initialCashUSD), this.fmtVES(shift.initialCashVES)],
      ['Efectivo Total Esperado en Gaveta', this.fmtUSD(shift.finalCashUSDExpected), this.fmtVES(shift.finalCashVESExpected)],
      ['Efectivo Contado Físicamente', this.fmtUSD(shift.finalCashUSDCounted), this.fmtVES(shift.finalCashVESCounted)],
      ['Diferencia Arqueo (Sobrante / Faltante)', this.fmtUSD(shift.differenceUSD), this.fmtVES(shift.differenceVES)],
    ];

    autoTable(doc, {
      head: [cashHeaders],
      body: cashRows,
      startY: currentY + 3.5,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 1.8 },
      bodyStyles: { fontSize: 6.8, cellPadding: 1.6, textColor: this.COLOR_PRIMARY },
      columnStyles: {
        0: { halign: 'left', cellWidth: 80 },
        1: { halign: 'right', cellWidth: 50 },
        2: { halign: 'right', cellWidth: 52, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    // Tabla 2: Depósitos Bancarios / Entrega de Valores a Tesorería
    const nextY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(this.COLOR_PRIMARY[0], this.COLOR_PRIMARY[1], this.COLOR_PRIMARY[2]);
    doc.text('2. DEPÓSITOS BANCARIOS REGISTRADOS EN TESORERÍA', 14, nextY + 1);

    const depHeaders = ['Moneda', 'Cuenta Bancaria de Destino', 'N° Depósito / Referencia', 'Monto Depositado'];
    const depRows = [
      ['VES (Bolívares)', shift.depositAccountVES || shift.depositBankVESName || 'Cuenta Recaudadora Principal', shift.depositReferenceVES || 'N/A', this.fmtVES(shift.depositAmountVES)],
      ['USD (Divisas)', shift.depositAccountUSD || shift.depositBankUSDName || 'Bóveda / Custodia de Tesorería', shift.depositReferenceUSD || 'N/A', this.fmtUSD(shift.depositAmountUSD)],
    ];

    autoTable(doc, {
      head: [depHeaders],
      body: depRows,
      startY: nextY + 3.5,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 1.8 },
      bodyStyles: { fontSize: 6.8, cellPadding: 1.6, textColor: this.COLOR_PRIMARY },
      columnStyles: {
        0: { halign: 'center', cellWidth: 35 },
        1: { halign: 'left', cellWidth: 70 },
        2: { halign: 'center', cellWidth: 40 },
        3: { halign: 'right', cellWidth: 37, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    const signY = (doc as any).lastAutoTable.finalY + 10;

    this.drawSignatureBoxes(
      doc,
      signY,
      [
        { title: 'CAJERO RESPONSABLE', subtitle: `${shift.cashierName || userName} (Firma Conforme)` },
        { title: 'SUPERVISOR / AUDITOR DE CAJA', subtitle: 'Validación de Valores y Cierre' },
      ],
      pageWidth
    );

    return this.finalize(doc);
  }

  /**
   * 11. COTIZACIÓN / PRESUPUESTO COMERCIAL DE VENTAS
   */
  static generateQuotationPDF(
    quotation: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'COTIZACIÓN / PRESUPUESTO COMERCIAL',
      subtitle: 'Propuesta Económica Formal y Condiciones de Suministro',
      periodText: `N° Cotización: ${quotation.quotationNumber}  •  Emisión: ${String(quotation.quotationDate || '').slice(0, 10)}  •  Vence: ${String(quotation.validUntil || '').slice(0, 10) || '15 días'}`,
      userName,
      orientation: 'portrait',
      auditId: `COT-${quotation.quotationNumber || 'VTA'}`,
    });

    const clientLines = [
      `Cliente: ${(quotation.customerName || quotation.customer_name || 'CLIENTE').toUpperCase()}`,
      `RIF / C.I.: ${quotation.customerDoc || quotation.customer_doc || 'V-00000000'}`,
      `Teléfono: ${quotation.customerPhone || quotation.customer_phone || '-'}`,
      `Email: ${quotation.customerEmail || quotation.customer_email || '-'}`,
    ];

    const termsLines = [
      `Condiciones de Pago: ${quotation.paymentTerms || quotation.payment_terms || 'Contado Inmediato'}`,
      `Moneda Base: ${quotation.currency || 'USD'}  •  Tasa Oficial BCV: ${this.fmtVES(quotation.exchangeRate || quotation.exchange_rate || 1)}`,
      `Estado: ${quotation.status || 'DRAFT'}`,
      `Observaciones: ${quotation.notes || 'Precios sujetos a disponibilidad de inventario'}`,
    ];

    let currentY = this.drawTwoColumnInfoCards(
      doc,
      startY,
      { title: 'DATOS DEL CLIENTE', lines: clientLines },
      { title: 'CONDICIONES COMERCIALES', lines: termsLines },
      pageWidth
    );

    const headers = ['#', 'SKU', 'Descripción del Producto', 'Cant.', 'Precio ($)', 'Desc.', 'IVA', 'Subtotal ($)', 'Total ($)'];

    const items = quotation.items || [];
    const rows = items.map((it: any, idx: number) => [
      String(idx + 1),
      it.productSku || it.sku || '-',
      (it.productName || it.name || '').slice(0, 36),
      this.fmtQty(it.quantity),
      this.fmtUSD(it.unitPrice),
      it.discountPercent ? `${Number(it.discountPercent).toFixed(0)}%` : '-',
      `${Number(it.taxRate || 16).toFixed(0)}%`,
      this.fmtUSD(it.subtotal),
      this.fmtUSD(it.total),
    ]);

    const subtotal = Number(quotation.subtotalAmount || quotation.subtotal_amount || 0);
    const tax = Number(quotation.taxAmount || quotation.tax_amount || 0);
    const total = Number(quotation.totalAmount || quotation.total_amount || 0);
    const rate = Number(quotation.exchangeRate || quotation.exchange_rate || 1);

    const footRow = [
      { content: `TOTAL COTIZACIÓN:  USD ${this.fmtUSD(total)}  |  EQUIV. BCV: ${this.fmtVES(total * rate)}`, colSpan: 9, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7.2 } },
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 6.8, fontStyle: 'bold', halign: 'center', cellPadding: 1.8 },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.5, textColor: this.COLOR_PRIMARY },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'left', cellWidth: 54 },
        3: { halign: 'right', cellWidth: 14 },
        4: { halign: 'right', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 12 },
        6: { halign: 'center', cellWidth: 12 },
        7: { halign: 'right', cellWidth: 20 },
        8: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    const signY = (doc as any).lastAutoTable.finalY + 12;

    this.drawSignatureBoxes(
      doc,
      signY,
      [
        { title: 'ASESOR COMERCIAL / VENTAS', subtitle: 'Firma Autorizada' },
        { title: 'CONFORMIDAD DEL CLIENTE', subtitle: 'Firma y Cédula de Aceptación' },
      ],
      pageWidth
    );

    return this.finalize(doc);
  }

  /**
   * 12. NOTA DE ENTREGA / GUÍA DE DESPACHO
   */
  static generateDeliveryNotePDF(
    delivery: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'NOTA DE ENTREGA / GUÍA DE DESPACHO',
      subtitle: 'Comprobante Oficial de Entrega Física y Salida de Almacén',
      periodText: `N° Documento: ${delivery.deliveryNumber}  •  Fecha: ${String(delivery.deliveryDate || '').slice(0, 10)}  •  Almacén: ${delivery.warehouseName || 'Principal'}`,
      userName,
      orientation: 'portrait',
      auditId: `NOT-${delivery.deliveryNumber || 'DSP'}`,
    });

    const clientLines = [
      `Destinatario / Cliente: ${(delivery.customerName || 'CLIENTE').toUpperCase()}`,
      `RIF / C.I.: ${delivery.customerDoc || 'V-00000000'}`,
      `Dirección de Entrega: ${(delivery.customerAddress || 'En Almacén').slice(0, 50)}`,
      `Teléfono de Contacto: ${delivery.customerPhone || '-'}`,
    ];

    const logisticsLines = [
      `Almacén de Salida: ${delivery.warehouseName || 'Almacén Central'}`,
      `Transportista / Chofer: ${delivery.driverName || 'Transporte Propio'}`,
      `Placa del Vehículo: ${delivery.vehiclePlate || 'N/A'}`,
      `Despachado Por: ${delivery.dispatchedByUserName || userName}`,
    ];

    let currentY = this.drawTwoColumnInfoCards(
      doc,
      startY,
      { title: 'DATOS DEL RECEPTOR / CLIENTE', lines: clientLines },
      { title: 'DATOS DE LOGÍSTICA Y TRANSPORTE', lines: logisticsLines },
      pageWidth
    );

    const headers = ['#', 'SKU', 'Descripción del Ítem Despachado', 'Cant. Despachada', 'Unidad', 'Observaciones / Serie'];

    const items = delivery.items || [];
    const rows = items.map((it: any, idx: number) => [
      String(idx + 1),
      it.productSku || it.sku || '-',
      (it.productName || it.name || '').slice(0, 48),
      this.fmtQty(it.quantityDelivered || it.quantity),
      it.unitOfMeasure || 'UND',
      it.notes || 'Entregado en perfecto estado',
    ]);

    const totalQty = items.reduce((acc: number, it: any) => acc + Number(it.quantityDelivered || it.quantity || 0), 0);

    const footRow = [
      { content: 'TOTAL ARTÍCULOS DESPACHADOS:', colSpan: 3, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      this.fmtQty(totalQty),
      '-',
      '-',
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, cellPadding: 1.6, textColor: this.COLOR_PRIMARY },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 24 },
        2: { halign: 'left', cellWidth: 70 },
        3: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
        4: { halign: 'center', cellWidth: 16 },
        5: { halign: 'left', cellWidth: 36 },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    const signY = (doc as any).lastAutoTable.finalY + 12;

    this.drawSignatureBoxes(
      doc,
      signY,
      [
        { title: 'DESPACHADO POR (ALMACÉN)', subtitle: 'Firma y Sello de Salida' },
        { title: 'RECIBIDO CONFORME (CLIENTE)', subtitle: 'Nombre, Cédula y Firma' },
      ],
      pageWidth
    );

    return this.finalize(doc);
  }

  /**
   * 13. RECIBO OFICIAL DE COBRANZA (CxC)
   */
  static generateCollectionReceiptPDF(
    collection: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const receiptNum = collection.receiptNumber || `REC-${collection.id?.slice(0, 8).toUpperCase()}`;

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'RECIBO OFICIAL DE COBRANZA',
      subtitle: 'Comprobante de Abono y Cancelación de Cuentas por Cobrar (CxC)',
      periodText: `N° Recibo: ${receiptNum}  •  Fecha: ${new Date().toLocaleDateString('es-VE')}  •  Sucursal: ${collection.branchName || 'Principal'}`,
      userName,
      orientation: 'portrait',
      auditId: receiptNum,
    });

    const clientLines = [
      `Cliente: ${(collection.customerName || 'CLIENTE').toUpperCase()}`,
      `RIF / C.I.: ${collection.customerDoc || 'V-00000000'}`,
      `Factura Afectada: N° ${collection.invoiceNumber || '-'}`,
      `Cobrador / Receptor: ${userName}`,
    ];

    const paymentLines = [
      `Método de Pago: ${(collection.paymentMethod || 'TRANSFERENCIA').toUpperCase()}`,
      `Referencia / Operación: ${collection.referenceNumber || 'N/A'}`,
      `Tasa Oficial BCV: ${this.fmtVES(collection.exchangeRate || 1)}`,
      `Saldo Restante de la Factura: ${this.fmtUSD(collection.remainingBalance || 0)}`,
    ];

    let currentY = this.drawTwoColumnInfoCards(
      doc,
      startY,
      { title: 'DATOS DEL CLIENTE Y DOCUMENTO', lines: clientLines },
      { title: 'DETALLES DE LA TRANSACCIÓN', lines: paymentLines },
      pageWidth
    );

    const headers = ['Concepto de Cobro', 'Monto USD ($)', 'Monto VES (Bs)'];
    const amountUSD = Number(collection.amountUSD || collection.amountPaid || 0);
    const amountVES = Number(collection.amountVES || (amountUSD * Number(collection.exchangeRate || 1)));

    const rows = [
      [
        `Abono / Cancelación Factura N° ${collection.invoiceNumber || '-'}`,
        this.fmtUSD(amountUSD),
        this.fmtVES(amountVES),
      ],
    ];

    const footRow = [
      'TOTAL COBRADO:',
      this.fmtUSD(amountUSD),
      this.fmtVES(amountVES),
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, cellPadding: 1.8, textColor: this.COLOR_PRIMARY },
      footStyles: { fillColor: this.COLOR_TOTALS, textColor: this.COLOR_PRIMARY, fontStyle: 'bold', fontSize: 7.2, cellPadding: 2 },
      columnStyles: {
        0: { halign: 'left', cellWidth: 100 },
        1: { halign: 'right', cellWidth: 41, fontStyle: 'bold' },
        2: { halign: 'right', cellWidth: 41, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    const signY = (doc as any).lastAutoTable.finalY + 14;

    this.drawSignatureBoxes(
      doc,
      signY,
      [
        { title: 'DEPARTAMENTO DE COBRANZAS', subtitle: `${userName} (Firma y Sello)` },
        { title: 'CLIENTE / PAGADOR', subtitle: 'Firma Conforme' },
      ],
      pageWidth
    );

    return this.finalize(doc);
  }

  /**
   * 14. ORDEN DE COMPRA A PROVEEDOR
   */
  static generatePurchaseOrderPDF(
    order: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'ORDEN DE COMPRA A PROVEEDOR',
      subtitle: 'Solicitud Formal de Bienes, Insumos o Servicios Comerciales',
      periodText: `N° Orden: ${order.orderNumber}  •  Fecha: ${String(order.orderDate || '').slice(0, 10)}  •  Sucursal: ${order.branchName || 'Principal'}`,
      userName,
      orientation: 'portrait',
      auditId: `OC-${order.orderNumber || 'PROV'}`,
    });

    const supplierLines = [
      `Proveedor: ${(order.supplierName || 'PROVEEDOR').toUpperCase()}`,
      `RIF: ${order.supplierRif || 'J-00000000-0'}`,
      `Teléfono: ${order.supplierPhone || '-'}`,
      `Email: ${order.supplierEmail || '-'}`,
    ];

    const orderConditions = [
      `Condiciones de Pago: ${order.paymentTerms || 'Crédito Comercial'}`,
      `Moneda Base: ${order.currency || 'USD'}  •  Tasa Oficial BCV: ${this.fmtVES(order.exchangeRate || 1)}`,
      `Estado: ${order.status || 'PENDING'}`,
      `Instrucciones: ${order.notes || 'Entregar con factura o nota de entrega formal'}`,
    ];

    let currentY = this.drawTwoColumnInfoCards(
      doc,
      startY,
      { title: 'DATOS DEL PROVEEDOR', lines: supplierLines },
      { title: 'CONDICIONES DE SUMINISTRO', lines: orderConditions },
      pageWidth
    );

    const headers = ['#', 'SKU', 'Descripción del Ítem', 'Cant. Solicitada', 'Costo Unit. ($)', 'IVA', 'Total ($)'];

    const items = order.items || [];
    const rows = items.map((it: any, idx: number) => [
      String(idx + 1),
      it.productSku || it.sku || '-',
      (it.productName || it.name || '').slice(0, 48),
      this.fmtQty(it.quantityOrdered || it.quantity),
      this.fmtUSD(it.unitCost),
      `${Number(it.taxRate || 16).toFixed(0)}%`,
      this.fmtUSD(it.total),
    ]);

    const total = Number(order.totalAmount || 0);
    const rate = Number(order.exchangeRate || 1);

    const footRow = [
      { content: `TOTAL ORDEN DE COMPRA:  USD ${this.fmtUSD(total)}  |  EQUIV. BCV: ${this.fmtVES(total * rate)}`, colSpan: 7, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7.2 } },
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, cellPadding: 1.6, textColor: this.COLOR_PRIMARY },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 24 },
        2: { halign: 'left', cellWidth: 70 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'center', cellWidth: 14 },
        6: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    const signY = (doc as any).lastAutoTable.finalY + 12;

    this.drawSignatureBoxes(
      doc,
      signY,
      [
        { title: 'ELABORADO POR (COMPRAS)', subtitle: `${order.createdByUserName || userName}` },
        { title: 'APROBADO POR (GERENCIA)', subtitle: 'Firma y Sello de Autorización' },
      ],
      pageWidth
    );

    return this.finalize(doc);
  }

  /**
   * 15. ACTA DE RECEPCIÓN DE MERCANCÍAS EN ALMACÉN
   */
  static generateGoodsReceiptPDF(
    receipt: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'ACTA DE RECEPCIÓN DE MERCANCÍAS',
      subtitle: 'Entrada Oficial a Depósito e Inspección Física de Inventario',
      periodText: `N° Recepción: ${receipt.receiptNumber}  •  Fecha: ${String(receipt.receiptDate || '').slice(0, 10)}  •  Almacén: ${receipt.warehouseName || 'Principal'}`,
      userName,
      orientation: 'portrait',
      auditId: `REC-${receipt.receiptNumber || 'ALM'}`,
    });

    const supplierLines = [
      `Proveedor: ${(receipt.supplierName || 'PROVEEDOR').toUpperCase()}`,
      `RIF: ${receipt.supplierRif || 'J-00000000-0'}`,
      `N° Factura / Guía Proveedor: ${receipt.supplierDeliveryNote || 'N/A'}`,
      `N° Orden de Compra: ${receipt.purchaseOrderNumber || 'N/A'}`,
    ];

    const warehouseLines = [
      `Almacén Receptor: ${receipt.warehouseName || 'Almacén Central'}`,
      `Sucursal: ${receipt.branchName || 'Principal'}`,
      `Recibido Por: ${receipt.receivedByUserName || userName}`,
      `Observaciones: ${receipt.notes || 'Revisado y conforme con orden de compra'}`,
    ];

    let currentY = this.drawTwoColumnInfoCards(
      doc,
      startY,
      { title: 'DATOS DEL PROVEEDOR Y DOCUMENTOS', lines: supplierLines },
      { title: 'DATOS DE RECEPCIÓN EN BODEGA', lines: warehouseLines },
      pageWidth
    );

    const headers = ['#', 'SKU', 'Producto Recibido', 'Cant. Recibida', 'Unidad', 'Costo Unit. ($)', 'Costo Total ($)'];

    const items = receipt.items || [];
    const rows = items.map((it: any, idx: number) => [
      String(idx + 1),
      it.productSku || it.sku || '-',
      (it.productName || it.name || '').slice(0, 48),
      this.fmtQty(it.quantityReceived || it.quantity),
      it.unitOfMeasure || 'UND',
      this.fmtUSD(it.unitCost),
      this.fmtUSD(it.totalCost || (Number(it.quantityReceived || 0) * Number(it.unitCost || 0))),
    ]);

    const totalCost = Number(receipt.totalCost || 0);

    const footRow = [
      { content: `TOTAL COSTO MERCANCÍA INGRESADA:  USD ${this.fmtUSD(totalCost)}`, colSpan: 7, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7.2 } },
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, cellPadding: 1.6, textColor: this.COLOR_PRIMARY },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 24 },
        2: { halign: 'left', cellWidth: 70 },
        3: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
        4: { halign: 'center', cellWidth: 16 },
        5: { halign: 'right', cellWidth: 22 },
        6: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    const signY = (doc as any).lastAutoTable.finalY + 12;

    this.drawSignatureBoxes(
      doc,
      signY,
      [
        { title: 'RECIBIDO EN DEPÓSITO', subtitle: `${receipt.receivedByUserName || userName} (Almacenero)` },
        { title: 'CONTROL DE CALIDAD / ADMINISTRACIÓN', subtitle: 'Verificación y Registro en Kardex' },
      ],
      pageWidth
    );

    return this.finalize(doc);
  }

  /**
   * 16. COMPROBANTE DE PAGO A PROVEEDOR (CxP)
   */
  static generatePayablePaymentReceiptPDF(
    payment: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const paymentNum = payment.paymentNumber || `PAG-${payment.id?.slice(0, 8).toUpperCase()}`;

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'COMPROBANTE DE PAGO A PROVEEDOR (EGRESO)',
      subtitle: 'Orden de Pago y Cancelación de Cuentas por Pagar (CxP)',
      periodText: `N° Comprobante: ${paymentNum}  •  Fecha: ${new Date().toLocaleDateString('es-VE')}  •  Sucursal: ${payment.branchName || 'Principal'}`,
      userName,
      orientation: 'portrait',
      auditId: paymentNum,
    });

    const supplierLines = [
      `Beneficiario: ${(payment.supplierName || 'PROVEEDOR').toUpperCase()}`,
      `RIF: ${payment.supplierRif || 'J-00000000-0'}`,
      `Factura Cancelada: N° ${payment.invoiceNumber || '-'}`,
      `N° Control Factura: ${payment.controlNumber || '-'}`,
    ];

    const paymentLines = [
      `Método de Pago: ${(payment.paymentMethod || payment.method || 'TRANSFERENCIA').toUpperCase()}`,
      `Banco Origen: ${payment.bankAccountName || 'Tesorería Central'}`,
      `N° Referencia Bancaria: ${payment.referenceNumber || 'N/A'}`,
      `Tasa Oficial BCV: ${this.fmtVES(payment.exchangeRate || 1)}`,
    ];

    let currentY = this.drawTwoColumnInfoCards(
      doc,
      startY,
      { title: 'DATOS DEL BENEFICIARIO Y FACTURA', lines: supplierLines },
      { title: 'DETALLES DEL DESEMBOLSO', lines: paymentLines },
      pageWidth
    );

    const headers = ['Concepto de Egreso', 'Monto USD ($)', 'Monto VES (Bs)'];
    const amountUSD = Number(payment.amountUSD || payment.amount_usd || 0);
    const amountVES = Number(payment.amountVES || payment.amount_ves || (amountUSD * Number(payment.exchangeRate || 1)));

    const rows = [
      [
        `Pago / Abono Factura de Compra N° ${payment.invoiceNumber || '-'}`,
        this.fmtUSD(amountUSD),
        this.fmtVES(amountVES),
      ],
    ];

    const footRow = [
      'TOTAL NETO PAGADO:',
      this.fmtUSD(amountUSD),
      this.fmtVES(amountVES),
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, cellPadding: 1.8, textColor: this.COLOR_PRIMARY },
      footStyles: { fillColor: this.COLOR_TOTALS, textColor: this.COLOR_PRIMARY, fontStyle: 'bold', fontSize: 7.2, cellPadding: 2 },
      columnStyles: {
        0: { halign: 'left', cellWidth: 100 },
        1: { halign: 'right', cellWidth: 41, fontStyle: 'bold' },
        2: { halign: 'right', cellWidth: 41, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    const signY = (doc as any).lastAutoTable.finalY + 14;

    this.drawSignatureBoxes(
      doc,
      signY,
      [
        { title: 'TESORERÍA Y PAGOS', subtitle: `${userName} (Autorizado)` },
        { title: 'PROVEEDOR / BENEFICIARIO', subtitle: 'Recibido Conforme' },
      ],
      pageWidth
    );

    return this.finalize(doc);
  }

  /**
   * 17. REPORTE DE KARDEX DE INVENTARIO VALORIZADO (HORIZONTAL / LANDSCAPE)
   */
  static generateKardexReportPDF(
    data: any,
    company: CompanyPdfInfo,
    userName: string,
    options: {
      productName?: string;
      warehouseName?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Buffer {
    const periodText = [
      options.startDate && options.endDate ? `Período: ${options.startDate} al ${options.endDate}` : undefined,
      options.warehouseName ? `Almacén: ${options.warehouseName}` : undefined,
      options.productName ? `Producto: ${options.productName}` : undefined,
    ].filter(Boolean).join('  •  ');

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'KARDEX DE INVENTARIO VALORIZADO',
      subtitle: 'Trazabilidad Cronológica de Entradas, Salidas y Existencias Físicas',
      periodText,
      userName,
      orientation: 'landscape',
      auditId: `KDX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    });

    const summary = data.summary || {};
    const cards: KpiCardItem[] = [
      {
        label: 'Movimientos Auditados',
        value: `${summary.totalMovements || data.movements?.length || 0} oper.`,
        sub: 'Transacciones registradas',
      },
      {
        label: 'Unidades Ingresadas',
        value: this.fmtQty(summary.totalInQty),
        sub: `Valor: ${this.fmtUSD(summary.totalInValue)}`,
      },
      {
        label: 'Unidades Egresadas',
        value: this.fmtQty(summary.totalOutQty),
        sub: `Valor: ${this.fmtUSD(summary.totalOutValue)}`,
      },
      {
        label: 'Saldo Neto Unidades',
        value: this.fmtQty(Number(summary.totalInQty || 0) - Number(summary.totalOutQty || 0)),
        sub: 'Flujo neto de inventario',
      },
    ];

    const currentY = this.drawKpiCards(doc, startY, cards, pageWidth);

    const headers = [
      'Fecha',
      'Almacén',
      'SKU',
      'Producto',
      'Tipo Mov.',
      'Doc. Referencia',
      'Entrada',
      'Salida',
      'Stock Ant.',
      'Stock Nvo.',
      'Costo Unit. ($)',
      'Total ($)',
      'Operador',
    ];

    const movements = data.movements || [];
    const rows = movements.map((m: any) => {
      const isInput = ['IN', 'ADJUST_IN', 'TRANSFER_IN', 'PURCHASE'].includes(m.movementType);
      return [
        m.createdAt ? String(m.createdAt).slice(0, 16).replace('T', ' ') : '-',
        (m.warehouseName || 'Central').slice(0, 14),
        m.sku || '-',
        (m.productName || '').slice(0, 24),
        m.movementType,
        m.referenceDocument || '-',
        isInput ? this.fmtQty(m.quantity) : '-',
        !isInput ? this.fmtQty(m.quantity) : '-',
        this.fmtQty(m.previousStock),
        this.fmtQty(m.newStock),
        this.fmtUSD(m.unitCost),
        this.fmtUSD(m.totalCost),
        (m.userName || '').slice(0, 14),
      ];
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 6.5, fontStyle: 'bold', halign: 'center', cellPadding: 1.8 },
      bodyStyles: { fontSize: 6.1, cellPadding: 1.3, textColor: this.COLOR_PRIMARY },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { halign: 'left', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'left', cellWidth: 38 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 22 },
        6: { halign: 'right', cellWidth: 15, fontStyle: 'bold' },
        7: { halign: 'right', cellWidth: 15, fontStyle: 'bold' },
        8: { halign: 'right', cellWidth: 16 },
        9: { halign: 'right', cellWidth: 16 },
        10: { halign: 'right', cellWidth: 18 },
        11: { halign: 'right', cellWidth: 20 },
        12: { halign: 'left', cellWidth: 20 },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    return this.finalize(doc);
  }

  /**
   * 18. ACTA DE AJUSTE DE INVENTARIO
   */
  static generateInventoryAdjustmentPDF(
    adjustment: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'ACTA DE AJUSTE DE INVENTARIO',
      subtitle: 'Comprobante de Corrección de Existencias por Merma, Sobrante o Conteo',
      periodText: `N° Ajuste: ${adjustment.adjustmentNumber}  •  Tipo: ${adjustment.type}  •  Almacén: ${adjustment.warehouseName || 'Principal'}`,
      userName,
      orientation: 'portrait',
      auditId: `AJU-${adjustment.adjustmentNumber || 'INV'}`,
    });

    const infoLeft = [
      `Almacén Afectado: ${adjustment.warehouseName || 'Almacén Central'}`,
      `Sucursal: ${adjustment.branchName || 'Principal'}`,
      `Tipo de Ajuste: ${adjustment.type}`,
      `Estado: ${adjustment.status || 'APPLIED'}`,
    ];

    const infoRight = [
      `Fecha de Registro: ${adjustment.adjustmentDate ? String(adjustment.adjustmentDate).slice(0, 19).replace('T', ' ') : new Date().toLocaleDateString('es-VE')}`,
      `Responsable / Auditor: ${adjustment.userName || userName}`,
      `Motivo / Justificación: ${adjustment.reason || 'Conteo físico periódico'}`,
      `Impacto Costo Total: ${this.fmtUSD(adjustment.totalCostImpact || 0)}`,
    ];

    let currentY = this.drawTwoColumnInfoCards(
      doc,
      startY,
      { title: 'DATOS DEL ALMACÉN Y OPERACIÓN', lines: infoLeft },
      { title: 'JUSTIFICACIÓN Y RESPONSABLE', lines: infoRight },
      pageWidth
    );

    const headers = ['#', 'SKU', 'Producto', 'Movimiento', 'Stock Ant.', 'Cant. Ajustada', 'Stock Nvo.', 'Costo ($)', 'Total ($)'];

    const items = adjustment.items || [];
    const rows = items.map((it: any, idx: number) => [
      String(idx + 1),
      it.sku || it.productSku || '-',
      (it.productName || it.name || '').slice(0, 36),
      it.movementType === 'ADJUST_IN' ? '+ Sobrante' : '- Faltante',
      this.fmtQty(it.previousStock),
      this.fmtQty(it.quantity),
      this.fmtQty(it.newStock),
      this.fmtUSD(it.unitCost),
      this.fmtUSD(it.totalCost || (Number(it.quantity || 0) * Number(it.unitCost || 0))),
    ]);

    const footRow = [
      { content: `IMPACTO FINANCIERO TOTAL:  USD ${this.fmtUSD(adjustment.totalCostImpact || 0)}`, colSpan: 9, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7.2 } },
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, cellPadding: 1.6, textColor: this.COLOR_PRIMARY },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'left', cellWidth: 50 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 16 },
        5: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
        6: { halign: 'right', cellWidth: 16 },
        7: { halign: 'right', cellWidth: 16 },
        8: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    const signY = (doc as any).lastAutoTable.finalY + 12;

    this.drawSignatureBoxes(
      doc,
      signY,
      [
        { title: 'AUDITOR DE INVENTARIOS', subtitle: `${adjustment.userName || userName} (Elaborado)` },
        { title: 'GERENCIA DE OPERACIONES', subtitle: 'Aprobado y Verificado' },
      ],
      pageWidth
    );

    return this.finalize(doc);
  }

  /**
   * 19. GUÍA DE TRASLADO INTERNO ENTRE DEPÓSITOS
   */
  static generateInventoryTransferPDF(
    transfer: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'GUÍA DE TRASLADO INTERNO ENTRE DEPÓSITOS',
      subtitle: 'Comprobante de Movimiento de Mercancía entre Almacenes y Sucursales',
      periodText: `N° Traslado: ${transfer.transferNumber}  •  Estado: ${transfer.status}  •  Fecha: ${String(transfer.shippedAt || transfer.createdAt || '').slice(0, 16).replace('T', ' ')}`,
      userName,
      orientation: 'portrait',
      auditId: `TRS-${transfer.transferNumber || 'ALM'}`,
    });

    const originLines = [
      `Almacén de Origen: ${transfer.originWarehouseName || 'Almacén Central'}`,
      `Sucursal de Origen: ${transfer.originBranchName || 'Sede Principal'}`,
      `Despachado Por: ${transfer.shippedByUserName || userName}`,
      `Fecha de Despacho: ${transfer.shippedAt ? String(transfer.shippedAt).slice(0, 16).replace('T', ' ') : '-'}`,
    ];

    const destLines = [
      `Almacén de Destino: ${transfer.destinationWarehouseName || 'Sucursal Destino'}`,
      `Sucursal de Destino: ${transfer.destinationBranchName || 'Destino'}`,
      `Recibido Por: ${transfer.receivedByUserName || 'Pendiente por recepcionar'}`,
      `Motivo / Notas: ${transfer.notes || 'Reabastecimiento regular entre depósitos'}`,
    ];

    let currentY = this.drawTwoColumnInfoCards(
      doc,
      startY,
      { title: 'ORIGEN DEL TRASLADO', lines: originLines },
      { title: 'DESTINO DEL TRASLADO', lines: destLines },
      pageWidth
    );

    const headers = ['#', 'SKU', 'Descripción del Producto', 'Cant. Enviada', 'Cant. Recibida', 'Costo Unit. ($)', 'Costo Total ($)'];

    const items = transfer.items || [];
    const rows = items.map((it: any, idx: number) => [
      String(idx + 1),
      it.sku || it.productSku || '-',
      (it.productName || it.name || '').slice(0, 48),
      this.fmtQty(it.quantitySent || it.quantity),
      it.quantityReceived !== null && it.quantityReceived !== undefined ? this.fmtQty(it.quantityReceived) : '-',
      this.fmtUSD(it.unitCost),
      this.fmtUSD(Number(it.quantitySent || it.quantity || 0) * Number(it.unitCost || 0)),
    ]);

    const totalQty = items.reduce((acc: number, it: any) => acc + Number(it.quantitySent || it.quantity || 0), 0);
    const totalCost = Number(transfer.totalCost || 0);

    const footRow = [
      { content: 'TOTAL ARTÍCULOS TRASLADADOS:', colSpan: 3, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      this.fmtQty(totalQty),
      '-',
      '-',
      this.fmtUSD(totalCost),
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footRow],
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
      bodyStyles: { fontSize: 6.8, cellPadding: 1.6, textColor: this.COLOR_PRIMARY },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 24 },
        2: { halign: 'left', cellWidth: 64 },
        3: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    const signY = (doc as any).lastAutoTable.finalY + 12;

    this.drawSignatureBoxes(
      doc,
      signY,
      [
        { title: 'DESPACHADO POR (ORIGEN)', subtitle: 'Firma y Sello de Almacén' },
        { title: 'RECIBIDO POR (DESTINO)', subtitle: 'Firma y Sello de Recepción' },
      ],
      pageWidth
    );

    return this.finalize(doc);
  }

  /**
   * 20. REPORTE DE ACTUALIZACIÓN MASIVA DE PRECIOS
   */
  static generatePriceChangeReportPDF(
    batch: any,
    company: CompanyPdfInfo,
    userName: string
  ): Buffer {
    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: 'REPORTE DE MODIFICACIÓN MASIVA DE PRECIOS',
      subtitle: 'Auditoría de Actualización de Precios de Venta y Márgenes Comerciales',
      periodText: `Lote N°: ${batch.batchNumber || batch.id?.slice(0, 8)}  •  Fecha: ${String(batch.appliedAt || batch.createdAt || '').slice(0, 16).replace('T', ' ')}  •  Usuario: ${batch.createdBy || userName}`,
      userName,
      orientation: 'landscape',
      auditId: `PRC-${batch.batchNumber || 'LOTE'}`,
    });

    const cards: KpiCardItem[] = [
      {
        label: 'Productos Afectados',
        value: `${batch.affectedProductsCount || batch.items?.length || 0} ítems`,
        sub: 'Actualizados en el maestro',
      },
      {
        label: 'Modo de Cambio',
        value: (batch.mode || 'percentage').toUpperCase(),
        sub: `Valor aplicado: ${batch.modeValue || 0}`,
      },
      {
        label: 'Regla de Redondeo',
        value: (batch.roundingRule || 'none').toUpperCase(),
        sub: 'Ajuste decimal',
      },
      {
        label: 'Estado del Lote',
        value: batch.status || 'APPLIED',
        sub: batch.reason ? String(batch.reason).slice(0, 24) : 'Ejecutado con éxito',
      },
    ];

    const currentY = this.drawKpiCards(doc, startY, cards, pageWidth);

    const headers = [
      '#',
      'SKU',
      'Producto',
      'Costo ($)',
      'Precio Base Ant. ($)',
      'Precio Base Nvo. ($)',
      'Var. ($)',
      'Var. (%)',
      'Precio Final Ant. ($)',
      'Precio Final Nvo. ($)',
    ];

    const items = batch.items || [];
    const rows = items.map((it: any, idx: number) => [
      String(idx + 1),
      it.sku || '-',
      (it.name || it.productName || '').slice(0, 36),
      this.fmtUSD(it.costPrice),
      this.fmtUSD(it.oldBasePrice),
      this.fmtUSD(it.newBasePrice),
      this.fmtUSD(it.priceDifference),
      this.fmtPct(it.percentageChange),
      this.fmtUSD(it.oldFinalPrice),
      this.fmtUSD(it.newFinalPrice),
    ]);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 6.8, fontStyle: 'bold', halign: 'center', cellPadding: 1.8 },
      bodyStyles: { fontSize: 6.3, cellPadding: 1.4, textColor: this.COLOR_PRIMARY },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'left', cellWidth: 60 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 24 },
        5: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
        6: { halign: 'right', cellWidth: 18 },
        7: { halign: 'right', cellWidth: 16 },
        8: { halign: 'right', cellWidth: 25 },
        9: { halign: 'right', cellWidth: 25, fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    const signY = (doc as any).lastAutoTable.finalY + 10;

    this.drawSignatureBoxes(
      doc,
      signY,
      [
        { title: 'GERENCIA COMERCIAL', subtitle: 'Aprobación de Precios de Venta' },
        { title: 'ADMINISTRACIÓN Y COSTOS', subtitle: 'Validación de Márgenes de Rentabilidad' },
      ],
      pageWidth
    );

    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * 23. REPORTES MULTIPROPÓSITO DE CATÁLOGO DE PRODUCTOS E INVENTARIO
   */
  static generateProductsReportPDF(
    products: any[],
    company: CompanyPdfInfo,
    userName: string,
    options: {
      reportType?: 'catalog' | 'valuation' | 'low_stock' | 'locations';
      title?: string;
      subtitle?: string;
      departmentName?: string;
      groupName?: string;
      subgroupName?: string;
      warehouseName?: string;
      branchName?: string;
      statusText?: string;
    }
  ): Buffer {
    const reportType = options.reportType || 'catalog';
    let docTitle = 'CATÁLOGO GENERAL DE PRODUCTOS Y LISTA DE PRECIOS';
    let docSub = 'Lista Oficial de Precios, Códigos SKU y Clasificación Jerárquica';
    let orientation: 'portrait' | 'landscape' = 'portrait';

    if (reportType === 'valuation') {
      docTitle = 'INVENTARIO VALORIZADO Y CONTROL DE EXISTENCIAS';
      docSub = 'Valoración a Costo Promedio y Proyección de Ventas en Depósitos';
      orientation = 'landscape';
    } else if (reportType === 'low_stock') {
      docTitle = 'ALERTA DE INVENTARIO CRÍTICO / BAJO MÍNIMO';
      docSub = 'Productos con Existencias en o por debajo del Stock de Seguridad';
      orientation = 'landscape';
    } else if (reportType === 'locations') {
      docTitle = 'GUÍA DE UBICACIONES FÍSICAS EN DEPÓSITO';
      docSub = 'Mapeo Logístico de Almacenamiento (Pasillo, Estante y Compartimiento)';
      orientation = 'portrait';
    }

    if (options.title) docTitle = options.title;
    if (options.subtitle) docSub = options.subtitle;

    const filterParts = [
      options.branchName ? `Sucursal: ${options.branchName}` : null,
      options.warehouseName ? `Depósito: ${options.warehouseName}` : null,
      options.departmentName ? `Depto: ${options.departmentName}` : null,
      options.groupName ? `Grupo: ${options.groupName}` : null,
      options.statusText ? `Estado: ${options.statusText}` : null,
      `Fecha: ${new Date().toLocaleDateString('es-VE')}`,
    ].filter(Boolean);

    const periodText = filterParts.join('  •  ');

    const { doc, startY, pageWidth } = this.initDocument(company, {
      title: docTitle,
      subtitle: docSub,
      periodText,
      userName,
      orientation,
      branchName: options.branchName,
      auditId: `REP-PRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    });

    let currentY = startY;

    if (reportType === 'catalog') {
      const totalItems = products.length;
      const activeItems = products.filter((p) => p.isActive !== false).length;
      const avgCost = totalItems > 0 ? products.reduce((acc, p) => acc + Number(p.costPrice || 0), 0) / totalItems : 0;
      const avgPrice = totalItems > 0 ? products.reduce((acc, p) => acc + Number(p.finalPrice || p.basePrice || 0), 0) / totalItems : 0;

      currentY = this.drawKpiCards(
        doc,
        currentY,
        [
          { label: 'Total Productos', value: String(totalItems) },
          { label: 'Productos Activos', value: `${activeItems} (${totalItems > 0 ? Math.round((activeItems / totalItems) * 100) : 0}%)` },
          { label: 'Costo Promedio', value: this.fmtUSD(avgCost) },
          { label: 'PVP Promedio', value: this.fmtUSD(avgPrice) },
        ],
        pageWidth
      );

      const headers = ['#', 'SKU', 'Cód. Barras', 'Descripción del Producto', 'Departamento / Grupo', 'U.M.', 'Costo ($)', 'Base ($)', 'IVA', 'PVP ($)'];
      const rows = products.map((p, idx) => {
        const hier = [p.departmentName, p.groupName].filter(Boolean).join(' › ');
        const taxRate = Number(p.taxRate || 0);
        const taxLabel = taxRate === 0 ? 'Exento' : `${taxRate}%`;
        return [
          String(idx + 1),
          p.sku || '-',
          p.barcode || '-',
          (p.name || '').slice(0, 42),
          hier.slice(0, 28) || '-',
          p.unitOfMeasure || 'UND',
          this.fmtUSD(p.costPrice),
          this.fmtUSD(p.basePrice),
          taxLabel,
          this.fmtUSD(p.finalPrice || p.basePrice),
        ];
      });

      const footRow = [
        { content: `TOTAL PRODUCTOS REGISTRADOS:  ${totalItems} ÍTEMS`, colSpan: 10, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7 } },
      ];

      autoTable(doc, {
        head: [headers],
        body: rows,
        foot: [footRow],
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 6.8, fontStyle: 'bold', halign: 'center', cellPadding: 1.8 },
        bodyStyles: { fontSize: 6.3, cellPadding: 1.3, textColor: this.COLOR_PRIMARY },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'left', cellWidth: 46 },
          4: { halign: 'left', cellWidth: 30 },
          5: { halign: 'center', cellWidth: 10 },
          6: { halign: 'right', cellWidth: 14 },
          7: { halign: 'right', cellWidth: 14 },
          8: { halign: 'center', cellWidth: 10 },
          9: { halign: 'right', cellWidth: 14, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });
    } else if (reportType === 'valuation') {
      const totalItems = products.length;
      const totalStock = products.reduce((acc, p) => acc + Number(p.currentStock || 0), 0);
      const totalCostVal = products.reduce((acc, p) => acc + (Number(p.currentStock || 0) * Number(p.costPrice || 0)), 0);
      const totalRetailVal = products.reduce((acc, p) => acc + (Number(p.currentStock || 0) * Number(p.finalPrice || p.basePrice || 0)), 0);

      currentY = this.drawKpiCards(
        doc,
        currentY,
        [
          { label: 'Total Ítems', value: String(totalItems) },
          { label: 'Existencias Totales', value: `${this.fmtQty(totalStock)} UND` },
          { label: 'Inversión Total Costo', value: this.fmtUSD(totalCostVal) },
          { label: 'Valoración a PVP Venta', value: this.fmtUSD(totalRetailVal) },
        ],
        pageWidth
      );

      const headers = ['#', 'SKU', 'Descripción del Producto', 'Departamento', 'Stock Actual', 'U.M.', 'Costo Unit ($)', 'Total Costo ($)', 'PVP Unit ($)', 'Total PVP ($)'];
      const rows = products.map((p, idx) => {
        const stock = Number(p.currentStock || 0);
        const cost = Number(p.costPrice || 0);
        const pvp = Number(p.finalPrice || p.basePrice || 0);
        return [
          String(idx + 1),
          p.sku || '-',
          (p.name || '').slice(0, 48),
          (p.departmentName || 'General').slice(0, 24),
          this.fmtQty(stock),
          p.unitOfMeasure || 'UND',
          this.fmtUSD(cost),
          this.fmtUSD(stock * cost),
          this.fmtUSD(pvp),
          this.fmtUSD(stock * pvp),
        ];
      });

      const footRow = [
        { content: 'TOTALES VALORIZADOS:', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7 } },
        { content: `${this.fmtQty(totalStock)} UND`, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7 } },
        { content: '', styles: { halign: 'center' as const } },
        { content: '', styles: { halign: 'right' as const } },
        { content: this.fmtUSD(totalCostVal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7 } },
        { content: '', styles: { halign: 'right' as const } },
        { content: this.fmtUSD(totalRetailVal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7 } },
      ];

      autoTable(doc, {
        head: [headers],
        body: rows,
        foot: [footRow],
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 6.8, fontStyle: 'bold', halign: 'center', cellPadding: 1.8 },
        bodyStyles: { fontSize: 6.3, cellPadding: 1.3, textColor: this.COLOR_PRIMARY },
        footStyles: { fillColor: this.COLOR_TOTALS, textColor: this.COLOR_PRIMARY, fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.8 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 26 },
          2: { halign: 'left', cellWidth: 70 },
          3: { halign: 'left', cellWidth: 35 },
          4: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
          5: { halign: 'center', cellWidth: 14 },
          6: { halign: 'right', cellWidth: 22 },
          7: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
          8: { halign: 'right', cellWidth: 22 },
          9: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });
    } else if (reportType === 'low_stock') {
      const lowItems = products.filter((p) => Number(p.currentStock || 0) <= Number(p.minStock || 0));
      const totalDeficit = lowItems.reduce((acc, p) => acc + Math.max(0, Number(p.maxStock || (p.minStock * 2) || 10) - Number(p.currentStock || 0)), 0);
      const estInvestment = lowItems.reduce((acc, p) => {
        const def = Math.max(0, Number(p.maxStock || (p.minStock * 2) || 10) - Number(p.currentStock || 0));
        return acc + (def * Number(p.costPrice || 0));
      }, 0);

      currentY = this.drawKpiCards(
        doc,
        currentY,
        [
          { label: 'Productos Críticos', value: `${lowItems.length} ÍTEMS` },
          { label: 'Déficit Estimado', value: `${this.fmtQty(totalDeficit)} UND` },
          { label: 'Inversión Reposición Est.', value: this.fmtUSD(estInvestment) },
          { label: 'Depósito Analizado', value: options.warehouseName || 'Todos' },
        ],
        pageWidth
      );

      const headers = ['#', 'SKU', 'Descripción del Producto', 'Departamento', 'Stock Actual', 'Mínimo', 'Máximo', 'Déficit Sugerido', 'Costo Unit. ($)', 'Inversión Est. ($)'];
      const rows = lowItems.map((p, idx) => {
        const stock = Number(p.currentStock || 0);
        const min = Number(p.minStock || 0);
        const max = Number(p.maxStock || (min * 2) || 10);
        const deficit = Math.max(0, max - stock);
        const cost = Number(p.costPrice || 0);
        return [
          String(idx + 1),
          p.sku || '-',
          (p.name || '').slice(0, 48),
          (p.departmentName || 'General').slice(0, 24),
          this.fmtQty(stock),
          this.fmtQty(min),
          this.fmtQty(max),
          this.fmtQty(deficit),
          this.fmtUSD(cost),
          this.fmtUSD(deficit * cost),
        ];
      });

      const footRow = [
        { content: `TOTAL PRODUCTOS EN ALERTA: ${lowItems.length}`, colSpan: 7, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7 } },
        { content: `${this.fmtQty(totalDeficit)} UND`, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7 } },
        { content: '', styles: { halign: 'right' as const } },
        { content: this.fmtUSD(estInvestment), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: 7 } },
      ];

      autoTable(doc, {
        head: [headers],
        body: rows,
        foot: [footRow],
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 6.8, fontStyle: 'bold', halign: 'center', cellPadding: 1.8 },
        bodyStyles: { fontSize: 6.3, cellPadding: 1.3, textColor: this.COLOR_PRIMARY },
        footStyles: { fillColor: this.COLOR_TOTALS, textColor: this.COLOR_PRIMARY, fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.8 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 26 },
          2: { halign: 'left', cellWidth: 70 },
          3: { halign: 'left', cellWidth: 35 },
          4: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
          5: { halign: 'right', cellWidth: 18 },
          6: { halign: 'right', cellWidth: 18 },
          7: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
          8: { halign: 'right', cellWidth: 22 },
          9: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });
    } else if (reportType === 'locations') {
      const totalItems = products.length;
      const withLoc = products.filter((p) => p.aisle || p.shelf || p.compartment).length;
      const withoutLoc = totalItems - withLoc;

      currentY = this.drawKpiCards(
        doc,
        currentY,
        [
          { label: 'Total Productos', value: String(totalItems) },
          { label: 'Con Ubicación Asignada', value: `${withLoc} (${totalItems > 0 ? Math.round((withLoc / totalItems) * 100) : 0}%)` },
          { label: 'Sin Ubicación Física', value: String(withoutLoc) },
          { label: 'Depósito Filtro', value: options.warehouseName || 'Todos' },
        ],
        pageWidth
      );

      const headers = ['#', 'SKU', 'Descripción del Producto', 'Departamento', 'Depósito', 'Pasillo', 'Estante', 'Gaveta / Nivel', 'Stock Actual'];
      const rows = products.map((p, idx) => [
        String(idx + 1),
        p.sku || '-',
        (p.name || '').slice(0, 44),
        (p.departmentName || '-').slice(0, 20),
        (p.locationWarehouseName || options.warehouseName || 'Principal').slice(0, 20),
        p.aisle || 'N/A',
        p.shelf || 'N/A',
        p.compartment || 'N/A',
        `${this.fmtQty(p.currentStock)} ${p.unitOfMeasure || 'UND'}`,
      ]);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: this.COLOR_HEADER, textColor: 255, fontSize: 6.8, fontStyle: 'bold', halign: 'center', cellPadding: 1.8 },
        bodyStyles: { fontSize: 6.3, cellPadding: 1.3, textColor: this.COLOR_PRIMARY },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { halign: 'center', cellWidth: 22 },
          2: { halign: 'left', cellWidth: 50 },
          3: { halign: 'left', cellWidth: 24 },
          4: { halign: 'left', cellWidth: 24 },
          5: { halign: 'center', cellWidth: 16 },
          6: { halign: 'center', cellWidth: 16 },
          7: { halign: 'center', cellWidth: 16 },
          8: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 12 },
      });
    }

    return this.finalize(doc);
  }

  // ==========================================
  // UTILIDADES DE FORMATEO NUMÉRICO
  // ==========================================
  static fmtUSD(val: number | string | null | undefined): string {
    const raw = Number(val || 0);
    const num = isNaN(raw) ? 0 : raw;
    return `$ ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  static fmtVES(val: number | string | null | undefined): string {
    const raw = Number(val || 0);
    const num = isNaN(raw) ? 0 : raw;
    return `Bs. ${num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  static fmtQty(val: number | string | null | undefined): string {
    const raw = Number(val || 0);
    const num = isNaN(raw) ? 0 : raw;
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  static fmtPct(val: number | string | null | undefined): string {
    const raw = Number(val || 0);
    const num = isNaN(raw) ? 0 : raw;
    return `${num.toFixed(1)}%`;
  }
}

// ==========================================
// EXPORTACIONES STANDALONE DE GENERADORES PDF
// ==========================================

export async function generateWithholdingVoucherPDF(data: {
  company: CompanyPdfInfo;
  voucher: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateWithholdingVoucherPDF(data.voucher, data.company, data.userName || 'Sistema ERO');
}

export async function generatePurchasesBookReportPDF(data: {
  company: CompanyPdfInfo;
  book: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generatePurchasesBookReportPDF(data.book, data.company, data.userName || 'Auditor Fiscal', { period: data.book?.period });
}

export async function generateSalesBookReportPDF(data: {
  company: CompanyPdfInfo;
  book: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateSalesBookReportPDF(data.book, data.company, data.userName || 'Auditor Fiscal', { period: data.book?.period });
}

export async function generateARCVReportPDF(data: {
  company: CompanyPdfInfo;
  arcv: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateARCVReportPDF(data.arcv, data.company, data.userName || 'Auditor Fiscal', {
    year: data.arcv?.year || new Date().getFullYear(),
    supplierName: data.arcv?.supplierName,
  });
}

export async function generateCashShiftVoucherPDF(data: {
  company: CompanyPdfInfo;
  shift: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateCashShiftVoucherPDF(data.shift, data.company, data.userName || data.shift?.cashierName || 'Cajero');
}

export async function generateQuotationPDF(data: {
  company: CompanyPdfInfo;
  quotation: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateQuotationPDF(data.quotation, data.company, data.userName || 'Asesor Comercial');
}

export async function generateDeliveryNotePDF(data: {
  company: CompanyPdfInfo;
  delivery: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateDeliveryNotePDF(data.delivery, data.company, data.userName || 'Despachador');
}

export async function generateCollectionReceiptPDF(data: {
  company: CompanyPdfInfo;
  collection: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateCollectionReceiptPDF(data.collection, data.company, data.userName || 'Cajero / Cobrador');
}

export async function generatePurchaseOrderPDF(data: {
  company: CompanyPdfInfo;
  order: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generatePurchaseOrderPDF(data.order, data.company, data.userName || 'Gerencia de Compras');
}

export async function generateGoodsReceiptPDF(data: {
  company: CompanyPdfInfo;
  receipt: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateGoodsReceiptPDF(data.receipt, data.company, data.userName || 'Recepción Almacén');
}

export async function generatePayablePaymentReceiptPDF(data: {
  company: CompanyPdfInfo;
  payment: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generatePayablePaymentReceiptPDF(data.payment, data.company, data.userName || 'Tesorería');
}

export async function generateKardexReportPDF(data: {
  company: CompanyPdfInfo;
  filter: {
    startDate?: string;
    endDate?: string;
    warehouseName?: string;
    branchName?: string;
    productName?: string;
    movementType?: string;
  };
  movements: any[];
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateKardexReportPDF(
    { movements: data.movements },
    data.company,
    data.userName || 'Auditor de Inventarios',
    data.filter
  );
}

export async function generateInventoryAdjustmentPDF(data: {
  company: CompanyPdfInfo;
  adjustment: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateInventoryAdjustmentPDF(data.adjustment, data.company, data.userName || data.adjustment?.userName || 'Auditor');
}

export async function generateInventoryTransferPDF(data: {
  company: CompanyPdfInfo;
  transfer: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateInventoryTransferPDF(data.transfer, data.company, data.userName || data.transfer?.shippedByUserName || 'Almacén');
}

export async function generatePriceChangeReportPDF(data: {
  company: CompanyPdfInfo;
  batch: any;
  userName?: string;
}): Promise<Buffer> {
  return ReportsPdfEngine.generatePriceChangeReportPDF(data.batch, data.company, data.userName || data.batch?.userName || 'Gerencia');
}

export async function generateProductsReportPDF(data: {
  company: CompanyPdfInfo;
  products: any[];
  userName?: string;
  options?: any;
}): Promise<Buffer> {
  return ReportsPdfEngine.generateProductsReportPDF(data.products, data.company, data.userName || 'Gerencia de Inventario', data.options || {});
}

