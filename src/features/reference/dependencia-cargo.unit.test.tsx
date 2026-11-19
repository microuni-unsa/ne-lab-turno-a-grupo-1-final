import { IonApp } from "@ionic/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
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
  type GuardarResult,
  type PendingOp,
} from "@/core";
import { ReferenceMaintenancePage } from "@/features/reference/ReferenceMaintenancePage";
import {
  cargoConfig,
  dependenciaConfig,
  type ReferenceMaintenanceConfig,
  type ReferenceRepoContract,
} from "@/features/reference/reference-config";
import { IonicFeedbackProvider } from "@/lib/feedback";

interface MemoryRefConfig<TRow> {
  readonly initial: readonly TRow[];
  readonly getCod: (r: TRow) => string;
  readonly getNom: (r: TRow) => string;
  readonly getEst: (r: TRow) => typeof EST_A | typeof EST_I | typeof EST_X;
  readonly codeField: string;
  readonly nomField: string;
  readonly createRow: (cod: string, nom: string) => TRow;
  readonly updateNom: (row: TRow, nom: string) => TRow;
  readonly updateEst: (
    row: TRow,
    est: typeof EST_A | typeof EST_I | typeof EST_X,
  ) => TRow;
  readonly blockedCode: string;
}

function createMemoryRefRepo<TRow>(cfg: MemoryRefConfig<TRow>): {
  repo: ReferenceRepoContract<TRow>;
  rows: TRow[];
  guardarSpy: Mock<(op: PendingOp) => Promise<GuardarResult<TRow>>>;
} {
  const rows: TRow[] = [...cfg.initial];

  const guardarSpy = vi.fn(
    async (op: PendingOp): Promise<GuardarResult<TRow>> => {
      if (op.kind === "adición") {
        const cod = String(Reflect.get(op.payload, cfg.codeField) ?? "").trim();
        const nom = String(Reflect.get(op.payload, cfg.nomField) ?? "").trim();
        if (rows.some((r) => cfg.getCod(r) === cod)) {
          return {
            ok: false,
            failures: [createFailure(ERROR_CODES.DUP, cfg.codeField)],
          };
        }
        if (
          rows.some((r) => cfg.getNom(r).toLowerCase() === nom.toLowerCase())
        ) {
          return {
            ok: false,
            failures: [createFailure(ERROR_CODES.DUP, cfg.nomField)],
          };
        }
        const created = cfg.createRow(cod, nom);
        rows.push(created);
        return { ok: true, row: created };
      }

      const idx = rows.findIndex((r) => cfg.getCod(r) === op.targetCode);
      const curr = idx >= 0 ? rows[idx] : undefined;
      if (!curr) {
        return {
          ok: false,
          failures: [createFailure(ERROR_CODES.TRANSITION, cfg.codeField)],
        };
      }

      if (op.kind === "modificación") {
        const nom = String(Reflect.get(op.payload, cfg.nomField) ?? "").trim();
        const updated = cfg.updateNom(curr, nom);
        rows[idx] = updated;
        return { ok: true, row: updated };
      }
      if (op.kind === "inactivar") {
        const updated = cfg.updateEst(curr, EST_I);
        rows[idx] = updated;
        return { ok: true, row: updated };
      }
      if (op.kind === "reactivar") {
        const updated = cfg.updateEst(curr, EST_A);
        rows[idx] = updated;
        return { ok: true, row: updated };
      }
      if (cfg.getCod(curr) === cfg.blockedCode) {
        return {
          ok: false,
          failures: [createFailure(ERROR_CODES.REF_BLOCKED, cfg.codeField)],
        };
      }
      const updated = cfg.updateEst(curr, EST_X);
      rows[idx] = updated;
      return { ok: true, row: updated };
    },
  );

  const repo: ReferenceRepoContract<TRow> = {
    async list(ordering = "default") {
      const isCodeSort =
        ordering === "alternate" ||
        (typeof ordering === "object" && ordering.column.endsWith("Cod"));
      const sorted = [...rows].sort((a, b) =>
        isCodeSort
          ? cfg.getCod(a).localeCompare(cfg.getCod(b))
          : cfg
              .getNom(a)
              .localeCompare(cfg.getNom(b), "es", { sensitivity: "case" }) ||
            cfg.getCod(a).localeCompare(cfg.getCod(b)),
      );
      return { data: sorted, count: sorted.length };
    },
    async search(q) {
      const term = q.trim().toLowerCase();
      const filtered = term
        ? rows.filter((r) => cfg.getNom(r).toLowerCase().includes(term))
        : rows;
      return { data: filtered, count: filtered.length };
    },
    async advancedSearch(filters) {
      const filtered = rows.filter((r) => {
        if (typeof filters.Cod === "number" && cfg.getCod(r) !== filters.Cod) {
          return false;
        }
        if (
          Array.isArray(filters.EstReg) &&
          !filters.EstReg.includes(cfg.getEst(r))
        ) {
          return false;
        }
        return true;
      });
      return { data: filtered, count: filtered.length };
    },
    guardarOp: guardarSpy,
  };

  return { repo, rows, guardarSpy };
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

function renderCatalog<TRow>(
  config: ReferenceMaintenanceConfig<TRow>,
  repo: ReferenceRepoContract<TRow>,
  routePath: string,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <IonApp>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[routePath]}>
          <IonicFeedbackProvider>
            <ReferenceMaintenancePage config={config} repo={repo} />
          </IonicFeedbackProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </IonApp>,
  );
}

describe("ReferenceMaintenancePage para DEPENDENCIA y CARGO (Fase 7 unit)", () => {
  afterEach(() => {
    cleanup();
  });

  it("DEPENDENCIA: soporta Adición, Modificación con DepCod readonly, R11 E-REF-BLOCKED y E-DUP", async () => {
    const { repo, guardarSpy } = createMemoryRefRepo<DependenciaRow>({
      initial: [
        {
          DepCod: asDepCod("1"),
          DepNom: "Sistemas",
          DepEstReg: EST_A,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          DepCod: asDepCod("3"),
          DepNom: "Almacen",
          DepEstReg: EST_I,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      getCod: (r) => r.DepCod,
      getNom: (r) => r.DepNom,
      getEst: (r) => r.DepEstReg,
      codeField: "DepCod",
      nomField: "DepNom",
      createRow: (cod, nom) => ({
        DepCod: asDepCod(cod),
        DepNom: nom,
        DepEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
      updateNom: (r, nom) => ({ ...r, DepNom: nom }),
      updateEst: (r, est) => ({ ...r, DepEstReg: est }),
      blockedCode: "1",
    });

    renderCatalog(dependenciaConfig, repo, "/dependencia");
    expect(await screen.findByText("Sistemas")).toBeTruthy();

    // Adición con duplicado por nombre -> [E-DUP] conserva draft
    fireEvent.click(screen.getByTestId("op-adicionar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO ADICIÓN",
    );
    await waitFor(() => {
      expect(document.querySelector('input[name="DepCod"]')).not.toBeNull();
    });
    setIonFieldValue("DepCod", "12");
    setIonFieldValue("DepNom", "sistemas");
    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      const alert = document.querySelector('[data-testid="feedback-alert"]');
      expect(alert).not.toBeNull();
      const text = `${String(Reflect.get(alert ?? {}, "subHeader"))} ${String(Reflect.get(alert ?? {}, "message"))}`;
      expect(text).toContain("[E-DUP]");
      expect(text).toContain("Nombre de Dependencia");
    });

    setIonFieldValue("DepNom", "Tesorería");
    await waitFor(() => {
      const nomEl = document.querySelector('input[name="DepNom"]');
      expect(Reflect.get(nomEl ?? {}, "value")).toBe("Tesorería");
    });
    fireEvent.click(screen.getByTestId("op-guardar"));
    expect((await screen.findAllByText("Tesorería")).length).toBeGreaterThan(0);

    // Regla del docente: Modificación deshabilitada en Inactivo hasta Reactivar
    fireEvent.click(screen.getByTestId("record-row-3"));
    expect(
      (screen.getByTestId("op-modificar") as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByTestId("op-reactivar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-3").querySelector('[data-estado="A"]'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId("record-row-3"));
    fireEvent.click(screen.getByTestId("op-modificar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO MODIFICACIÓN",
    );
    await waitFor(() => {
      expect(document.querySelector('input[name="DepCod"]')).not.toBeNull();
    });
    expect(
      document.querySelector('input[name="DepCod"]')?.hasAttribute("readonly"),
    ).toBe(true);
    setIonFieldValue("DepNom", "Almacén Central");
    await waitFor(() => {
      const nomEl = document.querySelector('input[name="DepNom"]');
      expect(Reflect.get(nomEl ?? {}, "value")).toBe("Almacén Central");
    });
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(screen.getByTestId("record-row-3").textContent).toContain(
        "Almacén Central",
      );
    });

    // R12: Inactivar #1 referenciado SÍ funciona; R11: Eliminar #1 dispara [E-REF-BLOCKED] con DepCod
    fireEvent.click(screen.getByTestId("record-row-1"));
    fireEvent.click(screen.getByTestId("op-inactivar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-1").querySelector('[data-estado="I"]'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId("op-reactivar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-1").querySelector('[data-estado="A"]'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId("op-eliminar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      const alert = document.querySelector('[data-testid="feedback-alert"]');
      expect(alert).not.toBeNull();
      const text = `${String(Reflect.get(alert ?? {}, "subHeader"))} ${String(Reflect.get(alert ?? {}, "message"))}`;
      expect(text).toContain("[E-REF-BLOCKED]");
      expect(text).toContain("Código de Dependencia");
    });
    expect(guardarSpy).toHaveBeenCalled();
  });

  it("CARGO: soporta Adición, E-DUP con CarNom, Modificación con CarCod readonly, R12/R11 E-REF-BLOCKED y ciclos A/I/*", async () => {
    const { repo } = createMemoryRefRepo<CargoRow>({
      initial: [
        {
          CarCod: asCarCod("1"),
          CarNom: "Analista de Sistemas",
          CarEstReg: EST_A,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      getCod: (r) => r.CarCod,
      getNom: (r) => r.CarNom,
      getEst: (r) => r.CarEstReg,
      codeField: "CarCod",
      nomField: "CarNom",
      createRow: (cod, nom) => ({
        CarCod: asCarCod(cod),
        CarNom: nom,
        CarEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
      updateNom: (r, nom) => ({ ...r, CarNom: nom }),
      updateEst: (r, est) => ({ ...r, CarEstReg: est }),
      blockedCode: "1",
    });

    renderCatalog(cargoConfig, repo, "/cargo");
    expect(await screen.findByText("Analista de Sistemas")).toBeTruthy();

    fireEvent.click(screen.getByTestId("op-adicionar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO ADICIÓN",
    );
    await waitFor(() => {
      expect(document.querySelector('input[name="CarCod"]')).not.toBeNull();
    });
    setIonFieldValue("CarCod", "20");
    setIonFieldValue("CarNom", "analista de sistemas");
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      const alert = document.querySelector('[data-testid="feedback-alert"]');
      expect(alert).not.toBeNull();
      const text = `${String(Reflect.get(alert ?? {}, "subHeader"))} ${String(Reflect.get(alert ?? {}, "message"))}`;
      expect(text).toContain("[E-DUP]");
      expect(text).toContain("Nombre de Cargo");
    });

    setIonFieldValue("CarNom", "Arquitecto Cloud");
    await waitFor(() => {
      const nomEl = document.querySelector('input[name="CarNom"]');
      expect(Reflect.get(nomEl ?? {}, "value")).toBe("Arquitecto Cloud");
    });
    fireEvent.click(screen.getByTestId("op-guardar"));
    expect(
      (await screen.findAllByText("Arquitecto Cloud")).length,
    ).toBeGreaterThan(0);

    // CarCod readonly en Modificación
    fireEvent.click(screen.getByTestId("record-row-20"));
    fireEvent.click(screen.getByTestId("op-modificar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO MODIFICACIÓN",
    );
    await waitFor(() => {
      expect(document.querySelector('input[name="CarCod"]')).not.toBeNull();
    });
    expect(
      document.querySelector('input[name="CarCod"]')?.hasAttribute("readonly"),
    ).toBe(true);
    setIonFieldValue("CarNom", "Arquitecto Enterprise");
    await waitFor(() => {
      const nomEl = document.querySelector('input[name="CarNom"]');
      expect(Reflect.get(nomEl ?? {}, "value")).toBe("Arquitecto Enterprise");
    });
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(screen.getByTestId("record-row-20").textContent).toContain(
        "Arquitecto Enterprise",
      );
    });

    fireEvent.click(screen.getByTestId("record-row-20"));
    fireEvent.click(screen.getByTestId("op-inactivar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-20").querySelector('[data-estado="I"]'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId("op-eliminar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-20").querySelector('[data-estado="*"]'),
      ).not.toBeNull();
    });

    // R12: Inactivar #1 referenciado SÍ funciona; R11: Eliminar #1 dispara [E-REF-BLOCKED] con CarCod
    fireEvent.click(screen.getByTestId("record-row-1"));
    fireEvent.click(screen.getByTestId("op-inactivar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-1").querySelector('[data-estado="I"]'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId("op-reactivar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-1").querySelector('[data-estado="A"]'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId("op-eliminar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      const alert = document.querySelector('[data-testid="feedback-alert"]');
      expect(alert).not.toBeNull();
      const text = `${String(Reflect.get(alert ?? {}, "subHeader"))} ${String(Reflect.get(alert ?? {}, "message"))}`;
      expect(text).toContain("[E-REF-BLOCKED]");
      expect(text).toContain("Código de Cargo");
    });
  });
});
