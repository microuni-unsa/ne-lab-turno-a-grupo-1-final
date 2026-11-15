/**
 * Maestro de Personal — PostgREST & RPC Error Mapping
 *
 * Maps residual DB / PostgREST errors and transport failures into domain FieldFailure (SPEC §12).
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { createFailure, ERROR_CODES, type FieldFailure } from "@/core/errors";
import type { GuardarResult } from "@/core/types";

/**
 * Returns today's local date string YYYY-MM-DD for birthdate validations.
 */
export function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inferFieldFromText(text: string, defaultField: string): string {
  if (text.includes("PerPaiCod") || text.includes("PaiCod")) {
    return defaultField === "PerCod" ? "PerPaiCod" : "PaiCod";
  }
  if (text.includes("PerDepCod") || text.includes("DepCod")) {
    return defaultField === "PerCod" ? "PerDepCod" : "DepCod";
  }
  if (text.includes("PerCarCod") || text.includes("CarCod")) {
    return defaultField === "PerCod" ? "PerCarCod" : "CarCod";
  }
  if (text.includes("PaiNom") || text.includes("pais_nom_ci")) {
    return "PaiNom";
  }
  if (text.includes("DepNom") || text.includes("dependencia_nom_ci")) {
    return "DepNom";
  }
  if (text.includes("CarNom") || text.includes("cargo_nom_ci")) {
    return "CarNom";
  }
  if (text.includes("PerNom")) {
    return "PerNom";
  }
  if (text.includes("PerDNI")) {
    return "PerDNI";
  }
  if (text.includes("PerFecNac")) {
    return "PerFecNac";
  }
  if (text.includes("EstRegSim")) {
    return "EstRegSim";
  }
  return defaultField;
}

function defaultNomFieldFor(defaultField: string): string {
  switch (defaultField) {
    case "PaiCod":
      return "PaiNom";
    case "DepCod":
      return "DepNom";
    case "CarCod":
      return "CarNom";
    case "PerCod":
      return "PerNom";
    default:
      return "Nom";
  }
}

/**
 * Maps residual DB / PostgREST errors into domain FieldFailure (SPEC §12).
 * 23505 -> E-DUP
 * 23503 -> E-REF
 * 23514 -> E-RANGE / E-FORMAT by constraint
 * 23502 -> E-REQUIRED
 * 22001 / 22003 -> E-RANGE
 * RPC-raised `E-*: message` prefixes -> same code with specific field resolution
 */
export function mapPostgrestError(
  error:
    | PostgrestError
    | { code?: string; message?: string; details?: string | null },
  defaultField: string = "general",
): FieldFailure {
  const msg = error.message || "";
  const details = error.details || "";
  const code = error.code || "";
  const combined = `${msg} ${details}`;

  // 1. RPC-raised exceptions with "E-*: message" prefix
  const rpcMatch = msg.match(/^(E-[A-Z0-9-]+)(?::\s*(.*))?$/);
  if (rpcMatch) {
    const rawCode = rpcMatch[1];
    const recognizedCode =
      Object.values(ERROR_CODES).find((item) => item === rawCode) ??
      ERROR_CODES.TRANSITION;
    if (
      recognizedCode === ERROR_CODES.REF ||
      recognizedCode === ERROR_CODES.REF_STATE
    ) {
      if (combined.includes("PaiCod") || combined.includes("PerPaiCod")) {
        return createFailure(recognizedCode, "PerPaiCod");
      }
      if (combined.includes("DepCod") || combined.includes("PerDepCod")) {
        return createFailure(recognizedCode, "PerDepCod");
      }
      if (combined.includes("CarCod") || combined.includes("PerCarCod")) {
        return createFailure(recognizedCode, "PerCarCod");
      }
    }
    return createFailure(
      recognizedCode,
      inferFieldFromText(combined, defaultField),
    );
  }

  // 2. Postgres Error 23505: Unique violation -> E-DUP
  if (code === "23505") {
    if (msg.includes("pais_nom_ci") || details.includes("PaiNom")) {
      return createFailure(ERROR_CODES.DUP, "PaiNom");
    }
    if (msg.includes("dependencia_nom_ci") || details.includes("DepNom")) {
      return createFailure(ERROR_CODES.DUP, "DepNom");
    }
    if (msg.includes("cargo_nom_ci") || details.includes("CarNom")) {
      return createFailure(ERROR_CODES.DUP, "CarNom");
    }
    if (msg.includes("personal_PerDNI_key") || details.includes("PerDNI")) {
      return createFailure(ERROR_CODES.DUP, "PerDNI");
    }
    return createFailure(ERROR_CODES.DUP, defaultField);
  }

  // 3. Postgres Error 23503: Foreign key violation -> E-REF
  if (code === "23503") {
    if (combined.includes("PerPaiCod") || combined.includes("PaiCod")) {
      return createFailure(ERROR_CODES.REF, "PerPaiCod");
    }
    if (combined.includes("PerDepCod") || combined.includes("DepCod")) {
      return createFailure(ERROR_CODES.REF, "PerDepCod");
    }
    if (combined.includes("PerCarCod") || combined.includes("CarCod")) {
      return createFailure(ERROR_CODES.REF, "PerCarCod");
    }
    return createFailure(ERROR_CODES.REF, defaultField);
  }

  // 4. Postgres Error 23514: Check constraint violation -> E-RANGE / E-FORMAT
  if (code === "23514") {
    if (combined.includes("PerDNI") || combined.includes("^[0-9]{8}$")) {
      return createFailure(ERROR_CODES.FORMAT, "PerDNI");
    }
    if (combined.includes("PerFecNac") || combined.includes("18 years")) {
      return createFailure(ERROR_CODES.RANGE, "PerFecNac");
    }
    if (combined.includes("PaiNom")) {
      return createFailure(ERROR_CODES.RANGE, "PaiNom");
    }
    if (combined.includes("DepNom")) {
      return createFailure(ERROR_CODES.RANGE, "DepNom");
    }
    if (combined.includes("CarNom")) {
      return createFailure(ERROR_CODES.RANGE, "CarNom");
    }
    if (combined.includes("PerNom")) {
      return createFailure(ERROR_CODES.RANGE, "PerNom");
    }
    if (combined.includes("btrim") || combined.includes("char_length")) {
      return createFailure(ERROR_CODES.RANGE, defaultNomFieldFor(defaultField));
    }
    if (combined.includes("EstRegSim")) {
      return createFailure(ERROR_CODES.FORMAT, "EstRegSim");
    }
    return createFailure(
      ERROR_CODES.RANGE,
      inferFieldFromText(combined, defaultField),
    );
  }

  // 5. Postgres Error 23502: NOT NULL violation -> E-REQUIRED
  if (code === "23502") {
    return createFailure(
      ERROR_CODES.REQUIRED,
      inferFieldFromText(combined, defaultField),
    );
  }

  // 6. Postgres Error 22001 / 22003: String length or numeric range overflow -> E-RANGE
  if (code === "22001" || code === "22003") {
    return createFailure(
      ERROR_CODES.RANGE,
      inferFieldFromText(
        combined,
        code === "22001" ? defaultNomFieldFor(defaultField) : defaultField,
      ),
    );
  }

  // Default fallback to transition or format failure
  return createFailure(ERROR_CODES.TRANSITION, defaultField);
}

const TRANSPORT_ERROR_PATTERN =
  /Failed to fetch|NetworkError|Load failed|FetchError|AbortError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|offline/i;

/**
 * Distinguishes network/transport or HTTP 5xx failures from domain PostgREST/SQL errors
 * so repositories throw a standard `Error` (mapped by session/UI to `E-NETWORK`).
 */
export function isTransportError(
  error: { code?: string; message?: string; details?: string | null },
  status?: number,
): boolean {
  if (status === 0) {
    return true;
  }
  const code = (error.code ?? "").trim();
  if (typeof status === "number" && status >= 500 && code.length === 0) {
    return true;
  }
  if (code.length > 0) {
    return false;
  }
  return TRANSPORT_ERROR_PATTERN.test(error.message ?? "");
}

export function handleRpcError<TRow>(
  error:
    | PostgrestError
    | { code?: string; message?: string; details?: string | null },
  status: number | undefined,
  defaultField: string,
): GuardarResult<TRow> {
  if (isTransportError(error, status)) {
    throw new Error(
      error.message?.trim() || "Error de comunicación con Supabase.",
    );
  }
  return {
    ok: false,
    failures: [mapPostgrestError(error, defaultField)],
  };
}
