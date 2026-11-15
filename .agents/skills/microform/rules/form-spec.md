# microform — Form Construction Specification

## 1. Intent

- **Outcome**: Deterministic, schema-first, headless form construction engine binding Zod, React Hook Form, and modular control registries. Decouples data validation and layout structure from UI components.
- **User**: AI agents and engineers implementing enterprise forms, backoffice data-entry suites, and dynamic configuration UIs.
- **Why now**: Traditional form setups tightly couple schema validation, field layout, and UI components, leading to duplicated default values, manual grid math, and fractured draft persistence.
- **Success**: A full 10-field form defined in <80 declarative lines. 100% type safety from Zod schema to control renderers. Zero hardcoded UI tags inside the engine.
- **Constraints**: React 19, `react-hook-form` ^7, `zod` ^4, `@microx-technologies/microform` ^1.1.0 (`createStructForm` app shell requires ^1.3.0, grid `classNames` requires ^1.2.0). 12-column layout grid. Ports and Adapters for side-effects (storage, notification, mutation).
- **Out of scope**: Visual styling/CSS, bundled UI kits, backend transport clients, server-action executors.

---

## 2. Invariant: Mechanism vs Policy

The framework provides mechanism; userland provides policy:

- **Framework MAY ship**: Typed registry, Zod defaults derivation (`createFormDefaults`), required map extraction (`buildRequiredMap`), variable cleaner (`cleanVars`), 12-column grid layout binding (`FieldGrid`, `FormFields`), React context (`MicroformProvider`), dynamic renderer dispatcher (`InferFieldInput`), draft persistence hook (`usePersistence`), debounced async query hook (`useAsyncQuery`), submit lifecycle orchestrator (`handleSubmitFlow`), memory storage adapter for testing.
- **Framework MUST NOT ship**: HTML tags, CSS styles, UI components (inputs, selects, buttons), global singleton registries, bundled HTTP clients, hardcoded toast libraries.
- Every visual primitive and side-effect adapter MUST be userland-injected.

---

## 3. Goals & Non-goals

### Goals
- Single source of truth: Schema declares types, constraints, and default values.
- Declarative layout: Sections, rows, and responsive spans declared via `FieldStructure`.
- Isolated registries: Multiple independent form registries coexisting without global state contamination.
- Pluggable ports: Storage, notifications, queries, and mutations injected as typed interfaces.

### Non-goals
- Form builder UI / drag-and-drop generator.
- Multi-framework support: Core is framework-agnostic; bindings target React 19 exclusively.
- Client-side validation replacement: Validation belongs to Zod and React Hook Form.

---

## 4. Core Concepts

| Concept | Meaning |
| :--- | :--- |
| **Schema** | Zod object schema (`z.object({...})`) defining data shape, constraints, and defaults. |
| **Defaults** | Scalar/fallback values derived automatically from schema via `createFormDefaults`. |
| **Structure** | Declarative array (`AppStructure<T>` = `MicroformStructure<typeof microform, T>`) defining sections, rows, and 12-column spans (`colspan`). `type:` autocompletes from the registry; typos fail compile. |
| **Control** | Unit composed of a string `type` and a pure renderer function (`defineControl`). |
| **Registry** | Isolated container (`Microform`) mapping control types to renderers. Created via `createMicroform`. |
| **Provider** | React context (`MicroformProvider`) propagating a `Microform` instance to tree descendants. |
| **FormFields** | React component mapping `FieldStructure` into React Hook Form `Controller` slots. |
| **StructForm** | Submit wrapper owning `<form>`, `isSubmitting` state, and field disabling. Button pixels via `renderSubmit`, form attrs via `formProps`. |
| **AppStructForm** | App shell resolved once via `createStructForm({ microform, renderItem, classNames, formClassName })`: provider, item renderer, and spacing policy in one config. Every submit form consumes it; explicit per-use props merge over factory defaults. |
| **InferFieldInput** | Dynamic component resolving a field renderer from contextual or explicit registry. |
| **StorageAdapter** | Port for persistence (`get`, `set`, optional `remove`). Consumed by `usePersistence`. |
| **QuerySource** | Canonical async port (`{ fetch: (args) => Promise<{ items, total? }> }`). Declared once with `createUrqlSource({ document, client, toVariables, fromData })`, consumed with `useAsyncQuery({ source, search, page })`. Structs carry `source: QuerySource<PersonOption>` — never a hook. |
| **SubmitFlow** | Standardized mutation runner handling variable cleaning, execution, notifications, and cache invalidation. |

---

## 5. Normative Construction Rules (Binding on Agents)

Every form built using `microform` MUST comply with the following rules:

### Rule 1: Schema-First Authority
Forms MUST be anchored by a Zod schema. Form values type MUST be inferred directly:
```ts
const formSchema = z.object({ ... });
type FormValues = z.infer<typeof formSchema>;
```

### Rule 2: Automatic Defaults Derivation
Never hand-write defaults. Call `createFormDefaults` directly in the `defaultValues` prop (no `useMemo` — RHF reads defaults once at mount):
```ts
const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: createFormDefaults(formSchema, { status: "ACTIVE" }),
});
```
With draft persistence, spread `readPersistedValues(formStructure, storage)` after it.

### Rule 3: 12-Column Grid Budget
Layout MUST be declared via `AppStructure<keyof FormValues>` (one alias per app, see Rule 8). Every multi-field row MUST satisfy `sum(colspan) <= 12` (unset defaults to 12). `FieldGrid` applies Tailwind classes automatically.

### Rule 4: Registry Instantiation Scope
`createMicroform({ controls })` MUST be declared at module scope or memoized via `useMemo`. Instantiating registries inside component render bodies without memoization is FORBIDDEN.

### Rule 5: Contextual Provider Wrapping
Any view utilizing `<InferFieldInput />` MUST be enclosed within `<MicroformProvider value={microform}>` unless `microform={instance}` is passed as an explicit prop.

### Rule 6: Input Sanitization on Submit
- API mutations MUST sanitize payloads using `cleanVars(data, { empty: "null" })` to convert blank strings `""` to `null`.
- Search queries MUST sanitize payloads using `cleanVars(data, { empty: "omit" })` to drop empty fields.
- Alternatively, use `handleSubmitFlow` which enforces `{ empty: "null" }` by default.

### Rule 7: Draft Persistence Lifecycle
When draft retention is required, hydrate via `readPersistedValues` and sync with `usePersistence`. Purge on success via `clearPersistedValues` or `handleSubmitFlow({ clearPersistence: true, structure, storage })`.

### Rule 8: Registry-Derived Structure Types
Never redeclare the control union. One alias per app, next to its registry:
```ts
export const microform = createMicroform({ controls: [textControl, ratingControl] });
export type AppStructure<TName extends string> = MicroformStructure<typeof microform, TName>;

export const loginStruct: AppStructure<"username" | "password"> = [
  { name: "password", label: "Password", type: "password" }, // autocompletes; typos fail compile
];
```
Bare `FieldStructure<TName>` (open `string` channel) is forbidden in app code — a typo renders `null` with zero feedback. `InferFieldInput` keeps a `(string & {})` escape hatch for runtime-registered types; the typo gate lives at struct level. `register()` cannot widen an inferred union: declare controls upfront, or opt out with `createMicroform<string>({ controls })`.

### Rule 9: AppStructForm-First Submit Path
Every app defines ONE shell next to its registry — provider, item renderer, and spacing policy live in one config, fully typed with per-use overrides:
```tsx
export const AppStructForm = createStructForm({
  microform,
  renderItem: renderMicroformItem,
  classNames: { row: "gap-x-4 gap-y-8", section: "gap-8" },
  formClassName: "space-y-8",
});
```
Nearly every submit form consumes it — library owns state, userland owns pixels:
```tsx
<AppStructForm
  structure={loginStruct}
  form={form}
  schema={loginSchema}
  onSubmit={handleLogin}
  renderSubmit={({ disabled, isSubmitting }) => (
    <Button type="submit" disabled={disabled} aria-busy={isSubmitting}>
      {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
      Sign in
    </Button>
  )}
/>
```
Forbidden in submit forms: raw `StructForm` + `MicroformProvider` repetition, hand-written `<form onSubmit={form.handleSubmit(...)}>`, `useState` loading flags, and the legacy bare `<button>` fallback. Spacing overrides stay explicit per form (`classNames`, `formProps.className`) and win against factory defaults — e.g. a compact form passes `formProps={{ className: "flex flex-col gap-2 space-y-0" }}`. Exempt by design: `watch`-driven auto-save, single `useController` controls, non-RHF filter bars.

### Rule 10: No Manual Submit Loading State
Loading MUST come from `formState.isSubmitting` (injected into `renderSubmit`, auto-merged into `disabled`). RHF sets it before validation and clears it after `onSubmit` settles — exactly the window manual flags cover. `handleSubmitFlow`'s `setIsLoading` is only for non-`StructForm` flows.
