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
    category: 'Ventas y POS',
    title: 'Apertura, Operación y Cierre de Caja con Arqueo Ciego',
    summary: 'Procedimiento obligatorio para iniciar turno, registrar cobros, declarar efectivo y conciliar diferencias.',
    steps: [
      {
        title: '1. Selección de Sucursal y Caja Asignada',
        description: 'Al iniciar sesión, verifique en la barra superior la Sucursal y Caja activa. Si ya tiene una caja asignada o un turno en curso, el sistema bloqueará la selección de otra caja para evitar inconsistencias contables.',
      },
      {
        title: '2. Apertura de Turno con Fondo Inicial',
        description: 'Ingrese a "Ventas > Cierre de Caja & Arqueo". Haga clic en "Abrir Turno de Caja", ingrese el fondo de cambio en Divisas ($) y Bolívares (Bs), e indique observaciones si las hay.',
      },
      {
        title: '3. Operación de Facturación en Punto de Venta (POS)',
        description: 'Diríjase a "Punto de Venta (POS)". Busque productos por código de barras, nombre o departamento asignado a la caja. Agregue ítems, seleccione el cliente y procese las formas de pago combinadas.',
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
    category: 'Ventas y POS',
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
    category: 'Restaurante y Comandas',
    title: 'Toma de Pedidos en Mesas y Pantalla de Cocina (KDS)',
    summary: 'Gestión integral de salones, apertura de cuentas, envío a comanderas y cobro dividido (Split Bill).',
    steps: [
      {
        title: '1. Apertura de Mesa o Barra',
        description: 'En "Restaurante > Toma de Pedidos", seleccione el salón y haga clic en la mesa disponible. Indique el número de comensales y el mesero responsable.',
      },
      {
        title: '2. Adición de Platos y Observaciones',
        description: 'Agregue las bebidas, entradas y platos fuertes. Puede especificar notas de preparación para cocina (ej: "término medio", "sin cebolla", "salsa aparte").',
      },
      {
        title: '3. Envío a Cocina & Barra (KDS)',
        description: 'Presione "Enviar a Cocina". Los ítems se despachan instantáneamente al monitor KDS de Cocina o Barra, cambiando de estado a PENDING y luego a COOKING.',
      },
      {
        title: '4. Pre-cuenta y División de Cuenta (Split Bill)',
        description: 'Cuando los clientes solicitan la cuenta, genere la pre-cuenta. Si desean pagar por separado, use la herramienta "Dividir Cuenta" para emitir facturas independientes por comensal.',
      },
    ],
  },
  {
    id: 'inventory-kardex',
    category: 'Inventario y Almacenes',
    title: 'Kardex Multimoneda y Jerarquía de Clasificación de Productos',
    summary: 'Consulta de movimientos, valoración a costo promedio y existencias por Departamento, Grupo y Subgrupo.',
    steps: [
      {
        title: '1. Organización por Departamentos, Grupos y Subgrupos',
        description: 'En "Inventario > Clasificación de Productos", estructure sus líneas de negocio en 3 niveles jerárquicos (ej: Alimentos > Lácteos > Quesos). Esto organiza el catálogo y las cajas POS.',
      },
      {
        title: '2. Consulta de Existencias en Kardex',
        description: 'En "Inventario > Catálogo & Kardex", puede alternar entre dos modelos: Modelo 1 (solo unidades físicas sin costos) y Modelo 2 (Kardex Monetizado con costo promedio, PVP y selección de moneda USD o VES).',
      },
      {
        title: '3. Filtro Multidimensional',
        description: 'Utilice el modal de búsqueda rápida para filtrar por departamento, grupo y subgrupo en cualquier módulo del sistema.',
      },
    ],
  },
  {
    id: 'inventory-adjustments',
    category: 'Inventario y Almacenes',
    title: 'Ajustes de Inventario por Entrada, Salida o Mermas',
    summary: 'Registro justificado de aumentos o disminuciones físicas de stock no derivadas de ventas ni compras.',
    steps: [
      {
        title: '1. Crear Ajuste de Inventario',
        description: 'Ingrese a "Inventario > Ajustes de Inventario" y presione "Nuevo Ajuste". Seleccione el almacén donde se encuentra la mercancía.',
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
    category: 'Ventas y Facturación',
    title: 'Emisión de Notas de Crédito, Débito y Devoluciones Comerciales',
    summary: 'Cómo anular o corregir facturas emitidas y reingresar mercancía al almacén correspondiente.',
    steps: [
      {
        title: '1. Ubicar la Factura Original',
        description: 'En "Ventas > Notas de Crédito & Débito", seleccione la factura afectada para vincular legalmente el número de control fiscal SENIAT.',
      },
      {
        title: '2. Definir si es Devolución Total o Parcial',
        description: 'Seleccione los productos que reingresan al inventario o el monto de ajuste de precio si se trata de un descuento posterior.',
      },
      {
        title: '3. Emisión Fiscal',
        description: 'El sistema emite la Nota de Crédito fiscal, revierte el saldo de la Cuenta por Cobrar (o genera saldo a favor del cliente) y devuelve el stock al almacén.',
      },
    ],
  },
  {
    id: 'treasury-reconciliation',
    category: 'Tesorería y Bancos',
    title: 'Conciliación Bancaria y Registro de Depósitos de Arqueos',
    summary: 'Cotejo de extractos bancarios en Bs y Divisas contra los cobros y transferencias del sistema.',
    steps: [
      {
        title: '1. Depósito de Arqueos de Caja',
        description: 'En "Ventas > Verificación de Arqueos", el supervisor audita el turno cerrado y asigna los lotes de efectivo a las cuentas bancarias destino en Tesorería.',
      },
      {
        title: '2. Importación o Registro de Movimientos de Cuenta',
        description: 'En "Tesorería > Posición Bancaria", consulte el libro auxiliar de banco cronológico con cargos, abonos y comisiones bancarias.',
      },
      {
        title: '3. Acta Formal de Conciliación',
        description: 'En "Tesorería > Conciliación Bancaria", concilie las partidas en tránsito contra el saldo del extracto oficial y genere el dictamen legal.',
      },
    ],
  },
  {
    id: 'security-chat-audit',
    category: 'Comunicaciones y Seguridad',
    title: 'Uso del Chat Interno entre Colaboradores y Bitácora de Auditoría',
    summary: 'Mensajería institucional instantánea y supervisión de comunicaciones para control de calidad.',
    steps: [
      {
        title: '1. Acceso al Chat en Barra Superior',
        description: 'Haga clic en el ícono de mensaje en la barra superior. Verá sus conversaciones activas y el contador de mensajes no leídos.',
      },
      {
        title: '2. Iniciar Chat y Enviar Emoticones',
        description: 'Presione "Nuevo Chat" para buscar cualquier usuario de la empresa por nombre o cargo. Escriba mensajes e inserte emoticones desde el selector interactivo.',
      },
      {
        title: '3. Bitácora de Supervisión (chat.audit)',
        description: 'Los usuarios con rol administrativo o permiso de auditoría pueden acceder a "Configuración > Bitácora de Chat" para consultar el historial de conversaciones, filtrar por colaboradores y descargar reportes de auditoría en texto.',
      },
    ],
  },
  {
    id: 'roles-permissions-import',
    category: 'Configuración y Usuarios',
    title: 'Creación de Roles, Permisos Granulares e Importación entre Roles',
    summary: 'Diseño de perfiles de usuario y clonación de matrices de permisos para agilizar la configuración.',
    steps: [
      {
        title: '1. Acceder a Usuarios y Roles',
        description: 'En "Configuración > Usuarios & Permisos", cambie a la pestaña "Roles y Permisos del Sistema".',
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
    meaning: 'El asiento contable fue revisado y asentado definitivamente en los Libros Legales (Diario y Mayor). Ya no es editable ni eliminable.',
    usageContext: 'Módulo de Contabilidad, Libro Diario y Balances.',
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
    configurationGuide: 'En "Configuración > Monedas & Tasa BCV", puede forzar la sincronización en vivo o ingresar una tasa manual justificada si el servicio del BCV experimenta intermitencia.',
    auditImpact: 'Queda trazado en la bitácora quién, cuándo y con qué tasa se registró cada documento fiscal.',
  },
  {
    name: 'IGTF en Divisas y Efectivo Moneda Extranjera (3%)',
    legalContext: 'Ley de Impuesto a las Grandes Transacciones Financieras (SENIAT)',
    description: 'Aplica una alícuota del 3% sobre cualquier cobro o pago recibido en divisas en efectivo, Zelle u otros medios no bancarizados en territorio nacional.',
    configurationGuide: 'En "Configuración > Reglas de Negocio", active o desactive la casilla "Habilitar IGTF (3%)". Cada método de pago tiene el flag "Aplica IGTF".',
    auditImpact: 'Se desglosa en el comprobante fiscal y en el Libro de Ventas para la declaración quincenal del SENIAT.',
  },
  {
    name: 'Control de Venta con Stock Negativo',
    legalContext: 'Control Interno de Existencias y Prevención de Descuadres',
    description: 'Determina si el Punto de Venta permite vender productos cuya existencia física en el almacén seleccionado sea cero o menor.',
    configurationGuide: 'En "Configuración > Reglas de Negocio", seleccione: "Bloquear venta" (recomendado para control estricto) o "Requerir autorización de supervisor".',
    auditImpact: 'Evita descuadres contables y errores en el cálculo del costo promedio ponderado de inventario.',
  },
  {
    name: 'Arqueo Ciego Obligatorio en Cierre de Turno',
    legalContext: 'Auditoría Financiera y Prevención de Fraudes en Caja',
    description: 'Obliga a que el cajero ingrese el dinero contado en gaveta sin conocer de antemano el saldo que el sistema calculó por ventas.',
    configurationGuide: 'En "Configuración > Reglas de Negocio", active "Exigir Arqueo Ciego". El dictamen de faltantes o sobrantes se calcula automáticamente al confirmar.',
    auditImpact: 'Garantiza la imparcialidad del cajero y documenta cualquier diferencia para la verificación de arqueos de supervisión.',
  },
  {
    name: 'Almacén Fijo por Sede para Colaboradores',
    legalContext: 'Seguridad Operativa y Segregación de Funciones',
    description: 'Impide que los usuarios operativos cambien arbitrariamente el almacén donde descargan mercancía o facturan.',
    configurationGuide: 'En "Configuración > Usuarios & Permisos", al editar un usuario, active "Establecer almacén fijo por sucursal" y elija el depósito autorizado.',
    auditImpact: 'Garantiza que cada operador solo afecte el inventario físico que tiene bajo su custodia y responsabilidad.',
  },
  {
    name: 'Departamentos Visibles por Caja Registradora',
    legalContext: 'Especialización de Puntos de Venta (Hipermercados, Farmacias, Restaurantes)',
    description: 'Permite que una caja (ej: Caja de Charcutería, Caja de Licores o Caja de Barra) solo muestre los productos de departamentos específicos.',
    configurationGuide: 'En "Configuración > Cajas / POS", edite la caja y en "Departamentos Visibles en esta Caja" marque los departamentos autorizados. Si no marca ninguno, mostrará todo el catálogo.',
    auditImpact: 'Agiliza la facturación en pantalla táctil y previene errores de despacho en cajas departamentales.',
  },
];

export const HelpCenterView: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<'guides' | 'badges' | 'rules' | 'faq'>('guides');
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
    </div>
  );
};
