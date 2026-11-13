/**
 * Maestro de Personal — Data Layer Barrel
 *
 * SPEC §§5, 7–12, 14, Appendix A & C.
 * Public surface for database client, query builders, paging, and repositories.
 */

// Supabase Client (§14)
export { getSupabaseClient, supabase } from "@/data/client";

// Paging Contracts & Defaults (§11 Decision)
export {
  applyPaging,
  applyRange,
  DEFAULT_PAGE_LIMIT,
  getSelectOptions,
  type Page,
  type PagingOptions,
  validatePageBoundaries,
} from "@/data/paging";

// Query Builders (§7, §9, §11)
export {
  type AdvancedSearchFilters,
  advancedSearch,
  type ExecutableQuery,
  getTableOrdering,
  gsel,
  listQuery,
  type OrderClause,
  type OrderingToggle,
  type QueryDescriptor,
  simpleSearch,
} from "@/data/query";

// Repositories & RPC Commits (§5, §8, §12)
export {
  BaseRepo,
  CargoRepo,
  DependenciaRepo,
  type GuardarOp,
  mapPostgrestError,
  PaisRepo,
  PersonalRepo,
  ReferenceRepo,
} from "@/data/repositories";
