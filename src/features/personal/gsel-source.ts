import type { QuerySource, SelectOption } from "@microx-technologies/microform";
import type { QueryClient } from "@tanstack/react-query";
import { EST_A, EST_I, EST_X, type MaintenanceTable } from "@/core";
import { maintenanceKeys } from "@/features/maintenance/query-keys";

export interface GselRepoContract<TRow> {
  gsel(): Promise<ReadonlyArray<{ readonly [key: string]: unknown }>>;
  getByCode(code: number): Promise<TRow | null>;
  list?(
    ordering?: "default" | "alternate",
    page?: { readonly offset: number; readonly limit: number },
  ): Promise<{ readonly data: readonly TRow[]; readonly count: number | null }>;
}

export interface GselSourceConfig<TRow> {
  readonly table: MaintenanceTable;
  readonly repo: Pick<GselRepoContract<TRow>, "gsel" | "list">;
  readonly codeCol: string;
  readonly nomCol: string;
  readonly estCol?: string;
  readonly queryClient?: QueryClient;
  readonly pageSize?: number;
  readonly includeAllStates?: boolean;
}

export interface GselLabelResolverConfig<TRow> {
  readonly table: MaintenanceTable;
  readonly repo: GselRepoContract<TRow>;
  readonly codeCol: string;
  readonly nomCol: string;
  readonly estCol: string;
  readonly queryClient?: QueryClient;
}

export interface GselBinding<TRow> {
  readonly table: MaintenanceTable;
  readonly repo: GselRepoContract<TRow>;
  readonly codeCol: string;
  readonly nomCol: string;
  readonly estCol: string;
  readonly asyncSource: QuerySource<SelectOption>;
  readonly resolveLabel: (
    value: string | number,
  ) => Promise<string | undefined>;
}

interface NormalizedGselEntry {
  readonly cod: number;
  readonly nom: string;
}

function readPositiveInt(obj: object, key: string): number | null {
  const raw: unknown = Reflect.get(obj, key);
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    return null;
  }
  return raw;
}

function readTrimmedString(obj: object, key: string): string | null {
  const raw: unknown = Reflect.get(obj, key);
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStateSuffix(est: unknown): string {
  if (est === EST_I) {
    return " (Inactivo)";
  }
  if (est === EST_X) {
    return " (Eliminado)";
  }
  return "";
}

async function fetchRawGselRows<TRow>(
  table: MaintenanceTable,
  repo: Pick<GselRepoContract<TRow>, "gsel" | "list">,
  queryClient?: QueryClient,
  includeAllStates: boolean = false,
): Promise<ReadonlyArray<object>> {
  if (includeAllStates && repo.list) {
    const fetchAll = async (): Promise<ReadonlyArray<object>> => {
      const res = await repo.list?.("default", { offset: 0, limit: 500 });
      const rows: ReadonlyArray<unknown> = res?.data ?? [];
      return rows.filter(
        (item): item is object => typeof item === "object" && item !== null,
      );
    };
    if (!queryClient) {
      return fetchAll();
    }
    return queryClient.fetchQuery({
      queryKey: [...maintenanceKeys.lists(table), "catalog-all"],
      queryFn: fetchAll,
      staleTime: 30_000,
    });
  }
  if (!queryClient) {
    return repo.gsel();
  }
  return queryClient.fetchQuery({
    queryKey: maintenanceKeys.gsel(table),
    queryFn: () => repo.gsel(),
    staleTime: 30_000,
  });
}

function extractSortedGselEntries(
  rawRows: ReadonlyArray<object>,
  codeCol: string,
  nomCol: string,
  estCol?: string,
  includeAllStates: boolean = false,
): NormalizedGselEntry[] {
  const entries: NormalizedGselEntry[] = [];

  for (const row of rawRows) {
    if (typeof row !== "object" || row === null) {
      continue;
    }
    const est: unknown = estCol ? Reflect.get(row, estCol) : undefined;
    if (!includeAllStates && estCol && est !== undefined && est !== EST_A) {
      continue;
    }
    const cod = readPositiveInt(row, codeCol);
    const nom = readTrimmedString(row, nomCol);
    if (cod === null || nom === null) {
      continue;
    }
    const suffix = includeAllStates ? readStateSuffix(est) : "";
    entries.push({ cod, nom: `${nom}${suffix}` });
  }

  entries.sort((a, b) => {
    const byNom = a.nom.localeCompare(b.nom, "es", { sensitivity: "case" });
    if (byNom !== 0) {
      return byNom;
    }
    return a.cod - b.cod;
  });

  return entries;
}

/**
 * Generic `G-SEL` QuerySource factory (`SPEC §9`).
 * Queries only active (`EstReg = A`) rows sorted deterministically `Nom ASC, Cod ASC`,
 * filters client-side preserving alphabetical order, and returns `{ items: [], total: 0 }`
 * cleanly when the catalog is empty.
 */
export function createGselQuerySource<TRow>(
  config: GselSourceConfig<TRow>,
): QuerySource<SelectOption> {
  const defaultPageSize = config.pageSize ?? 100;
  const includeAllStates = Boolean(config.includeAllStates);

  return {
    pageSize: defaultPageSize,
    async fetch({ search = "", page = 1, pageSize = defaultPageSize }) {
      const rawRows = await fetchRawGselRows(
        config.table,
        config.repo,
        config.queryClient,
        includeAllStates,
      );
      const sorted = extractSortedGselEntries(
        rawRows,
        config.codeCol,
        config.nomCol,
        config.estCol,
        includeAllStates,
      );

      const term = search.trim().toLowerCase();
      const filtered = term
        ? sorted.filter((entry) => entry.nom.toLowerCase().includes(term))
        : sorted;

      const safePage = Math.max(1, page);
      const safeSize = Math.max(1, pageSize);
      const start = (safePage - 1) * safeSize;
      const sliced = filtered.slice(start, start + safeSize);

      return {
        items: sliced.map((entry) => ({
          key: String(entry.cod),
          value: String(entry.cod),
          label: entry.nom,
        })),
        total: filtered.length,
      };
    },
  };
}

/**
 * Resolves a human-readable FK label for `Modificación` (including `R7` where a
 * previously linked reference row was later Inactivated or Eliminated).
 */
export function createGselLabelResolver<TRow>(
  config: GselLabelResolverConfig<TRow>,
): (value: string | number) => Promise<string | undefined> {
  return async (value: string | number): Promise<string | undefined> => {
    const code = Number(value);
    if (!Number.isInteger(code) || code <= 0) {
      return undefined;
    }

    const rawActive = await fetchRawGselRows(
      config.table,
      config.repo,
      config.queryClient,
    );
    const activeEntries = extractSortedGselEntries(
      rawActive,
      config.codeCol,
      config.nomCol,
      config.estCol,
    );
    const activeMatch = activeEntries.find((entry) => entry.cod === code);
    if (activeMatch) {
      return activeMatch.nom;
    }

    const row = await config.repo.getByCode(code);
    if (typeof row !== "object" || row === null) {
      return undefined;
    }
    const nom = readTrimmedString(row, config.nomCol);
    if (!nom) {
      return undefined;
    }
    const est: unknown = Reflect.get(row, config.estCol);
    if (est === EST_A) {
      return nom;
    }
    return `${nom}${readStateSuffix(est)}`;
  };
}

/**
 * Builds both the Activo-only `G-SEL` QuerySource and the `R7` label resolver from one
 * declarative specification so `PerPaiCod`, `PerDepCod`, and `PerCarCod` share identical behavior.
 */
export function createGselBinding<TRow>(
  config: GselLabelResolverConfig<TRow> & {
    readonly pageSize?: number;
    readonly includeAllStates?: boolean;
  },
): GselBinding<TRow> {
  return {
    table: config.table,
    repo: config.repo,
    codeCol: config.codeCol,
    nomCol: config.nomCol,
    estCol: config.estCol,
    asyncSource: createGselQuerySource(config),
    resolveLabel: createGselLabelResolver(config),
  };
}
