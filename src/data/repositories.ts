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

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  EST_A,
  EST_I,
  EST_X,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
} from "@/core/constants";
import {
  createFailure,
  ERROR_CODES,
  type ErrorCode,
  type FieldFailure,
} from "@/core/errors";
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
  validateDependenciaRow,
  validatePaisRow,
  validatePersonalRow,
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
  gsel,
  listQuery,
  type OrderingToggle,
  simpleSearch,
} from "@/data/query";

export type GuardarOp = "insert" | "update" | "set_state";

/**
 * Returns today's local date string YYYY-MM-DD for birthdate validations.
 */
function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Maps residual DB / PostgREST errors into domain FieldFailure (SPEC §12).
 * 23505 -> E-DUP
 * 23503 -> E-REF
 * 23514 -> E-RANGE / E-FORMAT by constraint
 * RPC-raised `E-*: message` prefixes -> same code
 */
export function mapPostgrestError(
  error:
    | PostgrestError
    | { code?: string; message?: string; details?: string | null },
  defaultField: string = "general",
): FieldFailure {
  const msg = error.message || "";
  const details = error.details || "";
  const code = error.code || "";

  // 1. RPC-raised exceptions with "E-*: message" prefix
  const rpcMatch = msg.match(/^(E-[A-Z0-9-]+)(?::\s*(.*))?$/);
  if (rpcMatch) {
    const rawCode = rpcMatch[1] as ErrorCode;
    const recognizedCode = Object.values(ERROR_CODES).includes(rawCode)
      ? rawCode
      : ERROR_CODES.TRANSITION;
    return createFailure(recognizedCode, defaultField);
  }

  // 2. Postgres Error 23505: Unique violation -> E-DUP
  if (code === "23505") {
    if (msg.includes("pais_nom_ci") || details.includes("PaiNom")) {
      return createFailure(ERROR_CODES.DUP, "PaiNom");
    }
    if (msg.includes("dependencia_nom_ci") || details.includes("DepNom")) {
      return createFailure(ERROR_CODES.DUP, "DepNom");
    }
    if (msg.includes("cargo_nom_ci") || details.includes("CarNom")) {
      return createFailure(ERROR_CODES.DUP, "CarNom");
    }
    if (msg.includes("personal_PerDNI_key") || details.includes("PerDNI")) {
      return createFailure(ERROR_CODES.DUP, "PerDNI");
    }
    return createFailure(ERROR_CODES.DUP, defaultField);
  }

  // 3. Postgres Error 23503: Foreign key violation -> E-REF
  if (code === "23503") {
    if (msg.includes("PerPaiCod") || details.includes("PerPaiCod")) {
      return createFailure(ERROR_CODES.REF, "PerPaiCod");
    }
    if (msg.includes("PerDepCod") || details.includes("PerDepCod")) {
      return createFailure(ERROR_CODES.REF, "PerDepCod");
    }
    if (msg.includes("PerCarCod") || details.includes("PerCarCod")) {
      return createFailure(ERROR_CODES.REF, "PerCarCod");
    }
    return createFailure(ERROR_CODES.REF, defaultField);
  }

  // 4. Postgres Error 23514: Check constraint violation -> E-RANGE / E-FORMAT
  if (code === "23514") {
    if (msg.includes("PerDNI") || msg.includes("^[0-9]{8}$")) {
      return createFailure(ERROR_CODES.FORMAT, "PerDNI");
    }
    if (msg.includes("PerFecNac") || msg.includes("18 years")) {
      return createFailure(ERROR_CODES.RANGE, "PerFecNac");
    }
    if (msg.includes("btrim") || msg.includes("char_length")) {
      return createFailure(ERROR_CODES.RANGE, "Nom");
    }
    if (msg.includes("Cod") && msg.includes("> 0")) {
      return createFailure(ERROR_CODES.RANGE, defaultField);
    }
    if (msg.includes("EstRegSim")) {
      return createFailure(ERROR_CODES.FORMAT, "EstRegSim");
    }
    return createFailure(ERROR_CODES.RANGE, defaultField);
  }

  // Default fallback to transition or format failure
  return createFailure(ERROR_CODES.TRANSITION, defaultField);
}

/**
 * Shared base repository class for all table entities.
 */
export abstract class BaseRepo<TRow> {
  constructor(
    readonly table: TableName,
    readonly codeCol: string,
    readonly nomCol: string,
    readonly estRegCol: string,
    protected readonly client: SupabaseClient = getSupabaseClient(),
  ) {}

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
    const query = listQuery(this.table, ordering, page, options, this.client);
    const { data, error, count } = await query;
    if (error) {
      throw error;
    }
    return { data: (data as unknown as TRow[]) ?? [], count };
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
    const query = simpleSearch(
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
    return { data: (data as unknown as TRow[]) ?? [], count };
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
    const query = advancedSearch(
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
    return { data: (data as unknown as TRow[]) ?? [], count };
  }

  /**
   * Reads a single record by primary key code.
   */
  async getByCode(code: number): Promise<TRow | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq(this.codeCol, code)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return (data as unknown as TRow) ?? null;
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
   * Head/count probe: checks whether a name exists case-insensitively.
   */
  async probeNomCiExists(nom: string, excludeCode?: number): Promise<boolean> {
    let builder = this.client
      .from(this.table)
      .select("*", { count: "exact", head: true })
      .ilike(this.nomCol, nom.trim());

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
   * Executes a pending operation from the core maintenance session (§8).
   */
  abstract guardarOp(pendingOp: PendingOp): Promise<GuardarResult<TRow>>;
}

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
    client: SupabaseClient = getSupabaseClient(),
  ) {
    super(table, codeCol, nomCol, estRegCol, client);
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
    return (
      (data as unknown as Array<{ readonly [key: string]: unknown }>) ?? []
    );
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
    p_cod: number;
    p_nom?: string;
    p_est?: EstReg | number;
  }): Promise<GuardarResult<TRow>> {
    const failures: FieldFailure[] = [];
    const isUpdate = params.op === "update";
    const isInsert = params.op === "insert";
    const isSetState = params.op === "set_state";

    // 1. Full client validation
    if (isInsert || isUpdate) {
      const payload: Record<string, unknown> = {
        [this.codeCol]: params.p_cod,
        [this.nomCol]: params.p_nom,
      };
      if (this.table === TABLE_PAIS) {
        failures.push(...validatePaisRow(payload, { isUpdate }));
      } else if (this.table === TABLE_DEPENDENCIA) {
        failures.push(...validateDependenciaRow(payload, { isUpdate }));
      } else if (this.table === TABLE_CARGO) {
        failures.push(...validateCargoRow(payload, { isUpdate }));
      }
    }

    // 2. Uniqueness probes
    if (isInsert && params.p_cod !== undefined) {
      const codeExists = await this.probeCodeExists(params.p_cod);
      if (codeExists) {
        failures.push(createFailure(ERROR_CODES.DUP, this.codeCol));
      }
    }

    if (
      (isInsert || isUpdate) &&
      params.p_nom &&
      params.p_nom.trim().length >= 2
    ) {
      const nomExists = await this.probeNomCiExists(
        params.p_nom,
        isUpdate ? params.p_cod : undefined,
      );
      if (nomExists) {
        failures.push(createFailure(ERROR_CODES.DUP, this.nomCol));
      }
    }

    // 3. R11 probe on reference Eliminación (p_est = EST_X = 3)
    if (isSetState && params.p_est === EST_X) {
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
    // R17: Never send created_at or updated_at
    const rpcPayload: Record<string, unknown> = {
      op: params.op,
      p_cod: params.p_cod,
      p_nom: params.p_nom ?? null,
      p_est: params.p_est ?? null,
    };

    const { data, error } = await this.client.rpc(this.rpcName, rpcPayload);

    if (error) {
      const mapped = mapPostgrestError(error, this.codeCol);
      return { ok: false, failures: [mapped] };
    }

    return { ok: true, row: data as TRow };
  }

  async guardarOp(pendingOp: PendingOp): Promise<GuardarResult<TRow>> {
    switch (pendingOp.kind) {
      case "adición": {
        const payload = pendingOp.payload as Record<string, unknown>;
        return this.guardar({
          op: "insert",
          p_cod: payload[this.codeCol] as number,
          p_nom: payload[this.nomCol] as string,
        });
      }
      case "modificación": {
        const payload = pendingOp.payload as Record<string, unknown>;
        return this.guardar({
          op: "update",
          p_cod: pendingOp.targetCode,
          p_nom: payload[this.nomCol] as string,
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
        throw new Error(
          `Unsupported pending operation: ${(pendingOp as { kind: string }).kind}`,
        );
    }
  }
}

/**
 * Pais Repository.
 */
export class PaisRepo extends ReferenceRepo<PaisRow> {
  constructor(client: SupabaseClient = getSupabaseClient()) {
    super(
      "pais",
      "PaiCod",
      "PaiNom",
      "PaiEstReg",
      "PerPaiCod",
      "guardar_pais",
      client,
    );
  }
}

/**
 * Dependencia Repository.
 */
export class DependenciaRepo extends ReferenceRepo<DependenciaRow> {
  constructor(client: SupabaseClient = getSupabaseClient()) {
    super(
      "dependencia",
      "DepCod",
      "DepNom",
      "DepEstReg",
      "PerDepCod",
      "guardar_dependencia",
      client,
    );
  }
}

/**
 * Cargo Repository.
 */
export class CargoRepo extends ReferenceRepo<CargoRow> {
  constructor(client: SupabaseClient = getSupabaseClient()) {
    super(
      "cargo",
      "CarCod",
      "CarNom",
      "CarEstReg",
      "PerCarCod",
      "guardar_cargo",
      client,
    );
  }
}

/**
 * Personal Repository.
 */
export class PersonalRepo extends BaseRepo<PersonalRow> {
  constructor(client: SupabaseClient = getSupabaseClient()) {
    super("personal", "PerCod", "PerNom", "PerEstReg", client);
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
    // 1. Check existence
    const { count: existCount, error: existErr } = await this.client
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(codeCol, code);

    if (existErr) throw existErr;
    if ((existCount ?? 0) === 0) {
      return { exists: false, activo: false };
    }

    // 2. Check Activo
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
  async guardar(params: {
    op: GuardarOp;
    p_cod: number;
    p_nom?: string;
    p_dni?: string;
    p_fecnac?: string;
    p_pai?: number;
    p_dep?: number;
    p_car?: number;
    p_est?: EstReg | number;
  }): Promise<GuardarResult<PersonalRow>> {
    const failures: FieldFailure[] = [];
    const isUpdate = params.op === "update";
    const isInsert = params.op === "insert";

    // 1. Full client validation
    if (isInsert || isUpdate) {
      const today = getTodayLocalDate();
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

    // 2. Uniqueness probes
    if (isInsert && params.p_cod !== undefined) {
      const codeExists = await this.probeCodeExists(params.p_cod);
      if (codeExists) {
        failures.push(createFailure(ERROR_CODES.DUP, "PerCod"));
      }
    }

    if (
      (isInsert || isUpdate) &&
      params.p_dni &&
      /^\d{8}$/.test(params.p_dni.trim())
    ) {
      const dniExists = await this.probeDniExists(
        params.p_dni,
        isUpdate ? params.p_cod : undefined,
      );
      if (dniExists) {
        failures.push(createFailure(ERROR_CODES.DUP, "PerDNI"));
      }
    }

    // 3. FK probes (exists + Activo)
    if (isInsert || isUpdate) {
      if (params.p_pai !== undefined && params.p_pai > 0) {
        const target = await this.probeFkTarget(
          "pais",
          "PaiCod",
          "PaiEstReg",
          params.p_pai,
        );
        if (!target.exists) {
          failures.push(createFailure(ERROR_CODES.REF, "PerPaiCod"));
        } else if (!target.activo) {
          failures.push(createFailure(ERROR_CODES.REF_STATE, "PerPaiCod"));
        }
      }

      if (params.p_dep !== undefined && params.p_dep > 0) {
        const target = await this.probeFkTarget(
          "dependencia",
          "DepCod",
          "DepEstReg",
          params.p_dep,
        );
        if (!target.exists) {
          failures.push(createFailure(ERROR_CODES.REF, "PerDepCod"));
        } else if (!target.activo) {
          failures.push(createFailure(ERROR_CODES.REF_STATE, "PerDepCod"));
        }
      }

      if (params.p_car !== undefined && params.p_car > 0) {
        const target = await this.probeFkTarget(
          "cargo",
          "CarCod",
          "CarEstReg",
          params.p_car,
        );
        if (!target.exists) {
          failures.push(createFailure(ERROR_CODES.REF, "PerCarCod"));
        } else if (!target.activo) {
          failures.push(createFailure(ERROR_CODES.REF_STATE, "PerCarCod"));
        }
      }
    }

    // R22: Batch all pre-flight failures and skip RPC when any exist
    if (failures.length > 0) {
      return { ok: false, failures };
    }

    // 4. Call authoritative guardar_personal RPC
    // R17: Never send created_at or updated_at
    const rpcPayload: Record<string, unknown> = {
      op: params.op,
      p_cod: params.p_cod,
      p_nom: params.p_nom ?? null,
      p_dni: params.p_dni ?? null,
      p_fecnac: params.p_fecnac ?? null,
      p_pai: params.p_pai ?? null,
      p_dep: params.p_dep ?? null,
      p_car: params.p_car ?? null,
      p_est: params.p_est ?? null,
    };

    const { data, error } = await this.client.rpc(
      "guardar_personal",
      rpcPayload,
    );

    if (error) {
      const mapped = mapPostgrestError(error, "PerCod");
      return { ok: false, failures: [mapped] };
    }

    return { ok: true, row: data as PersonalRow };
  }

  async guardarOp(pendingOp: PendingOp): Promise<GuardarResult<PersonalRow>> {
    switch (pendingOp.kind) {
      case "adición": {
        const payload = pendingOp.payload as Record<string, unknown>;
        return this.guardar({
          op: "insert",
          p_cod: payload.PerCod as number,
          p_nom: payload.PerNom as string,
          p_dni: payload.PerDNI as string,
          p_fecnac: payload.PerFecNac as string,
          p_pai: payload.PerPaiCod as number,
          p_dep: payload.PerDepCod as number,
          p_car: payload.PerCarCod as number,
        });
      }
      case "modificación": {
        const payload = pendingOp.payload as Record<string, unknown>;
        return this.guardar({
          op: "update",
          p_cod: pendingOp.targetCode,
          p_nom: payload.PerNom as string,
          p_dni: payload.PerDNI as string,
          p_fecnac: payload.PerFecNac as string,
          p_pai: payload.PerPaiCod as number,
          p_dep: payload.PerDepCod as number,
          p_car: payload.PerCarCod as number,
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
        throw new Error(
          `Unsupported pending operation: ${(pendingOp as { kind: string }).kind}`,
        );
    }
  }
}
