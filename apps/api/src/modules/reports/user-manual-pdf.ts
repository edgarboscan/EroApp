import autoTableImport from 'jspdf-autotable';
import {
  USER_GUIDES,
  BADGE_DICTIONARY,
  BUSINESS_RULES_EXPLANATION,
  ACCOUNTING_SUBMODULES,
  ACCOUNTING_MAPPINGS_DOC,
  ACCOUNTING_CIRCUITS_DOC,
} from '@ero/shared';
import { ReportsPdfEngine, CompanyPdfInfo } from './reports-pdf';

const autoTable = (typeof autoTableImport === 'function'
  ? autoTableImport
  : (autoTableImport as any).default || autoTableImport) as typeof autoTableImport;

/**
 * Genera el PDF oficial del Manual Completo de Usuario de ERO ERP VE
 */
export function generateUserManualPDF(company: CompanyPdfInfo, userName: string): Buffer {
  const { doc, startY, pageWidth, pageHeight } = ReportsPdfEngine.initDocument(company, {
    title: 'MANUAL OFICIAL DE USUARIO Y PROCEDIMIENTOS OPERATIVOS',
    subtitle: 'Guía Integral por Módulos, Glosario de Banderas, Reglas de Negocio y Contabilidad VEN-NIF',
    userName,
    orientation: 'portrait',
  });

  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let y = startY + 2;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 16) {
      doc.addPage();
      y = 16;
    }
  };

  const drawSectionHeader = (num: string, title: string, subtitle?: string) => {
    ensureSpace(16);
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(marginX, y, contentWidth, 8.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`${num}. ${title.toUpperCase()}`, marginX + 3, y + 5.7);
    y += 10.5;
    if (subtitle) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(subtitle, contentWidth);
      doc.text(lines, marginX, y);
      y += lines.length * 3.8 + 2;
    }
  };

  // Tabla de contenido introductoria
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, y, contentWidth, 24, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CONTENIDO DEL MANUAL DE USUARIO', marginX + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  doc.text('1. Guía Operativa por Módulos y Procesos (Propósito, Uso y Flujo Paso a Paso)', marginX + 4, y + 10);
  doc.text('2. Glosario Oficial de Banderas y Estados del Sistema (EN -> ES)', marginX + 4, y + 14);
  doc.text('3. Reglas de Negocio, Marco Legal SENIAT / BCV y Control Interno', marginX + 4, y + 18);
  doc.text('4. Manual Detallado del Módulo Contable VEN-NIF, Circuitos y Matriz de Mapeos', marginX + 4, y + 22);
  y += 29;

  // =========================================================================
  // SECCIÓN 1: GUÍA OPERATIVA POR MÓDULOS Y PROCESOS
  // =========================================================================
  drawSectionHeader(
    '1',
    'Guía Operativa por Módulos y Procesos',
    'Explicación detallada de para qué sirve cada módulo, su objetivo operativo y los pasos exactos de trabajo.'
  );

  USER_GUIDES.forEach((guide, idx) => {
    ensureSpace(24);
    // Encabezado del procedimiento
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(marginX, y, contentWidth, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(2, 132, 199);
    doc.text(`1.${idx + 1} ${guide.title}`, marginX + 2.5, y + 4.7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(guide.category.toUpperCase(), pageWidth - marginX - 2.5, y + 4.7, { align: 'right' });
    y += 9.5;

    // Para qué sirve
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(15, 23, 42);
    const purposeLines = doc.splitTextToSize(`¿Para qué sirve?: ${guide.purpose}`, contentWidth - 2);
    ensureSpace(purposeLines.length * 3.8 + 4);
    doc.text(purposeLines, marginX + 1, y);
    y += purposeLines.length * 3.8 + 1.5;

    // Resumen
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const summaryLines = doc.splitTextToSize(guide.summary, contentWidth - 2);
    ensureSpace(summaryLines.length * 3.6 + 3);
    doc.text(summaryLines, marginX + 1, y);
    y += summaryLines.length * 3.6 + 2;

    // Pasos
    guide.steps.forEach((step) => {
      const stepText = `${step.title}: ${step.description}`;
      const stepLines = doc.splitTextToSize(stepText, contentWidth - 6);
      ensureSpace(stepLines.length * 3.6 + (step.tip ? 8 : 3));

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor(30, 41, 59);
      doc.text('•', marginX + 2, y);
      doc.setFont('helvetica', 'normal');
      doc.text(stepLines, marginX + 5, y);
      y += stepLines.length * 3.6 + 1;

      if (step.tip) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.1);
        doc.setTextColor(4, 120, 87);
        const tipLines = doc.splitTextToSize(`Nota: ${step.tip}`, contentWidth - 10);
        ensureSpace(tipLines.length * 3.4 + 2);
        doc.text(tipLines, marginX + 7, y);
        y += tipLines.length * 3.4 + 1.5;
      }
    });

    // Reglas
    if (guide.rules && guide.rules.length > 0) {
      guide.rules.forEach((rule) => {
        const rLines = doc.splitTextToSize(`Regla: ${rule}`, contentWidth - 8);
        ensureSpace(rLines.length * 3.4 + 2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.1);
        doc.setTextColor(180, 83, 9);
        doc.text(rLines, marginX + 5, y);
        y += rLines.length * 3.4 + 1;
      });
    }
    y += 3;
  });

  // =========================================================================
  // SECCIÓN 2: GLOSARIO DE BANDERAS Y ESTADOS
  // =========================================================================
  doc.addPage();
  y = 16;
  drawSectionHeader(
    '2',
    'Glosario de Banderas y Estados del Sistema',
    'Referencia rápida de todas las etiquetas de estado mostradas en tablas, documentos, auditoría y contabilidad.'
  );

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Bandera', 'Equivalente en Español', 'Categoría', 'Significado y Alcance', 'Dónde Aparece']],
    body: BADGE_DICTIONARY.map((b) => [b.term, b.spanish, b.category, b.meaning, b.usageContext]),
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28, textColor: [2, 132, 199] },
      1: { fontStyle: 'bold', cellWidth: 32 },
      2: { cellWidth: 26 },
      3: { cellWidth: 58 },
      4: { cellWidth: 38 },
    },
  });

  // =========================================================================
  // SECCIÓN 3: REGLAS DE NEGOCIO Y MARCO LEGAL
  // =========================================================================
  doc.addPage();
  y = 16;
  drawSectionHeader(
    '3',
    'Reglas de Negocio y Marco Legal (SENIAT / BCV)',
    'Normas automáticas de control interno, cálculo tributario y protección contable implementadas en el sistema.'
  );

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Regla / Política', 'Marco Legal', 'Descripción Operativa', 'Configuración e Impacto']],
    body: BUSINESS_RULES_EXPLANATION.map((r) => [
      r.name,
      r.legalContext,
      r.description,
      `Config: ${r.configurationGuide}\nAuditoría: ${r.auditImpact}`,
    ]),
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38 },
      1: { cellWidth: 36, textColor: [71, 85, 105] },
      2: { cellWidth: 58 },
      3: { cellWidth: 50 },
    },
  });

  // =========================================================================
  // SECCIÓN 4: MANUAL DETALLADO DEL MÓDULO CONTABLE VEN-NIF
  // =========================================================================
  doc.addPage();
  y = 16;
  drawSectionHeader(
    '4',
    'Manual Detallado del Módulo Contable VEN-NIF',
    'Arquitectura contable homologada bajo el Código de Comercio de Venezuela (Art. 32-38) y las Normas VEN-NIF (NIIF para PYMES).'
  );

  // 4.1 Submódulos Contables
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4.1 Submódulos del Sistema Contable', marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Submódulo', 'Ruta en Menú', 'Función y Alcance Contable']],
    body: ACCOUNTING_SUBMODULES.map((s) => [s.title, s.route, s.description]),
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42 },
      1: { cellWidth: 44, textColor: [71, 85, 105] },
      2: { cellWidth: 96 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  ensureSpace(35);

  // 4.2 Circuitos de Contabilización Automática (Debe / Haber)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4.2 Circuitos de Contabilización Automática (Asientos Debe / Haber)', marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Proceso', 'Disparador', 'Débito (Debe)', 'Crédito (Haber)', 'Notas']],
    body: ACCOUNTING_CIRCUITS_DOC.map((c) => [c.process, c.trigger, c.debitAccounts, c.creditAccounts, c.notes]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 28 },
      2: { cellWidth: 44 },
      3: { cellWidth: 46 },
      4: { cellWidth: 34 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;
  ensureSpace(35);

  // 4.3 Matriz de Mapeos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4.3 Matriz Completa de Claves Operativas (mapping_key)', marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Clave Operativa', 'Cuenta', 'Nombre Contable VEN-NIF', 'Circuito', 'Comportamiento']],
    body: ACCOUNTING_MAPPINGS_DOC.map((m) => [m.key, m.accountCode, m.accountName, m.circuit, m.behavior]),
    theme: 'grid',
    styles: { fontSize: 6.9, cellPadding: 1.8, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 34, textColor: [2, 132, 199] },
      1: { fontStyle: 'bold', cellWidth: 16 },
      2: { cellWidth: 42 },
      3: { cellWidth: 38 },
      4: { cellWidth: 52 },
    },
  });

  return ReportsPdfEngine.finalize(doc);
}
