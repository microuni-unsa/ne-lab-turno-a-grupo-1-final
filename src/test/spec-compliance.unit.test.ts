import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  applyAdicionState,
  assertTransition,
  canTransition,
  createFailure,
  DNI_LEN,
  ERROR_CODES,
  type ErrorCode,
  EST_A,
  EST_I,
  EST_SIM_A,
  EST_SIM_I,
  EST_SIM_X,
  EST_X,
  type EstReg,
  forceAdicionState,
  getNextState,
  MAX_INTEGER,
  MAX_NAME,
  MAX_SMALLINT,
  MIN_AGE,
  MIN_CODE,
  MIN_NAME,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_ESTREG,
  TABLE_PAIS,
  TABLE_PERSONAL,
  type TRANSITION_TABLE,
  validateCargoRow,
  validateDependenciaRow,
  validatePaisRow,
  validatePersonalRow,
} from "@/core";
import {
  DEFAULT_PAGE_LIMIT,
  getTableOrdering,
  isTransportError,
  PaisRepo,
  PersonalRepo,
} from "@/data";
import { createReferenceSchema } from "@/features/maintenance/schemas";
import {
  cargoConfig,
  dependenciaConfig,
  paisConfig,
} from "@/features/reference/reference-config";
import {
  deduplicateFailures,
  ERROR_TITLES,
  formatBatchFailures,
  formatFieldFailure,
  formatNetworkError,
} from "@/lib/error-catalog";

describe("Cumplimiento normativo global SPEC §3–§15", () => {
  it("mantiene exactamente las constantes globales de SPEC §3", () => {
    expect(DNI_LEN).toBe(8);
    expect(MIN_NAME).toBe(2);
    expect(MAX_NAME).toBe(100);
    expect(MIN_AGE).toBe(18);
    expect(MIN_CODE).toBe(1);
    expect(MAX_SMALLINT).toBe(32767);
    expect(MAX_INTEGER).toBe(2147483647);

    expect(EST_A).toBe(1);
    expect(EST_I).toBe(2);
    expect(EST_X).toBe(3);
    expect(EST_SIM_A).toBe("A");
    expect(EST_SIM_I).toBe("I");
    expect(EST_SIM_X).toBe("*");

    expect(TABLE_PAIS).toBe("pais");
    expect(TABLE_DEPENDENCIA).toBe("dependencia");
    expect(TABLE_CARGO).toBe("cargo");
    expect(TABLE_PERSONAL).toBe("personal");
    expect(TABLE_ESTREG).toBe("estreg");
    expect(DEFAULT_PAGE_LIMIT).toBe(50);
  });

  it("aplica de forma exhaustiva la matriz completa de transiciones SPEC §6.1 y R9", () => {
    const states: readonly EstReg[] = [EST_A, EST_I, EST_X];

    expect(forceAdicionState()).toBe(EST_A);
    expect(getNextState("adición", EST_X)).toBe(EST_A);
    expect(applyAdicionState(TABLE_PERSONAL, { PerEstReg: EST_I })).toEqual({
      PerEstReg: EST_A,
    });

    const expected: Record<
      keyof typeof TRANSITION_TABLE,
      Record<EstReg, EstReg | null>
    > = {
      modificación: { [EST_A]: EST_A, [EST_I]: EST_I, [EST_X]: null },
      inactivar: { [EST_A]: EST_I, [EST_I]: null, [EST_X]: null },
      reactivar: { [EST_A]: null, [EST_I]: EST_A, [EST_X]: null },
      eliminación: { [EST_A]: EST_X, [EST_I]: EST_X, [EST_X]: null },
    };

    const ops: readonly (keyof typeof TRANSITION_TABLE)[] = [
      "modificación",
      "inactivar",
      "reactivar",
      "eliminación",
    ];

    for (const op of ops) {
      for (const state of states) {
        const expectedNext = expected[op][state];
        if (expectedNext === null) {
          expect(canTransition(op, state)).toBe(false);
          expect(() => getNextState(op, state)).toThrow();
          expect(() => assertTransition(op, state)).toThrow();
        } else {
          expect(canTransition(op, state)).toBe(true);
          expect(getNextState(op, state)).toBe(expectedNext);
          expect(() => assertTransition(op, state)).not.toThrow();
        }
      }
    }
  });

  it("enlaza todos los códigos de error SPEC §12 con títulos en español y formato R22", () => {
    const allCodes: readonly ErrorCode[] = [
      ERROR_CODES.PENDING,
      ERROR_CODES.REQUIRED,
      ERROR_CODES.FORMAT,
      ERROR_CODES.RANGE,
      ERROR_CODES.DUP,
      ERROR_CODES.REF,
      ERROR_CODES.REF_STATE,
      ERROR_CODES.REF_BLOCKED,
      ERROR_CODES.TRANSITION,
    ];

    expect(Object.values(ERROR_CODES)).toHaveLength(9);

    for (const code of allCodes) {
      expect(ERROR_TITLES[code]).toBeTruthy();
      const formatted = formatFieldFailure(createFailure(code, "PerDNI"));
      expect(formatted.summaryLine).toContain(`[${code}]`);
      expect(formatted.summaryLine).toContain("DNI");
    }

    const batch = formatBatchFailures(
      deduplicateFailures([
        createFailure(ERROR_CODES.REQUIRED, "PerNom"),
        createFailure(ERROR_CODES.REQUIRED, "PerNom"),
        createFailure(ERROR_CODES.FORMAT, "PerDNI"),
      ]),
    );
    expect(batch.items).toHaveLength(2);
    expect(batch.text).toContain("[E-REQUIRED]");
    expect(batch.text).toContain("[E-FORMAT]");

    const networkNotice = formatNetworkError(new Error("Failed to fetch"));
    expect(networkNotice.code).toBe("E-NETWORK");
    expect(networkNotice.title.length).toBeGreaterThan(0);
  });

  it("verifica R2 (código inmutable en Modificación) y ordenamientos R18 en las 4 tablas", () => {
    expect(paisConfig.table).toBe(TABLE_PAIS);
    expect(dependenciaConfig.table).toBe(TABLE_DEPENDENCIA);
    expect(cargoConfig.table).toBe(TABLE_CARGO);

    const refSchema = createReferenceSchema({
      codeField: "PaiCod",
      nomField: "PaiNom",
      isUpdate: true,
      maxCode: MAX_SMALLINT,
    });
    expect(refSchema.safeParse({ PaiNom: "Uruguay" }).success).toBe(true);

    expect(validatePaisRow({ PaiNom: "Bolivia" }, { isUpdate: true })).toEqual(
      [],
    );
    expect(
      validateDependenciaRow({ DepNom: "Sistemas" }, { isUpdate: true }),
    ).toEqual([]);
    expect(
      validateCargoRow({ CarNom: "Analista" }, { isUpdate: true }),
    ).toEqual([]);
    expect(
      validatePersonalRow(
        {
          PerNom: "Ana Rojas",
          PerDNI: "41234567",
          PerFecNac: "1995-05-15",
          PerPaiCod: 1,
          PerDepCod: 1,
          PerCarCod: 1,
        },
        { isUpdate: true, todayLocal: "2026-11-15" },
      ),
    ).toEqual([]);

    expect(getTableOrdering(TABLE_PAIS, "default")).toEqual([
      { column: "PaiNom", ascending: true },
      { column: "PaiCod", ascending: true },
    ]);
    expect(getTableOrdering(TABLE_PAIS, "alternate")).toEqual([
      { column: "PaiCod", ascending: true },
    ]);
    expect(getTableOrdering(TABLE_DEPENDENCIA, "default")).toEqual([
      { column: "DepNom", ascending: true },
      { column: "DepCod", ascending: true },
    ]);
    expect(getTableOrdering(TABLE_CARGO, "default")).toEqual([
      { column: "CarNom", ascending: true },
      { column: "CarCod", ascending: true },
    ]);
    expect(getTableOrdering(TABLE_PERSONAL, "default")).toEqual([
      { column: "PerCod", ascending: true },
    ]);
    expect(getTableOrdering(TABLE_PERSONAL, "alternate")).toEqual([
      { column: "PerNom", ascending: true },
      { column: "PerCod", ascending: true },
    ]);
  });

  it("propaga fallos de red/transporte PostgREST en guardar() sin confundirlos con E-TRANSITION", async () => {
    expect(
      isTransportError(
        { code: "", message: "TypeError: Failed to fetch", details: "" },
        0,
      ),
    ).toBe(true);
    expect(
      isTransportError({ code: "23505", message: "duplicate key" }, 409),
    ).toBe(false);

    const offlineClient = createClient(
      "https://offline-test.supabase.co",
      "sb_publishable_offline_test_key",
      {
        db: { retry: false },
        global: {
          fetch: () => Promise.reject(new TypeError("Failed to fetch")),
        },
      },
    );

    const paisRepo = new PaisRepo(offlineClient);
    await expect(
      paisRepo.guardar({ op: "insert", p_cod: 15, p_nom: "Uruguay" }),
    ).rejects.toThrow(/Failed to fetch/);

    const personalRepo = new PersonalRepo(offlineClient);
    await expect(
      personalRepo.guardar({
        op: "set_state",
        p_cod: 1,
        p_est: EST_X,
      }),
    ).rejects.toThrow(/Failed to fetch/);
  });
});
