import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  BookOpen,
  Search,
  FileText,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Tag,
  Sliders,
  DollarSign,
  ShoppingCart,
  Package,
  Utensils,
  Landmark,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';

interface GuideStep {
  title: string;
  description: string;
  tip?: string;
}

interface GuideItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  steps: GuideStep[];
  rules?: string[];
}

interface BadgeExplanation {
  term: string;
  spanish: string;
  category: string;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  meaning: string;
  usageContext: string;
}

interface BusinessRuleExplanation {
  name: string;
  legalContext: string;
  description: string;
  configurationGuide: string;
  auditImpact: string;
}

// -----------------------------------------------------------------------------
// DATOS EXHAUSTIVOS DE LA BASE DE CONOCIMIENTO
// -----------------------------------------------------------------------------

const USER_GUIDES: GuideItem[] = [
  {
    id: 'pos-cash-shift',
    category: 'Ventas & Puntos de Venta',
    title: 'Apertura, Operación y Cierre de Caja con Arqueo Ciego',
    summary: 'Procedimiento obligatorio para iniciar turno, registrar cobros, declarar efectivo y conciliar diferencias.',
    steps: [
      {
        title: '1. Selección de Sucursal y Caja Asignada',
        description: 'Al iniciar sesión, verifique en la barra superior la Sucursal y Caja activa. Si ya tiene una caja asignada o un turno en curso, el sistema bloqueará la selección de otra caja para evitar inconsistencias contables.',
      },
      {
        title: '2. Apertura de Turno con Fondo Inicial',
        description: 'Ingrese a "Ventas & Puntos de Venta > Cierre de Caja & Arqueo". Haga clic en "Abrir Turno de Caja", ingrese el fondo de cambio en Divisas ($) y Bolívares (Bs), e indique observaciones si las hay.',
      },
      {
        title: '3. Operación de Facturación en Punto de Venta (POS)',
        description: 'Diríjase a "Ventas & Puntos de Venta > Punto de Venta (POS)". Busque productos por código de barras, nombre o departamento asignado a la caja. Agregue ítems, seleccione el cliente y procese las formas de pago combinadas.',
      },
      {
        title: '4. Arqueo Ciego de Cierre',
        description: 'Al finalizar la jornada, haga clic en "Cierre de Turno". Cuente físicamente todo el dinero en gaveta e ingrese el total real contado. El sistema contrastará contra las ventas teóricas del lote.',
        tip: 'Si hay diferencias (faltante o sobrante), justifíquelas en las observaciones. El sistema generará una alerta de auditoría para supervisión.',
      },
      {
        title: '5. Acta Oficial de Cierre en PDF',
        description: 'Al confirmar el cierre, se genera automáticamente el Acta Oficial en PDF con el desglose de ventas por método de pago, IGTF, bases imponibles y el dictamen de cuadre.',
      },
    ],
    rules: [
      'No se permite abrir más de un turno simultáneo en la misma caja registradora.',
      'El arqueo ciego exige que el cajero cuente el efectivo sin saber de antemano el saldo teórico del sistema.',
    ],
  },
  {
    id: 'pos-sales-billing',
    category: 'Ventas & Puntos de Venta',
    title: 'Facturación POS, División de Pagos y Cálculo de IGTF (3%)',
    summary: 'Cómo emitir tickets fiscales o de contingencia, aplicar descuentos y procesar pagos mixtos.',
    steps: [
      {
        title: '1. Registro del Cliente',
        description: 'Seleccione o busque el cliente por RIF o Cédula. Si no está registrado, use el botón rápido para crearlo con sus datos fiscales para la factura legal.',
      },
      {
        title: '2. Selección de Productos',
        description: 'Escanee los códigos de barra o busque en el catálogo. La caja solo mostrará los productos de los departamentos asignados en su configuración (o todo el catálogo si no tiene restricción).',
      },
      {
        title: '3. Desglose de Formas de Pago Mixtas',
        description: 'En el modal de cobro, distribuya el monto entre Efectivo Divisas ($), Efectivo Bs, Pago Móvil, Punto de Venta Débito/Crédito o Zelle. El sistema convierte en tiempo real con la tasa oficial BCV.',
      },
      {
        title: '4. Aplicación de IGTF Divisas (3%)',
        description: 'Cualquier porción cobrada en divisas o efectivo en moneda extranjera calculará automáticamente el 3% de IGTF según la Ley venezolana, reflejándose en el ticket legal.',
      },
    ],
  },
  {
    id: 'restaurant-orders',
    category: 'Restaurante & Comandas',
    title: 'Toma de Pedidos en Mesas y Pantalla de Cocina (KDS)',
    summary: 'Gestión integral de salones, apertura de cuentas, envío a comanderas y cobro dividido (Split Bill).',
    steps: [
      {
        title: '1. Apertura de Mesa o Barra',
        description: 'En "Restaurante & Comandas > Toma de Pedidos (Mesas)", seleccione el salón y haga clic en la mesa disponible. Indique el número de comensales y el mesero responsable.',
      },
      {
        title: '2. Adición de Platos y Observaciones',
        description: 'Agregue las bebidas, entradas y platos fuertes. Puede especificar notas de preparación para cocina (ej: "término medio", "sin cebolla", "salsa aparte").',
      },
      {
        title: '3. Envío a Cocina & Barra (KDS)',
        description: 'Presione "Enviar a Cocina". Los ítems se despachan instantáneamente al monitor KDS en "Restaurante & Comandas > Cocina & Barra (KDS)", cambiando de estado a PENDING y luego a COOKING.',
      },
      {
        title: '4. Pre-cuenta y División de Cuenta (Split Bill)',
        description: 'Cuando los clientes solicitan la cuenta, genere la pre-cuenta. Si desean pagar por separado, use la herramienta "Dividir Cuenta" para emitir facturas independientes por comensal.',
      },
    ],
  },
  {
    id: 'inventory-kardex',
    category: 'Inventario & Almacenes',
    title: 'Kardex Multimoneda y Jerarquía de Clasificación de Productos',
    summary: 'Consulta de movimientos, valoración a costo promedio y existencias por Departamento, Grupo y Subgrupo.',
    steps: [
      {
        title: '1. Organización por Departamentos, Grupos y Subgrupos',
        description: 'En "Inventario & Almacenes > Jerarquía de Productos", estructure sus líneas de negocio en 3 niveles jerárquicos (ej: Alimentos > Lácteos > Quesos). Esto organiza el catálogo y las cajas POS.',
      },
      {
        title: '2. Consulta de Existencias en Kardex',
        description: 'En "Inventario & Almacenes > Kardex Valorizado" (o desde "Inventario & Almacenes > Catálogo de Productos"), puede alternar entre dos modelos: Modelo 1 (solo unidades físicas sin costos) y Modelo 2 (Kardex Monetizado con costo promedio, PVP y selección de moneda USD o VES).',
      },
      {
        title: '3. Filtro Multidimensional',
        description: 'Utilice el modal de búsqueda rápida para filtrar por departamento, grupo y subgrupo en cualquier módulo del sistema.',
      },
    ],
  },
  {
    id: 'inventory-adjustments',
    category: 'Inventario & Almacenes',
    title: 'Ajustes de Inventario por Entrada, Salida o Mermas',
    summary: 'Registro justificado de aumentos o disminuciones físicas de stock no derivadas de ventas ni compras.',
    steps: [
      {
        title: '1. Crear Ajuste de Inventario',
        description: 'Ingrese a "Inventario & Almacenes > Ajustes de Inventario" y presione "Nuevo Ajuste". Seleccione el almacén donde se encuentra la mercancía.',
      },
      {
        title: '2. Tipo de Movimiento y Motivo',
        description: 'Indique si es ENTRADA (sobrante, conteo físico positivo) o SALIDA (merma, vencimiento, rotura, consumo interno).',
      },
      {
        title: '3. Aprobación y Aplicación Contable',
        description: 'Si el ajuste supera los límites no supervisados, requerirá aprobación por el Supervisor de Inventario o Administrador antes de afectar el Kardex.',
      },
    ],
  },
  {
    id: 'sales-notes',
    category: 'Ventas & Puntos de Venta',
    title: 'Devolución Total o Parcial de Facturas (POS) & Notas de Crédito SENIAT',
    summary: 'Procedimiento operativo para devolver mercancía facturada en el Punto de Venta (POS), reingresar stock a almacén, generar la Nota de Crédito fiscal y gestionar el saldo a favor o reintegro.',
    steps: [
      {
        title: '1. Acceder al Módulo de Notas',
        description: 'Diríjase a "Ventas & Puntos de Venta > Notas de Crédito & Débito" (o desde "Ventas & Puntos de Venta > Cuentas por Cobrar") y haga clic en "+ Nueva Nota".',
      },
      {
        title: '2. Seleccionar Cliente y Factura del POS',
        description: 'Seleccione el Cliente al que se le emitió la venta. En el campo "Factura Afectada", el sistema desplegará automáticamente el historial de facturas. Seleccione la factura fiscal emitida en la caja POS.',
        tip: 'Si la venta POS se realizó a un cliente registrado, selecciónelo directamente por nombre o RIF para vincular la factura de origen.',
      },
      {
        title: '3. Indicar Motivo SENIAT y Almacén de Reingreso',
        description: 'Seleccione Tipo: "Nota de Crédito", Motivo: "Devolución de Mercancía" (RETURN) y especifique el Almacén / Depósito de la sucursal donde la mercancía física volverá a ingresar.',
      },
      {
        title: '4. Cargar Ítems de la Factura y Definir Devolución Total o Parcial',
        description: 'Haga clic en el botón "Cargar Ítems de Factura". El sistema traerá todos los renglones facturados con sus precios, impuestos y saldos disponibles para devolución:',
        tip: '• DEVOLUCIÓN TOTAL: Conserve todos los productos con la cantidad facturada y la casilla "Reingresar a Inventario" marcada.\n• DEVOLUCIÓN PARCIAL: Ajuste la cantidad en los renglones devueltos y elimine de la tabla los productos que el cliente no devuelve.',
      },
      {
        title: '5. Guardar y Emitir Nota de Crédito Oficial',
        description: 'Presione "Guardar y Emitir Nota". El sistema asignará el número de control legal SENIAT, reingresará el stock en el Kardex del almacén, rebajará el débito fiscal en el Libro de Ventas y generará el asiento contable en tiempo real.',
      },
      {
        title: '6. Gestión del Reintegro o Saldo a Favor',
        description: '• Si la factura fue a crédito: se deduce de la cuenta por cobrar.\n• Si la factura fue pagada en el POS: la Nota de Crédito queda con estado ACTIVE como saldo a favor del cliente, pudiendo aplicarse a nuevas compras en Cobranzas.',
        tip: 'Puede generar e imprimir el comprobante oficial en PDF con formato SENIAT haciendo clic en el icono de PDF de la lista.',
      },
    ],
    rules: [
      'Normativa SENIAT: Toda Nota de Crédito debe asociarse obligatoriamente a la Factura Fiscal de origen con su número y fecha.',
      'Control de Stock: Solo se actualiza el Kardex si el producto maneja inventario y se mantiene marcada la opción de retorno.',
      'Tope de Cantidades: No es posible acreditar una cantidad mayor a la facturada originalmente descontando devoluciones previas.',
    ],
  },
  {
    id: 'customer-rif-lookup',
    category: 'Ventas & Puntos de Venta',
    title: 'Registro y Validación Fiscal de Clientes con RIF SENIAT',
    summary: 'Procedimiento de validación matemática por Módulo 11, autocompletado inteligente de datos fiscales (cruce con proveedores y clientes previos) y verificación oficial en el portal del SENIAT.',
    steps: [
      {
        title: '1. Ingreso del Documento / RIF en la Ficha del Cliente',
        description: 'En "Ventas & Puntos de Venta > Clientes", presione "+ Nuevo Cliente". Ingrese el RIF o Cédula con o sin guiones (ej. J-12345678-9 o V123456789). Al pegar el código completo, el sistema separa automáticamente el tipo de documento (J, V, E, G, P) y el número.',
      },
      {
        title: '2. Autocompletado Inteligente y Cruce Comercial',
        description: 'Al salir del campo o presionar "Autocompletar", el sistema busca en el histórico de clientes y en el directorio de proveedores (cruce comercial). Si el contribuyente ya existe en la empresa, autocompleta de inmediato la Razón Social, Dirección Fiscal, Teléfono, Correo y condición de Contribuyente Especial.',
        tip: 'Si la empresa ya le compra a este contacto como proveedor, sus datos fiscales se aprovechan sin tener que escribirlos de nuevo.',
      },
      {
        title: '3. Validación Matemática Oficial SENIAT (Módulo 11)',
        description: 'El motor calcula el dígito verificador ponderado con el estándar del SENIAT. Identifica si corresponde a Persona Jurídica (J), Natural (V/E), Gubernamental (G) o Pasaporte (P), indicando mediante un banner si el dígito verificador es correcto.',
      },
      {
        title: '4. Verificación en Portal Oficial SENIAT (1 Clic)',
        description: 'Presione el botón "Portal SENIAT" junto al campo de documento para abrir la consulta del contribuyente en el portal web oficial con el RIF pre-cargado. Resuelva el código de seguridad gráfico para corroborar la razón social exacta y si es Contribuyente Especial SENIAT.',
      },
    ],
    rules: [
      'Validación Módulo 11: Garantiza que no se emitan facturas fiscales a clientes con RIFs ficticios o erróneos.',
      'Contribuyente Especial: Permite marcar si el cliente retiene IVA en sus compras para calcular retenciones automáticas.',
      'Soporte API Externa: Si la empresa configura SENIAT_RIF_API_URL en el servidor, la consulta de datos tributarios puede efectuarse de forma 100% automatizada.',
    ],
  },
  {
    id: 'email-communications',
    category: 'Configuración & Auditoría',
    title: 'Envío Directo de Correos y Redactor Electrónico Integrado',
    summary: 'Procedimiento para redactar correos en la aplicación y enviar documentos oficiales (PDF) a clientes o proveedores a través del servidor SMTP configurado.',
    steps: [
      {
        title: '1. Envío Directo desde el Visor de PDF',
        description: 'Al abrir cualquier documento oficial (factura, cotización, retención, reporte o certificado) en el visor de PDF, presione el botón "Enviar Correo" en la barra superior. Seleccione el contacto o ingrese un correo manual y presione enviar; el sistema adjuntará el archivo PDF automáticamente.',
        tip: 'El documento se despacha en tiempo real con plantilla corporativa y membrete oficial.',
      },
      {
        title: '2. Abrir el Redactor de Correos Integrado',
        description: 'Haga clic en el icono de sobre (Correo) en la barra superior del sistema (junto a notificaciones y chat) para desplegar el redactor global.',
      },
      {
        title: '3. Selección de Destinatarios y Directorio',
        description: 'Puede seleccionar un Cliente, Proveedor o Usuario del sistema desde el directorio integrado, o elegir "Directo / Libre" para escribir una dirección externa.',
      },
      {
        title: '4. Plantillas Rápidas y Adjuntos',
        description: 'Utilice las plantillas rápidas (Estado de Cuenta, Envío de Factura, Retención SENIAT o Cotización) para autorellenar el mensaje y use el botón "Adjuntar Archivo" para incluir cualquier archivo de soporte.',
      },
      {
        title: '5. Monitoreo e Historial de Envíos',
        description: 'En la pestaña "Historial de Envíos" del redactor, audite en cualquier momento los correos enviados, destinatarios, fechas y estados de entrega.',
      },
      {
        title: '6. Configuración del Servidor SMTP de la Empresa',
        description: 'Vaya a "Configuración & Auditoría > Empresa & Reglas" y seleccione la pestaña "Servidor de Correo (SMTP)". Active "Habilitar servidor SMTP propio" para indicar Host, Puerto, Cifrado TLS/SSL, Usuario, Contraseña de aplicación y Nombre de remitente. Presione "Probar Conexión SMTP en Vivo" para validar la entrega en tiempo real antes de guardar.',
        tip: 'Si la empresa cambia de correo corporativo o proveedor, puede actualizarlo aquí directamente con efecto inmediato y sin tocar el archivo .env del servidor.',
      },
    ],
    rules: [
      'Configuración SMTP Empresarial y Jerarquía: Los correos se envían prioritariamente con el servidor SMTP configurado para la empresa en "Configuración & Auditoría > Empresa & Reglas > Servidor de Correo (SMTP)". Si no está habilitado, el sistema recurre de respaldo a los parámetros globales del servidor (.env).',
      'Seguridad y Cifrado AES-256: La contraseña del servidor SMTP se almacena encriptada en la base de datos con AES-256-GCM y nunca se expone en texto plano.',
      'Auditoría Legal: Todo correo enviado genera un registro inmutable en la bitácora de auditoría del sistema.',
    ],
  },
  {
    id: 'supplier-rif-lookup',
    category: 'Compras & Cuentas por Pagar',
    title: 'Registro y Validación Fiscal de Proveedores con RIF SENIAT',
    summary: 'Procedimiento de validación matemática por Módulo 11, autocompletado inteligente de datos fiscales y verificación oficial en el portal del SENIAT.',
    steps: [
      {
        title: '1. Ingreso del RIF en la Ficha del Proveedor',
        description: 'En "Compras & Cuentas por Pagar > Proveedores", haga clic en "Nuevo Proveedor". Introduzca el RIF con o sin guiones (ej. J-12345678-9 o V123456780).',
      },
      {
        title: '2. Autocompletado Inteligente y Cruce de Datos',
        description: 'Al completar el RIF o presionar "Autocompletar", el sistema busca si este RIF ya existe registrado en la base de datos de clientes, proveedores o compras históricas. De encontrarlo, autorellena Razón Social, Nombre Comercial, Dirección Fiscal, Teléfono, Correo y términos tributarios.',
      },
      {
        title: '3. Validación Matemática Oficial SENIAT (Módulo 11)',
        description: 'El motor calcula el dígito verificador ponderado con el estándar del SENIAT. Identifica si corresponde a Persona Jurídica (J), Natural (V/E), Gubernamental (G) o Comunal (C), configurando automáticamente los flags de Persona Natural y Domiciliado.',
      },
      {
        title: '4. Verificación en Portal Oficial SENIAT (1 Clic)',
        description: 'Presione el botón "Portal SENIAT" junto al campo RIF para abrir la consulta del contribuyente en el portal web oficial con el RIF pre-cargado. Resuelva el código de seguridad gráfico para corroborar la razón social exacta y si es Contribuyente Especial / Agente de Retención.',
      },
    ],
    rules: [
      'Validación Módulo 11: Garantiza que no se asienten proveedores con RIFs erróneos o ficticios que invaliden las retenciones de IVA/ISLR.',
      'Soporte API Externa: Si la empresa dispone de una API de consulta RIF suscrita, el sistema puede enlazarse vía variables de entorno para consulta 100% desatendida.',
    ],
  },
  {
    id: 'taxes-export-seniat',
    category: 'Tributario & Fiscalidad SENIAT',
    title: 'Generación y Descarga de Archivos TXT (IVA) y XML (ISLR) para el SENIAT',
    summary: 'Procedimiento oficial para generar las Declaraciones Informativas de Retenciones exigidas por el SENIAT bajo Providencia SNAT/2015/0049 (IVA) y Decreto 1808 (ISLR).',
    steps: [
      {
        title: '1. Acceder a Retenciones Tributarias',
        description: 'En el menú lateral, diríjase a "Tributario & Fiscalidad SENIAT > Retenciones Tributarias". Verifique que el período fiscal activo corresponda al mes y año que desea declarar.',
      },
      {
        title: '2. Selección de Modalidad y Quincena (IVA)',
        description: 'Haga clic en el botón "TXT IVA". El sistema desplegará un asistente donde podrá elegir entre "Mes Completo", "1ra Quincena" (días 1 al 15) o "2da Quincena" (días 16 al último de mes) según el calendario de Sujetos Pasivos Especiales.',
      },
      {
        title: '3. Generación y Validación Preventiva',
        description: 'El sistema valida que existan comprobantes de retención activos para el período seleccionado. Si no hay registros, el sistema previene la generación de archivos vacíos que serían rechazados por el SENIAT.',
      },
      {
        title: '4. Carga en el Portal Fiscal SENIAT',
        description: 'El archivo resultante cumple con la estructura estricta del SENIAT (columnas tabuladas para IVA y esquema XML para ISLR). Acceda a contribuyente.seniat.gob.ve con su clave fiscal y cargue el archivo descargado.',
      },
    ],
    rules: [
      'Exclusivo para Sujetos Pasivos Especiales: Solo las empresas designadas como Agentes de Retención presentan declaraciones informativas de retenciones practicadas.',
      'Períodos Quincenales: Las retenciones de IVA se declaran y enteran quincenalmente según el último dígito del RIF.',
      'Sanciones Tributarias: La presentación extemporánea acarrea sanciones del Código Orgánico Tributario.',
    ],
  },
  {
    id: 'pos-cash-audit-closure',
    category: 'Ventas & Puntos de Venta',
    title: 'Control de Descuadres, Semáforo y Cierre de Turno de Caja (Arqueo)',
    summary: 'Protocolo de seguridad para el conteo de efectivo al cerrar turno, advertencias por semáforo y justificación obligatoria en caso de descuadres.',
    steps: [
      {
        title: '1. Iniciar Cierre de Turno',
        description: 'En "Ventas & Puntos de Venta > Cajas & Turnos", presione "Cerrar Turno". El sistema solicitará el conteo físico de gaveta tanto en Dólares ($ USD) como en Bolívares (Bs. VES).',
      },
      {
        title: '2. Semáforo Inteligente de Cuadre',
        description: 'El sistema compara en tiempo real el conteo contra las ventas registradas: Verde si está cuadrado exactamente; Amarillo si hay una diferencia menor por redondeo; Rojo si existe un descuadre significativo (mayor a $1.00 o 50 Bs).',
      },
      {
        title: '3. Justificación Obligatoria del Cajero',
        description: 'Ante un descuadre significativo, el sistema bloquea la confirmación hasta que el operador redacte la justificación del motivo en el campo de observaciones (ej. billetes deteriorados, faltante por vuelto o error de caja).',
      },
      {
        title: '4. Notificación y Reporte de Auditoría Inmediato',
        description: 'Al confirmar un cierre con diferencia, el sistema genera automáticamente un Reporte de Auditoría con alerta para el personal supervisor en el módulo "Verificación de Arqueos".',
      },
    ],
    rules: [
      'Arqueo a Ciegas: El sistema fomenta que el cajero cuente el efectivo físico antes de comparar para evitar manipulaciones.',
      'Trazabilidad en Bitácora: Todo descuadre queda asentado de forma indeleble en la auditoría del sistema.',
    ],
  },
  {
    id: 'pos-xml-electronic-invoice',
    category: 'Ventas & Puntos de Venta',
    title: 'Facturación Electrónica y Exportación XML de Comprobantes de Venta',
    summary: 'Descarga de comprobantes de facturación en formato estándar XML con desglose de ítems, alícuotas de IVA, IGTF y tipo de cambio BCV.',
    steps: [
      {
        title: '1. Emisión de la Factura en POS o Ventas',
        description: 'Al procesar una venta en el Punto de Venta o facturar una cotización, se abre el visor del comprobante fiscal homologado.',
      },
      {
        title: '2. Descarga del XML Fiscal',
        description: 'En el pie del visor del comprobante, presione el botón "XML Fiscal". El sistema compilará y descargará el archivo .xml estructurado con el nombre Factura_[RIF]_[NUMERO].xml.',
      },
      {
        title: '3. Estructura Compatible y Homologada',
        description: 'El XML incluye datos del emisor, cliente, desglose de ítems con base imponible y exenta, impuesto IVA (16%), IGTF (3%) y formas de pago utilizadas.',
      },
    ],
    rules: [
      'Estándar Fiscal: El archivo XML es compatible con integración a sistemas contables y plataformas de facturación electrónica.',
      'Validez Legal: El comprobante digital respalda la operación comercial junto con el ticket fiscal homologado.',
    ],
  },
  {
    id: 'treasury-reconciliation',
    category: 'Tesorería & Bancos',
    title: 'Conciliación Bancaria y Registro de Depósitos de Arqueos',
    summary: 'Cotejo de extractos bancarios en Bs y Divisas contra los cobros y transferencias del sistema.',
    steps: [
      {
        title: '1. Depósito de Arqueos de Caja',
        description: 'En "Ventas & Puntos de Venta > Verificación de Arqueos", el supervisor audita el turno cerrado y asigna los lotes de efectivo a las cuentas bancarias destino en Tesorería.',
      },
      {
        title: '2. Importación o Registro de Movimientos de Cuenta',
        description: 'En "Tesorería & Bancos > Cajas & Bancos" (o "Reportes & Exportación > Posición Bancaria & Liquidez"), consulte el libro auxiliar de banco cronológico con cargos, abonos y comisiones bancarias.',
      },
      {
        title: '3. Acta Formal de Conciliación',
        description: 'En "Tesorería & Bancos > Conciliación Bancaria", concilie las partidas en tránsito contra el saldo del extracto oficial y genere el dictamen legal.',
      },
    ],
  },
  {
    id: 'security-chat-audit',
    category: 'Configuración & Auditoría',
    title: 'Uso del Chat Interno entre Colaboradores y Bitácora de Auditoría',
    summary: 'Mensajería institucional instantánea, control de presencia en línea y supervisión de comunicaciones.',
    steps: [
      {
        title: '1. Acceso al Chat en Barra Superior',
        description: 'Haga clic en el ícono de mensaje en la barra superior. Verá sus conversaciones activas y el contador de mensajes no leídos en tiempo real.',
      },
      {
        title: '2. Presencia en Vivo y Estado Manual Personalizado',
        description: 'El sistema detecta automáticamente si los colaboradores están conectados o desconectados mediante conexión activa en tiempo real. Adicionalmente, cada usuario puede hacer clic en su selector de estado en la cabecera del chat para fijar su disponibilidad (En línea, Ausente, Ocupado o Desconectado / Invisible) y establecer un mensaje de estado opcional (ej. "En atención al cliente", "Arqueo de caja").',
      },
      {
        title: '3. Iniciar Chat y Enviar Mensajes',
        description: 'Presione "Nuevo Chat" para buscar cualquier usuario de la empresa por nombre o cargo con indicador visual de presencia. Escriba mensajes e inserte emoticones desde el selector interactivo.',
      },
      {
        title: '4. Bitácora de Supervisión (chat.audit)',
        description: 'Los usuarios con rol administrativo o permiso de auditoría pueden acceder a "Configuración & Auditoría > Bitácora de Chat" para consultar el historial de conversaciones, filtrar por colaboradores y descargar reportes de auditoría en texto.',
      },
      {
        title: '5. Grupos de Chat Institucionales',
        description: 'Presione "Grupo" para crear una conversación grupal asignando un título y seleccionando múltiples colaboradores. Dentro del grupo, los mensajes indican el nombre y cargo de cada participante, y es posible ver la lista de integrantes o añadir nuevos miembros.',
      },
      {
        title: '6. Eliminar o Ocultar Chat de la Bandeja Personal',
        description: 'Cada usuario puede hacer clic en el botón de papelera en un chat o en la cabecera activa para eliminarlo de su lista personal. Esto oculta la conversación para dicho usuario sin afectar la vista de los demás colaboradores ni alterar el historial permanente en la bitácora institucional. Si llega un nuevo mensaje, la conversación vuelve a mostrarse automáticamente.',
      },
      {
        title: '7. Depuración de la Bitácora por Rango de Fechas',
        description: 'Desde la vista "Bitácora de Chat", los administradores autorizados pueden presionar el botón "Depurar Bitácora" e ingresar un rango de fechas (Desde / Hasta) junto con la palabra de confirmación ELIMINAR para purgar de forma controlada el historial de mensajes de dicho período.',
      },
    ],
  },
  {
    id: 'roles-permissions-import',
    category: 'Configuración & Auditoría',
    title: 'Creación de Roles, Permisos Granulares e Importación entre Roles',
    summary: 'Diseño de perfiles de usuario y clonación de matrices de permisos para agilizar la configuración.',
    steps: [
      {
        title: '1. Acceder a Usuarios y Roles',
        description: 'En "Configuración & Auditoría > Usuarios & Permisos", cambie a la pestaña "Roles y Permisos del Sistema".',
      },
      {
        title: '2. Clonar un Rol Existente con un Clic',
        description: 'En la tarjeta de cualquier rol plantilla (ej: Cajero, Supervisor de Inventario), haga clic en "Clonar" para generar un nuevo rol preconfigurado.',
      },
      {
        title: '3. Importar Permisos dentro del Formulario',
        description: 'Al crear o editar un rol, utilice el selector "Importar permisos de otro rol" con las opciones "Reemplazar" o "Combinar" para ajustar los accesos de forma inmediata.',
      },
    ],
  },
  {
    id: 'acc-chart-of-accounts',
    category: 'Contabilidad',
    title: 'Catálogo Jerárquico de Cuentas VEN-NIF (NIIF para PYMES) y Clasificación Monetaria',
    summary: 'Estructuración del plan de cuentas en 4 niveles, diferenciación de partidas monetarias y no monetarias para ajuste por inflación, y activación de auxiliares de movimiento.',
    steps: [
      {
        title: '1. Niveles de Jerarquía en el Árbol Contable',
        description: 'El catálogo sigue la taxonomía oficial VEN-NIF en 4 niveles en "Contabilidad > Plan de Cuentas (VEN-NIF)": Nivel 1 (Clase: 1 Activo, 2 Pasivo, 3 Patrimonio, 4 Ingresos, 5 Costos, 6 Gastos, 7 Resultados/REI, 8 Cuentas de Orden), Nivel 2 (Subgrupo), Nivel 3 (Cuenta Mayor) y Nivel 4 (Cuenta Detalle Imputable).',
      },
      {
        title: '2. Cuentas Monetarias vs. No Monetarias (VEN-NIF B-10)',
        description: 'Cada cuenta posee la bandera "Monetaria": Las partidas monetarias (Caja, Bancos, CxC, CxP) mantienen valor nominal fijo y sufren la pérdida de poder adquisitivo por inflación generando REI; las no monetarias (Inventarios, Activos Fijos, Terrenos, Capital Social) no pierden valor intrínseco y deben reexpresarse con el factor del INPC oficial del BCV.',
      },
      {
        title: '3. Imputabilidad Estricta (Acepta Asientos)',
        description: 'Solo las cuentas de Nivel 4 con el flag "Acepta Asientos" activo pueden recibir débitos y créditos en comprobantes de diario. Las cuentas de nivel 1 al 3 son estrictamente acumuladoras de sumas.',
      },
      {
        title: '4. Inicialización Rápida del Catálogo',
        description: 'Si la empresa no posee cuentas contables, presione "Sembrar Catálogo Estándar VEN-NIF" para desplegar las 92 cuentas predeterminadas del estándar venezolano con sus naturalezas contables ya configuradas.',
      },
      {
        title: '5. Exportación del Catálogo',
        description: 'Puede descargar el catálogo formal en PDF con sangría visual de niveles, o exportar a Excel y CSV para auditoría externa.',
      },
    ],
    rules: [
      'No se puede eliminar una cuenta que contenga movimientos o saldos registrados en el Libro Diario.',
      'Toda cuenta imputable debe pertenecer a un grupo superior válido.',
    ],
  },
  {
    id: 'acc-journal-entries',
    category: 'Contabilidad',
    title: 'Registro de Comprobantes de Diario, Partida Doble y Asentado Legal',
    summary: 'Creación de asientos contables conforme al Código de Comercio (Art. 32-38), control de balance a cero en VES/USD y transición de Borrador a Asentado.',
    steps: [
      {
        title: '1. Creación de Nuevo Comprobante',
        description: 'En "Contabilidad > Libro Diario Legal", presione "Nuevo Comprobante". Seleccione la fecha de contabilización, el tipo de comprobante (Estándar, Apertura, Ajuste, Diferencial Cambiario, Ajuste por Inflación o Cierre) y redacte el concepto legal obligatorio.',
      },
      {
        title: '2. Registro de Líneas y Principio de Partida Doble',
        description: 'Agregue las cuentas de nivel 4 imputables. El sistema valida en tiempo real que la sumatoria de Débitos sea estrictamente igual a la sumatoria de Créditos. No se permite guardar ningún asiento con descuadre.',
      },
      {
        title: '3. Multimoneda Dual en Tiempo Real',
        description: 'Cada línea calcula automáticamente su contravalor en Bolívares (VES) y Divisas (USD) empleando la tasa oficial BCV de la fecha del asiento contable.',
      },
      {
        title: '4. Ciclo de Vida: De Borrador (DRAFT) a Asentado (POSTED)',
        description: 'Los comprobantes pueden guardarse en "Borrador (DRAFT)" para revisión previa. Al presionar "Asentar Comprobante", el asiento adquiere estado "POSTED", legalizándose de forma inmutable en el Libro Diario y afectando los saldos del Libro Mayor.',
      },
      {
        title: '5. Anulación y Trazabilidad sin Saltos de Folio',
        description: 'Por mandato del Código de Comercio venezolano, los asientos asentados no pueden eliminarse. Si existe un error justificado, presione "Anular Asiento": el sistema generará un contra-asiento de anulación auditado preservando la correlatividad.',
      },
    ],
    rules: [
      'La diferencia entre Débitos y Créditos debe ser exactamente 0.00 en ambas monedas.',
      'No se permite asentar comprobantes en períodos fiscales cerrados o bloqueados.',
    ],
  },
  {
    id: 'acc-auto-posting',
    category: 'Contabilidad',
    title: 'Motor de Contabilización Automática y Matriz de Mapeo por Operación',
    summary: 'Generación automática de asientos contables al procesar ventas en caja POS, compras, notas de crédito, ajustes de stock y tesorería sin intervención manual.',
    steps: [
      {
        title: '1. Interruptores de Circuitos Comerciales',
        description: 'En "Contabilidad > Contabilización Automática", active o desactive individualmente los circuitos que desea sincronizar: Ventas POS / Facturación comercial, Compras a proveedores, Cobros y Pagos CxC/CxP, Notas de Crédito/Débito SENIAT, Ajustes de Inventario y Movimientos de Tesorería.',
      },
      {
        title: '2. Configuración de la Matriz de Mapeo',
        description: 'En la pestaña "Mapeo de Cuentas", asocie cada concepto de negocio con una cuenta imputable del catálogo (ej: SALES_REVENUE -> 4.1.01, VAT_DEBIT -> 2.1.02.01, CASH_USD -> 1.1.01.03, INVENTORY -> 1.1.04.01).',
      },
      {
        title: '3. Asientos Instantáneos en Ventas y Compras',
        description: 'Cada vez que se emite una factura en el POS o se registra una compra, el motor genera de inmediato el asiento con el débito fiscal IVA, la retención de IGTF (3%) si aplica y el descargo de costo de venta contra inventario.',
      },
      {
        title: '4. Contabilización por Lotes (Batch Posting)',
        description: 'Si hubo operaciones registradas antes de configurar el motor o durante una contingencia, utilice la herramienta "Contabilización por Lotes" para procesar masivamente los documentos pendientes dentro de un rango de fechas.',
      },
    ],
  },
  {
    id: 'acc-trial-balance-ledger',
    category: 'Contabilidad',
    title: 'Balance de Comprobación de Sumas y Saldos y Libro Mayor Legal',
    summary: 'Auditoría y cotejo del equilibrio contable patrimonial y consulta analítica de movimientos por cuenta según el Código de Comercio.',
    steps: [
      {
        title: '1. Consulta del Balance de Comprobación',
        description: 'En "Contabilidad > Balance de Comprobación", filtre por período fiscal y nivel de agregación (Nivel 1 al 4). Verifique que los totales generales de Débitos y Créditos coincidan plenamente.',
      },
      {
        title: '2. Depuración de Cuentas sin Movimiento',
        description: 'Active la casilla "Ocultar saldos en cero" para generar un balance condensado con solo las cuentas que tuvieron actividad económica en el ejercicio.',
      },
      {
        title: '3. Inspección del Libro Mayor Analítico',
        description: 'En "Contabilidad > Libro Mayor Analítico", elija cualquier cuenta auxiliar. Podrá auditar el saldo inicial, cada transacción con su número de asiento, fecha, documento de soporte comercial y el saldo progresivo resultante.',
      },
      {
        title: '4. Exportación Oficial para Auditoría',
        description: 'Ambos reportes disponen de exportación a PDF formal con formato legal según el Código de Comercio, así como exportación a Excel para conciliaciones tributarias.',
      },
    ],
  },
  {
    id: 'acc-financial-statements',
    category: 'Contabilidad',
    title: 'Estados Financieros VEN-NIF (Situación Financiera y Resultados Integrales) y Reexpresión B-10',
    summary: 'Emisión oficial del Balance General clasificado, Estado de Ganancias y Pérdidas, y reexpresión en moneda constante para presentación bancaria y fiscal.',
    steps: [
      {
        title: '1. Estado de Situación Financiera (Balance General)',
        description: 'En "Contabilidad > Estados Financieros NIIF", consulte la estructura patrimonial dividida en Activo Corriente y No Corriente, Pasivo Corriente y No Corriente, y Patrimonio Neto. El sistema valida la ecuación patrimonial contable.',
      },
      {
        title: '2. Estado de Resultados Integrales (Ganancias y Pérdidas)',
        description: 'Analice los Ingresos Operacionales (gravados y exentos), Costo de Ventas del Kardex comercial, Margen Bruto, Gastos de Operación y Administración, y el Resultado Neto del Ejercicio.',
      },
      {
        title: '3. Reexpresión por Inflación VEN-NIF B-10',
        description: 'Active la opción "Reexpresión a Moneda Constante (VEN-NIF B-10)". El sistema aplica el factor de corrección monetaria derivado del INPC del BCV sobre las partidas no monetarias históricas.',
      },
      {
        title: '4. Impresión con Formato Profesional de Contador Colegiado',
        description: 'Descargue el reporte en PDF con membrete de la empresa, notas a los estados financieros y pie de firma para el Contador Público Colegiado (CPC) y la Gerencia General.',
      },
    ],
  },
  {
    id: 'acc-fiscal-closing-bcv',
    category: 'Contabilidad',
    title: 'Control de Cierres Mensuales, Diferencia Cambiaria y Ajuste por Inflación (INPC BCV / REI)',
    summary: 'Bloqueo de períodos fiscales para evitar alteraciones extemporáneas, registro de índices oficiales del BCV y cálculo del REI y diferencial cambiario.',
    steps: [
      {
        title: '1. Bloqueo de Períodos Fiscales Mensuales',
        description: 'En "Contabilidad > Cierres & Ajuste Inflación", administre los 12 meses del ejercicio. Cada mes puede transicionar entre Abierto (OPEN), Cerrado (CLOSED) y Bloqueado (LOCKED). El bloqueo impide la alteración retroactiva de la contabilidad.',
      },
      {
        title: '2. Regularización por Fluctuación Cambiaria Oficial BCV',
        description: 'En la sección de Diferencia en Cambio, indique la tasa oficial BCV de la fecha de cierre y presione "Simular Diferencia Cambiaria". El sistema revalúa bancos y cuentas por cobrar/pagar en USD contra su contravalor en Bolívares y genera el asiento contable de ganancia o pérdida cambiaria.',
      },
      {
        title: '3. Gestión y Registro de Índices INPC del BCV',
        description: 'Presione "Registrar INPC BCV" para registrar el valor oficial publicado por el Banco Central de Venezuela correspondiente a cada mes, junto con su variación mensual porcentual y fecha de publicación.',
      },
      {
        title: '4. Cálculo y Simulación del REI (VEN-NIF B-10)',
        description: 'Seleccione el Año y Mes de Cierre y el Año y Mes Base. Presione "Calcular REI (VEN-NIF)". El sistema calcula el factor oficial acumulado (INPC Cierre / INPC Base) y desglosa el ajuste requerido en cada partida no monetaria.',
      },
    ],
    rules: [
      'Un período bloqueado (LOCKED) no puede reabrirse sin permisos de auditoría superior.',
      'El cálculo del factor de inflación exige que los índices del BCV de ambos períodos estén registrados en la base de datos.',
    ],
  },
];

// -----------------------------------------------------------------------------
// GLOSARIO DE BANDERAS Y ESTADOS EN INGLÉS
// -----------------------------------------------------------------------------

const BADGE_DICTIONARY: BadgeExplanation[] = [
  {
    term: 'ACTIVE',
    spanish: 'Activo / Operativo',
    category: 'General / Catálogo',
    badgeVariant: 'success',
    meaning: 'Indica que el registro (usuario, producto, sucursal, caja o método de pago) está completamente operativo y disponible para transacciones en el sistema.',
    usageContext: 'Usuarios, Catálogo de Productos, Cajas Registradoras, Cuentas Bancarias.',
  },
  {
    term: 'INACTIVE / SUSPENDED',
    spanish: 'Inactivo / Suspendido',
    category: 'General / Catálogo',
    badgeVariant: 'neutral',
    meaning: 'El registro ha sido deshabilitado temporal o permanentemente. No puede iniciar sesión ni utilizarse en nuevas operaciones, pero se preserva su histórico contable.',
    usageContext: 'Usuarios suspendidos, productos descontinuados, cajas cerradas.',
  },
  {
    term: 'DRAFT',
    spanish: 'Borrador',
    category: 'Documentos',
    badgeVariant: 'warning',
    meaning: 'Documento en proceso de redacción o preparación. No afecta existencias de inventario, no genera asientos contables ni compromisos financieros hasta ser emitido.',
    usageContext: 'Cotizaciones, órdenes de compra en elaboración, comprobantes contables sin asentar.',
  },
  {
    term: 'PENDING',
    spanish: 'Pendiente',
    category: 'Documentos / Pagos',
    badgeVariant: 'warning',
    meaning: 'La transacción u orden ha sido formalmente creada pero está esperando una acción posterior (ej: recepción de mercancía, cobro de factura o preparación de comanda).',
    usageContext: 'Facturas a crédito por cobrar, órdenes de compra sin recepcionar, comandas en espera de cocina.',
  },
  {
    term: 'COMPLETED / PAID',
    spanish: 'Completado / Pagado',
    category: 'Transacciones',
    badgeVariant: 'success',
    meaning: 'La operación ha finalizado exitosamente en su totalidad. Los bienes fueron entregados y los fondos fueron cobrados/conciliados al 100%.',
    usageContext: 'Ventas de contado, facturas de clientes saldadas, transferencias procesadas.',
  },
  {
    term: 'PARTIAL',
    spanish: 'Abonado Parcialmente',
    category: 'Cobranzas y CxC',
    badgeVariant: 'info',
    meaning: 'Se ha registrado uno o varios abonos o pagos a cuenta, pero aún existe un saldo pendiente de liquidación sobre la factura o deuda.',
    usageContext: 'Cuentas por Cobrar (CxC), Cuentas por Pagar (CxP).',
  },
  {
    term: 'OVERDUE',
    spanish: 'Vencido / En Mora',
    category: 'Cobranzas y CxC',
    badgeVariant: 'danger',
    meaning: 'La fecha límite de pago acordada ha expirado sin haberse cancelado la totalidad de la deuda. Requiere gestión de cobranza inmediata.',
    usageContext: 'Reporte de Antigüedad de Saldos CxC / CxP, facturas a crédito pendientes.',
  },
  {
    term: 'CANCELLED / VOID',
    spanish: 'Anulado / Revocado',
    category: 'Documentos',
    badgeVariant: 'danger',
    meaning: 'El comprobante fue cancelado formalmente. El sistema revirtió de forma automática los movimientos de inventario y saldos contables generados originalmente.',
    usageContext: 'Facturas anuladas con Nota de Crédito, cotizaciones canceladas, cheques devueltos.',
  },
  {
    term: 'IN_REVIEW',
    spanish: 'En Revisión / Dictamen',
    category: 'Auditoría y Arqueos',
    badgeVariant: 'warning',
    meaning: 'Operación que presentó discrepancias o excedió los límites autorizados y requiere que un supervisor o gerente emita un dictamen formal de aprobación.',
    usageContext: 'Arqueos de caja con faltante/sobrante, ajustes de inventario de alto valor.',
  },
  {
    term: 'POSTED',
    spanish: 'Asentado en Diario Legal',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'success',
    meaning: 'El asiento contable fue revisado y asentado definitivamente en los Libros Legales (Diario y Mayor). Es inmutable por mandato del Código de Comercio (Art. 32-38).',
    usageContext: 'Módulo de Contabilidad, Libro Diario y Balances.',
  },
  {
    term: 'DRAFT (Contable)',
    spanish: 'Borrador de Asiento',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'warning',
    meaning: 'Comprobante en preparación o revisión contable. Es completamente modificable y no afecta los saldos de los libros mayores ni estados financieros.',
    usageContext: 'Comprobantes de diario pendientes de asentamiento.',
  },
  {
    term: 'ANNULLED (Contable)',
    spanish: 'Asiento Anulado / Reversado',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'danger',
    meaning: 'Comprobante cancelado por contra-asiento de anulación auditado. Mantiene su número de comprobante para garantizar que no existan saltos en los folios del libro diario.',
    usageContext: 'Comprobantes de diario anulados con justificación legal.',
  },
  {
    term: 'LOCKED (Período)',
    spanish: 'Período Bloqueado / Auditado',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'neutral',
    meaning: 'El mes contable ha sido cerrado y auditado formalmente. Ningún usuario puede asentar comprobantes retroactivos ni modificar transacciones en dicho período.',
    usageContext: 'Control de cierres mensuales y ejercicios fiscales.',
  },
  {
    term: 'MONETARY',
    spanish: 'Partida Monetaria',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'info',
    meaning: 'Cuenta contable que representa dinero en efectivo o créditos/débitos fijos en bolívares. No se reexpresa por inflación; su exposición genera el Resultado por Exposición a la Inflación (REI).',
    usageContext: 'Catálogo de cuentas (Caja, Bancos, Cuentas por Cobrar y Pagar).',
  },
  {
    term: 'NON_MONETARY',
    spanish: 'Partida No Monetaria',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'success',
    meaning: 'Cuenta contable cuyos bienes o derechos conservan su valor intrínseco frente a la inflación. Debe ser reexpresada a moneda constante usando el factor derivado del INPC del BCV (VEN-NIF B-10).',
    usageContext: 'Catálogo de cuentas (Inventarios, Propiedades Planta y Equipo, Terrenos, Capital Social).',
  },
  {
    term: 'INPC (BCV)',
    spanish: 'Índice Nacional de Precios al Consumidor',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'success',
    meaning: 'Serie oficial publicada mensualmente por el Banco Central de Venezuela que cuantifica la variación del poder adquisitivo y determina el factor de corrección monetaria.',
    usageContext: 'Cierre fiscal, ajuste por inflación VEN-NIF B-10 y estados financieros.',
  },
  {
    term: 'REI',
    spanish: 'Resultado por Exposición a la Inflación',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'info',
    meaning: 'Efecto financiero patrimonial originado por mantener activos o pasivos monetarios durante un período de inflación. Se reconoce como ingreso o gasto en el Estado de Resultados.',
    usageContext: 'Ajuste integral por inflación y Estado de Resultados Integrales.',
  },
  {
    term: 'AUTO_POSTED',
    spanish: 'Contabilizado Automáticamente',
    category: 'Contabilidad VEN-NIF',
    badgeVariant: 'info',
    meaning: 'Comprobante generado de forma inmediata por el motor contable en respuesta a un evento comercial (venta POS, compra, cobro, nota SENIAT o ajuste de stock).',
    usageContext: 'Comprobantes de diario con trazabilidad a documentos mercantiles de origen.',
  },
  {
    term: 'CLOSED',
    spanish: 'Cerrado / Concluido',
    category: 'POS / Cierres',
    badgeVariant: 'neutral',
    meaning: 'El turno de caja o período contable ha sido cerrado de forma definitiva. Se han consolidado los reportes Z y las declaraciones de ingresos.',
    usageContext: 'Turnos de caja cerrados, cierres de ejercicio contable anual.',
  },
  {
    term: 'IN_TRANSIT',
    spanish: 'En Tránsito',
    category: 'Inventario',
    badgeVariant: 'info',
    meaning: 'Mercancía que ha salido del almacén de origen pero aún no ha sido recibida y confirmada en el almacén de destino.',
    usageContext: 'Traslados entre depósitos y sucursales.',
  },
  {
    term: 'DAMAGED / EXPIRED',
    spanish: 'Dañado / Vencido',
    category: 'Inventario',
    badgeVariant: 'danger',
    meaning: 'Causa o estado de producto clasificado como merma por deterioro físico o fecha de expiración vencida.',
    usageContext: 'Ajustes de inventario por salida, control de lotes.',
  },
  {
    term: 'COOKING / READY',
    spanish: 'En Preparación / Listo',
    category: 'Restaurante KDS',
    badgeVariant: 'info',
    meaning: 'Estado operativo del pedido en el Kitchen Display System (Cocina y Barra) desde su recepción hasta que el mesonero lo retira para servir a la mesa.',
    usageContext: 'Monitor KDS de Restaurante.',
  },
];

// -----------------------------------------------------------------------------
// REGLAS DE NEGOCIO Y CONFIGURACIÓN DEL SISTEMA
// -----------------------------------------------------------------------------

const BUSINESS_RULES_EXPLANATION: BusinessRuleExplanation[] = [
  {
    name: 'Sincronización Automática de Tasa Oficial BCV',
    legalContext: 'Gaceta Oficial Banco Central de Venezuela / Convenio Cambiario N° 1',
    description: 'El sistema sincroniza automáticamente la tasa de cambio oficial publicada por el BCV. Todas las operaciones en bolívares calculan su equivalente en USD y viceversa.',
    configurationGuide: 'En "Precios & Tarifas > Tasas de Cambio (BCV)", puede forzar la sincronización en vivo o ingresar una tasa manual justificada si el servicio del BCV experimenta intermitencia.',
    auditImpact: 'Queda trazado en la bitácora quién, cuándo y con qué tasa se registró cada documento fiscal.',
  },
  {
    name: 'IGTF en Divisas y Efectivo Moneda Extranjera (3%)',
    legalContext: 'Ley de Impuesto a las Grandes Transacciones Financieras (SENIAT)',
    description: 'Aplica una alícuota del 3% sobre cualquier cobro o pago recibido en divisas en efectivo, Zelle u otros medios no bancarizados en territorio nacional.',
    configurationGuide: 'En "Configuración & Auditoría > Empresa & Reglas", active o desactive la casilla "Habilitar IGTF (3%)". Cada método de pago tiene el flag "Aplica IGTF".',
    auditImpact: 'Se desglosa en el comprobante fiscal y en el Libro de Ventas para la declaración quincenal del SENIAT.',
  },
  {
    name: 'Control de Venta con Stock Negativo',
    legalContext: 'Control Interno de Existencias y Prevención de Descuadres',
    description: 'Determina si el Punto de Venta permite vender productos cuya existencia física en el almacén seleccionado sea cero o menor.',
    configurationGuide: 'En "Configuración & Auditoría > Empresa & Reglas", seleccione: "Bloquear venta" (recomendado para control estricto) o "Requerir autorización de supervisor".',
    auditImpact: 'Evita descuadres contables y errores en el cálculo del costo promedio ponderado de inventario.',
  },
  {
    name: 'Arqueo Ciego Obligatorio en Cierre de Turno',
    legalContext: 'Auditoría Financiera y Prevención de Fraudes en Caja',
    description: 'Obliga a que el cajero ingrese el dinero contado en gaveta sin conocer de antemano el saldo que el sistema calculó por ventas.',
    configurationGuide: 'En "Configuración & Auditoría > Empresa & Reglas", active "Exigir Arqueo Ciego". El dictamen de faltantes o sobrantes se calcula automáticamente al confirmar.',
    auditImpact: 'Garantiza la imparcialidad del cajero y documenta cualquier diferencia para la verificación de arqueos de supervisión.',
  },
  {
    name: 'Almacén Fijo por Sede para Colaboradores',
    legalContext: 'Seguridad Operativa y Segregación de Funciones',
    description: 'Impide que los usuarios operativos cambien arbitrariamente el almacén donde descargan mercancía o facturan.',
    configurationGuide: 'En "Configuración & Auditoría > Usuarios & Permisos", al editar un usuario, active "Establecer almacén fijo por sucursal" y elija el depósito autorizado.',
    auditImpact: 'Garantiza que cada operador solo afecte el inventario físico que tiene bajo su custodia y responsabilidad.',
  },
  {
    name: 'Departamentos Visibles por Caja Registradora',
    legalContext: 'Especialización de Puntos de Venta (Hipermercados, Farmacias, Restaurantes)',
    description: 'Permite que una caja (ej: Caja de Charcutería, Caja de Licores o Caja de Barra) solo muestre los productos de departamentos específicos.',
    configurationGuide: 'En "Configuración & Auditoría > Sucursales & Cajas", edite la caja y en "Departamentos Visibles en esta Caja" marque los departamentos autorizados. Si no marca ninguno, mostrará todo el catálogo.',
    auditImpact: 'Agiliza la facturación en pantalla táctil y previene errores de despacho en cajas departamentales.',
  },
  {
    name: 'Partida Doble Estricta e Invariabilidad del Cuadre Contable',
    legalContext: 'Código de Comercio de Venezuela (Art. 32-38) y Principios VEN-NIF',
    description: 'Prohíbe terminantemente registrar o guardar cualquier comprobante de diario donde la sumatoria de débitos difiera de la sumatoria de créditos.',
    configurationGuide: 'Regla arquitectónica no desactivable. El validador frontend y el motor backend exigen que la diferencia sea exactamente 0.00 en Bolívares y Divisas.',
    auditImpact: 'Garantiza la integridad patrimonial de los libros legales ante revisiones tributarias del SENIAT y auditorías externas.',
  },
  {
    name: 'Bloqueo de Períodos Fiscales Mensuales (Anti-Extemporaneidad)',
    legalContext: 'Seguridad Contable, Código Orgánico Tributario y Cierre de Ejercicios',
    description: 'Impide que los operadores asienten o modifiquen comprobantes contables con fechas correspondientes a meses que ya han sido cerrados o bloqueados por el contador.',
    configurationGuide: 'En "Contabilidad > Cierres & Ajuste Inflación", administre los 12 períodos mensuales cambiando el estado a "CLOSED" o "LOCKED".',
    auditImpact: 'Previene fraudes contables, modificaciones extemporáneas a declaraciones de IVA/ISLR ya presentadas y garantiza la firmeza de los balances emitidos.',
  },
  {
    name: 'Contabilización Automática en Tiempo Real por Circuito Comercial',
    legalContext: 'Integración Contable-Operativa y Trazabilidad Comercial',
    description: 'Genera asientos automáticos inmediatos ante eventos de facturación POS, recepción de compras, pagos, notas de crédito/débito y ajustes de inventario.',
    configurationGuide: 'En "Contabilidad > Contabilización Automática", active los interruptores de los circuitos deseados y configure la matriz de mapeo de cuentas.',
    auditImpact: 'Elimina el desfase temporal entre la operación comercial física y los registros contables, garantizando mayores y balances al día en tiempo real.',
  },
  {
    name: 'Ajuste Integral por Inflación VEN-NIF B-10 con Índices Oficiales BCV',
    legalContext: 'Norma VEN-NIF B-10 de la Federación de Colegios de Contadores Públicos de Venezuela (FCCPV)',
    description: 'Reexpresa las partidas no monetarias históricas a moneda constante utilizando la serie histórica oficial del INPC publicada por el Banco Central de Venezuela y determina el Resultado por Exposición a la Inflación (REI).',
    configurationGuide: 'En "Contabilidad > Cierres & Ajuste Inflación", registre mensualmente el INPC oficial del BCV y ejecute el cálculo seleccionando el período de cierre y período base.',
    auditImpact: 'Requisito mandatorio para la emisión de Estados Financieros certificados presentados a instituciones bancarias, licitaciones y auditorías fiscales.',
  },
  {
    name: 'Revaluación Mensual de Saldos en Moneda Extranjera a Tasa Oficial BCV',
    legalContext: 'Norma VEN-NIF N° 12 y Ley del Banco Central de Venezuela',
    description: 'Revalúa al último día de cada mes los saldos en divisas (USD) de cuentas bancarias y cuentas por cobrar/pagar contra la tasa oficial de corte del BCV, reconociendo la ganancia o pérdida cambiaria realizada y no realizada.',
    configurationGuide: 'En "Contabilidad > Cierres & Ajuste Inflación", verifique la tasa BCV del cierre mensual y presione "Simular Diferencia Cambiaria".',
    auditImpact: 'Cumple con la obligatoriedad de reflejar la posición financiera real de la empresa en moneda de curso legal (Bolívares) en los libros de contabilidad.',
  },
  {
    name: 'Servidor de Correo SMTP Empresarial con Respaldo en Servidor',
    legalContext: 'Comunicaciones Oficiales, Cifrado de Credenciales y Autonomía Corporativa',
    description: 'Permite a cada empresa definir su propio servidor y credenciales SMTP para el despacho de facturas y notificaciones por email, con cifrado AES-256-GCM y respaldo automático en las credenciales del servidor (.env).',
    configurationGuide: 'En "Configuración & Auditoría > Empresa & Reglas", abra la pestaña "Servidor de Correo (SMTP)", active "Habilitar servidor SMTP propio" y valide con "Probar Conexión SMTP en Vivo".',
    auditImpact: 'Garantiza la trazabilidad legal del remitente corporativo y la confidencialidad de las credenciales de correo en base de datos.',
  },
];

export const HelpCenterView: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<'guides' | 'badges' | 'rules' | 'accounting'>('guides');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(USER_GUIDES[0].id);

  // Categorías de guías disponibles
  const categories = useMemo(() => {
    const set = new Set(USER_GUIDES.map((g) => g.category));
    return ['ALL', ...Array.from(set)];
  }, []);

  // Filtrado de guías
  const filteredGuides = useMemo(() => {
    return USER_GUIDES.filter((g) => {
      const matchesCat = selectedCategory === 'ALL' || g.category === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      if (!term) return matchesCat;
      const matchesText =
        g.title.toLowerCase().includes(term) ||
        g.summary.toLowerCase().includes(term) ||
        g.steps.some((s) => s.title.toLowerCase().includes(term) || s.description.toLowerCase().includes(term));
      return matchesCat && matchesText;
    });
  }, [selectedCategory, searchTerm]);

  // Filtrado de banderas
  const filteredBadges = useMemo(() => {
    if (!searchTerm.trim()) return BADGE_DICTIONARY;
    const term = searchTerm.toLowerCase().trim();
    return BADGE_DICTIONARY.filter(
      (b) =>
        b.term.toLowerCase().includes(term) ||
        b.spanish.toLowerCase().includes(term) ||
        b.meaning.toLowerCase().includes(term) ||
        b.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Filtrado de reglas
  const filteredRules = useMemo(() => {
    if (!searchTerm.trim()) return BUSINESS_RULES_EXPLANATION;
    const term = searchTerm.toLowerCase().trim();
    return BUSINESS_RULES_EXPLANATION.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        r.legalContext.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Generador del Manual de Usuario Completo Descargable (Markdown y Texto)
  const handleDownloadManual = (format: 'markdown' | 'text') => {
    const now = new Date();
    let doc = '';

    if (format === 'markdown') {
      doc += `# MANUAL OFICIAL DE USUARIO Y PROCEDIMIENTOS OPERATIVOS\n`;
      doc += `**Sistema ERO ERP VE - Edición Empresarial**\n`;
      doc += `*Fecha de Generación: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}*\n`;
      doc += `*Generado por: ${user?.fullName || user?.username || 'Usuario Autorizado'}*\n\n`;
      doc += `---\n\n`;

      doc += `## TABLA DE CONTENIDO\n`;
      doc += `1. Introducción y Arquitectura del Sistema\n`;
      doc += `2. Procedimientos Operativos Paso a Paso\n`;
      doc += `3. Diccionario de Banderas y Estados del Sistema (Glosario EN -> ES)\n`;
      doc += `4. Reglas de Negocio, Marco Legal y Parámetros SENIAT\n`;
      doc += `5. Normas de Control Interno y Auditoría\n\n`;
      doc += `---\n\n`;

      doc += `## 1. PROCEDIMIENTOS OPERATIVOS PASO A PASO\n\n`;
      USER_GUIDES.forEach((g, idx) => {
        doc += `### 1.${idx + 1} ${g.title}\n`;
        doc += `*Categoría:* **${g.category}**\n\n`;
        doc += `${g.summary}\n\n`;
        doc += `#### Pasos a Seguir:\n`;
        g.steps.forEach((s) => {
          doc += `- **${s.title}**: ${s.description}\n`;
          if (s.tip) doc += `  > *Consejo / Alerta:* ${s.tip}\n`;
        });
        if (g.rules && g.rules.length > 0) {
          doc += `\n*Reglas Aplicables:*\n`;
          g.rules.forEach((r) => (doc += `  - ${r}\n`));
        }
        doc += `\n`;
      });

      doc += `---\n\n`;
      doc += `## 2. GLOSARIO DE BANDERAS Y ESTADOS DEL SISTEMA (EN -> ES)\n\n`;
      doc += `| Bandera (Inglés) | Equivalente en Español | Categoría | Significado y Alcance Operativo |\n`;
      doc += `| :--- | :--- | :--- | :--- |\n`;
      BADGE_DICTIONARY.forEach((b) => {
        doc += `| \`${b.term}\` | **${b.spanish}** | ${b.category} | ${b.meaning} |\n`;
      });
      doc += `\n---\n\n`;

      doc += `## 3. REGLAS DE NEGOCIO Y CONFIGURACIÓN SENIAT / BCV\n\n`;
      BUSINESS_RULES_EXPLANATION.forEach((r, idx) => {
        doc += `### 3.${idx + 1} ${r.name}\n`;
        doc += `*Marco Legal:* ${r.legalContext}\n\n`;
        doc += `**Descripción:** ${r.description}\n\n`;
        doc += `**Cómo Configurar:** ${r.configurationGuide}\n\n`;
        doc += `**Impacto en Auditoría:** ${r.auditImpact}\n\n`;
      });

      doc += `---\n\n`;
      doc += `## 4. MANUAL DEL MÓDULO CONTABLE VEN-NIF (NIIF PARA PYMES)\n\n`;
      doc += `El módulo de contabilidad de ERO ERP cumple con el Código de Comercio de Venezuela (Art. 32-38) y el marco VEN-NIF emitido por la FCCPV, con soporte para doble moneda funcional (VES y USD), partida doble estricta, reexpresión por inflación con INPC oficial del BCV (VEN-NIF B-10) y regularización de fluctuación cambiaria.\n\n`;
      doc += `### 4.1 Submódulos del Sistema Contable\n`;
      doc += `1. **Plan de Cuentas (VEN-NIF):** Catálogo jerárquico a 4 niveles con clasificación monetaria (REI) y no monetaria.\n`;
      doc += `2. **Libro Diario Legal:** Registro cronológico de comprobantes DRAFT y POSTED con balance estricto Débito = Crédito.\n`;
      doc += `3. **Contabilización Automática:** Motor en tiempo real para ventas POS, compras, cobros CxC, pagos CxP y ajustes de inventario.\n`;
      doc += `4. **Libro Mayor Analítico:** Ficha analítica por cuenta contable con arrastre de saldos y trazabilidad al documento soporte.\n`;
      doc += `5. **Balance de Comprobación:** Sumas y saldos para verificación de la ecuación patrimonial a cualquier nivel.\n`;
      doc += `6. **Estados Financieros NIIF:** Estado de Situación Financiera y Estado de Resultados con opción histórica o reexpresada.\n`;
      doc += `7. **Cierres & Ajuste Inflación:** Control mensual (OPEN, CLOSED, LOCKED), carga de INPC del BCV, cálculo de REI y diferencial cambiario.\n\n`;
      doc += `### 4.2 Matriz de Mapeo Predeterminado (Contabilización Automática)\n\n`;
      doc += `| Clave de Mapeo | Cuenta VEN-NIF | Denominación Contable | Evento Comercial |\n`;
      doc += `| :--- | :--- | :--- | :--- |\n`;
      doc += `| SALES_REVENUE | 4.1.01 | Ventas de Mercancías Gravadas con IVA | Facturación POS alícuota general |\n`;
      doc += `| SALES_REVENUE_EXEMPT | 4.1.02 | Ventas de Mercancías Exentas / Exoneradas | Facturación de rubros exentos de IVA |\n`;
      doc += `| VAT_DEBIT | 2.1.02.01 | IVA Débito Fiscal | Impuesto 16% generado en ventas |\n`;
      doc += `| VAT_CREDIT | 1.1.03.01 | IVA Crédito Fiscal | Impuesto soportado en compras |\n`;
      doc += `| IGTF_PAYABLE | 2.1.02.05 | IGTF por Enterar al SENIAT | Percibido en cobros divisas en efectivo |\n`;
      doc += `| AR_CUSTOMERS_VES | 1.1.02.01 | Clientes Nacionales Comerciales | Ventas a crédito en Bolívares |\n`;
      doc += `| AP_SUPPLIERS_VES | 2.1.01.01 | Proveedores Nacionales | Facturas de compra a crédito en Bolívares |\n`;
      doc += `| INVENTORY | 1.1.04.01 | Inventario de Mercancías | Existencias de almacén a costo promedio |\n`;
      doc += `| COST_OF_SALES | 5.1.01 | Costo de Mercancía Vendida | Descargo automático al facturar |\n`;
      doc += `| EXCHANGE_DIFF_GAIN | 7.2.01 | Ganancia en Fluctuación Cambiaria | Revaluación cambiaria favorable |\n`;
      doc += `| EXCHANGE_DIFF_LOSS | 7.1.02 | Pérdida en Fluctuación Cambiaria | Revaluación cambiaria desfavorable |\n`;
      doc += `| REI_RESULT | 7.3.01 | Resultado Monetario del Ejercicio (REI) | Ajuste por inflación VEN-NIF B-10 |\n`;
    } else {
      // Texto Plano
      doc += `===============================================================================\n`;
      doc += `   MANUAL OFICIAL DE USUARIO Y PROCEDIMIENTOS OPERATIVOS - ERO ERP VE\n`;
      doc += `   Fecha: ${now.toLocaleString()} | Generado por: ${user?.fullName || user?.username}\n`;
      doc += `===============================================================================\n\n`;

      USER_GUIDES.forEach((g, idx) => {
        doc += `[PROCEDIMIENTO ${idx + 1}] ${g.title.toUpperCase()}\n`;
        doc += `Modulo: ${g.category}\n`;
        doc += `Resumen: ${g.summary}\n`;
        doc += `PASOS:\n`;
        g.steps.forEach((s) => {
          doc += `  * ${s.title}: ${s.description}\n`;
        });
        doc += `\n${'-'.repeat(70)}\n\n`;
      });

      doc += `===============================================================================\n`;
      doc += `   GLOSARIO DE BANDERAS Y ESTADOS DEL SISTEMA (EN -> ES)\n`;
      doc += `===============================================================================\n\n`;
      BADGE_DICTIONARY.forEach((b) => {
        doc += `* [${b.term}] = ${b.spanish} (${b.category})\n`;
        doc += `  Significado: ${b.meaning}\n`;
        doc += `  Ambito: ${b.usageContext}\n\n`;
      });

      doc += `===============================================================================\n`;
      doc += `   REGLAS DE NEGOCIO Y MARCO LEGAL\n`;
      doc += `===============================================================================\n\n`;
      BUSINESS_RULES_EXPLANATION.forEach((r) => {
        doc += `* ${r.name.toUpperCase()}\n`;
        doc += `  Base Legal: ${r.legalContext}\n`;
        doc += `  Descripcion: ${r.description}\n`;
        doc += `  Guia: ${r.configurationGuide}\n\n`;
      });

      doc += `===============================================================================\n`;
      doc += `   ARQUITECTURA DEL MÓDULO CONTABLE VEN-NIF (NIIF PARA PYMES)\n`;
      doc += `===============================================================================\n\n`;
      doc += `SUBMÓDULOS:\n`;
      doc += `* 1. Plan de Cuentas (VEN-NIF): Estructura jerárquica a 4 niveles con clasificación monetaria.\n`;
      doc += `* 2. Libro Diario Legal: Comprobantes DRAFT/POSTED con partida doble obligatoria (Débito = Crédito).\n`;
      doc += `* 3. Contabilización Automática: Asientos en tiempo real para ventas, compras, CxC, CxP y ajustes.\n`;
      doc += `* 4. Libro Mayor Analítico: Saldos arrastrados y trazabilidad completa al documento origen.\n`;
      doc += `* 5. Balance de Comprobación: Cuadre de sumas y saldos por nivel.\n`;
      doc += `* 6. Estados Financieros NIIF: Situación Financiera y Resultados Integrales (históricos y reexpresados).\n`;
      doc += `* 7. Cierres & Ajuste Inflación: Bloqueo mensual, diferencial cambiario e INPC del BCV para REI B-10.\n\n`;
      doc += `MATRIZ DE MAPEOS PRINCIPALES:\n`;
      doc += `* SALES_REVENUE -> 4.1.01 (Ventas Gravadas)\n`;
      doc += `* SALES_REVENUE_EXEMPT -> 4.1.02 (Ventas Exentas)\n`;
      doc += `* VAT_DEBIT -> 2.1.02.01 (IVA Débito Fiscal)\n`;
      doc += `* VAT_CREDIT -> 1.1.03.01 (IVA Crédito Fiscal)\n`;
      doc += `* IGTF_PAYABLE -> 2.1.02.05 (IGTF por Enterar)\n`;
      doc += `* AR_CUSTOMERS_VES -> 1.1.02.01 (Clientes Comerciales)\n`;
      doc += `* AP_SUPPLIERS_VES -> 2.1.01.01 (Proveedores Nacionales)\n`;
      doc += `* INVENTORY -> 1.1.04.01 (Inventario de Mercancías)\n`;
      doc += `* COST_OF_SALES -> 5.1.01 (Costo de Ventas)\n`;
      doc += `* EXCHANGE_DIFF_GAIN / LOSS -> 7.2.01 / 7.1.02 (Fluctuación Cambiaria)\n`;
      doc += `* REI_RESULT -> 7.3.01 (Resultado por Exposición a la Inflación B-10)\n\n`;
    }

    const mime = format === 'markdown' ? 'text/markdown;charset=utf-8;' : 'text/plain;charset=utf-8;';
    const ext = format === 'markdown' ? 'md' : 'txt';
    const blob = new Blob([doc], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Manual_Usuario_ERO_ERP_${now.toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Manual de Usuario generado y descargado exitosamente (.${ext})`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-700 dark:text-emerald-300">
              <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Centro de Ayuda, Guías & Manual de Usuario
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manual interactivo de procedimientos paso a paso, glosario de estados, reglas de negocio y documentación descargable.
          </p>
        </div>

        {/* Acciones de Descarga e Impresión */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200"
            title="Imprimir o guardar en PDF desde el navegador"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            <span>Imprimir / PDF</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleDownloadManual('markdown')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            title="Descargar Manual Completo formateado en Markdown"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Descargar Manual (.md)</span>
          </Button>
        </div>
      </div>

      {/* Barra de Búsqueda Global y Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar procedimiento, paso, bandera en inglés o regla (ej: arqueo, DRAFT, IGTF, BCV, propina)..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
          />
        </div>

        {/* Tabs de Navegación de Ayuda */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('guides')}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'guides'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Guías y Procedimientos ({USER_GUIDES.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('badges')}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'badges'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Glosario de Banderas en Inglés ({BADGE_DICTIONARY.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'rules'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Configuración & Reglas de Negocio ({BUSINESS_RULES_EXPLANATION.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accounting')}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'accounting'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>Manual Contabilidad VEN-NIF</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO DE TAB 1: PROCEDIMIENTOS PASO A PASO */}
      {activeTab === 'guides' && (
        <div className="space-y-4">
          {/* Selector de Categorías */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                {cat === 'ALL' ? 'Todos los Módulos' : cat}
              </button>
            ))}
          </div>

          {/* Listado de Guías / Acordeón */}
          <div className="space-y-3">
            {filteredGuides.length === 0 && (
              <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-400 text-xs">
                No se encontraron procedimientos que coincidan con la búsqueda.
              </div>
            )}

            {filteredGuides.map((guide) => {
              const isExpanded = expandedGuideId === guide.id;
              return (
                <div
                  key={guide.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-2xs transition-all"
                >
                  {/* Cabecera del Acordeón */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGuideId(isExpanded ? null : guide.id)
                    }
                    className="w-full p-3.5 flex items-start justify-between gap-3 text-left hover:bg-neutral-50/70 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {guide.category}
                        </span>
                        <h2 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                          {guide.title}
                        </h2>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {guide.summary}
                      </p>
                    </div>

                    <div className="p-1 text-gray-400 shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {/* Cuerpo Desplegado */}
                  {isExpanded && (
                    <div className="p-4 pt-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30 space-y-4">
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                          Pasos a Seguir:
                        </h3>

                        <div className="space-y-2.5">
                          {guide.steps.map((step, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xs space-y-1"
                            >
                              <div className="flex items-center gap-2 font-semibold text-xs text-gray-900 dark:text-gray-100">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span>{step.title}</span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-300 pl-7 leading-relaxed">
                                {step.description}
                              </p>
                              {step.tip && (
                                <div className="ml-7 mt-1.5 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span>{step.tip}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {guide.rules && guide.rules.length > 0 && (
                        <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                          <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 block">
                            Reglas de Control Interno Asociadas:
                          </span>
                          <ul className="list-disc list-inside text-[11px] text-neutral-600 dark:text-neutral-400 space-y-0.5">
                            {guide.rules.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTENIDO DE TAB 2: GLOSARIO DE BANDERAS EN INGLÉS */}
      {activeTab === 'badges' && (
        <div className="space-y-3">
          <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">¿Por qué algunas banderas o estados se muestran en inglés?</p>
              <p className="text-[11px] text-sky-800 dark:text-sky-300 mt-0.5">
                Para garantizar interoperabilidad con estándares contables internacionales (ERP REST APIs y formatos electrónicos), ciertos estados base utilizan nomenclaturas universales. A continuación se detalla su significado exacto en español y su impacto en cada pantalla:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredBadges.map((badge, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-md border border-neutral-200 dark:border-neutral-700">
                      {badge.term}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      {badge.spanish}
                    </span>
                  </div>
                  <Badge variant={badge.badgeVariant}>{badge.term}</Badge>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {badge.meaning}
                </p>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 flex items-center justify-between">
                  <span>Módulo / Ámbito: {badge.category}</span>
                  <span className="italic">Uso: {badge.usageContext}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENIDO DE TAB 3: REGLAS DE NEGOCIO Y CONFIGURACIÓN */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-300">
            Guía detallada de los parámetros configurables en <strong>Configuración &gt; Reglas de Negocio</strong> y su sustento normativo legal en Venezuela (SENIAT / BCV).
          </div>

          <div className="space-y-3">
            {filteredRules.map((rule, idx) => (
              <div
                key={idx}
                className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-2xs space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <span>{rule.name}</span>
                  </h3>
                  <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
                    {rule.legalContext}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 block text-[11px]">
                      ¿Para qué sirve?
                    </span>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-[11px]">
                      {rule.description}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 block text-[11px]">
                      ¿Cómo configurarlo?
                    </span>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-[11px]">
                      {rule.configurationGuide}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 block text-[11px]">
                      Impacto y Auditoría
                    </span>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-[11px]">
                      {rule.auditImpact}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENIDO DE TAB 4: MANUAL DEL MÓDULO CONTABLE VEN-NIF */}
      {activeTab === 'accounting' && (
        <div className="space-y-6">
          {/* Banner de Introducción Normativa */}
          <div className="p-5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#007BFF] dark:text-[#3D91FF]" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Arquitectura y Funcionamiento del Módulo Contable VEN-NIF (NIIF para PYMES)
              </h2>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              El módulo contable de ERO ERP está homologado bajo el marco legal venezolano (Código de Comercio Art. 32-38) y las Normas de Información Financiera de Venezuela (VEN-NIF emitidas por la FCCPV). Proporciona doble moneda funcional simultánea (VES y USD), partida doble estricta, inmutabilidad legal de comprobantes asentados, motor de contabilización automática en tiempo real, ajuste por inflación integral (VEN-NIF B-10 con INPC del BCV) y regularización de fluctuación cambiaria.
            </p>
          </div>

          {/* Componentes Principales del Sistema Contable */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* 1. Catálogo de Cuentas */}
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-[#007BFF] dark:text-[#3D91FF]">
                <BookOpen className="w-4 h-4" />
                <h3>1. Plan de Cuentas (VEN-NIF)</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                Estructura jerárquica en 4 niveles (Clase, Grupo, Subcuenta y Cuenta Detalle). Solo el Nivel 4 acepta movimientos. Separa partidas Monetarias (generadoras de REI) de No Monetarias (reexpresables por inflación).
              </p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 font-mono">
                Ruta: Contabilidad &gt; Plan de Cuentas (VEN-NIF)
              </div>
            </div>

            {/* 2. Libro Diario */}
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-[#17A2B8] dark:text-[#20C997]">
                <FileText className="w-4 h-4" />
                <h3>2. Libro Diario Legal</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                Registro cronológico con partida doble estricta (Débito = Crédito). Estados DRAFT (borrador editable) y POSTED (asentado legal inmutable). Anulación auditada sin saltos de correlativo. Multimoneda VES y USD con tasa BCV.
              </p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 font-mono">
                Ruta: Contabilidad &gt; Libro Diario Legal
              </div>
            </div>

            {/* 3. Contabilización Automática */}
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-[#28A745] dark:text-[#4ADE80]">
                <Sparkles className="w-4 h-4" />
                <h3>3. Contabilización Automática</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                Genera asientos inmediatos ante ventas en caja POS, compras, pagos CxC/CxP, notas SENIAT y ajustes de almacén. Incluye matriz de 21 mapeos predeterminados y procesamiento por lotes para documentos rezagados.
              </p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 font-mono">
                Ruta: Contabilidad &gt; Contabilización Automática
              </div>
            </div>

            {/* 4. Libro Mayor */}
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                <FileSpreadsheet className="w-4 h-4" />
                <h3>4. Libro Mayor Analítico</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                Centraliza las transacciones cuenta por cuenta. Detalla el saldo inicial arrastrado, movimientos individuales con referencia al documento soporte y el saldo progresivo acumulado. Exportación en PDF oficial.
              </p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 font-mono">
                Ruta: Contabilidad &gt; Libro Mayor Analítico
              </div>
            </div>

            {/* 5. Balance de Comprobación */}
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-4 h-4" />
                <h3>5. Balance de Comprobación</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                Comprueba el balance general de sumas y saldos para verificar la ecuación patrimonial. Permite agrupar por niveles jerárquicos (1 al 4) y filtrar cuentas con saldo cero para resúmenes ejecutivos.
              </p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 font-mono">
                Ruta: Contabilidad &gt; Balance de Comprobación
              </div>
            </div>

            {/* 6. Estados Financieros */}
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-purple-600 dark:text-purple-400">
                <Printer className="w-4 h-4" />
                <h3>6. Estados Financieros NIIF</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                Genera el Estado de Situación Financiera y el Estado de Resultados Integrales con clasificación corriente y no corriente. Permite alternar a valores reexpresados por inflación con membrete y pie de firma para Contador Colegiado.
              </p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 font-mono">
                Ruta: Contabilidad &gt; Estados Financieros NIIF
              </div>
            </div>

            {/* 7. Cierre & Auditoría Fiscal */}
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2 shadow-2xs md:col-span-2 lg:col-span-3">
              <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                <Clock className="w-4 h-4" />
                <h3>7. Cierres & Ajuste Inflación</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                Administra los 12 meses del ejercicio con estados OPEN (abierto), CLOSED (cerrado) y LOCKED (bloqueado anti-extemporaneidad). Permite registrar en vivo los índices oficiales INPC publicados mensualmente por el BCV, calcular la reexpresión y el REI (VEN-NIF B-10) con selección dinámica de períodos, y revaluar cuentas en moneda extranjera a la tasa oficial de corte del BCV.
              </p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 font-mono">
                Ruta: Contabilidad &gt; Cierres & Ajuste Inflación
              </div>
            </div>
          </div>

          {/* Tabla de Mapeos Predeterminados por Operación */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 space-y-3 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                Matriz de Mapeo Predeterminado (Motor de Contabilización Automática)
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Correspondencia preconfigurada entre eventos comerciales y cuentas auxiliares VEN-NIF
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#F4F6F9] dark:bg-[#18191A] font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="py-2 px-3">Clave de Mapeo</th>
                    <th className="py-2 px-3">Cuenta VEN-NIF</th>
                    <th className="py-2 px-3">Nombre de la Cuenta</th>
                    <th className="py-2 px-3">Circuito Comercial Asociado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-mono text-[11px]">
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">SALES_REVENUE</td>
                    <td className="py-1.5 px-3">4.1.01</td>
                    <td className="py-1.5 px-3 font-sans">Ventas de Mercancías Gravadas con IVA</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Facturación POS alicuota general</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">SALES_REVENUE_EXEMPT</td>
                    <td className="py-1.5 px-3">4.1.02</td>
                    <td className="py-1.5 px-3 font-sans">Ventas de Mercancías Exentas / Exoneradas</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Alimentos y productos exentos de IVA</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">VAT_DEBIT</td>
                    <td className="py-1.5 px-3">2.1.02.01</td>
                    <td className="py-1.5 px-3 font-sans">IVA Débito Fiscal</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Impuesto 16% generado en ventas</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">VAT_CREDIT</td>
                    <td className="py-1.5 px-3">1.1.03.01</td>
                    <td className="py-1.5 px-3 font-sans">IVA Crédito Fiscal</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Impuesto soportado en compras a proveedores</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">IGTF_PAYABLE</td>
                    <td className="py-1.5 px-3">2.1.02.05</td>
                    <td className="py-1.5 px-3 font-sans">IGTF por Enterar al SENIAT</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Alícuota 3% percibida en cobros divisas efectivo</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">AR_CUSTOMERS_VES</td>
                    <td className="py-1.5 px-3">1.1.02.01</td>
                    <td className="py-1.5 px-3 font-sans">Clientes Nacionales Comerciales</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Facturas comerciales emitidas a crédito en Bolívares</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">AP_SUPPLIERS_VES</td>
                    <td className="py-1.5 px-3">2.1.01.01</td>
                    <td className="py-1.5 px-3 font-sans">Proveedores Nacionales</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Facturas de compra recibidas a crédito en Bolívares</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">INVENTORY</td>
                    <td className="py-1.5 px-3">1.1.04.01</td>
                    <td className="py-1.5 px-3 font-sans">Inventario de Mercancías para la Venta</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Control físico valorado de existencias</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">COST_OF_SALES</td>
                    <td className="py-1.5 px-3">5.1.01</td>
                    <td className="py-1.5 px-3 font-sans">Costo de Mercancía Vendida</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Descargo de inventario a costo promedio</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">EXCHANGE_DIFF_GAIN</td>
                    <td className="py-1.5 px-3">7.2.01</td>
                    <td className="py-1.5 px-3 font-sans">Ganancia en Fluctuación Cambiaria</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Revaluación positiva por variación de tasa BCV</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">EXCHANGE_DIFF_LOSS</td>
                    <td className="py-1.5 px-3">7.1.02</td>
                    <td className="py-1.5 px-3 font-sans">Pérdida en Fluctuación Cambiaria</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Revaluación negativa en pasivos o cuentas en divisas</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-bold text-[#007BFF]">REI_RESULT</td>
                    <td className="py-1.5 px-3">7.3.01</td>
                    <td className="py-1.5 px-3 font-sans">Resultado Monetario del Ejercicio (REI Neto)</td>
                    <td className="py-1.5 px-3 font-sans text-gray-500">Ajuste integral por inflación VEN-NIF B-10</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
