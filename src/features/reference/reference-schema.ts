import * as z from "zod";
import { ERROR_CODES, MAX_NAME, MIN_CODE, MIN_NAME } from "@/core";
import { getFieldLabel } from "@/lib/error-catalog";

export interface ReferenceSchemaOptions {
  readonly codeField: string;
  readonly nomField: string;
  readonly isUpdate: boolean;
}

export function createCodeSchema(fieldName: string, isUpdate: boolean) {
  const label = getFieldLabel(fieldName);
  const codeSchema = z
    .number({
      error: (issue) =>
        issue.input === undefined || issue.input === null
          ? `[${ERROR_CODES.REQUIRED}] ${label} es obligatorio.`
          : `[${ERROR_CODES.FORMAT}] ${label} debe ser un número entero.`,
    })
    .int({
      error: `[${ERROR_CODES.FORMAT}] ${label} debe ser un número entero.`,
    })
    .min(MIN_CODE, {
      error: `[${ERROR_CODES.RANGE}] ${label} debe ser mayor a 0.`,
    });

  return isUpdate ? codeSchema : codeSchema.optional();
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
}: ReferenceSchemaOptions) {
  return z.object({
    [codeField]: createCodeSchema(codeField, isUpdate),
    [nomField]: createNameSchema(nomField),
  });
}
