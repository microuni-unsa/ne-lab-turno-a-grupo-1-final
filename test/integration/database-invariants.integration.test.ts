import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Gate integration tests by LIVE_DB=1.
 * When unset, skip gracefully with explicit console.warn + describe.skip (the ONLY allowed skip path).
 */
const isLiveDb = process.env.LIVE_DB === "1";

if (!isLiveDb) {
  console.warn(
    "[test/integration] Skipping live database integration tests: LIVE_DB=1 is not set.",
  );
}

const describeLive = isLiveDb ? describe : describe.skip;

function getSupabaseClient(): SupabaseClient {
  if (
    !process.env.VITE_SUPABASE_URL ||
    !process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ) {
    const repoEnvPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(repoEnvPath)) {
      const content = fs.readFileSync(repoEnvPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed
            .slice(eqIdx + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }

  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url) {
    throw new Error("Missing required environment variable: VITE_SUPABASE_URL");
  }
  if (!key) {
    throw new Error(
      "Missing required environment variable: VITE_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

interface EstRegProjection {
  EstRegCod: number;
  EstRegNom: string;
  EstRegSim: string;
}

interface PaisProjection {
  PaiCod: number;
  PaiNom: string;
  PaiEstReg: number;
}

interface PaisSelectProjection {
  PaiCod: number;
  PaiNom: string;
}

interface PaisEstadoProjection {
  PaiEstReg: number;
}

interface DependenciaProjection {
  DepCod: number;
  DepNom: string;
  DepEstReg: number;
}

interface CargoProjection {
  CarCod: number;
  CarNom: string;
  CarEstReg: number;
}

interface PersonalProjection {
  PerCod: number;
  PerNom: string;
  PerDNI: string;
  PerFecNac: string;
  PerPaiCod: number;
  PerDepCod: number;
  PerCarCod: number;
  PerEstReg: number;
}

interface AuditTimestampProjection {
  created_at: string;
  updated_at: string;
}

function readPaisProjection(raw: unknown): PaisProjection | null {
  if (typeof raw !== "object" || raw === null) return null;
  if (
    !("PaiCod" in raw) ||
    typeof raw.PaiCod !== "number" ||
    !("PaiNom" in raw) ||
    typeof raw.PaiNom !== "string" ||
    !("PaiEstReg" in raw) ||
    typeof raw.PaiEstReg !== "number"
  ) {
    return null;
  }
  return {
    PaiCod: raw.PaiCod,
    PaiNom: raw.PaiNom,
    PaiEstReg: raw.PaiEstReg,
  };
}

describeLive("Live Integration Tests — SPEC §13 Invariants & RPCs", () => {
  let supabase: SupabaseClient;
  const workerPidSuffix = process.pid % 500;
  const scratchBase = 9100 + workerPidSuffix;

  beforeAll(() => {
    supabase = getSupabaseClient();
  });

  afterAll(async () => {
    // Integrity confirmation: re-query and assert seed rows intact after all tests run
    const { data: pais1 } = await supabase
      .from("pais")
      .select("PaiCod, PaiNom, PaiEstReg")
      .eq("PaiCod", 1)
      .single()
      .overrideTypes<PaisProjection, { merge: false }>();
    expect(pais1).toBeDefined();
    expect(pais1?.PaiEstReg).toBe(1);
    expect(pais1?.PaiNom).toBe("Perú");

    const { data: deps } = await supabase
      .from("dependencia")
      .select("DepCod, DepNom, DepEstReg")
      .order("DepCod", { ascending: true })
      .overrideTypes<Array<DependenciaProjection>, { merge: false }>();
    expect(deps).toBeDefined();
    expect(deps?.length).toBeGreaterThanOrEqual(3);
    const depNames = deps?.map((d) => d.DepNom);
    expect(depNames).toContain("Sistemas");
    expect(depNames).toContain("Contabilidad");
    expect(depNames).toContain("Almacen");
  });

  // 1. Seeded rows present
  describe("1. Seeded rows present (Appendix B & SPEC §13)", () => {
    it("ESTREG table contains 3 canonical states (Activo, Inactivo, Eliminado)", async () => {
      const { data, error } = await supabase
        .from("estreg")
        .select("*")
        .order("EstRegCod", { ascending: true })
        .overrideTypes<Array<EstRegProjection>, { merge: false }>();
      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data).toEqual([
        { EstRegCod: 1, EstRegNom: "Activo", EstRegSim: "A" },
        { EstRegCod: 2, EstRegNom: "Inactivo", EstRegSim: "I" },
        { EstRegCod: 3, EstRegNom: "Eliminado", EstRegSim: "*" },
      ]);
    });

    it("PAIS contains 5 seeded countries, all Activo (EstReg=1)", async () => {
      const { data, error } = await supabase
        .from("pais")
        .select("PaiCod, PaiNom, PaiEstReg")
        .order("PaiCod", { ascending: true })
        .overrideTypes<Array<PaisProjection>, { merge: false }>();
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(5);

      const seededPaises = data?.slice(0, 5);
      expect(seededPaises).toEqual([
        { PaiCod: 1, PaiNom: "Perú", PaiEstReg: 1 },
        { PaiCod: 2, PaiNom: "Chile", PaiEstReg: 1 },
        { PaiCod: 3, PaiNom: "Colombia", PaiEstReg: 1 },
        { PaiCod: 4, PaiNom: "Ecuador", PaiEstReg: 1 },
        { PaiCod: 5, PaiNom: "Bolivia", PaiEstReg: 1 },
      ]);
    });

    it("DEPENDENCIA contains 3 lab-mandated dependencias, all Activo", async () => {
      const { data, error } = await supabase
        .from("dependencia")
        .select("DepCod, DepNom, DepEstReg")
        .order("DepCod", { ascending: true })
        .overrideTypes<Array<DependenciaProjection>, { merge: false }>();
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(3);

      const seededDeps = data?.slice(0, 3);
      expect(seededDeps).toEqual([
        { DepCod: 1, DepNom: "Sistemas", DepEstReg: 1 },
        { DepCod: 2, DepNom: "Contabilidad", DepEstReg: 1 },
        { DepCod: 3, DepNom: "Almacen", DepEstReg: 1 },
      ]);
    });

    it("CARGO contains 5 seeded cargos, all Activo", async () => {
      const { data, error } = await supabase
        .from("cargo")
        .select("CarCod, CarNom, CarEstReg")
        .order("CarCod", { ascending: true })
        .overrideTypes<Array<CargoProjection>, { merge: false }>();
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(5);

      const seededCargos = data?.slice(0, 5);
      expect(seededCargos).toEqual([
        { CarCod: 1, CarNom: "Analista de Sistemas", CarEstReg: 1 },
        { CarCod: 2, CarNom: "Programador", CarEstReg: 1 },
        { CarCod: 3, CarNom: "Contador", CarEstReg: 1 },
        { CarCod: 4, CarNom: "Almacenero", CarEstReg: 1 },
        { CarCod: 5, CarNom: "Gerente", CarEstReg: 1 },
      ]);
    });

    it("PERSONAL contains 4 seeded employees (Juan Pérez, María López, Carlos García, Ana Rodríguez)", async () => {
      const { data, error } = await supabase
        .from("personal")
        .select(
          "PerCod, PerNom, PerDNI, PerFecNac, PerPaiCod, PerDepCod, PerCarCod, PerEstReg",
        )
        .order("PerCod", { ascending: true })
        .overrideTypes<Array<PersonalProjection>, { merge: false }>();
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(4);

      const juan = data?.find((p) => p.PerCod === 1);
      expect(juan).toMatchObject({
        PerCod: 1,
        PerNom: "Juan Pérez",
        PerDNI: "70000001",
        PerFecNac: "1990-03-15",
        PerPaiCod: 1,
        PerDepCod: 1,
        PerCarCod: 2,
        PerEstReg: 1,
      });

      const maria = data?.find((p) => p.PerCod === 2);
      expect(maria).toMatchObject({
        PerCod: 2,
        PerNom: "María López",
        PerDNI: "70000002",
        PerFecNac: "1988-07-22",
        PerPaiCod: 1,
        PerDepCod: 2,
        PerCarCod: 3,
        PerEstReg: 1,
      });

      const carlos = data?.find((p) => p.PerCod === 3);
      expect(carlos).toMatchObject({
        PerCod: 3,
        PerNom: "Carlos García",
        PerDNI: "70000003",
        PerFecNac: "1995-11-02",
        PerPaiCod: 2,
        PerDepCod: 3,
        PerCarCod: 4,
        PerEstReg: 1,
      });

      const ana = data?.find((p) => p.PerCod === 4);
      expect(ana).toMatchObject({
        PerCod: 4,
        PerNom: "Ana Rodríguez",
        PerDNI: "70000004",
        PerFecNac: "1985-01-30",
        PerPaiCod: 1,
        PerDepCod: 1,
        PerCarCod: 1,
        PerEstReg: 1,
      });
    });
  });

  // 2. FK existence invariant (§13.2)
  describe("2. FK existence invariant (SPEC §13.2)", () => {
    it("fails when inserting Personal referencing a non-existent PaiCod", async () => {
      const scratchPerCod = scratchBase + 10;
      const { error } = await supabase.from("personal").insert({
        PerNom: "Test Non-existent Pai",
        PerDNI: String(80000000 + scratchPerCod).slice(0, 8),
        PerFecNac: "1990-01-01",
        PerPaiCod: 9999, // Non-existent
        PerDepCod: 1,
        PerCarCod: 1,
        PerEstReg: 1,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23503"); // foreign_key_violation
    });

    it("fails when inserting Personal referencing a non-existent DepCod", async () => {
      const scratchPerCod = scratchBase + 11;
      const { error } = await supabase.from("personal").insert({
        PerNom: "Test Non-existent Dep",
        PerDNI: String(80000000 + scratchPerCod).slice(0, 8),
        PerFecNac: "1990-01-01",
        PerPaiCod: 1,
        PerDepCod: 9999, // Non-existent
        PerCarCod: 1,
        PerEstReg: 1,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23503");
    });

    it("fails when inserting Personal referencing a non-existent CarCod", async () => {
      const scratchPerCod = scratchBase + 12;
      const { error } = await supabase.from("personal").insert({
        PerNom: "Test Non-existent Car",
        PerDNI: String(80000000 + scratchPerCod).slice(0, 8),
        PerFecNac: "1990-01-01",
        PerPaiCod: 1,
        PerDepCod: 1,
        PerCarCod: 9999, // Non-existent
        PerEstReg: 1,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23503");
    });
  });

  // 3. Case-insensitive unique Nom invariant (ci-unique §4.3, R3)
  describe("3. Case-insensitive unique Nom invariant (ci-unique R3, E-DUP)", () => {
    it("rejects duplicate PaiNom differing only in case and leading/trailing blanks", async () => {
      const { error } = await supabase.from("pais").insert({
        PaiNom: "   pErÚ   ", // Clashes with seeded 'Perú'
        PaiEstReg: 1,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505"); // unique_violation
    });

    it("rejects duplicate DepNom differing only in case and blanks", async () => {
      const { error } = await supabase.from("dependencia").insert({
        DepNom: "  SISTEMAS  ", // Clashes with seeded 'Sistemas'
        DepEstReg: 1,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505");
    });

    it("rejects duplicate CarNom differing only in case and blanks", async () => {
      const { error } = await supabase.from("cargo").insert({
        CarNom: "  gerente  ", // Clashes with seeded 'Gerente'
        CarEstReg: 1,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505");
    });
  });

  // 4. DNI unique invariant (§4.3, R4)
  describe("4. DNI unique invariant (SPEC §4.3, R4)", () => {
    it("rejects duplicate PerDNI on Personal insert", async () => {
      const { error } = await supabase.from("personal").insert({
        PerNom: "Homónimo Juan",
        PerDNI: "70000001", // Seeded Juan Pérez DNI
        PerFecNac: "1992-06-15",
        PerPaiCod: 1,
        PerDepCod: 1,
        PerCarCod: 1,
        PerEstReg: 1,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505"); // unique_violation
    });
  });

  // 5. MIN_AGE boundary vs DB CHECK constraint (§5.3, §13.4)
  describe("5. MIN_AGE boundary vs DB CHECK constraint (SPEC §13.4)", () => {
    it("accepts person who is exactly 18 years old today relative to CURRENT_DATE", async () => {
      const scratchPerCod = scratchBase + 40;
      const dni = String(80000000 + scratchPerCod).slice(0, 8);

      // Compute exact 18 years ago today: today - 18 years
      const now = new Date();
      const year18Ago = now.getUTCFullYear() - 18;
      const month = String(now.getUTCMonth() + 1).padStart(2, "0");
      const day = String(now.getUTCDate()).padStart(2, "0");
      const exactly18Today = `${year18Ago}-${month}-${day}`;

      try {
        const inserted = await supabase
          .from("personal")
          .insert({
            PerNom: "Adulto Exacto 18",
            PerDNI: dni,
            PerFecNac: exactly18Today,
            PerPaiCod: 1,
            PerDepCod: 1,
            PerCarCod: 1,
            PerEstReg: 1,
          })
          .select("PerCod")
          .single();
        expect(inserted.error).toBeNull();
        const newCode: unknown = (inserted.data as { PerCod?: unknown } | null)
          ?.PerCod;
        if (typeof newCode === "number") {
          await supabase.from("personal").delete().eq("PerCod", newCode);
        }
      } finally {
        await supabase.from("personal").delete().eq("PerDNI", dni);
      }
    });

    it("rejects person who turns 18 tomorrow (yesterday-18 / 17 years old) with DB CHECK violation (23514)", async () => {
      const scratchPerCod = scratchBase + 41;
      const dni = String(80000000 + scratchPerCod).slice(0, 8);

      // Tomorrow's date 18 years ago = not yet 18 today
      const tomorrow18AgoDate = new Date();
      tomorrow18AgoDate.setUTCDate(tomorrow18AgoDate.getUTCDate() + 1);
      const year18Ago = tomorrow18AgoDate.getUTCFullYear() - 18;
      const month = String(tomorrow18AgoDate.getUTCMonth() + 1).padStart(
        2,
        "0",
      );
      const day = String(tomorrow18AgoDate.getUTCDate()).padStart(2, "0");
      const turns18Tomorrow = `${year18Ago}-${month}-${day}`;

      const { error } = await supabase.from("personal").insert({
        PerNom: "Menor 17 Años",
        PerDNI: dni,
        PerFecNac: turns18Tomorrow,
        PerPaiCod: 1,
        PerDepCod: 1,
        PerCarCod: 1,
        PerEstReg: 1,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514"); // check_violation
    });

    it("rejects future birthdate with DB CHECK violation (23514)", async () => {
      const scratchPerCod = scratchBase + 42;
      const dni = String(80000000 + scratchPerCod).slice(0, 8);
      const { error } = await supabase.from("personal").insert({
        PerNom: "Persona del Futuro",
        PerDNI: dni,
        PerFecNac: "2030-01-01",
        PerPaiCod: 1,
        PerDepCod: 1,
        PerCarCod: 1,
        PerEstReg: 1,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514"); // check_violation
    });
  });

  // 6. R11 block: Eliminar pais(1) blocked -> Inactivar allowed + restore to A
  describe("6. R11 block: Eliminar referenced row blocked, Inactivar allowed + restore (SPEC §7, R11, R12)", () => {
    it("blocks Eliminar on Pais 1 (Perú) with E-REF-BLOCKED, allows Inactivar, and restores Activo", async () => {
      // 1. Attempt to eliminate Pais 1 (referenced by Juan Pérez, María López, Ana Rodríguez)
      const { data: elimData, error: elimError } = await supabase.rpc(
        "guardar_pais",
        {
          op: "set_state",
          p_cod: 1,
          p_nom: null,
          p_est: 3, // Eliminado
        },
      );
      expect(elimData).toBeNull();
      expect(elimError).not.toBeNull();
      expect(elimError?.message).toContain("E-REF-BLOCKED");

      try {
        // 2. Inactivar Pais 1 is allowed per R12
        const { error: inactError } = await supabase.rpc("guardar_pais", {
          op: "set_state",
          p_cod: 1,
          p_nom: null,
          p_est: 2, // Inactivo
        });
        expect(inactError).toBeNull();

        // Verify state is now 2 (Inactivo)
        const { data: rowInact } = await supabase
          .from("pais")
          .select("PaiEstReg")
          .eq("PaiCod", 1)
          .single()
          .overrideTypes<PaisEstadoProjection, { merge: false }>();
        expect(rowInact?.PaiEstReg).toBe(2);
      } finally {
        // 3. Guarantee restoration back to Activo (EstReg = 1) in finally block
        const { error: restoreError } = await supabase.rpc("guardar_pais", {
          op: "set_state",
          p_cod: 1,
          p_nom: null,
          p_est: 1, // Activo
        });
        expect(restoreError).toBeNull();

        const { data: restoredRow } = await supabase
          .from("pais")
          .select("PaiEstReg")
          .eq("PaiCod", 1)
          .single()
          .overrideTypes<PaisEstadoProjection, { merge: false }>();
        expect(restoredRow?.PaiEstReg).toBe(1);
      }
    });
  });

  // 7. G-SEL Activo-only after an Inactivar (§9, R7)
  describe("7. G-SEL Activo-only selection query after an Inactivar (SPEC §9, R7)", () => {
    it("excludes Inactivo row from selection query and includes it again after reactivation", async () => {
      const scratchNom = `Scratch Pais G-SEL ${Date.now()}`;
      let scratchCod = 0;

      try {
        // Create scratch pais in Activo state (PK is DB-generated)
        const { data: insRaw, error: insErr } = await supabase.rpc(
          "guardar_pais",
          {
            op: "insert",
            p_nom: scratchNom,
            p_est: 1,
          },
        );
        expect(insErr).toBeNull();
        const insRow = readPaisProjection(insRaw);
        expect(insRow?.PaiNom).toBe(scratchNom);
        expect(insRow?.PaiEstReg).toBe(1);
        if (typeof insRow?.PaiCod !== "number") {
          throw new Error("Expected generated PaiCod from insert RPC");
        }
        scratchCod = insRow.PaiCod;

        // G-SEL query: Activo only (EstReg = 1)
        const { data: sel1 } = await supabase
          .from("pais")
          .select("PaiCod, PaiNom")
          .eq("PaiEstReg", 1)
          .order("PaiNom", { ascending: true })
          .overrideTypes<Array<PaisSelectProjection>, { merge: false }>();
        expect(sel1?.some((p) => p.PaiCod === scratchCod)).toBe(true);

        // Inactivar the scratch pais
        const { error: inactErr } = await supabase.rpc("guardar_pais", {
          op: "set_state",
          p_cod: scratchCod,
          p_nom: null,
          p_est: 2,
        });
        expect(inactErr).toBeNull();

        // G-SEL query: must NOT include the Inactivo row
        const { data: sel2 } = await supabase
          .from("pais")
          .select("PaiCod, PaiNom")
          .eq("PaiEstReg", 1)
          .order("PaiNom", { ascending: true })
          .overrideTypes<Array<PaisSelectProjection>, { merge: false }>();
        expect(sel2?.some((p) => p.PaiCod === scratchCod)).toBe(false);

        // Reactivar the scratch pais -> reappears in G-SEL
        const { error: reactErr } = await supabase.rpc("guardar_pais", {
          op: "set_state",
          p_cod: scratchCod,
          p_nom: null,
          p_est: 1,
        });
        expect(reactErr).toBeNull();

        const { data: sel3 } = await supabase
          .from("pais")
          .select("PaiCod, PaiNom")
          .eq("PaiEstReg", 1)
          .order("PaiNom", { ascending: true })
          .overrideTypes<Array<PaisSelectProjection>, { merge: false }>();
        expect(sel3?.some((p) => p.PaiCod === scratchCod)).toBe(true);
      } finally {
        // Cleanup scratch row
        if (scratchCod > 0) {
          await supabase.from("pais").delete().eq("PaiCod", scratchCod);
        }
      }
    });
  });

  describe("8. RPC round-trip on scratch codes >= 9100 ending Eliminated (SPEC §8, §6.1)", () => {
    it("executes full RPC lifecycle insert -> update -> inactivate -> reactivate -> eliminate", async () => {
      const stamp = Date.now();
      const initialNom = `Scratch RPC ${stamp}`;
      const updatedNom = `Scratch RPC Modificado ${stamp}`;
      let scratchCod = 0;

      try {
        // 1. Insert via RPC: forces EstReg = 1 (Activo) even when p_est differs (R9)
        const { data: insRaw, error: insErr } = await supabase.rpc(
          "guardar_pais",
          {
            op: "insert",
            p_nom: initialNom,
            p_est: 2,
          },
        );
        expect(insErr).toBeNull();
        const insRow = readPaisProjection(insRaw);
        expect(insRow?.PaiNom).toBe(initialNom);
        expect(insRow?.PaiEstReg).toBe(1);
        if (typeof insRow?.PaiCod !== "number") {
          throw new Error("Expected generated PaiCod from insert RPC");
        }
        scratchCod = insRow.PaiCod;

        // 2. Update via RPC: preserves EstReg
        const { data: updRaw, error: updErr } = await supabase.rpc(
          "guardar_pais",
          {
            op: "update",
            p_cod: scratchCod,
            p_nom: updatedNom,
            p_est: 1,
          },
        );
        expect(updErr).toBeNull();
        const updRow = readPaisProjection(updRaw);
        expect(updRow?.PaiNom).toBe(updatedNom);
        expect(updRow?.PaiEstReg).toBe(1);

        // 3. Inactivar via RPC: 1 -> 2
        const { data: inactRaw, error: inactErr } = await supabase.rpc(
          "guardar_pais",
          {
            op: "set_state",
            p_cod: scratchCod,
            p_nom: null,
            p_est: 2,
          },
        );
        expect(inactErr).toBeNull();
        const inactRow = readPaisProjection(inactRaw);
        expect(inactRow?.PaiEstReg).toBe(2);

        // 4. Reactivar via RPC: 2 -> 1
        const { data: reactRaw, error: reactErr } = await supabase.rpc(
          "guardar_pais",
          {
            op: "set_state",
            p_cod: scratchCod,
            p_nom: null,
            p_est: 1,
          },
        );
        expect(reactErr).toBeNull();
        const reactRow = readPaisProjection(reactRaw);
        expect(reactRow?.PaiEstReg).toBe(1);

        // 5. Eliminar via RPC: 1 -> 3 (terminal)
        const { data: elimRaw, error: elimErr } = await supabase.rpc(
          "guardar_pais",
          {
            op: "set_state",
            p_cod: scratchCod,
            p_nom: null,
            p_est: 3,
          },
        );
        expect(elimErr).toBeNull();
        const elimRow = readPaisProjection(elimRaw);
        expect(elimRow?.PaiEstReg).toBe(3);

        // 6. Terminal check: modifying an eliminated row is blocked with E-TRANSITION
        const { error: blockedModErr } = await supabase.rpc("guardar_pais", {
          op: "update",
          p_cod: scratchCod,
          p_nom: "Should Fail",
          p_est: 3,
        });
        expect(blockedModErr).not.toBeNull();
        expect(blockedModErr?.message).toContain("E-TRANSITION");
      } finally {
        // Physical cleanup of scratch code to keep database pristine
        if (scratchCod > 0) {
          await supabase.from("pais").delete().eq("PaiCod", scratchCod);
        }
      }
    });
  });

  // 9. Audit created_at immutable + updated_at bump (§10, R15, R16)
  describe("9. Audit traceability (created_at immutable + updated_at bump) (SPEC §10)", () => {
    it("preserves created_at and bumps updated_at on row update", async () => {
      const stamp = Date.now();
      const initialNom = `Scratch Audit ${stamp}`;
      const bumpedNom = `Scratch Audit Bumped ${stamp}`;
      let scratchCod = 0;

      try {
        // Insert scratch row in dependencia (PK is DB-generated)
        const { data: insRaw, error: insErr } = await supabase.rpc(
          "guardar_dependencia",
          {
            op: "insert",
            p_nom: initialNom,
            p_est: 1,
          },
        );
        expect(insErr).toBeNull();
        const depCod: unknown = (insRaw as { DepCod?: unknown } | null)?.DepCod;
        if (typeof depCod !== "number") {
          throw new Error("Expected generated DepCod from insert RPC");
        }
        scratchCod = depCod;

        const { data: r1 } = await supabase
          .from("dependencia")
          .select("created_at, updated_at")
          .eq("DepCod", scratchCod)
          .single()
          .overrideTypes<AuditTimestampProjection, { merge: false }>();
        if (!r1) {
          throw new Error("Expected initial dependencia audit row");
        }

        // Small pause to guarantee timestamp advancement if resolution is coarse
        await new Promise((res) => setTimeout(res, 50));

        // Update the row
        const { error: updErr } = await supabase.rpc("guardar_dependencia", {
          op: "update",
          p_cod: scratchCod,
          p_nom: bumpedNom,
          p_est: 1,
        });
        expect(updErr).toBeNull();

        const { data: r2 } = await supabase
          .from("dependencia")
          .select("created_at, updated_at")
          .eq("DepCod", scratchCod)
          .single()
          .overrideTypes<AuditTimestampProjection, { merge: false }>();
        if (!r2) {
          throw new Error("Expected updated dependencia audit row");
        }

        // Invariant R16: created_at is immutable
        expect(r2.created_at).toBe(r1.created_at);

        // Invariant R16: updated_at is bumped by trigger
        expect(new Date(r2.updated_at).getTime()).toBeGreaterThan(
          new Date(r1.updated_at).getTime(),
        );
      } finally {
        if (scratchCod > 0) {
          await supabase.from("dependencia").delete().eq("DepCod", scratchCod);
        }
      }
    });
  });
});
