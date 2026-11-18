# Regla de Mantenimiento Obligatorio del Centro de Ayuda y Documentación

## Regla Mandataria de Actualización Continua

A partir de esta fecha, **cualquier cambio, nueva funcionalidad, ajuste de flujo, nueva regla de negocio o nuevo estado introducido en cualquier módulo de ERO ERP DEBE actualizarse inmediatamente en el Centro de Ayuda (`HelpCenterView.tsx`) y en la documentación del sistema**.

### Ámbito y Cobertura Obligatoria
Siempre que se modifique o extienda:
1. **Un Módulo del ERP** (Ventas, POS, Compras, Inventario, Tesorería, Facturación, Restaurante, Contabilidad VEN-NIF, Impuestos SENIAT, Configuración y Licencias):
   - Se debe verificar si el procedimiento de usuario cambió.
   - Si cambió, se debe agregar o actualizar la guía correspondiente en `USER_GUIDES` dentro de [HelpCenterView.tsx](file:///f:/Desarrollo/EroApp/apps/web/src/features/help/HelpCenterView.tsx).
2. **Nuevos Estados, Banderas (Badges) o Códigos**:
   - Si se añade un nuevo valor de `status`, `type` o terminología técnica (ej. `DRAFT`, `POSTED`, `LOCKED`, `TRIAL`, `REI`, `IGTF`), debe incorporarse de inmediato en `BADGE_DICTIONARY` con su significado en español, contexto y variante de color.
3. **Nuevas Reglas de Negocio o Parámetros de Configuración**:
   - Si se añade una regla en `business_rules`, configuración fiscal o de licenciamiento, debe explicarse en `BUSINESS_RULES_EXPLANATION` indicando su base legal, propósito, impacto operativo y consecuencias en auditoría.
4. **Formato del Manual Descargable (.md y PDF)**:
   - Toda nueva guía debe integrarse en la estructura del manual descargable para que los usuarios y contadores puedan exportar la documentación actualizada en Markdown y PDF.

### Estilo de Redacción de la Ayuda
- Lenguaje claro, profesional y orientado a negocios/operaciones en Venezuela.
- Citas a la normativa correspondiente cuando aplique (Código de Comercio, SENIAT, VEN-NIF / NIIF para PYMES, Ley de IGTF, etc.).
- Estructura paso a paso con advertencias y consejos (`tip`).
- Cumplimiento estricto de las reglas visuales de `erp-frontend-style.md` (sin emojis en el código ni en la UI, radios `rounded-lg`, iconos `<= w-5 h-5`).
