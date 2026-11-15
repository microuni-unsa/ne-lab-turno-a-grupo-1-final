import { describe, expect, it } from "vitest";
import { createFailure, ERROR_CODES, type ErrorCode } from "@/core";
import {
  deduplicateFailures,
  ERROR_TITLES,
  FIELD_LABELS,
  formatBatchFailures,
  formatFieldFailure,
  formatNetworkError,
  getFieldLabel,
} from "@/lib/error-catalog";

describe("error-catalog", () => {
  it("traduce exhaustivamente los 9 códigos normativos E-* y todas las columnas del dominio", () => {
    const allCodes: ErrorCode[] = Object.values(ERROR_CODES);
    expect(allCodes).toHaveLength(9);

    for (const code of allCodes) {
      expect(ERROR_TITLES[code].length).toBeGreaterThan(0);
      const formatted = formatFieldFailure(createFailure(code, "PerDNI"));
      expect(formatted.code).toBe(code);
      expect(formatted.title).toBe(ERROR_TITLES[code]);
      expect(formatted.summaryLine).toContain(`[${code}]`);
      expect(formatted.message.length).toBeGreaterThan(5);
    }

    expect(getFieldLabel("PaiCod")).toBe(FIELD_LABELS.PaiCod);
    expect(getFieldLabel("PaiNom")).toBe(FIELD_LABELS.PaiNom);
    expect(getFieldLabel("PaiEstReg")).toBe(FIELD_LABELS.PaiEstReg);
    expect(getFieldLabel("DepCod")).toBe(FIELD_LABELS.DepCod);
    expect(getFieldLabel("DepNom")).toBe(FIELD_LABELS.DepNom);
    expect(getFieldLabel("DepEstReg")).toBe(FIELD_LABELS.DepEstReg);
    expect(getFieldLabel("CarCod")).toBe(FIELD_LABELS.CarCod);
    expect(getFieldLabel("CarNom")).toBe(FIELD_LABELS.CarNom);
    expect(getFieldLabel("CarEstReg")).toBe(FIELD_LABELS.CarEstReg);
    expect(getFieldLabel("PerCod")).toBe(FIELD_LABELS.PerCod);
    expect(getFieldLabel("PerNom")).toBe(FIELD_LABELS.PerNom);
    expect(getFieldLabel("PerDNI")).toBe(FIELD_LABELS.PerDNI);
    expect(getFieldLabel("PerFecNac")).toBe(FIELD_LABELS.PerFecNac);
    expect(getFieldLabel("PerPaiCod")).toBe(FIELD_LABELS.PerPaiCod);
    expect(getFieldLabel("PerDepCod")).toBe(FIELD_LABELS.PerDepCod);
    expect(getFieldLabel("PerCarCod")).toBe(FIELD_LABELS.PerCarCod);
    expect(getFieldLabel("PerEstReg")).toBe(FIELD_LABELS.PerEstReg);
    expect(getFieldLabel("EstReg")).toBe(FIELD_LABELS.EstReg);
    expect(getFieldLabel("Nom")).toBe(FIELD_LABELS.Nom);
    expect(getFieldLabel("general")).toBe(FIELD_LABELS.general);
    expect(getFieldLabel("session")).toBe(FIELD_LABELS.session);
    expect(getFieldLabel("")).toBe(FIELD_LABELS.session);
    expect(getFieldLabel("CampoExtra")).toBe("CampoExtra");
  });

  it("deduplica errores repetidos y reporta en batch todos los fallos acumulados (R22)", () => {
    const rawFailures = [
      createFailure(ERROR_CODES.REQUIRED, "PerNom"),
      createFailure(ERROR_CODES.FORMAT, "PerDNI"),
      createFailure(ERROR_CODES.REQUIRED, "PerNom"),
      createFailure(ERROR_CODES.RANGE, "PerFecNac"),
      createFailure(ERROR_CODES.REF_STATE, "PerCarCod"),
    ];

    const deduped = deduplicateFailures(rawFailures);
    expect(deduped).toHaveLength(4);

    const report = formatBatchFailures(rawFailures);
    expect(report.items).toHaveLength(4);
    expect(report.title).toContain("4");
    expect(report.text).toContain("[E-REQUIRED]");
    expect(report.text).toContain("Nombre de Personal");
    expect(report.text).toContain("[E-FORMAT]");
    expect(report.text).toContain("DNI");
    expect(report.text).toContain("[E-RANGE]");
    expect(report.text).toContain("Fecha de Nacimiento");
    expect(report.text).toContain("[E-REF-STATE]");
    expect(report.text).toContain("Cargo");
  });

  it("formatea fallos únicos sin viñetas y mapea errores residuales de red sin silenciar (SPEC §14)", () => {
    const single = formatBatchFailures([
      createFailure(ERROR_CODES.REF_BLOCKED, "PaiCod"),
    ]);
    expect(single.items).toHaveLength(1);
    expect(single.title).toBe(ERROR_TITLES[ERROR_CODES.REF_BLOCKED]);
    expect(single.text).toContain("[E-REF-BLOCKED]");
    expect(single.text).toContain("Inactivar");

    const fromError = formatNetworkError(new Error("Failed to fetch"));
    expect(fromError.code).toBe("E-NETWORK");
    expect(fromError.message).toContain("Failed to fetch");

    const fromObject = formatNetworkError({
      message: "503 Service Unavailable",
    });
    expect(fromObject.message).toContain("503 Service Unavailable");

    const fromUnknown = formatNetworkError(null);
    expect(fromUnknown.message).toContain("No se pudo establecer comunicación");
  });
});
