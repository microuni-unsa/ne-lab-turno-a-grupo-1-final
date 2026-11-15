import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  ERROR_CODES,
  EST_A,
  EST_I,
  type PaisRow,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
} from "@/core";
import { CargoRepo, DependenciaRepo, PaisRepo, PersonalRepo } from "@/data";
import { invalidateTableQueries } from "@/features/maintenance/query-keys";
import {
  createGselLabelResolver,
  createGselQuerySource,
  type GselRepoContract,
} from "@/features/personal/gsel-source";

const isLiveDb = process.env.LIVE_DB === "1";

if (!isLiveDb) {
  console.warn(
    "[test/integration] Skipping live Supabase G-SEL tests: LIVE_DB=1 is not set.",
  );
}

const describeLive = isLiveDb ? describe : describe.skip;

function readSecretSupabaseClient(): SupabaseClient {
  if (
    !process.env.VITE_SUPABASE_URL ||
    !process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ) {
    const candidate = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "LIVE_DB=1 requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("G-SEL QueryClient cache integration (Fase 8 offline)", () => {
  it("refresca opciones de createGselQuerySource al invalidar maintenanceKeys.gsel sin afectar otras tablas", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, retry: false },
      },
    });

    let includeTemp = true;
    const paisRepo: GselRepoContract<PaisRow> = {
      async gsel() {
        return includeTemp
          ? [
              { PaiCod: 1, PaiNom: "Perú", PaiEstReg: EST_A },
              { PaiCod: 99, PaiNom: "Argentina", PaiEstReg: EST_A },
            ]
          : [{ PaiCod: 1, PaiNom: "Perú", PaiEstReg: EST_A }];
      },
      async getByCode() {
        return null;
      },
    };

    const depSource = createGselQuerySource({
      table: TABLE_DEPENDENCIA,
      repo: {
        async gsel() {
          return [{ DepCod: 1, DepNom: "Sistemas", DepEstReg: EST_A }];
        },
      },
      codeCol: "DepCod",
      nomCol: "DepNom",
      estCol: "DepEstReg",
      queryClient,
    });

    const paisSource = createGselQuerySource({
      table: TABLE_PAIS,
      repo: paisRepo,
      codeCol: "PaiCod",
      nomCol: "PaiNom",
      estCol: "PaiEstReg",
      queryClient,
    });

    const firstDep = await depSource.fetch({
      search: "",
      page: 1,
      pageSize: 50,
    });
    expect(firstDep.items.map((item) => item.label)).toEqual(["Sistemas"]);

    const firstPais = await paisSource.fetch({
      search: "",
      page: 1,
      pageSize: 50,
    });
    expect(firstPais.items.map((item) => item.label)).toEqual([
      "Argentina",
      "Perú",
    ]);

    includeTemp = false;
    await invalidateTableQueries(queryClient, TABLE_PAIS);

    const refreshedPais = await paisSource.fetch({
      search: "",
      page: 1,
      pageSize: 50,
    });
    expect(refreshedPais.items.map((item) => item.label)).toEqual(["Perú"]);
    expect(refreshedPais.items.some((item) => item.value === "99")).toBe(false);
  });
});

describeLive("G-SEL Live Supabase Integration (LIVE_DB=1)", () => {
  it("consulta Activo-only Nom ASC, Cod ASC en los 3 catálogos, excluye inactivos y valida R7/E-REF-STATE", async () => {
    const client = readSecretSupabaseClient();
    const paisRepo = new PaisRepo(client);
    const depRepo = new DependenciaRepo(client);
    const cargoRepo = new CargoRepo(client);
    const personalRepo = new PersonalRepo(client);

    const tempPaisCode = 31661;
    const tempPersonalCode = 31691;
    const tempNom = `TestGselPais_${Date.now()}`;

    await client.from("personal").delete().eq("PerCod", tempPersonalCode);
    await client.from("pais").delete().eq("PaiCod", tempPaisCode);

    try {
      const paisSource = createGselQuerySource({
        table: TABLE_PAIS,
        repo: paisRepo,
        codeCol: "PaiCod",
        nomCol: "PaiNom",
        estCol: "PaiEstReg",
      });
      const depSource = createGselQuerySource({
        table: TABLE_DEPENDENCIA,
        repo: depRepo,
        codeCol: "DepCod",
        nomCol: "DepNom",
        estCol: "DepEstReg",
      });
      const cargoSource = createGselQuerySource({
        table: TABLE_CARGO,
        repo: cargoRepo,
        codeCol: "CarCod",
        nomCol: "CarNom",
        estCol: "CarEstReg",
      });

      const [paises, deps, cargos] = await Promise.all([
        paisSource.fetch({ search: "", page: 1, pageSize: 50 }),
        depSource.fetch({ search: "", page: 1, pageSize: 50 }),
        cargoSource.fetch({ search: "", page: 1, pageSize: 50 }),
      ]);
      expect(paises.items.length).toBeGreaterThanOrEqual(5);
      expect(deps.items.map((i) => i.label)).toEqual(
        expect.arrayContaining(["Almacen", "Contabilidad", "Sistemas"]),
      );
      expect(cargos.items.length).toBeGreaterThanOrEqual(5);

      const inserted = await paisRepo.guardar({
        op: "insert",
        p_cod: tempPaisCode,
        p_nom: tempNom,
      });
      expect(inserted.ok).toBe(true);

      const withTemp = await paisSource.fetch({
        search: "",
        page: 1,
        pageSize: 100,
      });
      expect(withTemp.items.some((i) => i.value === String(tempPaisCode))).toBe(
        true,
      );

      // Inactivar -> desaparece inmediatamente de G-SEL, conserva etiqueta R7 y PersonalRepo devuelve E-REF-STATE
      const inactivated = await paisRepo.guardar({
        op: "set_state",
        p_cod: tempPaisCode,
        p_est: EST_I,
      });
      expect(inactivated.ok).toBe(true);

      const withoutTemp = await paisSource.fetch({
        search: "",
        page: 1,
        pageSize: 100,
      });
      expect(
        withoutTemp.items.some((i) => i.value === String(tempPaisCode)),
      ).toBe(false);

      const resolver = createGselLabelResolver({
        table: TABLE_PAIS,
        repo: paisRepo,
        codeCol: "PaiCod",
        nomCol: "PaiNom",
        estCol: "PaiEstReg",
      });
      expect(await resolver(tempPaisCode)).toBe(`${tempNom} (Inactivo)`);

      const rejected = await personalRepo.guardar({
        op: "insert",
        p_cod: tempPersonalCode,
        p_nom: "Personal FK Inactiva",
        p_dni: "31691001",
        p_fecnac: "1992-04-12",
        p_pai: tempPaisCode,
        p_dep: 1,
        p_car: 1,
      });
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) {
        expect(
          rejected.failures.some(
            (f) => f.code === ERROR_CODES.REF_STATE && f.field === "PerPaiCod",
          ),
        ).toBe(true);
      }
    } finally {
      await client.from("personal").delete().eq("PerCod", tempPersonalCode);
      await client.from("pais").delete().eq("PaiCod", tempPaisCode);
    }
  });
});
