/**
 * Maestro de Personal — Domain Validators
 *
 * SPEC §5, §12. Pure validation functions.
 * Framework-agnostic, zero I/O, no Date.now() side effects.
 * Reports all failures in batch (R22), never throws on data validation errors.
 */

import {
  DNI_LEN,
  EST_A,
  EST_I,
  EST_X,
  MAX_INTEGER,
  MAX_NAME,
  MAX_SMALLINT,
  MIN_AGE,
  MIN_CODE,
  MIN_NAME,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_ESTREG,
  TABLE_PAIS,
  TABLE_PERSONAL,
} from "@/core/constants";
import { ERROR_CODES, type FieldFailure } from "@/core/errors";
import type {
  CargoRow,
  DependenciaRow,
  PaisRow,
  PersonalRow,
  TableName,
} from "@/core/types";

const TABLE_CODE_META: Readonly<
  Record<
    Lowercase<TableName>,
    { readonly codeField: string; readonly maxLimit: number }
  >
> = {
  [TABLE_PAIS]: { codeField: "PaiCod", maxLimit: MAX_SMALLINT },
  [TABLE_DEPENDENCIA]: { codeField: "DepCod", maxLimit: MAX_SMALLINT },
  [TABLE_CARGO]: { codeField: "CarCod", maxLimit: MAX_SMALLINT },
  [TABLE_PERSONAL]: { codeField: "PerCod", maxLimit: MAX_INTEGER },
  [TABLE_ESTREG]: { codeField: "EstRegCod", maxLimit: MAX_SMALLINT },
};

function resolveTableCodeMeta(table: TableName): {
  readonly codeField: string;
  readonly maxLimit: number;
} {
  const normalized = table.toLowerCase();
  if (
    normalized === TABLE_PAIS ||
    normalized === TABLE_DEPENDENCIA ||
    normalized === TABLE_CARGO ||
    normalized === TABLE_PERSONAL ||
    normalized === TABLE_ESTREG
  ) {
    return TABLE_CODE_META[normalized];
  }
  throw new Error(`Unknown table for code metadata: ${table}`);
}

/**
 * Returns the default primary key field name for a given table.
 * Cites SPEC §4.1.
 */
export function getCodeFieldName(table: TableName): string {
  return resolveTableCodeMeta(table).codeField;
}

/**
 * Returns the maximum integer allowed for a table's primary key.
 * Reference tables use SMALLINT (<= 32767); PERSONAL uses INTEGER (<= 2147483647).
 * Cites SPEC §4.1.
 */
export function getMaxCodeLimit(table: TableName): number {
  return resolveTableCodeMeta(table).maxLimit;
}

/**
 * Validates a table primary key or foreign key code value.
 * SPEC §4.1, §4.3, §5, §12.
 * Positive integer, range <= 32767 for reference tables and <= 2147483647 for personal.
 */
export function validateCode(
  table: TableName,
  value: unknown,
  fieldName?: string,
): FieldFailure[] {
  const field = fieldName ?? getCodeFieldName(table);
  const maxLimit = getMaxCodeLimit(table);

  if (value === undefined || value === null) {
    return [{ code: ERROR_CODES.REQUIRED, field }];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [{ code: ERROR_CODES.REQUIRED, field }];
    }
    if (!/^-?\d+$/.test(trimmed)) {
      return [{ code: ERROR_CODES.FORMAT, field }];
    }
    const num = Number(trimmed);
    if (!Number.isSafeInteger(num)) {
      return [{ code: ERROR_CODES.RANGE, field }];
    }
    if (num < MIN_CODE || num > maxLimit) {
      return [{ code: ERROR_CODES.RANGE, field }];
    }
    return [];
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return [{ code: ERROR_CODES.FORMAT, field }];
    }
    if (value < MIN_CODE || value > maxLimit) {
      return [{ code: ERROR_CODES.RANGE, field }];
    }
    return [];
  }

  return [{ code: ERROR_CODES.FORMAT, field }];
}

/**
 * Validates a name field (PaiNom, DepNom, CarNom, PerNom).
 * SPEC §3, §5, §12.
 * Required, trimmed length between MIN_NAME (2) and MAX_NAME (100).
 */
export function validateNom(
  value: unknown,
  fieldName: string = "Nom",
): FieldFailure[] {
  if (value === undefined || value === null) {
    return [{ code: ERROR_CODES.REQUIRED, field: fieldName }];
  }

  if (typeof value !== "string") {
    return [{ code: ERROR_CODES.FORMAT, field: fieldName }];
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return [{ code: ERROR_CODES.REQUIRED, field: fieldName }];
  }

  if (trimmed.length < MIN_NAME || trimmed.length > MAX_NAME) {
    return [{ code: ERROR_CODES.RANGE, field: fieldName }];
  }

  return [];
}

/**
 * Validates a DNI field (PerDNI).
 * SPEC §3, §5.3, §12.
 * Required, exactly DNI_LEN (8) ASCII digits.
 * R22 batch reporting: reports both E-FORMAT and E-RANGE if both violated.
 */
export function validateDNI(
  value: unknown,
  fieldName: string = "PerDNI",
): FieldFailure[] {
  if (value === undefined || value === null) {
    return [{ code: ERROR_CODES.REQUIRED, field: fieldName }];
  }

  if (typeof value !== "string") {
    return [{ code: ERROR_CODES.FORMAT, field: fieldName }];
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return [{ code: ERROR_CODES.REQUIRED, field: fieldName }];
  }

  const failures: FieldFailure[] = [];
  const isDigitsOnly = /^\d+$/.test(trimmed);
  if (!isDigitsOnly) {
    failures.push({ code: ERROR_CODES.FORMAT, field: fieldName });
  }

  if (trimmed.length !== DNI_LEN) {
    failures.push({ code: ERROR_CODES.RANGE, field: fieldName });
  }

  return failures;
}

/**
 * Validates a birthdate field (PerFecNac).
 * SPEC §3, §5.3, §12.
 * Required, valid calendar date YYYY-MM-DD, strictly past AND age >= MIN_AGE (18).
 * Pure: age is computed strictly against injected `todayLocal` string (no Date.now() inside).
 */
export function validateFecNac(
  value: unknown,
  todayLocal: string,
  fieldName: string = "PerFecNac",
): FieldFailure[] {
  if (value === undefined || value === null) {
    return [{ code: ERROR_CODES.REQUIRED, field: fieldName }];
  }

  if (typeof value !== "string") {
    return [{ code: ERROR_CODES.FORMAT, field: fieldName }];
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return [{ code: ERROR_CODES.REQUIRED, field: fieldName }];
  }

  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return [{ code: ERROR_CODES.FORMAT, field: fieldName }];
  }

  const birthYear = parseInt(dateMatch[1], 10);
  const birthMonth = parseInt(dateMatch[2], 10);
  const birthDay = parseInt(dateMatch[3], 10);

  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
    return [{ code: ERROR_CODES.FORMAT, field: fieldName }];
  }

  const maxDaysInMonth = new Date(
    Date.UTC(birthYear, birthMonth, 0),
  ).getUTCDate();
  if (birthDay > maxDaysInMonth) {
    return [{ code: ERROR_CODES.FORMAT, field: fieldName }];
  }

  const todayMatch = todayLocal.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!todayMatch) {
    throw new Error(
      "validateFecNac requires a valid todayLocal string in YYYY-MM-DD format",
    );
  }

  const todayYear = parseInt(todayMatch[1], 10);
  const todayMonth = parseInt(todayMatch[2], 10);
  const todayDay = parseInt(todayMatch[3], 10);

  // Strictly past requirement: PerFecNac < todayLocal
  if (trimmed >= todayLocal.trim()) {
    return [{ code: ERROR_CODES.RANGE, field: fieldName }];
  }

  // Age calculation: today - birthdate >= MIN_AGE (18)
  let age = todayYear - birthYear;
  if (
    todayMonth < birthMonth ||
    (todayMonth === birthMonth && todayDay < birthDay)
  ) {
    age -= 1;
  }

  if (age < MIN_AGE) {
    return [{ code: ERROR_CODES.RANGE, field: fieldName }];
  }

  return [];
}

function validateEstRegValue(
  value: unknown,
  fieldName: string,
): FieldFailure[] {
  if (value === undefined) {
    return [];
  }
  if (value !== EST_A && value !== EST_I && value !== EST_X) {
    return [{ code: ERROR_CODES.RANGE, field: fieldName }];
  }
  return [];
}

function validateReferenceRow(
  table: typeof TABLE_PAIS | typeof TABLE_DEPENDENCIA | typeof TABLE_CARGO,
  codeField: "PaiCod" | "DepCod" | "CarCod",
  nomField: "PaiNom" | "DepNom" | "CarNom",
  estField: "PaiEstReg" | "DepEstReg" | "CarEstReg",
  row: Record<string, unknown>,
  options: { isUpdate?: boolean } = {},
): FieldFailure[] {
  const failures: FieldFailure[] = [];
  const codeValue: unknown = Object.getOwnPropertyDescriptor(
    row,
    codeField,
  )?.value;
  const nomValue: unknown = Object.getOwnPropertyDescriptor(
    row,
    nomField,
  )?.value;
  const estValue: unknown = Object.getOwnPropertyDescriptor(
    row,
    estField,
  )?.value;

  if (!options.isUpdate || codeValue !== undefined) {
    failures.push(...validateCode(table, codeValue, codeField));
  }

  failures.push(...validateNom(nomValue, nomField));
  failures.push(...validateEstRegValue(estValue, estField));

  return failures;
}

/**
 * Validates a full PAIS row or payload.
 * SPEC §5.1, §12.
 */
export function validatePaisRow(
  row: Partial<PaisRow> | Record<string, unknown>,
  options: { isUpdate?: boolean } = {},
): FieldFailure[] {
  return validateReferenceRow(
    TABLE_PAIS,
    "PaiCod",
    "PaiNom",
    "PaiEstReg",
    row,
    options,
  );
}

/**
 * Validates a full DEPENDENCIA row or payload.
 * SPEC §5.1, §12.
 */
export function validateDependenciaRow(
  row: Partial<DependenciaRow> | Record<string, unknown>,
  options: { isUpdate?: boolean } = {},
): FieldFailure[] {
  return validateReferenceRow(
    TABLE_DEPENDENCIA,
    "DepCod",
    "DepNom",
    "DepEstReg",
    row,
    options,
  );
}

/**
 * Validates a full CARGO row or payload.
 * SPEC §5.1, §12.
 */
export function validateCargoRow(
  row: Partial<CargoRow> | Record<string, unknown>,
  options: { isUpdate?: boolean } = {},
): FieldFailure[] {
  return validateReferenceRow(
    TABLE_CARGO,
    "CarCod",
    "CarNom",
    "CarEstReg",
    row,
    options,
  );
}

/**
 * Validates a full PERSONAL row or payload.
 * SPEC §5.3, §5.4, §12.
 * Pure function: todayLocal is mandatory for age calculation.
 */
export function validatePersonalRow(
  row: Partial<PersonalRow> | Record<string, unknown>,
  options: { todayLocal: string; isUpdate?: boolean },
): FieldFailure[] {
  if (!options || typeof options.todayLocal !== "string") {
    throw new Error(
      "validatePersonalRow requires options.todayLocal YYYY-MM-DD",
    );
  }

  const failures: FieldFailure[] = [];

  if (!options.isUpdate || row.PerCod !== undefined) {
    failures.push(...validateCode(TABLE_PERSONAL, row.PerCod, "PerCod"));
  }

  failures.push(...validateNom(row.PerNom, "PerNom"));
  failures.push(...validateDNI(row.PerDNI, "PerDNI"));
  failures.push(
    ...validateFecNac(row.PerFecNac, options.todayLocal, "PerFecNac"),
  );

  failures.push(...validateCode(TABLE_PAIS, row.PerPaiCod, "PerPaiCod"));
  failures.push(...validateCode(TABLE_DEPENDENCIA, row.PerDepCod, "PerDepCod"));
  failures.push(...validateCode(TABLE_CARGO, row.PerCarCod, "PerCarCod"));

  if (row.PerEstReg !== undefined) {
    if (
      row.PerEstReg !== EST_A &&
      row.PerEstReg !== EST_I &&
      row.PerEstReg !== EST_X
    ) {
      failures.push({ code: ERROR_CODES.RANGE, field: "PerEstReg" });
    }
  }

  return failures;
}

/**
 * Generic row validator routing to the corresponding table validator.
 * SPEC §5, §12.
 */
export function validateRow(
  table: TableName,
  row: Record<string, unknown>,
  options: { todayLocal?: string; isUpdate?: boolean } = {},
): FieldFailure[] {
  const normalized = table.toLowerCase();
  switch (normalized) {
    case TABLE_PAIS:
      return validatePaisRow(row, { isUpdate: options.isUpdate });
    case TABLE_DEPENDENCIA:
      return validateDependenciaRow(row, { isUpdate: options.isUpdate });
    case TABLE_CARGO:
      return validateCargoRow(row, { isUpdate: options.isUpdate });
    case TABLE_PERSONAL:
      if (!options.todayLocal) {
        throw new Error("Validating personal row requires options.todayLocal");
      }
      return validatePersonalRow(row, {
        todayLocal: options.todayLocal,
        isUpdate: options.isUpdate,
      });
    default:
      throw new Error(`Unsupported table for validation: ${table}`);
  }
}
