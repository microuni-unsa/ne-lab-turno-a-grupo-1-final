# Plan de Ejecución en 10 Fases — Maestro de Personal

> **Proyecto:** Maestro de Personal (_Soluciones Móviles S.A.C._)
> **Superficie objetivo:** Mobile-first exclusivamente (**Android PWA / Capacitor WebView**, viewports `360×640` a `430×932`; escritorio fuera de alcance).
> **Stack activo:** Vite 8 + React 19 + TypeScript (`strict: true`) + `@ionic/react` v9 + `@ionic/react-router` + Tailwind CSS v4 + `shadcn` (personalizado sobre Ionic donde aporta comportamiento nativo) + `@microx-technologies/microform` + Zod v4 + `@tanstack/react-query` + `@supabase/supabase-js` + Vitest + Biome.
> **Autoridad normativa:** [`SPEC.md`](./SPEC.md), [`PRODUCT.md`](./PRODUCT.md) e [`INTERNALS.md`](./INTERNALS.md).

---

## 0. Línea Base Actual Verificada

Ya existe y ha sido verificado con `bun run check`, `bun run build` y `bun run test:unit`:

- **Base de datos y RPCs (`supabase/`)**: [`20261115000001_schema.sql`](./supabase/migrations/20261115000001_schema.sql) (`estreg`, `pais`, `dependencia`, `cargo`, `personal`, triggers `set_updated_at`, políticas RLS), [`20261115000002_guardar.sql`](./supabase/migrations/20261115000002_guardar.sql) (`guardar_pais`, `guardar_dependencia`, `guardar_cargo`, `guardar_personal`) y [`seed.sql`](./supabase/seed.sql).
- **Dominio puro (`src/core/`)**: `constants.ts`, `errors.ts`, `types.ts`, `validators.ts`, `lifecycle.ts`, `session.ts`, barril [`src/core/index.ts`](./src/core/index.ts) y 56 pruebas unitarias en verde.
- **Capa de datos (`src/data/`)**: `client.ts`, `paging.ts` (`DEFAULT_PAGE_LIMIT = 50`), `query.ts` (`listQuery`, `simpleSearch`, `advancedSearch`, `gsel`, `getTableOrdering`), `repositories.ts` (`PaisRepo`, `DependenciaRepo`, `CargoRepo`, `PersonalRepo`, `mapPostgrestError`), barril [`src/data/index.ts`](./src/data/index.ts) y 19 pruebas de integración en [`test/integration/database-invariants.integration.test.ts`](./test/integration/database-invariants.integration.test.ts) (bajo `LIVE_DB=1`).
- **Base UI / Shell**: [`src/index.css`](./src/index.css) (Ionic en capas CSS + Tailwind v4 + puente Shadow DOM por `data-slot`), 15 primitivas en `src/components/ui/` generadas vía CLI de `shadcn`, [`src/lib/microform.tsx`](./src/lib/microform.tsx) (`microform`, `AppStructure`, `AppStructForm`) y [`src/App.tsx`](./src/App.tsx) (`IonApp`, `IonReactRouter`, `QueryClientProvider`).

---

## Reglas Transversales Obligatorias (Vigentes en las 10 Fases)

1. **Mobile-first estricto (cero desktop):** Toda vista, tabla/lista, formulario, selector o modal se diseña, estiliza y prueba en viewports móviles (`360×640`–`430×932`, zonas táctiles ≥ 44px, `Drawer` / `IonModal`). No se añaden layouts de escritorio, tablas anchas sin adaptación móvil ni código exclusivo de desktop.
2. **Prohibición absoluta de importaciones dinámicas, tipos inline y helpers puente:**
   - **Prohibido** `import(...)` dinámico en código fuente de `src/` y `test/` (ni `await import(...)`, ni `React.lazy(() => import(...))`, ni `require(...)`).
   - **Prohibido** usar importaciones de tipo inline como `import("@microx-technologies/microform").FieldType<...>` en firmas, tipos o aliases.
   - **Prohibido** declarar funciones fantasma o puentes de inferencia para rodear tipos, exactamente del tipo:

     ```ts
     // PROHIBIDO
     declare function FormFieldsItemTypeHelper<
       TFieldValues extends FieldValues,
       TName extends FieldPath<TFieldValues>,
     >(
       field: import("@microx-technologies/microform").FieldType<
         TName,
         MicroformControlType,
         TFieldValues
       >,
     ): void;
     ```
   - **Obligatorio:** Todas las importaciones de valores y tipos deben declararse de forma estática en cabecera (`import { ... }` / `import type { ... }`).
3. **Tipado estricto sin casteos inseguros:**
   - Activo `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true` en [`tsconfig.json`](./tsconfig.json).
   - **Prohibido** `any`, `as unknown as ...`, `as Foo` sin narrowing previo, `!` (non-null assertion), `@ts-ignore` y `@ts-expect-error` en código nuevo o modificado (única excepción permitida: `as const` en literales inmutables y los branded helpers explícitos ya existentes en `@/core/types`).
   - El cruce de fronteras con formularios, eventos Ionic o respuestas PostgREST se resuelve mediante genéricos, `satisfies`, esquemas Zod v4 (`safeParse`) o predicados de tipo (`value is T`).
4. **Estilos Tailwind v4 normales y componentes `ui/*` vía CLI:**
   - Prohibido escribir atributos arbitrarios de Ionic en TSX como `[--background:transparent]`. Cualquier puente hacia Shadow DOM de Ionic va encapsulado en `@layer components` dentro de [`src/index.css`](./src/index.css).
   - Todo componente base nuevo de `shadcn` se instala obligatoriamente con `bunx shadcn add ...` y solo se personaliza internamente si `@ionic/react` aporta comportamiento móvil nativo.
5. **Integridad de arquitectura (`@/core` ↔ `@/data` ↔ `microform`):**
   - Importar dominio y datos exclusivamente vía barriles `@/core` y `@/data`. No duplicar constantes de `SPEC §3`, reglas de transición `SPEC §6.1` ni validadores.
   - Formularios con submit usan `AppStructForm`, `AppStructure`, `createFormDefaults`, `cleanVars` y `formState.isSubmitting` (sin banderas manuales `useState` de loading).
   - Prohibido enviar `created_at` o `updated_at` en mutaciones (`R17`).
6. **Cero rutas relativas en imports:** Respetar `noRestrictedImports` de [`biome.json`](./biome.json) usando siempre el alias `@/`.

---

## Protocolo Obligatorio de Cierre de Fase (Gate + 2 Subagentes Auditores)

Ninguna fase se considera cerrada hasta ejecutar y aprobar **en este orden**:

1. **Verificación automatizada local:**
   - `bun run check` (`biome check --write && tsc --noEmit`) con 0 errores y 0 advertencias pendientes.
   - `bun run check:static` (regla automatizada implementada en Fase 1 que falla ante `import(`, `declare function`, `as any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, `[--background:` o rutas relativas `./`/`../`).
   - `bun run build` (`tsc && vite build`) limpio.
   - Batería completa de la fase y regresión previa: `bun run test:unit`, `bun run test:integration` (y con `LIVE_DB=1` cuando haya BD conectada), y `bun run test:e2e`.
2. **Despliegue obligatorio en paralelo de 2 subagentes auditores independientes** sobre los archivos creados o modificados en la fase:
   - **Subagente Auditor 1 — Buenas Prácticas, No Sobreingeniería (YAGNI/KISS) y SOLID:**
     - **Responsabilidad:** Verificar cohesión, responsabilidades únicas por archivo/hook/componente (**SRP**), extensibilidad paramétrica sin duplicar código entre tablas (**OCP**), contratos intercambiables de repositorios/notificadores (**LSP**), interfaces mínimas por consumidor (**ISP**), dependencia de abstracciones/puertos y barriles `@/core`/`@/data` (**DIP**), ausencia de sobreingeniería o capas innecesarias, cumplimiento estricto de mobile-first y fidelidad conductual a `SPEC.md` y `PRODUCT.md`.
   - **Subagente Auditor 2 — Tipado Estricto, Cero Casteos Inseguros e Importaciones Estáticas:**
     - **Responsabilidad:** Auditar línea por línea todo `.ts`/`.tsx` de la fase comprobando cero `any`, cero casteos `as` inseguros (incluyendo `as Record<string, unknown>`, `as unknown as`, `as ErrorCode`), cero `!`, cero `@ts-ignore`/`@ts-expect-error`, **cero importaciones dinámicas (`import(...)`), cero tipos inline `import("...").*` y cero `declare function` puente como `FormFieldsItemTypeHelper`**, y correcta derivación de tipos desde Zod (`z.infer`), `AppStructure` y `@/core`.
3. **Resolución de hallazgos:** Si cualquiera de los dos auditores reporta un hallazgo bloqueante (o crítico/medio de diseño o tipado), se corrige en código, se re-ejecutan las pruebas afectadas y se vuelve a solicitar verificación de los auditores hasta obtener **APROBADO** de ambos.

---

## Resumen de las 10 Fases

| Fase   | Nombre                                                                    | Foco principal                                                                                                                                           |
| :----- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | Infraestructura de Testing, Reglas Estáticas y Saneamiento Base           | Vitest DOM (`jsdom` + RTL), Playwright móvil, guard automatizado anti-`import(`/casteos, limpieza de wrappers `ui/*`                                     |
| **2**  | Feedback Nativo (`IonToast` / `IonAlert`) y Catálogo `E-*` (`R22`)        | Puerto/adaptador Ionic de avisos/confirmaciones + diccionario español de los 9 `ERROR_CODES` y campos + batch `R22`                                      |
| **3**  | Motor de Sesión (`useMaintenanceController`) + Zod v4 + React Query       | Orquestador sobre `MaintenanceSession`, `PendingOp`, esquemas Zod v4 derivados de `@/core` e invalidación de caché                                       |
| **4**  | Shell Móvil, Navegación (`IonReactRouter`) y Guard `Salir` (`§8.7`)       | Home móvil (_Maestro de Personal_), navegación entre 4 tablas, barra de 9 acciones, `EstadoBadge` y bloqueo `Salir` con `E-PENDING`                      |
| **5**  | Listado Paginado, Ordenamiento (`R18`) y Búsqueda Simple/Avanzada (`§11`) | Hook `useMaintenanceList` (`limit = 50`), toggle `Nom ASC`/`Cod ASC`, búsqueda simple, `Drawer` de filtros avanzados y retención tras `Cancelar`         |
| **6**  | Mantenimiento de Referencia I — Plantilla Paramétrica y `PAÍS`            | Componente reutilizable `ReferenceMaintenance` + `AppStructForm` aplicado a `PAIS` (`PaisRepo`), paridad DB-course y guard `R11`                         |
| **7**  | Mantenimiento de Referencia II — `DEPENDENCIA`, `CARGO` y Semillas        | Despliegue completo de `DEPENDENCIA` (`Sistemas`, `Contabilidad`, `Almacen`) y `CARGO`, invalidación `gsel` y pruebas cruzadas `R11`/`R12`               |
| **8**  | Selector Genérico de FKs `G-SEL` (`SPEC §9`) para `PERSONAL`              | Adaptador `QuerySource<SelectOption>` sobre `gsel()` (solo `Activo`, orden `Nom ASC, Cod ASC`), cancelar-conserva y seleccionar-vincula                  |
| **9**  | Maestro `PERSONAL` Completo y Búsqueda Avanzada Completa                  | Pantalla `/personal` con `PerCod`, `PerNom` (homónimos `R5`), `PerDNI`, `PerFecNac` (`calendar` ≥ 18a), 3 FKs vía `G-SEL`, ciclo `A/I/*` y filtros §11.3 |
| **10** | Paridad DB-Course, Pulido Mobile-First, PWA y Capacitor Sync              | Auditoría UX móvil táctil/teclado/red, Replay E2E del instructor (4 tablas × 9 ops + §13), checklist PWA y `cap sync android`                            |

---

## Fase 1 — Infraestructura de Testing Multi-Nivel, Reglas Estáticas y Saneamiento de Contratos Base

### Objetivo y Alcance

Dejar operativa toda la pirámide de pruebas (unitarias DOM, integración y E2E móvil en Playwright) y automatizar las prohibiciones de calidad (cero importaciones dinámicas, cero inline type imports `import("...").*`, cero `declare function` puente, cero casteos inseguros) desde el día 1. Saneamiento de los casteos residuales introducidos al envolver `@ionic/react` en `src/components/ui/*`.

### Entregables Concretos

- Instalar en `devDependencies`: `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@playwright/test` (y navegador Chromium headless).
- Actualizar [`vitest.config.ts`](./vitest.config.ts) para soportar entorno `jsdom` en pruebas de componentes/hooks (`*.ui.unit.test.tsx` / `test/integration/*.ui.test.tsx`) manteniendo `node` en lógica pura y BD, más script `src/test/setup-dom.ts` (mocks mínimos de Web APIs ausentes en jsdom, p. ej. `matchMedia` requerido por Ionic).
- Crear `playwright.config.ts` configurado **exclusivamente con dispositivo/viewport móvil** (`390×844`, `hasTouch: true`, `isMobile: true`) apuntando al servidor Vite local (`bun run preview` o `bun run dev`), y scripts `test:e2e`, `check:static` en [`package.json`](./package.json).
- Implementar script verificador `scripts/check-static-rules.ts` (o regla GritQL verificada en Biome) ejecutado por `bun run check:static` que falle si encuentra en `src/` o `test/`:
  - `import(` (dinámicos o inline type imports `import("...").X`),
  - `declare function .*Helper` o puentes equivalentes,
  - `as any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`,
  - `[--background:` o overrides de variables Ionic en `.tsx`.
- Refactorizar los wrappers existentes de `src/components/ui/` (`button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `checkbox.tsx`) para extraer helpers de mapeo de props JSX → Ionic con interfaces limpias y sin propagar `as Record<string, unknown>` ni `as unknown as`.

### Plan de Pruebas

- **Pruebas Unitarias (`src/test/static-guard.unit.test.ts`, `src/components/ui/ui-wrappers.unit.test.tsx`):**
  - El verificador estático rechaza fragmentos con `import("@microx-technologies/microform").FieldType`, `declare function FormFieldsItemTypeHelper`, `await import("./x")`, `as unknown as Foo` y `[--background:transparent]`, y acepta imports estáticos con `import type`.
  - Pruebas unitarias en `jsdom` de `Button`, `Input` y `Checkbox` verificando disparo correcto de `onClick`, `onChange` y `onCheckedChange`.
- **Pruebas de Integración (`test/integration/shell-bootstrap.integration.test.tsx`):**
  - Montaje de `<App />` completo (`QueryClientProvider` + `IonApp` + `IonReactRouter`) en `jsdom` verificando render sin excepciones en consola y verificación de conectividad/variables cuando `LIVE_DB=1`.
- **Pruebas E2E (`e2e/app-bootstrap.spec.ts`):**
  - Arranque de Vite en viewport móvil (`390×844`): verifica título `Maestro de Personal`, subtítulo `Soluciones Móviles S.A.C.`, cero errores `pageerror`/`console.error` y ausencia de desbordamiento horizontal (`scrollWidth <= clientWidth`).

### Criterios de Aceptación

- [ ] `bun run test:unit`, `bun run test:integration` y `bun run test:e2e` ejecutan y pasan desde CLI sin intervención manual.
- [ ] `bun run check:static` falla ante `import(...)`, `declare function ...Helper`, casteos inseguros y `[--background:transparent]`, y pasa en todo el repo actual.
- [ ] Playwright emula superficie móvil táctil y bloquea cualquier overflow horizontal.
- [ ] Cero modificaciones incompatibles en contratos públicos de `@/core` y `@/data`.

### Cierre Obligatorio de Fase 1

- Ejecutar `bun run check && bun run check:static && bun run build && bun run test:unit && bun run test:integration && bun run test:e2e`.
- Desplegar **Auditor 1 (Buenas prácticas / YAGNI / SOLID)** y **Auditor 2 (Tipado estricto / Cero casteos / Sin imports dinámicos)** sobre `vitest.config.ts`, `playwright.config.ts`, `scripts/check-static-rules.ts` y `src/components/ui/*`. Resolver hallazgos hasta doble **APROBADO**.

---

## Fase 2 — Feedback Nativo Móvil (`IonToast` / `IonAlert`), Catálogo Español `E-*` y Reporte Batch (`R22`)

### Objetivo y Alcance

Implementar la capa de presentación de errores, avisos y confirmaciones móviles sobre componentes nativos Ionic (`IonToast` e `IonAlert`), junto con el mapeo exhaustivo y tipado de los 9 códigos de error normativos de `SPEC §12` (`ERROR_CODES`) y campos del dominio en español formal de laboratorio (`PRODUCT.md`).

### Entregables Concretos

- Crear `src/lib/error-catalog.ts`:
  - `FIELD_LABELS`: mapa tipado por nombre de columna (`PaiCod`, `PaiNom`, `DepCod`, `DepNom`, `CarCod`, `CarNom`, `PerCod`, `PerNom`, `PerDNI`, `PerFecNac`, `PerPaiCod`, `PerDepCod`, `PerCarCod`, `EstReg`, `PaiEstReg`, `DepEstReg`, `CarEstReg`, `PerEstReg`, `session`) con etiqueta amigable en español.
  - `ERROR_TITLES` y `formatFieldFailure(failure: FieldFailure)` / `formatBatchFailures(failures: readonly FieldFailure[])`: garantizan reporte de código + campo + explicación clara en español para los 9 códigos (`E-PENDING`, `E-REQUIRED`, `E-FORMAT`, `E-RANGE`, `E-DUP`, `E-REF`, `E-REF-STATE`, `E-REF-BLOCKED`, `E-TRANSITION`) sin auto-corrección ni defaults silenciosos (`R22`).
- Crear `src/lib/feedback.tsx` (puerto + proveedor):
  - Interfaz `FeedbackPort` (`notifySuccess`, `notifyWarning`, `notifyBatchErrors`, `confirmAction`, `alertPending`) siguiendo DIP para desacoplar controladores de Ionic.
  - Implementación `IonicFeedbackProvider` montado en [`src/App.tsx`](./src/App.tsx) con `IonToast` (mensajes efímeros de guardado/cancelación) e `IonAlert` (avisos bloqueantes tipo `JOptionPane` del curso de BD para `E-PENDING`, `E-REF-BLOCKED`, `E-TRANSITION` y errores batch `R22`).
- Completar pruebas de comportamiento táctil/accesible sobre `Drawer`, `Dialog`, `AlertDialog` y `Select` de `src/components/ui/`.

### Plan de Pruebas

- **Pruebas Unitarias (`src/lib/error-catalog.unit.test.ts`):**
  - Cobertura exhaustiva 9/9 de `ERROR_CODES` comprobando que todo `ErrorCode` posee título y plantilla de mensaje (`satisfies Record<ErrorCode, ...>`).
  - Deduplicación y formateo batch (`R22`) cuando `Guardar` retorna múltiples `FieldFailure` simultáneos.
  - Verificación de mapeo de error residual de red sin silenciamiento (`SPEC §14`: red requerida).
- **Pruebas de Integración (`test/integration/feedback-ionic.integration.test.tsx`):**
  - Renderizar un consumidor de `useFeedback()` bajo `IonicFeedbackProvider` en `jsdom`: verificar disparo de `notifyBatchErrors` con lista de fallos mostrando códigos `E-*`, y `confirmAction` resolviendo `true`/`false` según botón pulsado en `IonAlert` o su adaptador controlado.
- **Pruebas E2E (`e2e/feedback-overlays.spec.ts`):**
  - Montar un harness/vista de verificación accesible solo en modo dev/test (sin afectar producción o integrado en ruta diagnóstica temporal hasta Fase 4) y comprobar en Playwright móvil (`390×844`) apertura/cierre de `IonToast`, `IonAlert`, `Drawer` y `Select` de `ui/*` con interacción táctil real y contraste legible.

### Criterios de Aceptación

- [ ] Los 9 códigos de error `E-*` y todos los campos de las 4 tablas tienen traducción formal en español validada por tipado exhaustivo (`Record<ErrorCode, ...>`).
- [ ] Las alertas de errores múltiples muestran todos los fallos acumulados (`R22`), nunca solo el primero.
- [ ] `IonToast` e `IonAlert` funcionan vía puerto desacoplado (`FeedbackPort`) con cierre táctil limpio en viewport móvil.

### Cierre Obligatorio de Fase 2

- Ejecutar `bun run check && bun run check:static && bun run build && bun run test:unit && bun run test:integration && bun run test:e2e`.
- Desplegar **Auditor 1 (Buenas prácticas / YAGNI / SOLID)** y **Auditor 2 (Tipado estricto / Cero casteos / Sin imports dinámicos)** revisando `src/lib/error-catalog.ts`, `src/lib/feedback.tsx` y tests de la fase. Resolver hallazgos hasta doble **APROBADO**.

---

## Fase 3 — Motor de Sesión (`useMaintenanceController`), Esquemas Zod v4 y Puente React Query

### Objetivo y Alcance

Construir el motor genérico de mantenimiento del frontend (`src/features/maintenance/`) conectando `MaintenanceSession` (`@/core`), los repositorios (`@/data`), esquemas Zod v4 (derivados de las constantes únicas de `@/core`) y `@tanstack/react-query`, garantizando exactamente 1 operación pendiente por sesión y atomicidad visual en `Guardar`/`Cancelar`/`Salir`.

### Entregables Concretos

- Crear `src/features/maintenance/schemas.ts`:
  - Esquemas Zod v4 tipados sin literales repetidos (consumen `MIN_CODE`, `MAX_SMALLINT`, `MAX_INTEGER`, `MIN_NAME`, `MAX_NAME`, `DNI_LEN`, `MIN_AGE` desde `@/core`):
    - Factory `createReferenceSchema({ codeField, nomField, isUpdate })` para `PAIS`, `DEPENDENCIA` y `CARGO`.
    - `createPersonalSchema({ isUpdate, todayLocal })` para `PERSONAL` (validando código, nombre trimmed, DNI 8 dígitos ASCII, fecha estrictamente pasada y `≥ MIN_AGE` años frente a `todayLocal`, y FKs seleccionadas `> 0`).
- Crear `src/features/maintenance/query-keys.ts`:
  - Llaves determinísticas `maintenanceKeys.list(table, ...)`, `maintenanceKeys.gsel(table)` e helper `invalidateTableQueries(queryClient, table)`.
- Crear `src/features/maintenance/use-maintenance-controller.ts`:
  - Recibe `{ table, repo, feedback, queryClient, getTodayLocal }`.
  - Instancia y encapsula `MaintenanceSession` de `@/core` exponiendo estado reactivo inmutable: `pending` (`PendingOp | null`), `hasPending`, `selectedRow`, `isSaving`.
  - Operaciones: `selectRow`, `startAdicion`, `startModificacion`, `startInactivar`, `startReactivar`, `startEliminar`, `cancelar`, `guardar`, `salir`.
  - Reglas normativas aplicadas:
    - Si `hasPending === true` al pulsar cualquiera de las 5 operaciones o `salir()` → dispara `feedback.alertPending()` (`E-PENDING`) y NO altera la operación ni el borrador actual.
    - Si target `EstReg === EST_X` o transición prohibida por `canTransition` (`§6.1`) → `E-TRANSITION` inmediato antes de abrir edición.
    - Al fallar `guardar()` (cliente, probe pre-flight o RPC): aplica los `FieldFailure[]` al formulario RHF vía callback tipado, lanza reporte batch `R22` en `feedback`, y **mantiene `pending` abierto** (`§8.4`).
    - Al triunfar `guardar()`: limpia `pending`, invalida caché de lista + `gsel` de esa tabla (`invalidateTableQueries`) y muestra `IonToast` de confirmación.
    - `guardar()` sin operación pendiente retorna éxito no-op silencioso (`§8.4`).
    - `cancelar()` descarta `pending` sin escrituras y sin tocar filtros/orden de la lista (`§8.5`).

### Plan de Pruebas

- **Pruebas Unitarias (`src/features/maintenance/schemas.unit.test.ts`, `src/features/maintenance/use-maintenance-controller.unit.test.ts`):**
  - Casos borde de Zod v4: código `0`, `-1`, `32767`, `32768`, `2147483647`; nombre `" A "` (< 2 tras trim) vs `"Ab"` vs 101 chars; DNI `"1234567"`, `"12345678"`, `"1234567A"`; `PerFecNac` exactamente cumpliendo 18 años en `todayLocal` (válido), 1 día menor de 18 (inválido `E-RANGE`), fecha futura y bisiesto `2004-02-29`.
  - Máquina de sesión en hook: doble inicio → `E-PENDING`; `salir` con pendiente → `E-PENDING`; transición inválida (`A -> Reactivar`, `I -> Inactivar`, `* -> Modificar`) → `E-TRANSITION`; fallo de repositorio conserva `pending` y datos del formulario.
- **Pruebas de Integración (`test/integration/maintenance-controller.integration.test.tsx`):**
  - Hook real con `QueryClientProvider` + repositorio falso/in-memory tipado + `FeedbackPort` real: verificar invalidación de `list` y `gsel` tras `guardar` exitoso, no-invalidación en `cancelar`, mapeo de `FieldFailure[]` a `setError` de RHF.
  - Con `LIVE_DB=1`: ejecutar ciclo `useMaintenanceController` + `PaisRepo` real contra Supabase creando e inactivando un código scratch y verificando preservación de `created_at`.
- **Pruebas E2E (`e2e/maintenance-session.spec.ts`):**
  - Verificar en UI móvil controlada las transiciones de estado del controlador (armar pendiente, bloquear segunda acción con `E-PENDING`, fallar `Guardar` manteniendo inputs visibles, y `Cancelar` descartando cambios).

### Criterios de Aceptación

- [ ] Ningún esquema Zod redeclara literales numéricos fuera de `@/core` (`SPEC §3`).
- [ ] `useMaintenanceController` delega reglas de transición y estado pendiente a `MaintenanceSession` (`@/core`) sin estado sombra contradictorio (`PRODUCT.md` principio 5).
- [ ] Cero `useState` manual para `isSubmitting` cuando opera `AppStructForm`.
- [ ] Invalidación de caché separa limpiamente consultas de listado y consultas `gsel`.

### Cierre Obligatorio de Fase 3

- Ejecutar `bun run check && bun run check:static && bun run build && bun run test:unit && bun run test:integration && bun run test:e2e`.
- Desplegar **Auditor 1 (Buenas prácticas / YAGNI / SOLID)** y **Auditor 2 (Tipado estricto / Cero casteos / Sin imports dinámicos)** revisando `src/features/maintenance/*` y sus tests. Resolver hallazgos hasta doble **APROBADO**.

---

## Fase 4 — Shell Móvil, Navegación (`IonReactRouter`), Hub Principal y Guard `Salir` (`SPEC §8.7`)

### Objetivo y Alcance

Construir el shell navegable mobile-first completo de la aplicación en [`src/App.tsx`](./src/App.tsx) y componentes transversales de navegación/operaciones: menú principal de **Maestro de Personal**, rutas hacia los 4 mantenimientos (`/pais`, `/dependencia`, `/cargo`, `/personal`), barra táctil unificada de las 9 operaciones de laboratorio, `EstadoBadge`, indicador explícito de red y bloqueo estricto de salida ante operación pendiente (`SPEC §8.7`).

### Entregables Concretos

- Crear `src/features/shell/HomePage.tsx`:
  - Cabecera oficial **Maestro de Personal — Soluciones Móviles S.A.C.**.
  - 4 tarjetas táctiles grandes mobile-first para navegar a: **Países**, **Dependencias**, **Cargos** y **Personal** (con resumen corto de qué mantiene cada tabla).
  - Indicador honesto de conectividad/entorno Supabase (aviso explícito si faltan credenciales `VITE_SUPABASE_*` o si falla red — cero modo offline falso per `SPEC §14`).
- Crear componentes compartidos mobile-first en `src/features/maintenance/components/`:
  - `EstadoBadge.tsx`: renderiza los estados normativos `A` (`Activo`), `I` (`Inactivo`), `*` (`Eliminado`) a partir de `EstReg` (`1 | 2 | 3`) con alto contraste móvil.
  - `OperationsBar.tsx`: grilla táctil compacta inspirada en el grid del curso de BD ([`sources/db-course-example-ui.png`](./sources/db-course-example-ui.png) / [`V1Z_TIPVIV.java`](./sources/db-course-V1Z_TIPVIV.java)) adaptada a móvil con las etiquetas exactas de `PRODUCT.md`: `Adicionar`, `Modificar`, `Eliminar`, `Inactivar`, `Reactivar`, `Guardar`, `Cancelar`, `Buscar`, `Salir`.
  - `MaintenanceLayout.tsx`: envuelve cada mantenimiento en `IonPage` + `IonHeader` + `IonToolbar` con botón `Salir` explícito y guard de salida (`SPEC §8.7`, que prevalece sobre el `Salir` incondicional de `V1Z_TIPVIV.java`).
- Configurar rutas estáticas en [`src/App.tsx`](./src/App.tsx) con `IonReactRouter` + `IonRouterOutlet` (`/`, `/pais`, `/dependencia`, `/cargo`, `/personal`, redirección fallback a `/`) usando imports estáticos (sin `React.lazy(() => import(...))`).

### Plan de Pruebas

- **Pruebas Unitarias (`src/features/maintenance/components/operations-and-badge.unit.test.tsx`):**
  - `EstadoBadge` muestra símbolo y etiqueta exactos para `1` (`A · Activo`), `2` (`I · Inactivo`), `3` (`* · Eliminado`).
  - `OperationsBar` expone los 9 botones con etiquetas exactas en español (`Guardar`, nunca "Actualizar" o "Submit").
  - `MaintenanceLayout` invoca `onSalir` al pulsar `Salir` y bloquea navegación cuando el controlador reporta `hasPending = true`.
- **Pruebas de Integración (`test/integration/navigation-salir-guard.integration.test.tsx`):**
  - Montar `App` con `IonReactRouter` en ruta `/pais` simulando sesión limpia (permite volver a `/`) vs sesión con `hasPending = true` (bloquea salida y dispara `IonAlert` `E-PENDING`, preservando el estado pendiente).
- **Pruebas E2E (`e2e/navigation-shell.spec.ts`):**
  - En Playwright móvil (`390×844`): partir en `/`, entrar a cada una de las 4 rutas, validar vista móvil sin scroll horizontal, probar guard `Salir` con operación pendiente armada (bloquea con mensaje `E-PENDING`), cancelar y luego salir limpio de vuelta a `/`.

### Criterios de Aceptación

- [ ] Todas las 9 etiquetas normativas coinciden literalmente con `PRODUCT.md` ("Spanish UI only; no i18n").
- [ ] `Salir` con operación pendiente **siempre** bloquea con `E-PENDING` (`SPEC §8.7`), sin commit automático ni descarte silencioso.
- [ ] Navegación funciona 100% con imports estáticos en `IonReactRouter` y `IonRouterOutlet` en viewports de `360px` a `430px`.

### Cierre Obligatorio de Fase 4

- Ejecutar `bun run check && bun run check:static && bun run build && bun run test:unit && bun run test:integration && bun run test:e2e`.
- Desplegar **Auditor 1 (Buenas prácticas / YAGNI / SOLID)** y **Auditor 2 (Tipado estricto / Cero casteos / Sin imports dinámicos)** revisando `src/App.tsx`, `src/features/shell/*` y `src/features/maintenance/components/*`. Resolver hallazgos hasta doble **APROBADO**.

---

## Fase 5 — Subsistema Genérico de Listado, Ordenamiento (`R18`), Búsqueda Simple (§11.2) y Búsqueda Avanzada (§11.3)

### Objetivo y Alcance

Implementar el motor reutilizable de consulta y búsqueda de registros para los 4 mantenimientos (`src/features/search/`), acoplado a `listQuery`, `simpleSearch`, `advancedSearch`, `getTableOrdering` y `DEFAULT_PAGE_LIMIT = 50` de `@/data`, cumpliendo todas las reglas `R18`–`R21`.

### Entregables Concretos

- Crear `src/features/search/use-maintenance-list.ts`:
  - Hook genérico sobre `useQuery` (`@tanstack/react-query`) parametrizado por `BaseRepo<TRow>`, `ordering: OrderingToggle`, `searchMode: "none" | "simple" | "advanced"`, `simpleTerm`, `advancedFilters` y paginación (`offset`, `limit = DEFAULT_PAGE_LIMIT`).
  - Expone etiqueta legible de la clave de ordenamiento activa (`ORDER BY` expuesto junto a resultados per `R18`: `"Nombre (A→Z), Código"` vs `"Código (1→N)"` en referencia; `"Código (1→N)"` vs `"Nombre (A→Z), Código"` en Personal).
  - Conserva estado completo de búsqueda y ordenamiento al abrir/cerrar/cancelar cualquier operación de mantenimiento (`§8.5`, `R21`).
- Crear `src/features/search/SearchControlsBar.tsx` y `src/features/search/AdvancedSearchDrawer.tsx`:
  - Barra compacta mobile-first con buscador simple (búsqueda reactiva/por acción `Buscar` que soporta limpiar a cadena vacía = lista completa) y botón toggle de ordenamiento (`R18`).
  - `Drawer` inferior móvil para **Búsqueda Avanzada (`§11.3`)**:
    - Filtros comunes: `Cod` exacto, `Nom` contains (case-insensitive), selector multi-opción de `EstReg` `⊆ {A, I, *}` (por defecto los 3 activos = todos los estados mostrados `R19`).
    - Slot extensible (`children` / props declarativas, siguiendo **OCP**) para los filtros extra de `PERSONAL` en Fase 9 (`DNI`, `FecNac from/to`, `PaiCod`, `DepCod`, `CarCod`).
  - Manejo correcto de `R20`: filtros vacíos se omiten sin error y una búsqueda con 0 resultados muestra estado vacío informativo sin lanzar error.
- Crear `src/features/search/RecordListView.tsx`:
  - Lista móvil táctil basada en `Card` (`IonCard`) seleccionable con resalte claro de la fila activa, mostrando `Cod`, `Nom`, `EstadoBadge` (`A/I/*`) y paginación ("Anterior / Siguiente" o carga de página de 50 registros).

### Plan de Pruebas

- **Pruebas Unitarias (`src/features/search/search-filters.unit.test.ts`, `src/features/search/search-controls.unit.test.tsx`):**
  - Sanitización de `AdvancedSearchFilters` (campos en blanco omitidos, `EstReg` completo por defecto, rango `Cod` inválido en filtro manejado de forma segura sin `NaN`).
  - Toggle de ordenamiento cambia entre `"default"` y `"alternate"` exponiendo la descripción de orden activa (`R18`).
  - Estado vacío (0 filas) renderiza vista vacía válida (`R20`); selección de fila filtrada dispara callback de selección (`R21`).
- **Pruebas de Integración (`test/integration/search-subsystem.integration.test.tsx`):**
  - Integrar `useMaintenanceList` con `PaisRepo` real (`LIVE_DB=1`): comprobar ordenamiento inicial `Nom ASC, Cod ASC` (`Bolivia, Chile, Colombia, Ecuador, Perú`), toggle a `Cod ASC` (`1..5`), búsqueda simple `"per"` (`Perú`), búsqueda case-insensitive vs acento (`"peru"` vs `"Perú"` según regla accent-sensitive de `SPEC §11.2`), y búsqueda avanzada con filtro sin coincidencias retornando `[]` sin error.
- **Pruebas E2E (`e2e/search-and-ordering.spec.ts`):**
  - En viewport móvil (`390×844`), interactuar con barra simple, cambiar ordenamiento verificando reordenamiento visual de la lista, abrir `Drawer` de Búsqueda Avanzada, filtrar por `EstReg = [I]`, limpiar filtros y seleccionar una fila filtrada.

### Criterios de Aceptación

- [ ] Todos los listados incluyen estados `A`, `I` y `*` (`R19`) salvo filtro avanzado explícito del usuario.
- [ ] Toda consulta emite ordenamiento explícito (`R18`) y expone en UI qué criterio ordena la vista actual.
- [ ] Criterios vacíos o desconocidos se ignoran (`R20`); 0 resultados nunca se muestran como error.
- [ ] Las filas filtradas siguen siendo 100% seleccionables para Modificar/Inactivar/Reactivar/Eliminar (`R21`) y `Cancelar` no borra filtros ni orden (`§8.5`).

### Cierre Obligatorio de Fase 5

- Ejecutar `bun run check && bun run check:static && bun run build && bun run test:unit && bun run test:integration && bun run test:e2e`.
- Desplegar **Auditor 1 (Buenas prácticas / YAGNI / SOLID)** y **Auditor 2 (Tipado estricto / Cero casteos / Sin imports dinámicos)** revisando `src/features/search/*`. Resolver hallazgos hasta doble **APROBADO**.

---

## Fase 6 — Mantenimiento de Referencia I: Plantilla Reutilizable y Módulo `PAÍS`

### Objetivo y Alcance

Diseñar la vista paramétrica de mantenimiento para tablas de referencia (`PAIS`, `DEPENDENCIA`, `CARGO`, que comparten estructura y reglas idénticas según `SPEC §5.1`) mediante configuración declarativa + `AppStructForm` (`@/lib/microform`), e implementar y verificar completamente el primer mantenimiento real contra Supabase: **Países** (`/pais`, `PaisRepo`).

### Entregables Concretos

- Crear `src/features/reference/reference-config.ts` y `src/features/reference/ReferenceMaintenancePage.tsx`:
  - `ReferenceMaintenanceConfig<TRow>` (tipado genérico estricto sin casteos): nombre de tabla, título singular/plural, nombres de columna (`codeCol`, `nomCol`, `estRegCol`), repositorio `ReferenceRepo<TRow>`, extractores tipados (`getCode`, `getNom`, `getEstReg`), y constructor de `AppStructure` para `microform`.
  - Formulario de **Adición / Modificación** en `Drawer` / hoja móvil usando `AppStructForm` (`@/lib/microform`) con `zodResolver` + `createFormDefaults`:
    - Código (`SMALLINT > 0`): editable en `Adición`, **estrictamente `readonly`/deshabilitado en `Modificación`** (`R2`).
    - Nombre (`VARCHAR(100)`): `MIN_NAME..MAX_NAME` chars tras trim, unicidad ci reportada en `Guardar`.
    - Estado (`EstReg`): solo lectura informativo mostrando `Activo (A)` en `Adición` (`R9`) y estado preservado en `Modificación` (`R8`).
  - Flujo de **Eliminación / Inactivar / Reactivar** (`§8.3`): selecciona fila -> pulsa acción -> abre confirmación/pendiente de cambio de estado único (ningún campo editable) -> `Guardar` o `Cancelar`; pre-chequeo de transición `§6.1` y `R11`.
  - Configuración concreta `paisConfig` y página `/pais` montada en el router.

### Plan de Pruebas

- **Pruebas Unitarias (`src/features/reference/reference-pais.unit.test.tsx`):**
  - Verificación de `AppStructure` de `PAIS` (`PaiCod` `number`, `PaiNom` `text`, `PaiEstReg` solo lectura).
  - En `Modificación`, `PaiCod` no es editable (`readOnly`/`disabled`); en `Adición`, `PaiEstReg` se fuerza a `EST_A` (`1`).
  - Simulación de envío inválido con código `0` y nombre de 1 carácter → errores en ambos campos (`R22`) y pendiente sigue abierto.
- **Pruebas de Integración (`test/integration/pais-maintenance.integration.test.tsx`):**
  - Contra Supabase vivo (`LIVE_DB=1`, usando códigos scratch aislados y limpieza):
    - `Adición` válida crea registro con `PaiEstReg = 1`, `created_at` y `updated_at` presentes (`R17`: nunca enviados por app).
    - `Adición` con código duplicado o nombre duplicado case-insensitive (`"  perú  "`) falla con `E-DUP` manteniendo pendiente abierto.
    - `Modificación` cambia nombre conservando `PaiCod` y `created_at` y avanzando `updated_at`.
    - Ciclo `A -> I` (`Inactivar`), `I -> A` (`Reactivar`), `I -> *` (`Eliminar`), y bloqueo `E-TRANSITION` al intentar modificar/inactivar/reactivar/eliminar un registro en `*`.
    - Bloqueo `E-REF-BLOCKED` (`R11`) al intentar eliminar `PaiCod = 1` (`Perú`, referenciado por semillas de `personal`), mientras `Inactivar` sobre fila referenciada sí se permite (`R12`) _(restaurando estado semilla al finalizar)_.
- **Pruebas E2E (`e2e/fase-06-pais.spec.ts`):**
  - Playwright móvil (`390×844`) en `/pais`:
    1. Pulsa `Modificar` sin seleccionar fila (aviso explícito de seleccionar fila) y pulsa `Adicionar`.
    2. Intenta duplicar `Perú` con espacios/minúsculas → ve error `E-DUP` batch sin perder el borrador abierto.
    3. Crea un país temporal válido -> verifica aparición en orden alfabético `Nom ASC, Cod ASC`.
    4. Modifica el nombre verificando `PaiCod` bloqueado, inactiva (badge `I`), intenta inactivar otra vez (`E-TRANSITION`), reactiva (badge `A`), arma edición e intenta `Salir` (`E-PENDING`), cancela y elimina el país temporal (badge `*`).
    5. Intenta eliminar un país referenciado (`Perú`) → verifica rechazo `E-REF-BLOCKED`.

### Criterios de Aceptación

- [ ] Las 9 operaciones (`Adicionar`, `Modificar`, `Eliminar`, `Inactivar`, `Reactivar`, `Buscar`, `Cancelar`, `Guardar`, `Salir`) cumplen exactamente `SPEC §8` en `/pais`.
- [ ] La pantalla genérica `ReferenceMaintenancePage` no duplica lógica de negocio ni contiene `if (table === "pais")` ad-hoc; todo se parametriza por configuración tipada.
- [ ] `AppStructForm` (`microform`) gestiona validación, submit y `isSubmitting` sin estados de carga manuales.

### Cierre Obligatorio de Fase 6

- Ejecutar `bun run check && bun run check:static && bun run build && bun run test:unit && bun run test:integration && bun run test:e2e`.
- Desplegar **Auditor 1 (Buenas prácticas / YAGNI / SOLID)** y **Auditor 2 (Tipado estricto / Cero casteos / Sin imports dinámicos)** revisando `src/features/reference/*` y tests. Resolver hallazgos hasta doble **APROBADO**.

---

## Fase 7 — Mantenimiento de Referencia II: `DEPENDENCIA`, `CARGO` e Integridad Cruzada `R11`/`R12`

### Objetivo y Alcance

Habilitar los mantenimientos completos de **Dependencias** (`/dependencia`, `DependenciaRepo`) y **Cargos** (`/cargo`, `CargoRepo`) reutilizando la plantilla de Fase 6 sin duplicación de UI ni lógica, validar las semillas obligatorias de laboratorio (`Sistemas`, `Contabilidad`, `Almacen`) e integridad referencial cruzada `R11`/`R12` junto con la invalidación de cachés `gsel`.

### Entregables Concretos

- Definir `dependenciaConfig` (`DepCod`, `DepNom`, `DepEstReg`, `DependenciaRepo`) y `cargoConfig` (`CarCod`, `CarNom`, `CarEstReg`, `CargoRepo`) en `src/features/reference/reference-config.ts`.
- Conectar `/dependencia` y `/cargo` en [`src/App.tsx`](./src/App.tsx) con instancias limpias de `ReferenceMaintenancePage`.
- Garantizar en `invalidateTableQueries` que toda escritura en `pais`, `dependencia` o `cargo` invalide tanto su caché de listado como `maintenanceKeys.gsel(table)` para reflejar altas, ediciones, inactivaciones y eliminaciones en el flujo `G-SEL` de `PERSONAL`.
- Validar explícitamente mensajes de error específicos de entidad (`DepCod` / `DepNom` y `CarCod` / `CarNom`) en fallos `E-DUP` y `E-REF-BLOCKED`.

### Plan de Pruebas

- **Pruebas Unitarias (`src/features/reference/dependencia-cargo.unit.test.tsx`):**
  - Verificación de `dependenciaConfig` y `cargoConfig` (extractores, `AppStructure` con nombres de columna exactos, validación Zod de `SMALLINT` y longitud de `DepNom`/`CarNom`).
  - Confirmar que los 3 mantenimientos de referencia comparten exactamente el mismo componente de página sin bifurcaciones imperativas ni casteos de filas.
- **Pruebas de Integración (`test/integration/dependencia-cargo.integration.test.tsx`):**
  - Contra Supabase vivo (`LIVE_DB=1`):
    - Verificar presencia de semillas `DEPENDENCIA` (`Sistemas`, `Contabilidad`, `Almacen`) y `CARGO` (5 cargos semilla).
    - Verificar `R11` vs `R12` en `DEPENDENCIA` y `CARGO`: crear cargo/dependencia temporal + personal temporal que lo referencia (`EstReg = 1`): `Eliminar` falla con `E-REF-BLOCKED`; `Inactivar` sí funciona (`R12`) y desaparece de `gsel()`, pero la fila de Personal conserva su FK (`R7`); tras pasar Personal a `*`, `Eliminar` la dependencia/cargo pasa sin bloqueo (`R11`: solo bloquean filas `A` o `I`).
    - Comprobar invalidación automática de caché `gsel` en `QueryClient` tras `Inactivar` y `Reactivar`.
- **Pruebas E2E (`e2e/fase-07-dependencia-cargo.spec.ts`):**
  - Playwright móvil (`390×844`) recorriendo `/dependencia` y `/cargo`: verifica orden alfabético inicial (`Almacen`, `Contabilidad`, `Sistemas`), intenta eliminar `Sistemas` (error `E-REF-BLOCKED`), crea un cargo nuevo, verifica rechazo `E-DUP` por nombre repetido sin distinguir mayúsculas, modifica, inactiva, reactiva y elimina el cargo temporal.

### Criterios de Aceptación

- [ ] `DEPENDENCIA` y `CARGO` reutilizan `ReferenceMaintenancePage` con cero código duplicado de formulario o sesión.
- [ ] Las 3 dependencias de laboratorio (`Sistemas`, `Contabilidad`, `Almacen`) están intactas, ordenadas por defecto `DepNom ASC, DepCod ASC`.
- [ ] `Inactivar` en referencia vinculada a `PERSONAL` funciona (`R12`), mientras `Eliminar` queda bloqueado (`E-REF-BLOCKED`) únicamente mientras exista `PERSONAL` en estado `A` o `I` (`R11`).
- [ ] Cachés `gsel` de las 3 tablas se invalidan al guardar cambios.

### Cierre Obligatorio de Fase 7

- Ejecutar `bun run check && bun run check:static && bun run build && bun run test:unit && bun run test:integration && bun run test:e2e`.
- Desplegar **Auditor 1 (Buenas prácticas / YAGNI / SOLID)** y **Auditor 2 (Tipado estricto / Cero casteos / Sin imports dinámicos)** revisando las configuraciones e integraciones de Fase 7. Resolver hallazgos hasta doble **APROBADO**.

---

## Fase 8 — Selector Genérico de Claves Foráneas `G-SEL` (`SPEC §9`) para `PERSONAL`

### Objetivo y Alcance

Implementar y blindar el flujo normativo genérico **`G-SEL`** (`SPEC §9`) reutilizado de forma idéntica para las 3 claves foráneas de `PERSONAL` (`PerPaiCod → PAIS`, `PerDepCod → DEPENDENCIA`, `PerCarCod → CARGO`), conectado al control `async_combobox` de [`src/lib/microform.tsx`](./src/lib/microform.tsx) y garantizando cero escritura libre de códigos FK (`R6`).

### Entregables Concretos

- Crear `src/features/personal/gsel-source.ts`:
  - Fábrica genérica `createGselQuerySource({ repo, codeCol, nomCol })` implementando `QuerySource<SelectOption>` (`@microx-technologies/microform`) con narrowing estricto (sin casteos inseguros al leer las filas retornadas por `repo.gsel()`).
  - Consulta exclusivamente `repo.gsel()` (`WHERE EstReg = 1 ORDER BY Nom ASC, Cod ASC`) — únicamente registros `Activo`, ordenados alfabéticamente con desempate por código, y filtra en cliente por `search` manteniendo el orden alfabético normativo cuando el usuario escribe en el buscador del `Drawer`.
  - Catálogo vacío devuelve `[]` válidamente sin error (`SPEC §9.2`).
- Revisar/ajustar `AsyncComboboxControl` en [`src/lib/microform.tsx`](./src/lib/microform.tsx):
  - Mostrar etiqueta legible (`Nom`) incluso al abrir en modo `Modificación` cuando la fila `PERSONAL` ya tiene una FK guardada (incluyendo si dicha referencia hubiera sido inactivada posteriormente per `R7`, obteniendo su etiqueta por `getByCode` o catálogo inicializado).
  - Garantizar las **5 reglas de `SPEC §9`**:
    1. Trigger desde `Adición` o `Modificación` pendiente de `PERSONAL`.
    2. Consulta Activo-only (`EstReg = EST_A`), orden `Nom ASC, Cod ASC`.
    3. Selección vincula un único `Cod` en el campo del formulario pendiente sin emitir `Guardar` en Supabase.
    4. **Cancelar** (cerrar `Drawer` o tocar fuera/atrás) conserva el valor previo (vacío en `Adición`, valor anterior en `Modificación`), **no** limpia otros campos del formulario y **no** altera la lista de `PERSONAL`.
    5. Prohibida la entrada manual de códigos FK (`R6`); el trigger únicamente abre el selector `G-SEL`.

### Plan de Pruebas

- **Pruebas Unitarias (`src/features/personal/gsel-source.unit.test.ts`, `src/features/personal/gsel-control.unit.test.tsx`):**
  - `createGselQuerySource` valida y mapea filas sin `any` ni casteos inseguros; filtra por búsqueda conservando orden `Nom ASC, Cod ASC`; lista vacía retorna `{ items: [], total: 0 }`.
  - Prueba de componente con `AppStructForm`: llenar `PerNom`, abrir `G-SEL`, cancelar → `PerPaiCod` conserva valor anterior (`undefined` en Adición o `1` en Modificación) y `PerNom` sigue intacto; seleccionar una opción → actualiza solo `PerPaiCod` en memoria sin invocar `guardar`.
- **Pruebas de Integración (`test/integration/gsel-live.integration.test.tsx`):**
  - Contra Supabase vivo (`LIVE_DB=1`): `PaisRepo.gsel()`, `DependenciaRepo.gsel()`, `CargoRepo.gsel()` devuelven solo filas con `EstReg = 1`, en orden `Nom ASC, Cod ASC`; inactivar una fila de prueba la excluye inmediatamente de `createGselQuerySource`, y conservar su código en un intento de `guardar` de `PersonalRepo` dispara `E-REF-STATE` (`R7` / `SPEC §5.4`).
- **Pruebas E2E (`e2e/fase-08-gsel.spec.ts`):**
  - Playwright móvil (`390×844`) sobre el flujo `G-SEL`: abrir selector de País/Dependencia/Cargo dentro de un formulario pendiente, comprobar orden alfabético y exclusión de inactivos, escribir en `PerNom`, abrir selector de País y cerrar con gesto/botón cancelar → verificar preservación exacta de campo FK y `PerNom`, abrir de nuevo y seleccionar una opción verificando 0 peticiones de escritura a RPC `guardar_personal`.

### Criterios de Aceptación

- [ ] Las 3 FKs (`PerPaiCod`, `PerDepCod`, `PerCarCod`) comparten un único mecanismo `G-SEL` (`SPEC §9`) sin tres selectores duplicados.
- [ ] Jamás aparecen registros `Inactivo` (`I`) o `Eliminado` (`*`) dentro del selector `G-SEL`.
- [ ] Cancelar el selector deja intactos tanto el valor previo de la FK como los demás campos de la operación pendiente y el estado de la lista de `PERSONAL`.
- [ ] No existe ningún input de texto/número libre para digitar manualmente `PerPaiCod`, `PerDepCod` o `PerCarCod` (`R6`).

### Cierre Obligatorio de Fase 8

- Ejecutar `bun run check && bun run check:static && bun run build && bun run test:unit && bun run test:integration && bun run test:e2e`.
- Desplegar **Auditor 1 (Buenas prácticas / YAGNI / SOLID)** y **Auditor 2 (Tipado estricto / Cero casteos / Sin imports dinámicos)** revisando `src/features/personal/gsel-source.ts`, los ajustes en `src/lib/microform.tsx` y tests. Resolver hallazgos hasta doble **APROBADO**.

---

## Fase 9 — Maestro `PERSONAL` Completo y Búsqueda Avanzada Completa (`SPEC §5.3–§5.4`, `§11.3`)

### Objetivo y Alcance

Implementar la pantalla central **Maestro de Personal** (`/personal`, `PersonalRepo`) integrando el formulario completo con `AppStructForm`, validaciones batch `R22` (DNI único, fecha de nacimiento `≥ 18` años en `Drawer` de calendario, homónimos permitidos `R5`, inmutabilidad de `PerCod` `R2`), vínculo exclusivo de las 3 FKs vía `G-SEL` (`R6`, `R7`), ciclo `A/I/*` (`R13`), búsqueda simple (`PerNom` / `PerDNI` / `PerCod`) y la Búsqueda Avanzada completa de `PERSONAL` (`§11.3`).

### Entregables Concretos

- Crear `src/features/personal/personal-structure.ts`:
  - `AppStructure` para `PERSONAL`: `PerCod` (`number`, `INTEGER > 0`, `readonly` en `Modificación`), `PerNom` (`text`), `PerDNI` (`text`, `inputMode: "numeric"`, `maxLength: 8`), `PerFecNac` (`calendar` con `maxDate` orientativo pero sin bloqueo silencioso de error en `Guardar`), `PerPaiCod`, `PerDepCod`, `PerCarCod` (`async_combobox` conectados a `G-SEL`), `PerEstReg` (informativo no editable).
- Crear `src/features/personal/PersonalAdvancedFilters.tsx`:
  - Implementa los filtros específicos de `SPEC §11.3` sobre el slot del `AdvancedSearchDrawer` (Fase 5): `DNI` exacto o prefijo, rango de `PerFecNac` (`from ≤ x ≤ to` con cotas opcionales), y selectores opcionales de `PaiCod`, `DepCod` y `CarCod` usando los mismos `QuerySource` `G-SEL` (permitiendo también limpiar cada criterio).
- Crear `src/features/personal/PersonalMaintenancePage.tsx` y conectar `/personal`:
  - Listado paginado con ordenamiento por defecto **`PerCod ASC`** y toggle a **`PerNom ASC, PerCod ASC`** (`SPEC §11.1`), mostrando `PerCod`, `PerNom`, `PerDNI`, `PerFecNac`, resolución legible de País/Dependencia/Cargo y `EstadoBadge` (`A/I/*`, `R19`).
  - Flujo completo de las 9 operaciones sobre `useMaintenanceController` (`PersonalRepo`) con manejo de errores batch `R22` (por ejemplo: DNI duplicado `E-DUP` + menor de 18 años `E-RANGE` + FK inactiva `E-REF-STATE` reportados juntos sin perder el formulario pendiente).
  - Soportar lectura y visualización fiel de filas de `PERSONAL` cuyas FKs ahora estén en estado `I` (`R7`), exigiendo FKs en estado `EST_A` únicamente al confirmar `Guardar` en `Adición` o `Modificación`.

### Plan de Pruebas

- **Pruebas Unitarias (`src/features/personal/personal-form.unit.test.tsx`):**
  - Validación simultánea multi-campo (`R22`): nombre vacío, DNI `"123"`, fecha de nacimiento de 17 años y FKs faltantes producen todos sus `FieldFailure`/errores de campo al intentar `Guardar`.
  - Homónimos (`R5`): dos payloads con idéntico `PerNom` y distinto `PerCod`/`PerDNI` pasan validación local.
  - Búsqueda simple (`§11.2`): entrada numérica `"4"` consulta coincidencia de `PerNom`, `PerDNI` y `PerCod` exacto; entrada textual consulta nombre/DNI sin fallar.
  - Inmutabilidad de `PerCod` en `Modificación` (`R2`) y fecha/edad evaluadas contra `todayLocal` inyectado.
- **Pruebas de Integración (`test/integration/personal-maintenance.integration.test.tsx`):**
  - Contra Supabase vivo (`LIVE_DB=1`, con `PerCod` scratch altos e idempotentes y limpieza al final):
    - `Adición` válida de Personal con FKs `Activo` (`EST_A`), verificando `PerEstReg = 1`, `created_at`/`updated_at` DB-owned (`R16`/`R17`).
    - Rechazo `E-DUP` en `PerCod` o `PerDNI`, `E-RANGE` en menor de 18 años, `E-REF-STATE` si una FK está en estado `2` o `3`.
    - `Modificación` actualiza `PerNom`, `PerDNI`, `PerFecNac` o FKs manteniendo `PerCod` y `created_at` intactos; homónimos permitidos (`R5`).
    - `Inactivar` (`1->2`), `Reactivar` (`2->1`), `Eliminar` (`->3`, `R13` siempre permitido salvo si ya es `*` -> `E-TRANSITION`).
    - Búsqueda avanzada AND-combinada (`PerFecNac` rango + `PaiCod` + `DepCod` + `CarCod` + `EstReg`) y simple (`PerNom`, `PerDNI`, `PerCod`).
- **Pruebas E2E (`e2e/fase-09-personal.spec.ts`):**
  - Playwright móvil (`390×844`) en `/personal`:
    1. Verificar semillas (`Juan Pérez`, `María López`, `Carlos García`, `Ana Rodríguez`) ordenadas por `PerCod ASC`; alternar orden a `PerNom ASC`.
    2. `Adicionar` con múltiples fallos simultáneos (DNI inválido + fecha menor de 18) -> comprobar reporte batch `R22` y persistencia de pendiente; corregir con `Drawer` `calendar` y `G-SEL` para País, Dependencia y Cargo → `Guardar`.
    3. Probar búsqueda simple por código numérico, DNI parcial y nombre, más Búsqueda Avanzada por rango de fecha y País.
    4. Ejecutar `Modificación` (con `PerCod` bloqueado), `Inactivar`, `Reactivar` y `Eliminar` completo verificando badge `*` y rechazo `E-TRANSITION` si se intenta operar de nuevo sobre esa fila.

### Criterios de Aceptación

- [ ] Las 4 tablas (`PAIS`, `DEPENDENCIA`, `CARGO`, `PERSONAL`) están implementadas y operativas con las 9 operaciones de `SPEC §8`.
- [ ] `Personal` cumple todas las reglas §5.3–§5.4 (`R1`–`R9`, `R13`, `R17`, `R22`).
- [ ] Búsqueda simple y Búsqueda Avanzada completa (`§11.2`, `§11.3`) respetan `R18`–`R21` en superficie móvil.
- [ ] `PerPaiCod`, `PerDepCod` y `PerCarCod` solo pueden vincularse mediante `G-SEL`.

### Cierre Obligatorio de Fase 9

- Ejecutar `bun run check && bun run check:static && bun run build && bun run test:unit && bun run test:integration && bun run test:e2e`.
- Desplegar **Auditor 1 (Buenas prácticas / YAGNI / SOLID)** y **Auditor 2 (Tipado estricto / Cero casteos / Sin imports dinámicos)** revisando `src/features/personal/*`. Resolver hallazgos hasta doble **APROBADO**.

---

## Fase 10 — Paridad Conductual DB-Course, Pulido Mobile-First, Verificación Live Demo, PWA y Capacitor Sync

### Objetivo y Alcance

Validar integralmente el sistema como entregable final de evaluación en vivo (`PRODUCT.md` + `SPEC §15` + [`docs/packaging-notes.md`](./docs/packaging-notes.md)): pulido táctil y visual móvil (siguiendo criterios del skill `impeccable`), replay E2E del flujo del evaluador sobre las 4 tablas contra Supabase real, verificación de invariantes SQL `SPEC §13`, checklist PWA y sincronización de artefactos web con Capacitor Android.

### Entregables Concretos

- **Pulido Mobile-First Integral (`360×640` a `430×932`):**
  - Revisar y ajustar espaciados, contrastes, safe-areas de Android/iOS, scroll interno de `Drawer`/`IonModal` con teclado virtual activo en formularios de `PERSONAL` y referencia, zonas táctiles ≥ 44px y consistencia de tokens entre Ionic Shadow DOM (`src/index.css`) y `shadcn`.
  - Verificar ausencia total de estilos o breakpoints desktop innecesarios.
  - Manejo explícito y claro de errores de red/timeout de Supabase (`IonToast`/`IonAlert` reintentable) conforme a `SPEC §14` (sin offline ni cache engañoso).
- **Verificación PWA y Capacitor (`docs/packaging-notes.md`):**
  - Validar [`index.html`](./index.html), [`public/manifest.webmanifest`](./public/manifest.webmanifest), íconos `192×192` y `512×512`, y generación limpia de `dist/` con `bun run build`.
  - Ejecutar `bunx cap sync android` si el proyecto nativo `android/` y entorno están disponibles en el host (o documentar con precisión el estado exacto de la plataforma Capacitor sin afirmar la existencia de APK si no se compiló con Gradle).
- **Limpieza de fixtures/rutas de diagnóstico temporal** usadas en fases iniciales (si las hubo) dejando únicamente las rutas productivas de la aplicación.

### Plan de Pruebas

- **Pruebas Unitarias (`src/test/spec-compliance.unit.test.ts` + suite completa `test:unit`):**
  - Verificación de contratos globales: todos los constantes `SPEC §3`, matriz completa de transiciones `SPEC §6.1` y catálogo de errores `SPEC §12` enlazados sin regresiones en toda la aplicación.
- **Pruebas de Integración (`test/integration/database-invariants.integration.test.ts` + batería completa `LIVE_DB=1 bun run test:integration`):**
  - Ejecutar los 19 tests normativos de [`test/integration/database-invariants.integration.test.ts`](./test/integration/database-invariants.integration.test.ts) junto con todas las pruebas de integración de Fases 1–9 contra Supabase vivo, comprobando al finalizar los 6 invariantes de `SPEC §13` y la integridad de todas las semillas de `Appendix B`.
- **Pruebas E2E Finales — Instructor Behavioral Replay (`e2e/fase-10-instructor-replay.spec.ts`):**
  - Recorrido continuo en Playwright móvil (`360×640` y `390×844`):
    1. **Home -> Países:** listar ordenado alfabético, crear, fallar duplicado `E-DUP`, modificar nombre (`PaiCod` inmutable), inactivar, reactivar, eliminar si libre y verificar `E-REF-BLOCKED` en `Perú`.
    2. **Home -> Dependencias:** comprobar `Sistemas`, `Contabilidad`, `Almacen`; comprobar `E-REF-BLOCKED` al intentar eliminar `Sistemas` y éxito al `Inactivar` (`R12`) + `Reactivar`.
    3. **Home -> Cargos:** crear, editar, ciclo `A/I/*`.
    4. **Home -> Personal:** `Adicionar` con validaciones batch `R22` + `G-SEL` (`PerPaiCod`, `PerDepCod`, `PerCarCod`) + `calendar` (`≥ 18` años), probar `G-SEL` cancelar sin pérdida de borrador, buscar simple + avanzado + toggle ordenamiento, `Modificar` (verificando `PerCod` inmutable), `Inactivar`, `Reactivar`, intentar `Salir` con pendiente activa (`E-PENDING`), cancelar, `Eliminar` registro temporal (verificando liberación de referencia `R11` si aplicaba) y `Salir` limpio.
    5. Verificar `manifest.webmanifest` HTTP 200 e íconos servidos en `vite preview`, con 0 errores de consola y 0 errores de red inesperados.

### Criterios de Aceptación (`SPEC §15` completo)

- [ ] Las 4 tablas (`PAIS`, `DEPENDENCIA`, `CARGO`, `PERSONAL`) implementan las 9 operaciones de `SPEC §8` con la matriz `SPEC §6.1` aplicada.
- [ ] `Adición` fuerza `A`; códigos son inmutables (`R2`); todas las validaciones de `SPEC §5` reportan errores batch con códigos `E-*` (`SPEC §12`, `R22`).
- [ ] `Eliminar` bloqueado según `R11` con `E-REF-BLOCKED`; `Inactivar` permitido en filas referenciadas (`R12`).
- [ ] Flujo `G-SEL` cumple `SPEC §9` exactamente en las 3 FKs (`Activo`-only, `Nom ASC, Cod ASC`, seleccionar-vincula / cancelar-conserva).
- [ ] Listados aplican ordenamiento `SPEC §11.1` con toggle y búsqueda `SPEC §11.2` + `§11.3`.
- [ ] Columnas de auditoría permanecen administradas por BD (`SPEC §10`, `R17`) y los 6 invariantes de `SPEC §13` se cumplen tras cada `Guardar`.
- [ ] La app opera en superficie móvil (`360px`–`430px`) sin layouts desktop, sin importaciones dinámicas ni tipos inline `import(...)`, sin casteos inseguros, y con checklist PWA listo para demo sobre red contra Supabase.

### Cierre Obligatorio de Fase 10 (Auditoría Global Final)

- Ejecutar batería completa final tras el último cambio: `bun run check && bun run check:static && bun run build && bun run test:unit && LIVE_DB=1 bun run test:integration && bun run test:e2e`.
- Desplegar **Auditor 1 (Buenas prácticas / YAGNI / SOLID global)** y **Auditor 2 (Tipado estricto / Cero casteos inseguros / Cero imports dinámicos en todo `src/` y `test/`)** sobre la base completa del proyecto. Toda observación bloqueante debe corregirse y re-verificarse antes de declarar el prototipo listo para entrega.
