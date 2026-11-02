import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { pool } from './index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uuidv4 = () => crypto.randomUUID();

// Helper para generar IDs determinísticos de 36 caracteres basados en un namespace
function makeId(prefix: string, seed: string): string {
  const hash = crypto.createHash('md5').update(`${prefix}:${seed}`).digest('hex'); // 32 hex chars
  // formato 8-4-4-4-12 = 36 chars
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

async function runAccountingMigration() {
  console.log('--- Iniciando Migración Módulo Contable Senior ---');
  
  // 1. Ejecutar DDL
  const ddlPath = path.join(__dirname, 'ddl/07_accounting.sql');
  const ddlSql = fs.readFileSync(ddlPath, 'utf8');
  
  // Limpiar comentarios de bloque y de línea, luego separar por punto y coma
  const cleanSql = ddlSql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    if (stmt.trim()) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        console.error('Error en sentencia SQL:', err.message, '\nSentencia:', stmt.substring(0, 100));
        throw err;
      }
    }
  }
  console.log('✓ Tablas y permisos contables verificados/creados');

  const companyId = 'c1111111-1111-1111-1111-111111111111';
  const branchId = 'b1111111-1111-1111-1111-111111111111';

  // Obtener usuario admin para registrar creadores
  const [adminUsers]: any = await pool.query(`SELECT id FROM users LIMIT 1`);
  const adminId = adminUsers[0]?.id || 'u1111111-1111-1111-1111-111111111111';

  // 2. Crear Año Fiscal 2026 y Periodos
  const fiscalYearId = makeId('fy', `${companyId}-2026`);
  await pool.query(`
    INSERT INTO accounting_fiscal_years (id, company_id, year, start_date, end_date, status)
    VALUES (?, ?, 2026, '2026-01-01', '2026-12-31', 'OPEN')
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `, [fiscalYearId, companyId]);

  const periodsMap = new Map<number, string>();
  for (let m = 1; m <= 12; m++) {
    const periodId = makeId('period', `${fiscalYearId}-${m}`);
    periodsMap.set(m, periodId);
    const startMonth = `2026-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(2026, m, 0).getDate();
    const endMonth = `2026-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    await pool.query(`
      INSERT INTO accounting_fiscal_periods (id, fiscal_year_id, month, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, 'OPEN')
      ON DUPLICATE KEY UPDATE start_date = VALUES(start_date)
    `, [periodId, fiscalYearId, m, startMonth, endMonth]);
  }
  console.log('✓ Año fiscal 2026 y 12 periodos mensuales listos');

  // 3. Crear INPC (Índice Nacional de Precios al Consumidor) del BCV
  const inpcData = [
    { year: 2025, month: 10, value: 582.41, var: 1.2 },
    { year: 2025, month: 11, value: 591.15, var: 1.5 },
    { year: 2025, month: 12, value: 602.97, var: 2.0 },
    { year: 2026, month: 1, value: 615.63, var: 2.1 },
    { year: 2026, month: 2, value: 627.94, var: 2.0 },
    { year: 2026, month: 3, value: 639.24, var: 1.8 },
    { year: 2026, month: 4, value: 650.75, var: 1.8 },
    { year: 2026, month: 5, value: 663.11, var: 1.9 },
    { year: 2026, month: 6, value: 675.05, var: 1.8 },
    { year: 2026, month: 7, value: 687.88, var: 1.9 },
    { year: 2026, month: 8, value: 700.26, var: 1.8 },
    { year: 2026, month: 9, value: 712.86, var: 1.8 },
    { year: 2026, month: 10, value: 725.69, var: 1.8 },
  ];

  for (const item of inpcData) {
    const inpcId = makeId('inpc', `${item.year}-${item.month}`);
    await pool.query(`
      INSERT INTO accounting_inflation_indices (id, year, month, inpc_value, variation_monthly, published_date)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE inpc_value = VALUES(inpc_value), variation_monthly = VALUES(variation_monthly)
    `, [inpcId, item.year, item.month, item.value, item.var, `${item.year}-${String(item.month).padStart(2, '0')}-15`]);
  }
  console.log('✓ Índices INPC del BCV registrados');

  // 4. Catálogo de Cuentas Estándar VEN-NIF
  const accountsDef = [
    // 1 ACTIVO
    { code: '1', name: 'ACTIVO', level: 1, parent: null, type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: false, monetary: true },
    { code: '1.1', name: 'ACTIVO CORRIENTE', level: 2, parent: '1', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: false, monetary: true },
    { code: '1.1.01', name: 'Efectivo y Equivalentes de Efectivo', level: 3, parent: '1.1', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: false, monetary: true },
    { code: '1.1.01.01', name: 'Caja Principal (Efectivo VES)', level: 4, parent: '1.1.01', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true, bankCash: true },
    { code: '1.1.01.02', name: 'Caja Chica Sucursal', level: 4, parent: '1.1.01', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true, bankCash: true },
    { code: '1.1.01.03', name: 'Caja en Moneda Extranjera (USD)', level: 4, parent: '1.1.01', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true, bankCash: true },
    { code: '1.1.01.04', name: 'Banco Mercantil Cta Cte (VES)', level: 4, parent: '1.1.01', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true, bankCash: true },
    { code: '1.1.01.05', name: 'Banco Banesco Cta Cte (VES)', level: 4, parent: '1.1.01', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true, bankCash: true },
    { code: '1.1.01.06', name: 'Banco en Custodia / Cuenta Especial (USD)', level: 4, parent: '1.1.01', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true, bankCash: true },
    
    { code: '1.1.02', name: 'Cuentas y Efectos por Cobrar Comerciales', level: 3, parent: '1.1', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: false, monetary: true },
    { code: '1.1.02.01', name: 'Clientes Nacionales Comerciales', level: 4, parent: '1.1.02', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true },
    { code: '1.1.02.02', name: 'Clientes en Moneda Extranjera (USD)', level: 4, parent: '1.1.02', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true },
    { code: '1.1.02.03', name: 'Provisión para Cuentas Incobrables', level: 4, parent: '1.1.02', type: 'ASSET', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },
    
    { code: '1.1.03', name: 'Créditos y Anticipos Fiscales', level: 3, parent: '1.1', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: false, monetary: true },
    { code: '1.1.03.01', name: 'IVA Crédito Fiscal', level: 4, parent: '1.1.03', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true },
    { code: '1.1.03.02', name: 'Retenciones de IVA Soportadas por Compensar', level: 4, parent: '1.1.03', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true },
    { code: '1.1.03.03', name: 'Retenciones de ISLR Acumuladas por Compensar', level: 4, parent: '1.1.03', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true },
    { code: '1.1.03.04', name: 'Anticipos de Impuesto sobre la Renta (ISLR)', level: 4, parent: '1.1.03', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: true },

    { code: '1.1.04', name: 'Inventarios (Activos No Monetarios)', level: 3, parent: '1.1', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: false, monetary: false },
    { code: '1.1.04.01', name: 'Inventario de Mercancías para la Venta', level: 4, parent: '1.1.04', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: false },
    { code: '1.1.04.02', name: 'Mercancías en Tránsito', level: 4, parent: '1.1.04', type: 'ASSET', classif: 'CURRENT', balance: 'DEBIT', post: true, monetary: false },

    { code: '1.2', name: 'ACTIVO NO CORRIENTE', level: 2, parent: '1', type: 'ASSET', classif: 'NON_CURRENT', balance: 'DEBIT', post: false, monetary: false },
    { code: '1.2.01', name: 'Propiedades, Planta y Equipos (Activos Fijos)', level: 3, parent: '1.2', type: 'ASSET', classif: 'NON_CURRENT', balance: 'DEBIT', post: false, monetary: false },
    { code: '1.2.01.01', name: 'Terrenos', level: 4, parent: '1.2.01', type: 'ASSET', classif: 'NON_CURRENT', balance: 'DEBIT', post: true, monetary: false },
    { code: '1.2.01.02', name: 'Edificaciones e Instalaciones', level: 4, parent: '1.2.01', type: 'ASSET', classif: 'NON_CURRENT', balance: 'DEBIT', post: true, monetary: false },
    { code: '1.2.01.03', name: 'Mobiliario y Equipos de Oficina', level: 4, parent: '1.2.01', type: 'ASSET', classif: 'NON_CURRENT', balance: 'DEBIT', post: true, monetary: false },
    { code: '1.2.01.04', name: 'Equipos de Computación y Tecnología', level: 4, parent: '1.2.01', type: 'ASSET', classif: 'NON_CURRENT', balance: 'DEBIT', post: true, monetary: false },
    { code: '1.2.01.05', name: 'Vehículos y Flota de Transporte', level: 4, parent: '1.2.01', type: 'ASSET', classif: 'NON_CURRENT', balance: 'DEBIT', post: true, monetary: false },
    { code: '1.2.01.06', name: 'Depreciación Acumulada Propiedad, Planta y Eq.', level: 4, parent: '1.2.01', type: 'ASSET', classif: 'NON_CURRENT', balance: 'CREDIT', post: true, monetary: false },

    // 2 PASIVO
    { code: '2', name: 'PASIVO', level: 1, parent: null, type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: false, monetary: true },
    { code: '2.1', name: 'PASIVO CORRIENTE', level: 2, parent: '2', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: false, monetary: true },
    { code: '2.1.01', name: 'Cuentas y Efectos por Pagar Comerciales', level: 3, parent: '2.1', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: false, monetary: true },
    { code: '2.1.01.01', name: 'Proveedores Nacionales', level: 4, parent: '2.1.01', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },
    { code: '2.1.01.02', name: 'Proveedores Extranjeros / Divisas', level: 4, parent: '2.1.01', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },

    { code: '2.1.02', name: 'Pasivos y Retenciones Fiscales (Tributos por Pagar)', level: 3, parent: '2.1', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: false, monetary: true },
    { code: '2.1.02.01', name: 'IVA Débito Fiscal', level: 4, parent: '2.1.02', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },
    { code: '2.1.02.02', name: 'Retenciones de IVA por Enterar al SENIAT', level: 4, parent: '2.1.02', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },
    { code: '2.1.02.03', name: 'Retenciones de ISLR por Enterar al SENIAT', level: 4, parent: '2.1.02', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },
    { code: '2.1.02.04', name: 'Impuestos Municipales y Actividades Económicas', level: 4, parent: '2.1.02', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },
    { code: '2.1.02.05', name: 'IGTF por Enterar al SENIAT', level: 4, parent: '2.1.02', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },

    { code: '2.1.03', name: 'Obligaciones Laborales y Nómina', level: 3, parent: '2.1', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: false, monetary: true },
    { code: '2.1.03.01', name: 'Sueldos y Salarios por Pagar', level: 4, parent: '2.1.03', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },
    { code: '2.1.03.02', name: 'Aportes Patronales Legales (IVSS, FAOV, INCES)', level: 4, parent: '2.1.03', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },
    { code: '2.1.03.03', name: 'Prestaciones Sociales y Liquidaciones por Pagar', level: 4, parent: '2.1.03', type: 'LIABILITY', classif: 'CURRENT', balance: 'CREDIT', post: true, monetary: true },

    { code: '2.2', name: 'PASIVO NO CORRIENTE', level: 2, parent: '2', type: 'LIABILITY', classif: 'NON_CURRENT', balance: 'CREDIT', post: false, monetary: true },
    { code: '2.2.01', name: 'Obligaciones Financieras a Largo Plazo', level: 3, parent: '2.2', type: 'LIABILITY', classif: 'NON_CURRENT', balance: 'CREDIT', post: false, monetary: true },
    { code: '2.2.01.01', name: 'Préstamos Bancarios a Largo Plazo', level: 4, parent: '2.2.01', type: 'LIABILITY', classif: 'NON_CURRENT', balance: 'CREDIT', post: true, monetary: true },

    // 3 PATRIMONIO
    { code: '3', name: 'PATRIMONIO NETO', level: 1, parent: null, type: 'EQUITY', classif: 'OTHER', balance: 'CREDIT', post: false, monetary: false },
    { code: '3.1', name: 'Capital Social', level: 2, parent: '3', type: 'EQUITY', classif: 'OTHER', balance: 'CREDIT', post: false, monetary: false },
    { code: '3.1.01', name: 'Capital Social Suscrito y Pagado', level: 3, parent: '3.1', type: 'EQUITY', classif: 'OTHER', balance: 'CREDIT', post: true, monetary: false },
    { code: '3.1.02', name: 'Actualización de Capital Social (Reexpresión VEN-NIF)', level: 3, parent: '3.1', type: 'EQUITY', classif: 'OTHER', balance: 'CREDIT', post: true, monetary: false },

    { code: '3.2', name: 'Reservas de Capital', level: 2, parent: '3', type: 'EQUITY', classif: 'OTHER', balance: 'CREDIT', post: false, monetary: false },
    { code: '3.2.01', name: 'Reserva Legal (Código de Comercio Art. 262)', level: 3, parent: '3.2', type: 'EQUITY', classif: 'OTHER', balance: 'CREDIT', post: true, monetary: false },

    { code: '3.3', name: 'Resultados Acumulados', level: 2, parent: '3', type: 'EQUITY', classif: 'OTHER', balance: 'CREDIT', post: false, monetary: false },
    { code: '3.3.01', name: 'Utilidades No Distribuidas Ejercicios Anteriores', level: 3, parent: '3.3', type: 'EQUITY', classif: 'OTHER', balance: 'CREDIT', post: true, monetary: false },
    { code: '3.3.02', name: 'Pérdidas Acumuladas Ejercicios Anteriores', level: 3, parent: '3.3', type: 'EQUITY', classif: 'OTHER', balance: 'DEBIT', post: true, monetary: false },
    { code: '3.3.03', name: 'Resultado del Ejercicio Actual', level: 3, parent: '3.3', type: 'EQUITY', classif: 'OTHER', balance: 'CREDIT', post: true, monetary: false },
    { code: '3.3.04', name: 'Resultado por Exposición a la Inflación Acumulado (REI)', level: 3, parent: '3.3', type: 'EQUITY', classif: 'OTHER', balance: 'CREDIT', post: true, monetary: false },

    // 4 INGRESOS
    { code: '4', name: 'INGRESOS', level: 1, parent: null, type: 'REVENUE', classif: 'OPERATING', balance: 'CREDIT', post: false, monetary: true },
    { code: '4.1', name: 'Ingresos Operacionales de Ventas', level: 2, parent: '4', type: 'REVENUE', classif: 'OPERATING', balance: 'CREDIT', post: false, monetary: true },
    { code: '4.1.01', name: 'Ventas de Mercancías Gravadas con IVA', level: 3, parent: '4.1', type: 'REVENUE', classif: 'OPERATING', balance: 'CREDIT', post: true, monetary: true },
    { code: '4.1.02', name: 'Ventas de Mercancías Exentas / Exoneradas', level: 3, parent: '4.1', type: 'REVENUE', classif: 'OPERATING', balance: 'CREDIT', post: true, monetary: true },
    { code: '4.1.03', name: 'Descuentos y Rebajas en Ventas', level: 3, parent: '4.1', type: 'REVENUE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },
    { code: '4.1.04', name: 'Devoluciones en Ventas', level: 3, parent: '4.1', type: 'REVENUE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },

    // 5 COSTOS
    { code: '5', name: 'COSTOS DE VENTAS Y OPERACIÓN', level: 1, parent: null, type: 'COST', classif: 'OPERATING', balance: 'DEBIT', post: false, monetary: false },
    { code: '5.1', name: 'Costo de Ventas', level: 2, parent: '5', type: 'COST', classif: 'OPERATING', balance: 'DEBIT', post: false, monetary: false },
    { code: '5.1.01', name: 'Costo de Mercancía Vendida', level: 3, parent: '5.1', type: 'COST', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: false },
    { code: '5.1.02', name: 'Fletes y Aranceles de Importación', level: 3, parent: '5.1', type: 'COST', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: false },

    // 6 GASTOS OPERACIONALES
    { code: '6', name: 'GASTOS OPERACIONALES', level: 1, parent: null, type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: false, monetary: true },
    { code: '6.1', name: 'Gastos de Administración', level: 2, parent: '6', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: false, monetary: true },
    { code: '6.1.01', name: 'Sueldos, Salarios y Remuneraciones', level: 3, parent: '6.1', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },
    { code: '6.1.02', name: 'Aportes Patronales Legales (IVSS, FAOV, INCES)', level: 3, parent: '6.1', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },
    { code: '6.1.03', name: 'Honorarios Profesionales Contables y Jurídicos', level: 3, parent: '6.1', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },
    { code: '6.1.04', name: 'Servicios Públicos (Energía, Agua, Conectividad)', level: 3, parent: '6.1', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },
    { code: '6.1.05', name: 'Alquileres y Arrendamientos', level: 3, parent: '6.1', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },
    { code: '6.1.06', name: 'Depreciación de Propiedades, Planta y Equipos', level: 3, parent: '6.1', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: false },
    { code: '6.1.07', name: 'Mantenimiento, Reparaciones y Suministros', level: 3, parent: '6.1', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },

    { code: '6.2', name: 'Gastos de Ventas y Mercadeo', level: 2, parent: '6', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: false, monetary: true },
    { code: '6.2.01', name: 'Comisiones de Ventas', level: 3, parent: '6.2', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },
    { code: '6.2.02', name: 'Publicidad, Redes y Promoción', level: 3, parent: '6.2', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },
    { code: '6.2.03', name: 'Despachos y Fletes sobre Ventas', level: 3, parent: '6.2', type: 'EXPENSE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },

    // 7 OTROS INGRESOS / EGRESOS Y DIFERENCIA EN CAMBIO
    { code: '7', name: 'INGRESOS Y EGRESOS EXTRAORDINARIOS Y FINANCIEROS', level: 1, parent: null, type: 'REVENUE', classif: 'FINANCIAL', balance: 'CREDIT', post: false, monetary: true },
    { code: '7.1', name: 'Costos y Gastos Financieros', level: 2, parent: '7', type: 'EXPENSE', classif: 'FINANCIAL', balance: 'DEBIT', post: false, monetary: true },
    { code: '7.1.01', name: 'Comisiones Bancarias y Débitos IGTF', level: 3, parent: '7.1', type: 'EXPENSE', classif: 'FINANCIAL', balance: 'DEBIT', post: true, monetary: true },
    { code: '7.1.02', name: 'Pérdida en Fluctuación Cambiaria (Diferencia de Cambio)', level: 3, parent: '7.1', type: 'EXPENSE', classif: 'FINANCIAL', balance: 'DEBIT', post: true, monetary: true },

    { code: '7.2', name: 'Ingresos Financieros y Cambiarios', level: 2, parent: '7', type: 'REVENUE', classif: 'FINANCIAL', balance: 'CREDIT', post: false, monetary: true },
    { code: '7.2.01', name: 'Ganancia en Fluctuación Cambiaria (Diferencia de Cambio)', level: 3, parent: '7.2', type: 'REVENUE', classif: 'FINANCIAL', balance: 'CREDIT', post: true, monetary: true },

    { code: '7.3', name: 'Resultado por Exposición a la Inflación (REI - VEN-NIF B-10)', level: 2, parent: '7', type: 'REVENUE', classif: 'OTHER', balance: 'CREDIT', post: false, monetary: false },
    { code: '7.3.01', name: 'Resultado Monetario del Ejercicio (REI Neto)', level: 3, parent: '7.3', type: 'REVENUE', classif: 'OTHER', balance: 'CREDIT', post: true, monetary: false },

    // 8 CUENTAS DE ORDEN
    { code: '8', name: 'CUENTAS DE ORDEN', level: 1, parent: null, type: 'ORDER', classif: 'OTHER', balance: 'DEBIT', post: false, monetary: false },
    { code: '8.1', name: 'Cuentas de Orden Deudoras', level: 2, parent: '8', type: 'ORDER', classif: 'OTHER', balance: 'DEBIT', post: true, monetary: false },
    { code: '8.2', name: 'Cuentas de Orden Acreedoras', level: 2, parent: '8', type: 'ORDER', classif: 'OTHER', balance: 'CREDIT', post: true, monetary: false }
  ];

  // Insertar cuentas asegurando que los padres existan primero (por nivel)
  const codeToIdMap = new Map<string, string>();

  // Ordenar por nivel ascendente
  const sortedAccounts = [...accountsDef].sort((a, b) => a.level - b.level);

  for (const acc of sortedAccounts) {
    const accountId = makeId('acc', `${companyId}-${acc.code}`);
    codeToIdMap.set(acc.code, accountId);

    const parentId = acc.parent ? codeToIdMap.get(acc.parent) || null : null;

    await pool.query(`
      INSERT INTO accounting_accounts (
        id, company_id, code, name, level, parent_id, account_type, classification,
        normal_balance, accepts_postings, is_monetary, is_bank_or_cash, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        level = VALUES(level),
        parent_id = VALUES(parent_id),
        account_type = VALUES(account_type),
        classification = VALUES(classification),
        normal_balance = VALUES(normal_balance),
        accepts_postings = VALUES(accepts_postings),
        is_monetary = VALUES(is_monetary),
        is_bank_or_cash = VALUES(is_bank_or_cash)
    `, [
      accountId,
      companyId,
      acc.code,
      acc.name,
      acc.level,
      parentId,
      acc.type,
      acc.classif,
      acc.balance,
      acc.post ? 1 : 0,
      acc.monetary ? 1 : 0,
      acc.bankCash ? 1 : 0
    ]);
  }
  console.log(`✓ Plan de cuentas VEN-NIF cargado (${sortedAccounts.length} cuentas)`);

  // 5. Crear Comprobante de Apertura (Asiento de Apertura 2026) y Comprobantes de Prueba
  const [existingEntries]: any = await pool.query(
    `SELECT COUNT(*) as count FROM accounting_journal_entries WHERE company_id = ?`,
    [companyId]
  );

  if (existingEntries[0].count === 0) {
    console.log('Generando asientos contables demostrativos con partida doble estricta...');
    
    // Tasa BCV de referencia
    const rateBcv = 75.50;

    // Asiento 1: Apertura de Ejercicio
    const entry1Id = uuidv4();
    const period1Id = periodsMap.get(1);
    await pool.query(`
      INSERT INTO accounting_journal_entries (
        id, company_id, branch_id, period_id, entry_number, entry_date, entry_type,
        concept, currency, exchange_rate, total_debit_ves, total_credit_ves,
        total_debit_usd, total_credit_usd, status, created_by, posted_by, posted_at
      ) VALUES (
        ?, ?, ?, ?, 'AS-2026-00001', '2026-01-02', 'OPENING',
        'Asiento de Apertura del Ejercicio Económico 2026 según Balance Inicial',
        'VES', ?, 7550000.00, 7550000.00, 100000.00, 100000.00, 'POSTED', ?, ?, NOW()
      )
    `, [entry1Id, companyId, branchId, period1Id, rateBcv, adminId, adminId]);

    const lines1 = [
      { code: '1.1.01.04', desc: 'Saldos de Bancos Nacionales Cta Cte', debitVes: 1510000.00, creditVes: 0, debitUsd: 20000.00, creditUsd: 0 },
      { code: '1.1.01.06', desc: 'Disponibilidad Bancaria Moneda Extranjera', debitVes: 2265000.00, creditVes: 0, debitUsd: 30000.00, creditUsd: 0 },
      { code: '1.1.04.01', desc: 'Inventario Inicial de Mercancías', debitVes: 2265000.00, creditVes: 0, debitUsd: 30000.00, creditUsd: 0 },
      { code: '1.2.01.03', desc: 'Mobiliario y Equipos en Uso', debitVes: 1510000.00, creditVes: 0, debitUsd: 20000.00, creditUsd: 0 },
      { code: '2.1.01.01', desc: 'Cuentas por Pagar Proveedores Comerciales', debitVes: 0, creditVes: 755000.00, debitUsd: 0, creditUsd: 10000.00 },
      { code: '3.1.01', desc: 'Capital Social Suscrito y Pagado', debitVes: 0, creditVes: 5285000.00, debitUsd: 0, creditUsd: 70000.00 },
      { code: '3.2.01', desc: 'Reserva Legal Estatutaria', debitVes: 0, creditVes: 755000.00, debitUsd: 0, creditUsd: 10000.00 },
      { code: '3.3.01', desc: 'Utilidades Retenidas Ejercicios Anteriores', debitVes: 0, creditVes: 745000.00, debitUsd: 0, creditUsd: 9867.55 },
    ];

    let order = 1;
    for (const l of lines1) {
      const accId = codeToIdMap.get(l.code);
      if (accId) {
        await pool.query(`
          INSERT INTO accounting_journal_lines (
            id, journal_entry_id, account_id, line_order, description,
            debit_ves, credit_ves, debit_usd, credit_usd, reference_doc
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'BAL-APERTURA-2026')
        `, [uuidv4(), entry1Id, accId, order++, l.desc, l.debitVes, l.creditVes, l.debitUsd, l.creditUsd]);
      }
    }

    // Asiento 2: Venta de Mercancías a Crédito con Débito Fiscal IVA
    const entry2Id = uuidv4();
    const period10Id = periodsMap.get(10);
    await pool.query(`
      INSERT INTO accounting_journal_entries (
        id, company_id, branch_id, period_id, entry_number, entry_date, entry_type,
        concept, currency, exchange_rate, total_debit_ves, total_credit_ves,
        total_debit_usd, total_credit_usd, status, created_by, posted_by, posted_at
      ) VALUES (
        ?, ?, ?, ?, 'AS-2026-00002', '2026-10-15', 'STANDARD',
        'Registro de ventas comerciales del período según Libro de Ventas Fiscal',
        'VES', ?, 580000.00, 580000.00, 7682.12, 7682.12, 'POSTED', ?, ?, NOW()
      )
    `, [entry2Id, companyId, branchId, period10Id, rateBcv, adminId, adminId]);

    const lines2 = [
      { code: '1.1.02.01', desc: 'Cuentas por Cobrar Facturas Comerciales SENIAT', debitVes: 580000.00, creditVes: 0, debitUsd: 7682.12, creditUsd: 0 },
      { code: '4.1.01', desc: 'Ventas de Mercancías Gravadas Alícuota General 16%', debitVes: 0, creditVes: 500000.00, debitUsd: 0, creditUsd: 6622.52 },
      { code: '2.1.02.01', desc: 'IVA Débito Fiscal 16% Facturado', debitVes: 0, creditVes: 80000.00, debitUsd: 0, creditUsd: 1059.60 },
    ];

    order = 1;
    for (const l of lines2) {
      const accId = codeToIdMap.get(l.code);
      if (accId) {
        await pool.query(`
          INSERT INTO accounting_journal_lines (
            id, journal_entry_id, account_id, line_order, description,
            debit_ves, credit_ves, debit_usd, credit_usd, reference_doc
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'FAC-000452')
        `, [uuidv4(), entry2Id, accId, order++, l.desc, l.debitVes, l.creditVes, l.debitUsd, l.creditUsd]);
      }
    }

    // Asiento 3: Costo de Ventas
    const entry3Id = uuidv4();
    await pool.query(`
      INSERT INTO accounting_journal_entries (
        id, company_id, branch_id, period_id, entry_number, entry_date, entry_type,
        concept, currency, exchange_rate, total_debit_ves, total_credit_ves,
        total_debit_usd, total_credit_usd, status, created_by, posted_by, posted_at
      ) VALUES (
        ?, ?, ?, ?, 'AS-2026-00003', '2026-10-15', 'STANDARD',
        'Determinación y salida del Costo de Ventas de mercancía despachada',
        'VES', ?, 280000.00, 280000.00, 3708.61, 3708.61, 'POSTED', ?, ?, NOW()
      )
    `, [entry3Id, companyId, branchId, period10Id, rateBcv, adminId, adminId]);

    const lines3 = [
      { code: '5.1.01', desc: 'Costo de Mercancía Vendida en el Período', debitVes: 280000.00, creditVes: 0, debitUsd: 3708.61, creditUsd: 0 },
      { code: '1.1.04.01', desc: 'Salida de Inventario al Costo Promedio', debitVes: 0, creditVes: 280000.00, debitUsd: 0, creditUsd: 3708.61 },
    ];

    order = 1;
    for (const l of lines3) {
      const accId = codeToIdMap.get(l.code);
      if (accId) {
        await pool.query(`
          INSERT INTO accounting_journal_lines (
            id, journal_entry_id, account_id, line_order, description,
            debit_ves, credit_ves, debit_usd, credit_usd, reference_doc
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'KDX-SAL-1026')
        `, [uuidv4(), entry3Id, accId, order++, l.desc, l.debitVes, l.creditVes, l.debitUsd, l.creditUsd]);
      }
    }

    // Asiento 4: Gastos Operacionales (Nómina y Servicios)
    const entry4Id = uuidv4();
    await pool.query(`
      INSERT INTO accounting_journal_entries (
        id, company_id, branch_id, period_id, entry_number, entry_date, entry_type,
        concept, currency, exchange_rate, total_debit_ves, total_credit_ves,
        total_debit_usd, total_credit_usd, status, created_by, posted_by, posted_at
      ) VALUES (
        ?, ?, ?, ?, 'AS-2026-00004', '2026-10-20', 'STANDARD',
        'Pago de Nómina quincenal y servicios públicos por transferencia bancaria',
        'VES', ?, 115000.00, 115000.00, 1523.18, 1523.18, 'POSTED', ?, ?, NOW()
      )
    `, [entry4Id, companyId, branchId, period10Id, rateBcv, adminId, adminId]);

    const lines4 = [
      { code: '6.1.01', desc: 'Sueldos y Salarios del Personal Operativo', debitVes: 85000.00, creditVes: 0, debitUsd: 1125.83, creditUsd: 0 },
      { code: '6.1.04', desc: 'Servicios de Telecomunicaciones e Internet', debitVes: 30000.00, creditVes: 0, debitUsd: 397.35, creditUsd: 0 },
      { code: '1.1.01.04', desc: 'Desembolso Banco Mercantil Cta Cte', debitVes: 0, creditVes: 115000.00, debitUsd: 0, creditUsd: 1523.18 },
    ];

    order = 1;
    for (const l of lines4) {
      const accId = codeToIdMap.get(l.code);
      if (accId) {
        await pool.query(`
          INSERT INTO accounting_journal_lines (
            id, journal_entry_id, account_id, line_order, description,
            debit_ves, credit_ves, debit_usd, credit_usd, reference_doc
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'TRF-992019')
        `, [uuidv4(), entry4Id, accId, order++, l.desc, l.debitVes, l.creditVes, l.debitUsd, l.creditUsd]);
      }
    }

    console.log('✓ 4 comprobantes contables creados con partida doble estricta.');
  }

  console.log('--- Migración y Configuración Contable Finalizada con Éxito ---');
  process.exit(0);
}

runAccountingMigration().catch(err => {
  console.error('Error durante la migración contable:', err);
  process.exit(1);
});
