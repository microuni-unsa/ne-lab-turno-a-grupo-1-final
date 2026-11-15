import type { QueryClient } from "@tanstack/react-query";
import type { TableName } from "@/core";
import type { AdvancedSearchFilters, OrderingToggle } from "@/data";

export type SearchMode = "none" | "simple" | "advanced";

export interface MaintenanceListKeyParams {
  readonly ordering: OrderingToggle;
  readonly searchMode: SearchMode;
  readonly simpleTerm?: string;
  readonly advancedFilters?: AdvancedSearchFilters;
  readonly offset: number;
  readonly limit: number;
}

function normalizeTableKey(table: TableName | string): string {
  return table.toLowerCase().trim();
}

function canonicalizeAdvancedFilters(
  filters: AdvancedSearchFilters | undefined,
): Record<string, unknown> | null {
  if (!filters) {
    return null;
  }

  const entries: Array<[string, unknown]> = [];
  for (const key of Object.keys(filters).sort()) {
    const raw: unknown = Object.getOwnPropertyDescriptor(filters, key)?.value;
    if (raw === undefined || raw === null) {
      continue;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        entries.push([key, trimmed]);
      }
      continue;
    }
    if (Array.isArray(raw)) {
      const sorted = raw
        .filter((item): item is number => typeof item === "number")
        .sort((a, b) => a - b);
      if (sorted.length > 0) {
        entries.push([key, sorted]);
      }
      continue;
    }
    entries.push([key, raw]);
  }

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function canonicalizeListParams(params: MaintenanceListKeyParams) {
  return {
    ordering: params.ordering,
    searchMode: params.searchMode,
    simpleTerm: params.simpleTerm ? params.simpleTerm.trim() : "",
    advancedFilters: canonicalizeAdvancedFilters(params.advancedFilters),
    offset: params.offset,
    limit: params.limit,
  } as const;
}

/**
 * Deterministic React Query cache key registry per table.
 * Cleanly isolates paged lists (`"list"`) from Activo-only FK selections (`"gsel"`).
 */
export const maintenanceKeys = {
  all: ["maintenance"] as const,
  table: (table: TableName | string) =>
    ["maintenance", normalizeTableKey(table)] as const,
  lists: (table: TableName | string) =>
    ["maintenance", normalizeTableKey(table), "list"] as const,
  list: (table: TableName | string, params: MaintenanceListKeyParams) =>
    [
      "maintenance",
      normalizeTableKey(table),
      "list",
      canonicalizeListParams(params),
    ] as const,
  gsel: (table: TableName | string) =>
    ["maintenance", normalizeTableKey(table), "gsel"] as const,
} as const;

/**
 * Invalidates both the main listing queries and any G-SEL dropdown queries for a table.
 */
export async function invalidateTableQueries(
  queryClient: QueryClient,
  table: TableName | string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists(table) }),
    queryClient.invalidateQueries({ queryKey: maintenanceKeys.gsel(table) }),
  ]);
}
