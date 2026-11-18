export interface StandardAccountDef {
  code: string;
  name: string;
  level: number;
  parent: string | null;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COST' | 'EXPENSE' | 'ORDER';
  classif: 'CURRENT' | 'NON_CURRENT' | 'OPERATING' | 'FINANCIAL' | 'OTHER';
  balance: 'DEBIT' | 'CREDIT';
  post: boolean;
  monetary: boolean;
  bankCash?: boolean;
}

export const STANDARD_CHART_OF_ACCOUNTS: StandardAccountDef[] = [
  // 1. ACTIVO
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

  // 2. PASIVO
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

  // 3. PATRIMONIO
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

  // 4. INGRESOS
  { code: '4', name: 'INGRESOS', level: 1, parent: null, type: 'REVENUE', classif: 'OPERATING', balance: 'CREDIT', post: false, monetary: true },
  { code: '4.1', name: 'Ingresos Operacionales de Ventas', level: 2, parent: '4', type: 'REVENUE', classif: 'OPERATING', balance: 'CREDIT', post: false, monetary: true },
  { code: '4.1.01', name: 'Ventas de Mercancías Gravadas con IVA', level: 3, parent: '4.1', type: 'REVENUE', classif: 'OPERATING', balance: 'CREDIT', post: true, monetary: true },
  { code: '4.1.02', name: 'Ventas de Mercancías Exentas / Exoneradas', level: 3, parent: '4.1', type: 'REVENUE', classif: 'OPERATING', balance: 'CREDIT', post: true, monetary: true },
  { code: '4.1.03', name: 'Descuentos y Rebajas en Ventas', level: 3, parent: '4.1', type: 'REVENUE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },
  { code: '4.1.04', name: 'Devoluciones en Ventas', level: 3, parent: '4.1', type: 'REVENUE', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: true },

  // 5. COSTOS
  { code: '5', name: 'COSTOS DE VENTAS Y OPERACIÓN', level: 1, parent: null, type: 'COST', classif: 'OPERATING', balance: 'DEBIT', post: false, monetary: false },
  { code: '5.1', name: 'Costo de Ventas', level: 2, parent: '5', type: 'COST', classif: 'OPERATING', balance: 'DEBIT', post: false, monetary: false },
  { code: '5.1.01', name: 'Costo de Mercancía Vendida', level: 3, parent: '5.1', type: 'COST', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: false },
  { code: '5.1.02', name: 'Fletes y Aranceles de Importación', level: 3, parent: '5.1', type: 'COST', classif: 'OPERATING', balance: 'DEBIT', post: true, monetary: false },

  // 6. GASTOS OPERACIONALES
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

  // 7. OTROS INGRESOS / EGRESOS Y DIFERENCIA EN CAMBIO
  { code: '7', name: 'INGRESOS Y EGRESOS EXTRAORDINARIOS Y FINANCIEROS', level: 1, parent: null, type: 'REVENUE', classif: 'FINANCIAL', balance: 'CREDIT', post: false, monetary: true },
  { code: '7.1', name: 'Costos y Gastos Financieros', level: 2, parent: '7', type: 'EXPENSE', classif: 'FINANCIAL', balance: 'DEBIT', post: false, monetary: true },
  { code: '7.1.01', name: 'Comisiones Bancarias y Débitos IGTF', level: 3, parent: '7.1', type: 'EXPENSE', classif: 'FINANCIAL', balance: 'DEBIT', post: true, monetary: true },
  { code: '7.1.02', name: 'Pérdida en Fluctuación Cambiaria (Diferencia de Cambio)', level: 3, parent: '7.1', type: 'EXPENSE', classif: 'FINANCIAL', balance: 'DEBIT', post: true, monetary: true },

  { code: '7.2', name: 'Ingresos Financieros y Cambiarios', level: 2, parent: '7', type: 'REVENUE', classif: 'FINANCIAL', balance: 'CREDIT', post: false, monetary: true },
  { code: '7.2.01', name: 'Ganancia en Fluctuación Cambiaria (Diferencia de Cambio)', level: 3, parent: '7.2', type: 'REVENUE', classif: 'FINANCIAL', balance: 'CREDIT', post: true, monetary: true },

  { code: '7.3', name: 'Resultado por Exposición a la Inflación (REI - VEN-NIF B-10)', level: 2, parent: '7', type: 'REVENUE', classif: 'OTHER', balance: 'CREDIT', post: false, monetary: false },
  { code: '7.3.01', name: 'Resultado Monetario del Ejercicio (REI Neto)', level: 3, parent: '7.3', type: 'REVENUE', classif: 'OTHER', balance: 'CREDIT', post: true, monetary: false },

  // 8. CUENTAS DE ORDEN
  { code: '8', name: 'CUENTAS DE ORDEN', level: 1, parent: null, type: 'ORDER', classif: 'OTHER', balance: 'DEBIT', post: false, monetary: false },
  { code: '8.1', name: 'Cuentas de Orden Deudoras', level: 2, parent: '8', type: 'ORDER', classif: 'OTHER', balance: 'DEBIT', post: true, monetary: false },
  { code: '8.2', name: 'Cuentas de Orden Acreedoras', level: 2, parent: '8', type: 'ORDER', classif: 'OTHER', balance: 'CREDIT', post: true, monetary: false },
];

export const DEFAULT_ACCOUNT_MAPPINGS: Record<string, { code: string; desc: string }> = {
  CASH_VES: { code: '1.1.01.01', desc: 'Caja Principal (Efectivo VES)' },
  CASH_USD: { code: '1.1.01.03', desc: 'Caja en Moneda Extranjera (USD)' },
  BANK_DEFAULT: { code: '1.1.01.04', desc: 'Banco Mercantil Cta Cte (VES)' },
  ACCOUNTS_RECEIVABLE: { code: '1.1.02.01', desc: 'Clientes Nacionales Comerciales' },
  ACCOUNTS_RECEIVABLE_USD: { code: '1.1.02.02', desc: 'Clientes en Moneda Extranjera (USD)' },
  TAX_CREDIT_IVA: { code: '1.1.03.01', desc: 'IVA Crédito Fiscal' },
  TAX_RETENTION_IVA_RECEIVED: { code: '1.1.03.02', desc: 'Retenciones de IVA Soportadas por Compensar' },
  TAX_RETENTION_ISLR_RECEIVED: { code: '1.1.03.03', desc: 'Retenciones de ISLR Acumuladas por Compensar' },
  INVENTORY: { code: '1.1.04.01', desc: 'Inventario de Mercancías para la Venta' },
  ACCOUNTS_PAYABLE: { code: '2.1.01.01', desc: 'Proveedores Nacionales' },
  ACCOUNTS_PAYABLE_USD: { code: '2.1.01.02', desc: 'Proveedores Extranjeros / Divisas' },
  TAX_DEBIT_IVA: { code: '2.1.02.01', desc: 'IVA Débito Fiscal' },
  TAX_RETENTION_IVA_PAYABLE: { code: '2.1.02.02', desc: 'Retenciones de IVA por Enterar al SENIAT' },
  TAX_RETENTION_ISLR_PAYABLE: { code: '2.1.02.03', desc: 'Retenciones de ISLR por Enterar al SENIAT' },
  TAX_IGTF_PAYABLE: { code: '2.1.02.05', desc: 'IGTF por Enterar al SENIAT' },
  SALES_REVENUE: { code: '4.1.01', desc: 'Ventas de Mercancías Gravadas con IVA' },
  SALES_REVENUE_EXEMPT: { code: '4.1.02', desc: 'Ventas de Mercancías Exentas / Exoneradas' },
  COST_OF_SALES: { code: '5.1.01', desc: 'Costo de Mercancía Vendida' },
  EXCHANGE_DIFF_GAIN: { code: '7.2.01', desc: 'Ganancia en Fluctuación Cambiaria' },
  EXCHANGE_DIFF_LOSS: { code: '7.1.02', desc: 'Pérdida en Fluctuación Cambiaria' },
  REI_RESULT: { code: '7.3.01', desc: 'Resultado Monetario del Ejercicio (REI Neto)' },
};
