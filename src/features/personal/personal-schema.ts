import * as z from "zod";
import {
  DNI_LEN,
  ERROR_CODES,
  MIN_AGE,
  MIN_CODE,
  validateDNI,
  validateFecNac,
} from "@/core";
import {
  createCodeSchema,
  createNameSchema,
} from "@/features/reference/reference-schema";
import { formatFieldFailure, getFieldLabel } from "@/lib/error-catalog";

export interface PersonalSchemaOptions {
  readonly isUpdate: boolean;
  readonly todayLocal: string;
}

function createForeignKeySchema(fieldName: string) {
  const label = getFieldLabel(fieldName);
  return z
    .number({
      error: (issue) =>
        issue.input === undefined || issue.input === null
          ? `[${ERROR_CODES.REQUIRED}] Debe seleccionar un valor para ${label}.`
          : `[${ERROR_CODES.FORMAT}] ${label} seleccionado no es válido.`,
    })
    .int({
      error: `[${ERROR_CODES.FORMAT}] ${label} seleccionado no es válido.`,
    })
    .min(MIN_CODE, {
      error: `[${ERROR_CODES.REQUIRED}] Debe seleccionar un valor para ${label}.`,
    });
}

/**
 * Zod v4 schema for PERSONAL maintenance (SPEC §5.3, §5.4, §12).
 * Uses injected `todayLocal` (YYYY-MM-DD) for pure MIN_AGE evaluation.
 */
export function createPersonalSchema({
  isUpdate,
  todayLocal,
}: PersonalSchemaOptions) {
  const dniLabel = getFieldLabel("PerDNI");
  const fecNacLabel = getFieldLabel("PerFecNac");

  return z.object({
    PerCod: createCodeSchema("PerCod", isUpdate),
    PerNom: createNameSchema("PerNom"),
    PerDNI: z
      .string({
        error: (issue) =>
          issue.input === undefined || issue.input === null
            ? `[${ERROR_CODES.REQUIRED}] ${dniLabel} es obligatorio.`
            : `[${ERROR_CODES.FORMAT}] ${dniLabel} debe tener ${DNI_LEN} dígitos numéricos.`,
      })
      .trim()
      .check((ctx) => {
        const failures = validateDNI(ctx.value, "PerDNI");
        for (const failure of failures) {
          const formatted = formatFieldFailure(failure);
          ctx.issues.push({
            code: "custom",
            input: ctx.value,
            message: `[${failure.code}] ${formatted.message} (${DNI_LEN} dígitos)`,
          });
        }
      }),
    PerFecNac: z
      .string({
        error: (issue) =>
          issue.input === undefined || issue.input === null
            ? `[${ERROR_CODES.REQUIRED}] ${fecNacLabel} es obligatorio.`
            : `[${ERROR_CODES.FORMAT}] ${fecNacLabel} debe tener formato YYYY-MM-DD.`,
      })
      .trim()
      .check((ctx) => {
        const failures = validateFecNac(ctx.value, todayLocal, "PerFecNac");
        for (const failure of failures) {
          const formatted = formatFieldFailure(failure);
          ctx.issues.push({
            code: "custom",
            input: ctx.value,
            message: `[${failure.code}] ${formatted.message} (mínimo ${MIN_AGE} años)`,
          });
        }
      }),
    PerPaiCod: createForeignKeySchema("PerPaiCod"),
    PerDepCod: createForeignKeySchema("PerDepCod"),
    PerCarCod: createForeignKeySchema("PerCarCod"),
  });
}

export type PersonalFormValues = z.infer<
  ReturnType<typeof createPersonalSchema>
>;
