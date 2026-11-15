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
  type CargoRow,
  createFailure,
  type DependenciaRow,
  ERROR_CODES,
  EST_A,
  EST_I,
  EST_X,
  type PendingOp,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
  TABLE_PAIS,
} from "@/core";
import { CargoRepo, DependenciaRepo, PersonalRepo } from "@/data";
import { maintenanceKeys } from "@/features/maintenance/query-keys";
import { ReferenceMaintenancePage } from "@/features/reference/ReferenceMaintenancePage";
import {
  cargoConfig,
  dependenciaConfig,
  type ReferenceRepoContract,
} from "@/features/reference/reference-config";
import { IonicFeedbackProvider } from "@/lib/feedback";

const isLiveDb = process.env.LIVE_DB === "1";

if (!isLiveDb) {
  console.warn(
    "[test/integration] Skipping live Supabase DEPENDENCIA/CARGO tests: LIVE_DB=1 is not set.",
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

function setIonFieldValue(name: string, value: string) {
  const inputEl = document.querySelector(`input[name="${name}"]`);
  expect(inputEl).not.toBeNull();
  const ionEl = inputEl?.closest("ion-input");
  if (ionEl) {
    ionEl.dispatchEvent(
      new CustomEvent("ionInput", {
        bubbles: true,
        detail: { value, event: new Event("input") },
      }),
    );
    return;
  }
  if (inputEl) {
    fireEvent.change(inputEl, { target: { value } });
  }
}

describe("DEPENDENCIA y CARGO integración e invalidación gsel/list (Fase 7)", () => {
  afterEach(() => {
    cleanup();
  });

  it("invalida tanto lists como gsel de DEPENDENCIA y CARGO al guardar sin tocar cachés de PAIS", async () => {
    const depRows: DependenciaRow[] = [
      {
        DepCod: asDepCod(1),
        DepNom: "Sistemas",
        DepEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const depRepo: ReferenceRepoContract<DependenciaRow> = {
      async list() {
        return { data: [...depRows], count: depRows.length };
      },
      async search(q) {
        const found = depRows.filter((r) =>
          r.DepNom.toLowerCase().includes(q.trim().toLowerCase()),
        );
        return { data: found, count: found.length };
      },
      async advancedSearch() {
        return { data: [...depRows], count: depRows.length };
      },
      async guardarOp(op: PendingOp) {
        if (op.kind === "adición") {
          const row: DependenciaRow = {
            DepCod: asDepCod(Number(Reflect.get(op.payload, "DepCod"))),
            DepNom: String(Reflect.get(op.payload, "DepNom") ?? "").trim(),
            DepEstReg: EST_A,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          };
          depRows.push(row);
          return { ok: true, row };
        }
        return {
          ok: false,
          failures: [createFailure(ERROR_CODES.TRANSITION, "DepCod")],
        };
      },
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    queryClient.setQueryData(maintenanceKeys.gsel(TABLE_DEPENDENCIA), [
      { DepCod: 1, DepNom: "Sistemas" },
    ]);
    queryClient.setQueryData(maintenanceKeys.gsel(TABLE_PAIS), [
      { PaiCod: 1, PaiNom: "Perú" },
    ]);

    render(
      <IonApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/dependencia"]}>
            <IonicFeedbackProvider>
              <ReferenceMaintenancePage
                config={dependenciaConfig}
                repo={depRepo}
              />
            </IonicFeedbackProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </IonApp>,
    );

    expect(await screen.findByText("Sistemas")).toBeTruthy();

    fireEvent.click(screen.getByTestId("op-adicionar"));
    expect(await screen.findByTestId("reference-form-title")).toBeTruthy();
    await waitFor(() => {
      expect(document.querySelector('input[name="DepCod"]')).not.toBeNull();
    });
    setIonFieldValue("DepCod", "18");
    setIonFieldValue("DepNom", "Compras");
    fireEvent.click(screen.getByTestId("form-guardar"));

    expect(await screen.findByText("Compras")).toBeTruthy();

    const depGselState = queryClient.getQueryState(
      maintenanceKeys.gsel(TABLE_DEPENDENCIA),
    );
    const paisGselState = queryClient.getQueryState(
      maintenanceKeys.gsel(TABLE_PAIS),
    );
    expect(depGselState?.isInvalidated).toBe(true);
    expect(paisGselState?.isInvalidated).toBe(false);

    cleanup();

    const carRows: CargoRow[] = [
      {
        CarCod: asCarCod(1),
        CarNom: "Analista de Sistemas",
        CarEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const carRepo: ReferenceRepoContract<CargoRow> = {
      async list() {
        return { data: [...carRows], count: carRows.length };
      },
      async search() {
        return { data: [...carRows], count: carRows.length };
      },
      async advancedSearch() {
        return { data: [...carRows], count: carRows.length };
      },
      async guardarOp(op: PendingOp) {
        if (op.kind === "inactivar") {
          const updated: CargoRow = {
            ...carRows[0],
            CarEstReg: EST_I,
          };
          carRows[0] = updated;
          return { ok: true, row: updated };
        }
        return {
          ok: false,
          failures: [createFailure(ERROR_CODES.TRANSITION, "CarCod")],
        };
      },
    };

    queryClient.setQueryData(maintenanceKeys.gsel(TABLE_CARGO), [
      { CarCod: 1, CarNom: "Analista de Sistemas" },
    ]);

    render(
      <IonApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/cargo"]}>
            <IonicFeedbackProvider>
              <ReferenceMaintenancePage config={cargoConfig} repo={carRepo} />
            </IonicFeedbackProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </IonApp>,
    );

    fireEvent.click(await screen.findByTestId("record-row-1"));
    fireEvent.click(screen.getByTestId("op-inactivar"));
    fireEvent.click(await screen.findByTestId("state-confirm-guardar"));

    await waitFor(() => {
      expect(screen.getByTestId("record-row-1").textContent).toContain(
        "I · Inactivo",
      );
    });
    expect(
      queryClient.getQueryState(maintenanceKeys.gsel(TABLE_CARGO))
        ?.isInvalidated,
    ).toBe(true);
  });
});

describeLive(
  "DEPENDENCIA & CARGO Live Supabase Integration (LIVE_DB=1)",
  () => {
    it("verifica semillas normativas, R12 vs R11, gsel() y R7 en DependenciaRepo", async () => {
      const client = readSecretSupabaseClient();
      const repo = new DependenciaRepo(client);
      const personalRepo = new PersonalRepo(client);
      const tempCode = 31881;
      const dupCode = 31882;
      const tempPersonalCode = 31891;
      const tempDni = "31891001";
      const tempNom = `TestDep_${Date.now()}`;

      await client.from("personal").delete().eq("PerCod", tempPersonalCode);
      await client.from("dependencia").delete().eq("DepCod", dupCode);
      await client.from("dependencia").delete().eq("DepCod", tempCode);

      try {
        // Semillas normativas en orden por defecto (DepNom ASC, DepCod ASC)
        const seeds = await repo.list("default");
        const seedNames = seeds.data.map((row) => row.DepNom);
        expect(seedNames).toEqual(
          expect.arrayContaining(["Almacen", "Contabilidad", "Sistemas"]),
        );
        expect(seedNames.indexOf("Almacen")).toBeLessThan(
          seedNames.indexOf("Contabilidad"),
        );
        expect(seedNames.indexOf("Contabilidad")).toBeLessThan(
          seedNames.indexOf("Sistemas"),
        );

        const inserted = await repo.guardar({
          op: "insert",
          p_cod: tempCode,
          p_nom: tempNom,
        });
        expect(inserted.ok).toBe(true);
        if (!inserted.ok || !inserted.row) {
          throw new Error("Expected insert row");
        }
        const createdAtInitial = inserted.row.created_at;

        const duplicate = await repo.guardar({
          op: "insert",
          p_cod: dupCode,
          p_nom: `  ${tempNom.toLowerCase()}  `,
        });
        expect(duplicate.ok).toBe(false);
        if (!duplicate.ok) {
          expect(
            duplicate.failures.some(
              (f) => f.code === ERROR_CODES.DUP && f.field === "DepNom",
            ),
          ).toBe(true);
        }

        const modified = await repo.guardar({
          op: "update",
          p_cod: tempCode,
          p_nom: `${tempNom}_Edit`,
        });
        expect(modified.ok).toBe(true);
        if (modified.ok && modified.row) {
          expect(modified.row.created_at).toBe(createdAtInitial);
        }

        const activeGsel = await repo.gsel();
        expect(
          activeGsel.some((r) => Reflect.get(r, "DepCod") === tempCode),
        ).toBe(true);

        // Vincular fila temporal de PERSONAL para probar R11 vs R12 real
        const linkedPersonal = await personalRepo.guardar({
          op: "insert",
          p_cod: tempPersonalCode,
          p_nom: `RefDep_${Date.now()}`,
          p_dni: tempDni,
          p_fecnac: "1992-05-10",
          p_pai: 1,
          p_dep: tempCode,
          p_car: 1,
        });
        expect(linkedPersonal.ok).toBe(true);

        // R11: Eliminar bloqueado con personal A asociando tempCode
        const r11ActiveBlocked = await repo.guardar({
          op: "set_state",
          p_cod: tempCode,
          p_est: EST_X,
        });
        expect(r11ActiveBlocked.ok).toBe(false);
        if (!r11ActiveBlocked.ok) {
          expect(
            r11ActiveBlocked.failures.some(
              (f) => f.code === ERROR_CODES.REF_BLOCKED && f.field === "DepCod",
            ),
          ).toBe(true);
        }

        // R12: Inactivar sí procede aunque exista personal activo; desaparece de gsel()
        // y PERSONAL conserva intacto su FK (R7)
        const inactivated = await repo.guardar({
          op: "set_state",
          p_cod: tempCode,
          p_est: EST_I,
        });
        expect(inactivated.ok).toBe(true);

        const gselAfterInactivate = await repo.gsel();
        expect(
          gselAfterInactivate.some(
            (r) => Reflect.get(r, "DepCod") === tempCode,
          ),
        ).toBe(false);

        const { data: persistedFkRow } = await client
          .from("personal")
          .select("PerCod, PerDepCod")
          .eq("PerCod", tempPersonalCode)
          .single();
        expect(Reflect.get(persistedFkRow ?? {}, "PerDepCod")).toBe(tempCode);

        const reactivated = await repo.guardar({
          op: "set_state",
          p_cod: tempCode,
          p_est: EST_A,
        });
        expect(reactivated.ok).toBe(true);
        const gselAfterReactivate = await repo.gsel();
        expect(
          gselAfterReactivate.some(
            (r) => Reflect.get(r, "DepCod") === tempCode,
          ),
        ).toBe(true);

        // R11 también bloquea cuando PERSONAL está Inactivo (I)
        const tempPersonalInactive = await personalRepo.guardar({
          op: "set_state",
          p_cod: tempPersonalCode,
          p_est: EST_I,
        });
        expect(tempPersonalInactive.ok).toBe(true);
        const r11InactiveBlocked = await repo.guardar({
          op: "set_state",
          p_cod: tempCode,
          p_est: EST_X,
        });
        expect(r11InactiveBlocked.ok).toBe(false);
        if (!r11InactiveBlocked.ok) {
          expect(
            r11InactiveBlocked.failures.some(
              (f) => f.code === ERROR_CODES.REF_BLOCKED && f.field === "DepCod",
            ),
          ).toBe(true);
        }

        // Tras pasar PERSONAL a '*' (EST_X), Eliminar la dependencia pasa sin bloqueo (R11)
        const tempPersonalEliminated = await personalRepo.guardar({
          op: "set_state",
          p_cod: tempPersonalCode,
          p_est: EST_X,
        });
        expect(tempPersonalEliminated.ok).toBe(true);

        const eliminated = await repo.guardar({
          op: "set_state",
          p_cod: tempCode,
          p_est: EST_X,
        });
        expect(eliminated.ok).toBe(true);
      } finally {
        await client.from("personal").delete().eq("PerCod", tempPersonalCode);
        await client.from("dependencia").delete().eq("DepCod", dupCode);
        await client.from("dependencia").delete().eq("DepCod", tempCode);
      }
    });

    it("verifica semillas normativas, R12 vs R11, gsel() y R7 en CargoRepo", async () => {
      const client = readSecretSupabaseClient();
      const repo = new CargoRepo(client);
      const personalRepo = new PersonalRepo(client);
      const tempCode = 31771;
      const dupCode = 31772;
      const tempPersonalCode = 31791;
      const tempDni = "31791001";
      const tempNom = `TestCargo_${Date.now()}`;

      await client.from("personal").delete().eq("PerCod", tempPersonalCode);
      await client.from("cargo").delete().eq("CarCod", dupCode);
      await client.from("cargo").delete().eq("CarCod", tempCode);

      try {
        // Semillas normativas (5 cargos en orden por defecto CarNom ASC, CarCod ASC)
        const seeds = await repo.list("default");
        const seedNames = seeds.data.map((row) => row.CarNom);
        expect(seedNames).toEqual(
          expect.arrayContaining([
            "Almacenero",
            "Analista de Sistemas",
            "Contador",
            "Gerente",
            "Programador",
          ]),
        );
        expect(seedNames.indexOf("Almacenero")).toBeLessThan(
          seedNames.indexOf("Analista de Sistemas"),
        );
        expect(seedNames.indexOf("Gerente")).toBeLessThan(
          seedNames.indexOf("Programador"),
        );

        const inserted = await repo.guardar({
          op: "insert",
          p_cod: tempCode,
          p_nom: tempNom,
        });
        expect(inserted.ok).toBe(true);
        if (!inserted.ok || !inserted.row) {
          throw new Error("Expected insert row");
        }
        const createdAtInitial = inserted.row.created_at;

        const duplicate = await repo.guardar({
          op: "insert",
          p_cod: dupCode,
          p_nom: `  ${tempNom.toLowerCase()}  `,
        });
        expect(duplicate.ok).toBe(false);
        if (!duplicate.ok) {
          expect(
            duplicate.failures.some(
              (f) => f.code === ERROR_CODES.DUP && f.field === "CarNom",
            ),
          ).toBe(true);
        }

        const modified = await repo.guardar({
          op: "update",
          p_cod: tempCode,
          p_nom: `${tempNom}_Edit`,
        });
        expect(modified.ok).toBe(true);
        if (modified.ok && modified.row) {
          expect(modified.row.created_at).toBe(createdAtInitial);
        }

        const activeGsel = await repo.gsel();
        expect(
          activeGsel.some((r) => Reflect.get(r, "CarCod") === tempCode),
        ).toBe(true);

        // Vincular fila temporal de PERSONAL para probar R11 vs R12 real
        const linkedPersonal = await personalRepo.guardar({
          op: "insert",
          p_cod: tempPersonalCode,
          p_nom: `RefCar_${Date.now()}`,
          p_dni: tempDni,
          p_fecnac: "1991-08-20",
          p_pai: 1,
          p_dep: 1,
          p_car: tempCode,
        });
        expect(linkedPersonal.ok).toBe(true);

        // R11: Eliminar bloqueado mientras exista personal A
        const r11ActiveBlocked = await repo.guardar({
          op: "set_state",
          p_cod: tempCode,
          p_est: EST_X,
        });
        expect(r11ActiveBlocked.ok).toBe(false);
        if (!r11ActiveBlocked.ok) {
          expect(
            r11ActiveBlocked.failures.some(
              (f) => f.code === ERROR_CODES.REF_BLOCKED && f.field === "CarCod",
            ),
          ).toBe(true);
        }

        // R12: Inactivar permitido con referencia viva -> desaparece de gsel() -> R7 FK intacta
        const inactivated = await repo.guardar({
          op: "set_state",
          p_cod: tempCode,
          p_est: EST_I,
        });
        expect(inactivated.ok).toBe(true);

        const gselAfterInactivate = await repo.gsel();
        expect(
          gselAfterInactivate.some(
            (r) => Reflect.get(r, "CarCod") === tempCode,
          ),
        ).toBe(false);

        const { data: persistedFkRow } = await client
          .from("personal")
          .select("PerCod, PerCarCod")
          .eq("PerCod", tempPersonalCode)
          .single();
        expect(Reflect.get(persistedFkRow ?? {}, "PerCarCod")).toBe(tempCode);

        const reactivated = await repo.guardar({
          op: "set_state",
          p_cod: tempCode,
          p_est: EST_A,
        });
        expect(reactivated.ok).toBe(true);
        const gselAfterReactivate = await repo.gsel();
        expect(
          gselAfterReactivate.some(
            (r) => Reflect.get(r, "CarCod") === tempCode,
          ),
        ).toBe(true);

        // R11 también bloquea con PERSONAL en estado I; tras '*' (EST_X) se desbloquea
        const tempPersonalInactive = await personalRepo.guardar({
          op: "set_state",
          p_cod: tempPersonalCode,
          p_est: EST_I,
        });
        expect(tempPersonalInactive.ok).toBe(true);
        const r11InactiveBlocked = await repo.guardar({
          op: "set_state",
          p_cod: tempCode,
          p_est: EST_X,
        });
        expect(r11InactiveBlocked.ok).toBe(false);

        const tempPersonalEliminated = await personalRepo.guardar({
          op: "set_state",
          p_cod: tempPersonalCode,
          p_est: EST_X,
        });
        expect(tempPersonalEliminated.ok).toBe(true);

        const eliminated = await repo.guardar({
          op: "set_state",
          p_cod: tempCode,
          p_est: EST_X,
        });
        expect(eliminated.ok).toBe(true);
      } finally {
        await client.from("personal").delete().eq("PerCod", tempPersonalCode);
        await client.from("cargo").delete().eq("CarCod", dupCode);
        await client.from("cargo").delete().eq("CarCod", tempCode);
      }
    });
  },
);
