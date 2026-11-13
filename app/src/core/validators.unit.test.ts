import { describe, it, expect } from "vitest";
import {
  validateCode,
  validateNom,
  validateDNI,
  validateFecNac,
  validatePaisRow,
  validateDependenciaRow,
  validateCargoRow,
  validatePersonalRow,
  validateRow,
} from "./validators";
import {
  MAX_NAME,
  EST_A,
  TABLE_PAIS,
  TABLE_DEPENDENCIA,
  TABLE_CARGO,
  TABLE_PERSONAL,
} from "./constants";
import { ERROR_CODES } from "./errors";

describe("validators.unit", () => {
  describe("validateDNI", () => {
    it("accepts exactly 8 ASCII digits", () => {
      const res = validateDNI("70000001");
      expect(res).toEqual([]);
    });

    it("rejects non-digit characters with E-FORMAT", () => {
      const res = validateDNI("7000000A");
      expect(res).toEqual([{ code: ERROR_CODES.FORMAT, field: "PerDNI" }]);
    });

    it("rejects lengths other than 8 with E-RANGE", () => {
      const shortRes = validateDNI("1234567");
      expect(shortRes).toEqual([{ code: ERROR_CODES.RANGE, field: "PerDNI" }]);

      const longRes = validateDNI("123456789");
      expect(longRes).toEqual([{ code: ERROR_CODES.RANGE, field: "PerDNI" }]);
    });

    it("reports both E-FORMAT and E-RANGE when both are violated (R22 batch reporting)", () => {
      const res = validateDNI("123A");
      expect(res).toEqual([
        { code: ERROR_CODES.FORMAT, field: "PerDNI" },
        { code: ERROR_CODES.RANGE, field: "PerDNI" },
      ]);
    });

    it("rejects empty, null, or undefined with E-REQUIRED", () => {
      expect(validateDNI("")).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PerDNI" },
      ]);
      expect(validateDNI("   ")).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PerDNI" },
      ]);
      expect(validateDNI(null)).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PerDNI" },
      ]);
      expect(validateDNI(undefined)).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PerDNI" },
      ]);
    });

    it("uses custom fieldName when provided", () => {
      const res = validateDNI("bad", "customDNI");
      expect(res[0].field).toBe("customDNI");
    });
  });

  describe("validateNom", () => {
    it("accepts names within MIN_NAME (2) and MAX_NAME (100)", () => {
      expect(validateNom("Ab")).toEqual([]);
      expect(validateNom("Perú")).toEqual([]);
      expect(validateNom("A".repeat(MAX_NAME))).toEqual([]);
    });

    it("trims leading/trailing blanks before length checking", () => {
      expect(validateNom("  Ab  ")).toEqual([]);
      expect(validateNom("  A  ")).toEqual([
        { code: ERROR_CODES.RANGE, field: "Nom" },
      ]);
    });

    it("rejects length < 2 with E-RANGE", () => {
      expect(validateNom("A")).toEqual([
        { code: ERROR_CODES.RANGE, field: "Nom" },
      ]);
    });

    it("rejects length > 100 with E-RANGE", () => {
      expect(validateNom("A".repeat(101))).toEqual([
        { code: ERROR_CODES.RANGE, field: "Nom" },
      ]);
    });

    it("rejects empty, blank, null, or undefined with E-REQUIRED", () => {
      expect(validateNom("")).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "Nom" },
      ]);
      expect(validateNom("   ")).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "Nom" },
      ]);
      expect(validateNom(null)).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "Nom" },
      ]);
      expect(validateNom(undefined)).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "Nom" },
      ]);
    });

    it("rejects non-string types with E-FORMAT", () => {
      expect(validateNom(12345)).toEqual([
        { code: ERROR_CODES.FORMAT, field: "Nom" },
      ]);
      expect(validateNom({})).toEqual([
        { code: ERROR_CODES.FORMAT, field: "Nom" },
      ]);
    });
  });

  describe("validateCode", () => {
    it("accepts valid positive integer numbers and numeric strings", () => {
      expect(validateCode(TABLE_PAIS, 1)).toEqual([]);
      expect(validateCode(TABLE_PAIS, "1")).toEqual([]);
      expect(validateCode(TABLE_PERSONAL, 2147483647)).toEqual([]);
    });

    it("rejects code <= 0 with E-RANGE", () => {
      expect(validateCode(TABLE_PAIS, 0)).toEqual([
        { code: ERROR_CODES.RANGE, field: "PaiCod" },
      ]);
      expect(validateCode(TABLE_PAIS, -5)).toEqual([
        { code: ERROR_CODES.RANGE, field: "PaiCod" },
      ]);
      expect(validateCode(TABLE_PAIS, "0")).toEqual([
        { code: ERROR_CODES.RANGE, field: "PaiCod" },
      ]);
    });

    it("rejects code exceeding SMALLINT for reference tables with E-RANGE", () => {
      expect(validateCode(TABLE_PAIS, 32768)).toEqual([
        { code: ERROR_CODES.RANGE, field: "PaiCod" },
      ]);
      expect(validateCode(TABLE_DEPENDENCIA, 40000)).toEqual([
        { code: ERROR_CODES.RANGE, field: "DepCod" },
      ]);
      expect(validateCode(TABLE_CARGO, 99999)).toEqual([
        { code: ERROR_CODES.RANGE, field: "CarCod" },
      ]);
    });

    it("accepts large integers up to 2147483647 for PERSONAL", () => {
      expect(validateCode(TABLE_PERSONAL, 50000)).toEqual([]);
      expect(validateCode(TABLE_PERSONAL, 2147483648)).toEqual([
        { code: ERROR_CODES.RANGE, field: "PerCod" },
      ]);
    });

    it("rejects non-numeric formats with E-FORMAT", () => {
      expect(validateCode(TABLE_PAIS, "abc")).toEqual([
        { code: ERROR_CODES.FORMAT, field: "PaiCod" },
      ]);
      expect(validateCode(TABLE_PAIS, 1.5)).toEqual([
        { code: ERROR_CODES.FORMAT, field: "PaiCod" },
      ]);
      expect(validateCode(TABLE_PAIS, "1.5")).toEqual([
        { code: ERROR_CODES.FORMAT, field: "PaiCod" },
      ]);
    });

    it("rejects null, undefined, and empty string with E-REQUIRED", () => {
      expect(validateCode(TABLE_PAIS, null)).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PaiCod" },
      ]);
      expect(validateCode(TABLE_PAIS, undefined)).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PaiCod" },
      ]);
      expect(validateCode(TABLE_PAIS, "")).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PaiCod" },
      ]);
      expect(validateCode(TABLE_PAIS, "   ")).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PaiCod" },
      ]);
    });
  });

  describe("validateFecNac (age boundary)", () => {
    const fixedToday = "2026-11-13";

    it("accepts person who is exactly 18 years old today", () => {
      // Born on 2008-11-13, today is 2026-11-13 -> exactly 18 today: OK
      const exactly18 = "2008-11-13";
      const res = validateFecNac(exactly18, fixedToday);
      expect(res).toEqual([]);
    });

    it("accepts person older than 18 years", () => {
      const older = "1990-05-20";
      expect(validateFecNac(older, fixedToday)).toEqual([]);
    });

    it("rejects person who turns 18 tomorrow (yesterday 18 / not yet 18) with E-RANGE", () => {
      // Born on 2008-11-14, today is 2026-11-13 -> 17 years 364 days old -> fails MIN_AGE
      const turns18Tomorrow = "2008-11-14";
      const res = validateFecNac(turns18Tomorrow, fixedToday);
      expect(res).toEqual([{ code: ERROR_CODES.RANGE, field: "PerFecNac" }]);
    });

    it("rejects birthdate today with E-RANGE (must be strictly past)", () => {
      const res = validateFecNac(fixedToday, fixedToday);
      expect(res).toEqual([{ code: ERROR_CODES.RANGE, field: "PerFecNac" }]);
    });

    it("rejects future birthdate with E-RANGE", () => {
      const futureDate = "2027-01-01";
      const res = validateFecNac(futureDate, fixedToday);
      expect(res).toEqual([{ code: ERROR_CODES.RANGE, field: "PerFecNac" }]);
    });

    it("handles leap year birthdays correctly", () => {
      // Leap birthday: 2008-02-29, today 2026-02-28 -> age 17 -> fail
      expect(validateFecNac("2008-02-29", "2026-02-28")).toEqual([
        { code: ERROR_CODES.RANGE, field: "PerFecNac" },
      ]);
      // Leap birthday: 2008-02-29, today 2026-03-01 -> age 18 -> ok
      expect(validateFecNac("2008-02-29", "2026-03-01")).toEqual([]);
    });

    it("rejects invalid date strings with E-FORMAT", () => {
      expect(validateFecNac("not-a-date", fixedToday)).toEqual([
        { code: ERROR_CODES.FORMAT, field: "PerFecNac" },
      ]);
      expect(validateFecNac("2000-13-45", fixedToday)).toEqual([
        { code: ERROR_CODES.FORMAT, field: "PerFecNac" },
      ]);
      expect(validateFecNac("2001-02-31", fixedToday)).toEqual([
        { code: ERROR_CODES.FORMAT, field: "PerFecNac" },
      ]);
    });

    it("rejects empty, null, or undefined with E-REQUIRED", () => {
      expect(validateFecNac("", fixedToday)).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PerFecNac" },
      ]);
      expect(validateFecNac(null, fixedToday)).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PerFecNac" },
      ]);
      expect(validateFecNac(undefined, fixedToday)).toEqual([
        { code: ERROR_CODES.REQUIRED, field: "PerFecNac" },
      ]);
    });
  });

  describe("Full row validation", () => {
    const fixedToday = "2026-11-13";

    it("validates a valid PersonalRow", () => {
      const validPersonal = {
        PerCod: 100,
        PerNom: "Carlos Mendoza",
        PerDNI: "71234567",
        PerFecNac: "1995-04-10",
        PerPaiCod: 1,
        PerDepCod: 2,
        PerCarCod: 3,
        PerEstReg: EST_A,
      };
      const res = validatePersonalRow(validPersonal, {
        todayLocal: fixedToday,
      });
      expect(res).toEqual([]);
    });

    it("reports all field failures in batch when multiple fields are invalid (R22)", () => {
      const badPersonal = {
        PerCod: -1, // E-RANGE
        PerNom: " ", // E-REQUIRED
        PerDNI: "ABC", // E-FORMAT + E-RANGE
        PerFecNac: "2020-01-01", // E-RANGE (< 18)
        PerPaiCod: "xyz", // E-FORMAT
        PerDepCod: 0, // E-RANGE
        PerCarCod: null, // E-REQUIRED
      };
      const failures = validatePersonalRow(badPersonal, {
        todayLocal: fixedToday,
      });
      expect(failures.length).toBeGreaterThanOrEqual(7);
      const codes = failures.map((f) => f.code);
      expect(codes).toContain(ERROR_CODES.RANGE);
      expect(codes).toContain(ERROR_CODES.REQUIRED);
      expect(codes).toContain(ERROR_CODES.FORMAT);
    });

    it("allows omitting code during update validation", () => {
      const updatePayload = {
        PaiNom: "Argentina",
      };
      expect(validatePaisRow(updatePayload, { isUpdate: true })).toEqual([]);
      expect(
        validateDependenciaRow({ DepNom: "Finanzas" }, { isUpdate: true }),
      ).toEqual([]);
      expect(
        validateCargoRow({ CarNom: "Director" }, { isUpdate: true }),
      ).toEqual([]);
    });

    it("routes correctly via validateRow generic dispatcher", () => {
      expect(validateRow(TABLE_PAIS, { PaiCod: 1, PaiNom: "Chile" })).toEqual(
        [],
      );
      expect(
        validateRow(
          TABLE_PERSONAL,
          {
            PerCod: 1,
            PerNom: "Ana Gomez",
            PerDNI: "78901234",
            PerFecNac: "2000-01-01",
            PerPaiCod: 1,
            PerDepCod: 1,
            PerCarCod: 1,
          },
          { todayLocal: fixedToday },
        ),
      ).toEqual([]);
    });
  });
});
