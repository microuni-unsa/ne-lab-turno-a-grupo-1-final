import { describe, expect, it } from "vitest";
import { createFailure, ERROR_CODES, type ErrorCode } from "@/core";
import {
  deduplicateFailures,
  formatBatchFailures,
  formatFieldFailure,
  formatNetworkError,
  getFieldLabel,
} from "@/lib/error-catalog";

describe("error-catalog", () => {
  it("traduce exhaustivamente los 10 códigos normativos E-* y las columnas del dominio", () => {
    const allCodes: ErrorCode[] = Object.values(ERROR_CODES);
    expect(allCodes).toHaveLength(10);

    for (const code of allCodes) {
      const formatted = formatFieldFailure(createFailure(code, "PerDNI"));
      expect(formatted.code).toBe(code);
      expect(formatted.title.length).toBeGreaterThan(0);
      expect(formatted.title).not.toBe(code);
      expect(formatted.summaryLine).toContain(`[${code}]`);
      expect(formatted.message.length).toBeGreaterThan(5);
    }

    expect(getFieldLabel("PaiCod")).toBe("Código de País");
    expect(getFieldLabel("DepNom")).toBe("Nombre de Dependencia");
    expect(getFieldLabel("CarEstReg")).toBe("Estado de Cargo");
    expect(getFieldLabel("PerDNI")).toBe("DNI");
    expect(getFieldLabel("PerFecNac")).toBe("Fecha de Nacimiento");
    expect(getFieldLabel("")).toBe("Sesión de mantenimiento");
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
    expect(single.title).toBe("Eliminación bloqueada");
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
