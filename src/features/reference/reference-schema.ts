import * as z from "zod";
import { ERROR_CODES, MAX_CODE_LEN, MAX_NAME, MIN_NAME } from "@/core";
import { getFieldLabel } from "@/lib/error-catalog";

export interface ReferenceSchemaOptions {
  readonly codeField: string;
  readonly nomField: string;
  readonly isUpdate: boolean;
  readonly maxCode?: number;
}

export function createCodeSchema(
  fieldName: string,
  _maxLimit: number,
  isUpdate: boolean,
) {
  const label = getFieldLabel(fieldName);
  const requiredSchema = z
    .string({
      error: (issue) =>
        issue.input === undefined || issue.input === null
          ? `[${ERROR_CODES.REQUIRED}] ${label} es obligatorio.`
          : `[${ERROR_CODES.FORMAT}] ${label} debe ser texto válido.`,
    })
    .trim()
    .min(1, {
      error: `[${ERROR_CODES.REQUIRED}] ${label} es obligatorio.`,
    })
    .max(MAX_CODE_LEN, {
      error: `[${ERROR_CODES.RANGE}] ${label} debe tener máximo ${MAX_CODE_LEN} caracteres.`,
    })
    .regex(/^[A-Za-z0-9._-]+$/, {
      error: `[${ERROR_CODES.FORMAT}] ${label} solo puede contener letras, números, punto, guión o guión bajo.`,
    });

  return isUpdate ? requiredSchema.optional() : requiredSchema;
}

export function createNameSchema(fieldName: string) {
  const label = getFieldLabel(fieldName);
  return z
    .string({
      error: (issue) =>
        issue.input === undefined || issue.input === null
          ? `[${ERROR_CODES.REQUIRED}] ${label} es obligatorio.`
          : `[${ERROR_CODES.FORMAT}] ${label} debe ser texto válido.`,
    })
    .trim()
    .min(1, {
      error: `[${ERROR_CODES.REQUIRED}] ${label} es obligatorio y no puede quedar vacío.`,
    })
    .min(MIN_NAME, {
      error: `[${ERROR_CODES.RANGE}] ${label} debe tener al menos ${MIN_NAME} caracteres.`,
    })
    .max(MAX_NAME, {
      error: `[${ERROR_CODES.RANGE}] ${label} debe tener máximo ${MAX_NAME} caracteres.`,
    });
}

/**
 * Zod v4 schema factory for reference tables (PAIS, DEPENDENCIA, CARGO).
 * Consumes SPEC §3 limits exclusively from @/core without duplicating constants.
 */
export function createReferenceSchema({
  codeField,
  nomField,
  isUpdate,
  maxCode = MAX_CODE_LEN,
}: ReferenceSchemaOptions) {
  return z.object({
    [codeField]: createCodeSchema(codeField, maxCode, isUpdate),
    [nomField]: createNameSchema(nomField),
  });
}
