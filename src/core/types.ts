/**
 * Maestro de Personal — Domain Core Types
 *
 * SPEC §§3–6, §8, §10, §12. Pure TypeScript types and interfaces.
 * Zero external or framework dependencies.
 */

import type {
  EST_A,
  EST_I,
  EST_SIM_A,
  EST_SIM_I,
  EST_SIM_X,
  EST_X,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_ESTREG,
  TABLE_PAIS,
  TABLE_PERSONAL,
} from "@/core/constants";
import type { ErrorCode, FieldFailure } from "@/core/errors";

export type { ErrorCode, FieldFailure };

// ============================================================
// Branded Code Types (SPEC §4.1, §4.3)
// ============================================================

declare const brand: unique symbol;
export type Brand<T, B> = T & { readonly [brand]: B };

export type PaiCod = Brand<string, "PaiCod">;
export type DepCod = Brand<string, "DepCod">;
export type CarCod = Brand<string, "CarCod">;
export type PerCod = Brand<string, "PerCod">;

export const asPaiCod = (value: string): PaiCod => value as PaiCod;
export const asDepCod = (value: string): DepCod => value as DepCod;
export const asCarCod = (value: string): CarCod => value as CarCod;
export const asPerCod = (value: string): PerCod => value as PerCod;

// ============================================================
// EstReg Domain Types (SPEC §4.2, §6)
// ============================================================

export type EstReg = typeof EST_A | typeof EST_I | typeof EST_X;
export type EstRegCod = EstReg;
export type EstRegSim = typeof EST_SIM_A | typeof EST_SIM_I | typeof EST_SIM_X;

// ============================================================
// Table Names (SPEC §4.1)
// ============================================================

export type MaintenanceTable =
  | typeof TABLE_PAIS
  | typeof TABLE_DEPENDENCIA
  | typeof TABLE_CARGO
  | typeof TABLE_PERSONAL;

export type TableName =
  | MaintenanceTable
  | typeof TABLE_ESTREG
  | "PAIS"
  | "DEPENDENCIA"
  | "CARGO"
  | "PERSONAL"
  | "ESTREG";

// ============================================================
// Table Row Interfaces (SPEC §4.1, §10: created_at/updated_at readonly)
// ============================================================

export interface EstRegRow {
  readonly EstRegCod: EstReg;
  readonly EstRegNom: string;
  readonly EstRegSim: EstRegSim;
}

export interface PaisRow {
  readonly PaiCod: PaiCod;
  readonly PaiNom: string;
  readonly PaiEstReg: EstReg;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DependenciaRow {
  readonly DepCod: DepCod;
  readonly DepNom: string;
  readonly DepEstReg: EstReg;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CargoRow {
  readonly CarCod: CarCod;
  readonly CarNom: string;
  readonly CarEstReg: EstReg;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PersonalRow {
  readonly PerCod: PerCod;
  readonly PerNom: string;
  readonly PerDNI: string;
  readonly PerFecNac: string;
  readonly PerPaiCod: PaiCod;
  readonly PerDepCod: DepCod;
  readonly PerCarCod: CarCod;
  readonly PerEstReg: EstReg;
  readonly created_at: string;
  readonly updated_at: string;
}

// ============================================================
// Maintenance Operation Payloads (SPEC §5, §8)
// ============================================================

export interface PaisPayload {
  readonly PaiCod?: string;
  readonly PaiNom: string;
  readonly PaiEstReg?: EstReg;
}

export interface DependenciaPayload {
  readonly DepCod?: string;
  readonly DepNom: string;
  readonly DepEstReg?: EstReg;
}

export interface CargoPayload {
  readonly CarCod?: string;
  readonly CarNom: string;
  readonly CarEstReg?: EstReg;
}

export interface PersonalPayload {
  readonly PerCod?: string;
  readonly PerNom: string;
  readonly PerDNI: string;
  readonly PerFecNac: string;
  readonly PerPaiCod: string;
  readonly PerDepCod: string;
  readonly PerCarCod: string;
  readonly PerEstReg?: EstReg;
}

export type TablePayload =
  | PaisPayload
  | DependenciaPayload
  | CargoPayload
  | PersonalPayload
  | Record<string, unknown>;

// ============================================================
// PendingOp Discriminated Union (SPEC §8)
// ============================================================

export type PendingOpKind =
  | "adición"
  | "modificación"
  | "eliminación"
  | "inactivar"
  | "reactivar";

export interface AdicionOp<
  TTable extends string = TableName,
  TPayload = TablePayload,
> {
  readonly kind: "adición";
  readonly table: TTable;
  readonly payload: TPayload;
  readonly targetCode?: undefined;
}

export interface ModificacionOp<
  TTable extends string = TableName,
  TPayload = TablePayload,
> {
  readonly kind: "modificación";
  readonly table: TTable;
  readonly payload: TPayload;
  readonly targetCode: string;
}

export interface EliminacionOp<TTable extends string = TableName> {
  readonly kind: "eliminación";
  readonly table: TTable;
  readonly targetCode: string;
}

export interface InactivarOp<TTable extends string = TableName> {
  readonly kind: "inactivar";
  readonly table: TTable;
  readonly targetCode: string;
}

export interface ReactivarOp<TTable extends string = TableName> {
  readonly kind: "reactivar";
  readonly table: TTable;
  readonly targetCode: string;
  readonly supervisorCode?: string;
}

export type PendingOp<
  TTable extends string = TableName,
  TPayload = TablePayload,
> =
  | AdicionOp<TTable, TPayload>
  | ModificacionOp<TTable, TPayload>
  | EliminacionOp<TTable>
  | InactivarOp<TTable>
  | ReactivarOp<TTable>;

// ============================================================
// Guardar Result Discriminated Union (SPEC §8.4)
// ============================================================

export interface GuardarSuccess<TRow = unknown> {
  readonly ok: true;
  readonly noop?: boolean;
  readonly row?: TRow;
}

export interface GuardarFailure {
  readonly ok: false;
  readonly failures: readonly FieldFailure[];
}

export type GuardarResult<TRow = unknown> =
  | GuardarSuccess<TRow>
  | GuardarFailure;
