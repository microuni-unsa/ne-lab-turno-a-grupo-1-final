import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CargoRow,
  type DependenciaRow,
  type EstReg,
  type FieldFailure,
  type GuardarResult,
  MAX_SMALLINT,
  type PaisRow,
  type PendingOp,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
  type TableName,
  validateCargoRow,
  validateDependenciaRow,
  validatePaisRow,
} from "@/core";
import {
  CargoRepo,
  DependenciaRepo,
  type OrderingToggle,
  PaisRepo,
} from "@/data";
import type { RepoReader } from "@/features/maintenance/use-maintenance-list";

export interface ReferenceRepoContract<TRow> extends RepoReader<TRow> {
  readonly guardarOp: (pendingOp: PendingOp) => Promise<GuardarResult<TRow>>;
}

export interface ReferenceMaintenanceConfig<TRow> {
  readonly id: string;
  readonly table: TableName;
  readonly title: string;
  readonly subtitle: string;
  readonly singularLabel: string;
  readonly tableLabel: string;
  readonly codeField: string;
  readonly nomField: string;
  readonly estField: string;
  readonly codeLabel: string;
  readonly nomLabel: string;
  readonly searchPlaceholder: string;
  readonly emptyMessage: string;
  readonly maxCode: number;
  readonly defaultOrdering?: OrderingToggle;
  readonly createRepo: (client?: SupabaseClient) => ReferenceRepoContract<TRow>;
  readonly getRowCode: (row: TRow) => number;
  readonly getRowNom: (row: TRow) => string;
  readonly getRowState: (row: TRow) => EstReg;
  readonly rowToPayload: (row: TRow) => Record<string, unknown>;
  readonly validatePayload: (
    payload: Record<string, unknown>,
    isUpdate: boolean,
  ) => readonly FieldFailure[];
}

export const paisConfig: ReferenceMaintenanceConfig<PaisRow> = {
  id: "pais-maintenance-page",
  table: TABLE_PAIS,
  title: "Países",
  subtitle: "Catálogo maestro PAIS · estados A / I / *",
  singularLabel: "País",
  tableLabel: "PAIS",
  codeField: "PaiCod",
  nomField: "PaiNom",
  estField: "PaiEstReg",
  codeLabel: "Código de país",
  nomLabel: "Nombre del país",
  searchPlaceholder: "Buscar país por nombre...",
  emptyMessage: "No se encontraron países con los criterios actuales.",
  maxCode: MAX_SMALLINT,
  defaultOrdering: "default",
  createRepo: (client) => new PaisRepo(client),
  getRowCode: (row) => row.PaiCod,
  getRowNom: (row) => row.PaiNom,
  getRowState: (row) => row.PaiEstReg,
  rowToPayload: (row) => ({
    PaiCod: row.PaiCod,
    PaiNom: row.PaiNom,
  }),
  validatePayload: (payload, isUpdate) =>
    validatePaisRow(payload, { isUpdate }),
};

export const dependenciaConfig: ReferenceMaintenanceConfig<DependenciaRow> = {
  id: "dependencia-maintenance-page",
  table: TABLE_DEPENDENCIA,
  title: "Dependencias",
  subtitle: "Catálogo maestro DEPENDENCIA · estados A / I / *",
  singularLabel: "Dependencia",
  tableLabel: "DEPENDENCIA",
  codeField: "DepCod",
  nomField: "DepNom",
  estField: "DepEstReg",
  codeLabel: "Código de dependencia",
  nomLabel: "Nombre de la dependencia",
  searchPlaceholder: "Buscar dependencia por nombre...",
  emptyMessage: "No se encontraron dependencias con los criterios actuales.",
  maxCode: MAX_SMALLINT,
  defaultOrdering: "default",
  createRepo: (client) => new DependenciaRepo(client),
  getRowCode: (row) => row.DepCod,
  getRowNom: (row) => row.DepNom,
  getRowState: (row) => row.DepEstReg,
  rowToPayload: (row) => ({
    DepCod: row.DepCod,
    DepNom: row.DepNom,
  }),
  validatePayload: (payload, isUpdate) =>
    validateDependenciaRow(payload, { isUpdate }),
};

export const cargoConfig: ReferenceMaintenanceConfig<CargoRow> = {
  id: "cargo-maintenance-page",
  table: TABLE_CARGO,
  title: "Cargos",
  subtitle: "Catálogo maestro CARGO · estados A / I / *",
  singularLabel: "Cargo",
  tableLabel: "CARGO",
  codeField: "CarCod",
  nomField: "CarNom",
  estField: "CarEstReg",
  codeLabel: "Código de cargo",
  nomLabel: "Nombre del cargo",
  searchPlaceholder: "Buscar cargo por nombre...",
  emptyMessage: "No se encontraron cargos con los criterios actuales.",
  maxCode: MAX_SMALLINT,
  defaultOrdering: "default",
  createRepo: (client) => new CargoRepo(client),
  getRowCode: (row) => row.CarCod,
  getRowNom: (row) => row.CarNom,
  getRowState: (row) => row.CarEstReg,
  rowToPayload: (row) => ({
    CarCod: row.CarCod,
    CarNom: row.CarNom,
  }),
  validatePayload: (payload, isUpdate) =>
    validateCargoRow(payload, { isUpdate }),
};
