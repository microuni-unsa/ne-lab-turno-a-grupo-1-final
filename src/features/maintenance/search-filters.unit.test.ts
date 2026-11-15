import { describe, expect, it } from "vitest";
import {
  EST_A,
  EST_I,
  EST_X,
  MAX_INTEGER,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
  TABLE_PERSONAL,
} from "@/core";
import {
  ALL_ESTREG_STATES,
  advancedFiltersToDraft,
  draftToAdvancedFilters,
  getOrderingLabel,
  hasActiveAdvancedFilters,
  parsePositiveCodeFilter,
  sanitizeAdvancedFilters,
} from "@/features/maintenance/use-maintenance-list";

describe("Fase 5: sanitización AdvancedSearchFilters y etiquetas ORDER BY (R18-R20)", () => {
  it("rechaza NaN, no enteros y códigos fuera de rango sin errores (R20)", () => {
    expect(parsePositiveCodeFilter("")).toBeUndefined();
    expect(parsePositiveCodeFilter("   ")).toBeUndefined();
    expect(parsePositiveCodeFilter("abc")).toBeUndefined();
    expect(parsePositiveCodeFilter("-5")).toBeUndefined();
    expect(parsePositiveCodeFilter("0")).toBeUndefined();
    expect(parsePositiveCodeFilter(Number.NaN)).toBeUndefined();
    expect(parsePositiveCodeFilter(1.5)).toBeUndefined();
    expect(parsePositiveCodeFilter(MAX_INTEGER + 1)).toBeUndefined();
    expect(parsePositiveCodeFilter("99999999999999")).toBeUndefined();

    expect(parsePositiveCodeFilter("42")).toBe(42);
    expect(parsePositiveCodeFilter(7)).toBe(7);
  });

  it("omite campos en blanco, preserva subconjuntos EstReg y trata {A,I,*} como sin filtro (R19)", () => {
    const cleanDefault = sanitizeAdvancedFilters({
      Cod: "abc",
      Nom: "   ",
      EstReg: ALL_ESTREG_STATES,
      DNI: " ",
    });
    expect(cleanDefault).toEqual({});
    expect(hasActiveAdvancedFilters(cleanDefault)).toBe(false);

    const subset = sanitizeAdvancedFilters({
      Cod: "12",
      Nom: " Perú ",
      EstReg: [EST_I, EST_A],
    });
    expect(subset).toEqual({
      Cod: 12,
      Nom: "Perú",
      EstReg: [EST_A, EST_I],
    });
    expect(hasActiveAdvancedFilters(subset)).toBe(true);

    const onlyInactive = draftToAdvancedFilters({
      codText: "no-num",
      nomText: "",
      estReg: [EST_I],
      dniText: "",
      fecNacFrom: "",
      fecNacTo: "",
      paiCod: undefined,
      depCod: undefined,
      carCod: undefined,
    });
    expect(onlyInactive).toEqual({ EstReg: [EST_I] });

    const backToDraft = advancedFiltersToDraft({
      Cod: 5,
      Nom: "Sistemas",
      EstReg: [EST_X],
    });
    expect(backToDraft.codText).toBe("5");
    expect(backToDraft.nomText).toBe("Sistemas");
    expect(backToDraft.estReg).toEqual([EST_X]);
  });

  it("expone etiquetas legibles de ordenamiento diferenciando Referencia vs Personal (R18)", () => {
    for (const refTable of [TABLE_PAIS, TABLE_DEPENDENCIA, TABLE_CARGO]) {
      expect(getOrderingLabel(refTable, "default")).toBe(
        "Nombre (A→Z), Código",
      );
      expect(getOrderingLabel(refTable, "alternate")).toBe("Código (1→N)");
    }

    expect(getOrderingLabel(TABLE_PERSONAL, "default")).toBe("Código (1→N)");
    expect(getOrderingLabel(TABLE_PERSONAL, "alternate")).toBe(
      "Nombre (A→Z), Código",
    );
  });
});
