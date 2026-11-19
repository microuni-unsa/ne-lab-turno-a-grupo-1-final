/**
 * Maestro de Personal — Record Lifecycle State Machine
 *
 * SPEC §6 Normative record-state lifecycle and transition table §6.1.
 * Exhaustive branching: unknown op/state combinations fail fast with E-TRANSITION.
 */

import {
  EST_A,
  EST_I,
  EST_X,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
  TABLE_PERSONAL,
} from "@/core/constants";
import { ERROR_CODES, type FieldFailure } from "@/core/errors";
import type { EstReg, TableName } from "@/core/types";

export interface TransitionRule {
  readonly allowed: boolean;
  readonly nextState?: EstReg;
}

export type LifecycleOp =
  | "modificación"
  | "inactivar"
  | "reactivar"
  | "eliminación"
  | "adición";

/**
 * SPEC §6.1 Transition table as pure data.
 * Exhaustive matrix for all current states (A=1, I=2, *=3).
 */
export const TRANSITION_TABLE: Readonly<
  Record<
    "modificación" | "inactivar" | "reactivar" | "eliminación",
    Readonly<Record<EstReg, TransitionRule>>
  >
> = {
  modificación: {
    [EST_A]: { allowed: true, nextState: EST_A },
    [EST_I]: { allowed: true, nextState: EST_I },
    [EST_X]: { allowed: false },
  },
  inactivar: {
    [EST_A]: { allowed: true, nextState: EST_I },
    [EST_I]: { allowed: false },
    [EST_X]: { allowed: false },
  },
  reactivar: {
    [EST_A]: { allowed: false },
    [EST_I]: { allowed: true, nextState: EST_A },
    [EST_X]: { allowed: false },
  },
  eliminación: {
    [EST_A]: { allowed: true, nextState: EST_X },
    [EST_I]: { allowed: true, nextState: EST_X },
    [EST_X]: { allowed: false },
  },
} as const;

/**
 * Normalizes operation string variants (e.g. 'Modificar', 'modificacion')
 * to standard LifecycleOp keys.
 */
export function normalizeLifecycleOp(op: string): LifecycleOp | null {
  const normalized = op.trim().toLowerCase();
  switch (normalized) {
    case "modificación":
    case "modificacion":
    case "modificar":
      return "modificación";
    case "inactivar":
      return "inactivar";
    case "reactivar":
      return "reactivar";
    case "eliminación":
    case "eliminacion":
    case "eliminar":
      return "eliminación";
    case "adición":
    case "adicion":
    case "adicionar":
      return "adición";
    default:
      return null;
  }
}

function isEstReg(value: number): value is EstReg {
  return value === EST_A || value === EST_I || value === EST_X;
}

/**
 * Resolves a lifecycle transition rule cleanly, returning null when the state
 * or operation name is outside the SPEC §6.1 matrix.
 */
function resolveTransitionOutcome(
  op: string,
  current: EstReg | number,
): TransitionRule | null {
  if (!isEstReg(current)) {
    return null;
  }

  const normalized = normalizeLifecycleOp(op);
  if (normalized === null) {
    return null;
  }

  if (normalized === "adición") {
    return { allowed: true, nextState: EST_A };
  }

  return TRANSITION_TABLE[normalized][current];
}

/**
 * SPEC §6.1: Checks if an operation is allowed given current record state.
 * Returns true if allowed, false otherwise.
 */
export function canTransition(
  op: string,
  current: EstReg | number,
  options?: { readonly supervisorAuthorized?: boolean },
): boolean {
  if (
    options?.supervisorAuthorized === true &&
    normalizeLifecycleOp(op) === "reactivar" &&
    current === EST_X
  ) {
    return true;
  }
  const outcome = resolveTransitionOutcome(op, current);
  return outcome?.allowed ?? false;
}

/**
 * SPEC §6.1: Returns the next EstReg state resulting from an allowed transition.
 * Throws E-TRANSITION failure object if forbidden or unknown.
 */
export function getNextState(op: string, current: EstReg | number): EstReg {
  const outcome = resolveTransitionOutcome(op, current);

  if (!outcome?.allowed || outcome.nextState === undefined) {
    throw {
      code: ERROR_CODES.TRANSITION,
      field: "EstReg",
    } satisfies FieldFailure;
  }

  return outcome.nextState;
}

/**
 * SPEC §6.1: Asserts that an operation is allowed from the current state.
 * Throws E-TRANSITION failure object if forbidden.
 */
export function assertTransition(
  op: string,
  current: EstReg | number,
  fieldName: string = "EstReg",
): void {
  if (!canTransition(op, current)) {
    throw {
      code: ERROR_CODES.TRANSITION,
      field: fieldName,
    } satisfies FieldFailure;
  }
}

// ============================================================
// Adición Forces Activo Helpers (SPEC §5.1, §6, R9)
// ============================================================

/**
 * Constant for the forced initial state on Adición.
 */
export const ADICION_FORCED_STATE: EstReg = EST_A;

/**
 * Returns EST_A (1) for Adición operations.
 * Cites SPEC §6, R9: Adición always persists EST_A regardless of any other input.
 */
export function forceAdicionState(): EstReg {
  return EST_A;
}

/**
 * Returns the state field name for a given table.
 */
export function getStateFieldName(table: TableName): string {
  const normalized = table.toLowerCase();
  switch (normalized) {
    case TABLE_PAIS:
      return "PaiEstReg";
    case TABLE_DEPENDENCIA:
      return "DepEstReg";
    case TABLE_CARGO:
      return "CarEstReg";
    case TABLE_PERSONAL:
      return "PerEstReg";
    default:
      return "EstReg";
  }
}

/**
 * Forces the table's EstReg field to EST_A in a payload object.
 * Cites SPEC §6, R9.
 */
export function applyAdicionState<T extends Record<string, unknown>>(
  table: TableName,
  payload: T,
): T {
  const stateField = getStateFieldName(table);
  return {
    ...payload,
    [stateField]: EST_A,
  };
}
