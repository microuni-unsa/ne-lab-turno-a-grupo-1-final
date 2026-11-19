/**
 * Maestro de Personal — Runtime Row Parsers
 *
 * Validates and brands raw PostgREST/RPC rows into domain entities without unsafe `as` casts.
 */

import { EST_A, EST_I, EST_X } from "@/core/constants";
import {
  asCarCod,
  asDepCod,
  asPaiCod,
  asPerCod,
  type CargoRow,
  type DependenciaRow,
  type EstReg,
  type PaisRow,
  type PersonalRow,
} from "@/core/types";

export function isPlainRecord(
  value: unknown,
): value is { readonly [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readOptionalNumberField(
  source: unknown,
  key: string,
): number | undefined {
  if (!isPlainRecord(source)) {
    return undefined;
  }
  const value: unknown = Object.getOwnPropertyDescriptor(source, key)?.value;
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function readOptionalCodeField(
  source: unknown,
  key: string,
): string | undefined {
  if (!isPlainRecord(source)) {
    return undefined;
  }
  const value: unknown = Object.getOwnPropertyDescriptor(source, key)?.value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function readOptionalStringField(
  source: unknown,
  key: string,
): string | undefined {
  if (!isPlainRecord(source)) {
    return undefined;
  }
  const value: unknown = Object.getOwnPropertyDescriptor(source, key)?.value;
  return typeof value === "string" ? value : undefined;
}

export function parseEstReg(value: unknown): EstReg | null {
  if (value === EST_A || value === EST_I || value === EST_X) {
    return value;
  }
  return null;
}

function readAuditTimestampField(source: unknown, key: string): string | null {
  if (!isPlainRecord(source)) {
    return null;
  }
  const value: unknown = Object.getOwnPropertyDescriptor(source, key)?.value;
  if (value === undefined) {
    return "";
  }
  return typeof value === "string" ? value : null;
}

function parseReferenceFields<TCod extends string>(
  raw: unknown,
  codeKey: string,
  nomKey: string,
  estKey: string,
  brandCode: (value: string) => TCod,
): {
  readonly code: TCod;
  readonly nom: string;
  readonly estReg: EstReg;
  readonly created_at: string;
  readonly updated_at: string;
} | null {
  if (!isPlainRecord(raw)) {
    return null;
  }
  const code = readOptionalCodeField(raw, codeKey);
  const nom = readOptionalStringField(raw, nomKey);
  const estReg = parseEstReg(
    Object.getOwnPropertyDescriptor(raw, estKey)?.value,
  );
  const createdAt = readAuditTimestampField(raw, "created_at");
  const updatedAt = readAuditTimestampField(raw, "updated_at");
  if (
    code === undefined ||
    nom === undefined ||
    estReg === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }
  return {
    code: brandCode(code),
    nom,
    estReg,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function parsePaisRow(raw: unknown): PaisRow | null {
  const fields = parseReferenceFields(
    raw,
    "PaiCod",
    "PaiNom",
    "PaiEstReg",
    asPaiCod,
  );
  if (!fields) return null;
  return {
    PaiCod: fields.code,
    PaiNom: fields.nom,
    PaiEstReg: fields.estReg,
    created_at: fields.created_at,
    updated_at: fields.updated_at,
  };
}

export function parseDependenciaRow(raw: unknown): DependenciaRow | null {
  const fields = parseReferenceFields(
    raw,
    "DepCod",
    "DepNom",
    "DepEstReg",
    asDepCod,
  );
  if (!fields) return null;
  return {
    DepCod: fields.code,
    DepNom: fields.nom,
    DepEstReg: fields.estReg,
    created_at: fields.created_at,
    updated_at: fields.updated_at,
  };
}

export function parseCargoRow(raw: unknown): CargoRow | null {
  const fields = parseReferenceFields(
    raw,
    "CarCod",
    "CarNom",
    "CarEstReg",
    asCarCod,
  );
  if (!fields) return null;
  return {
    CarCod: fields.code,
    CarNom: fields.nom,
    CarEstReg: fields.estReg,
    created_at: fields.created_at,
    updated_at: fields.updated_at,
  };
}

export function parsePersonalRow(raw: unknown): PersonalRow | null {
  if (!isPlainRecord(raw)) {
    return null;
  }
  const perCod = readOptionalCodeField(raw, "PerCod");
  const perNom = readOptionalStringField(raw, "PerNom");
  const perDni = readOptionalStringField(raw, "PerDNI");
  const perFecNac = readOptionalStringField(raw, "PerFecNac");
  const perPaiCod = readOptionalCodeField(raw, "PerPaiCod");
  const perDepCod = readOptionalCodeField(raw, "PerDepCod");
  const perCarCod = readOptionalCodeField(raw, "PerCarCod");
  const perEstReg = parseEstReg(
    Object.getOwnPropertyDescriptor(raw, "PerEstReg")?.value,
  );
  const createdAt = readAuditTimestampField(raw, "created_at");
  const updatedAt = readAuditTimestampField(raw, "updated_at");

  if (
    perCod === undefined ||
    perNom === undefined ||
    perDni === undefined ||
    perFecNac === undefined ||
    perPaiCod === undefined ||
    perDepCod === undefined ||
    perCarCod === undefined ||
    perEstReg === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    PerCod: asPerCod(perCod),
    PerNom: perNom,
    PerDNI: perDni,
    PerFecNac: perFecNac,
    PerPaiCod: asPaiCod(perPaiCod),
    PerDepCod: asDepCod(perDepCod),
    PerCarCod: asCarCod(perCarCod),
    PerEstReg: perEstReg,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}
