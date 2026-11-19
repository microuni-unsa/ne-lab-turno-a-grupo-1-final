import {
  buildRequiredMap,
  createFormDefaults,
} from "@microx-technologies/microform";
import { describe, expect, it } from "vitest";
import {
  createPersonalSchema,
  createReferenceSchema,
} from "@/features/maintenance/schemas";

describe("maintenance Zod v4 schemas", () => {
  it("valida códigos numéricos enteros (PAIS/DEPENDENCIA/CARGO/PERSONAL) con createCodeSchema(field,isUpdate)", () => {
    const refInsert = createReferenceSchema({
      codeField: "PaiCod",
      nomField: "PaiNom",
      isUpdate: false,
    });

    // Adición: código opcional (DB-generated); cuando se provee debe ser entero positivo.
    expect(refInsert.safeParse({ PaiNom: "Perú" }).success).toBe(true);
    expect(refInsert.safeParse({ PaiCod: 1, PaiNom: "Perú" }).success).toBe(
      true,
    );
    expect(refInsert.safeParse({ PaiCod: "1", PaiNom: "Perú" }).success).toBe(
      false,
    );
    expect(refInsert.safeParse({ PaiCod: "PER", PaiNom: "Perú" }).success).toBe(
      false,
    );
    expect(refInsert.safeParse({ PaiCod: 1.5, PaiNom: "Perú" }).success).toBe(
      false,
    );
    expect(refInsert.safeParse({ PaiCod: 0, PaiNom: "Perú" }).success).toBe(
      false,
    );
    expect(refInsert.safeParse({ PaiCod: -5, PaiNom: "Perú" }).success).toBe(
      false,
    );

    const refUpdate = createReferenceSchema({
      codeField: "PaiCod",
      nomField: "PaiNom",
      isUpdate: true,
    });
    // Modificación: el código viaja readonly y es requerido.
    expect(refUpdate.safeParse({ PaiNom: "Perú Actualizado" }).success).toBe(
      false,
    );
    expect(refUpdate.safeParse({ PaiCod: 1, PaiNom: "Perú" }).success).toBe(
      true,
    );
    expect(refUpdate.safeParse({ PaiCod: 0, PaiNom: "Perú" }).success).toBe(
      false,
    );
    expect(refUpdate.safeParse({ PaiCod: 1.5, PaiNom: "Perú" }).success).toBe(
      false,
    );

    const personalInsert = createPersonalSchema({
      isUpdate: false,
      todayLocal: "2026-05-10",
    });

    const basePersonal = {
      PerNom: "Ana Torres",
      PerDNI: "12345678",
      PerFecNac: "2000-01-15",
      PerPaiCod: 1,
      PerDepCod: 2,
      PerCarCod: 3,
    };

    // Adición personal: PK opcional al insertar.
    expect(personalInsert.safeParse(basePersonal).success).toBe(true);
    expect(
      personalInsert.safeParse({ ...basePersonal, PerCod: 101 }).success,
    ).toBe(true);
    expect(
      personalInsert.safeParse({ ...basePersonal, PerCod: 0 }).success,
    ).toBe(false);
    expect(
      personalInsert.safeParse({ ...basePersonal, PerCod: 1.5 }).success,
    ).toBe(false);
    expect(
      personalInsert.safeParse({ ...basePersonal, PerCod: "101" }).success,
    ).toBe(false);
    // El techo INTEGER (2147483647) lo impone validateCode/DB, no el schema del form.
    expect(
      personalInsert.safeParse({ ...basePersonal, PerCod: 2147483648 }).success,
    ).toBe(true);
  });

  it("valida nombres trimmed (MIN_NAME..MAX_NAME), DNI 8 dígitos ASCII y FKs numéricas positivas", () => {
    const refInsert = createReferenceSchema({
      codeField: "CarCod",
      nomField: "CarNom",
      isUpdate: false,
    });

    expect(refInsert.safeParse({ CarNom: " A " }).success).toBe(false);
    expect(refInsert.safeParse({ CarNom: "   " }).success).toBe(false);

    const abParsed = refInsert.safeParse({ CarNom: "  Ab  " });
    expect(abParsed.success).toBe(true);
    if (abParsed.success) {
      expect(abParsed.data.CarNom).toBe("Ab");
    }

    expect(
      refInsert.safeParse({ CarCod: 1, CarNom: "x".repeat(100) }).success,
    ).toBe(true);
    expect(
      refInsert.safeParse({ CarCod: 1, CarNom: "x".repeat(101) }).success,
    ).toBe(false);

    const personalSchema = createPersonalSchema({
      isUpdate: false,
      todayLocal: "2026-05-10",
    });

    const validBase = {
      PerCod: 10,
      PerNom: "Carlos Vega",
      PerDNI: "12345678",
      PerFecNac: "1995-03-10",
      PerPaiCod: 1,
      PerDepCod: 2,
      PerCarCod: 3,
    };

    expect(personalSchema.safeParse(validBase).success).toBe(true);
    expect(
      personalSchema.safeParse({ ...validBase, PerDNI: "1234567" }).success,
    ).toBe(false);

    const alphaDni = personalSchema.safeParse({
      ...validBase,
      PerDNI: "1234567A",
    });
    expect(alphaDni.success).toBe(false);
    if (!alphaDni.success) {
      expect(alphaDni.error.issues[0]?.message).toContain("E-FORMAT");
    }

    const bothInvalidDni = personalSchema.safeParse({
      ...validBase,
      PerDNI: "123456A",
    });
    expect(bothInvalidDni.success).toBe(false);
    if (!bothInvalidDni.success) {
      const messages = bothInvalidDni.error.issues
        .map((issue) => issue.message)
        .join(" | ");
      expect(messages).toContain("E-FORMAT");
      expect(messages).toContain("E-RANGE");
    }

    expect(
      personalSchema.safeParse({ ...validBase, PerPaiCod: undefined }).success,
    ).toBe(false);
    expect(
      personalSchema.safeParse({ ...validBase, PerDepCod: 0 }).success,
    ).toBe(false);
    expect(
      personalSchema.safeParse({ ...validBase, PerCarCod: 32768 }).success,
    ).toBe(true);
    expect(
      personalSchema.safeParse({ ...validBase, PerCarCod: "PRG" }).success,
    ).toBe(false);
  });

  it("valida PerFecNac exacto >= MIN_AGE (18 años), 1 día menor, futuro y bisiesto 2004-02-29", () => {
    const schema = createPersonalSchema({
      isUpdate: false,
      todayLocal: "2026-05-10",
    });

    const base = {
      PerNom: "Lucía Paredes",
      PerDNI: "87654321",
      PerPaiCod: 1,
      PerDepCod: 2,
      PerCarCod: 3,
    };

    // Cumple exactamente 18 años en todayLocal (2026-05-10)
    expect(schema.safeParse({ ...base, PerFecNac: "2008-05-10" }).success).toBe(
      true,
    );

    // Un día menor de 18 años
    const underage = schema.safeParse({ ...base, PerFecNac: "2008-05-11" });
    expect(underage.success).toBe(false);
    if (!underage.success) {
      expect(underage.error.issues[0]?.message).toContain("E-RANGE");
    }

    // Fecha futura o igual a hoy
    expect(schema.safeParse({ ...base, PerFecNac: "2026-05-10" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...base, PerFecNac: "2027-01-01" }).success).toBe(
      false,
    );

    // Bisiesto válido (2004-02-29) vs bisiesto inválido (2003-02-29)
    expect(schema.safeParse({ ...base, PerFecNac: "2004-02-29" }).success).toBe(
      true,
    );
    expect(schema.safeParse({ ...base, PerFecNac: "2003-02-29" }).success).toBe(
      false,
    );
  });

  it("integra con createFormDefaults y buildRequiredMap de microform sin perder obligatoriedad", () => {
    const refSchema = createReferenceSchema({
      codeField: "PaiCod",
      nomField: "PaiNom",
      isUpdate: false,
    });
    const refDefaults = createFormDefaults(refSchema);
    expect(refDefaults.PaiCod).toBeUndefined();
    expect(refDefaults.PaiNom).toBe("");

    const refRequired = buildRequiredMap(refSchema);
    expect(refRequired.get("PaiCod")).toBe(false);
    expect(refRequired.get("PaiNom")).toBe(true);

    const refUpdateSchema = createReferenceSchema({
      codeField: "PaiCod",
      nomField: "PaiNom",
      isUpdate: true,
    });
    const refUpdateRequired = buildRequiredMap(refUpdateSchema);
    expect(refUpdateRequired.get("PaiCod")).toBe(true);
    expect(refUpdateRequired.get("PaiNom")).toBe(true);

    const perUpdateSchema = createPersonalSchema({
      isUpdate: true,
      todayLocal: "2026-05-10",
    });
    const perRequired = buildRequiredMap(perUpdateSchema);
    expect(perRequired.get("PerCod")).toBe(true);
    expect(perRequired.get("PerNom")).toBe(true);
    expect(perRequired.get("PerDNI")).toBe(true);
    expect(perRequired.get("PerFecNac")).toBe(true);
    expect(perRequired.get("PerPaiCod")).toBe(true);

    const perInsertSchema = createPersonalSchema({
      isUpdate: false,
      todayLocal: "2026-05-10",
    });
    const perInsertRequired = buildRequiredMap(perInsertSchema);
    expect(perInsertRequired.get("PerCod")).toBe(false);
    expect(perInsertRequired.get("PerNom")).toBe(true);
  });
});
