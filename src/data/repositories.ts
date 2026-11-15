/**
 * Maestro de Personal — Data Layer Repositories
 *
 * SPEC §§5–12, Appendix A & C.
 * Per-table repository classes (PaisRepo, DependenciaRepo, CargoRepo, PersonalRepo) + shared base.
 * Reads via Supabase client, writes via atomic RPC Guardar (guardar_pais, guardar_dependencia, etc.).
 * Client pre-flight checks before RPC:
 *   - Full client validation (from core validators)
 *   - Uniqueness probes (head/count: code-exists, Nom-ci-exists, DNI-exists)
 *   - FK probes (head/count: exists + Activo)
 *   - R11 live-reference probe (head/count: personal with EstReg IN (1,2) referencing code)
 * Batches ALL pre-flight failures (R22) and skips RPC when any exist.
 * Native DB error -> E-* residual mapping.
 * Read-only audit columns (R17): never sends created_at or updated_at.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DNI_LEN,
  EST_A,
  EST_I,
  EST_X,
  MAX_INTEGER,
  MAX_NAME,
  MAX_SMALLINT,
  MIN_CODE,
  MIN_NAME,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
} from "@/core/constants";
import { createFailure, ERROR_CODES, type FieldFailure } from "@/core/errors";
import type {
  CargoRow,
  DependenciaRow,
  EstReg,
  GuardarResult,
  PaisRow,
  PendingOp,
  PersonalRow,
  TableName,
} from "@/core/types";
import {
  validateCargoRow,
  validateCode,
  validateDependenciaRow,
  validatePaisRow,
  validatePersonalRow,
  validateRow,
} from "@/core/validators";
import { getSupabaseClient } from "@/data/client";
import {
  DEFAULT_PAGE_LIMIT,
  type Page,
  type PagingOptions,
} from "@/data/paging";
import {
  type AdvancedSearchFilters,
  advancedSearch,
  escapeIlikeLiteral,
  gsel,
  listQuery,
  type OrderingToggle,
  simpleSearch,
} from "@/data/query";
import {
  isPlainRecord,
  parseCargoRow,
  parseDependenciaRow,
  parsePaisRow,
  parsePersonalRow,
  readOptionalNumberField,
  readOptionalStringField,
} from "@/data/row-parsers";
import {
  getTodayLocalDate,
  handleRpcError,
  isTransportError,
  mapPostgrestError,
} from "@/data/rpc-errors";

export { isTransportError, mapPostgrestError };

export type GuardarOp = "insert" | "update" | "set_state";

function assertNeverPendingOp(op: never): never {
  throw new Error(`Unsupported pending operation: ${String(op)}`);
}

function isValidIntegerInRange(
  value: number | undefined,
  maxLimit: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_CODE &&
    value <= maxLimit
  );
}

/**
 * Shared base repository class for all table entities.
 */
export abstract class BaseRepo<TRow> {
  private readonly explicitClient?: SupabaseClient;

  constructor(
    readonly table: TableName,
    readonly codeCol: string,
    readonly nomCol: string,
    readonly estRegCol: string,
    client?: SupabaseClient,
    protected readonly rowParser?: (value: unknown) => TRow | null,
  ) {
    this.explicitClient = client;
  }

  protected get client(): SupabaseClient {
    return this.explicitClient ?? getSupabaseClient();
  }

  protected parseRows(rawRows: readonly unknown[] | null | undefined): TRow[] {
    if (!rawRows || rawRows.length === 0) {
      return [];
    }
    if (!this.rowParser) {
      return [];
    }
    const parsed: TRow[] = [];
    for (const item of rawRows) {
      const row = this.rowParser(item);
      if (row !== null) {
        parsed.push(row);
      }
    }
    return parsed;
  }

  protected parseSingleRow(raw: unknown): TRow | null {
    if (raw === null || raw === undefined || !this.rowParser) {
      return null;
    }
    return this.rowParser(raw);
  }

  /**
   * Paged enumeration with explicit order (§11.1).
   */
  async list(
    ordering: OrderingToggle = "default",
    page: Pick<Page, "offset" | "limit"> = {
      offset: 0,
      limit: DEFAULT_PAGE_LIMIT,
    },
    options?: PagingOptions,
  ): Promise<{ data: TRow[]; count: number | null }> {
    const query = listQuery<unknown>(
      this.table,
      ordering,
      page,
      options,
      this.client,
    );
    const { data, error, count } = await query;
    if (error) {
      throw error;
    }
    return { data: this.parseRows(data), count };
  }

  /**
   * Simple search with active ordering (§11.2).
   */
  async search(
    q: string,
    ordering: OrderingToggle = "default",
    page?: Pick<Page, "offset" | "limit">,
    options?: PagingOptions,
  ): Promise<{ data: TRow[]; count: number | null }> {
    const query = simpleSearch<unknown>(
      this.table,
      q,
      ordering,
      page,
      options,
      this.client,
    );
    const { data, error, count } = await query;
    if (error) {
      throw error;
    }
    return { data: this.parseRows(data), count };
  }

  /**
   * Advanced multi-filter search with active ordering (§11.3).
   */
  async advancedSearch(
    filters: AdvancedSearchFilters,
    ordering: OrderingToggle = "default",
    page?: Pick<Page, "offset" | "limit">,
    options?: PagingOptions,
  ): Promise<{ data: TRow[]; count: number | null }> {
    const query = advancedSearch<unknown>(
      this.table,
      filters,
      ordering,
      page,
      options,
      this.client,
    );
    const { data, error, count } = await query;
    if (error) {
      throw error;
    }
    return { data: this.parseRows(data), count };
  }

  /**
   * Reads a single record by primary key code.
   */
  async getByCode(code: number): Promise<TRow | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq(this.codeCol, code)
      .maybeSingle<unknown>();

    if (error) {
      throw error;
    }
    return this.parseSingleRow(data);
  }

  /**
   * Head/count probe: checks whether a primary key code exists.
   * Uses head: true to avoid full-row fetches.
   */
  async probeCodeExists(code: number): Promise<boolean> {
    const { count, error } = await this.client
      .from(this.table)
      .select("*", { count: "exact", head: true })
      .eq(this.codeCol, code);

    if (error) {
      throw error;
    }
    return (count ?? 0) > 0;
  }

  /**
   * Executes a pending operation from the core maintenance session (§8).
   */
  abstract guardarOp(pendingOp: PendingOp): Promise<GuardarResult<TRow>>;
}

export type ReferenceRowValidator = (
  row: Record<string, unknown>,
  options?: { isUpdate?: boolean },
) => FieldFailure[];

/**
 * Repository for reference tables (PAIS, DEPENDENCIA, CARGO).
 */
export class ReferenceRepo<TRow> extends BaseRepo<TRow> {
  constructor(
    table: TableName,
    codeCol: string,
    nomCol: string,
    estRegCol: string,
    readonly personalFkCol: string,
    readonly rpcName: string,
    client?: SupabaseClient,
    rowParser?: (value: unknown) => TRow | null,
    private readonly rowValidator?: ReferenceRowValidator,
  ) {
    super(table, codeCol, nomCol, estRegCol, client, rowParser);
  }

  protected parseRpcRow(raw: unknown): TRow | null {
    return this.parseSingleRow(raw);
  }

  /**
   * Head/count probe: checks whether a reference name exists case-insensitively.
   * Escapes LIKE/ILIKE wildcards (`%`, `_`, `\`) so literal names are probed safely.
   */
  async probeNomCiExists(nom: string, excludeCode?: number): Promise<boolean> {
    const escapedNom = escapeIlikeLiteral(nom.trim());
    let builder = this.client
      .from(this.table)
      .select("*", { count: "exact", head: true })
      .ilike(this.nomCol, escapedNom);

    if (excludeCode !== undefined) {
      builder = builder.neq(this.codeCol, excludeCode);
    }

    const { count, error } = await builder;
    if (error) {
      throw error;
    }
    return (count ?? 0) > 0;
  }

  /**
   * G-SEL selection query: Activo-only, alphabetical, code tiebreak (§9).
   */
  async gsel(): Promise<Array<{ readonly [key: string]: unknown }>> {
    const query = gsel(this.table, this.client);
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data?.filter(isPlainRecord) ?? [];
  }

  /**
   * R11 live-reference probe:
   * EXISTS personal with EstReg IN (1,2) referencing code.
   * Head/count probe, no full-row fetch.
   */
  async probeLiveReferences(code: number): Promise<boolean> {
    const { count, error } = await this.client
      .from("personal")
      .select("*", { count: "exact", head: true })
      .eq(this.personalFkCol, code)
      .in("PerEstReg", [EST_A, EST_I]);

    if (error) {
      throw error;
    }
    return (count ?? 0) > 0;
  }

  /**
   * Atomically commits an insert, update, or state change via RPC.
   * Batches ALL pre-flight validation and probe checks (R22).
   * Skips RPC if any pre-flight failure exists.
   */
  async guardar(params: {
    op: GuardarOp;
    p_cod?: number;
    p_nom?: string;
    p_est?: EstReg | number;
  }): Promise<GuardarResult<TRow>> {
    const failures: FieldFailure[] = [];
    const isUpdate = params.op === "update";
    const isInsert = params.op === "insert";
    const isSetState = params.op === "set_state";
    const trimmedNom =
      typeof params.p_nom === "string" ? params.p_nom.trim() : undefined;

    // 1. Full client validation
    if (isInsert || isUpdate) {
      const payload: Record<string, unknown> = {
        [this.codeCol]: params.p_cod,
        [this.nomCol]: params.p_nom,
      };
      const validate =
        this.rowValidator ??
        ((row: Record<string, unknown>, opts?: { isUpdate?: boolean }) =>
          validateRow(this.table, row, opts));
      failures.push(...validate(payload, { isUpdate }));
    }

    if (isSetState) {
      failures.push(...validateCode(this.table, params.p_cod, this.codeCol));
    }

    // 2. Uniqueness probes (only when inputs are within valid type/range bounds)
    if (isInsert && isValidIntegerInRange(params.p_cod, MAX_SMALLINT)) {
      const codeExists = await this.probeCodeExists(params.p_cod);
      if (codeExists) {
        failures.push(createFailure(ERROR_CODES.DUP, this.codeCol));
      }
    }

    if (
      (isInsert || isUpdate) &&
      trimmedNom !== undefined &&
      trimmedNom.length >= MIN_NAME &&
      trimmedNom.length <= MAX_NAME
    ) {
      const excludeCode =
        isUpdate && isValidIntegerInRange(params.p_cod, MAX_SMALLINT)
          ? params.p_cod
          : undefined;
      const nomExists = await this.probeNomCiExists(trimmedNom, excludeCode);
      if (nomExists) {
        failures.push(createFailure(ERROR_CODES.DUP, this.nomCol));
      }
    }

    // 3. R11 probe on reference Eliminación (p_est = EST_X = 3)
    if (
      isSetState &&
      params.p_est === EST_X &&
      isValidIntegerInRange(params.p_cod, MAX_SMALLINT)
    ) {
      const hasLiveRefs = await this.probeLiveReferences(params.p_cod);
      if (hasLiveRefs) {
        failures.push(createFailure(ERROR_CODES.REF_BLOCKED, this.codeCol));
      }
    }

    // R22: Batch all pre-flight failures and skip RPC when any exist
    if (failures.length > 0) {
      return { ok: false, failures };
    }

    // 4. Call authoritative Guardar RPC
    // R8/R9/R17: Force p_est=1 on insert, p_est=null on update, never send created_at/updated_at
    const rpcPayload: Record<string, unknown> = {
      op: params.op,
      p_cod: params.p_cod ?? null,
      p_nom: trimmedNom ?? null,
      p_est: isInsert ? EST_A : isUpdate ? null : (params.p_est ?? null),
    };

    const { data, error, status } = await this.client.rpc(
      this.rpcName,
      rpcPayload,
    );

    if (error) {
      return handleRpcError(error, status, this.codeCol);
    }

    const parsed = this.parseRpcRow(data);
    if (!parsed) {
      return {
        ok: false,
        failures: [createFailure(ERROR_CODES.TRANSITION, this.codeCol)],
      };
    }

    return { ok: true, row: parsed };
  }

  async guardarOp(pendingOp: PendingOp): Promise<GuardarResult<TRow>> {
    switch (pendingOp.kind) {
      case "adición": {
        return this.guardar({
          op: "insert",
          p_cod: readOptionalNumberField(pendingOp.payload, this.codeCol),
          p_nom: readOptionalStringField(pendingOp.payload, this.nomCol),
        });
      }
      case "modificación": {
        return this.guardar({
          op: "update",
          p_cod: pendingOp.targetCode,
          p_nom: readOptionalStringField(pendingOp.payload, this.nomCol),
        });
      }
      case "inactivar":
        return this.guardar({
          op: "set_state",
          p_cod: pendingOp.targetCode,
          p_est: EST_I,
        });
      case "reactivar":
        return this.guardar({
          op: "set_state",
          p_cod: pendingOp.targetCode,
          p_est: EST_A,
        });
      case "eliminación":
        return this.guardar({
          op: "set_state",
          p_cod: pendingOp.targetCode,
          p_est: EST_X,
        });
      default:
        return assertNeverPendingOp(pendingOp);
    }
  }
}

/**
 * Pais Repository.
 */
export class PaisRepo extends ReferenceRepo<PaisRow> {
  constructor(client?: SupabaseClient) {
    super(
      "pais",
      "PaiCod",
      "PaiNom",
      "PaiEstReg",
      "PerPaiCod",
      "guardar_pais",
      client,
      parsePaisRow,
      validatePaisRow,
    );
  }
}

/**
 * Dependencia Repository.
 */
export class DependenciaRepo extends ReferenceRepo<DependenciaRow> {
  constructor(client?: SupabaseClient) {
    super(
      "dependencia",
      "DepCod",
      "DepNom",
      "DepEstReg",
      "PerDepCod",
      "guardar_dependencia",
      client,
      parseDependenciaRow,
      validateDependenciaRow,
    );
  }
}

/**
 * Cargo Repository.
 */
export class CargoRepo extends ReferenceRepo<CargoRow> {
  constructor(client?: SupabaseClient) {
    super(
      "cargo",
      "CarCod",
      "CarNom",
      "CarEstReg",
      "PerCarCod",
      "guardar_cargo",
      client,
      parseCargoRow,
      validateCargoRow,
    );
  }
}

interface PersonalGuardarParams {
  readonly op: GuardarOp;
  readonly p_cod?: number;
  readonly p_nom?: string;
  readonly p_dni?: string;
  readonly p_fecnac?: string;
  readonly p_pai?: number;
  readonly p_dep?: number;
  readonly p_car?: number;
  readonly p_est?: EstReg | number;
}

const PERSONAL_FK_SPECS = [
  {
    table: TABLE_PAIS,
    codeCol: "PaiCod",
    estRegCol: "PaiEstReg",
    field: "PerPaiCod",
    getValue: (p: PersonalGuardarParams) => p.p_pai,
  },
  {
    table: TABLE_DEPENDENCIA,
    codeCol: "DepCod",
    estRegCol: "DepEstReg",
    field: "PerDepCod",
    getValue: (p: PersonalGuardarParams) => p.p_dep,
  },
  {
    table: TABLE_CARGO,
    codeCol: "CarCod",
    estRegCol: "CarEstReg",
    field: "PerCarCod",
    getValue: (p: PersonalGuardarParams) => p.p_car,
  },
] as const;

const DNI_EXACT_REGEX = new RegExp(`^\\d{${DNI_LEN}}$`);

/**
 * Personal Repository.
 */
export class PersonalRepo extends BaseRepo<PersonalRow> {
  constructor(
    client?: SupabaseClient,
    private readonly getTodayLocal: () => string = getTodayLocalDate,
  ) {
    super(
      "personal",
      "PerCod",
      "PerNom",
      "PerEstReg",
      client,
      parsePersonalRow,
    );
  }

  /**
   * Head/count probe: checks whether a PerDNI already exists.
   */
  async probeDniExists(dni: string, excludeCode?: number): Promise<boolean> {
    let builder = this.client
      .from("personal")
      .select("*", { count: "exact", head: true })
      .eq("PerDNI", dni.trim());

    if (excludeCode !== undefined) {
      builder = builder.neq("PerCod", excludeCode);
    }

    const { count, error } = await builder;
    if (error) {
      throw error;
    }
    return (count ?? 0) > 0;
  }

  /**
   * Head/count probe: checks whether an FK reference exists and is Activo.
   */
  async probeFkTarget(
    table: "pais" | "dependencia" | "cargo",
    codeCol: string,
    estRegCol: string,
    code: number,
  ): Promise<{ exists: boolean; activo: boolean }> {
    const { count: existCount, error: existErr } = await this.client
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(codeCol, code);

    if (existErr) throw existErr;
    if ((existCount ?? 0) === 0) {
      return { exists: false, activo: false };
    }

    const { count: actCount, error: actErr } = await this.client
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(codeCol, code)
      .eq(estRegCol, EST_A);

    if (actErr) throw actErr;
    return { exists: true, activo: (actCount ?? 0) > 0 };
  }

  /**
   * Atomically commits an insert, update, or state change via guardar_personal.
   * Batches ALL pre-flight validation and probe checks (R22).
   * Skips RPC if any pre-flight failure exists.
   */
  async guardar(
    params: PersonalGuardarParams,
  ): Promise<GuardarResult<PersonalRow>> {
    const failures: FieldFailure[] = [];
    const isUpdate = params.op === "update";
    const isInsert = params.op === "insert";
    const isSetState = params.op === "set_state";
    const trimmedNom =
      typeof params.p_nom === "string" ? params.p_nom.trim() : undefined;
    const trimmedDni =
      typeof params.p_dni === "string" ? params.p_dni.trim() : undefined;
    const trimmedFecNac =
      typeof params.p_fecnac === "string" ? params.p_fecnac.trim() : undefined;

    // 1. Full client validation
    if (isInsert || isUpdate) {
      const today = this.getTodayLocal();
      const payload: Record<string, unknown> = {
        PerCod: params.p_cod,
        PerNom: params.p_nom,
        PerDNI: params.p_dni,
        PerFecNac: params.p_fecnac,
        PerPaiCod: params.p_pai,
        PerDepCod: params.p_dep,
        PerCarCod: params.p_car,
      };
      failures.push(
        ...validatePersonalRow(payload, { todayLocal: today, isUpdate }),
      );
    }

    if (isSetState) {
      failures.push(...validateCode("personal", params.p_cod, "PerCod"));
    }

    // 2. Uniqueness probes (only when inputs are within valid type/range bounds)
    if (isInsert && isValidIntegerInRange(params.p_cod, MAX_INTEGER)) {
      const codeExists = await this.probeCodeExists(params.p_cod);
      if (codeExists) {
        failures.push(createFailure(ERROR_CODES.DUP, "PerCod"));
      }
    }

    if (
      (isInsert || isUpdate) &&
      trimmedDni !== undefined &&
      DNI_EXACT_REGEX.test(trimmedDni)
    ) {
      const excludeCode =
        isUpdate && isValidIntegerInRange(params.p_cod, MAX_INTEGER)
          ? params.p_cod
          : undefined;
      const dniExists = await this.probeDniExists(trimmedDni, excludeCode);
      if (dniExists) {
        failures.push(createFailure(ERROR_CODES.DUP, "PerDNI"));
      }
    }

    // 3. FK probes (exists + Activo) in parallel for valid SMALLINT codes
    if (isInsert || isUpdate) {
      const fkChecks = await Promise.all(
        PERSONAL_FK_SPECS.map(async (spec) => {
          const fkVal = spec.getValue(params);
          if (!isValidIntegerInRange(fkVal, MAX_SMALLINT)) {
            return null;
          }
          const target = await this.probeFkTarget(
            spec.table,
            spec.codeCol,
            spec.estRegCol,
            fkVal,
          );
          if (!target.exists) {
            return createFailure(ERROR_CODES.REF, spec.field);
          }
          if (!target.activo) {
            return createFailure(ERROR_CODES.REF_STATE, spec.field);
          }
          return null;
        }),
      );
      for (const failure of fkChecks) {
        if (failure !== null) {
          failures.push(failure);
        }
      }
    }

    // R22: Batch all pre-flight failures and skip RPC when any exist
    if (failures.length > 0) {
      return { ok: false, failures };
    }

    // 4. Call authoritative guardar_personal RPC
    // R8/R9/R17: Force p_est=1 on insert, p_est=null on update, never send created_at or updated_at
    const rpcPayload: Record<string, unknown> = {
      op: params.op,
      p_cod: params.p_cod ?? null,
      p_nom: trimmedNom ?? null,
      p_dni: trimmedDni ?? null,
      p_fecnac: trimmedFecNac ?? null,
      p_pai: params.p_pai ?? null,
      p_dep: params.p_dep ?? null,
      p_car: params.p_car ?? null,
      p_est: isInsert ? EST_A : isUpdate ? null : (params.p_est ?? null),
    };

    const { data, error, status } = await this.client.rpc(
      "guardar_personal",
      rpcPayload,
    );

    if (error) {
      return handleRpcError(error, status, "PerCod");
    }

    const parsed = parsePersonalRow(data);
    if (!parsed) {
      return {
        ok: false,
        failures: [createFailure(ERROR_CODES.TRANSITION, "PerCod")],
      };
    }

    return { ok: true, row: parsed };
  }

  async guardarOp(pendingOp: PendingOp): Promise<GuardarResult<PersonalRow>> {
    switch (pendingOp.kind) {
      case "adición": {
        return this.guardar({
          op: "insert",
          p_cod: readOptionalNumberField(pendingOp.payload, "PerCod"),
          p_nom: readOptionalStringField(pendingOp.payload, "PerNom"),
          p_dni: readOptionalStringField(pendingOp.payload, "PerDNI"),
          p_fecnac: readOptionalStringField(pendingOp.payload, "PerFecNac"),
          p_pai: readOptionalNumberField(pendingOp.payload, "PerPaiCod"),
          p_dep: readOptionalNumberField(pendingOp.payload, "PerDepCod"),
          p_car: readOptionalNumberField(pendingOp.payload, "PerCarCod"),
        });
      }
      case "modificación": {
        return this.guardar({
          op: "update",
          p_cod: pendingOp.targetCode,
          p_nom: readOptionalStringField(pendingOp.payload, "PerNom"),
          p_dni: readOptionalStringField(pendingOp.payload, "PerDNI"),
          p_fecnac: readOptionalStringField(pendingOp.payload, "PerFecNac"),
          p_pai: readOptionalNumberField(pendingOp.payload, "PerPaiCod"),
          p_dep: readOptionalNumberField(pendingOp.payload, "PerDepCod"),
          p_car: readOptionalNumberField(pendingOp.payload, "PerCarCod"),
        });
      }
      case "inactivar":
        return this.guardar({
          op: "set_state",
          p_cod: pendingOp.targetCode,
          p_est: EST_I,
        });
      case "reactivar":
        return this.guardar({
          op: "set_state",
          p_cod: pendingOp.targetCode,
          p_est: EST_A,
        });
      case "eliminación":
        return this.guardar({
          op: "set_state",
          p_cod: pendingOp.targetCode,
          p_est: EST_X,
        });
      default:
        return assertNeverPendingOp(pendingOp);
    }
  }
}
