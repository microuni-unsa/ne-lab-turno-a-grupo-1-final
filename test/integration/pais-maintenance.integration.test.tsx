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
  asPaiCod,
  createFailure,
  ERROR_CODES,
  EST_A,
  EST_I,
  type PaisRow,
  type PendingOp,
} from "@/core";
import { PaisRepo } from "@/data";
import { ReferenceMaintenancePage } from "@/features/reference/ReferenceMaintenancePage";
import {
  paisConfig,
  type ReferenceRepoContract,
} from "@/features/reference/reference-config";
import { IonicFeedbackProvider } from "@/lib/feedback";

const isLiveDb = process.env.LIVE_DB === "1";

if (!isLiveDb) {
  console.warn(
    "[test/integration] Skipping live Supabase PAIS maintenance tests: LIVE_DB=1 is not set.",
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

describe("PAIS maintenance page integration (QueryClient + Repo + Feedback)", () => {
  afterEach(() => {
    cleanup();
  });

  it("actualiza caché de React Query tras Adición, Modificación e Inactivar", async () => {
    const dbRows: PaisRow[] = [
      {
        PaiCod: asPaiCod(1),
        PaiNom: "Perú",
        PaiEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const repo: ReferenceRepoContract<PaisRow> = {
      async list() {
        return {
          data: [...dbRows].sort((a, b) => a.PaiNom.localeCompare(b.PaiNom)),
          count: dbRows.length,
        };
      },
      async search(q) {
        const term = q.trim().toLowerCase();
        const found = dbRows.filter((r) =>
          r.PaiNom.toLowerCase().includes(term),
        );
        return { data: found, count: found.length };
      },
      async advancedSearch() {
        return { data: dbRows, count: dbRows.length };
      },
      async guardarOp(op: PendingOp) {
        if (op.kind === "adición") {
          const cod = Number(Reflect.get(op.payload, "PaiCod"));
          const nom = String(Reflect.get(op.payload, "PaiNom") ?? "").trim();
          if (
            dbRows.some((r) => r.PaiNom.toLowerCase() === nom.toLowerCase())
          ) {
            return {
              ok: false,
              failures: [createFailure(ERROR_CODES.DUP, "PaiNom")],
            };
          }
          const row: PaisRow = {
            PaiCod: asPaiCod(cod),
            PaiNom: nom,
            PaiEstReg: EST_A,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          };
          dbRows.push(row);
          return { ok: true, row };
        }
        const idx = dbRows.findIndex((r) => r.PaiCod === op.targetCode);
        const curr = dbRows[idx];
        if (!curr) {
          return {
            ok: false,
            failures: [createFailure(ERROR_CODES.TRANSITION, "PaiCod")],
          };
        }
        if (op.kind === "modificación") {
          const nom = String(Reflect.get(op.payload, "PaiNom") ?? "").trim();
          const next: PaisRow = { ...curr, PaiNom: nom };
          dbRows[idx] = next;
          return { ok: true, row: next };
        }
        if (op.kind === "inactivar") {
          const next = { ...curr, PaiEstReg: EST_I };
          dbRows[idx] = next;
          return { ok: true, row: next };
        }
        return {
          ok: false,
          failures: [createFailure(ERROR_CODES.TRANSITION, "PaiCod")],
        };
      },
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <IonApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/pais"]}>
            <IonicFeedbackProvider>
              <ReferenceMaintenancePage config={paisConfig} repo={repo} />
            </IonicFeedbackProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </IonApp>,
    );

    expect(await screen.findByText("Perú")).toBeTruthy();

    // 1. Adición válida inserta nuevo registro y refresca lista automáticamente
    fireEvent.click(screen.getByTestId("op-adicionar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO ADICIÓN",
    );
    await waitFor(() => {
      expect(document.querySelector('input[name="PaiCod"]')).not.toBeNull();
    });
    setIonFieldValue("PaiCod", "44");
    setIonFieldValue("PaiNom", "Paraguay");
    await waitFor(() => {
      const nomEl = document.querySelector('input[name="PaiNom"]');
      expect(Reflect.get(nomEl ?? {}, "value")).toBe("Paraguay");
    });
    fireEvent.click(screen.getByTestId("op-guardar"));

    expect((await screen.findAllByText("Paraguay")).length).toBeGreaterThan(0);

    // 2. Modificación actualiza nombre preservando PaiCod y EstReg en la lista
    fireEvent.click(screen.getByTestId("record-row-44"));
    fireEvent.click(screen.getByTestId("op-modificar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO MODIFICACIÓN",
    );
    await waitFor(() => {
      expect(document.querySelector('input[name="PaiNom"]')).not.toBeNull();
    });
    setIonFieldValue("PaiNom", "Paraguay Norte");
    await waitFor(() => {
      const nomEl = document.querySelector('input[name="PaiNom"]');
      expect(Reflect.get(nomEl ?? {}, "value")).toBe("Paraguay Norte");
    });
    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      expect(screen.getByTestId("record-row-44").textContent).toContain(
        "Paraguay Norte",
      );
    });

    // 3. Inactivar #44 y verificar badge compacto I en la fila re-renderizada
    fireEvent.click(screen.getByTestId("record-row-44"));
    fireEvent.click(screen.getByTestId("op-inactivar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO INACTIVAR",
    );
    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-44").querySelector('[data-estado="I"]'),
      ).not.toBeNull();
    });
  });
});

describeLive("PAIS Live Supabase Integration (LIVE_DB=1)", () => {
  it("ejecuta ciclo completo Adición/Modificación/Inactivar/Reactivar/Eliminar, R11 y R12 sobre PaisRepo", async () => {
    const client = readSecretSupabaseClient();
    const repo = new PaisRepo(client);
    const tempCode = 31991;
    const tempNom = `TestPais_${Date.now()}`;

    await client.from("pais").delete().eq("PaiCod", tempCode);

    try {
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
        p_cod: 31992,
        p_nom: `  ${tempNom.toLowerCase()}  `,
      });
      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.failures.some((f) => f.code === ERROR_CODES.DUP)).toBe(
          true,
        );
      }

      const modified = await repo.guardar({
        op: "update",
        p_cod: tempCode,
        p_nom: `${tempNom}_Edit`,
      });
      expect(modified.ok).toBe(true);
      if (modified.ok && modified.row) {
        expect(modified.row.created_at).toBe(createdAtInitial);
        expect(modified.row.PaiEstReg).toBe(EST_A);
      }

      const inactivated = await repo.guardar({
        op: "set_state",
        p_cod: tempCode,
        p_est: EST_I,
      });
      expect(inactivated.ok).toBe(true);

      const reactivated = await repo.guardar({
        op: "set_state",
        p_cod: tempCode,
        p_est: EST_A,
      });
      expect(reactivated.ok).toBe(true);

      const r11Blocked = await repo.guardar({
        op: "set_state",
        p_cod: 1,
        p_est: 3,
      });
      expect(r11Blocked.ok).toBe(false);
      if (!r11Blocked.ok) {
        expect(
          r11Blocked.failures.some((f) => f.code === ERROR_CODES.REF_BLOCKED),
        ).toBe(true);
      }

      const eliminated = await repo.guardar({
        op: "set_state",
        p_cod: tempCode,
        p_est: 3,
      });
      expect(eliminated.ok).toBe(true);

      const terminalBlocked = await repo.guardar({
        op: "set_state",
        p_cod: tempCode,
        p_est: EST_A,
      });
      expect(terminalBlocked.ok).toBe(false);
    } finally {
      await client.from("pais").delete().eq("PaiCod", tempCode);
    }
  });
});
