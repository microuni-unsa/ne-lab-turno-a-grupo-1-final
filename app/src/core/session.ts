/**
 * Maestro de Personal — Maintenance Session Machine
 *
 * SPEC §8 Normative maintenance session rules and invariants.
 * Pure state machine: performs zero I/O itself, takes injected async callbacks.
 * Invariants:
 * - Exactly one pending operation at a time.
 * - start(op) with pending -> E-PENDING failure.
 * - salir() with pending -> E-PENDING failure.
 * - guardar() without pending -> { ok: true, noop: true }.
 * - cancel() always ok, zero side effects.
 */

import { ERROR_CODES, type FieldFailure } from "./errors";
import type { EstReg, GuardarResult, PendingOp, TableName } from "./types";
import { canTransition } from "./lifecycle";

export interface SessionCallbacks<
  TTable extends string = TableName,
  TRow = unknown,
> {
  /**
   * Optional async domain validator callback invoked during guardar().
   * Returns an array of FieldFailures (empty if valid).
   */
  readonly validate?: (
    op: PendingOp<TTable>,
  ) => Promise<readonly FieldFailure[]> | readonly FieldFailure[];

  /**
   * Optional async storage commit callback invoked during guardar() upon successful validation.
   * Returns the committed row representation or void.
   */
  readonly commit?: (op: PendingOp<TTable>) => Promise<TRow> | TRow;
}

export type SessionOpResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: readonly FieldFailure[] };

/**
 * Pure maintenance session state machine.
 * Cites SPEC §8.
 */
export class MaintenanceSession<
  TTable extends string = TableName,
  TRow = unknown,
> {
  private _pending: PendingOp<TTable> | null = null;

  constructor(
    readonly table: TTable,
    private readonly callbacks: SessionCallbacks<TTable, TRow> = {},
  ) {}

  /**
   * Returns a snapshot of the current pending operation, or null if none.
   * Cites SPEC §8: exposes pending snapshot for presentation surfaces.
   */
  get pending(): PendingOp<TTable> | null {
    if (this._pending === null) {
      return null;
    }
    return { ...this._pending };
  }

  /**
   * Returns true if there is an uncommitted operation pending.
   */
  get hasPending(): boolean {
    return this._pending !== null;
  }

  /**
   * Starts a new maintenance operation.
   * Cites SPEC §8, §8.1–§8.3.
   * If an operation is already pending, returns E-PENDING failure.
   * If targetCurrentState is passed and transition is forbidden per §6.1, returns E-TRANSITION.
   */
  start(op: PendingOp<TTable>, targetCurrentState?: EstReg): SessionOpResult {
    if (this._pending !== null) {
      return {
        ok: false,
        failures: [{ code: ERROR_CODES.PENDING, field: "session" }],
      };
    }

    if (targetCurrentState !== undefined && op.kind !== "adición") {
      const allowed = canTransition(op.kind, targetCurrentState);
      if (!allowed) {
        return {
          ok: false,
          failures: [{ code: ERROR_CODES.TRANSITION, field: "EstReg" }],
        };
      }
    }

    this._pending = op;
    return { ok: true };
  }

  /**
   * Updates the payload of the active pending operation.
   * Returns true if applied, false if no pending operation exists.
   */
  updatePayload(newPayload: unknown): boolean {
    if (this._pending === null) {
      return false;
    }
    this._pending = {
      ...this._pending,
      payload: newPayload,
    } as PendingOp<TTable>;
    return true;
  }

  /**
   * Discards the pending operation if any.
   * Cites SPEC §8.5: always succeeds with zero writes and zero side effects.
   */
  cancel(): { readonly ok: true } {
    this._pending = null;
    return { ok: true };
  }

  /**
   * Spanish alias for cancel().
   * Cites SPEC §8.5.
   */
  cancelar(): { readonly ok: true } {
    return this.cancel();
  }

  /**
   * Ends the maintenance session.
   * Cites SPEC §8.7: returns E-PENDING if an operation is pending.
   */
  salir(): SessionOpResult {
    if (this._pending !== null) {
      return {
        ok: false,
        failures: [{ code: ERROR_CODES.PENDING, field: "session" }],
      };
    }
    return { ok: true };
  }

  /**
   * Commits the pending operation atomically.
   * Cites SPEC §8.4:
   * - Without pending: success no-op { ok: true, noop: true }.
   * - On validation or commit failure: leaves pending open and returns failures.
   * - On success: clears pending and returns { ok: true, noop: false, row }.
   */
  async guardar(
    overrideCallbacks?: SessionCallbacks<TTable, TRow>,
  ): Promise<GuardarResult<TRow>> {
    if (this._pending === null) {
      return { ok: true, noop: true };
    }

    const op = this._pending;
    const validateFn = overrideCallbacks?.validate ?? this.callbacks.validate;
    const commitFn = overrideCallbacks?.commit ?? this.callbacks.commit;

    if (validateFn !== undefined) {
      const failures = await validateFn(op);
      if (failures.length > 0) {
        // Pending remains open per SPEC §8.4
        return { ok: false, failures };
      }
    }

    let committedRow: TRow | undefined;
    if (commitFn !== undefined) {
      try {
        committedRow = await commitFn(op);
      } catch (error: unknown) {
        if (Array.isArray(error)) {
          return { ok: false, failures: error as readonly FieldFailure[] };
        }
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          "field" in error
        ) {
          return { ok: false, failures: [error as FieldFailure] };
        }
        throw error;
      }
    }

    // Success: clear pending state
    this._pending = null;
    return { ok: true, noop: false, row: committedRow };
  }
}
