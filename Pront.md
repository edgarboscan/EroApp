ROL Y CONTEXTO
Actúa como Arquitecto de Software Senior + Ingeniero Full-Stack Principal con más de 15 años de experiencia diseñando ERPs empresariales para el mercado venezolano (SENIAT, providencias, facturación fiscal, libros, retenciones ISLR/IVA, ARCV).

Debes entregar un plan de implementación completo, código funcional y arquitectura lista para producción, cubriendo los módulos base más los nuevos requerimientos solicitados (dashboards dinámicos por módulo, cambio masivo de precios con reglas tributarias, jerarquía Departamento → Grupo → Subgrupo en inventario, y ubicación física opcional pasillo/estante/compartimiento).

No des respuestas genéricas: entrega estructura de carpetas, DDL MySQL real, endpoints Hono definidos, componentes React/Tailwind funcionales y lógica de negocio aplicada.

🎯 OBJETIVO DEL PROYECTO
Construir una aplicación web tipo ERP para control administrativo, comercial, fiscal y financiero de una empresa con múltiples sucursales y depósitos, con arquitectura moderna, reactiva, auditable, adaptable a reglas de negocio configurables, dashboards personalizados según permisos del usuario, gestión avanzada de precios e impuestos, y jerarquía de clasificación de productos en inventario.

🧱 STACK TECNOLÓGICO OBLIGATORIO
Frontend
React 18 + Vite + TypeScript

Tailwind CSS v3 (moderno, minimalista, dark/light mode)

shadcn/ui + Radix UI

TanStack Query (estado servidor)

Zustand (estado global ligero)

React Router v6 (rutas protegidas por permisos)

React Hook Form + Zod

Recharts o ApexCharts

jsPDF + jspdf-autotable, xlsx (SheetJS), PapaParse

dnd-kit (drag & drop para dashboards y jerarquías)

i18n español Venezuela

Backend
Node.js 20 LTS + Hono.js

TypeScript estricto

Zod + @hono/zod-validator

Drizzle ORM (type-safe)

MySQL 8 con índices compuestos, FULLTEXT, triggers, stored procedures, vistas, CTEs, window functions y columnas JSON

JWT + Refresh Tokens (RS256)

Bcrypt / Argon2

RBAC + ABAC

BullMQ + Redis

Pino logs

Contratos compartidos vía packages/shared

Infraestructura
pnpm workspaces (apps/api, apps/web, packages/shared)

Docker + docker-compose

Nginx reverse proxy

PM2 o Docker Swarm

.env validado con Zod

🏛️ ARQUITECTURA
text
erp-ve/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/ users/ branches/ warehouses/
│   │   │   │   ├── products/ inventory/ pricing/ tax-rates/
│   │   │   │   ├── purchases/ suppliers/ customers/
│   │   │   │   ├── sales/ pos/ receivables/ payables/
│   │   │   │   ├── treasury/ taxes/ reports/
│   │   │   │   ├── config/ audit/ licenses/
│   │   │   │   └── dashboards/         # ← NUEVO
│   │   │   ├── middleware/             # auth, rbac, audit, tenant, license, dashboard-scope
│   │   │   ├── db/                     # schema, migrations, seeds, triggers, procedures
│   │   │   ├── jobs/                   # BullMQ workers
│   │   │   ├── lib/                    # pdf, excel, csv, fiscal VE, pricing-engine
│   │   │   └── index.ts
│   │   └── drizzle/
│   └── web/
│       ├── src/
│       │   ├── features/               # espejo de modules
│       │   ├── components/ui/          # shadcn
│       │   ├── layouts/
│       │   ├── routes/
│       │   ├── hooks/
│       │   ├── stores/
│       │   ├── services/
│       │   └── lib/
└── packages/
    └── shared/                         # tipos Zod, constantes, utils
🔐 SEGURIDAD, AUTENTICACIÓN Y AUDITORÍA
Login con email/username + password + 2FA TOTP opcional.

JWT RS256, refresh rotativo, blacklist Redis.

RBAC granular: roles + permisos por módulo → acción (sales.create, inventory.adjust, pricing.bulk_update, reports.export_pdf, etc.).

ABAC: user_branches, user_warehouses, user_departments, user_module_permissions.

Middleware Hono authorize(module, action) en cada endpoint.

Row-level filtering por sucursal activa.

Bitácora audit_log:

id, user_id, branch_id, module, action, entity, entity_id, before_json, after_json, ip, user_agent, timestamp

Triggers MySQL + middleware Hono.

Visor filtrable, retención configurable (mínimo 5 años).

🏢 MULTI-SUCURSAL Y MULTI-DEPÓSITO
branches con configuración propia.

warehouses por sucursal.

Configuración jerárquica: Global → Empresa → Sucursal → Depósito.

settings clave-valor JSON con scope.

business_rules configurables (allow_credit_sales, require_approval_discount, pos_invoice_mode, tax_affects_final_price, etc.).

Selector sucursal/depósito activo en header.

📊 DASHBOARDS DINÁMICOS POR MÓDULO Y PERMISO (NUEVO)
Reglas
Cada usuario ve uno o varios dashboards según los módulos y permisos que tenga.

El sistema arma la vista combinando widgets visibles para el usuario.

Un usuario con acceso a sales, inventory y treasury verá un dashboard con widgets de esos 3 módulos; un cajero solo verá widgets de POS.

Componentes backend
Tabla dashboard_widgets: catálogo de widgets disponibles.

id, code, module, title, type (kpi|chart|table|list|gauge), config_json, default_size, required_permission

Tabla dashboards: dashboard por defecto por rol y/o personalizados.

id, name, scope (global|role|user), role_id, user_id, is_default

Tabla dashboard_layout: relación dashboard → widget → posición/tamaño/orden.

Endpoint GET /api/dashboards/me retorna widgets filtrados por permisos + layout guardado.

Endpoint PUT /api/dashboards/me/layout guarda personalización.

Componentes frontend
Grid responsive drag & drop con react-grid-layout o dnd-kit.

Cada widget carga su data desde su propio endpoint (/api/widgets/:code/data).

Modo edición (agregar/quitar widgets según permisos disponibles).

Fallback: si el usuario no tiene dashboards personalizados, se genera uno automático con widgets "default" de los módulos a los que tiene acceso.

Widgets mínimos a implementar
Dashboard General: ventas del día, ticket promedio, top productos, morosidad, disponibilidad bancaria.

POS: ventas por cajero, formas de pago, cierres pendientes.

Inventario: stock crítico, productos sin movimiento, traslados en tránsito.

CxC: aging, top deudores, cobros del día.

CxP: aging, pagos programados, top acreedores.

Tesorería: saldos por banco, flujo proyectado, conciliaciones pendientes.

Tributos: IVA por pagar, retenciones del mes, estado de libros.

💲 GESTIÓN AVANZADA DE PRECIOS E IMPUESTOS (NUEVO)
Cambio masivo de precios
Permitir actualizar precios de forma masiva, con los siguientes criterios de selección combinables:

Por tipo de producto (físico, servicio, kit, materia prima)

Por proveedor (uno o varios)

Por departamento

Por grupo

Por subgrupo

Por marca / categoría (si aplica)

Por rango de precios actuales

Por sucursal / depósito

Por lista de precios

Modos de actualización
Porcentaje (+/- %)

Monto fijo (+/- Bs)

Nuevo precio absoluto

Redondeo (a 0.05, 0.10, 0.50, 1.00)

Fórmula basada en costo (costo + margen %)

Reemplazo por lista de precios

Reglas de impuestos (IVA / IGTF / otros)
Al modificar una tasa de impuesto (o un precio), debe poder definirse:

tax_affects_final_price (bool): si el cambio de la tasa modifica el precio final al público o se absorbe en el margen.

price_mode:

tax_inclusive: el precio mostrado ya incluye impuesto → cambiar tasa recalcula base.

tax_exclusive: el precio mostrado es base → cambiar tasa recalcula total.

apply_scope: product | department | group | subgroup | supplier | branch | global

effective_date y scheduled (programar el cambio a futuro)

require_approval (si la regla de negocio lo exige)

notify_customers (opcional)

Tablas necesarias
price_lists (listas de precios por sucursal/cliente)

product_prices (product_id, price_list_id, price, currency, valid_from, valid_to)

tax_rates (code, name, rate, type: IVA|IGTF|ISLR|otro, is_active, valid_from, valid_to)

product_taxes (product_id, tax_rate_id, is_default)

tax_rate_changes (auditoría de cambios de tasa con affects_final_price, effective_date, applied_by)

price_change_batches (lote de cambio masivo: criterios JSON, estado, aprobador, fecha)

price_change_items (detalle por producto: precio antes/después)

price_history (histórico por producto para auditoría)

Stored Procedures clave
sp_bulk_price_update(criteria_json, mode, value, options_json)

sp_change_tax_rate(tax_rate_id, new_rate, affects_final_price, effective_date)

sp_recalculate_prices_by_tax(tax_rate_id, scope, ref_id)

sp_apply_price_list(product_ids, price_list_id)

Frontend
Wizard en /pricing/bulk-update:

Selección de criterios (multi-step, con preview en vivo del universo de productos afectados).
Tipo de cambio (%, monto, absoluto, redondeo, fórmula).
Reglas de impuesto y precio final (toggle "¿Afecta el precio final?").
Fecha efectiva (inmediata o programada).
Aprobación (si aplica) + confirmación.
Ejecución + reporte de resultado descargable (PDF/Excel/CSV).
Pantalla /pricing/tax-rates para administrar tasas y programar cambios.

Audit trail por producto en /inventory/products/:id/price-history.

📦 INVENTARIO CON JERARQUÍA Y UBICACIÓN FÍSICA (NUEVO)
Jerarquía de clasificación
Tabla product_hierarchy (o tablas separadas departments, groups, subgroups):

Departamento → Grupo → Subgrupo → Producto

Un departamento tiene N grupos, un grupo N subgrupos, un subgrupo N productos.

Cada nivel tiene: code, name, description, is_active, parent_id (opcional), branch_scope (opcional).

Tablas:

text
departments (id, company_id, code, name, is_active)
groups      (id, department_id, code, name, is_active)
subgroups   (id, group_id, code, name, is_active)
products    (id, subgroup_id NULL, ..., department_id, group_id, subgroup_id)
Endpoints:

text
GET/POST/PUT/DELETE /api/inventory/departments
GET/POST/PUT/DELETE /api/inventory/groups?department_id=
GET/POST/PUT/DELETE /api/inventory/subgroups?group_id=
Ubicación física opcional del producto
No obligatoria.

Campos opcionales en product_locations:

product_id, warehouse_id, aisle (pasillo), shelf (estante), compartment (compartimiento), notes

Un producto puede tener múltiples ubicaciones (mismo producto en varios depósitos).

Validación: si el usuario decide registrar ubicación, los 3 campos se recomiendan completos (configurable).

Reportes:

"Mapa de ubicaciones" por depósito

"Productos sin ubicación asignada"

"Búsqueda por pasillo/estante/compartimiento"

Frontend: campo colapsable "Ubicación física (opcional)" en el formulario de producto; autocompletado con valores ya existentes por depósito.

Jerarquía en reportes y filtros
Todos los reportes de inventario, precios y ventas deben permitir filtrar por Departamento / Grupo / Subgrupo y agrupar resultados por esos niveles (drill-down).

⚙️ MÓDULOS DEL SISTEMA
1. 🛒 Punto de Venta (POS Caja + POS Administrativo)
Touch-friendly + modo administrativo.

IVA 16%, 8%, exento, exonerado; IGTF 3% en divisas.

Créditos con validación de credit_enabled + credit_limit.

Modos de facturación configurables: fiscal_printer, fiscal_email, normal_printer, normal_email.

Cierre de caja, arqueo, devoluciones, notas de crédito.

Múltiples formas de pago (incluye Pago Móvil, Zelle, cripto).

2. 📦 Inventario
CRUD productos con jerarquía Departamento/Grupo/Subgrupo.

Ubicación física opcional (pasillo/estante/compartimiento).

Kardex, ajustes, traslados entre depósitos y sucursales, recepción de mercancía, importación de traslados.

Alertas de stock mínimo/máximo, lotes/seriales, vencimientos.

Costeo Promedio Ponderado o FIFO.

Cambio masivo de precios (ver sección de precios).

3. 🧾 Proveedores y CxP
CRUD proveedores, facturas de compra → CxP.

Notas de crédito/débito.

Pagos → órdenes de pago visibles en tesorería.

Estado de cuenta y aging 30/60/90/120+.

4. 👥 Clientes y CxC
CRUD clientes con credit_enabled, credit_limit, payment_terms.

Facturación a crédito → CxC.

Notas de crédito/débito.

Cobros → órdenes de cobro visibles en tesorería.

Estado de cuenta y aging.

5. 💰 Tesorería
Bancos → múltiples cuentas bancarias.

Movimientos, transferencias entre cuentas/bancos.

Pagos a proveedores y cobros a clientes.

Conciliación bancaria con importación CSV/Excel.

Reportes: flujo de caja, disponibilidad, libro de banco, cheques emitidos.

6. 🧮 Tributos (Venezuela)
Agente de retención ISLR/IVA.

Retenciones por concepto, sustraendo, % persona natural/jurídica/domiciliado.

Comprobantes PDF formato SENIAT.

Libros de Compras y Ventas (XML/Excel/PDF).

Reporte ARCV XML.

Exportación SENIAT (txt/xml).

Integración con tasas de impuesto y reglas de afectación al precio final.

7. 📊 Dashboards (NUEVO)
Ver sección dedicada.

8. 💲 Pricing & Tax Rules (NUEVO)
Ver sección dedicada.

9. 📈 Módulos adicionales recomendados
Contabilidad General (asientos automáticos, balance, estado de resultados).

Compras (órdenes, recepciones, facturas).

Ventas (cotizaciones, pedidos, notas de entrega).

RRHH básico (opcional).

BI / KPIs.

Gestión de Licencias.

Notificaciones (correo, in-app).

Backups automáticos.

📊 SISTEMA DE REPORTES
Todos los módulos con:

Vista resumida y detallada.

Filtros por sucursal, depósito, departamento/grupo/subgrupo, fechas, usuario, cliente/proveedor, producto, estado.

Exportación PDF/Excel/CSV.

CSV personalizado (constructor visual, plantillas guardables).

Programación vía BullMQ.

Branding (logo empresa, sucursal, fecha/hora).

Ejemplos nuevos:

Reporte de cambios de precio (por lote, rango, usuario).

Reporte de cambios de tasa de impuesto y su impacto en precios finales.

Reporte de productos por departamento/grupo/subgrupo.

Reporte de ubicaciones físicas (pasillo/estante/compartimiento).

Reporte de productos sin clasificar o sin ubicación.

🎨 UI/UX (Tailwind)
Moderno minimalista, Inter, espaciado amplio.

Sidebar colapsable + topbar con selector sucursal/depósito, notificaciones, usuario.

Dark/light mode.

shadcn/ui: DataTable server-side, filtros, columnas configurables, exportación.

Toasts (sonner), modales accesibles, skeletons, empty states.

Responsive mobile-first para POS.

Atajos de teclado en POS.

Dashboard drag & drop con modo edición.

Wizard multi-step para cambio masivo de precios.

🛣️ SISTEMA DE RUTAS
text
/login
/2fa
/select-branch
/dashboard                          # dinámico por permisos
/dashboard/editor                   # personalizar widgets
/pos/caja
/pos/administrativo
/inventory/products
/inventory/products/:id/price-history
/inventory/departments
/inventory/groups
/inventory/subgroups
/inventory/locations
/inventory/kardex
/inventory/adjustments
/inventory/transfers
/inventory/receptions
/pricing/bulk-update                # NUEVO
/pricing/tax-rates                  # NUEVO
/pricing/price-lists                # NUEVO
/purchases/orders
/purchases/invoices
/suppliers
/suppliers/:id/statement
/receivables
/receivables/collections
/payables
/payables/payments
/customers
/customers/:id/statement
/treasury/banks
/treasury/banks/:id/accounts
/treasury/movements
/treasury/reconciliation
/taxes/withholdings
/taxes/books/purchases
/taxes/books/sales
/taxes/arcv
/reports/:module
/config/company
/config/branches
/config/warehouses
/config/business-rules
/config/users
/config/roles
/config/licenses
/audit/logs
Cada ruta protegida por <RequirePermission module="..." action="..."/>.

🗄️ ESQUEMA DE BASE DE DATOS (MySQL 8)
Además de las tablas base ya listadas, agregar obligatoriamente:

text
-- Jerarquía de productos
departments, groups, subgroups
product_locations (product_id, warehouse_id, aisle, shelf, compartment)

-- Precios e impuestos
price_lists, product_prices, tax_rates, product_taxes,
tax_rate_changes, price_change_batches, price_change_items, price_history

-- Dashboards
dashboard_widgets, dashboards, dashboard_layout, user_dashboard_preferences
Requisitos MySQL:

InnoDB, utf8mb4_0900_ai_ci.

FKs con ON DELETE RESTRICT.

Índices compuestos (branch_id, date), (department_id, group_id, subgroup_id), (product_id, warehouse_id).

Triggers en sales, purchases, inventory_movements, bank_movements, product_prices, tax_rates.

Stored Procedures (además de los base):

sp_bulk_price_update(criteria_json, mode, value, options_json)

sp_change_tax_rate(tax_rate_id, new_rate, affects_final_price, effective_date)

sp_recalculate_prices_by_tax(tax_rate_id, scope, ref_id)

sp_build_dashboard(user_id) — arma dashboard dinámico según permisos.

Vistas: v_cxc_aging, v_cxp_aging, v_stock_by_warehouse, v_sales_daily, v_book_purchases, v_book_sales, v_products_by_hierarchy, v_products_without_location, v_price_changes_recent.

🔌 CONTRATOS DE API (Hono) — Endpoints nuevos
text
# Dashboards
GET    /api/dashboards/me
PUT    /api/dashboards/me/layout
GET    /api/dashboards/widgets           # catálogo filtrado por permisos
GET    /api/widgets/:code/data

# Jerarquía de productos
GET    /api/inventory/departments
POST   /api/inventory/departments
GET    /api/inventory/groups?department_id=
POST   /api/inventory/groups
GET    /api/inventory/subgroups?group_id=
POST   /api/inventory/subgroups

# Ubicación física
GET    /api/inventory/products/:id/locations
POST   /api/inventory/products/:id/locations
DELETE /api/inventory/products/:id/locations/:locationId
GET    /api/inventory/locations/search?aisle=&shelf=&compartment=&warehouse_id=

# Precios e impuestos
GET    /api/pricing/price-lists
POST   /api/pricing/bulk-update/preview   # simula y muestra impacto
POST   /api/pricing/bulk-update/execute
GET    /api/pricing/bulk-update/batches
GET    /api/pricing/bulk-update/batches/:id/report?format=pdf|xlsx|csv
GET    /api/pricing/tax-rates
POST   /api/pricing/tax-rates
PUT    /api/pricing/tax-rates/:id
POST   /api/pricing/tax-rates/:id/apply   # afecta/no afecta precio final
GET    /api/inventory/products/:id/price-history
Todos con Zod, authenticate → authorize(module, action) → auditLog, respuesta estándar { success, data, meta?, error? }, paginación/filtros/orden.

🔑 LICENCIAMIENTO
Tabla licenses: key, type (trial|temporal|perpetua), expires_at, hardware_fingerprint, company_id, modules_allowed, max_users, max_branches.

Middleware checkLicense().

Pantalla de activación con fingerprint.

Renovación online opcional.

📦 ENTREGABLES ESPERADOS
Estructura completa del monorepo.

DDL MySQL completo (tablas, índices, triggers, SPs, vistas) incluyendo los nuevos módulos.

Seeds iniciales (empresa demo, sucursales, depósitos, departamentos/grupos/subgrupos, roles, permisos, tasas, usuario admin).

Backend Hono funcional con al menos:

auth (login, refresh, RBAC).

products + inventory (con jerarquía y ubicación).

pricing (cambio masivo + tasas con afectación al precio final).

dashboards (widgets filtrados por permisos).

pos, reports (exportación PDF/Excel/CSV).

Middleware de auditoría.

Frontend React + Tailwind con:

Layout, login, dashboard dinámico drag & drop.

Wizard de cambio masivo de precios.

CRUD de departamentos/grupos/subgrupos.

Al menos POS, Inventario y Reportes navegables.

DataTable reutilizable con exportación.

Docker Compose + Dockerfile.

.env.example.

README + guía de despliegue.

Diagramas Mermaid: ER, flujo POS, flujo CxC/CxP, flujo inventario, flujo tributario, flujo cambio masivo de precios, flujo dashboard dinámico.

Roadmap por fases (MVP → v1 → v2) con estimaciones.

✅ REGLAS DE ENTREGA
Código completo y funcional (no pseudocódigo salvo diagramas).

TypeScript estricto, sin any injustificado.

Comentarios en español donde la lógica fiscal venezolana lo requiera.

Nomenclatura: tablas snake_case plural, endpoints kebab-case, componentes PascalCase.

Idempotencia en endpoints críticos (Idempotency-Key).

Transacciones en operaciones financieras multi-tabla.

Tests unitarios con Vitest (retenciones, aging, aplicación de pagos, motor de precios, recálculo por cambio de tasa).

Sin secretos hardcodeados.

🎬 FORMATO DE RESPUESTA ESPERADO
Resumen ejecutivo de la arquitectura (1 página).

Árbol del monorepo.

DDL MySQL por dominio (triggers, SPs, vistas).

Seeds iniciales.

Backend Hono: index.ts, middleware, y al menos 4 módulos completos (auth, inventory con jerarquía, pricing con cambio masivo, dashboards) con rutas, servicios, validaciones y queries.

Frontend React: main.tsx, router, layout, dashboard dinámico, wizard de precios, CRUD jerarquía + al menos 3 pantallas completas con Tailwind + shadcn.

Docker Compose + Dockerfile.

.env.example.

README + guía de despliegue.

Diagramas Mermaid (ER, POS, CxC/CxP, inventario, tributos, cambio masivo de precios, dashboard dinámico).

Roadmap por fases con estimaciones.

