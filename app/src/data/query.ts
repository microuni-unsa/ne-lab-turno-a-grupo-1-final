/**
 * Maestro de Personal — Data Layer Query Builders
 *
 * SPEC §§7, 9–11, Appendix C.
 * Pure query builders returning unexecuted PostgREST query builders and typed query params.
 * All SQL identifiers quoted CamelCase per spec.
 * Every builder emits explicit order (R18).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";
import {
  DEFAULT_PAGE_LIMIT,
  applyRange,
  getSelectOptions,
  type Page,
  type PagingOptions,
} from "./paging";
import {
  EST_A,
  TABLE_PAIS,
  TABLE_DEPENDENCIA,
  TABLE_CARGO,
  TABLE_PERSONAL,
} from "../core/constants";
import type { TableName } from "../core/types";

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

export interface ExecutableQuery<T = any> extends PromiseLike<{
  data: T[] | null;
  error: any;
  count: number | null;
}> {
  readonly params: QueryDescriptor;
  readonly [key: string]: any;
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
export function getTableOrdering(
  table: TableName | string,
  ordering: OrderingToggle = "default",
): readonly OrderClause[] {
  const norm = normalizeTable(table);
  switch (norm) {
    case "pais":
      if (ordering === "alternate") {
        return [{ column: "PaiCod", ascending: true }];
      }
      return [
        { column: "PaiNom", ascending: true },
        { column: "PaiCod", ascending: true },
      ];
    case "dependencia":
      if (ordering === "alternate") {
        return [{ column: "DepCod", ascending: true }];
      }
      return [
        { column: "DepNom", ascending: true },
        { column: "DepCod", ascending: true },
      ];
    case "cargo":
      if (ordering === "alternate") {
        return [{ column: "CarCod", ascending: true }];
      }
      return [
        { column: "CarNom", ascending: true },
        { column: "CarCod", ascending: true },
      ];
    case "personal":
      if (ordering === "alternate") {
        return [
          { column: "PerNom", ascending: true },
          { column: "PerCod", ascending: true },
        ];
      }
      return [{ column: "PerCod", ascending: true }];
    default:
      throw new Error(`Unsupported table for ordering: ${table}`);
  }
}

/**
 * Applies ordering clauses and paging range to a Postgrest builder.
 */
function attachDescriptor(
  builder: any,
  descriptor: QueryDescriptor,
): ExecutableQuery {
  Object.defineProperty(builder, "params", {
    value: descriptor,
    writable: false,
    enumerable: true,
    configurable: true,
  });
  return builder as ExecutableQuery;
}

/**
 * Applies ordering clauses and paging range to a Postgrest builder.
 */
function applyOrderAndPaging(
  builder: any,
  ordering: readonly OrderClause[],
  page?: Pick<Page, "offset" | "limit">,
): any {
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
export function listQuery(
  table: TableName | string,
  ordering: OrderingToggle = "default",
  page: Pick<Page, "offset" | "limit"> = {
    offset: 0,
    limit: DEFAULT_PAGE_LIMIT,
  },
  options?: PagingOptions,
  client: SupabaseClient = getSupabaseClient(),
): ExecutableQuery {
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
export function simpleSearch(
  table: TableName | string,
  q: string,
  ordering: OrderingToggle = "default",
  page?: Pick<Page, "offset" | "limit">,
  options?: PagingOptions,
  client: SupabaseClient = getSupabaseClient(),
): ExecutableQuery {
  const normTable = normalizeTable(table);
  const orderClauses = getTableOrdering(normTable, ordering);
  const selectOpts = getSelectOptions(options);
  let builder = client.from(normTable).select("*", selectOpts);

  const trimmed = q ? q.trim() : "";

  if (trimmed.length > 0) {
    switch (normTable) {
      case "pais":
        builder = builder.ilike("PaiNom", `%${trimmed}%`);
        break;
      case "dependencia":
        builder = builder.ilike("DepNom", `%${trimmed}%`);
        break;
      case "cargo":
        builder = builder.ilike("CarNom", `%${trimmed}%`);
        break;
      case "personal": {
        const isDigits = /^\d+$/.test(trimmed);
        const parsedCode = isDigits ? parseInt(trimmed, 10) : null;
        if (
          parsedCode !== null &&
          parsedCode > 0 &&
          Number.isSafeInteger(parsedCode)
        ) {
          builder = builder.or(
            `PerNom.ilike.%${trimmed}%,PerDNI.ilike.%${trimmed}%,PerCod.eq.${parsedCode}`,
          );
        } else {
          builder = builder.or(
            `PerNom.ilike.%${trimmed}%,PerDNI.ilike.%${trimmed}%`,
          );
        }
        break;
      }
      default:
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
export function advancedSearch(
  table: TableName | string,
  filters: AdvancedSearchFilters,
  ordering: OrderingToggle = "default",
  page?: Pick<Page, "offset" | "limit">,
  options?: PagingOptions,
  client: SupabaseClient = getSupabaseClient(),
): ExecutableQuery {
  const normTable = normalizeTable(table);
  const orderClauses = getTableOrdering(normTable, ordering);
  const selectOpts = getSelectOptions(options);
  let builder = client.from(normTable).select("*", selectOpts);

  const parseNum = (val: unknown): number | null => {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string" && /^\d+$/.test(val.trim()))
      return parseInt(val.trim(), 10);
    return null;
  };

  const parseStr = (val: unknown): string | null => {
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
    return null;
  };

  const parseEstRegSet = (val: unknown): number[] | null => {
    if (Array.isArray(val)) {
      const nums = val.map(parseNum).filter((n): n is number => n !== null);
      if (nums.length > 0 && nums.length < 3) return nums;
      return null;
    }
    if (typeof val === "number") return [val];
    return null;
  };

  switch (normTable) {
    case "pais": {
      const cod = parseNum(filters.Cod ?? filters.PaiCod);
      if (cod !== null) builder = builder.eq("PaiCod", cod);

      const nom = parseStr(filters.Nom ?? filters.PaiNom);
      if (nom !== null) builder = builder.ilike("PaiNom", `%${nom}%`);

      const est = parseEstRegSet(filters.EstReg ?? filters.PaiEstReg);
      if (est !== null) builder = builder.in("PaiEstReg", est);
      break;
    }

    case "dependencia": {
      const cod = parseNum(filters.Cod ?? filters.DepCod);
      if (cod !== null) builder = builder.eq("DepCod", cod);

      const nom = parseStr(filters.Nom ?? filters.DepNom);
      if (nom !== null) builder = builder.ilike("DepNom", `%${nom}%`);

      const est = parseEstRegSet(filters.EstReg ?? filters.DepEstReg);
      if (est !== null) builder = builder.in("DepEstReg", est);
      break;
    }

    case "cargo": {
      const cod = parseNum(filters.Cod ?? filters.CarCod);
      if (cod !== null) builder = builder.eq("CarCod", cod);

      const nom = parseStr(filters.Nom ?? filters.CarNom);
      if (nom !== null) builder = builder.ilike("CarNom", `%${nom}%`);

      const est = parseEstRegSet(filters.EstReg ?? filters.CarEstReg);
      if (est !== null) builder = builder.in("CarEstReg", est);
      break;
    }

    case "personal": {
      const cod = parseNum(filters.Cod ?? filters.PerCod);
      if (cod !== null) builder = builder.eq("PerCod", cod);

      const nom = parseStr(filters.Nom ?? filters.PerNom);
      if (nom !== null) builder = builder.ilike("PerNom", `%${nom}%`);

      const dni = parseStr(filters.DNI ?? filters.PerDNI);
      if (dni !== null) builder = builder.ilike("PerDNI", `${dni}%`);

      const fecNacFrom = parseStr(
        filters.FecNacFrom ?? filters.from ?? filters.PerFecNacFrom,
      );
      if (fecNacFrom !== null) builder = builder.gte("PerFecNac", fecNacFrom);

      const fecNacTo = parseStr(
        filters.FecNacTo ?? filters.to ?? filters.PerFecNacTo,
      );
      if (fecNacTo !== null) builder = builder.lte("PerFecNac", fecNacTo);

      const paiCod = parseNum(filters.PaiCod ?? filters.PerPaiCod);
      if (paiCod !== null) builder = builder.eq("PerPaiCod", paiCod);

      const depCod = parseNum(filters.DepCod ?? filters.PerDepCod);
      if (depCod !== null) builder = builder.eq("PerDepCod", depCod);

      const carCod = parseNum(filters.CarCod ?? filters.PerCarCod);
      if (carCod !== null) builder = builder.eq("PerCarCod", carCod);

      const est = parseEstRegSet(filters.EstReg ?? filters.PerEstReg);
      if (est !== null) builder = builder.in("PerEstReg", est);
      break;
    }

    default:
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
export function gsel(
  target: "pais" | "dependencia" | "cargo" | TableName | string,
  client: SupabaseClient = getSupabaseClient(),
): ExecutableQuery {
  const normTarget = normalizeTable(target);

  let selectProjection: string;
  let estRegCol: string;
  let nomCol: string;
  let codCol: string;

  switch (normTarget) {
    case "pais":
      selectProjection = '"PaiCod", "PaiNom"';
      estRegCol = "PaiEstReg";
      nomCol = "PaiNom";
      codCol = "PaiCod";
      break;
    case "dependencia":
      selectProjection = '"DepCod", "DepNom"';
      estRegCol = "DepEstReg";
      nomCol = "DepNom";
      codCol = "DepCod";
      break;
    case "cargo":
      selectProjection = '"CarCod", "CarNom"';
      estRegCol = "CarEstReg";
      nomCol = "CarNom";
      codCol = "CarCod";
      break;
    default:
      throw new Error(
        `Invalid G-SEL target table: ${target}. Must be reference table.`,
      );
  }

  const orderClauses: OrderClause[] = [
    { column: nomCol, ascending: true },
    { column: codCol, ascending: true },
  ];

  let builder = client
    .from(normTarget)
    .select(selectProjection)
    .eq(estRegCol, EST_A);

  for (const ord of orderClauses) {
    builder = builder.order(ord.column, { ascending: ord.ascending });
  }

  const descriptor: QueryDescriptor = {
    table: normTarget,
    select: selectProjection,
    order: orderClauses,
  };

  return attachDescriptor(builder, descriptor);
}
