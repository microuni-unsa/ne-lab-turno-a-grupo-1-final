import { describe, expect, it } from "vitest";
import {
  EST_A,
  EST_I,
  EST_X,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
  TABLE_PERSONAL,
} from "@/core/constants";
import { ERROR_CODES, type FieldFailure } from "@/core/errors";
import {
  ADICION_FORCED_STATE,
  applyAdicionState,
  assertTransition,
  canTransition,
  forceAdicionState,
  getNextState,
  getStateFieldName,
  normalizeLifecycleOp,
} from "@/core/lifecycle";

describe("lifecycle.unit", () => {
  describe("SPEC §6.1 Exhaustive Transition Table", () => {
    // 1. Modificar
    describe("Modificar operation", () => {
      it("allowed from Activo (A) -> state preserved as Activo (A)", () => {
        expect(canTransition("modificación", EST_A)).toBe(true);
        expect(canTransition("Modificar", EST_A)).toBe(true);
        expect(getNextState("modificación", EST_A)).toBe(EST_A);
        expect(() => assertTransition("modificación", EST_A)).not.toThrow();
      });

      it("allowed from Inactivo (I) -> state preserved as Inactivo (I)", () => {
        expect(canTransition("modificación", EST_I)).toBe(true);
        expect(canTransition("Modificar", EST_I)).toBe(true);
        expect(getNextState("modificación", EST_I)).toBe(EST_I);
        expect(() => assertTransition("modificación", EST_I)).not.toThrow();
      });

      it("forbidden from Eliminado (*) -> E-TRANSITION", () => {
        expect(canTransition("modificación", EST_X)).toBe(false);
        expect(canTransition("Modificar", EST_X)).toBe(false);
        expect(() => getNextState("modificación", EST_X)).toThrow();
        try {
          getNextState("modificación", EST_X);
        } catch (err) {
          const failure = err as FieldFailure;
          expect(failure.code).toBe(ERROR_CODES.TRANSITION);
          expect(failure.field).toBe("EstReg");
        }
        expect(() => assertTransition("modificación", EST_X)).toThrow();
      });
    });

    // 2. Inactivar
    describe("Inactivar operation", () => {
      it("allowed from Activo (A) -> state transitions to Inactivo (I)", () => {
        expect(canTransition("inactivar", EST_A)).toBe(true);
        expect(canTransition("Inactivar", EST_A)).toBe(true);
        expect(getNextState("inactivar", EST_A)).toBe(EST_I);
        expect(() => assertTransition("inactivar", EST_A)).not.toThrow();
      });

      it("forbidden from Inactivo (I) -> E-TRANSITION (already I)", () => {
        expect(canTransition("inactivar", EST_I)).toBe(false);
        expect(() => getNextState("inactivar", EST_I)).toThrow();
        try {
          getNextState("inactivar", EST_I);
        } catch (err) {
          const failure = err as FieldFailure;
          expect(failure.code).toBe(ERROR_CODES.TRANSITION);
        }
        expect(() => assertTransition("inactivar", EST_I)).toThrow();
      });

      it("forbidden from Eliminado (*) -> E-TRANSITION", () => {
        expect(canTransition("inactivar", EST_X)).toBe(false);
        expect(() => getNextState("inactivar", EST_X)).toThrow();
        expect(() => assertTransition("inactivar", EST_X)).toThrow();
      });
    });

    // 3. Reactivar
    describe("Reactivar operation", () => {
      it("forbidden from Activo (A) -> E-TRANSITION (already A)", () => {
        expect(canTransition("reactivar", EST_A)).toBe(false);
        expect(() => getNextState("reactivar", EST_A)).toThrow();
        try {
          getNextState("reactivar", EST_A);
        } catch (err) {
          const failure = err as FieldFailure;
          expect(failure.code).toBe(ERROR_CODES.TRANSITION);
        }
        expect(() => assertTransition("reactivar", EST_A)).toThrow();
      });

      it("allowed from Inactivo (I) -> state transitions to Activo (A)", () => {
        expect(canTransition("reactivar", EST_I)).toBe(true);
        expect(canTransition("Reactivar", EST_I)).toBe(true);
        expect(getNextState("reactivar", EST_I)).toBe(EST_A);
        expect(() => assertTransition("reactivar", EST_I)).not.toThrow();
      });

      it("forbidden from Eliminado (*) -> E-TRANSITION", () => {
        expect(canTransition("reactivar", EST_X)).toBe(false);
        expect(() => getNextState("reactivar", EST_X)).toThrow();
        expect(() => assertTransition("reactivar", EST_X)).toThrow();
      });
    });

    // 4. Eliminar
    describe("Eliminar operation", () => {
      it("allowed from Activo (A) -> state transitions to Eliminado (*)", () => {
        expect(canTransition("eliminación", EST_A)).toBe(true);
        expect(canTransition("Eliminar", EST_A)).toBe(true);
        expect(getNextState("eliminación", EST_A)).toBe(EST_X);
        expect(() => assertTransition("eliminación", EST_A)).not.toThrow();
      });

      it("allowed from Inactivo (I) -> state transitions to Eliminado (*)", () => {
        expect(canTransition("eliminación", EST_I)).toBe(true);
        expect(canTransition("eliminar", EST_I)).toBe(true);
        expect(getNextState("eliminación", EST_I)).toBe(EST_X);
        expect(() => assertTransition("eliminación", EST_I)).not.toThrow();
      });

      it("forbidden from Eliminado (*) -> E-TRANSITION (already *)", () => {
        expect(canTransition("eliminación", EST_X)).toBe(false);
        expect(canTransition("Eliminar", EST_X)).toBe(false);
        expect(() => getNextState("eliminación", EST_X)).toThrow();
        try {
          getNextState("eliminación", EST_X);
        } catch (err) {
          const failure = err as FieldFailure;
          expect(failure.code).toBe(ERROR_CODES.TRANSITION);
        }
        expect(() => assertTransition("eliminación", EST_X)).toThrow();
      });
    });

    // 5. Adición
    describe("Adición operation (SPEC §6, R9)", () => {
      it("always forces Activo (A)", () => {
        expect(canTransition("adición", EST_A)).toBe(true);
        expect(canTransition("adicionar", EST_I)).toBe(true);
        expect(getNextState("adición", EST_A)).toBe(EST_A);
        expect(forceAdicionState()).toBe(EST_A);
        expect(ADICION_FORCED_STATE).toBe(EST_A);
      });

      it("applyAdicionState forces EstReg field to EST_A for all tables", () => {
        const pais = applyAdicionState(TABLE_PAIS, {
          PaiNom: "Perú",
          PaiEstReg: EST_X,
        });
        expect(pais.PaiEstReg).toBe(EST_A);

        const dep = applyAdicionState(TABLE_DEPENDENCIA, {
          DepNom: "Sistemas",
          DepEstReg: EST_I,
        });
        expect(dep.DepEstReg).toBe(EST_A);

        const car = applyAdicionState(TABLE_CARGO, {
          CarNom: "Gerente",
          CarEstReg: 99,
        });
        expect(car.CarEstReg).toBe(EST_A);

        const per = applyAdicionState(TABLE_PERSONAL, {
          PerNom: "Juan",
          PerEstReg: null,
        });
        expect(per.PerEstReg).toBe(EST_A);
      });
    });

    // 6. Unknown operation and invalid state error handling
    describe("Unknown operations and invalid states", () => {
      it("rejects unknown operation with E-TRANSITION", () => {
        expect(canTransition("purgar", EST_A)).toBe(false);
        expect(canTransition("destroy", EST_I)).toBe(false);
        expect(canTransition("", EST_A)).toBe(false);

        expect(() => getNextState("purgar", EST_A)).toThrow();
        try {
          getNextState("unknown-op", EST_A);
        } catch (err) {
          const failure = err as FieldFailure;
          expect(failure.code).toBe(ERROR_CODES.TRANSITION);
          expect(failure.field).toBe("EstReg");
        }

        expect(() => assertTransition("purgar", EST_A)).toThrow();
      });

      it("rejects invalid state code (< 1 or > 3) with E-TRANSITION", () => {
        expect(canTransition("modificar", 0)).toBe(false);
        expect(canTransition("modificar", 4)).toBe(false);
        expect(canTransition("modificar", -1)).toBe(false);

        expect(() => getNextState("modificar", 99)).toThrow();
        expect(() => assertTransition("modificar", 99)).toThrow();
      });
    });

    // 7. Op name normalization
    describe("normalizeLifecycleOp", () => {
      it("normalizes various Spanish spellings and cases", () => {
        expect(normalizeLifecycleOp("Modificar")).toBe("modificación");
        expect(normalizeLifecycleOp("modificación")).toBe("modificación");
        expect(normalizeLifecycleOp("MODIFICACION")).toBe("modificación");
        expect(normalizeLifecycleOp("Inactivar")).toBe("inactivar");
        expect(normalizeLifecycleOp("Reactivar")).toBe("reactivar");
        expect(normalizeLifecycleOp("Eliminar")).toBe("eliminación");
        expect(normalizeLifecycleOp("ELIMINACIÓN")).toBe("eliminación");
        expect(normalizeLifecycleOp("adicionar")).toBe("adición");
        expect(normalizeLifecycleOp("invalid")).toBeNull();
      });
    });

    // 8. getStateFieldName
    describe("getStateFieldName", () => {
      it("returns correct EstReg field name per table", () => {
        expect(getStateFieldName(TABLE_PAIS)).toBe("PaiEstReg");
        expect(getStateFieldName(TABLE_DEPENDENCIA)).toBe("DepEstReg");
        expect(getStateFieldName(TABLE_CARGO)).toBe("CarEstReg");
        expect(getStateFieldName(TABLE_PERSONAL)).toBe("PerEstReg");
      });
    });
  });
});
