import { query, withTransaction } from '../../db';
import {
  POSSaleSubmit,
  OpenCashShiftInput,
  CloseCashShiftInput,
  CashMovementInput,
  GenerateFiscalReportInput,
} from '@ero/shared';
import crypto from 'crypto';

export class POSService {
  /**
   * Obtiene el listado de cajas registradoras de una sucursal
   */
  static async getCashRegisters(companyId: string, branchId: string) {
    const rows = await query<any>(
      `SELECT cr.id, cr.branch_id, cr.code, cr.name, cr.fiscal_printer_serial,
              cr.invoice_mode, cr.is_active,
              (SELECT cs.id FROM cash_shifts cs WHERE cs.cash_register_id = cr.id AND cs.status = 'OPEN' LIMIT 1) as active_shift_id,
              (SELECT u.full_name FROM cash_shifts cs INNER JOIN users u ON cs.user_id = u.id WHERE cs.cash_register_id = cr.id AND cs.status = 'OPEN' LIMIT 1) as active_cashier_name
       FROM cash_registers cr
       INNER JOIN branches b ON cr.branch_id = b.id
       WHERE b.company_id = ? AND cr.branch_id = ? AND cr.is_active = 1
       ORDER BY cr.code ASC`,
      [companyId, branchId]
    );

    return rows.map((r) => ({
      id: r.id,
      branchId: r.branch_id,
      code: r.code,
      name: r.name,
      fiscalPrinterSerial: r.fiscal_printer_serial,
      invoiceMode: r.invoice_mode,
      isActive: Boolean(r.is_active),
      activeShiftId: r.active_shift_id || null,
      activeCashierName: r.active_cashier_name || null,
      hasActiveShift: Boolean(r.active_shift_id),
    }));
  }

  /**
   * Obtiene el turno de caja actualmente abierto para el usuario o sucursal
   */
  static async getCurrentShift(companyId: string, userId: string, branchId: string) {
    const rows = await query<any>(
      `SELECT cs.*, cr.code as cash_register_code, cr.name as cash_register_name,
              cr.fiscal_printer_serial, cr.invoice_mode, u.full_name as cashier_name
       FROM cash_shifts cs
       INNER JOIN cash_registers cr ON cs.cash_register_id = cr.id
       INNER JOIN branches b ON cs.branch_id = b.id
       INNER JOIN users u ON cs.user_id = u.id
       WHERE b.company_id = ? AND cs.branch_id = ? AND cs.user_id = ? AND cs.status = 'OPEN'
       ORDER BY cs.opened_at DESC LIMIT 1`,
      [companyId, branchId, userId]
    );

    if (rows.length === 0) {
      return null;
    }

    const shift = rows[0];

    // Calcular ventas realizadas en este turno por método de pago
    const paymentRows = await query<any>(
      `SELECT sp.method, SUM(sp.amount_usd) as total_usd, SUM(sp.amount_ves) as total_ves,
              SUM(sp.igtf_amount_usd) as igtf_usd, COUNT(DISTINCT si.id) as tx_count
       FROM sales_invoices si
       INNER JOIN sales_payments sp ON si.id = sp.invoice_id
       WHERE si.shift_id = ? AND si.status <> 'ANNULLED'
       GROUP BY sp.method`,
      [shift.id]
    );

    // Calcular movimientos manuales de caja (Entradas / Salidas)
    const movementRows = await query<any>(
      `SELECT type, currency, SUM(amount) as total_amount
       FROM cash_movements
       WHERE shift_id = ?
       GROUP BY type, currency`,
      [shift.id]
    );

    let cashSalesUSD = 0;
    let cashSalesVES = 0;
    let pagomovilVES = 0;
    let debitVES = 0;
    let zelleUSD = 0;
    let totalIGTFUSD = 0;
    let totalInvoices = 0;

    for (const p of paymentRows) {
      const u = Number(p.total_usd);
      const v = Number(p.total_ves);
      totalIGTFUSD += Number(p.igtf_usd);
      totalInvoices += Number(p.tx_count);

      if (p.method === 'CASH_USD') cashSalesUSD += u;
      else if (p.method === 'CASH_VES') cashSalesVES += v;
      else if (p.method === 'PAGO_MOVIL') pagomovilVES += v;
      else if (p.method === 'DEBIT_CARD') debitVES += v;
      else if (p.method === 'ZELLE') zelleUSD += u;
    }

    let inflowsUSD = 0;
    let outflowsUSD = 0;
    let inflowsVES = 0;
    let outflowsVES = 0;

    for (const m of movementRows) {
      const amt = Number(m.total_amount);
      if (m.currency === 'USD') {
        if (m.type === 'INFLOW') inflowsUSD += amt;
        else outflowsUSD += amt;
      } else {
        if (m.type === 'INFLOW') inflowsVES += amt;
        else outflowsVES += amt;
      }
    }

    const initialCashUSD = Number(shift.initial_cash_usd);
    const initialCashVES = Number(shift.initial_cash_ves);

    const expectedCashUSD = Number((initialCashUSD + cashSalesUSD + inflowsUSD - outflowsUSD).toFixed(2));
    const expectedCashVES = Number((initialCashVES + cashSalesVES + inflowsVES - outflowsVES).toFixed(2));

    return {
      id: shift.id,
      cashRegisterId: shift.cash_register_id,
      cashRegisterCode: shift.cash_register_code,
      cashRegisterName: shift.cash_register_name,
      fiscalPrinterSerial: shift.fiscal_printer_serial,
      invoiceMode: shift.invoice_mode,
      branchId: shift.branch_id,
      userId: shift.user_id,
      cashierName: shift.cashier_name,
      openedAt: shift.opened_at,
      initialCashUSD,
      initialCashVES,
      expectedCashUSD,
      expectedCashVES,
      summary: {
        totalInvoices,
        cashSalesUSD: Number(cashSalesUSD.toFixed(2)),
        cashSalesVES: Number(cashSalesVES.toFixed(2)),
        pagomovilVES: Number(pagomovilVES.toFixed(2)),
        debitVES: Number(debitVES.toFixed(2)),
        zelleUSD: Number(zelleUSD.toFixed(2)),
        totalIGTFUSD: Number(totalIGTFUSD.toFixed(2)),
        inflowsUSD: Number(inflowsUSD.toFixed(2)),
        outflowsUSD: Number(outflowsUSD.toFixed(2)),
        inflowsVES: Number(inflowsVES.toFixed(2)),
        outflowsVES: Number(outflowsVES.toFixed(2)),
      },
      status: shift.status,
      notes: shift.notes,
    };
  }

  /**
   * Abre un turno de caja
   */
  static async openShift(companyId: string, userId: string, data: OpenCashShiftInput) {
    return await withTransaction(async (conn) => {
      // 1. Verificar si ya existe un turno abierto para esta caja
      const [existingRegisterShift]: any = await conn.query(
        `SELECT id FROM cash_shifts WHERE cash_register_id = ? AND status = 'OPEN'`,
        [data.cashRegisterId]
      );
      if (existingRegisterShift && existingRegisterShift.length > 0) {
        throw new Error('Esta caja registradora ya posee un turno abierto');
      }

      // 2. Verificar si el usuario ya tiene un turno abierto
      const [existingUserShift]: any = await conn.query(
        `SELECT id FROM cash_shifts WHERE user_id = ? AND status = 'OPEN'`,
        [userId]
      );
      if (existingUserShift && existingUserShift.length > 0) {
        throw new Error('El cajero ya tiene un turno activo en curso');
      }

      const shiftId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO cash_shifts (
          id, cash_register_id, branch_id, user_id, opened_at,
          initial_cash_usd, initial_cash_ves, status, notes
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(), ?, ?, 'OPEN', ?)`,
        [
          shiftId,
          data.cashRegisterId,
          data.branchId,
          userId,
          data.initialCashUSD,
          data.initialCashVES,
          data.notes || null,
        ]
      );

      return {
        shiftId,
        cashRegisterId: data.cashRegisterId,
        openedAt: new Date().toISOString(),
        initialCashUSD: data.initialCashUSD,
        initialCashVES: data.initialCashVES,
      };
    });
  }

  /**
   * Cierra un turno de caja con arqueo y cálculo de diferencias
   */
  static async closeShift(companyId: string, userId: string, data: CloseCashShiftInput) {
    return await withTransaction(async (conn) => {
      const [shiftRows]: any = await conn.query(
        `SELECT cs.*, cr.code as cash_register_code, cr.name as cash_register_name,
                cr.fiscal_printer_serial
         FROM cash_shifts cs
         INNER JOIN cash_registers cr ON cs.cash_register_id = cr.id
         WHERE cs.id = ? AND cs.status = 'OPEN'`,
        [data.shiftId]
      );

      if (!shiftRows || shiftRows.length === 0) {
        throw new Error('Turno de caja no encontrado o ya se encuentra cerrado');
      }

      const shift = shiftRows[0];

      // Calcular montos recaudados
      const [paymentRows]: any = await conn.query(
        `SELECT sp.method, SUM(sp.amount_usd) as total_usd, SUM(sp.amount_ves) as total_ves
         FROM sales_invoices si
         INNER JOIN sales_payments sp ON si.id = sp.invoice_id
         WHERE si.shift_id = ? AND si.status <> 'ANNULLED'
         GROUP BY sp.method`,
        [shift.id]
      );

      let cashSalesUSD = 0;
      let cashSalesVES = 0;
      for (const p of paymentRows) {
        if (p.method === 'CASH_USD') cashSalesUSD += Number(p.total_usd);
        else if (p.method === 'CASH_VES') cashSalesVES += Number(p.total_ves);
      }

      const [movementRows]: any = await conn.query(
        `SELECT type, currency, SUM(amount) as total_amount
         FROM cash_movements WHERE shift_id = ? GROUP BY type, currency`,
        [shift.id]
      );

      let inflowsUSD = 0;
      let outflowsUSD = 0;
      let inflowsVES = 0;
      let outflowsVES = 0;

      for (const m of movementRows) {
        const amt = Number(m.total_amount);
        if (m.currency === 'USD') {
          if (m.type === 'INFLOW') inflowsUSD += amt;
          else outflowsUSD += amt;
        } else {
          if (m.type === 'INFLOW') inflowsVES += amt;
          else outflowsVES += amt;
        }
      }

      const expectedUSD = Number(
        (Number(shift.initial_cash_usd) + cashSalesUSD + inflowsUSD - outflowsUSD).toFixed(2)
      );
      const expectedVES = Number(
        (Number(shift.initial_cash_ves) + cashSalesVES + inflowsVES - outflowsVES).toFixed(2)
      );

      const diffUSD = Number((data.finalCashUSDCounted - expectedUSD).toFixed(2));
      const diffVES = Number((data.finalCashVESCounted - expectedVES).toFixed(2));

      await conn.query(
        `UPDATE cash_shifts SET
          closed_at = CURRENT_TIMESTAMP(),
          final_cash_usd_expected = ?,
          final_cash_ves_expected = ?,
          final_cash_usd_counted = ?,
          final_cash_ves_counted = ?,
          difference_usd = ?,
          difference_ves = ?,
          status = 'CLOSED',
          notes = ?
         WHERE id = ?`,
        [
          expectedUSD,
          expectedVES,
          data.finalCashUSDCounted,
          data.finalCashVESCounted,
          diffUSD,
          diffVES,
          data.notes || null,
          shift.id,
        ]
      );

      return {
        shiftId: shift.id,
        cashRegisterCode: shift.cash_register_code,
        closedAt: new Date().toISOString(),
        finalCashUSDCounted: data.finalCashUSDCounted,
        finalCashVESCounted: data.finalCashVESCounted,
        finalCashUSDExpected: expectedUSD,
        finalCashVESExpected: expectedVES,
        differenceUSD: diffUSD,
        differenceVES: diffVES,
      };
    });
  }

  /**
   * Registra un movimiento manual de caja (Entrada o Salida de efectivo)
   */
  static async registerCashMovement(companyId: string, userId: string, data: CashMovementInput) {
    const [shiftRows]: any = await query(
      `SELECT id FROM cash_shifts WHERE id = ? AND status = 'OPEN'`,
      [data.shiftId]
    );

    if (!shiftRows || shiftRows.length === 0) {
      throw new Error('No se puede registrar movimiento en un turno cerrado');
    }

    const movementId = crypto.randomUUID();
    await query(
      `INSERT INTO cash_movements (id, shift_id, user_id, type, currency, amount, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [movementId, data.shiftId, userId, data.type, data.currency, data.amount, data.reason]
    );

    return {
      movementId,
      shiftId: data.shiftId,
      type: data.type,
      currency: data.currency,
      amount: data.amount,
      reason: data.reason,
    };
  }

  /**
   * Procesa una venta en POS, actualiza inventario y genera el ticket fiscal homologado
   */
  static async processSale(companyId: string, userId: string, payload: POSSaleSubmit) {
    return await withTransaction(async (conn) => {
      // 1. Resolver turno activo
      let activeShiftId: string | null = null;
      const [shiftRows]: any = await conn.query(
        `SELECT id FROM cash_shifts 
         WHERE branch_id = ? AND user_id = ? AND status = 'OPEN' 
         ORDER BY opened_at DESC LIMIT 1`,
        [payload.branchId, userId]
      );
      if (shiftRows && shiftRows.length > 0) {
        activeShiftId = shiftRows[0].id;
      }

      // 2. Resolver cliente
      let customerId = payload.customerId;
      if (!customerId) {
        const [existing]: any = await conn.query(
          `SELECT id FROM customers WHERE company_id = ? AND doc_type = ? AND doc_number = ? LIMIT 1`,
          [companyId, payload.customerDocType, payload.customerDocNumber]
        );

        if (existing && existing.length > 0) {
          customerId = existing[0].id;
        } else {
          customerId = crypto.randomUUID();
          await conn.query(
            `INSERT INTO customers (id, company_id, doc_type, doc_number, name, address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              customerId,
              companyId,
              payload.customerDocType,
              payload.customerDocNumber,
              payload.customerName,
              payload.customerAddress || null,
            ]
          );
        }
      }

      // 3. Generar número de factura y de control fiscal
      const invoiceId = crypto.randomUUID();
      const invoiceNumber = `FAC-${Date.now().toString().slice(-8)}`;
      const controlNumber = `00-${Date.now().toString().slice(-6)}`;

      // 4. Insertar encabezado de factura con shift_id
      await conn.query(
        `INSERT INTO sales_invoices (
          id, branch_id, warehouse_id, customer_id, user_id, shift_id,
          invoice_number, control_number, invoice_mode, currency, exchange_rate,
          base_exempt_amount, base_taxable_amount, tax_amount, igtf_amount,
          discount_amount, total_amount, is_credit, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID')`,
        [
          invoiceId,
          payload.branchId,
          payload.warehouseId,
          customerId,
          userId,
          activeShiftId,
          invoiceNumber,
          controlNumber,
          payload.invoiceMode,
          payload.currency,
          payload.exchangeRate,
          payload.baseExemptAmount,
          payload.baseTaxableAmount,
          payload.taxAmount,
          payload.igtfTotalAmount,
          payload.discountTotalAmount,
          payload.finalTotalAmount,
          payload.isCredit ? 1 : 0,
        ]
      );

      // 5. Insertar renglones y descontar stock
      for (const item of payload.items) {
        await conn.query(
          `INSERT INTO sales_invoice_items (
            id, invoice_id, product_id, quantity, unit_price, unit_cost,
            tax_rate, discount_percent, tax_amount, subtotal, total
          ) VALUES (?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            invoiceId,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.taxRatePercent,
            item.discountPercent,
            item.taxAmount,
            item.subtotal,
            item.total,
          ]
        );

        // Descontar inventario en el depósito correspondiente
        await conn.query(
          `UPDATE product_stocks 
           SET current_stock = GREATEST(0, current_stock - ?)
           WHERE product_id = ? AND warehouse_id = ?`,
          [item.quantity, item.productId, payload.warehouseId]
        );
      }

      // 6. Insertar métodos de pago
      for (const payment of payload.payments) {
        await conn.query(
          `INSERT INTO sales_payments (
            id, invoice_id, method, amount_ves, amount_usd, exchange_rate,
            applies_igtf, igtf_amount_ves, igtf_amount_usd, reference_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            invoiceId,
            payment.method,
            payment.amountVES,
            payment.amountUSD,
            payment.exchangeRate,
            payment.appliesIGTF ? 1 : 0,
            payment.igtfAmountVES,
            payment.igtfAmountUSD,
            payment.referenceNumber || null,
          ]
        );
      }

      // 7. Retornar datos de venta y ticket fiscal emulado
      return {
        invoiceId,
        invoiceNumber,
        controlNumber,
        shiftId: activeShiftId,
        customerDoc: `${payload.customerDocType}-${payload.customerDocNumber}`,
        customerName: payload.customerName,
        totalAmountUSD: payload.finalTotalAmount,
        totalAmountVES: Number((payload.finalTotalAmount * payload.exchangeRate).toFixed(2)),
        exchangeRate: payload.exchangeRate,
        issuedAt: new Date().toISOString(),
        items: payload.items,
        payments: payload.payments,
      };
    });
  }

  /**
   * Emite Reporte X (Corte Parcial) o Reporte Z (Cierre Fiscal Diario SENIAT)
   */
  static async generateFiscalReport(companyId: string, userId: string, data: GenerateFiscalReportInput) {
    return await withTransaction(async (conn) => {
      // 1. Obtener datos de la caja registradora
      const [regRows]: any = await conn.query(
        `SELECT cr.*, b.name as branch_name, c.rif as company_rif, c.legal_name as company_name
         FROM cash_registers cr
         INNER JOIN branches b ON cr.branch_id = b.id
         INNER JOIN companies c ON b.company_id = c.id
         WHERE cr.id = ? AND b.company_id = ?`,
        [data.cashRegisterId, companyId]
      );

      if (!regRows || regRows.length === 0) {
        throw new Error('Caja registradora no encontrada');
      }

      const register = regRows[0];

      // 2. Determinar rango de facturas para este reporte
      let sqlInvoices = `
        SELECT 
          si.id, si.invoice_number, si.total_amount, si.base_exempt_amount,
          si.base_taxable_amount, si.tax_amount, si.igtf_amount, si.created_at
        FROM sales_invoices si
        WHERE si.branch_id = ? AND si.status <> 'ANNULLED'
      `;
      const params: any[] = [data.branchId];

      if (data.shiftId) {
        sqlInvoices += ` AND si.shift_id = ?`;
        params.push(data.shiftId);
      } else {
        // Todas las ventas del día actual
        sqlInvoices += ` AND DATE(si.created_at) = CURRENT_DATE()`;
      }
      sqlInvoices += ` ORDER BY si.invoice_number ASC`;

      const [invoices]: any = await conn.query(sqlInvoices, params);

      let invoicesCount = invoices.length;
      let firstInvoiceNumber = invoices.length > 0 ? invoices[0].invoice_number : 'N/A';
      let lastInvoiceNumber = invoices.length > 0 ? invoices[invoices.length - 1].invoice_number : 'N/A';

      let totalSales = 0;
      let baseExempt = 0;
      let baseTaxableGeneral = 0;
      let taxGeneral = 0;
      let igtfAmount = 0;

      for (const inv of invoices) {
        totalSales += Number(inv.total_amount);
        baseExempt += Number(inv.base_exempt_amount);
        baseTaxableGeneral += Number(inv.base_taxable_amount);
        taxGeneral += Number(inv.tax_amount);
        igtfAmount += Number(inv.igtf_amount);
      }

      let zNumber: number | null = null;
      if (data.reportType === 'Z') {
        const [maxZ]: any = await conn.query(
          `SELECT COALESCE(MAX(z_number), 0) + 1 as next_z 
           FROM fiscal_reports 
           WHERE cash_register_id = ? AND report_type = 'Z'`,
          [data.cashRegisterId]
        );
        zNumber = Number(maxZ[0].next_z);
      }

      // 3. Generar cuerpo formateado del Ticket Fiscal
      const reportDate = new Date();
      const reportId = crypto.randomUUID();

      let formattedText = `========================================\n`;
      formattedText += `       ${register.company_name}\n`;
      formattedText += `           RIF: ${register.company_rif}\n`;
      formattedText += `    ${register.branch_name}\n`;
      formattedText += `========================================\n`;
      formattedText += `REPORTE FISCAL ${data.reportType === 'Z' ? 'Z (CIERRE DIARIO)' : 'X (CORTE PARCIAL)'}\n`;
      if (data.reportType === 'Z') {
        formattedText += `NUMERO REPORTE Z: Z-${zNumber?.toString().padStart(4, '0')}\n`;
      }
      formattedText += `CAJA REGISTRADORA: ${register.code} (${register.name})\n`;
      formattedText += `SERIAL IMPRESORA : ${register.fiscal_printer_serial || 'VIRTUAL-FISCAL-VE'}\n`;
      formattedText += `FECHA Y HORA     : ${reportDate.toLocaleDateString('es-VE')} ${reportDate.toLocaleTimeString('es-VE')}\n`;
      formattedText += `----------------------------------------\n`;
      formattedText += `PRIMERA FACTURA  : ${firstInvoiceNumber}\n`;
      formattedText += `ULTIMA FACTURA   : ${lastInvoiceNumber}\n`;
      formattedText += `CANT. DOCUMENTOS : ${invoicesCount}\n`;
      formattedText += `----------------------------------------\n`;
      formattedText += `VENTAS EXENTAS (E): $ ${baseExempt.toFixed(2)}\n`;
      formattedText += `BASE IMPONIBLE (G): $ ${baseTaxableGeneral.toFixed(2)}\n`;
      formattedText += `IMPUESTO IVA (16%): $ ${taxGeneral.toFixed(2)}\n`;
      formattedText += `IMPUESTO IGTF (3%): $ ${igtfAmount.toFixed(2)}\n`;
      formattedText += `----------------------------------------\n`;
      formattedText += `TOTAL VENTAS BRUTAS: $ ${totalSales.toFixed(2)}\n`;
      formattedText += `========================================\n`;
      formattedText += `       MEMORIA FISCAL AUDITADA\n`;
      formattedText += `========================================\n`;

      // 4. Guardar en base de datos si es Reporte Z (o registrar X para auditoría)
      await conn.query(
        `INSERT INTO fiscal_reports (
          id, cash_register_id, branch_id, shift_id, user_id,
          report_type, z_number, report_date, first_invoice_number,
          last_invoice_number, invoices_count, base_exempt_amount,
          base_taxable_general, tax_general_amount, base_taxable_reduced,
          tax_reduced_amount, igtf_amount, total_sales_amount, raw_content
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, ?, ?)`,
        [
          reportId,
          data.cashRegisterId,
          data.branchId,
          data.shiftId || null,
          userId,
          data.reportType,
          zNumber,
          reportDate,
          firstInvoiceNumber,
          lastInvoiceNumber,
          invoicesCount,
          baseExempt,
          baseTaxableGeneral,
          taxGeneral,
          igtfAmount,
          totalSales,
          formattedText,
        ]
      );

      return {
        id: reportId,
        reportType: data.reportType,
        zNumber,
        cashRegisterCode: register.code,
        fiscalPrinterSerial: register.fiscal_printer_serial || 'VIRTUAL-FISCAL-VE',
        reportDate: reportDate.toISOString(),
        invoicesCount,
        firstInvoiceNumber,
        lastInvoiceNumber,
        baseExempt: Number(baseExempt.toFixed(2)),
        baseTaxableGeneral: Number(baseTaxableGeneral.toFixed(2)),
        taxGeneral: Number(taxGeneral.toFixed(2)),
        igtfAmount: Number(igtfAmount.toFixed(2)),
        totalSales: Number(totalSales.toFixed(2)),
        formattedText,
      };
    });
  }

  /**
   * Obtiene el historial de Reportes Z diarios emitidos
   */
  static async getFiscalReportsHistory(companyId: string, branchId: string) {
    const rows = await query<any>(
      `SELECT fr.*, cr.code as cash_register_code, cr.name as cash_register_name,
              u.full_name as cashier_name
       FROM fiscal_reports fr
       INNER JOIN cash_registers cr ON fr.cash_register_id = cr.id
       INNER JOIN branches b ON fr.branch_id = b.id
       INNER JOIN users u ON fr.user_id = u.id
       WHERE b.company_id = ? AND fr.branch_id = ?
       ORDER BY fr.report_date DESC LIMIT 50`,
      [companyId, branchId]
    );

    return rows.map((r) => ({
      id: r.id,
      reportType: r.report_type,
      zNumber: r.z_number,
      cashRegisterCode: r.cash_register_code,
      cashRegisterName: r.cash_register_name,
      cashierName: r.cashier_name,
      reportDate: r.report_date,
      invoicesCount: r.invoices_count,
      firstInvoiceNumber: r.first_invoice_number,
      lastInvoiceNumber: r.last_invoice_number,
      baseExempt: Number(r.base_exempt_amount),
      baseTaxableGeneral: Number(r.base_taxable_general),
      taxGeneral: Number(r.tax_general_amount),
      igtfAmount: Number(r.igtf_amount),
      totalSales: Number(r.total_sales_amount),
      rawContent: r.raw_content,
    }));
  }
}
