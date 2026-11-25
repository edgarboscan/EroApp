export interface GuideStep {
  title: string;
  description: string;
  tip?: string;
}

export interface GuideItem {
  id: string;
  category: string;
  title: string;
  purpose: string;
  summary: string;
  steps: GuideStep[];
  rules?: string[];
}

export interface BadgeExplanation {
  term: string;
  spanish: string;
  category: string;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  meaning: string;
  usageContext: string;
}

export interface BusinessRuleExplanation {
  name: string;
  legalContext: string;
  description: string;
  configurationGuide: string;
  auditImpact: string;
}

export interface AccountingMappingDoc {
  key: string;
  accountCode: string;
  accountName: string;
  circuit: string;
  behavior: string;
}

export interface AccountingCircuitDoc {
  process: string;
  trigger: string;
  debitAccounts: string;
  creditAccounts: string;
  notes: string;
}

export const USER_GUIDES: GuideItem[] = [
  {
    id: 'dashboard-general',
    category: 'Dashboard & Indicadores',
    title: 'Tablero Ejecutivo, KPIs y Tasa Oficial BCV en Tiempo Real',
    purpose: 'Brindar a la gerencia una visión consolidada e inmediata de la salud financiera, ventas del día, liquidez en bancos, cuentas por cobrar/pagar y alertas operativas.',
    summary: 'Cómo interpretar los indicadores clave, cambiar de sucursal o empresa y monitorear la tasa oficial del BCV desde la barra superior.',
    steps: [
      {
        title: '1. Selector de Empresa, Sede y Almacén Activo',
        description: 'En la barra superior (TopBar), verifique en todo momento en qué Empresa, Sucursal (Sede) y Almacén está trabajando. Todos los indicadores y operaciones se filtran según este contexto.',
      },
      {
        title: '2. Monitoreo y Actualización de la Tasa BCV',
        description: 'El indicador BCV en la barra superior muestra la tasa vigente en Bolívares por USD. Los usuarios autorizados pueden hacer clic en el botón de lápiz o sincronización para actualizarla manualmente o consultar la tasa oficial del día.',
        tip: 'Toda facturación POS, conversión USD/VES en pagos a proveedores y asientos contables multimoneda utilizan esta tasa oficial al momento de la transacción.',
      },
      {
        title: '3. Lectura de Tarjetas KPI y Gráficos',
        description: 'El Dashboard agrupa Ventas Netas, Ticket Promedio, Utilidad Bruta, Saldo en Bancos, CxC vencidas y CxP pendientes. Haga clic en los accesos rápidos para navegar directamente al módulo correspondiente.',
      },
    ],
    rules: [
      'La visibilidad de cifras financieras sensibles depende de los permisos asignados al rol del usuario.',
    ],
  },
  {
    id: 'pos-cash-shift',
    category: 'Ventas & Puntos de Venta',
    title: 'Apertura, Operación y Cierre de Caja con Arqueo Ciego',
    purpose: 'Controlar el flujo físico de efectivo y puntos de venta por turno y cajero, evitando faltantes no justificados mediante arqueo ciego.',
    summary: 'Procedimiento obligatorio para iniciar turno, registrar cobros, declarar efectivo y conciliar diferencias al finalizar la jornada.',
    steps: [
      {
        title: '1. Selección de Sucursal y Caja Asignada',
        description: 'Al iniciar sesión, verifique en la barra superior la Sucursal y Caja activa. Si ya tiene una caja asignada o un turno en curso, el sistema bloqueará el cambio a otra caja para evitar inconsistencias contables.',
      },
      {
        title: '2. Apertura de Turno con Fondo Inicial',
        description: 'Ingrese a "Ventas & Puntos de Venta > Cierre de Caja & Arqueo". Haga clic en "Abrir Turno de Caja", ingrese el fondo de cambio inicial en Divisas ($) y Bolívares (Bs), e indique observaciones si las hay.',
      },
      {
        title: '3. Operación de Facturación en Punto de Venta (POS)',
        description: 'Diríjase a "Ventas & Puntos de Venta > Punto de Venta (POS)". Busque productos por código de barras, nombre o departamento asignado a la caja. Agregue ítems, seleccione el cliente y procese las formas de pago combinadas.',
      },
      {
        title: '4. Arqueo Ciego de Cierre y Semáforo de Cuadre',
        description: 'Al finalizar la jornada, haga clic en "Cierre de Turno". Cuente físicamente todo el dinero en gaveta e ingrese el total real contado. El sistema contrastará contra las ventas teóricas del lote mostrando un semáforo (Verde: cuadrado, Amarillo: diferencia menor, Rojo: descuadre significativo).',
        tip: 'Ante un descuadre significativo, el sistema exige redactar una justificación obligatoria antes de permitir cerrar el turno.',
      },
      {
        title: '5. Acta Oficial de Cierre en PDF y Verificación',
        description: 'Al confirmar el cierre, se genera automáticamente el Acta Oficial en PDF con el desglose de ventas por método de pago, IGTF y bases imponibles. Luego, el supervisor audita y deposita el lote desde "Verificación de Arqueos".',
      },
    ],
    rules: [
      'No se permite abrir más de un turno simultáneo en la misma caja registradora.',
      'El arqueo ciego exige que el cajero cuente el efectivo sin conocer de antemano el saldo teórico del sistema.',
    ],
  },
  {
    id: 'pos-sales-billing',
    category: 'Ventas & Puntos de Venta',
    title: 'Facturación POS, Pagos Mixtos, IGTF (3%) y XML Fiscal',
    purpose: 'Emitir comprobantes de venta legales en doble moneda, aplicar retenciones/impuestos de ley venezolanos (IVA 16% e IGTF 3%) y descargar el respaldo XML.',
    summary: 'Cómo facturar al contado o a crédito, dividir pagos entre múltiples métodos y emitir comprobantes fiscales homologados.',
    steps: [
      {
        title: '1. Registro o Selección del Cliente',
        description: 'Busque al cliente por RIF o Cédula. Si no existe, utilice el registro rápido indicando razón social y dirección fiscal para cumplir con los requisitos del SENIAT.',
      },
      {
        title: '2. Selección de Productos y Listas de Precios',
        description: 'Escanee los códigos de barra o busque en el catálogo. La caja solo mostrará los productos de los departamentos habilitados para esa terminal (o todo el catálogo si no hay restricción).',
      },
      {
        title: '3. Desglose de Formas de Pago Mixtas',
        description: 'En el modal de cobro, distribuya el monto entre Efectivo Divisas ($), Efectivo Bs, Pago Móvil, Punto de Venta Débito/Crédito, Zelle o Venta a Crédito. El sistema convierte en tiempo real usando la tasa BCV.',
      },
      {
        title: '4. Aplicación Automática de IGTF Divisas (3%) y Descarga XML',
        description: 'Cualquier porción cobrada en divisas o efectivo en moneda extranjera calcula automáticamente el 3% de IGTF. Tras facturar, puede imprimir el ticket PDF o descargar el archivo XML Fiscal desde el visor.',
      },
    ],
  },
  {
    id: 'sales-quotes-credit',
    category: 'Ventas & Puntos de Venta',
    title: 'Cotizaciones, Ventas a Crédito y Cuentas por Cobrar (CxC)',
    purpose: 'Formalizar presupuestos comerciales para clientes y controlar los saldos pendientes de cobro, límites de crédito y abonos.',
    summary: 'Flujo desde la creación de una cotización hasta su conversión en factura y cobranza en CxC.',
    steps: [
      {
        title: '1. Creación de Cotización / Presupuesto',
        description: 'En "Ventas & Puntos de Venta > Cotizaciones", cree un presupuesto indicando cliente, vigencia y productos. Puede enviarlo en PDF por correo directamente desde el visor.',
      },
      {
        title: '2. Conversión Directa a Factura',
        description: 'Cuando el cliente aprueba la cotización, presione "Facturar Cotización" para convertirla en una factura formal sin volver a cargar los artículos.',
      },
      {
        title: '3. Gestión de Cobranzas (CxC)',
        description: 'Las ventas a crédito generan una Cuenta por Cobrar. Desde "Clientes & CxC", consulte la antigüedad de saldos, registre abonos totales o parciales e imprima el recibo de cobro.',
      },
    ],
  },
  {
    id: 'sales-notes',
    category: 'Ventas & Puntos de Venta',
    title: 'Devoluciones, Notas de Crédito y Débito de Ventas (SENIAT)',
    purpose: 'Anular o ajustar fiscalmente facturas emitidas sin borrar registros históricos, reingresando el inventario y revirtiendo el débito fiscal.',
    summary: 'Emisión de Notas de Crédito y Débito asociadas a facturas de venta con efecto automático en CxC, Inventario y Contabilidad.',
    steps: [
      {
        title: '1. Acceder al Módulo de Notas',
        description: 'Ingrese a "Ventas & Puntos de Venta > Notas Crédito / Débito" y seleccione el tipo de documento a emitir.',
      },
      {
        title: '2. Seleccionar Cliente y Factura Origen',
        description: 'Indique la factura de referencia. Si es devolución total o parcial, seleccione los ítems y cantidades devueltas.',
      },
      {
        title: '3. Confirmación e Impacto Integral',
        description: 'Al emitir la nota, el sistema reingresa la mercancía al almacén, ajusta el saldo de CxC del cliente y contabiliza automáticamente el reverso de ventas e IVA Débito Fiscal.',
      },
    ],
  },
  {
    id: 'restaurant-orders',
    category: 'Restaurante & Comandas',
    title: 'Toma de Pedidos en Mesas, Cocina (KDS), Split Bill y Propinas',
    purpose: 'Agilizar la atención en sala y barra conectando en tiempo real a los meseros con cocina, permitiendo dividir cuentas y liquidar propinas.',
    summary: 'Gestión de salones, envío de comandas al monitor KDS, pre-cuenta, división de cuenta y reporte de propinas.',
    steps: [
      {
        title: '1. Apertura de Mesa o Barra',
        description: 'En "Restaurante & Comandas > Toma de Pedidos (Mesas)", seleccione el salón y haga clic en una mesa libre. Indique número de comensales y mesero.',
      },
      {
        title: '2. Carga de Platos y Notas de Preparación',
        description: 'Agregue bebidas y platos especificando notas para cocina (ej. "término medio", "sin cebolla").',
      },
      {
        title: '3. Envío a Cocina & Barra (KDS)',
        description: 'Presione "Enviar a Cocina". Los ítems aparecen al instante en "Cocina & Barra (KDS)" en estado PENDING y avanzan a COOKING y READY conforme cocina los prepara.',
      },
      {
        title: '4. Pre-cuenta, División de Cuenta (Split Bill) y Propinas',
        description: 'Genere la pre-cuenta para el cliente. Si desean pagar por separado, use "Dividir Cuenta" para facturar por comensal y consulte el acumulado en "Reporte de Propinas".',
      },
    ],
  },
  {
    id: 'suppliers-directory',
    category: 'Compras & Cuentas por Pagar',
    title: 'Directorio de Proveedores, Validación RIF SENIAT y Datos Bancarios',
    purpose: 'Mantener un padrón fiscalmente válido de proveedores con sus coordenadas bancarias listas para ejecutar transferencias, pago móvil o Zelle.',
    summary: 'Alta de proveedores con validación Módulo 11, consulta en portal SENIAT y registro de cuentas receptoras.',
    steps: [
      {
        title: '1. Ingreso del RIF y Validación Módulo 11',
        description: 'En "Compras & Abastecimiento > Directorio de Proveedores", haga clic en "Nuevo Proveedor". Al ingresar el RIF (ej. J-12345678-9), el sistema valida matemáticamente el dígito verificador SENIAT y autocompleta si ya existe.',
      },
      {
        title: '2. Verificación en Portal SENIAT',
        description: 'Use el botón "Portal SENIAT" para validar en línea la razón social oficial y condición de Contribuyente Especial.',
      },
      {
        title: '3. Registro de Coordenadas Bancarias del Proveedor',
        description: 'En la ficha del proveedor, registre su Cuenta Bancaria (20 dígitos), teléfono/banco de Pago Móvil y correo Zelle. Estos datos se mostrarán listos para copiar cuando Tesorería ejecute el pago.',
      },
    ],
  },
  {
    id: 'purchases-payables-workflow',
    category: 'Compras & Cuentas por Pagar',
    title: 'Ciclo Completo de Compras, Verificación en CxP y Envío a Tesorería',
    purpose: 'Garantizar el control interno segregando funciones: quien recibe o revisa la factura en CxP la verifica, y Tesorería ejecuta el desembolso bancario real.',
    summary: 'Flujo completo desde la Orden de Compra y Recepción de Mercancía hasta la Verificación en CxP y autorización de pago.',
    steps: [
      {
        title: '1. Orden de Compra y Recepción de Mercancía',
        description: 'Cree la Orden de Compra en "Compras & Abastecimiento > Órdenes de Compra". Al llegar la mercancía física, regístrela en "Recepción de Mercancía" indicando N° de Factura, N° de Control, fecha de vencimiento y costos. Esto ingresa el stock al almacén y crea la deuda en CxP.',
      },
      {
        title: '2. Verificación de Factura en Cuentas por Pagar (CxP)',
        description: 'Ingrese a "Cuentas por Pagar (CxP)" o al Estado de Cuenta del proveedor. Toda factura pendiente nace en estado "Por Verificar". El analista de CxP revisa los soportes y presiona el botón "Verificar" / "Verificar Factura".',
        tip: 'Solo las facturas con estado "Verificada" aparecen en la bandeja "Pagos a Proveedores por Procesar" del módulo de Tesorería.',
      },
      {
        title: '3. Segregación de Permisos: Verificar vs. Pagar',
        description: 'Si el usuario posee permiso de pago (canPay), verá tanto el botón "Verificar" como "Pagar". Si el usuario es únicamente de CxP/Compras sin permiso de pago en Tesorería, solo podrá "Verificar Factura" para enviarla a la cola de Tesorería.',
      },
      {
        title: '4. Notas de Crédito / Débito de Proveedores',
        description: 'Ante devoluciones o descuentos sobre compras, registre el documento en "Notas Crédito / Débito" de Compras para rebajar automáticamente la deuda en CxP y ajustar el inventario y crédito fiscal.',
      },
    ],
    rules: [
      'Ninguna factura sin verificar en CxP puede ser procesada desde la cola de Pagos por Procesar en Tesorería.',
      'Toda factura de compra aprobada genera automáticamente su asiento contable (Inventario + IVA Crédito Fiscal contra Proveedores).',
    ],
  },
  {
    id: 'treasury-payments-banks',
    category: 'Tesorería & Bancos',
    title: 'Cuentas Bancarias, Ejecución de Pagos a Proveedores y Conciliación',
    purpose: 'Centralizar el control real de la liquidez bancaria en Bolívares y Divisas, ejecutar pagos con conversión automática BCV, emitir comprobantes PDF y generar el asiento contable exacto.',
    summary: 'Cómo administrar bancos en VES/USD, procesar facturas verificadas de CxP, registrar movimientos y conciliar extractos.',
    steps: [
      {
        title: '1. Registro de Cuentas Bancarias (VES y USD) y Vínculo Contable',
        description: 'En "Tesorería & Bancos", cree sus cuentas bancarias indicando banco, número de cuenta, tipo y moneda (VES o USD). El sistema vincula automáticamente cada cuenta VES a la cuenta contable 1.1.01.04 y cada cuenta USD a la 1.1.01.06.',
      },
      {
        title: '2. Ejecución de Pago a Proveedores por Procesar',
        description: 'En la pestaña "Pagos a Proveedores por Procesar" de Tesorería se listan exclusivamente las facturas verificadas en CxP. Haga clic en "Pagar", seleccione la moneda de pago (USD o VES) y la cuenta bancaria origen.',
        tip: 'Al cambiar la moneda de pago entre USD y VES, el monto a pagar se recalcula automáticamente utilizando la tasa oficial BCV vigente, evitando errores de cálculo manual.',
      },
      {
        title: '3. Comprobante PDF y Orden Contable Automática',
        description: 'Al confirmar el pago: (1) se descuenta el saldo de la cuenta bancaria, (2) se amortiza la factura en CxP, (3) se genera el Comprobante de Pago en PDF listo para imprimir/enviar, y (4) se contabiliza la salida del banco exacto (1.1.01.04 si es VES o 1.1.01.06 si es USD).',
      },
      {
        title: '4. Movimientos Bancarios Directos y Conciliación',
        description: 'Registre depósitos, retiros, comisiones bancarias o transferencias entre cuentas desde el libro de movimientos, y ejecute la Conciliación Bancaria mensual comparando contra el estado de cuenta del banco.',
      },
    ],
    rules: [
      'Los pagos en USD o desde cuentas bancarias en divisas se imputan contablemente a la cuenta 1.1.01.06 (Bancos Moneda Extranjera / Divisas USD), nunca a la cuenta en bolívares.',
    ],
  },
  {
    id: 'inventory-kardex',
    category: 'Inventario & Almacenes',
    title: 'Catálogo de Productos, Kardex Multimoneda y Traslados entre Sedes',
    purpose: 'Mantener el control exacto de existencias por almacén, costos promedio ponderados en USD/VES y trazabilidad de cada entrada o salida.',
    summary: 'Clasificación jerárquica (Departamentos, Grupos, Subgrupos), consulta de Kardex, traslados y ajustes de inventario.',
    steps: [
      {
        title: '1. Organización por Departamentos, Grupos y Subgrupos',
        description: 'Clasifique sus artículos en 3 niveles para habilitar filtros en reportes, márgenes por categoría y restricción de departamentos en cajas POS.',
      },
      {
        title: '2. Consulta de Kardex Valorado',
        description: 'En "Inventario & Almacenes > Kardex", seleccione un producto y almacén para auditar cada movimiento (Compra, Venta, Nota de Crédito, Ajuste o Traslado) con su costo unitario y saldo resultante.',
      },
      {
        title: '3. Traslados entre Almacenes y Ajustes de Inventario',
        description: 'Use "Traslados" para mover mercancía entre sucursales (genera estado IN_TRANSIT hasta ser recibido). Use "Ajustes de Inventario" para entradas, salidas o mermas justificadas con impacto contable automático.',
      },
    ],
  },
  {
    id: 'inventory-production-butchery',
    category: 'Inventario & Almacenes',
    title: 'Producción, Desposte por Etapas y Control de Merma',
    purpose: 'Transformar un producto base o en canal (ej. 500 kg) en piezas intermedias o cortes finales con pesos variables medidos en balanza, controlando qué productos admiten merma y contabilizando la pérdida.',
    summary: 'Flujo completo de despiece parcial, subdivisión en cortes finales, asignación de costos, motivos de merma y su impacto contable.',
    steps: [
      {
        title: '1. Configuración de Productos y Motivos de Merma',
        description: 'En "Inventario & Almacenes > Producción, Desposte & Merma > Configuración de Productos & Motivos", active "Admite Merma" únicamente en los productos que generan desperdicio (ej. carnes en canal). Defina si cada SKU es Base/Canal o Corte/Derivado y gestione los Motivos de Merma (Hueso y Grasa, Deshidratación, Recorte, etc.).',
      },
      {
        title: '2. Despiece Parcial / Extracción de Pieza Intermedia',
        description: 'Cree una "Nueva Orden de Desposte" eligiendo el almacén y tipo "Despiece Parcial (Pieza Intermedia)". Seleccione el producto base (ej. Carne en canal 500 kg) e indique la cantidad extraída (ej. 80 kg) y el producto intermedio resultante (ej. Pata de Res). El sistema descuenta 80 kg del producto base (dejando 420 kg) e ingresa la pieza intermedia al inventario.',
      },
      {
        title: '3. Subdivisión en Cortes Finales y Registro de Merma',
        description: 'Desde la orden completada, presione "Subdividir" sobre la pieza intermedia (o cree una orden de "Despiece Total"). Agregue cada corte final obtenido (Lomito, Carne de Primera, etc.) con su peso real medido. Si el producto admite merma, asigne la diferencia no aprovechable (ej. 15 kg de hueso/grasa) al motivo de merma correspondiente.',
        tip: 'Si el producto base NO tiene activo "Admite Merma", el sistema bloqueará cualquier intento de registrar desperdicio para proteger la exactitud del inventario.',
      },
      {
        title: '4. Costeo e Impacto Contable Automático',
        description: 'Con "Prorrateo Proporcional al Peso Útil", el costo total consumido se reparte entre los cortes vendibles (absorbiendo la merma en su costo unitario). Con "Costo Unitario Base Directo" o en "Registrar Merma Directa", el sistema genera automáticamente un asiento contable debitando 5.1.01 (INVENTORY_ADJUST_EXPENSE) contra 1.1.04.01 (Inventario de Mercancías).',
      },
    ],
    rules: [
      'Conservación de masa: La suma de derivados más la merma nunca puede superar la cantidad consumida del producto base.',
      'Trazabilidad en Kardex: Cada consumo (OUT), ingreso de corte (IN) y merma directa (ADJUST_OUT) queda registrado en el Kardex con el N° de Orden de Producción.',
    ],
  },
  {
    id: 'pricing-bcv-rates',
    category: 'Precios & Tarifas',
    title: 'Listas de Precios, Actualización Masiva y Tasa BCV',
    purpose: 'Proteger los márgenes de ganancia actualizando precios de venta de forma masiva o diferenciada por lista de precios frente a la variación cambiaria.',
    summary: 'Configuración de tarifas (Detal, Mayor, VIP), cálculo de márgenes sobre costo y actualización por lotes.',
    steps: [
      {
        title: '1. Gestión de Listas de Precios',
        description: 'Cree listas de precios para distintos canales (Mostrador, Mayorista, Distribuidor) asignando porcentajes de utilidad o precios fijos.',
      },
      {
        title: '2. Actualización Masiva de Precios',
        description: 'Filtre productos por departamento o proveedor y aplique ajustes porcentuales en lote con previsualización antes de confirmar.',
      },
    ],
  },
  {
    id: 'taxes-export-seniat',
    category: 'Tributario & Fiscalidad SENIAT',
    title: 'Retenciones IVA / ISLR, Libros Fiscales y Exportación TXT / XML SENIAT',
    purpose: 'Cumplir con las obligaciones de Sujetos Pasivos Especiales en Venezuela generando comprobantes legales y archivos declarativos sin errores de formato.',
    summary: 'Emisión de comprobantes de retención, consulta de Libros de Compra y Venta y descarga de archivos TXT (IVA) y XML (ISLR).',
    steps: [
      {
        title: '1. Emisión de Comprobantes de Retención (IVA / ISLR)',
        description: 'Al registrar compras a proveedores sujetos a retención (75% o 100% IVA, o porcentaje ISLR según decreto 1808), el sistema calcula y genera el comprobante correlativo en PDF.',
      },
      {
        title: '2. Descarga de TXT IVA (Quincenal o Mensual)',
        description: 'En "Tributario & Fiscalidad SENIAT > Retenciones Tributarias", presione "TXT IVA", seleccione 1ra Quincena, 2da Quincena o Mes Completo y descargue el archivo tabulado homologado bajo Providencia SNAT/2015/0049.',
      },
      {
        title: '3. Descarga de XML ISLR y Libros Legales',
        description: 'Descargue el archivo XML de retenciones de ISLR y genere los Libros de Compra y Venta mensuales listos para auditoría fiscal.',
      },
    ],
    rules: [
      'El sistema previene la generación de archivos declarativos vacíos si no existen retenciones activas en el período.',
    ],
  },
  {
    id: 'reports-email-smtp',
    category: 'Reportes & Comunicaciones',
    title: 'Visor Universal de PDF, Reportes Gerenciales y Envío por Correo SMTP',
    purpose: 'Centralizar la visualización, impresión y distribución de todos los documentos legales y gerenciales en PDF.',
    summary: 'Cómo previsualizar reportes, imprimir desde el visor PDF y enviar documentos por correo usando el servidor SMTP empresarial.',
    steps: [
      {
        title: '1. Visor PDF Integrado',
        description: 'Todo reporte, factura, comprobante de pago, estado financiero y este mismo Manual de Usuario se abren en el Visor PDF del sistema, con opciones de Imprimir, Descargar PDF, Compartir y Enviar por Correo.',
      },
      {
        title: '2. Envío Directo por Correo Corporativo',
        description: 'Desde el visor presione "Enviar por Correo". Si configuró su SMTP en "Configuración > Empresa & Reglas > Servidor de Correo (SMTP)", el sistema enviará el PDF adjunto desde su dominio corporativo (contraseña cifrada con AES-256-GCM).',
      },
    ],
  },
  {
    id: 'security-roles-chat-audit',
    category: 'Configuración & Auditoría',
    title: 'Roles, Permisos Granulares, Chat Interno y Bitácora de Auditoría',
    purpose: 'Asegurar el control de acceso por perfil de cargo, facilitar la comunicación interna auditada y registrar cada acción crítica del sistema.',
    summary: 'Administración de usuarios, clonación de roles, mensajería interna con presencia en vivo y consulta de bitácora.',
    steps: [
      {
        title: '1. Gestión de Usuarios y Clonación de Roles',
        description: 'En "Configuración & Auditoría > Usuarios & Permisos", cree roles personalizados o use "Clonar" e "Importar permisos" para replicar matrices de acceso rápidamente.',
      },
      {
        title: '2. Chat Institucional y Presencia en Vivo',
        description: 'Desde el ícono de chat en la barra superior, comuníquese en privado o en grupos con sus colaboradores indicando su estado (En línea, Ausente, Ocupado).',
      },
      {
        title: '3. Bitácora de Auditoría Inmutable',
        description: 'Cada creación, modificación, anulación, envío de correo o descuadre de caja queda registrado con usuario, fecha, hora y detalle en "Bitácora de Auditoría".',
      },
    ],
  },
  {
    id: 'acc-chart-of-accounts',
    category: 'Contabilidad VEN-NIF',
    title: '1. Plan de Cuentas (VEN-NIF) y Clasificación Monetaria',
    purpose: 'Estructurar el catálogo contable bajo Normas de Información Financiera venezolanas (VEN-NIF) separando partidas monetarias de no monetarias.',
    summary: 'Administración de los 4 niveles jerárquicos, cuentas estándar de bancos/cajas y reglas de imputación contable.',
    steps: [
      {
        title: '1. Estructura Jerárquica de 4 Niveles',
        description: 'Nivel 1 (Clase: Activo, Pasivo, Patrimonio, Ingresos, Costos, Gastos), Nivel 2 (Grupo), Nivel 3 (Subcuenta) y Nivel 4 (Cuenta Auxiliar de Movimiento). Solo las cuentas de Nivel 4 reciben asientos.',
      },
      {
        title: '2. Cuentas Bancarias Estándar (VES y USD)',
        description: 'Las cuentas 1.1.01.04 (Bancos Nacionales Moneda Local VES) y 1.1.01.06 (Bancos Moneda Extranjera / Divisas USD) centralizan los movimientos bancarios según su moneda. Puede renombrarlas con el nombre de su banco real si lo desea.',
      },
      {
        title: '3. Clasificación Monetaria (REI) vs. No Monetaria',
        description: 'Marque si la cuenta es Monetaria (efectivo, CxC, CxP, expuestas a inflación) o No Monetaria (inventarios, activos fijos, capital, reexpresables bajo VEN-NIF B-10).',
      },
    ],
  },
  {
    id: 'acc-journal-ledger',
    category: 'Contabilidad VEN-NIF',
    title: '2. Libro Diario Legal, Contabilización Automática y Libro Mayor',
    purpose: 'Mantener un registro cronológico inmutable con partida doble estricta y trazabilidad directa desde cada factura o pago hacia la contabilidad.',
    summary: 'Ciclo de vida de comprobantes (DRAFT -> POSTED), motor de mapeo automático en tiempo real y consulta analítica del Mayor.',
    steps: [
      {
        title: '1. Libro Diario Legal (Partida Doble)',
        description: 'Todo comprobante exige Débito = Crédito exacto en VES y USD. Un asiento nace en DRAFT (editable) y al aprobarse pasa a POSTED (inmutable por ley; solo reversible mediante anulación auditada).',
      },
      {
        title: '2. Motor de Contabilización Automática',
        description: 'En "Contabilidad > Contabilización Automática", consulte y ajuste la matriz de claves operativas (mapping_key). El sistema contabiliza al instante ventas, compras, pagos a proveedores, notas y cierres de caja.',
      },
      {
        title: '3. Libro Mayor Analítico',
        description: 'Consulte los movimientos detallados por cuenta contable con saldo inicial arrastrado, referencia al documento origen y saldo progresivo, exportable a PDF oficial.',
      },
    ],
  },
  {
    id: 'acc-financial-statements-closing',
    category: 'Contabilidad VEN-NIF',
    title: '3. Balance de Comprobación, Estados Financieros, Cierre, INPC/REI y Diferencial Cambiario',
    purpose: 'Emitir estados financieros oficiales bajo NIIF para PYMES (históricos o reexpresados por inflación), revaluar saldos en divisas a tasa BCV y bloquear períodos cerrados.',
    summary: 'Cierre mensual de períodos, carga de índices INPC del BCV, cálculo automático del REI (VEN-NIF B-10) y revaluación cambiaria.',
    steps: [
      {
        title: '1. Balance de Comprobación y Estados Financieros',
        description: 'Verifique sumas y saldos por nivel en el Balance de Comprobación y emita el Estado de Situación Financiera y Estado de Resultados Integrales en PDF con pie de firma para Contador Colegiado.',
      },
      {
        title: '2. Cierres Mensuales (OPEN / CLOSED / LOCKED)',
        description: 'Desde "Cierres & Ajuste Inflación", cierre cada mes una vez conciliado para impedir registros extemporáneos que alteren declaraciones pasadas.',
      },
      {
        title: '3. Revaluación Cambiaria BCV y Ajuste por Inflación (REI B-10)',
        description: 'Al cierre de mes, ejecute la regularización por fluctuación cambiaria de cuentas en USD a la tasa oficial BCV, registre el INPC oficial del BCV y calcule el asiento de REI del período.',
      },
    ],
  },
];

export const BADGE_DICTIONARY: BadgeExplanation[] = [
  {
    term: 'ACTIVE',
    spanish: 'Activo / Vigente',
    category: 'General / Catálogo',
    badgeVariant: 'success',
    meaning: 'Registro habilitado para operar normalmente en facturación, inventario, bancos o contabilidad.',
    usageContext: 'Productos, Clientes, Proveedores, Cuentas Bancarias y Cuentas Contables.',
  },
  {
    term: 'INACTIVE / SUSPENDED',
    spanish: 'Inactivo / Suspendido',
    category: 'General / Catálogo',
    badgeVariant: 'neutral',
    meaning: 'Registro deshabilitado temporalmente. Conserva su historial pero no permite nuevas operaciones.',
    usageContext: 'Catálogos, Usuarios, Sucursales y Cuentas.',
  },
  {
    term: 'Por Verificar',
    spanish: 'Pendiente de Verificación CxP',
    category: 'Compras y CxP',
    badgeVariant: 'warning',
    meaning: 'Factura de compra registrada en CxP que aún no ha sido revisada/autorizada para pasar a la cola de pago en Tesorería.',
    usageContext: 'Cuentas por Pagar (CxP) y Estado de Cuenta de Proveedores.',
  },
  {
    term: 'Verificada / En Tesorería',
    spanish: 'Verificada para Pago',
    category: 'Compras y CxP / Tesorería',
    badgeVariant: 'success',
    meaning: 'Factura revisada por CxP y enviada automáticamente a la bandeja "Pagos a Proveedores por Procesar" en Tesorería.',
    usageContext: 'Cuentas por Pagar (CxP) y Pagos por Procesar en Tesorería.',
  },
  {
    term: 'Saldado',
    spanish: 'Deuda Cancelada al 100%',
    category: 'CxC y CxP',
    badgeVariant: 'success',
    meaning: 'El saldo pendiente de la factura es $0.00 tras completar los abonos o pagos correspondientes.',
    usageContext: 'Historial de Facturas en Proveedores, CxP y CxC.',
  },
  {
    term: 'PENDING',
    spanish: 'Pendiente',
    category: 'Documentos / Operación',
    badgeVariant: 'warning',
    meaning: 'Documento emitido que espera aprobación, recepción, despacho o pago.',
    usageContext: 'Órdenes de Compra, Facturas a Crédito, Comandas KDS.',
  },
  {
    term: 'PARTIAL',
    spanish: 'Abono Parcial',
    category: 'Cobranzas y Pagos',
    badgeVariant: 'info',
    meaning: 'Se ha pagado o cobrado una fracción del monto total, quedando un saldo deudor remanente.',
    usageContext: 'Cuentas por Cobrar (CxC) y Cuentas por Pagar (CxP).',
  },
  {
    term: 'OVERDUE',
    spanish: 'Vencido / En Mora',
    category: 'Cobranzas y Pagos',
    badgeVariant: 'danger',
    meaning: 'Superó la fecha de vencimiento acordada sin haber sido saldada.',
    usageContext: 'Reportes de Antigüedad CxC y CxP.',
  },
  {
    term: 'COMPLETED / PAID',
    spanish: 'Completado / Pagado',
    category: 'Documentos / Pagos',
    badgeVariant: 'success',
    meaning: 'Proceso culminado o factura totalmente liquidada.',
    usageContext: 'Facturas POS, Órdenes de Compra, Pagos a Proveedores.',
  },
  {
    term: 'CANCELLED / VOID',
    spanish: 'Anulado',
    category: 'Documentos',
    badgeVariant: 'danger',
    meaning: 'Documento invalidado formalmente sin eliminar el correlativo para trazabilidad fiscal.',
    usageContext: 'Facturas, Retenciones, Órdenes de Compra.',
  },
  {
    term: 'DRAFT (Contable)',
    spanish: 'Borrador Contable',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'warning',
    meaning: 'Asiento contable preliminar editable; aún no afecta saldos oficiales del Mayor ni Estados Financieros.',
    usageContext: 'Libro Diario Legal.',
  },
  {
    term: 'POSTED',
    spanish: 'Asentado / Contabilizado',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'success',
    meaning: 'Asiento contable definitivo e inmutable según el Código de Comercio. Impacta Mayor y Balances.',
    usageContext: 'Libro Diario Legal y Motor de Contabilización Automática.',
  },
  {
    term: 'ANNULLED (Contable)',
    spanish: 'Anulado con Contra-asiento',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'danger',
    meaning: 'Comprobante revertido mediante asiento de anulación auditado sin borrar registros históricos.',
    usageContext: 'Libro Diario Legal.',
  },
  {
    term: 'AUTO_POSTED',
    spanish: 'Contabilizado Automáticamente',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'info',
    meaning: 'Asiento generado en tiempo real por el motor automático al confirmar una venta, compra, pago o nota.',
    usageContext: 'Contabilización Automática y Libro Diario.',
  },
  {
    term: 'OPEN / CLOSED / LOCKED',
    spanish: 'Abierto / Cerrado / Bloqueado',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'neutral',
    meaning: 'Estado del período fiscal mensual. LOCKED impide cualquier asiento extemporáneo en ese mes.',
    usageContext: 'Cierres Contables & Ajuste por Inflación.',
  },
  {
    term: 'MONETARY / NON_MONETARY',
    spanish: 'Monetaria / No Monetaria',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'info',
    meaning: 'Clasificación para ajuste por inflación B-10: las monetarias pierden/ganan poder adquisitivo (generan REI); las no monetarias se reexpresan por INPC.',
    usageContext: 'Plan de Cuentas (VEN-NIF).',
  },
  {
    term: 'INPC / REI',
    spanish: 'Índice Nacional de Precios / Resultado Monetario',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'info',
    meaning: 'INPC del BCV mide la inflación mensual; REI es la ganancia o pérdida monetaria por exposición a la inflación.',
    usageContext: 'Cierres & Ajuste Inflación.',
  },
  {
    term: 'IN_TRANSIT / RECEIVED',
    spanish: 'En Tránsito / Recibido',
    category: 'Inventario',
    badgeVariant: 'info',
    meaning: 'Mercancía despachada desde un almacén origen que espera confirmación física en el almacén destino.',
    usageContext: 'Traslados entre Almacenes.',
  },
  {
    term: 'COOKING / READY',
    spanish: 'En Preparación / Listo',
    category: 'Restaurante KDS',
    badgeVariant: 'warning',
    meaning: 'Estado de los platos en la pantalla de cocina desde que entran a preparación hasta que salen a mesa.',
    usageContext: 'Monitor de Cocina (KDS).',
  },
  {
    term: 'PARTIAL_EXTRACTION / SUBDIVISION',
    spanish: 'Despiece Parcial / Subdivisión',
    category: 'Producción & Desposte',
    badgeVariant: 'info',
    meaning: 'Indica si la orden extrae una pieza intermedia dejando saldo en el producto base, o subdivide una pieza en cortes finales.',
    usageContext: 'Producción, Desposte & Merma.',
  },
  {
    term: 'Admite Merma',
    spanish: 'Control de Desperdicio Habilitado',
    category: 'Producción & Desposte',
    badgeVariant: 'warning',
    meaning: 'Permite que un producto registre pérdida de peso/unidades en procesos de desposte o merma directa en almacén.',
    usageContext: 'Configuración de Productos en Producción.',
  },
];

export const BUSINESS_RULES_EXPLANATION: BusinessRuleExplanation[] = [
  {
    name: 'Sincronización Automática de Tasa Oficial BCV',
    legalContext: 'Convenio Cambiario N° 1 del Banco Central de Venezuela (BCV)',
    description: 'Mantiene actualizada la tasa oficial Bs/USD para facturación multimoneda, cálculo de pagos en Tesorería y registro contable paralelo en VES y USD.',
    configurationGuide: 'Barra superior > indicador BCV, o en "Configuración & Auditoría > Empresa & Reglas".',
    auditImpact: 'Cada documento almacena la tasa exacta aplicada al momento de su emisión.',
  },
  {
    name: 'IGTF en Divisas y Efectivo Moneda Extranjera (3%)',
    legalContext: 'Ley de Impuesto a las Grandes Transacciones Financieras (SENIAT)',
    description: 'Calcula automáticamente el 3% adicional sobre pagos recibidos en efectivo en moneda extranjera o medios no bancarizados en divisas.',
    configurationGuide: 'Activado por defecto en "Configuración > Empresa & Reglas > Reglas Fiscales" y parametrizado en la clave contable IGTF_PAYABLE (2.1.02.05).',
    auditImpact: 'Separa el IGTF del ingreso neto y lo contabiliza directamente como pasivo fiscal por enterar al SENIAT.',
  },
  {
    name: 'Segregación de Verificación CxP y Pago en Tesorería',
    legalContext: 'Normas de Control Interno Contable y Auditoría',
    description: 'Separa la validación administrativa de facturas de compra (CxP) de la ejecución financiera del desembolso bancario (Tesorería). Solo facturas verificadas llegan a Pagos por Procesar.',
    configurationGuide: 'Permisos granulares por rol en "Configuración > Usuarios & Permisos" (payables vs. treasury).',
    auditImpact: 'Registra usuario verificador, fecha/hora de verificación y comprobante PDF del pago ejecutado.',
  },
  {
    name: 'Enrutamiento Contable por Moneda y Cuenta Bancaria',
    legalContext: 'VEN-NIF / NIC 21 (Efectos de las Variaciones en las Tasas de Cambio)',
    description: 'Cada cuenta bancaria de Tesorería se vincula a su cuenta contable según su moneda (1.1.01.04 para VES y 1.1.01.06 para USD). Al pagar a un proveedor, el asiento acredita el banco exacto correspondiente a la moneda y cuenta utilizada.',
    configurationGuide: 'Automático al crear cuentas bancarias en Tesorería; personalizable en "Contabilidad > Contabilización Automática".',
    auditImpact: 'Evita mezcla de saldos en bolívares y dólares dentro del Libro Mayor.',
  },
  {
    name: 'Arqueo Ciego Obligatorio en Cierre de Turno',
    legalContext: 'Control Interno de Efectivo y Prevención de Fraudes',
    description: 'Obliga al cajero a contar e ingresar el efectivo físico sin ver el saldo teórico esperado por el sistema, disparando alertas y justificación obligatoria si existe descuadre.',
    configurationGuide: 'Configuración > Empresa & Reglas > Seguridad Operativa POS.',
    auditImpact: 'Genera Acta de Cierre en PDF y alerta en "Verificación de Arqueos".',
  },
  {
    name: 'Partida Doble Estricta, Inmutabilidad y Bloqueo de Períodos',
    legalContext: 'Código de Comercio de Venezuela (Art. 32-38) y VEN-NIF',
    description: 'Ningún asiento se contabiliza si Débito != Crédito. Los comprobantes POSTED y los meses LOCKED son inmutables para garantizar integridad fiscal.',
    configurationGuide: 'Contabilidad > Cierres & Ajuste Inflación.',
    auditImpact: 'Cumplimiento integral ante fiscalizaciones contables y tributarias.',
  },
  {
    name: 'Ajuste Integral por Inflación VEN-NIF B-10 y Fluctuación Cambiaria',
    legalContext: 'Boletín de Aplicación VEN-NIF BA-2 / NIC 29',
    description: 'Permite registrar mensualmente el INPC del BCV para calcular la reexpresión de partidas no monetarias (REI), así como revaluar saldos en moneda extranjera al tipo de cambio oficial de cierre.',
    configurationGuide: 'Contabilidad > Cierres & Ajuste Inflación.',
    auditImpact: 'Permite emitir Estados Financieros en valores históricos o reexpresados con respaldo documental.',
  },
];

export const ACCOUNTING_SUBMODULES = [
  {
    title: '1. Plan de Cuentas (VEN-NIF)',
    route: 'Contabilidad > Plan de Cuentas (VEN-NIF)',
    description: 'Catálogo jerárquico de 4 niveles (Clase, Grupo, Subcuenta, Auxiliar). Solo el Nivel 4 recibe asientos. Separa cuentas Monetarias (generadoras de REI) de No Monetarias (reexpresables por inflación).',
  },
  {
    title: '2. Libro Diario Legal',
    route: 'Contabilidad > Libro Diario Legal',
    description: 'Registro cronológico con partida doble estricta (Débito = Crédito) en doble moneda (VES y USD). Estados DRAFT (editable) y POSTED (inmutable). Anulación auditada mediante contra-asiento sin saltos de correlativo.',
  },
  {
    title: '3. Contabilización Automática',
    route: 'Contabilidad > Contabilización Automática',
    description: 'Motor en tiempo real que traduce ventas POS, compras, pagos a proveedores, cobros CxC, retenciones, notas SENIAT y ajustes de inventario en asientos contables usando la matriz de claves operativas.',
  },
  {
    title: '4. Libro Mayor Analítico',
    route: 'Contabilidad > Libro Mayor Analítico',
    description: 'Centraliza las transacciones cuenta por cuenta con saldo inicial arrastrado, detalle de débitos/créditos, referencia al documento origen y saldo progresivo acumulado. Exportable a PDF oficial.',
  },
  {
    title: '5. Balance de Comprobación',
    route: 'Contabilidad > Balance de Comprobación',
    description: 'Verifica la ecuación patrimonial presentando sumas y saldos (inicial, débitos, créditos, final) por niveles del 1 al 4 en VES y USD, con opción para ocultar cuentas en cero.',
  },
  {
    title: '6. Estados Financieros NIIF',
    route: 'Contabilidad > Estados Financieros NIIF',
    description: 'Genera el Estado de Situación Financiera (Balance General) y el Estado de Resultados Integrales (Ganancias y Pérdidas), en valores históricos o reexpresados por inflación, con formato formal y firmas de Contador Colegiado.',
  },
  {
    title: '7. Cierres & Ajuste Inflación',
    route: 'Contabilidad > Cierres & Ajuste Inflación',
    description: 'Administra los 12 períodos mensuales (OPEN, CLOSED, LOCKED), registra los índices oficiales INPC del BCV, calcula el REI (VEN-NIF B-10) y ejecuta la revaluación de saldos en moneda extranjera al cierre.',
  },
];

export const ACCOUNTING_MAPPINGS_DOC: AccountingMappingDoc[] = [
  { key: 'CASH_VES', accountCode: '1.1.01.01', accountName: 'Caja Principal (Efectivo VES)', circuit: 'Cobros y fondo de caja en Bolívares', behavior: 'Débito en ventas/cobros efectivo Bs; Crédito en depósitos.' },
  { key: 'CASH_USD', accountCode: '1.1.01.03', accountName: 'Caja en Moneda Extranjera (USD)', circuit: 'Cobros y pagos en efectivo Divisas', behavior: 'Débito en ventas efectivo USD; Crédito en depósitos o pagos en efectivo.' },
  { key: 'BANK_VES_DEFAULT', accountCode: '1.1.01.04', accountName: 'Bancos Nacionales Moneda Local (VES)', circuit: 'Cuentas bancarias y pagos en Bolívares', behavior: 'Débito en depósitos/transferencias VES; Crédito en pagos a proveedores VES.' },
  { key: 'BANK_USD_DEFAULT', accountCode: '1.1.01.06', accountName: 'Bancos Moneda Extranjera / Divisas (USD)', circuit: 'Cuentas bancarias y pagos en Dólares', behavior: 'Débito en ingresos USD/Zelle; Crédito en pagos a proveedores desde cuentas USD.' },
  { key: 'AR_CUSTOMERS_VES', accountCode: '1.1.02.01', accountName: 'Clientes Nacionales Comerciales', circuit: 'Facturas de venta a crédito (CxC)', behavior: 'Débito al facturar a crédito; Crédito al registrar cobros o notas de crédito.' },
  { key: 'VAT_CREDIT', accountCode: '1.1.03.01', accountName: 'IVA Crédito Fiscal', circuit: 'Compras a proveedores gravadas (16%)', behavior: 'Débito en recepción de facturas de compra; Crédito en devoluciones.' },
  { key: 'INVENTORY', accountCode: '1.1.04.01', accountName: 'Inventario de Mercancías para la Venta', circuit: 'Compras, Ventas y Ajustes de Almacén', behavior: 'Débito en compras/entradas; Crédito al costo de ventas y mermas.' },
  { key: 'AP_SUPPLIERS_VES', accountCode: '2.1.01.01', accountName: 'Proveedores Nacionales', circuit: 'Facturas de compra a crédito (CxP)', behavior: 'Crédito al recibir factura de compra; Débito al pagar desde Tesorería.' },
  { key: 'VAT_DEBIT', accountCode: '2.1.02.01', accountName: 'IVA Débito Fiscal', circuit: 'Facturación de ventas gravadas (16%)', behavior: 'Crédito al facturar; Débito en notas de crédito de ventas.' },
  { key: 'WITHHOLDING_VAT_ISSUED', accountCode: '2.1.02.02', accountName: 'Retenciones de IVA por Enterar', circuit: 'Retenciones practicadas a proveedores', behavior: 'Crédito al retener IVA en compras hasta su entero al SENIAT.' },
  { key: 'WITHHOLDING_ISLR_ISSUED', accountCode: '2.1.02.03', accountName: 'Retenciones de ISLR por Enterar', circuit: 'Retenciones ISLR Decreto 1808', behavior: 'Crédito al retener ISLR en compras/servicios.' },
  { key: 'IGTF_PAYABLE', accountCode: '2.1.02.05', accountName: 'IGTF por Enterar al SENIAT', circuit: 'Cobros en divisas efectivo (3%)', behavior: 'Crédito al percibir IGTF 3% en POS/CxC.' },
  { key: 'SALES_REVENUE', accountCode: '4.1.01', accountName: 'Ventas de Mercancías Gravadas con IVA', circuit: 'Facturación POS / Ventas', behavior: 'Crédito por el subtotal gravado de las ventas.' },
  { key: 'SALES_REVENUE_EXEMPT', accountCode: '4.1.02', accountName: 'Ventas de Mercancías Exentas / Exoneradas', circuit: 'Facturación de rubros exentos', behavior: 'Crédito por el subtotal exento de IVA.' },
  { key: 'COST_OF_SALES', accountCode: '5.1.01', accountName: 'Costo de Mercancía Vendida', circuit: 'Descargo automático de inventario al vender', behavior: 'Débito por el costo promedio de los productos vendidos.' },
  { key: 'INVENTORY_ADJUST_EXPENSE', accountCode: '5.1.01', accountName: 'Pérdida o Ajuste Negativo de Inventario', circuit: 'Mermas directas y desposte con costo unitario directo', behavior: 'Débito por el costo de la merma descargada contra 1.1.04.01.' },
  { key: 'EXCHANGE_DIFF_LOSS', accountCode: '7.1.02', accountName: 'Pérdida en Fluctuación Cambiaria', circuit: 'Revaluación BCV desfavorable', behavior: 'Débito al ajustar pasivos o diferencias cambiarias negativas.' },
  { key: 'EXCHANGE_DIFF_GAIN', accountCode: '7.2.01', accountName: 'Ganancia en Fluctuación Cambiaria', circuit: 'Revaluación BCV favorable', behavior: 'Crédito al revaluar saldos activos en divisas a mayor tasa BCV.' },
  { key: 'REI_RESULT', accountCode: '7.3.01', accountName: 'Resultado Monetario del Ejercicio (REI Neto)', circuit: 'Ajuste por Inflación VEN-NIF B-10', behavior: 'Registra el efecto neto de la inflación calculada con INPC del BCV.' },
];

export const ACCOUNTING_CIRCUITS_DOC: AccountingCircuitDoc[] = [
  {
    process: 'Venta POS (Contado / Mixta)',
    trigger: 'Al emitir factura en POS',
    debitAccounts: 'Caja/Bancos (VES o USD según método de pago) + Costo de Ventas (5.1.01)',
    creditAccounts: 'Ventas Gravadas/Exentas (4.1.01/4.1.02) + IVA Débito (2.1.02.01) + IGTF por Enterar (2.1.02.05) + Inventario (1.1.04.01)',
    notes: 'Registra simultáneamente el ingreso comercial, los impuestos SENIAT y el descargo del costo del inventario.',
  },
  {
    process: 'Compra de Mercancía (Crédito CxP)',
    trigger: 'Al confirmar Recepción / Factura de Compra',
    debitAccounts: 'Inventario de Mercancías (1.1.04.01) + IVA Crédito Fiscal (1.1.03.01)',
    creditAccounts: 'Proveedores Nacionales (2.1.01.01) [+ Retenciones IVA/ISLR si aplica]',
    notes: 'Crea automáticamente el pasivo en CxP en estado Por Verificar.',
  },
  {
    process: 'Pago a Proveedor desde Tesorería',
    trigger: 'Al ejecutar pago en Tesorería sobre factura verificada',
    debitAccounts: 'Proveedores Nacionales (2.1.01.01) por el monto amortizado',
    creditAccounts: 'Cuenta Bancaria exacta: 1.1.01.04 (si es cuenta VES) o 1.1.01.06 (si es cuenta USD / Zelle)',
    notes: 'El monto se expresa en VES a tasa BCV y su equivalente en USD, respetando el banco origen seleccionado.',
  },
  {
    process: 'Cierre y Depósito de Arqueo de Caja',
    trigger: 'Al aprobar y depositar arqueo en bancos',
    debitAccounts: 'Cuenta Bancaria destino (1.1.01.04 VES o 1.1.01.06 USD)',
    creditAccounts: 'Caja Principal VES (1.1.01.01) o Caja USD (1.1.01.03)',
    notes: 'Traslada contablemente los fondos recaudados en caja hacia el banco correspondiente.',
  },
  {
    process: 'Desposte / Producción (Prorrateo por Peso)',
    trigger: 'Al procesar orden con método BY_WEIGHT',
    debitAccounts: 'Inventario de Mercancías (1.1.04.01) en los cortes útiles obtenidos',
    creditAccounts: 'Inventario de Mercancías (1.1.04.01) del producto base consumido',
    notes: 'El costo total se redistribuye entre los cortes vendibles; la merma eleva el costo unitario del corte sin variación neta del inventario.',
  },
  {
    process: 'Merma Directa o Desposte Costo Base (EQUAL_UNIT)',
    trigger: 'Al registrar merma directa o procesar orden EQUAL_UNIT con desperdicio',
    debitAccounts: 'Pérdida o Ajuste Negativo de Inventario (5.1.01 / INVENTORY_ADJUST_EXPENSE)',
    creditAccounts: 'Inventario de Mercancías (1.1.04.01 / INVENTORY_MERCHANDISE)',
    notes: 'Descarga contablemente el valor de la merma del inventario hacia resultados en Bs. a tasa oficial BCV.',
  },
];

export function generateUserManualMarkdown(generatedBy: string): string {
  const now = new Date();
  let doc = '';

  doc += `# MANUAL OFICIAL DE USUARIO Y PROCEDIMIENTOS OPERATIVOS\n`;
  doc += `**Sistema ERO ERP VE - Edición Empresarial**\n`;
  doc += `*Fecha de Generación: ${now.toLocaleDateString('es-VE')} ${now.toLocaleTimeString('es-VE')}*\n`;
  doc += `*Generado por: ${generatedBy}*\n\n`;
  doc += `---\n\n`;

  doc += `## TABLA DE CONTENIDO\n`;
  doc += `1. Guía Operativa por Módulos y Procesos (¿Para qué sirve y cómo se trabaja?)\n`;
  doc += `2. Glosario de Banderas y Estados del Sistema\n`;
  doc += `3. Reglas de Negocio, Marco Legal SENIAT / BCV y Control Interno\n`;
  doc += `4. Manual Detallado del Módulo Contable VEN-NIF y Circuitos Contables\n\n`;
  doc += `---\n\n`;

  doc += `## 1. GUÍA OPERATIVA POR MÓDULOS Y PROCESOS\n\n`;
  USER_GUIDES.forEach((g, idx) => {
    doc += `### 1.${idx + 1} ${g.title}\n`;
    doc += `- **Módulo:** ${g.category}\n`;
    doc += `- **¿Para qué sirve?:** ${g.purpose}\n`;
    doc += `- **Resumen:** ${g.summary}\n\n`;
    doc += `#### Pasos a Seguir:\n`;
    g.steps.forEach((s) => {
      doc += `- **${s.title}**: ${s.description}\n`;
      if (s.tip) doc += `  > *Consejo / Alerta:* ${s.tip}\n`;
    });
    if (g.rules && g.rules.length > 0) {
      doc += `\n*Reglas de Control:*\n`;
      g.rules.forEach((r) => (doc += `- ${r}\n`));
    }
    doc += `\n`;
  });

  doc += `---\n\n`;
  doc += `## 2. GLOSARIO DE BANDERAS Y ESTADOS DEL SISTEMA\n\n`;
  doc += `| Bandera / Término | Equivalente en Español | Categoría | Significado y Alcance Operativo | Dónde Aparece |\n`;
  doc += `| :--- | :--- | :--- | :--- | :--- |\n`;
  BADGE_DICTIONARY.forEach((b) => {
    doc += `| \`${b.term}\` | **${b.spanish}** | ${b.category} | ${b.meaning} | ${b.usageContext} |\n`;
  });
  doc += `\n---\n\n`;

  doc += `## 3. REGLAS DE NEGOCIO Y MARCO LEGAL SENIAT / BCV\n\n`;
  BUSINESS_RULES_EXPLANATION.forEach((r, idx) => {
    doc += `### 3.${idx + 1} ${r.name}\n`;
    doc += `- **Marco Legal:** ${r.legalContext}\n`;
    doc += `- **Descripción:** ${r.description}\n`;
    doc += `- **Cómo Configurar:** ${r.configurationGuide}\n`;
    doc += `- **Impacto en Auditoría:** ${r.auditImpact}\n\n`;
  });

  doc += `---\n\n`;
  doc += `## 4. MANUAL DETALLADO DEL MÓDULO CONTABLE VEN-NIF\n\n`;
  doc += `El módulo contable de ERO ERP está homologado bajo el Código de Comercio de Venezuela (Art. 32-38) y las normas VEN-NIF (NIIF para PYMES), con doble moneda funcional (VES y USD), partida doble estricta, motor de contabilización automática en tiempo real, ajuste por inflación VEN-NIF B-10 (INPC BCV) y regularización cambiaria.\n\n`;

  doc += `### 4.1 Submódulos Contables\n`;
  ACCOUNTING_SUBMODULES.forEach((sub) => {
    doc += `- **${sub.title}** (*${sub.route}*): ${sub.description}\n`;
  });

  doc += `\n### 4.2 Circuitos de Contabilización Automática (Debe / Haber)\n\n`;
  doc += `| Proceso Operativo | Evento Disparador | Cuentas al Debe (Débito) | Cuentas al Haber (Crédito) | Observación |\n`;
  doc += `| :--- | :--- | :--- | :--- | :--- |\n`;
  ACCOUNTING_CIRCUITS_DOC.forEach((c) => {
    doc += `| **${c.process}** | ${c.trigger} | ${c.debitAccounts} | ${c.creditAccounts} | ${c.notes} |\n`;
  });

  doc += `\n### 4.3 Matriz Completa de Mapeos Predeterminados (mapping_key)\n\n`;
  doc += `| Clave Operativa | Cuenta VEN-NIF | Nombre de la Cuenta | Circuito Asociado | Comportamiento Contable |\n`;
  doc += `| :--- | :--- | :--- | :--- | :--- |\n`;
  ACCOUNTING_MAPPINGS_DOC.forEach((m) => {
    doc += `| \`${m.key}\` | ${m.accountCode} | ${m.accountName} | ${m.circuit} | ${m.behavior} |\n`;
  });

  return doc;
}
