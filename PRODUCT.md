# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Locked per SPEC.md: Ionic + Capacitor + Supabase-hosted Postgres, Supabase client used directly (no backend API). One codebase shipped as PWA + Android APK; grading happens on the mobile surface only.

## Users

- **Operators (primary):** the 4-member lab group (Turno A, Grupo 1) driving the live graded demo.
- **Evaluator:** the course instructor (same as the databases course). Strict: replays the DB-course click order and expects every button to do what it did there.
- Success = behavior-identical maintenance flows with materially better mobile UX.

## Product Purpose

Graded prototype of the **Maestro de Personal** maintenance module for the fictional **Soluciones Móviles S.A.C.** (Android mobile-software consultancy, course case): full maintenance (9 operations) over Personal + Países + Dependencia + Cargos with the A/I/* record lifecycle, demonstrating the basic functionality any automated system needs. Success is passing the instructor's behavioral replay live over network against Supabase while showing better tooling and UX than the company's current practices.

## Positioning

The only prototype the instructor can grade by muscle memory: DB-course button behavior and click order preserved exactly (an op arms a pending edit, Guardar commits, Cancelar discards, Salir blocked while pending), re-platformed to mobile with the lab-guide operation set (Guardar, plus Buscar simple + advanced) and SPEC.md's exact error, lifecycle, and selection semantics. A neighboring module cannot truthfully copy the combination of E-* fail-fast errors, G-SEL FK selection, and the R11 referential guard.

## Operating Context

- Graded live, over network, against a Supabase project seeded per SPEC.md Appendix B. No offline mode.
- Mobile surface only graded (PWA and/or APK on an Android-sized viewport); desktop explicitly out of grading scope.
- Lab guide §4 governs: maintenance functions, A/I/* lifecycle, default ordering, FK selection flow. DB-course conventions carry over (ESTREG in tables, operator-assigned short numeric codes, RESTRICT).
- Session flow per table: pick a row from the ordered list → start one of Adición/Modificación/Eliminación/Inactivar/Reactivar → Guardar or Cancelar; FK values bound only through the Activo-only alphabetical selection flow; list supports ordering toggle + simple/advanced search.
- Course frame: problem-based-learning deliverable with a S/. 5,000 fictional budget; an Informe de Entregable e Investigación Formativa accompanies the prototype (out of app scope).

## Capabilities and Constraints

- Four maintenances (PAIS, DEPENDENCIA, CARGO, PERSONAL) × 9 operations: Adición, Modificación, Eliminación, Inactivar, Reactivar, Buscar, Cancelar, Guardar, Salir — SPEC.md §8 semantics normative.
- Lifecycle per the §6.1 transition table; Adición forces Activo; codes immutable and operator-assigned; DNI exactly 8 digits, unique; birthdate strictly past and age ≥ 18 at Guardar time.
- Eliminar blocked while live (A/I) Personal rows reference the row (R11); Inactivar allowed on referenced rows; Personal FK targets must be Activo at Guardar time.
- List queries: reference tables default Nom ASC/Cod ASC with Cod ASC toggle; Personal default Cod ASC with Nom ASC toggle; all states shown. Buscar: simple contains (+DNI/code for Personal) and advanced AND-combined filters per §11.3.
- Labels ship as: Adicionar, Modificar, Eliminar, Inactivar, Reactivar, Guardar (= commit, lab-guide term), Cancelar, Salir, Buscar. Spanish UI only; no i18n.
- Technical: network-required; no auth (no created_by/updated_by); no backend; audit timestamps DB-owned and read-only; nothing ever physically deleted.
- Explicitly undecided: APK packaging/verification timing (PWA-first acceptable for the graded surface).

## Brand Commitments

- Owning (fictional) brand: **Soluciones Móviles S.A.C.** Module name: **Maestro de Personal**; app title derives from it without ornament.
- Voice: Spanish, formal lab terminology (Adición, Modificación, Guardar, …). No logo, palette, or assets exist; nothing to preserve visually.

## Evidence on Hand

- `SPEC.md` — normative logic spec: lifecycle, validations, error codes, ordering/search, DDL, seeds, canonical queries.
- `sources/db-course-V1Z_TIPVIV.java` — prior-course Swing maintenance form; behavioral authority for button effects and click order: an op arms a pending edit, commit persists, Cancelar discards, a second op while pending warns.
- `sources/db-course-example-ui.png` — instructor's example screenshot of that form (register panel + table + 2×4 button grid); visual record of the behavior above.
- One conflict: the prior-course Salir closes unconditionally, SPEC §8.7 blocks Salir while pending — SPEC wins.
- Lab guide §4 (maintenance functions, Guardar/Buscar terms) — cited via SPEC.md §1; not in repo.
- Absent: scaffold, logo, testimonials, benchmarks. Future work must not fabricate any.

## Product Principles

1. Behavioral parity first: same buttons, same click order, same outcomes as the DB course; UX improvements never change what an action does.
2. SPEC.md is the logic authority: lifecycle, validations, E-* errors, G-SEL, R11 — presentation never reinterprets or softens them.
3. Mobile-graded, desktop-ignored: every flow must hold on the graded mobile surface; desktop gets nothing extra.
4. Fail fast in Spanish: explicit coded errors at Guardar, batch-reported; no silent defaults, no auto-correction.
5. Tables own domain truth: states, codes, and names live in Postgres per DB-course convention; the app adds no shadow state.
