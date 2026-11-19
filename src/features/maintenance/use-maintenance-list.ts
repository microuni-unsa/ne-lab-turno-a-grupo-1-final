import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
  EST_A,
  EST_I,
  EST_X,
  type EstReg,
  MAX_CODE_LEN,
  TABLE_PERSONAL,
  type TableName,
} from "@/core";
import {
  type AdvancedSearchFilters,
  DEFAULT_PAGE_LIMIT,
  getDefaultSortSpec,
  getTableSortableColumns,
  type OrderingSpec,
  type OrderingToggle,
  type PagingOptions,
  type SortableColumnOption,
  type SortDirection,
  type TableSortSpec,
  type ViewScope,
} from "@/data";
import {
  maintenanceKeys,
  type SearchMode,
} from "@/features/maintenance/query-keys";

export const ALL_ESTREG_STATES = [EST_A, EST_I, EST_X] as const;

export interface RepoReader<TRow> {
  readonly list: (
    ordering?: OrderingSpec,
    page?: { readonly offset: number; readonly limit: number },
    options?: PagingOptions,
    viewScope?: ViewScope,
  ) => Promise<{
    readonly data: readonly TRow[];
    readonly count: number | null;
  }>;
  readonly search: (
    q: string,
    ordering?: OrderingSpec,
    page?: { readonly offset: number; readonly limit: number },
    options?: PagingOptions,
    viewScope?: ViewScope,
  ) => Promise<{
    readonly data: readonly TRow[];
    readonly count: number | null;
  }>;
  readonly advancedSearch: (
    filters: AdvancedSearchFilters,
    ordering?: OrderingSpec,
    page?: { readonly offset: number; readonly limit: number },
    options?: PagingOptions,
    viewScope?: ViewScope,
  ) => Promise<{
    readonly data: readonly TRow[];
    readonly count: number | null;
  }>;
  readonly getAvailableEstRegs?: () => Promise<EstReg[]>;
}

export interface AdvancedFilterDraft {
  readonly codText: string;
  readonly nomText: string;
  readonly estReg: readonly EstReg[];
  readonly dniText: string;
  readonly fecNacFrom: string;
  readonly fecNacTo: string;
  readonly paiCod: string | undefined;
  readonly depCod: string | undefined;
  readonly carCod: string | undefined;
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
 * Parses a code filter string safely without integer coercion.
 */
export function parsePositiveCodeFilter(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length <= MAX_CODE_LEN) {
      return trimmed;
    }
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
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
  const codStr = parsePositiveCodeFilter(sanitized.Cod);
  const estReg = normalizeEstRegSubset(sanitized.EstReg);

  return {
    codText: codStr ?? "",
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
  readonly sortSpec: TableSortSpec;
  readonly sortableColumns: readonly SortableColumnOption[];
  readonly viewScope: ViewScope;
  readonly availableEstRegs: readonly EstReg[];
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
  readonly setSortColumn: (column: string) => void;
  readonly setSortDirection: (direction: SortDirection) => void;
  readonly toggleSortDirection: () => void;
  readonly toggleViewScope: () => void;
  readonly applySimpleSearch: (term: string) => void;
  readonly applyAdvancedSearch: (filters: AdvancedSearchFilters) => void;
  readonly clearSearch: () => void;
  readonly nextPage: () => void;
  readonly prevPage: () => void;
  readonly refetch: () => Promise<unknown>;
}

/**
 * Generic query hook for Maintenance lists, all-column ASC/DESC sorting,
 * main/deleted view scope toggle, simple/advanced search, and paging.
 */
export function useMaintenanceList<TRow>({
  table,
  repo,
  initialOrdering = "default",
  pageSize = DEFAULT_PAGE_LIMIT,
  enabled = true,
}: UseMaintenanceListOptions<TRow>): UseMaintenanceListResult<TRow> {
  const sortableColumns = React.useMemo(
    () => getTableSortableColumns(table),
    [table],
  );
  const defaultSort = React.useMemo(() => {
    const base = getDefaultSortSpec(table);
    if (initialOrdering === "alternate") {
      const alt = sortableColumns.find((col) => col.column !== base.column);
      return alt ? { column: alt.column, direction: "asc" as const } : base;
    }
    return base;
  }, [initialOrdering, sortableColumns, table]);

  const [ordering, setOrderingState] =
    React.useState<OrderingToggle>(initialOrdering);
  const [sortSpec, setSortSpec] = React.useState<TableSortSpec>(defaultSort);
  const [viewScope, setViewScope] = React.useState<ViewScope>("main");
  const [searchMode, setSearchMode] = React.useState<SearchMode>("none");
  const [simpleTerm, setSimpleTerm] = React.useState<string>("");
  const [advancedFilters, setAdvancedFilters] =
    React.useState<AdvancedSearchFilters>({});
  const [offset, setOffset] = React.useState<number>(0);

  const limit = Math.max(1, pageSize);

  const activeOrdering: OrderingSpec = sortSpec;

  const queryKey = React.useMemo(
    () =>
      maintenanceKeys.list(table, {
        ordering: activeOrdering,
        viewScope,
        searchMode,
        simpleTerm: searchMode === "simple" ? simpleTerm : undefined,
        advancedFilters:
          searchMode === "advanced" ? advancedFilters : undefined,
        offset,
        limit,
      }),
    [
      table,
      activeOrdering,
      viewScope,
      searchMode,
      simpleTerm,
      advancedFilters,
      offset,
      limit,
    ],
  );

  const query = useQuery({
    queryKey,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const page = { offset, limit };
      const options: PagingOptions = { countExact: true };

      if (searchMode === "simple") {
        return repo.search(
          simpleTerm,
          activeOrdering,
          page,
          options,
          viewScope,
        );
      }
      if (searchMode === "advanced") {
        return repo.advancedSearch(
          advancedFilters,
          activeOrdering,
          page,
          options,
          viewScope,
        );
      }
      return repo.list(activeOrdering, page, options, viewScope);
    },
  });

  const rows = query.data?.data ?? [];
  const totalCount = query.data?.count ?? null;

  const estRegQuery = useQuery({
    queryKey: [...maintenanceKeys.lists(table), "available-estreg"],
    enabled: enabled && Boolean(repo.getAvailableEstRegs),
    queryFn: async () => {
      if (!repo.getAvailableEstRegs) {
        return [...ALL_ESTREG_STATES];
      }
      return repo.getAvailableEstRegs();
    },
  });

  const availableEstRegs = React.useMemo<readonly EstReg[]>(() => {
    if (estRegQuery.data && estRegQuery.data.length > 0) {
      return estRegQuery.data;
    }
    const fromRows = new Set<EstReg>();
    for (const row of rows) {
      if (typeof row === "object" && row !== null) {
        const rec = row as Record<string, unknown>;
        const est =
          rec.PaiEstReg ?? rec.DepEstReg ?? rec.CarEstReg ?? rec.PerEstReg;
        if (isEstReg(est)) {
          fromRows.add(est);
        }
      }
    }
    if (fromRows.size > 0) {
      return ALL_ESTREG_STATES.filter((s) => fromRows.has(s));
    }
    return ALL_ESTREG_STATES;
  }, [estRegQuery.data, rows]);

  const pageIndex = Math.floor(offset / limit);
  const totalPages =
    totalCount !== null ? Math.max(1, Math.ceil(totalCount / limit)) : null;

  const hasPrevPage = offset > 0;
  const hasNextPage =
    !query.isPlaceholderData &&
    (totalCount !== null ? offset + limit < totalCount : rows.length >= limit);

  const setOrdering = React.useCallback(
    (next: OrderingToggle) => {
      setOrderingState(next);
      if (next === "default") {
        setSortSpec(getDefaultSortSpec(table));
      } else {
        const base = getDefaultSortSpec(table);
        const alt = sortableColumns.find((col) => col.column !== base.column);
        setSortSpec(alt ? { column: alt.column, direction: "asc" } : base);
      }
      setOffset(0);
    },
    [sortableColumns, table],
  );

  const toggleOrdering = React.useCallback(() => {
    setOrderingState((prev) => {
      const next = prev === "default" ? "alternate" : "default";
      if (next === "default") {
        setSortSpec(getDefaultSortSpec(table));
      } else {
        const base = getDefaultSortSpec(table);
        const alt = sortableColumns.find((col) => col.column !== base.column);
        setSortSpec(alt ? { column: alt.column, direction: "asc" } : base);
      }
      return next;
    });
    setOffset(0);
  }, [sortableColumns, table]);

  const setSortColumn = React.useCallback((column: string) => {
    setSortSpec((prev) => ({ ...prev, column }));
    setOffset(0);
  }, []);

  const setSortDirection = React.useCallback((direction: SortDirection) => {
    setSortSpec((prev) => ({ ...prev, direction }));
    setOffset(0);
  }, []);

  const toggleSortDirection = React.useCallback(() => {
    setSortSpec((prev) => ({
      ...prev,
      direction: prev.direction === "asc" ? "desc" : "asc",
    }));
    setOffset(0);
  }, []);

  const toggleViewScope = React.useCallback(() => {
    setViewScope((prev) => (prev === "main" ? "deleted" : "main"));
    setSimpleTerm("");
    setAdvancedFilters({});
    setSearchMode("none");
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

  const orderingLabel = React.useMemo(() => {
    const colLabel =
      sortableColumns.find((c) => c.column === sortSpec.column)?.label ??
      sortSpec.column;
    const dirLabel = sortSpec.direction === "asc" ? "ASC" : "DESC";
    return `${colLabel} (${dirLabel})`;
  }, [sortSpec.column, sortSpec.direction, sortableColumns]);

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
    sortSpec,
    sortableColumns,
    viewScope,
    availableEstRegs,
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
    setSortColumn,
    setSortDirection,
    toggleSortDirection,
    toggleViewScope,
    applySimpleSearch,
    applyAdvancedSearch,
    clearSearch,
    nextPage,
    prevPage,
    refetch: query.refetch,
  };
}
