import { ERROR_CODES, type ErrorCode, type FieldFailure } from "@/core";

export const FIELD_LABELS = {
  PaiCod: "Código de País",
  PaiNom: "Nombre de País",
  PaiEstReg: "Estado de País",
  DepCod: "Código de Dependencia",
  DepNom: "Nombre de Dependencia",
  DepEstReg: "Estado de Dependencia",
  CarCod: "Código de Cargo",
  CarNom: "Nombre de Cargo",
  CarEstReg: "Estado de Cargo",
  PerCod: "Código de Personal",
  PerNom: "Nombre de Personal",
  PerDNI: "DNI",
  PerFecNac: "Fecha de Nacimiento",
  PerPaiCod: "País",
  PerDepCod: "Dependencia",
  PerCarCod: "Cargo",
  PerEstReg: "Estado de Personal",
  EstReg: "Estado de Registro",
  Nom: "Nombre",
  supervisorCode: "Código de autorización",
  general: "Registro",
  session: "Sesión de mantenimiento",
} as const satisfies Record<string, string>;

export const ERROR_TITLES = {
  [ERROR_CODES.PENDING]: "Operación pendiente",
  [ERROR_CODES.REQUIRED]: "Campo obligatorio",
  [ERROR_CODES.FORMAT]: "Formato inválido",
  [ERROR_CODES.RANGE]: "Valor fuera de rango",
  [ERROR_CODES.DUP]: "Registro duplicado",
  [ERROR_CODES.REF]: "Referencia inexistente",
  [ERROR_CODES.REF_STATE]: "Referencia no activa",
  [ERROR_CODES.REF_BLOCKED]: "Eliminación bloqueada",
  [ERROR_CODES.TRANSITION]: "Transición no permitida",
  [ERROR_CODES.AUTH_SUPERVISOR]: "Autorización rechazada",
} as const satisfies Record<ErrorCode, string>;

type FailureTemplate = (fieldLabel: string) => string;

const ERROR_TEMPLATES = {
  [ERROR_CODES.PENDING]: () =>
    "Ya existe una operación en curso. Use Guardar o Cancelar antes de continuar.",
  [ERROR_CODES.REQUIRED]: (fieldLabel: string) =>
    `${fieldLabel} es obligatorio y no puede quedar vacío.`,
  [ERROR_CODES.FORMAT]: (fieldLabel: string) =>
    `${fieldLabel} no tiene un formato válido.`,
  [ERROR_CODES.RANGE]: (fieldLabel: string) =>
    `${fieldLabel} está fuera del rango o edad mínima permitida.`,
  [ERROR_CODES.DUP]: (fieldLabel: string) =>
    `${fieldLabel} ya existe registrado con el mismo valor.`,
  [ERROR_CODES.REF]: (fieldLabel: string) =>
    `El registro seleccionado para ${fieldLabel} no existe.`,
  [ERROR_CODES.REF_STATE]: (fieldLabel: string) =>
    `El registro seleccionado para ${fieldLabel} no se encuentra Activo.`,
  [ERROR_CODES.REF_BLOCKED]: (fieldLabel: string) =>
    `No se puede eliminar ${fieldLabel} porque tiene personal activo o inactivo asociado (use Inactivar).`,
  [ERROR_CODES.TRANSITION]: () =>
    "La acción solicitada no está permitida para el estado actual del registro.",
  [ERROR_CODES.AUTH_SUPERVISOR]: () =>
    "El código de autorización de supervisor es incorrecto.",
} as const satisfies Record<ErrorCode, FailureTemplate>;

export interface FormattedFieldFailure {
  readonly code: ErrorCode;
  readonly field: string;
  readonly fieldLabel: string;
  readonly title: string;
  readonly message: string;
  readonly summaryLine: string;
}

export interface BatchFailureReport {
  readonly title: string;
  readonly headline: string;
  readonly items: readonly FormattedFieldFailure[];
  readonly text: string;
}

export interface NetworkErrorNotice {
  readonly code: "E-NETWORK";
  readonly title: string;
  readonly message: string;
}

export function getFieldLabel(field: string): string {
  const trimmed = field.trim();
  if (trimmed.length === 0) {
    return FIELD_LABELS.session;
  }
  const descriptor = Object.getOwnPropertyDescriptor(FIELD_LABELS, trimmed);
  if (descriptor && typeof descriptor.value === "string") {
    return descriptor.value;
  }
  return trimmed;
}

export function deduplicateFailures(
  failures: readonly FieldFailure[],
): FieldFailure[] {
  const seen = new Set<string>();
  const unique: FieldFailure[] = [];
  for (const failure of failures) {
    const key = `${failure.code}\u0000${failure.field}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(failure);
  }
  return unique;
}

export function formatFieldFailure(
  failure: FieldFailure,
): FormattedFieldFailure {
  const fieldLabel = getFieldLabel(failure.field);
  const title = ERROR_TITLES[failure.code];
  const message = ERROR_TEMPLATES[failure.code](fieldLabel);
  const summaryLine = message.startsWith(fieldLabel)
    ? `[${failure.code}] ${message}`
    : `[${failure.code}] ${fieldLabel}: ${message}`;
  return {
    code: failure.code,
    field: failure.field,
    fieldLabel,
    title,
    message,
    summaryLine,
  };
}

export function formatBatchFailures(
  failures: readonly FieldFailure[],
): BatchFailureReport {
  const items = deduplicateFailures(failures).map(formatFieldFailure);
  if (items.length === 0) {
    return {
      title: "Validación de registro",
      headline: "No se reportaron errores específicos.",
      items: [],
      text: "",
    };
  }
  if (items.length === 1) {
    const only = items[0];
    return {
      title: only.title,
      headline: "Corrija el error indicado antes de guardar:",
      items,
      text: only.summaryLine,
    };
  }
  return {
    title: `Se detectaron ${items.length} errores al guardar`,
    headline: "Corrija todos los campos observados antes de guardar:",
    items,
    text: items.map((item) => `• ${item.summaryLine}`).join("\n"),
  };
}

function readErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return "No se pudo establecer comunicación con Supabase.";
}

export function formatNetworkError(error: unknown): NetworkErrorNotice {
  const detail = readErrorDetail(error);
  return {
    code: "E-NETWORK",
    title: "Error de conexión",
    message: `La aplicación requiere conexión activa con la base de datos. Detalle: ${detail}`,
  };
}
