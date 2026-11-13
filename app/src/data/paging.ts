/**
 * Maestro de Personal — Data Layer Paging
 *
 * SPEC §11, Decision: Server-side paged lists.
 * Single source of truth for pagination contracts and default page limit.
 */

export interface Page {
  readonly offset: number;
  readonly limit: number;
  readonly total?: number;
}

/**
 * Default page size limit across all data queries (§11 Decision).
 * Single source of truth; surfaces may override per call.
 */
export const DEFAULT_PAGE_LIMIT = 50 as const;

export interface PagingOptions {
  readonly countExact?: boolean;
}

/**
 * Validates and normalizes page boundaries.
 * Fails fast on invalid inputs (R22, zero fallbacks).
 */
export function validatePageBoundaries(page: {
  offset: number;
  limit: number;
}): void {
  if (!Number.isSafeInteger(page.offset) || page.offset < 0) {
    throw new Error(
      `Page offset must be a non-negative integer, got ${page.offset}`,
    );
  }
  if (!Number.isSafeInteger(page.limit) || page.limit <= 0) {
    throw new Error(`Page limit must be a positive integer, got ${page.limit}`);
  }
}

/**
 * Applies .range(from, to) to any PostgREST query builder.
 * PostgREST range bounds are 0-indexed inclusive:
 * from = offset, to = offset + limit - 1.
 */
export function applyRange<
  T extends { range: (from: number, to: number) => T },
>(builder: T, page: Pick<Page, "offset" | "limit">): T {
  validatePageBoundaries(page);
  const from = page.offset;
  const to = page.offset + page.limit - 1;
  return builder.range(from, to);
}

/**
 * Applies pagination defaults and range bounds to a query builder.
 */
export function applyPaging<
  T extends { range: (from: number, to: number) => T },
>(builder: T, page?: Partial<Pick<Page, "offset" | "limit">>): T {
  const offset = page?.offset ?? 0;
  const limit = page?.limit ?? DEFAULT_PAGE_LIMIT;
  return applyRange(builder, { offset, limit });
}

/**
 * Helper to resolve select options with optional count = 'exact'.
 */
export function getSelectOptions(options?: { countExact?: boolean }): {
  count?: "exact";
} {
  if (options?.countExact) {
    return { count: "exact" };
  }
  return {};
}
