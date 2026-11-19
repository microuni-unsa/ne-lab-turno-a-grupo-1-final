import fs from "node:fs";
import path from "node:path";
import { IonApp } from "@ionic/react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import {
  asCarCod,
  asDepCod,
  asPaiCod,
  asPerCod,
  type CargoRow,
  createFailure,
  type DependenciaRow,
  ERROR_CODES,
  EST_A,
  EST_I,
  type EstReg,
  type PaisRow,
  type PendingOp,
  type PersonalRow,
  TABLE_PAIS,
  TABLE_PERSONAL,
} from "@/core";
import {
  type AdvancedSearchFilters,
  type OrderingSpec,
  PaisRepo,
  PersonalRepo,
} from "@/data";
import { maintenanceKeys } from "@/features/maintenance/query-keys";
import {
  PersonalMaintenancePage,
  type PersonalRepoContract,
} from "@/features/personal/PersonalMaintenancePage";
import type {
  PersonalCatalogRepo,
  PersonalCatalogRepos,
} from "@/features/personal/personal-structure";
import { IonicFeedbackProvider } from "@/lib/feedback";

const isLiveDb = process.env.LIVE_DB === "1";

if (!isLiveDb) {
  console.warn(
    "[test/integration] Skipping live Supabase PERSONAL tests: LIVE_DB=1 is not set.",
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

function makeCatalogRepo<TRow>(
  rows: TRow[],
  getCod: (r: TRow) => number,
  getNom: (r: TRow) => string,
  getEst: (r: TRow) => EstReg,
  codeCol: string,
  nomCol: string,
): PersonalCatalogRepo<TRow> {
  return {
    async list() {
      return { data: [...rows], count: rows.length };
    },
    async gsel() {
      return rows
        .filter((r) => getEst(r) === EST_A)
        .map((r) => ({ [codeCol]: getCod(r), [nomCol]: getNom(r) }));
    },
    async getByCode(code) {
      return rows.find((r) => getCod(r) === code) ?? null;
    },
  };
}

function isNameOrdering(ordering: OrderingSpec): boolean {
  if (ordering === "alternate") return true;
  return (
    typeof ordering === "object" &&
    ordering !== null &&
    ordering.column === "PerNom"
  );
}

function sortPersonal(
  rows: readonly PersonalRow[],
  ordering: OrderingSpec,
): PersonalRow[] {
  return [...rows].sort((a, b) =>
    isNameOrdering(ordering)
      ? a.PerNom.localeCompare(b.PerNom, "es", { sensitivity: "case" }) ||
        a.PerCod - b.PerCod
      : a.PerCod - b.PerCod,
  );
}

describe("PERSONAL React Query orden, búsqueda avanzada §11.3 e invalidación (Fase 9)", () => {
  afterEach(() => {
    cleanup();
  });

  it("ordena PerCod ASC -> PerNom ASC/PerCod ASC, combina filtros §11.3 (AND) y refresca R7 al invalidar catálogo", async () => {
    const paiRows: PaisRow[] = [
      {
        PaiCod: asPaiCod(1),
        PaiNom: "Perú",
        PaiEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        PaiCod: asPaiCod(2),
        PaiNom: "Chile",
        PaiEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const depRows: DependenciaRow[] = [
      {
        DepCod: asDepCod(1),
        DepNom: "Sistemas",
        DepEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const carRows: CargoRow[] = [
      {
        CarCod: asCarCod(1),
        CarNom: "Analista",
        CarEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const personalRows: PersonalRow[] = [
      {
        PerCod: asPerCod(5),
        PerNom: "Ana Salas",
        PerDNI: "70001111",
        PerFecNac: "1994-04-10",
        PerPaiCod: asPaiCod(2),
        PerDepCod: asDepCod(1),
        PerCarCod: asCarCod(1),
        PerEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        PerCod: asPerCod(2),
        PerNom: "Zoe Vera",
        PerDNI: "41112222",
        PerFecNac: "1988-08-20",
        PerPaiCod: asPaiCod(1),
        PerDepCod: asDepCod(1),
        PerCarCod: asCarCod(1),
        PerEstReg: EST_I,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        PerCod: asPerCod(8),
        PerNom: "Ana Salas",
        PerDNI: "70009999",
        PerFecNac: "1998-02-14",
        PerPaiCod: asPaiCod(1),
        PerDepCod: asDepCod(1),
        PerCarCod: asCarCod(1),
        PerEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const repo: PersonalRepoContract = {
      async list(ordering = "default") {
        const sorted = sortPersonal(personalRows, ordering);
        return { data: sorted, count: sorted.length };
      },
      async search(q, ordering = "default") {
        const term = q.trim().toLowerCase();
        const found = term
          ? personalRows.filter(
              (r) =>
                r.PerNom.toLowerCase().includes(term) ||
                r.PerDNI.includes(term) ||
                String(r.PerCod) === term,
            )
          : personalRows;
        const sorted = sortPersonal(found, ordering);
        return { data: sorted, count: sorted.length };
      },
      async advancedSearch(
        filters: AdvancedSearchFilters,
        ordering = "default",
      ) {
        const found = personalRows.filter((r) => {
          if (
            typeof filters.DNI === "string" &&
            filters.DNI &&
            !r.PerDNI.startsWith(filters.DNI)
          ) {
            return false;
          }
          if (
            typeof filters.FecNacFrom === "string" &&
            filters.FecNacFrom &&
            r.PerFecNac < filters.FecNacFrom
          ) {
            return false;
          }
          if (
            typeof filters.FecNacTo === "string" &&
            filters.FecNacTo &&
            r.PerFecNac > filters.FecNacTo
          ) {
            return false;
          }
          if (
            typeof filters.PaiCod === "number" &&
            r.PerPaiCod !== filters.PaiCod
          ) {
            return false;
          }
          if (
            Array.isArray(filters.EstReg) &&
            !filters.EstReg.includes(r.PerEstReg)
          ) {
            return false;
          }
          return true;
        });
        const sorted = sortPersonal(found, ordering);
        return { data: sorted, count: sorted.length };
      },
      async guardarOp(op: PendingOp) {
        return {
          ok: false,
          failures: [createFailure(ERROR_CODES.TRANSITION, String(op.kind))],
        };
      },
    };

    const catalogRepos: PersonalCatalogRepos = {
      pai: makeCatalogRepo(
        paiRows,
        (r) => r.PaiCod,
        (r) => r.PaiNom,
        (r) => r.PaiEstReg,
        "PaiCod",
        "PaiNom",
      ),
      dep: makeCatalogRepo(
        depRows,
        (r) => r.DepCod,
        (r) => r.DepNom,
        (r) => r.DepEstReg,
        "DepCod",
        "DepNom",
      ),
      car: makeCatalogRepo(
        carRows,
        (r) => r.CarCod,
        (r) => r.CarNom,
        (r) => r.CarEstReg,
        "CarCod",
        "CarNom",
      ),
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <IonApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/personal"]}>
            <IonicFeedbackProvider>
              <PersonalMaintenancePage
                repo={repo}
                catalogRepos={catalogRepos}
                getTodayLocal={() => "2026-05-15"}
              />
            </IonicFeedbackProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </IonApp>,
    );

    // Default ordering PerCod ASC -> #2, #5, #8
    await waitFor(() => {
      const buttons = screen
        .getByTestId("record-list-rows")
        .querySelectorAll("button");
      expect(buttons.length).toBe(3);
      expect(buttons[0]?.textContent).toContain("Zoe Vera");
      expect(buttons[1]?.textContent).toContain("Ana Salas");
      expect(buttons[2]?.textContent).toContain("70009999");
    });

    // Switch sort column -> PerNom ASC (PerCod ASC tiebreak in mock) -> #5, #8, #2
    fireEvent.click(screen.getByTestId("select-sort-column"));
    const sortItems = await screen.findAllByText("Nombre", {
      selector: "ion-label",
    });
    const perNomItem = sortItems
      .map((label) => label.closest('[data-slot="select-item"]'))
      .find((item) => item !== null);
    if (!perNomItem) {
      throw new Error("Expected PerNom sort option");
    }
    fireEvent.click(perNomItem);
    await waitFor(() => {
      const buttons = screen
        .getByTestId("record-list-rows")
        .querySelectorAll("button");
      expect(buttons[0]?.textContent).toContain("70001111");
      expect(buttons[1]?.textContent).toContain("70009999");
      expect(buttons[2]?.textContent).toContain("Zoe Vera");
    });

    // Combined Advanced Search: DNI "7000" + FecNacFrom "1996-01-01" + PaiCod 1 via G-SEL
    fireEvent.click(screen.getByTestId("btn-open-advanced"));
    const dniWrapper = (await screen.findByTestId("adv-filter-dni")).closest(
      "ion-input",
    );
    const fromWrapper = screen
      .getByTestId("adv-filter-fec-from")
      .closest("ion-input");
    dniWrapper?.dispatchEvent(
      new CustomEvent("ionInput", {
        bubbles: true,
        detail: { value: "7000", event: new Event("input") },
      }),
    );
    fromWrapper?.dispatchEvent(
      new CustomEvent("ionInput", {
        bubbles: true,
        detail: { value: "1996-01-01", event: new Event("input") },
      }),
    );

    fireEvent.click(screen.getByTestId("gsel-trigger-advPaiCod"));
    fireEvent.click(await screen.findByTestId("gsel-option-advPaiCod-1"));
    fireEvent.click(screen.getByTestId("adv-btn-apply"));

    await waitFor(() => {
      expect(screen.queryByTestId("record-row-5")).toBeNull();
      expect(screen.queryByTestId("record-row-2")).toBeNull();
      expect(screen.getByTestId("record-row-8")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("btn-clear-search"));
    expect(await screen.findByTestId("record-row-5")).toBeTruthy();

    // Invalidating PAIS cache refreshes Personal R7 subtitle (Chile -> Chile (Inactivo))

    paiRows[1] = {
      ...paiRows[1],
      PaiEstReg: EST_I,
    };
    await queryClient.invalidateQueries({
      queryKey: maintenanceKeys.lists(TABLE_PAIS),
    });

    await waitFor(() => {
      expect(screen.getByTestId("record-row-5").textContent).toContain(
        "Chile (Inactivo)",
      );
    });
    const personalQueries = queryClient
      .getQueryCache()
      .findAll({ queryKey: maintenanceKeys.lists(TABLE_PERSONAL) });
    expect(personalQueries.length).toBeGreaterThan(0);
    expect(personalQueries.some((q) => q.state.status === "success")).toBe(
      true,
    );
  });
});

describeLive(
  "Supabase LIVE_DB=1: PERSONAL CRUD, homónimos R5, FKs R6/R7, búsqueda §11.2–§11.3",
  () => {
    it("valida ciclo completo PersonalRepo contra Supabase y limpia filas temporales", async () => {
      const client = readSecretSupabaseClient();
      const personalRepo = new PersonalRepo(client);
      const paisRepo = new PaisRepo(client);

      const stamp = Date.now();
      const paisNom = `Pais Prueba ${stamp}`;
      const testDni1 = `${String(stamp).slice(-5)}001`.slice(-8);
      const testDni2 = `${String(stamp).slice(-5)}002`.slice(-8);
      let testPaiCod = 0;
      let testPerCod1 = 0;
      let testPerCod2 = 0;

      try {
        // Seed temporary Pais so we can safely test E-REF-STATE without altering seed #1
        const insPais = await paisRepo.guardarOp({
          kind: "adición",
          table: TABLE_PAIS,
          payload: { PaiNom: paisNom },
        });
        expect(insPais.ok).toBe(true);
        if (insPais.ok && insPais.row) {
          testPaiCod = insPais.row.PaiCod;
        }

        // 1. E-RANGE (<18) & E-REF (nonexistent Pais)
        const rangeErr = await personalRepo.guardarOp({
          kind: "adición",
          table: TABLE_PERSONAL,
          payload: {
            PerNom: "Menor Edad Test",
            PerDNI: testDni1,
            PerFecNac: "2012-01-15",
            PerPaiCod: testPaiCod,
            PerDepCod: 1,
            PerCarCod: 1,
          },
        });
        expect(rangeErr.ok).toBe(false);

        const refErr = await personalRepo.guardarOp({
          kind: "adición",
          table: TABLE_PERSONAL,
          payload: {
            PerNom: "Personal Sin Pais",
            PerDNI: testDni1,
            PerFecNac: "1995-05-10",
            PerPaiCod: 999999,
            PerDepCod: 1,
            PerCarCod: 1,
          },
        });
        expect(refErr.ok).toBe(false);
        if (!refErr.ok) {
          expect(refErr.failures.some((f) => f.code === ERROR_CODES.REF)).toBe(
            true,
          );
        }

        // 2. Adición #1 valid + E-DUP on PerDNI
        const add1 = await personalRepo.guardarOp({
          kind: "adición",
          table: TABLE_PERSONAL,
          payload: {
            PerNom: "Homónimo Live",
            PerDNI: testDni1,
            PerFecNac: "1994-06-15",
            PerPaiCod: testPaiCod,
            PerDepCod: 1,
            PerCarCod: 1,
          },
        });
        expect(add1.ok).toBe(true);
        if (!add1.ok || !add1.row) throw new Error("Expected add1 ok");
        testPerCod1 = add1.row.PerCod;
        const origCreatedAt = add1.row.created_at;

        const dupDni = await personalRepo.guardarOp({
          kind: "adición",
          table: TABLE_PERSONAL,
          payload: {
            PerNom: "Otro Nombre",
            PerDNI: testDni1,
            PerFecNac: "1994-06-15",
            PerPaiCod: testPaiCod,
            PerDepCod: 1,
            PerCarCod: 1,
          },
        });
        expect(dupDni.ok).toBe(false);
        if (!dupDni.ok) {
          expect(dupDni.failures.some((f) => f.code === ERROR_CODES.DUP)).toBe(
            true,
          );
        }

        // 3. R5 Homonym insert allowed with distinct PerDNI
        const addHomonym = await personalRepo.guardarOp({
          kind: "adición",
          table: TABLE_PERSONAL,
          payload: {
            PerNom: "Homónimo Live",
            PerDNI: testDni2,
            PerFecNac: "1996-08-20",
            PerPaiCod: 1,
            PerDepCod: 1,
            PerCarCod: 1,
          },
        });
        expect(addHomonym.ok).toBe(true);
        if (addHomonym.ok && addHomonym.row) {
          testPerCod2 = addHomonym.row.PerCod;
        }

        // 4. R12 Inactivate temp pais -> Modificación keeping it hits E-REF-STATE; changing to #1 preserves created_at (R16/R17)
        const inactPais = await paisRepo.guardarOp({
          kind: "inactivar",
          table: TABLE_PAIS,
          targetCode: testPaiCod,
        });
        expect(inactPais.ok).toBe(true);

        const modBlocked = await personalRepo.guardarOp({
          kind: "modificación",
          table: TABLE_PERSONAL,
          targetCode: testPerCod1,
          payload: {
            PerCod: testPerCod1,
            PerNom: "Homónimo Actualizado",
            PerDNI: testDni1,
            PerFecNac: "1994-06-15",
            PerPaiCod: testPaiCod,
            PerDepCod: 1,
            PerCarCod: 1,
          },
        });
        expect(modBlocked.ok).toBe(false);
        if (!modBlocked.ok) {
          expect(
            modBlocked.failures.some((f) => f.code === ERROR_CODES.REF_STATE),
          ).toBe(true);
        }

        const modOk = await personalRepo.guardarOp({
          kind: "modificación",
          table: TABLE_PERSONAL,
          targetCode: testPerCod1,
          payload: {
            PerCod: testPerCod1,
            PerNom: "Homónimo Actualizado",
            PerDNI: testDni1,
            PerFecNac: "1994-06-15",
            PerPaiCod: 1,
            PerDepCod: 1,
            PerCarCod: 1,
          },
        });
        expect(modOk.ok).toBe(true);
        if (modOk.ok && modOk.row) {
          expect(modOk.row.created_at).toBe(origCreatedAt);
        }

        // 5. Simple & Advanced Search §11.2–§11.3
        const byCod = await personalRepo.search(String(testPerCod2));
        expect(byCod.data.some((r) => r.PerCod === testPerCod2)).toBe(true);

        const byDni = await personalRepo.search(testDni2);
        expect(byDni.data.some((r) => r.PerCod === testPerCod2)).toBe(true);

        const byNom = await personalRepo.search("homónimo actual");
        expect(byNom.data.some((r) => r.PerCod === testPerCod1)).toBe(true);

        const adv = await personalRepo.advancedSearch({
          DNI: testDni1.slice(0, 5),
          FecNacFrom: "1993-01-01",
          FecNacTo: "1997-12-31",
          PaiCod: 1,
          EstReg: [EST_A],
        });
        expect(adv.data.length).toBeGreaterThanOrEqual(2);

        // 6. Lifecycle A -> I -> A -> * & E-TRANSITION on *
        const inactPer = await personalRepo.guardarOp({
          kind: "inactivar",
          table: TABLE_PERSONAL,
          targetCode: testPerCod1,
        });
        expect(inactPer.ok).toBe(true);

        const reactPer = await personalRepo.guardarOp({
          kind: "reactivar",
          table: TABLE_PERSONAL,
          targetCode: testPerCod1,
        });
        expect(reactPer.ok).toBe(true);

        const elimPer = await personalRepo.guardarOp({
          kind: "eliminación",
          table: TABLE_PERSONAL,
          targetCode: testPerCod1,
        });
        expect(elimPer.ok).toBe(true);

        const afterElim = await personalRepo.guardarOp({
          kind: "reactivar",
          table: TABLE_PERSONAL,
          targetCode: testPerCod1,
        });
        expect(afterElim.ok).toBe(false);
      } finally {
        const perCods = [testPerCod1, testPerCod2].filter((c) => c > 0);
        if (perCods.length > 0) {
          await client.from("personal").delete().in("PerCod", perCods);
        }
        if (testPaiCod > 0) {
          await client.from("pais").delete().eq("PaiCod", testPaiCod);
        }
      }
    });
  },
);
