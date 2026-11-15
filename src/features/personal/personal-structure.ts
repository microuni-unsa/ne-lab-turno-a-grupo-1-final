import type { SupabaseClient } from "@supabase/supabase-js";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
  type CargoRow,
  type DependenciaRow,
  DNI_LEN,
  EST_A,
  EST_I,
  type EstReg,
  MAX_INTEGER,
  MAX_NAME,
  MIN_NAME,
  type PaisRow,
  type PersonalRow,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
} from "@/core";
import { CargoRepo, DependenciaRepo, PaisRepo } from "@/data";
import { maintenanceKeys } from "@/features/maintenance/query-keys";
import {
  createGselBinding,
  type GselBinding,
  type GselRepoContract,
} from "@/features/personal/gsel-source";
import type { PersonalFormValues } from "@/features/personal/personal-schema";
import type { AppStructure } from "@/lib/microform";

export type PersonalFieldName = keyof PersonalFormValues;

export interface PersonalGselBindings {
  readonly pai: GselBinding<PaisRow>;
  readonly dep: GselBinding<DependenciaRow>;
  readonly car: GselBinding<CargoRow>;
}

export interface PersonalCatalogRepo<TRow> extends GselRepoContract<TRow> {
  list(
    ordering?: "default" | "alternate",
    page?: { readonly offset: number; readonly limit: number },
  ): Promise<{ readonly data: TRow[]; readonly count: number | null }>;
}

export interface PersonalCatalogRepos {
  readonly pai?: PersonalCatalogRepo<PaisRow>;
  readonly dep?: PersonalCatalogRepo<DependenciaRow>;
  readonly car?: PersonalCatalogRepo<CargoRow>;
}

export interface CatalogLabelEntry {
  readonly nom: string;
  readonly est: EstReg;
}

export interface PersonalCatalogLabelMaps {
  readonly pai: ReadonlyMap<number, CatalogLabelEntry>;
  readonly dep: ReadonlyMap<number, CatalogLabelEntry>;
  readonly car: ReadonlyMap<number, CatalogLabelEntry>;
}

export const PERSONAL_FORM_FIELDS: ReadonlySet<string> =
  new Set<PersonalFieldName>([
    "PerCod",
    "PerNom",
    "PerDNI",
    "PerFecNac",
    "PerPaiCod",
    "PerDepCod",
    "PerCarCod",
  ]);

export function createPersonalGselBindings(
  queryClient: QueryClient,
  repos?: PersonalCatalogRepos,
  client?: SupabaseClient,
  options?: { readonly includeAllStates?: boolean },
): PersonalGselBindings {
  const paiRepo = repos?.pai ?? new PaisRepo(client);
  const depRepo = repos?.dep ?? new DependenciaRepo(client);
  const carRepo = repos?.car ?? new CargoRepo(client);
  const includeAllStates = Boolean(options?.includeAllStates);

  return {
    pai: createGselBinding({
      table: TABLE_PAIS,
      repo: paiRepo,
      codeCol: "PaiCod",
      nomCol: "PaiNom",
      estCol: "PaiEstReg",
      queryClient,
      includeAllStates,
    }),
    dep: createGselBinding({
      table: TABLE_DEPENDENCIA,
      repo: depRepo,
      codeCol: "DepCod",
      nomCol: "DepNom",
      estCol: "DepEstReg",
      queryClient,
      includeAllStates,
    }),
    car: createGselBinding({
      table: TABLE_CARGO,
      repo: carRepo,
      codeCol: "CarCod",
      nomCol: "CarNom",
      estCol: "CarEstReg",
      queryClient,
      includeAllStates,
    }),
  };
}

function buildLabelMap<TRow>(
  rows: readonly TRow[],
  getCod: (row: TRow) => number,
  getNom: (row: TRow) => string,
  getEst: (row: TRow) => EstReg,
): ReadonlyMap<number, CatalogLabelEntry> {
  const map = new Map<number, CatalogLabelEntry>();
  for (const row of rows) {
    map.set(getCod(row), { nom: getNom(row), est: getEst(row) });
  }
  return map;
}

/**
 * Loads all-state catalog label maps keyed under maintenanceKeys.lists(table)
 * so changes to PAIS, DEPENDENCIA, or CARGO automatically update Personal subtitles (R7, R14).
 */
export function usePersonalCatalogLabels(
  repos?: PersonalCatalogRepos,
  client?: SupabaseClient,
): PersonalCatalogLabelMaps {
  const paiRepo = React.useMemo(
    () => repos?.pai ?? new PaisRepo(client),
    [client, repos?.pai],
  );
  const depRepo = React.useMemo(
    () => repos?.dep ?? new DependenciaRepo(client),
    [client, repos?.dep],
  );
  const carRepo = React.useMemo(
    () => repos?.car ?? new CargoRepo(client),
    [client, repos?.car],
  );

  const paiQuery = useQuery({
    queryKey: [...maintenanceKeys.lists(TABLE_PAIS), "labels"],
    queryFn: async () => {
      const result = await paiRepo.list("alternate", { offset: 0, limit: 500 });
      return result.data;
    },
  });

  const depQuery = useQuery({
    queryKey: [...maintenanceKeys.lists(TABLE_DEPENDENCIA), "labels"],
    queryFn: async () => {
      const result = await depRepo.list("alternate", { offset: 0, limit: 500 });
      return result.data;
    },
  });

  const carQuery = useQuery({
    queryKey: [...maintenanceKeys.lists(TABLE_CARGO), "labels"],
    queryFn: async () => {
      const result = await carRepo.list("alternate", { offset: 0, limit: 500 });
      return result.data;
    },
  });

  const pai = buildLabelMap(
    paiQuery.data ?? [],
    (r) => r.PaiCod,
    (r) => r.PaiNom,
    (r) => r.PaiEstReg,
  );
  const dep = buildLabelMap(
    depQuery.data ?? [],
    (r) => r.DepCod,
    (r) => r.DepNom,
    (r) => r.DepEstReg,
  );
  const car = buildLabelMap(
    carQuery.data ?? [],
    (r) => r.CarCod,
    (r) => r.CarNom,
    (r) => r.CarEstReg,
  );

  return { pai, dep, car };
}

function formatCatalogRef(
  code: number,
  map: ReadonlyMap<number, CatalogLabelEntry>,
  fallbackPrefix: string,
): string {
  const entry = map.get(code);
  if (!entry) {
    return `${fallbackPrefix} #${code}`;
  }
  if (entry.est === EST_A) {
    return entry.nom;
  }
  if (entry.est === EST_I) {
    return `${entry.nom} (Inactivo)`;
  }
  return `${entry.nom} (Eliminado)`;
}

export function formatPersonalSubtitle(
  row: PersonalRow,
  labels: PersonalCatalogLabelMaps,
): string {
  const paiLabel = formatCatalogRef(row.PerPaiCod, labels.pai, "País");
  const depLabel = formatCatalogRef(row.PerDepCod, labels.dep, "Dep");
  const carLabel = formatCatalogRef(row.PerCarCod, labels.car, "Cargo");
  return `Cod ${row.PerCod} · DNI ${row.PerDNI} · Nac ${row.PerFecNac} · ${paiLabel} · ${depLabel} · ${carLabel}`;
}

export function personalRowToPayload(
  row: PersonalRow,
): Record<string, unknown> {
  return {
    PerCod: row.PerCod,
    PerNom: row.PerNom,
    PerDNI: row.PerDNI,
    PerFecNac: row.PerFecNac,
    PerPaiCod: row.PerPaiCod,
    PerDepCod: row.PerDepCod,
    PerCarCod: row.PerCarCod,
  };
}

export function createPersonalStructure({
  isUpdate,
  todayLocal,
  bindings,
}: {
  readonly isUpdate: boolean;
  readonly todayLocal: string;
  readonly bindings: PersonalGselBindings;
}): AppStructure<PersonalFieldName, PersonalFormValues> {
  return [
    {
      fields: [
        {
          type: "number",
          name: "PerCod",
          label: "Código de Personal",
          placeholder: isUpdate
            ? "Código inmutable"
            : `Entero positivo (1 – ${MAX_INTEGER})`,
          readonly: isUpdate,
          maxLength: String(MAX_INTEGER).length,
          inputMode: "numeric",
          colspan: 12,
        },
        {
          type: "text",
          name: "PerNom",
          label: "Nombre de Personal",
          placeholder: `${MIN_NAME} a ${MAX_NAME} caracteres`,
          maxLength: MAX_NAME,
          colspan: 12,
        },
        {
          type: "text",
          name: "PerDNI",
          label: "DNI",
          placeholder: `Exactamente ${DNI_LEN} dígitos`,
          maxLength: DNI_LEN,
          inputMode: "numeric",
          colspan: 12,
        },
        {
          type: "calendar",
          name: "PerFecNac",
          label: "Fecha de Nacimiento",
          placeholder: "Seleccionar fecha (≥ 18 años)",
          maxDate: todayLocal,
          colspan: 12,
        },
        {
          type: "async_combobox",
          name: "PerPaiCod",
          label: "País",
          placeholder: "Seleccionar país",
          asyncSource: bindings.pai.asyncSource,
          resolveLabel: bindings.pai.resolveLabel,
          valueType: "number",
          emptyMessage: "Sin países activos",
          colspan: 12,
        },
        {
          type: "async_combobox",
          name: "PerDepCod",
          label: "Dependencia",
          placeholder: "Seleccionar dependencia",
          asyncSource: bindings.dep.asyncSource,
          resolveLabel: bindings.dep.resolveLabel,
          valueType: "number",
          emptyMessage: "Sin dependencias activas",
          colspan: 12,
        },
        {
          type: "async_combobox",
          name: "PerCarCod",
          label: "Cargo",
          placeholder: "Seleccionar cargo",
          asyncSource: bindings.car.asyncSource,
          resolveLabel: bindings.car.resolveLabel,
          valueType: "number",
          emptyMessage: "Sin cargos activos",
          colspan: 12,
        },
      ],
    },
  ];
}
