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
  MAX_SMALLINT,
  type PendingOp,
  TABLE_CARGO,
  TABLE_DEPENDENCIA,
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
  readonly getCod: (r: TRow) => number;
  readonly getNom: (r: TRow) => string;
  readonly getEst: (r: TRow) => typeof EST_A | typeof EST_I | typeof EST_X;
  readonly codeField: string;
  readonly nomField: string;
  readonly createRow: (cod: number, nom: string) => TRow;
  readonly updateNom: (row: TRow, nom: string) => TRow;
  readonly updateEst: (
    row: TRow,
    est: typeof EST_A | typeof EST_I | typeof EST_X,
  ) => TRow;
  readonly blockedCode: number;
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
        const cod = Number(Reflect.get(op.payload, cfg.codeField));
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
      const sorted = [...rows].sort((a, b) =>
        ordering === "alternate"
          ? cfg.getCod(a) - cfg.getCod(b)
          : cfg
              .getNom(a)
              .localeCompare(cfg.getNom(b), "es", { sensitivity: "case" }) ||
            cfg.getCod(a) - cfg.getCod(b),
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

  it("expone configuraciones normativas completas para DEPENDENCIA y CARGO", () => {
    expect(dependenciaConfig.table).toBe(TABLE_DEPENDENCIA);
    expect(dependenciaConfig.codeField).toBe("DepCod");
    expect(dependenciaConfig.nomField).toBe("DepNom");
    expect(dependenciaConfig.estField).toBe("DepEstReg");
    expect(dependenciaConfig.maxCode).toBe(MAX_SMALLINT);

    expect(cargoConfig.table).toBe(TABLE_CARGO);
    expect(cargoConfig.codeField).toBe("CarCod");
    expect(cargoConfig.nomField).toBe("CarNom");
    expect(cargoConfig.estField).toBe("CarEstReg");
    expect(cargoConfig.maxCode).toBe(MAX_SMALLINT);
  });

  it("DEPENDENCIA: soporta Adición, Modificación con DepCod readonly, R11 E-REF-BLOCKED y E-DUP", async () => {
    const { repo, guardarSpy } = createMemoryRefRepo<DependenciaRow>({
      initial: [
        {
          DepCod: asDepCod(1),
          DepNom: "Sistemas",
          DepEstReg: EST_A,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          DepCod: asDepCod(3),
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
      blockedCode: 1,
    });

    renderCatalog(dependenciaConfig, repo, "/dependencia");
    expect(await screen.findByText("Sistemas")).toBeTruthy();

    // Adición con duplicado por nombre -> [E-DUP] conserva draft
    fireEvent.click(screen.getByTestId("op-adicionar"));
    expect(await screen.findByTestId("reference-form-title")).toBeTruthy();
    setIonFieldValue("DepCod", "12");
    setIonFieldValue("DepNom", "sistemas");
    fireEvent.click(screen.getByTestId("form-guardar"));

    await waitFor(() => {
      const alert = document.querySelector('[data-testid="feedback-alert"]');
      expect(alert).not.toBeNull();
      const text = `${String(Reflect.get(alert ?? {}, "subHeader"))} ${String(Reflect.get(alert ?? {}, "message"))}`;
      expect(text).toContain("[E-DUP]");
      expect(text).toContain("Nombre de Dependencia");
    });

    setIonFieldValue("DepNom", "Tesorería");
    fireEvent.click(screen.getByTestId("form-guardar"));
    expect(await screen.findByText("Tesorería")).toBeTruthy();

    // Modificación en I preserva DepCod readonly y EstReg=I
    fireEvent.click(screen.getByTestId("record-row-3"));
    fireEvent.click(screen.getByTestId("op-modificar"));
    expect(await screen.findByTestId("reference-form-title")).toBeTruthy();
    expect(
      document.querySelector('input[name="DepCod"]')?.hasAttribute("readonly"),
    ).toBe(true);
    setIonFieldValue("DepNom", "Almacén Central");
    fireEvent.click(screen.getByTestId("form-guardar"));
    expect(await screen.findByText("Almacén Central")).toBeTruthy();

    // R12: Inactivar #1 referenciado SÍ funciona; R11: Eliminar #1 dispara [E-REF-BLOCKED] con DepCod
    fireEvent.click(screen.getByTestId("record-row-1"));
    fireEvent.click(screen.getByTestId("op-inactivar"));
    fireEvent.click(await screen.findByTestId("state-confirm-guardar"));
    await waitFor(() => {
      expect(screen.getByTestId("record-row-1").textContent).toContain(
        "I · Inactivo",
      );
    });

    fireEvent.click(screen.getByTestId("op-reactivar"));
    fireEvent.click(await screen.findByTestId("state-confirm-guardar"));
    await waitFor(() => {
      expect(screen.getByTestId("record-row-1").textContent).toContain(
        "A · Activo",
      );
    });

    fireEvent.click(screen.getByTestId("op-eliminar"));
    fireEvent.click(await screen.findByTestId("state-confirm-guardar"));
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
          CarCod: asCarCod(1),
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
      blockedCode: 1,
    });

    renderCatalog(cargoConfig, repo, "/cargo");
    expect(await screen.findByText("Analista de Sistemas")).toBeTruthy();

    fireEvent.click(screen.getByTestId("op-adicionar"));
    expect(await screen.findByTestId("reference-form-title")).toBeTruthy();
    setIonFieldValue("CarCod", "20");
    setIonFieldValue("CarNom", "analista de sistemas");
    fireEvent.click(screen.getByTestId("form-guardar"));
    await waitFor(() => {
      const alert = document.querySelector('[data-testid="feedback-alert"]');
      expect(alert).not.toBeNull();
      const text = `${String(Reflect.get(alert ?? {}, "subHeader"))} ${String(Reflect.get(alert ?? {}, "message"))}`;
      expect(text).toContain("[E-DUP]");
      expect(text).toContain("Nombre de Cargo");
    });

    setIonFieldValue("CarNom", "Arquitecto Cloud");
    fireEvent.click(screen.getByTestId("form-guardar"));
    expect(await screen.findByText("Arquitecto Cloud")).toBeTruthy();

    // CarCod readonly en Modificación
    fireEvent.click(screen.getByTestId("record-row-20"));
    fireEvent.click(screen.getByTestId("op-modificar"));
    expect(await screen.findByTestId("reference-form-title")).toBeTruthy();
    expect(
      document.querySelector('input[name="CarCod"]')?.hasAttribute("readonly"),
    ).toBe(true);
    setIonFieldValue("CarNom", "Arquitecto Enterprise");
    fireEvent.click(screen.getByTestId("form-guardar"));
    expect(await screen.findByText("Arquitecto Enterprise")).toBeTruthy();

    fireEvent.click(screen.getByTestId("record-row-20"));
    fireEvent.click(screen.getByTestId("op-inactivar"));
    fireEvent.click(await screen.findByTestId("state-confirm-guardar"));
    await waitFor(() => {
      expect(screen.getByTestId("record-row-20").textContent).toContain(
        "I · Inactivo",
      );
    });

    fireEvent.click(screen.getByTestId("op-eliminar"));
    fireEvent.click(await screen.findByTestId("state-confirm-guardar"));
    await waitFor(() => {
      expect(screen.getByTestId("record-row-20").textContent).toContain(
        "* · Eliminado",
      );
    });

    // R12: Inactivar #1 referenciado SÍ funciona; R11: Eliminar #1 dispara [E-REF-BLOCKED] con CarCod
    fireEvent.click(screen.getByTestId("record-row-1"));
    fireEvent.click(screen.getByTestId("op-inactivar"));
    fireEvent.click(await screen.findByTestId("state-confirm-guardar"));
    await waitFor(() => {
      expect(screen.getByTestId("record-row-1").textContent).toContain(
        "I · Inactivo",
      );
    });

    fireEvent.click(screen.getByTestId("op-reactivar"));
    fireEvent.click(await screen.findByTestId("state-confirm-guardar"));
    await waitFor(() => {
      expect(screen.getByTestId("record-row-1").textContent).toContain(
        "A · Activo",
      );
    });

    fireEvent.click(screen.getByTestId("op-eliminar"));
    fireEvent.click(await screen.findByTestId("state-confirm-guardar"));
    await waitFor(() => {
      const alert = document.querySelector('[data-testid="feedback-alert"]');
      expect(alert).not.toBeNull();
      const text = `${String(Reflect.get(alert ?? {}, "subHeader"))} ${String(Reflect.get(alert ?? {}, "message"))}`;
      expect(text).toContain("[E-REF-BLOCKED]");
      expect(text).toContain("Código de Cargo");
    });
  });
});
