/**
 * Maestro de Personal — Domain Core Constants
 *
 * SPEC §3 Normative constants. Single source of truth.
 * Every other core module and app component imports from here.
 */

/**
 * SPEC §3, §5.4: Exactly 8 ASCII digits.
 */
export const DNI_LEN = 8 as const;

/**
 * SPEC §3, §5: Minimum length of trimmed Name fields.
 */
export const MIN_NAME = 2 as const;

/**
 * SPEC §3, §5: Maximum length of Name fields.
 */
export const MAX_NAME = 100 as const;

/**
 * SPEC §3, §5.4: Minimum age requirement in years.
 * PerFecNac must satisfy: PerFecNac <= today - 18y.
 */
export const MIN_AGE = 18 as const;

/**
 * SPEC §3, §4.2, §6: ESTREG code for Activo (logical symbol 'A').
 */
export const EST_A = 1 as const;

/**
 * SPEC §3, §4.2, §6: ESTREG code for Inactivo (logical symbol 'I').
 */
export const EST_I = 2 as const;

/**
 * SPEC §3, §4.2, §6: ESTREG code for Eliminado (logical symbol '*').
 */
export const EST_X = 3 as const;

/**
 * SPEC §4.2: Logical symbol for Activo.
 */
export const EST_SIM_A = "A" as const;

/**
 * SPEC §4.2: Logical symbol for Inactivo.
 */
export const EST_SIM_I = "I" as const;

/**
 * SPEC §4.2: Logical symbol for Eliminado.
 */
export const EST_SIM_X = "*" as const;

/**
 * SPEC §4.1: Minimum positive integer code for all tables.
 */
export const MIN_CODE = 1 as const;

/**
 * Maximum length of alphanumeric string primary/foreign key codes.
 */
export const MAX_CODE_LEN = 16 as const;

/**
 * SPEC §4.1: Maximum value for Postgres SMALLINT (used by PAIS, DEPENDENCIA, CARGO).
 */
export const MAX_SMALLINT = 32767 as const;

/**
 * SPEC §4.1: Maximum value for Postgres INTEGER (used by PERSONAL).
 */
export const MAX_INTEGER = 2147483647 as const;

/**
 * SPEC §4.1: Canonical table names.
 */
export const TABLE_PAIS = "pais" as const;
export const TABLE_DEPENDENCIA = "dependencia" as const;
export const TABLE_CARGO = "cargo" as const;
export const TABLE_PERSONAL = "personal" as const;
export const TABLE_ESTREG = "estreg" as const;
