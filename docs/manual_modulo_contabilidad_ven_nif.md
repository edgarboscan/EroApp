# Manual Integral del Módulo de Contabilidad VEN-NIF / NIIF para PYMES
## ERO ERP - Sistema de Gestión Comercial, Administrativa y Fiscal

---

## 1. Visión General y Marco Normativo Legal

El Módulo de Contabilidad de **ERO ERP** está diseñado específicamente para cumplir con el marco legal y normativo vigente en la República Bolivariana de Venezuela:
- **Código de Comercio de Venezuela (Artículos 32 al 38)**: Obligatoriedad de llevar los Libros Diarios y Mayores empastados o foliados, en idioma castellano y en moneda de curso legal (Bolívares), prohibiendo tachaduras, enmiendas, raspaduras o saltos en la numeración correlativa.
- **Normas VEN-NIF / NIIF para las PYMES**: Aprobadas por la Federación de Colegios de Contadores Públicos de Venezuela (FCCPV), incluyendo los Boletines de Aplicación (BA VEN-NIF).
- **Boletín de Aplicación VEN-NIF N° 2 (BA VEN-NIF 2)**: Marco de adopción de principios de contabilidad generalmente aceptados.
- **Boletín de Aplicación VEN-NIF N° 10 (BA VEN-NIF 10)**: Reconocimiento de los efectos de la inflación en los estados financieros en economías hiperinflacionarias mediante el Índice Nacional de Precios al Consumidor (INPC) publicado por el Banco Central de Venezuela (BCV).
- **Ley de Impuesto a las Grandes Transacciones Financieras (IGTF)** y **Ley del IVA**: Tratamiento de retenciones soportadas y enteradas, débitos y créditos fiscales.

---

## 2. Estructura y Submódulos del Sistema Contable

El módulo se compone de 7 áreas funcionales interconectadas:

```
                                  [ MÓDULO CONTABLE ERO ERP ]
                                               │
       ┌───────────────────┬───────────────────┼───────────────────┬───────────────────┐
       ▼                   ▼                   ▼                   ▼                   ▼
 [Catálogo Cuentas]  [Libro Diario]     [Libro Mayor]      [Bal. Comprobación] [Estados Financieros]
   (VEN-NIF 92 Ctas)  (Partida Doble)    (Movimientos)       (Sumas y Saldos)   (Balance & Resultados)
       │                   │                                                           │
       └─────────┬─────────┘                                                           │
                 ▼                                                                     ▼
       [Contabilización Auto]                                                [Cierres y Ajustes]
     (Ventas, Compras, Pagos)                                                (BCV, REI, Diferencial)
```

---

## 3. Especificación Detallada de Cada Submódulo

### 3.1. Catálogo / Plan de Cuentas (`ChartOfAccountsView.tsx`)
**¿Para qué sirve?**
Es el árbol maestro jerárquico que organiza todas las cuentas contables de la empresa.

**Estructura Jerárquica en 4 Niveles:**
1. **Nivel 1 (Clase / Grupo Principal)**: 
   - `1` ACTIVO
   - `2` PASIVO
   - `3` PATRIMONIO
   - `4` INGRESOS
   - `5` COSTOS
   - `6` GASTOS OPERACIONALES
   - `7` OTROS INGRESOS Y EGRESOS (REI / FLUCTUACIÓN CAMBIARIA)
   - `8` CUENTAS DE ORDEN
2. **Nivel 2 (Subgrupo)**: Ej. `1.1` ACTIVO CORRIENTE, `1.2` ACTIVO NO CORRIENTE, `2.1` PASIVO CORRIENTE.
3. **Nivel 3 (Cuenta Mayor)**: Ej. `1.1.01` Efectivo y Equivalentes de Efectivo, `1.1.04` Inventarios.
4. **Nivel 4 (Cuenta Detalle / Auxiliar Imputable)**: Ej. `1.1.01.01` Caja Principal VES, `1.1.01.03` Caja Moneda Extranjera USD, `2.1.02.01` IVA Débito Fiscal.

**Campos y Parámetros Clave:**
- **Naturaleza del Saldo (Normal Balance)**:
  - `DEBIT` (Deudora): Aumenta por el Debe, disminuye por el Haber (Activos, Costos, Gastos).
  - `CREDIT` (Acreedora): Aumenta por el Haber, disminuye por el Debe (Pasivos, Patrimonio, Ingresos).
- **Acepta Asientos (accepts_postings)**: Solo las cuentas de nivel 4 tienen este indicador activo (`true`). Las cuentas de nivel 1 al 3 son estrictamente acumuladoras de sumas.
- **Clasificación Monetaria (is_monetary)**:
  - `Monetaria (is_monetary = 1)`: Partidas cuyo valor nominal no cambia pero pierden poder adquisitivo por inflación (Caja, Bancos, CxC, CxP). Generan el Resultado por Exposición a la Inflación (REI).
  - `No Monetaria (is_monetary = 0)`: Partidas que mantienen su valor intrínseco y deben ser reexpresadas por inflación (Inventarios, Propiedad Planta y Equipo, Terrenos, Capital Social).
- **Cuenta de Caja o Banco (is_bank_or_cash)**: Identifica cuentas financieras sujetas a conciliación bancaria y diferencial cambiario.

---

### 3.2. Comprobantes de Diario (`JournalEntriesView.tsx`)
**¿Para qué sirve?**
Registra formalmente los asientos contables en orden cronológico con correlativo obligatorio continuo (`AS-AAAA-NNNNN`).

**Reglas de Operación y Funcionamiento:**
- **Partida Doble Estricta**: Cada asiento exige que $\sum \text{Débitos} = \sum \text{Créditos}$. Si hay un céntimo de descuadre, el sistema bloquea el guardado.
- **Multimoneda Dual**: Toda línea registra simultáneamente su importe en Bolívares (VES) y el contravalor en Dólares (USD), calculados a la tasa de cambio oficial BCV del día del comprobante.
- **Ciclo de Vida del Comprobante (Estados)**:
  - `DRAFT` (Borrador): Asiento en edición o revisión. No afecta saldos de balances ni libros mayores.
  - `POSTED` (Asentado / Legalizado): Aprobado formalmente. Afecta los saldos del período. Por mandato del Código de Comercio, una vez asentado **no se puede editar ni borrar físicamente**.
  - `ANNULLED` (Anulado): Si un asiento asentado contiene errores, se reversa mediante un contra-asiento de anulación auditado, manteniendo el historial del folio.
- **Tipos de Asiento**:
  - `STANDARD`: Asiento operativo diario (ventas, compras, pagos, nómina).
  - `OPENING`: Asiento de apertura de ejercicio fiscal.
  - `ADJUSTMENT`: Reclasificaciones y ajustes de auditoría.
  - `EXCHANGE_DIFF`: Ajuste automático de fluctuación cambiaria BCV.
  - `INFLATION_ADJUSTMENT`: Reexpresión monetaria REI (VEN-NIF B-10).
  - `CLOSING`: Cierre anual de cuentas de resultados contra Ganancias y Pérdidas.

---

### 3.3. Libro Mayor Legal (`GeneralLedgerView.tsx`)
**¿Para qué sirve?**
Centraliza los movimientos de cada cuenta auxiliar de detalle a lo largo del tiempo.
- **Saldo Inicial**: Arrastra el saldo acumulado de ejercicios anteriores o del inicio del período filtrado.
- **Movimientos Cronológicos**: Lista cada asiento (`entry_number`), fecha, concepto, referencia del documento mercantil, débito, crédito y saldo progresivo.
- **Exportación Oficial**: Genera reportes en PDF legal aptos para inspecciones del SENIAT o presentación ante el Registro Mercantil.

---

### 3.4. Balance de Comprobación (`TrialBalanceView.tsx`)
**¿Para qué sirve?**
Verifica el equilibrio patrimonial y certifica que no existan inconsistencias de partida doble antes de emitir balances definitivos.
- **Niveles de Inspección**: Permite agrupar a Nivel 1 (Grandes masas patrimoniales), Nivel 2, Nivel 3 o Nivel 4 (Desglose analítico).
- **Columnas de Control**: Saldo Anterior, Movimientos del Mes (Débitos / Créditos), Saldo Actual Deudor y Saldo Actual Acreedor.
- **Filtro de Cuentas**: Interruptor para ocultar cuentas con saldo cero y emitir resúmenes ejecutivos.

---

### 3.5. Estados Financieros Oficiales (`FinancialStatementsView.tsx`)
**¿Para qué sirve?**
Genera los informes de síntesis financiera estructurados bajo las directrices de la FCCPV y NIIF para PYMES.
- **Estado de Situación Financiera (Balance General)**:
  - Clasificación en Activo Corriente y No Corriente.
  - Pasivo Corriente y No Corriente.
  - Patrimonio Neto y Resultado Acumulado.
  - Validación de la Ecuación Patrimonial: $\text{Activo} = \text{Pasivo} + \text{Patrimonio}$.
- **Estado de Resultados Integrales**:
  - Ingresos por Ventas Gravadas y Exentas.
  - (-) Costo de Ventas (determinado por el Kardex comercial).
  - (=) Utilidad Bruta.
  - (-) Gastos Operacionales y Administrativos.
  - (+/-) Resultados Financieros, Diferencial Cambiario y REI.
  - (=) Resultado Neto Integral del Ejercicio.
- **Reexpresión VEN-NIF B-10**:
  - Permite alternar entre valores históricos nominales y valores reexpresados a moneda constante.

---

### 3.6. Control de Cierres, Auditoría y Ajustes VEN-NIF (`FiscalClosingView.tsx`)
**¿Para qué sirve?**
Administra el ciclo temporal del ejercicio contable, previene modificaciones retroactivas ilegales y ejecuta los motores de regularización monetaria.

**Componentes:**
1. **Control de Períodos Fiscales Mensuales (12 Períodos)**:
   - `OPEN`: Abierto para procesar transacciones del mes.
   - `CLOSED`: Cerrado provisionalmente por el departamento de contabilidad al finalizar las conciliaciones.
   - `LOCKED`: Bloqueado definitivamente para auditoría externa o cierre fiscal. **Impide asentar o alterar cualquier comprobante en dicho mes**.
2. **Regularización por Diferencia en Cambio (Cuentas en Divisas)**:
   - Identifica todas las cuentas de bancos y cuentas por cobrar/pagar en USD.
   - Aplica la tasa de cambio oficial del BCV a la fecha de corte.
   - Compara el saldo registrado en Bolívares contra el saldo revaluado ($USD \times \text{Tasa BCV}$).
   - Genera automáticamente el asiento de Ganancia Cambiaria (`7.2.01`) o Pérdida Cambiaria (`7.1.02`).
3. **Gestión de Índices INPC del BCV**:
   - Módulo para consultar, agregar y actualizar los valores oficiales del Índice Nacional de Precios al Consumidor publicados por el Banco Central de Venezuela.
4. **Motor de Reexpresión y REI (VEN-NIF B-10)**:
   - Selección dinámica de Año/Mes de Cierre y Año/Mes Base.
   - Cálculo del Factor de Corrección:
     $$\text{Factor} = \frac{\text{INPC}_{\text{Cierre}}}{\text{INPC}_{\text{Base}}}$$
   - Reexpresa las partidas no monetarias (Inventarios, Propiedades y Equipos, Capital) y calcula el Resultado por Exposición a la Inflación (REI Neto).

---

### 3.7. Motor de Contabilización Automática (`AutoPostingView.tsx`)
**¿Para qué sirve?**
Vincula en tiempo real los eventos comerciales del ERP con la contabilidad legal, generando asientos inmediatos sin requerir digitación manual por parte del contador.

**Circuitos Automatizados:**
1. **Ventas y Facturación POS**:
   - Débito a Caja (`1.1.01.01`) o Banco según forma de pago.
   - Débito a CxC Clientes (`1.1.02.01`) en ventas a crédito.
   - Crédito a Ingresos por Ventas Gravadas (`4.1.01`) o Exentas (`4.1.02`).
   - Crédito a IVA Débito Fiscal (`2.1.02.01`).
   - Crédito a IGTF por Enterar (`2.1.02.05`) si se pagó en divisas en efectivo.
   - Asiento simultáneo de Costo de Ventas: Débito a Costo de Mercancía (`5.1.01`) contra Crédito a Inventario (`1.1.04.01`).
2. **Compras y Recepción de Mercancía**:
   - Débito a Inventario (`1.1.04.01`).
   - Débito a IVA Crédito Fiscal (`1.1.03.01`).
   - Crédito a Proveedores Nacionales (`2.1.01.01`) o Extranjeros (`2.1.01.02`).
3. **Cobros y Pagos (CxC y CxP)**:
   - Liquidación de cuentas por cobrar o pagar contra cuentas bancarias.
   - Registro automático de retenciones de IVA (75% / 100%) e ISLR aplicadas.
4. **Ajustes de Inventario**:
   - Mermas o pérdidas físicas $\rightarrow$ Débito a Pérdida de Inventario (`5.1.01`) contra Inventario (`1.1.04.01`).
   - Sobrantes físicos $\rightarrow$ Débito a Inventario (`1.1.04.01`) contra Otros Ingresos (`7.2.01`).
5. **Procesamiento por Lotes (Batch Posting)**:
   - Permite seleccionar un rango de fechas y procesar masivamente facturas o cobros históricos que hayan quedado sin asiento contable.

---

## 4. Matriz de Mapeos Contables Predeterminados

| Clave de Mapeo (`mapping_key`) | Código VEN-NIF | Denominación Oficial de la Cuenta | Circuito Operativo Asociado |
| :--- | :--- | :--- | :--- |
| `CASH_VES` | `1.1.01.01` | Caja Principal (Efectivo VES) | Cobros POS en efectivo bolívares |
| `CASH_USD` | `1.1.01.03` | Caja en Moneda Extranjera (USD) | Cobros POS en efectivo divisas |
| `BANK_DEFAULT` | `1.1.01.04` | Banco Mercantil Cta Cte (VES) | Pagos móviles, puntos de venta y transferencias |
| `ACCOUNTS_RECEIVABLE` | `1.1.02.01` | Clientes Nacionales Comerciales | Facturación comercial a crédito en Bolívares |
| `ACCOUNTS_RECEIVABLE_USD` | `1.1.02.02` | Clientes en Moneda Extranjera (USD) | Facturas emitidas con pacto en divisas |
| `TAX_CREDIT_IVA` | `1.1.03.01` | IVA Crédito Fiscal | Facturas de compra de bienes y servicios |
| `TAX_RETENTION_IVA_RECEIVED` | `1.1.03.02` | Retenciones de IVA Soportadas por Compensar | Retenciones aplicadas por clientes agentes de retención |
| `TAX_RETENTION_ISLR_RECEIVED` | `1.1.03.03` | Retenciones de ISLR Acumuladas por Compensar | Comprobantes de retención ISLR emitidos por clientes |
| `INVENTORY` | `1.1.04.01` | Inventario de Mercancías para la Venta | Entradas de compras y salidas por ventas/ajustes |
| `ACCOUNTS_PAYABLE` | `2.1.01.01` | Proveedores Nacionales | Facturas de compra a crédito en Bolívares |
| `ACCOUNTS_PAYABLE_USD` | `2.1.01.02` | Proveedores Extranjeros / Divisas | Facturas de proveedores facturadas en moneda extranjera |
| `TAX_DEBIT_IVA` | `2.1.02.01` | IVA Débito Fiscal | IVA 16% generado en ventas de bienes y servicios |
| `TAX_RETENTION_IVA_PAYABLE` | `2.1.02.02` | Retenciones de IVA por Enterar al SENIAT | Retenciones practicadas a proveedores por enterar quincenalmente |
| `TAX_RETENTION_ISLR_PAYABLE` | `2.1.02.03` | Retenciones de ISLR por Enterar al SENIAT | Retenciones de ISLR practicadas a proveedores por enterar |
| `TAX_IGTF_PAYABLE` | `2.1.02.05` | IGTF por Enterar al SENIAT | Alícuota 3% cobrada en divisas en efectivo |
| `SALES_REVENUE` | `4.1.01` | Ventas de Mercancías Gravadas con IVA | Ingresos operacionales gravados con alícuota general |
| `SALES_REVENUE_EXEMPT` | `4.1.02` | Ventas de Mercancías Exentas / Exoneradas | Ingresos operacionales de alimentos y bienes exentos de IVA |
| `COST_OF_SALES` | `5.1.01` | Costo de Mercancía Vendida | Descargo automático de existencias a costo promedio |
| `EXCHANGE_DIFF_GAIN` | `7.2.01` | Ganancia en Fluctuación Cambiaria | Revaluación de activos en divisas con incremento de tasa BCV |
| `EXCHANGE_DIFF_LOSS` | `7.1.02` | Pérdida en Fluctuación Cambiaria | Revaluación de pasivos en divisas o caída del contravalor |
| `REI_RESULT` | `7.3.01` | Resultado Monetario del Ejercicio (REI Neto) | Contrapartida del ajuste por inflación VEN-NIF B-10 |

---

## 5. Glosario de Estados y Banderas Contables

- **`DRAFT` (Borrador)**: Estado inicial de comprobantes contables creados manualmente o en revisión. No afecta saldos de balances ni libros mayores.
- **`POSTED` (Asentado)**: Asiento formalizado e inmutable en el Libro Diario Legal y Libro Mayor.
- **`ANNULLED` (Anulado)**: Comprobante revertido mediante contra-asiento por motivos de corrección o devolución.
- **`OPEN` (Abierto)**: Período mensual habilitado para registrar asientos y comprobantes comerciales.
- **`CLOSED` (Cerrado)**: Período mensual concluido administrativamente. Requiere reapertura para modificar.
- **`LOCKED` (Bloqueado)**: Período auditado formalmente. Bloqueo estricto e irreversible contra alteraciones.
- **`INPC`**: Índice Nacional de Precios al Consumidor publicado mensualmente por el Banco Central de Venezuela.
- **`REI`**: Resultado por Exposición a la Inflación según la norma VEN-NIF B-10.
- **`MONETARY` (Partida Monetaria)**: Dinero en efectivo, créditos y débitos fijos en moneda de curso legal que sufren erosión inflacionaria.
- **`NON_MONETARY` (Partida No Monetaria)**: Mercancías, activos tangibles e intangibles y patrimonio neto que deben reexpresarse con el factor de inflación.

---

## 6. Procedimientos Contables Frecuentes (Paso a Paso)

### Procedimiento A: Inicialización de la Contabilidad en una Nueva Empresa
1. Ingrese con rol de Administrador o Contador a "Contabilidad > Plan de Cuentas".
2. Si el catálogo está vacío, presione el botón **"Verificar Catálogo VEN-NIF"** o **"Sembrar Catálogo Estándar VEN-NIF"**.
3. El sistema sembrará automáticamente las 92 cuentas estándar en sus 4 niveles, el año fiscal actual con sus 12 meses y los 21 mapeos de contabilización automática.
4. Diríjase a "Contabilidad > Contabilización Automática" y confirme que los interruptores de ventas, compras e inventario se encuentren activos.

### Procedimiento B: Asiento Manual de Diario (Ajuste o Nómina)
1. Ingrese a "Contabilidad > Libro Diario & Comprobantes" y presione **"Nuevo Comprobante"**.
2. Indique la fecha, el tipo de comprobante (`STANDARD`, `ADJUSTMENT`) y el concepto legal.
3. Agregue las líneas de asiento seleccionando cuentas de nivel 4 (imputables).
4. Verifique que la columna "Diferencia" indique `0.00 Bs` (cuadre de partida doble).
5. Presione **"Guardar Borrador"** (para revisar) o **"Asentar Comprobante"** (para legalizarlo inmediatamente en el Libro Diario).

### Procedimiento C: Cierre Mensual, Diferencial Cambiario y Ajuste por Inflación
1. Ingrese a "Contabilidad > Cierre & Auditoría Fiscal".
2. **Diferencial Cambiario**: En la sección de Ajuste Cambiario, confirme la tasa oficial BCV del último día del mes y presione **"Simular Diferencia Cambiaria"**. Verifique el informe de ganancias/pérdidas en bancos y CxC/CxP y procese el ajuste.
3. **Índice INPC BCV**: En la sección de Índices INPC, verifique que el índice del mes de corte esté registrado. Si el BCV acaba de publicarlo, presione **"Registrar INPC BCV"**, digite el valor oficial, la variación mensual y la fecha de publicación.
4. **Ajuste por Inflación (REI)**: Seleccione el Año/Mes de Cierre y Año/Mes Base y presione **"Calcular REI (VEN-NIF)"**. Revise el factor acumulado y el desglose de reexpresión de partidas no monetarias.
5. **Bloqueo del Mes**: En la tarjeta del mes correspondiente, presione **"Cerrar"** y posteriormente **"Bloquear"** para garantizar la inmutabilidad legal del período auditado.
