/**
 * Maestro de Personal — Domain Error Model
 *
 * SPEC §12 Normative error codes and types.
 * Fail fast, no silent defaults, no message strings.
 * Surfaces own human-readable presentation copy; domain layer uses only code + field.
 */

export const ERROR_CODES = {
  PENDING: "E-PENDING",
  REQUIRED: "E-REQUIRED",
  FORMAT: "E-FORMAT",
  RANGE: "E-RANGE",
  DUP: "E-DUP",
  REF: "E-REF",
  REF_STATE: "E-REF-STATE",
  REF_BLOCKED: "E-REF-BLOCKED",
  TRANSITION: "E-TRANSITION",
  AUTH_SUPERVISOR: "E-AUTH-SUPERVISOR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const E_PENDING: ErrorCode = ERROR_CODES.PENDING;
export const E_REQUIRED: ErrorCode = ERROR_CODES.REQUIRED;
export const E_FORMAT: ErrorCode = ERROR_CODES.FORMAT;
export const E_RANGE: ErrorCode = ERROR_CODES.RANGE;
export const E_DUP: ErrorCode = ERROR_CODES.DUP;
export const E_REF: ErrorCode = ERROR_CODES.REF;
export const E_REF_STATE: ErrorCode = ERROR_CODES.REF_STATE;
export const E_REF_BLOCKED: ErrorCode = ERROR_CODES.REF_BLOCKED;
export const E_TRANSITION: ErrorCode = ERROR_CODES.TRANSITION;
export const E_AUTH_SUPERVISOR: ErrorCode = ERROR_CODES.AUTH_SUPERVISOR;

/**
 * SPEC §12, R22: Every failure reports its code + offending field.
 * No human-readable message strings in the domain core.
 */
export interface FieldFailure {
  readonly code: ErrorCode;
  readonly field: string;
}

/**
 * Type guard for FieldFailure.
 */
export function isFieldFailure(value: unknown): value is FieldFailure {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("field" in value) || typeof value.field !== "string") {
    return false;
  }
  if (!("code" in value) || typeof value.code !== "string") {
    return false;
  }
  return Object.values(ERROR_CODES).some((code) => code === value.code);
}

/**
 * Creates a FieldFailure representation.
 */
export function createFailure(code: ErrorCode, field: string): FieldFailure {
  return { code, field };
}
