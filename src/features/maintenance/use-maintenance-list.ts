import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
  EST_A,
  EST_I,
  EST_X,
  type EstReg,
  MAX_INTEGER,
  MIN_CODE,
  TABLE_PERSONAL,
  type TableName,
} from "@/core";
import {
  type AdvancedSearchFilters,
  DEFAULT_PAGE_LIMIT,
  type OrderingToggle,
  type PagingOptions,
} from "@/data";
import {
  maintenanceKeys,
  type SearchMode,
} from "@/features/maintenance/query-keys";

export const ALL_ESTREG_STATES = [EST_A, EST_I, EST_X] as const;

export interface RepoReader<TRow> {
  readonly list: (
    ordering?: OrderingToggle,
    page?: { readonly offset: number; readonly limit: number },
    options?: PagingOptions,
  ) => Promise<{
    readonly data: readonly TRow[];
    readonly count: number | null;
  }>;
  readonly search: (
    q: string,
    ordering?: OrderingToggle,
    page?: { readonly offset: number; readonly limit: number },
    options?: PagingOptions,
  ) => Promise<{
    readonly data: readonly TRow[];
    readonly count: number | null;
  }>;
  readonly advancedSearch: (
    filters: AdvancedSearchFilters,
    ordering?: OrderingToggle,
    page?: { readonly offset: number; readonly limit: number },
    options?: PagingOptions,
  ) => Promise<{
    readonly data: readonly TRow[];
    readonly count: number | null;
  }>;
}

export interface AdvancedFilterDraft {
  readonly codText: string;
  readonly nomText: string;
  readonly estReg: readonly EstReg[];
  readonly dniText: string;
  readonly fecNacFrom: string;
  readonly fecNacTo: string;
  readonly paiCod: number | undefined;
  readonly depCod: number | undefined;
  readonly carCod: number | undefined;
}

export const EMPTY_ADVANCED_FILTER_DRAFT: AdvancedFilterDraft = {
  codText: "",
  nomText: "",
  estReg: ALL_ESTREG_STATES,
  dniText: "",
  fecNacFrom: "",
  fecNacTo: "",
  paiCod: undefined,
  depCod: undefined,
  carCod: undefined,
};

function isEstReg(value: unknown): value is EstReg {
  return value === EST_A || value === EST_I || value === EST_X;
}

/**
 * Parses a positive code filter strictly without NaN or integer overflow (R20).
 */
export function parsePositiveCodeFilter(value: unknown): number | undefined {
  if (typeof value === "number") {
    if (
      Number.isSafeInteger(value) &&
      value >= MIN_CODE &&
      value <= MAX_INTEGER
    ) {
      return value;
    }
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return undefined;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (
      Number.isSafeInteger(parsed) &&
      parsed >= MIN_CODE &&
      parsed <= MAX_INTEGER
    ) {
      return parsed;
    }
  }

  return undefined;
}

function parseOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeEstRegSubset(value: unknown): readonly EstReg[] | undefined {
  if (!Array.isArray(value)) {
    return isEstReg(value) ? [value] : undefined;
  }

  const seen = new Set<EstReg>();
  for (const item of value) {
    if (isEstReg(item)) {
      seen.add(item);
    } else if (typeof item === "string" && /^\d+$/.test(item.trim())) {
      const parsed = Number.parseInt(item.trim(), 10);
      if (isEstReg(parsed)) {
        seen.add(parsed);
      }
    }
  }

  const sorted = Array.from(seen).sort((a, b) => a - b);
  if (sorted.length === 0 || sorted.length === ALL_ESTREG_STATES.length) {
    return undefined;
  }
  return sorted;
}

/**
 * Sanitizes AdvancedSearchFilters safely (R19, R20):
 * blank values omitted, invalid numeric codes return undefined (never NaN),
 * complete EstReg set {A, I, *} omitted so all states remain queried by default.
 */
export function sanitizeAdvancedFilters(
  filters: AdvancedSearchFilters | undefined,
): AdvancedSearchFilters {
  if (!filters) {
    return {};
  }

  const cod = parsePositiveCodeFilter(filters.Cod ?? filters.PerCod);
  const nom = parseOptionalText(filters.Nom ?? filters.PerNom);
  const estReg = normalizeEstRegSubset(filters.EstReg ?? filters.PerEstReg);
  const dni = parseOptionalText(filters.DNI ?? filters.PerDNI);
  const fecFrom = parseOptionalText(filters.FecNacFrom ?? filters.from);
  const fecTo = parseOptionalText(filters.FecNacTo ?? filters.to);
  const paiCod = parsePositiveCodeFilter(filters.PaiCod ?? filters.PerPaiCod);
  const depCod = parsePositiveCodeFilter(filters.DepCod ?? filters.PerDepCod);
  const carCod = parsePositiveCodeFilter(filters.CarCod ?? filters.PerCarCod);

  return {
    ...(cod !== undefined ? { Cod: cod } : {}),
    ...(nom !== undefined ? { Nom: nom } : {}),
    ...(estReg !== undefined ? { EstReg: estReg } : {}),
    ...(dni !== undefined ? { DNI: dni } : {}),
    ...(fecFrom !== undefined ? { FecNacFrom: fecFrom } : {}),
    ...(fecTo !== undefined ? { FecNacTo: fecTo } : {}),
    ...(paiCod !== undefined ? { PaiCod: paiCod } : {}),
    ...(depCod !== undefined ? { DepCod: depCod } : {}),
    ...(carCod !== undefined ? { CarCod: carCod } : {}),
  };
}

export function draftToAdvancedFilters(
  draft: AdvancedFilterDraft,
): AdvancedSearchFilters {
  return sanitizeAdvancedFilters({
    Cod: draft.codText,
    Nom: draft.nomText,
    EstReg: draft.estReg,
    DNI: draft.dniText,
    FecNacFrom: draft.fecNacFrom,
    FecNacTo: draft.fecNacTo,
    PaiCod: draft.paiCod,
    DepCod: draft.depCod,
    CarCod: draft.carCod,
  });
}

export function advancedFiltersToDraft(
  filters: AdvancedSearchFilters,
): AdvancedFilterDraft {
  const sanitized = sanitizeAdvancedFilters(filters);
  const codNum = parsePositiveCodeFilter(sanitized.Cod);
  const estReg = normalizeEstRegSubset(sanitized.EstReg);

  return {
    codText: codNum !== undefined ? String(codNum) : "",
    nomText: parseOptionalText(sanitized.Nom) ?? "",
    estReg: estReg ? [...estReg] : ALL_ESTREG_STATES,
    dniText: parseOptionalText(sanitized.DNI) ?? "",
    fecNacFrom: parseOptionalText(sanitized.FecNacFrom) ?? "",
    fecNacTo: parseOptionalText(sanitized.FecNacTo) ?? "",
    paiCod: parsePositiveCodeFilter(sanitized.PaiCod),
    depCod: parsePositiveCodeFilter(sanitized.DepCod),
    carCod: parsePositiveCodeFilter(sanitized.CarCod),
  };
}

export function hasActiveAdvancedFilters(
  filters: AdvancedSearchFilters,
): boolean {
  const sanitized = sanitizeAdvancedFilters(filters);
  return Object.keys(sanitized).length > 0;
}

/**
 * Exposes the human-readable ORDER BY clause for UI clarity (SPEC §11.1, R18).
 */
export function getOrderingLabel(
  table: TableName | string,
  ordering: OrderingToggle,
): string {
  const isPersonal = table.toLowerCase().trim() === TABLE_PERSONAL;
  if (isPersonal) {
    return ordering === "alternate" ? "Nombre (A→Z), Código" : "Código (1→N)";
  }
  return ordering === "alternate" ? "Código (1→N)" : "Nombre (A→Z), Código";
}

export interface UseMaintenanceListOptions<TRow> {
  readonly table: TableName | string;
  readonly repo: RepoReader<TRow>;
  readonly initialOrdering?: OrderingToggle;
  readonly pageSize?: number;
  readonly enabled?: boolean;
}

export interface UseMaintenanceListResult<TRow> {
  readonly rows: readonly TRow[];
  readonly totalCount: number | null;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isPlaceholderData: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly ordering: OrderingToggle;
  readonly orderingLabel: string;
  readonly searchMode: SearchMode;
  readonly simpleTerm: string;
  readonly advancedFilters: AdvancedSearchFilters;
  readonly hasActiveFilters: boolean;
  readonly offset: number;
  readonly limit: number;
  readonly pageIndex: number;
  readonly totalPages: number | null;
  readonly hasPrevPage: boolean;
  readonly hasNextPage: boolean;
  readonly setOrdering: (next: OrderingToggle) => void;
  readonly toggleOrdering: () => void;
  readonly applySimpleSearch: (term: string) => void;
  readonly applyAdvancedSearch: (filters: AdvancedSearchFilters) => void;
  readonly clearSearch: () => void;
  readonly nextPage: () => void;
  readonly prevPage: () => void;
  readonly refetch: () => Promise<unknown>;
}

/**
 * Generic query hook for Maintenance lists, ordering toggle (R18), simple search (§11.2),
 * advanced search (§11.3) and paging (50-row pages). State survives pending ops & Cancelar (§8.5).
 */
export function useMaintenanceList<TRow>({
  table,
  repo,
  initialOrdering = "default",
  pageSize = DEFAULT_PAGE_LIMIT,
  enabled = true,
}: UseMaintenanceListOptions<TRow>): UseMaintenanceListResult<TRow> {
  const [ordering, setOrderingState] =
    React.useState<OrderingToggle>(initialOrdering);
  const [searchMode, setSearchMode] = React.useState<SearchMode>("none");
  const [simpleTerm, setSimpleTerm] = React.useState<string>("");
  const [advancedFilters, setAdvancedFilters] =
    React.useState<AdvancedSearchFilters>({});
  const [offset, setOffset] = React.useState<number>(0);

  const limit = Math.max(1, pageSize);

  const queryKey = React.useMemo(
    () =>
      maintenanceKeys.list(table, {
        ordering,
        searchMode,
        simpleTerm: searchMode === "simple" ? simpleTerm : undefined,
        advancedFilters:
          searchMode === "advanced" ? advancedFilters : undefined,
        offset,
        limit,
      }),
    [table, ordering, searchMode, simpleTerm, advancedFilters, offset, limit],
  );

  const query = useQuery({
    queryKey,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const page = { offset, limit };
      const options: PagingOptions = { countExact: true };

      if (searchMode === "simple") {
        return repo.search(simpleTerm, ordering, page, options);
      }
      if (searchMode === "advanced") {
        return repo.advancedSearch(advancedFilters, ordering, page, options);
      }
      return repo.list(ordering, page, options);
    },
  });

  const rows = query.data?.data ?? [];
  const totalCount = query.data?.count ?? null;

  const pageIndex = Math.floor(offset / limit);
  const totalPages =
    totalCount !== null ? Math.max(1, Math.ceil(totalCount / limit)) : null;

  const hasPrevPage = offset > 0;
  const hasNextPage =
    !query.isPlaceholderData &&
    (totalCount !== null ? offset + limit < totalCount : rows.length >= limit);

  const setOrdering = React.useCallback((next: OrderingToggle) => {
    setOrderingState(next);
    setOffset(0);
  }, []);

  const toggleOrdering = React.useCallback(() => {
    setOrderingState((prev) => (prev === "default" ? "alternate" : "default"));
    setOffset(0);
  }, []);

  const applySimpleSearch = React.useCallback((term: string) => {
    const trimmed = term.trim();
    setAdvancedFilters({});
    setOffset(0);
    if (trimmed.length === 0) {
      setSimpleTerm("");
      setSearchMode("none");
      return;
    }
    setSimpleTerm(trimmed);
    setSearchMode("simple");
  }, []);

  const applyAdvancedSearch = React.useCallback(
    (filters: AdvancedSearchFilters) => {
      const sanitized = sanitizeAdvancedFilters(filters);
      setSimpleTerm("");
      setOffset(0);
      if (!hasActiveAdvancedFilters(sanitized)) {
        setAdvancedFilters({});
        setSearchMode("none");
        return;
      }
      setAdvancedFilters(sanitized);
      setSearchMode("advanced");
    },
    [],
  );

  const clearSearch = React.useCallback(() => {
    setSimpleTerm("");
    setAdvancedFilters({});
    setSearchMode("none");
    setOffset(0);
  }, []);

  const nextPage = React.useCallback(() => {
    setOffset((prev) => prev + limit);
  }, [limit]);

  const prevPage = React.useCallback(() => {
    setOffset((prev) => Math.max(0, prev - limit));
  }, [limit]);

  const orderingLabel = React.useMemo(
    () => getOrderingLabel(table, ordering),
    [table, ordering],
  );

  return {
    rows,
    totalCount,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    isError: query.isError,
    error: query.error,
    ordering,
    orderingLabel,
    searchMode,
    simpleTerm,
    advancedFilters,
    hasActiveFilters: searchMode !== "none",
    offset,
    limit,
    pageIndex,
    totalPages,
    hasPrevPage,
    hasNextPage,
    setOrdering,
    toggleOrdering,
    applySimpleSearch,
    applyAdvancedSearch,
    clearSearch,
    nextPage,
    prevPage,
    refetch: query.refetch,
  };
}
