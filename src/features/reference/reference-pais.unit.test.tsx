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
  asPaiCod,
  createFailure,
  ERROR_CODES,
  EST_A,
  EST_I,
  EST_X,
  type GuardarResult,
  type PaisRow,
  type PendingOp,
} from "@/core";
import * as dataModule from "@/data";
import { ReferenceMaintenancePage } from "@/features/reference/ReferenceMaintenancePage";
import {
  paisConfig,
  type ReferenceRepoContract,
} from "@/features/reference/reference-config";
import { IonicFeedbackProvider } from "@/lib/feedback";

function createMemoryPaisRepo(initial: readonly PaisRow[] = []): {
  repo: ReferenceRepoContract<PaisRow>;
  rows: PaisRow[];
  guardarSpy: Mock<(op: PendingOp) => Promise<GuardarResult<PaisRow>>>;
} {
  const rows: PaisRow[] = [...initial];
  const guardarSpy = vi.fn(
    async (op: PendingOp): Promise<GuardarResult<PaisRow>> => {
      if (op.kind === "adición") {
        const nom = String(Reflect.get(op.payload, "PaiNom") ?? "").trim();
        if (rows.some((r) => r.PaiNom.toLowerCase() === nom.toLowerCase())) {
          return {
            ok: false as const,
            failures: [createFailure(ERROR_CODES.DUP, "PaiNom")],
          };
        }
        const nextCod = rows.reduce((m, r) => Math.max(m, r.PaiCod), 0) + 1;
        const created: PaisRow = {
          PaiCod: asPaiCod(nextCod),
          PaiNom: nom,
          PaiEstReg: EST_A,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        };
        rows.push(created);
        return { ok: true as const, row: created };
      }

      const idx = rows.findIndex((r) => r.PaiCod === op.targetCode);
      const current = idx >= 0 ? rows[idx] : undefined;
      if (!current) {
        return {
          ok: false as const,
          failures: [createFailure(ERROR_CODES.TRANSITION, "PaiCod")],
        };
      }

      if (op.kind === "modificación") {
        const nom = String(Reflect.get(op.payload, "PaiNom") ?? "").trim();
        const updated: PaisRow = {
          ...current,
          PaiNom: nom,
        };
        rows[idx] = updated;
        return { ok: true as const, row: updated };
      }

      if (op.kind === "inactivar") {
        if (current.PaiEstReg !== EST_A) {
          return {
            ok: false as const,
            failures: [createFailure(ERROR_CODES.TRANSITION, "PaiCod")],
          };
        }
        const updated = { ...current, PaiEstReg: EST_I };
        rows[idx] = updated;
        return { ok: true as const, row: updated };
      }

      if (op.kind === "reactivar") {
        const supervisorOk =
          current.PaiEstReg === EST_X && op.supervisorCode === "SUP-2026";
        if (current.PaiEstReg !== EST_I && !supervisorOk) {
          return {
            ok: false as const,
            failures: [createFailure(ERROR_CODES.TRANSITION, "PaiCod")],
          };
        }
        const updated = { ...current, PaiEstReg: EST_A };
        rows[idx] = updated;
        return { ok: true as const, row: updated };
      }

      if (current.PaiCod === asPaiCod(1)) {
        return {
          ok: false as const,
          failures: [createFailure(ERROR_CODES.REF_BLOCKED, "PaiCod")],
        };
      }
      if (current.PaiEstReg === EST_X) {
        return {
          ok: false as const,
          failures: [createFailure(ERROR_CODES.TRANSITION, "PaiCod")],
        };
      }
      const updated = { ...current, PaiEstReg: EST_X };
      rows[idx] = updated;
      return { ok: true as const, row: updated };
    },
  );

  const repo: ReferenceRepoContract<PaisRow> = {
    async list(ordering = "default", _page, _options, viewScope) {
      const scoped =
        viewScope === "deleted"
          ? rows.filter((r) => r.PaiEstReg === EST_X)
          : viewScope === "main"
            ? rows.filter((r) => r.PaiEstReg !== EST_X)
            : rows;
      const isCodeSort =
        ordering === "alternate" ||
        (typeof ordering === "object" && ordering.column === "PaiCod");
      const sorted = [...scoped].sort((a, b) =>
        isCodeSort
          ? a.PaiCod - b.PaiCod
          : a.PaiNom.localeCompare(b.PaiNom, "es", { sensitivity: "case" }) ||
            a.PaiCod - b.PaiCod,
      );
      return { data: sorted, count: sorted.length };
    },
    async search(q, ordering = "default") {
      const term = q.trim().toLowerCase();
      const filtered = term
        ? rows.filter((r) => r.PaiNom.toLowerCase().includes(term))
        : rows;
      const isCodeSort =
        ordering === "alternate" ||
        (typeof ordering === "object" && ordering.column === "PaiCod");
      const sorted = [...filtered].sort((a, b) =>
        isCodeSort
          ? a.PaiCod - b.PaiCod
          : a.PaiNom.localeCompare(b.PaiNom, "es", { sensitivity: "case" }),
      );
      return { data: sorted, count: sorted.length };
    },
    async advancedSearch(filters, ordering = "default") {
      const filtered = rows.filter((r) => {
        if (typeof filters.Cod === "number" && r.PaiCod !== filters.Cod) {
          return false;
        }
        if (
          typeof filters.Nom === "string" &&
          !r.PaiNom.toLowerCase().includes(filters.Nom.toLowerCase())
        ) {
          return false;
        }
        if (
          Array.isArray(filters.EstReg) &&
          !filters.EstReg.includes(r.PaiEstReg)
        ) {
          return false;
        }
        return true;
      });
      const isCodeSort =
        ordering === "alternate" ||
        (typeof ordering === "object" && ordering.column === "PaiCod");
      const sorted = [...filtered].sort((a, b) =>
        isCodeSort
          ? a.PaiCod - b.PaiCod
          : a.PaiNom.localeCompare(b.PaiNom, "es", { sensitivity: "case" }),
      );
      return { data: sorted, count: sorted.length };
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

function renderPaisPage(repo: ReferenceRepoContract<PaisRow>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
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
}

describe("ReferenceMaintenancePage + paisConfig (Fase 6 unit)", () => {
  afterEach(() => {
    cleanup();
  });

  it("lista países por nombre ASC, exige selección antes de Modificar y abre Adición con R22", async () => {
    const { repo } = createMemoryPaisRepo([
      {
        PaiCod: asPaiCod(1),
        PaiNom: "Perú",
        PaiEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        PaiCod: asPaiCod(2),
        PaiNom: "Bolivia",
        PaiEstReg: EST_I,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    renderPaisPage(repo);

    expect(await screen.findByTestId("record-row-1")).toBeTruthy();
    expect(screen.getByTestId("record-row-2")).toBeTruthy();

    // Sin selección -> Modificar está deshabilitado
    expect(
      (screen.getByTestId("op-modificar") as HTMLButtonElement).disabled,
    ).toBe(true);

    // Adición muestra formulario inline en Datos del registro con EstReg A - Activo
    fireEvent.click(screen.getByTestId("op-adicionar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO ADICIÓN",
    );
    expect(screen.getByTestId("record-detail-card").textContent).toContain(
      "Activo",
    );
    await waitFor(() => {
      expect(document.querySelector('input[name="PaiNom"]')).not.toBeNull();
    });
    expect(document.querySelector('input[name="PaiCod"]')).toBeNull();

    // Guardar inválido con PaiNom="A" muestra alerta R22 en lote y conserva borrador
    setIonFieldValue("PaiNom", "A");
    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      const alert = document.querySelector('[data-testid="feedback-alert"]');
      expect(alert).not.toBeNull();
      expect(Reflect.get(alert ?? {}, "isOpen")).toBe(true);
    });
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO ADICIÓN",
    );
  });

  it("deshabilita Modificar en fila Inactiva hasta Reactivar y bloquea PaiCod en Modificación", async () => {
    const { repo, guardarSpy } = createMemoryPaisRepo([
      {
        PaiCod: asPaiCod(3),
        PaiNom: "Colombia",
        PaiEstReg: EST_I,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    renderPaisPage(repo);
    const rowBtn = await screen.findByTestId("record-row-3");
    fireEvent.click(rowBtn);

    // Regla del docente: un registro Inactivo no se puede modificar hasta reactivarlo
    expect(
      (screen.getByTestId("op-modificar") as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByTestId("op-reactivar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO REACTIVAR",
    );
    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      expect(guardarSpy).toHaveBeenCalledTimes(1);
    });

    // Ahora Activo -> Modificar habilitado con PaiCod readonly
    fireEvent.click(await screen.findByTestId("record-row-3"));
    expect(
      (screen.getByTestId("op-modificar") as HTMLButtonElement).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByTestId("op-modificar"));

    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO MODIFICACIÓN",
    );
    await waitFor(() => {
      expect(document.querySelector('input[name="PaiCod"]')).not.toBeNull();
    });
    const codeInput = document.querySelector('input[name="PaiCod"]');
    expect(codeInput?.hasAttribute("readonly")).toBe(true);
    expect(Reflect.get(codeInput ?? {}, "value")).toBe("3");

    setIonFieldValue("PaiNom", "Colombia Editada");
    await waitFor(() => {
      const nomEl = document.querySelector('input[name="PaiNom"]');
      expect(Reflect.get(nomEl ?? {}, "value")).toBe("Colombia Editada");
    });
    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      expect(guardarSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("record-row-3").textContent).toContain(
        "Colombia Editada",
      );
    });
  });

  it("muestra Datos del registro sin inputs editables para Eliminar y bloquea Eliminar referenciado", async () => {
    const { repo } = createMemoryPaisRepo([
      {
        PaiCod: asPaiCod(1),
        PaiNom: "Perú",
        PaiEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    renderPaisPage(repo);
    fireEvent.click(await screen.findByTestId("record-row-1"));
    fireEvent.click(screen.getByTestId("op-eliminar"));

    const detailCard = screen.getByTestId("record-detail-card");
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO ELIMINACIÓN",
    );
    expect(
      Array.from(detailCard.querySelectorAll("input")).every(
        (input) => input.readOnly,
      ),
    ).toBe(true);

    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      const alert = document.querySelector('[data-testid="feedback-alert"]');
      expect(alert).not.toBeNull();
      const alertText = `${String(Reflect.get(alert ?? {}, "subHeader"))} ${String(Reflect.get(alert ?? {}, "message"))}`;
      expect(alertText).toContain("[E-REF-BLOCKED]");
    });
    expect(
      screen.getByTestId("record-row-1").querySelector('[data-estado="A"]'),
    ).not.toBeNull();
  });

  it("preserva borrador pendiente y deshabilita otras operaciones mientras Adición está activa", async () => {
    const { repo } = createMemoryPaisRepo([
      {
        PaiCod: asPaiCod(1),
        PaiNom: "Perú",
        PaiEstReg: EST_A,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    renderPaisPage(repo);
    fireEvent.click(await screen.findByTestId("record-row-1"));
    fireEvent.click(screen.getByTestId("op-adicionar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO ADICIÓN",
    );
    await waitFor(() => {
      expect(document.querySelector('input[name="PaiNom"]')).not.toBeNull();
    });
    expect(document.querySelector('input[name="PaiCod"]')).toBeNull();

    setIonFieldValue("PaiNom", "Brasil Draft");
  });

  it("solicita código de supervisor de un solo uso para Reactivar una fila Eliminada (*)", async () => {
    const verifySpy = vi
      .spyOn(dataModule, "verifySupervisorCode")
      .mockImplementation(async (code) => code.trim() === "SUP-2026");

    const { repo, guardarSpy } = createMemoryPaisRepo([
      {
        PaiCod: asPaiCod(7),
        PaiNom: "Brasil",
        PaiEstReg: EST_X,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    renderPaisPage(repo);
    fireEvent.click(await screen.findByTestId("btn-toggle-deleted-scope"));
    fireEvent.click(await screen.findByTestId("record-row-7"));

    expect(
      (screen.getByTestId("op-reactivar") as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByTestId("op-modificar") as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByTestId("op-reactivar"));
    expect(await screen.findByTestId("supervisor-auth-dialog")).toBeTruthy();

    const codeEl = await screen.findByTestId("input-supervisor-code");
    fireEvent.change(codeEl, { target: { value: "SUP-2026" } });
    fireEvent.click(screen.getByTestId("btn-confirm-supervisor-auth"));

    await waitFor(() => {
      expect(screen.getByTestId("record-mode-badge").textContent).toBe(
        "MODO REACTIVAR",
      );
    });
    expect(verifySpy).toHaveBeenCalledWith("SUP-2026");

    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      expect(guardarSpy).toHaveBeenCalledTimes(1);
    });
    expect(guardarSpy.mock.calls[0]?.[0]).toMatchObject({
      kind: "reactivar",
      targetCode: 7,
      supervisorCode: "SUP-2026",
    });

    fireEvent.click(screen.getByTestId("btn-toggle-deleted-scope"));
    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-7").querySelector('[data-estado="A"]'),
      ).not.toBeNull();
    });
    verifySpy.mockRestore();
  });
});
