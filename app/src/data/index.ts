/**
 * Maestro de Personal — Data Layer Barrel
 *
 * SPEC §§5, 7–12, 14, Appendix A & C.
 * Public surface for database client, query builders, paging, and repositories.
 */

// Supabase Client (§14)
export { getSupabaseClient, supabase } from "./client";

// Paging Contracts & Defaults (§11 Decision)
export {
  type Page,
  DEFAULT_PAGE_LIMIT,
  type PagingOptions,
  validatePageBoundaries,
  applyRange,
  applyPaging,
  getSelectOptions,
} from "./paging";

// Query Builders (§7, §9, §11)
export {
  type OrderingToggle,
  type OrderClause,
  type QueryDescriptor,
  type ExecutableQuery,
  type AdvancedSearchFilters,
  getTableOrdering,
  listQuery,
  simpleSearch,
  advancedSearch,
  gsel,
} from "./query";

// Repositories & RPC Commits (§5, §8, §12)
export {
  type GuardarOp,
  mapPostgrestError,
  BaseRepo,
  ReferenceRepo,
  PaisRepo,
  DependenciaRepo,
  CargoRepo,
  PersonalRepo,
} from "./repositories";
