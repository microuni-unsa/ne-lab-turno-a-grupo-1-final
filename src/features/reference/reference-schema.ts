import * as z from "zod";
import {
  ERROR_CODES,
  MAX_NAME,
  MAX_SMALLINT,
  MIN_CODE,
  MIN_NAME,
} from "@/core";
import { getFieldLabel } from "@/lib/error-catalog";

export interface ReferenceSchemaOptions {
  readonly codeField: string;
  readonly nomField: string;
  readonly isUpdate: boolean;
  readonly maxCode?: number;
}

export function createCodeSchema(
  fieldName: string,
  maxLimit: number,
  isUpdate: boolean,
) {
  const label = getFieldLabel(fieldName);
  const requiredSchema = z
    .number({
      error: (issue) =>
        issue.input === undefined || issue.input === null
          ? `[${ERROR_CODES.REQUIRED}] ${label} es obligatorio.`
          : `[${ERROR_CODES.FORMAT}] ${label} debe ser un entero válido.`,
    })
    .int({
      error: `[${ERROR_CODES.FORMAT}] ${label} debe ser un número entero.`,
    })
    .min(MIN_CODE, {
      error: `[${ERROR_CODES.RANGE}] ${label} debe ser al menos ${MIN_CODE}.`,
    })
    .max(maxLimit, {
      error: `[${ERROR_CODES.RANGE}] ${label} debe ser menor o igual a ${maxLimit}.`,
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
  maxCode = MAX_SMALLINT,
}: ReferenceSchemaOptions) {
  return z.object({
    [codeField]: createCodeSchema(codeField, maxCode, isUpdate),
    [nomField]: createNameSchema(nomField),
  });
}
