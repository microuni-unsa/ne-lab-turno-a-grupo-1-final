/**
 * Maestro de Personal — Data Layer Query Builders
 *
 * SPEC §§7, 9–11, Appendix C.
 * Pure query builders returning unexecuted PostgREST query builders and typed query params.
 * All SQL identifiers quoted CamelCase per spec.
 * Every builder emits explicit order (R18).
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  EST_A,
  EST_I,
  EST_X,
  MAX_INTEGER,
  MAX_SMALLINT,
  MIN_CODE,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
  TABLE_PERSONAL,
} from "@/core/constants";
import type { TableName } from "@/core/types";
import { getSupabaseClient } from "@/data/client";
import {
  applyRange,
  DEFAULT_PAGE_LIMIT,
  getSelectOptions,
  type Page,
  type PagingOptions,
} from "@/data/paging";

export type OrderingToggle = "default" | "alternate";

export interface OrderClause {
  readonly column: string;
  readonly ascending: boolean;
}

export interface QueryDescriptor {
  readonly table: string;
  readonly select: string;
  readonly order: readonly OrderClause[];
  readonly range?: { readonly from: number; readonly to: number };
  readonly filters?: Record<string, unknown>;
  readonly filterDescription?: string;
}

export interface ExecutableQuery<T = unknown>
  extends PromiseLike<{
    data: T[] | null;
    error: PostgrestError | null;
    count: number | null;
  }> {
  readonly params: QueryDescriptor;
  readonly [key: string]: unknown;
}

/**
 * Normalizes table name into canonical lowercase string.
 */
function normalizeTable(table: TableName | string): string {
  const norm = table.toLowerCase().trim();
  switch (norm) {
    case "pais":
    case TABLE_PAIS:
      return "pais";
    case "dependencia":
    case TABLE_DEPENDENCIA:
      return "dependencia";
    case "cargo":
    case TABLE_CARGO:
      return "cargo";
    case "personal":
    case TABLE_PERSONAL:
      return "personal";
    default:
      throw new Error(`Unsupported table name: ${table}`);
  }
}

/**
 * Returns explicit ORDER BY clauses for a table per SPEC §11.1.
 * Mandatory on all list queries (R18).
 */
interface ReferenceTableQueryMeta {
  readonly codeCol: "PaiCod" | "DepCod" | "CarCod";
  readonly nomCol: "PaiNom" | "DepNom" | "CarNom";
  readonly estRegCol: "PaiEstReg" | "DepEstReg" | "CarEstReg";
  readonly gselProjection: string;
}

const REFERENCE_QUERY_META: Readonly<
  Record<"pais" | "dependencia" | "cargo", ReferenceTableQueryMeta>
> = {
  pais: {
    codeCol: "PaiCod",
    nomCol: "PaiNom",
    estRegCol: "PaiEstReg",
    gselProjection: '"PaiCod", "PaiNom"',
  },
  dependencia: {
    codeCol: "DepCod",
    nomCol: "DepNom",
    estRegCol: "DepEstReg",
    gselProjection: '"DepCod", "DepNom"',
  },
  cargo: {
    codeCol: "CarCod",
    nomCol: "CarNom",
    estRegCol: "CarEstReg",
    gselProjection: '"CarCod", "CarNom"',
  },
};

function isReferenceQueryTable(
  table: string,
): table is "pais" | "dependencia" | "cargo" {
  return table === "pais" || table === "dependencia" || table === "cargo";
}

/**
 * Escapes LIKE/ILIKE wildcard characters (`\`, `%`, `_`) so user input is matched literally.
 */
export function escapeIlikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function formatOrIlikeTerm(column: string, pattern: string): string {
  if (/[,()"\\]/.test(pattern)) {
    const escaped = pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `${column}.ilike."${escaped}"`;
  }
  return `${column}.ilike.${pattern}`;
}

export function getTableOrdering(
  table: TableName | string,
  ordering: OrderingToggle = "default",
): readonly OrderClause[] {
  const norm = normalizeTable(table);
  if (isReferenceQueryTable(norm)) {
    const meta = REFERENCE_QUERY_META[norm];
    if (ordering === "alternate") {
      return [{ column: meta.codeCol, ascending: true }];
    }
    return [
      { column: meta.nomCol, ascending: true },
      { column: meta.codeCol, ascending: true },
    ];
  }
  if (norm === "personal") {
    if (ordering === "alternate") {
      return [
        { column: "PerNom", ascending: true },
        { column: "PerCod", ascending: true },
      ];
    }
    return [{ column: "PerCod", ascending: true }];
  }
  throw new Error(`Unsupported table for ordering: ${table}`);
}

/**
 * Type guard verifying that a PostgREST builder exposes both `.params` and `.then`.
 */
function isExecutableQuery<T>(value: object): value is ExecutableQuery<T> {
  return "params" in value && "then" in value;
}

function attachDescriptor<T = unknown>(
  builder: object,
  descriptor: QueryDescriptor,
): ExecutableQuery<T> {
  Object.defineProperty(builder, "params", {
    value: descriptor,
    writable: false,
    enumerable: true,
    configurable: true,
  });
  if (!isExecutableQuery<T>(builder)) {
    throw new Error("PostgREST query builder missing params/then contract");
  }
  return builder;
}

interface ChainablePostgrestBuilder<T> {
  order(column: string, options: { ascending: boolean }): T;
  range(from: number, to: number): T;
}

/**
 * Applies ordering clauses and paging range to a Postgrest builder.
 */
function applyOrderAndPaging<T extends ChainablePostgrestBuilder<T>>(
  builder: T,
  ordering: readonly OrderClause[],
  page?: Pick<Page, "offset" | "limit">,
): T {
  let chained = builder;
  for (const ord of ordering) {
    chained = chained.order(ord.column, { ascending: ord.ascending });
  }
  if (page) {
    chained = applyRange(chained, page);
  }
  return chained;
}

/**
 * Builds a list query returning an unexecuted PostgREST builder (§11.1).
 * Default ordering with toggle in scope. Emits explicit order (R18).
 */
export function listQuery<TRow = unknown>(
  table: TableName | string,
  ordering: OrderingToggle = "default",
  page: Pick<Page, "offset" | "limit"> = {
    offset: 0,
    limit: DEFAULT_PAGE_LIMIT,
  },
  options?: PagingOptions,
  client: SupabaseClient = getSupabaseClient(),
): ExecutableQuery<TRow> {
  const normTable = normalizeTable(table);
  const orderClauses = getTableOrdering(normTable, ordering);

  const selectOpts = getSelectOptions(options);
  let builder = client.from(normTable).select("*", selectOpts);
  builder = applyOrderAndPaging(builder, orderClauses, page);

  const descriptor: QueryDescriptor = {
    table: normTable,
    select: "*",
    order: orderClauses,
    range: { from: page.offset, to: page.offset + page.limit - 1 },
  };

  return attachDescriptor(builder, descriptor);
}

/**
 * Builds a simple search query returning an unexecuted PostgREST builder (§11.2).
 * Single input string; case-insensitive, accent-sensitive contains match.
 * Empty input returns unfiltered list with active ordering.
 * Personal: PerNom ILIKE contains OR PerDNI contains OR PerCod exact-on-integer-parse.
 */
export function simpleSearch<TRow = unknown>(
  table: TableName | string,
  q: string,
  ordering: OrderingToggle = "default",
  page?: Pick<Page, "offset" | "limit">,
  options?: PagingOptions,
  client: SupabaseClient = getSupabaseClient(),
): ExecutableQuery<TRow> {
  const normTable = normalizeTable(table);
  const orderClauses = getTableOrdering(normTable, ordering);
  const selectOpts = getSelectOptions(options);
  let builder = client.from(normTable).select("*", selectOpts);

  const trimmed = q ? q.trim() : "";

  if (trimmed.length > 0) {
    const escapedTerm = escapeIlikeLiteral(trimmed);
    if (isReferenceQueryTable(normTable)) {
      const meta = REFERENCE_QUERY_META[normTable];
      builder = builder.ilike(meta.nomCol, `%${escapedTerm}%`);
    } else if (normTable === "personal") {
      const isDigits = /^\d+$/.test(trimmed);
      const parsedCode = isDigits ? parseInt(trimmed, 10) : null;
      const nomTerm = formatOrIlikeTerm("PerNom", `%${escapedTerm}%`);
      const dniTerm = formatOrIlikeTerm("PerDNI", `%${escapedTerm}%`);
      if (
        parsedCode !== null &&
        Number.isSafeInteger(parsedCode) &&
        parsedCode >= MIN_CODE &&
        parsedCode <= MAX_INTEGER
      ) {
        builder = builder.or(`${nomTerm},${dniTerm},PerCod.eq.${parsedCode}`);
      } else {
        builder = builder.or(`${nomTerm},${dniTerm}`);
      }
    } else {
      throw new Error(`Unsupported table for simple search: ${table}`);
    }
  }

  builder = applyOrderAndPaging(builder, orderClauses, page);

  const descriptor: QueryDescriptor = {
    table: normTable,
    select: "*",
    order: orderClauses,
    range: page
      ? { from: page.offset, to: page.offset + page.limit - 1 }
      : undefined,
    filterDescription:
      trimmed.length > 0 ? `simpleSearch:${trimmed}` : undefined,
  };

  return attachDescriptor(builder, descriptor);
}

export interface AdvancedSearchFilters {
  readonly Cod?: number | string;
  readonly Nom?: string;
  readonly EstReg?: readonly number[] | number;

  readonly PerCod?: number | string;
  readonly PerNom?: string;
  readonly PerDNI?: string;
  readonly DNI?: string;
  readonly FecNacFrom?: string;
  readonly FecNacTo?: string;
  readonly from?: string;
  readonly to?: string;
  readonly PaiCod?: number | string;
  readonly PerPaiCod?: number | string;
  readonly DepCod?: number | string;
  readonly PerDepCod?: number | string;
  readonly CarCod?: number | string;
  readonly PerCarCod?: number | string;
  readonly PerEstReg?: readonly number[] | number;

  readonly [key: string]: unknown;
}

/**
 * Builds an advanced search query returning an unexecuted PostgREST builder (§11.3).
 * AND-combined; empty/unknown criteria ignored (R20). EstReg-set default all.
 * Emits explicit order (R18).
 */
export function advancedSearch<TRow = unknown>(
  table: TableName | string,
  filters: AdvancedSearchFilters,
  ordering: OrderingToggle = "default",
  page?: Pick<Page, "offset" | "limit">,
  options?: PagingOptions,
  client: SupabaseClient = getSupabaseClient(),
): ExecutableQuery<TRow> {
  const normTable = normalizeTable(table);
  const orderClauses = getTableOrdering(normTable, ordering);
  const selectOpts = getSelectOptions(options);
  let builder = client.from(normTable).select("*", selectOpts);

  const parseCodeFilter = (val: unknown, maxLimit: number): number | null => {
    let num: number | null = null;
    if (typeof val === "number" && Number.isInteger(val)) {
      num = val;
    } else if (typeof val === "string" && /^\d+$/.test(val.trim())) {
      num = parseInt(val.trim(), 10);
    }
    if (
      num !== null &&
      Number.isSafeInteger(num) &&
      num >= MIN_CODE &&
      num <= maxLimit
    ) {
      return num;
    }
    return null;
  };

  const parseStr = (val: unknown): string | null => {
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
    return null;
  };

  const parseEstRegSet = (val: unknown): number[] | null => {
    const parseEstItem = (item: unknown): number | null => {
      const n =
        typeof item === "number"
          ? item
          : typeof item === "string" && /^\d+$/.test(item.trim())
            ? parseInt(item.trim(), 10)
            : null;
      return n === EST_A || n === EST_I || n === EST_X ? n : null;
    };
    if (Array.isArray(val)) {
      const unique = Array.from(
        new Set(val.map(parseEstItem).filter((n): n is number => n !== null)),
      );
      if (unique.length > 0 && unique.length < 3) return unique;
      return null;
    }
    const single = parseEstItem(val);
    if (single !== null) return [single];
    return null;
  };

  if (isReferenceQueryTable(normTable)) {
    const meta = REFERENCE_QUERY_META[normTable];
    const cod = parseCodeFilter(
      filters.Cod ?? filters[meta.codeCol],
      MAX_SMALLINT,
    );
    if (cod !== null) builder = builder.eq(meta.codeCol, cod);

    const nom = parseStr(filters.Nom ?? filters[meta.nomCol]);
    if (nom !== null) {
      builder = builder.ilike(meta.nomCol, `%${escapeIlikeLiteral(nom)}%`);
    }

    const est = parseEstRegSet(filters.EstReg ?? filters[meta.estRegCol]);
    if (est !== null) builder = builder.in(meta.estRegCol, est);
  } else if (normTable === "personal") {
    const cod = parseCodeFilter(filters.Cod ?? filters.PerCod, MAX_INTEGER);
    if (cod !== null) builder = builder.eq("PerCod", cod);

    const nom = parseStr(filters.Nom ?? filters.PerNom);
    if (nom !== null) {
      builder = builder.ilike("PerNom", `%${escapeIlikeLiteral(nom)}%`);
    }

    const dni = parseStr(filters.DNI ?? filters.PerDNI);
    if (dni !== null) {
      builder = builder.ilike("PerDNI", `${escapeIlikeLiteral(dni)}%`);
    }

    const fecNacFrom = parseStr(
      filters.FecNacFrom ?? filters.from ?? filters.PerFecNacFrom,
    );
    if (fecNacFrom !== null) builder = builder.gte("PerFecNac", fecNacFrom);

    const fecNacTo = parseStr(
      filters.FecNacTo ?? filters.to ?? filters.PerFecNacTo,
    );
    if (fecNacTo !== null) builder = builder.lte("PerFecNac", fecNacTo);

    const paiCod = parseCodeFilter(
      filters.PaiCod ?? filters.PerPaiCod,
      MAX_SMALLINT,
    );
    if (paiCod !== null) builder = builder.eq("PerPaiCod", paiCod);

    const depCod = parseCodeFilter(
      filters.DepCod ?? filters.PerDepCod,
      MAX_SMALLINT,
    );
    if (depCod !== null) builder = builder.eq("PerDepCod", depCod);

    const carCod = parseCodeFilter(
      filters.CarCod ?? filters.PerCarCod,
      MAX_SMALLINT,
    );
    if (carCod !== null) builder = builder.eq("PerCarCod", carCod);

    const est = parseEstRegSet(filters.EstReg ?? filters.PerEstReg);
    if (est !== null) builder = builder.in("PerEstReg", est);
  } else {
    throw new Error(`Unsupported table for advanced search: ${table}`);
  }

  builder = applyOrderAndPaging(builder, orderClauses, page);

  const descriptor: QueryDescriptor = {
    table: normTable,
    select: "*",
    order: orderClauses,
    range: page
      ? { from: page.offset, to: page.offset + page.limit - 1 }
      : undefined,
    filters,
  };

  return attachDescriptor(builder, descriptor);
}

/**
 * Builds a generic selection query (G-SEL; SPEC §9).
 * Activo-only (EstReg = 1), Nom ASC, Cod ASC tiebreak, Cod + Nom projection.
 */
export function gsel<TRow = unknown>(
  target: "pais" | "dependencia" | "cargo" | TableName | string,
  client: SupabaseClient = getSupabaseClient(),
): ExecutableQuery<TRow> {
  const normTarget = normalizeTable(target);

  if (!isReferenceQueryTable(normTarget)) {
    throw new Error(
      `Invalid G-SEL target table: ${target}. Must be reference table.`,
    );
  }
  const meta = REFERENCE_QUERY_META[normTarget];

  const orderClauses: OrderClause[] = [
    { column: meta.nomCol, ascending: true },
    { column: meta.codeCol, ascending: true },
  ];

  let builder = client
    .from(normTarget)
    .select(meta.gselProjection)
    .eq(meta.estRegCol, EST_A);

  for (const ord of orderClauses) {
    builder = builder.order(ord.column, { ascending: ord.ascending });
  }

  const descriptor: QueryDescriptor = {
    table: normTarget,
    select: meta.gselProjection,
    order: orderClauses,
  };

  return attachDescriptor(builder, descriptor);
}
