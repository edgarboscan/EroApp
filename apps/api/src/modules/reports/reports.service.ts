import { query } from '../../db';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export class ReportsService {
  /**
   * Reporte de Productos con Jerarquía y Ubicación Física
   */
  static async getInventoryHierarchyReport(companyId: string) {
    return await query<any>(
      `SELECT * FROM v_products_by_hierarchy WHERE company_id = ? ORDER BY department_name, group_name, product_name`,
      [companyId]
    );
  }

  /**
   * Reporte de Libro de Ventas Fiscal (SENIAT)
   */
  static async getSalesBookReport(companyId: string, period?: string) {
    return await query<any>(
      `SELECT * FROM v_book_sales 
       WHERE company_id = ? AND (? IS NULL OR fiscal_period = ?)
       ORDER BY emission_date ASC, row_num ASC`,
      [companyId, period || null, period || null]
    );
  }

  /**
   * Exportador a CSV
   */
  static exportToCSV(data: any[]): string {
    return Papa.unparse(data);
  }

  /**
   * Exportador a Excel (XLSX Buffer)
   */
  static exportToExcel(data: any[], sheetName = 'Reporte'): Buffer {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Exportador a PDF
   */
  static exportToPDF(title: string, headers: string[], rows: any[][]): Buffer {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString('es-VE')}`, 14, 22);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    });

    return Buffer.from(doc.output('arraybuffer'));
  }
}
