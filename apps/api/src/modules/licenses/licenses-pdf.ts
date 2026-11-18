import { jsPDF } from 'jspdf';
import autoTableImport from 'jspdf-autotable';
import { ERO_SYSTEM_LOGO_WEBP } from '../reports/reports-pdf';
import { LicenseInfo, LicenseCostBreakdown, formatMoneyUSD } from '@ero/shared';

const autoTable = (typeof autoTableImport === 'function'
  ? autoTableImport
  : (autoTableImport as any).default || autoTableImport) as typeof autoTableImport;

export class LicensesPdfEngine {
  private static readonly COLOR_PRIMARY = [15, 23, 42] as [number, number, number]; // Slate-900
  private static readonly COLOR_HEADER = [30, 41, 59] as [number, number, number]; // Slate-800
  private static readonly COLOR_ACCENT = [0, 123, 255] as [number, number, number]; // Primary Blue
  private static readonly COLOR_MUTED = [100, 116, 139] as [number, number, number]; // Slate-500
  private static readonly COLOR_BORDER = [226, 232, 240] as [number, number, number]; // Slate-200
  private static readonly COLOR_BG_LIGHT = [248, 250, 252] as [number, number, number]; // Slate-50
  private static readonly COLOR_SUCCESS = [22, 163, 74] as [number, number, number]; // Green-600

  private static readonly MODULE_NAMES: Record<string, string> = {
    dashboards: 'Dashboards Dinámicos & Métricas',
    pos: 'Punto de Venta (POS) & Cajas',
    inventory: 'Inventario, Almacenes & Kardex',
    pricing: 'Precios, Tarifas & Monedas',
    sales: 'Ventas, Facturación & Cotizaciones',
    customers: 'Directorio Central de Clientes',
    receivables: 'Cuentas por Cobrar & Cobranzas',
    purchases: 'Compras, Recepción & Abastecimiento',
    suppliers: 'Directorio Central de Proveedores',
    payables: 'Cuentas por Pagar & Pagos',
    treasury: 'Tesorería, Cajas & Bancos',
    taxes: 'Tributos SENIAT (IVA, IGTF, ISLR)',
    reports: 'Reportes Gerenciales & Fiscales',
    restaurant: 'Restaurante, Mesas & Comandas (KDS)',
    accounting: 'Contabilidad Senior (NIIF / VEN-NIF)',
    config: 'Configuración Central & Parámetros',
    audit: 'Auditoría Integral & Logs de Sistema',
  };

  /**
   * Genera el Certificado Oficial de Licencia en PDF
   */
  static generateLicenseCertificatePDF(
    license: LicenseInfo,
    costBreakdown?: LicenseCostBreakdown | null,
    licensePackageRaw?: string
  ): Buffer {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let y = 14;

    // 1. Marco exterior ornamental elegante
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.setLineWidth(0.6);
    doc.roundedRect(margin - 4, margin - 4, pageWidth - (margin * 2) + 8, pageHeight - (margin * 2) + 8, 3, 3);
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.2);
    doc.roundedRect(margin - 2.5, margin - 2.5, pageWidth - (margin * 2) + 5, pageHeight - (margin * 2) + 5, 2, 2);

    // 2. Encabezado con Logotipo Oficial
    try {
      doc.addImage(ERO_SYSTEM_LOGO_WEBP, 'WEBP', margin, y, 28, 14);
    } catch {
      doc.setFillColor(...this.COLOR_ACCENT);
      doc.roundedRect(margin, y, 28, 14, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('ERO ERP', margin + 6, y + 9);
    }

    doc.setTextColor(...this.COLOR_PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('CERTIFICADO OFICIAL DE LICENCIA', margin + 32, y + 6);

    doc.setTextColor(...this.COLOR_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('ERO Enterprise Resource Planning Software - Sistema de Gestión Comercial y Fiscal', margin + 32, y + 11);

    const issueDateStr = new Date().toLocaleDateString('es-VE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.setFontSize(7.5);
    doc.text(`Emisión: ${issueDateStr}`, pageWidth - margin - 4, y + 6, { align: 'right' });
    doc.text(`Certificado Nº: LIC-${license.id.slice(0, 8).toUpperCase()}`, pageWidth - margin - 4, y + 11, { align: 'right' });

    y += 18;

    // Línea separadora decorativa con acento azul
    doc.setDrawColor(...this.COLOR_ACCENT);
    doc.setLineWidth(1.2);
    doc.line(margin, y, margin + 45, y);
    doc.setDrawColor(...this.COLOR_BORDER);
    doc.setLineWidth(0.4);
    doc.line(margin + 45, y, pageWidth - margin, y);

    y += 5;

    // 3. Ficha de Licencia y Hardware Autorizado (Caja destacada)
    const cardWidth = pageWidth - (margin * 2);
    const cardHeight = 38;
    doc.setFillColor(...this.COLOR_BG_LIGHT);
    doc.setDrawColor(...this.COLOR_BORDER);
    doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, 'FD');

    const colWidth = (cardWidth - 4) / 2;

    // Columna Izquierda: Datos del Licenciatario
    doc.setTextColor(...this.COLOR_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('EMPRESA TITULAR (LICENCIATARIO):', margin + 4, y + 4.8);

    doc.setTextColor(...this.COLOR_PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(license.companyName || 'EMPRESA TITULAR REGISTRADA', margin + 4, y + 9.5, { maxWidth: colWidth - 6 });

    doc.setTextColor(...this.COLOR_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Identificación Fiscal (RIF / Cédula): ${license.companyRif || 'N/A'}`, margin + 4, y + 14.5);

    const statusText = license.isActive ? 'ACTIVA Y AUTORIZADA' : 'INACTIVA';
    doc.text(`Estado de Activación: ${statusText}`, margin + 4, y + 19);

    // Columna Derecha: Clave Oficial y Modalidad
    const rightColX = margin + colWidth + 4;
    doc.setTextColor(...this.COLOR_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('CLAVE OFICIAL DE ACTIVACIÓN:', rightColX, y + 4.8);

    // Badge con la Clave de Licencia
    doc.setFillColor(238, 242, 255); // Indigo-50
    doc.setDrawColor(199, 210, 254); // Indigo-200
    doc.roundedRect(rightColX, y + 6.8, colWidth - 8, 7.5, 1.5, 1.5, 'FD');

    doc.setTextColor(...this.COLOR_ACCENT);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.2);
    doc.text(license.licenseKey, rightColX + (colWidth - 8) / 2, y + 11.8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...this.COLOR_PRIMARY);

    const typeLabel =
      license.type === 'perpetua'
        ? 'Perpetua Enterprise (Sin Expiración)'
        : license.type === 'temporal'
          ? 'Suscripción Temporal / Anual'
          : 'Demostración / Evaluación (Trial 30 días)';

    doc.text(`Modalidad: ${typeLabel}`, rightColX, y + 18.2, { maxWidth: colWidth - 8 });

    const expiresText = license.expiresAt
      ? new Date(license.expiresAt).toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Permanente / Sin Vencimiento';
    doc.text(`Vigencia hasta: ${expiresText}`, rightColX, y + 22.2, { maxWidth: colWidth - 8 });

    // Franja Inferior a Ancho Completo: Hardware Fingerprint (ID Servidor Autorizado)
    const stripY = y + 25.5;
    doc.setFillColor(243, 244, 246); // Gray-100
    doc.setDrawColor(229, 231, 235); // Gray-200
    doc.roundedRect(margin + 2.5, stripY, cardWidth - 5, 10, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...this.COLOR_MUTED);
    doc.text('HARDWARE FINGERPRINT (ID SERVIDOR AUTORIZADO):', margin + 4.5, stripY + 3.8);

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...this.COLOR_PRIMARY);
    doc.text(license.hardwareFingerprint || 'N/A (No restringido por hardware)', margin + 4.5, stripY + 7.6, {
      maxWidth: cardWidth - 9,
    });

    y += 42;

    // 4. Parámetros y Capacidades Operativas Autorizadas
    doc.setTextColor(...this.COLOR_PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('CAPACIDAD OPERATIVA AUTORIZADA', margin, y);
    y += 3;

    const usersText = license.maxUsers > 0 ? `${license.maxUsers} usuario(s) concurrentes` : 'Ilimitado (Licencia Enterprise)';
    const branchesText = license.maxBranches > 0 ? `${license.maxBranches} sucursal(es) activas` : 'Ilimitadas (Multi-Sede)';
    const supportText = license.hasSupport ? 'Soporte Técnico y Actualizaciones Incluido' : 'Soporte Estándar';

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Parámetro Operativo', 'Límite Contratado', 'Estado / Condición']],
      body: [
        ['Límite de Usuarios en Sistema', usersText, 'Autorizado'],
        ['Límite de Sedes / Sucursales', branchesText, 'Autorizado'],
        ['Póliza de Soporte & Mantenimiento', supportText, license.hasSupport ? 'Activo' : 'No Contratado'],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 2,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: this.COLOR_PRIMARY,
      },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: 'bold' },
        1: { cellWidth: 70 },
        2: { cellWidth: 'auto', halign: 'center' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // 5. Matriz de Módulos Autorizados
    doc.setTextColor(...this.COLOR_PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('MATRIZ DE MÓDULOS DE SOFTWARE HABILITADOS', margin, y);
    y += 3;

    const allModuleKeys = Object.keys(this.MODULE_NAMES);
    const half = Math.ceil(allModuleKeys.length / 2);
    const leftKeys = allModuleKeys.slice(0, half);
    const rightKeys = allModuleKeys.slice(half);

    const modulesTableData: any[] = [];
    const maxRows = Math.max(leftKeys.length, rightKeys.length);
    const allowedList = Array.isArray(license.modulesAllowed)
      ? license.modulesAllowed
      : typeof (license as any).modulesAllowed === 'string'
        ? [(license as any).modulesAllowed]
        : ['*'];

    for (let i = 0; i < maxRows; i++) {
      const leftKey = leftKeys[i];
      const rightKey = rightKeys[i];

      const leftAllowed = leftKey
        ? allowedList.includes('*') || allowedList.includes(leftKey)
        : null;
      const rightAllowed = rightKey
        ? allowedList.includes('*') || allowedList.includes(rightKey)
        : null;

      modulesTableData.push([
        leftKey ? this.MODULE_NAMES[leftKey] : '',
        leftAllowed !== null ? (leftAllowed ? 'HABILITADO' : 'No Contratado') : '',
        rightKey ? this.MODULE_NAMES[rightKey] : '',
        rightAllowed !== null ? (rightAllowed ? 'HABILITADO' : 'No Contratado') : '',
      ]);
    }

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Módulo del Sistema (Col. 1)', 'Estado', 'Módulo del Sistema (Col. 2)', 'Estado']],
      body: modulesTableData,
      theme: 'grid',
      headStyles: {
        fillColor: this.COLOR_HEADER,
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: 'bold',
        cellPadding: 1.8,
      },
      styles: {
        fontSize: 6.8,
        cellPadding: 1.5,
        textColor: this.COLOR_PRIMARY,
      },
      columnStyles: {
        0: { cellWidth: 62 },
        1: { cellWidth: 32, halign: 'center' },
        2: { cellWidth: 62 },
        3: { cellWidth: 32, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && (data.column.index === 1 || data.column.index === 3)) {
          if (data.cell.raw && String(data.cell.raw).includes('HABILITADO')) {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw && String(data.cell.raw).includes('No Contratado')) {
            data.cell.styles.textColor = [156, 163, 175];
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // 6. Estructura Comercial & Desglose de Costo Asociado
    if (costBreakdown && costBreakdown.items && costBreakdown.items.length > 0) {
      doc.setTextColor(...this.COLOR_PRIMARY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('ESTRUCTURA COMERCIAL & VALOR DE LICENCIA', margin, y);
      y += 3;

      const costRows = costBreakdown.items.map((item) => [
        item.concept,
        item.quantity ? String(item.quantity) : '-',
        item.unitPrice !== undefined ? formatMoneyUSD(item.unitPrice) : '-',
        formatMoneyUSD(item.subtotal),
      ]);

      if (costBreakdown.discount > 0) {
        costRows.push([
          'Descuento / Bonificación Comercial Especial',
          '-',
          '-',
          `-${formatMoneyUSD(costBreakdown.discount)}`,
        ]);
      }

      costRows.push([
        'TOTAL INVERSIÓN DE LICENCIAMIENTO:',
        '-',
        '-',
        formatMoneyUSD(costBreakdown.totalCost),
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Concepto / Componente', 'Cant.', 'Precio Ref. ($)', 'Monto ($ USD)']],
        body: costRows,
        theme: 'grid',
        headStyles: {
          fillColor: this.COLOR_HEADER,
          textColor: [255, 255, 255],
          fontSize: 7,
          fontStyle: 'bold',
          cellPadding: 1.8,
        },
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          textColor: this.COLOR_PRIMARY,
        },
        columnStyles: {
          0: { cellWidth: 105 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 33, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === costRows.length - 1) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [0, 123, 255];
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // 7. Cláusula de Validez Legal & Seguridad Criptográfica
    if (y + 36 > pageHeight - margin) {
      doc.addPage();
      y = margin + 4;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 16, 1.5, 1.5, 'FD');

    doc.setTextColor(...this.COLOR_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    const disclaimer =
      'AVISO LEGAL DE SEGURIDAD CRIPTOGRÁFICA: Este certificado valida el uso legal y exclusivo del software ERO ERP en el servidor anfitrión con ' +
      `Hardware Fingerprint ${license.hardwareFingerprint}. La licencia está vinculada a la Razón Social y RIF del cliente y se encuentra cifrada bajo ` +
      'el estándar militar AES-256-GCM con verificación de integridad HMAC-SHA256. Prohibida su duplicación o transferencia no autorizada.';
    doc.text(doc.splitTextToSize(disclaimer, pageWidth - (margin * 2) - 6), margin + 3, y + 4.5);

    y += 21;

    // 8. Firmas de Certificación
    if (y + 24 > pageHeight - margin) {
      doc.addPage();
      y = margin + 4;
    }

    const signWidth = 65;
    const sign1X = margin + 15;
    const sign2X = pageWidth - margin - signWidth - 15;

    doc.setDrawColor(148, 163, 184); // Slate-400
    doc.setLineWidth(0.4);
    doc.line(sign1X, y + 12, sign1X + signWidth, y + 12);
    doc.line(sign2X, y + 12, sign2X + signWidth, y + 12);

    doc.setTextColor(...this.COLOR_PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('SUPERINTENDENCIA DE LICENCIAS', sign1X + signWidth / 2, y + 16, { align: 'center' });
    doc.text('CONFORME CLIENTE / LICENCIATARIO', sign2X + signWidth / 2, y + 16, { align: 'center' });

    doc.setTextColor(...this.COLOR_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('ERO ERP Global Software Systems', sign1X + signWidth / 2, y + 19.5, { align: 'center' });
    doc.text(license.companyName ? license.companyName.slice(0, 35) : 'Firma y Sello Autorizado', sign2X + signWidth / 2, y + 19.5, { align: 'center' });

    // Pie de página con numeración
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `ERO ERP - Certificado de Licencia Oficial | Página ${p} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      );
    }

    return Buffer.from(doc.output('arraybuffer'));
  }
}
