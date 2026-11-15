---
name: microform
description: >-
  Headless form engine and data-entry toolkit with typed control registry, Zod defaults,
  12-column grid structures, draft persistence, async sources, and submit orchestration.
  Use when creating or refactoring forms, generating form fields from schemas,
  handling draft auto-save, building custom form controls, or managing async queries in microform.
  Do not use for raw HTML forms without React or simple single-input forms without microform.
---

# Microform Skill

Headless, decoupled form engine adhering to **Ports and Adapters** and the **Open/Closed Principle**. Decouples business logic, schema validation, and layout grids from presentation UI.

Requires `@microx-technologies/microform >= 2.0.0` (`renderSubmit`, `MicroformStructure`, inferred control union, `QuerySource` + `createUrqlSource`).
App-shell factory `createStructForm` requires `>= 1.3.0`; grid `classNames` requires `>= 1.2.0`.

## Architecture

- **Core (`@microx-technologies/microform`)**: Framework-agnostic. Registry `createMicroform` with inferred control-type union (`InferMicroformType`, `MicroformStructure`), schema defaults `createFormDefaults` with full support for discriminated unions and literals, required field maps `buildRequiredMap`, variable cleaner `cleanVars`, pure persistence reader `readPersistedValues`, cleanup `clearPersistedValues`, memory adapter, canonical async port `QuerySource` (`{ fetch: (args) => Promise<{ items, total? }> }`) and typed urql adapter `createUrqlSource({ document, client, toVariables, fromData, pageSize })`, and ports.
- **React (`@microx-technologies/microform/react`)**: React 19 bindings. Context `MicroformProvider`, dynamic dispatcher `InferFieldInput`, submit wrapper `StructForm` (`renderSubmit` + `formProps`, loading from `formState.isSubmitting`), app-shell factory `createStructForm` (provider + item renderer + spacing policy in one config), layout coordinator `FormFields`, grid renderer `FieldGrid` with Tailwind CSS grid support enabled by default (`classNames` overrides), persistence `usePersistence`, and canonical async search `useAsyncQuery({ source, search, page })` over a `QuerySource` declared with `createUrqlSource`.

---

## Form Construction Specification

> [!IMPORTANT]
> All forms MUST adhere to the normative specification:
> 👉 **[rules/form-spec.md](rules/form-spec.md)**

### Invariant Rules for Agents
1. **Schema-first**: Zod `z.object` or `z.discriminatedUnion`. Defaults via a direct `createFormDefaults(schema)` call (no `useMemo`, no hand-written objects); drafts via `readPersistedValues(structure, storage)`.
2. **12-Column Grid with Tailwind**: Rows sum to ≤ 12 via `colspan`. `FieldGrid` applies Tailwind classes automatically.
3. **Provider Requirement**: `<InferFieldInput />` requires an ancestor `<MicroformProvider value={microform}>`.
4. **Registry Scope**: `createMicroform({ controls })` at module level. The control union is inferred — never redeclare it; type every struct with one app alias (`MicroformStructure<typeof microform, TName>`).
5. **AppStructForm-first**: Every app defines ONE shell via `createStructForm({ microform, renderItem, classNames, formClassName })` next to its registry. All submit forms consume the resolved component — never raw `StructForm` + `MicroformProvider` + per-form `renderItem`/`formProps` repetition. Explicit per-use props merge over (and win against) factory defaults. Manual `<form>` + `FormFields` + `useState` loading is forbidden. Exempt by design: `watch`-driven auto-save, single `useController` controls, non-RHF filter bars.
6. **Submit State**: Loading comes from `formState.isSubmitting` (injected into `renderSubmit`, auto-merged into `disabled`). `handleSubmitFlow`'s `setIsLoading` only outside `StructForm`. Mutations use `cleanVars(data, { empty: "null" })`; add `clearPersistence: true` when drafts exist.

---

## On-Demand Reference Modules

Load the specific reference module required for the current task:

| Capability | Reference File |
| :--- | :--- |
| **Custom Controls & Registry** | [references/01-registry-and-controls.md](references/01-registry-and-controls.md) |
| **Layout Grid & Tailwind Rendering** | [references/02-structure-and-rendering.md](references/02-structure-and-rendering.md) |
| **Draft Persistence & Pure Storage** | [references/03-ports-and-persistence.md](references/03-ports-and-persistence.md) |
| **Async Queries & Submit Flow** | [references/04-async-and-submit-flow.md](references/04-async-and-submit-flow.md) |
| **Canonical End-to-End Cheatsheet** | [references/05-recipes-and-cheatsheet.md](references/05-recipes-and-cheatsheet.md) |
