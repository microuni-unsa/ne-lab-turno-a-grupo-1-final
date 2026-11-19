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
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import {
  asPaiCod,
  EST_A,
  EST_I,
  type GuardarResult,
  type PaisRow,
  type PendingOp,
} from "@/core";
import type { ReferenceRepoContract } from "@/features/reference/reference-config";
import { IonicFeedbackProvider } from "@/lib/feedback";
import { VariantAPaisPage } from "@/variants/a/VariantAPaisPage";
import { VariantBPaisPage } from "@/variants/b/VariantBPaisPage";
import { VariantCPaisPage } from "@/variants/c/VariantCPaisPage";
import { resolveAppVariant } from "@/variants/variant-config";

function createTestPaisRepo(initial: readonly PaisRow[]): {
  repo: ReferenceRepoContract<PaisRow>;
  rows: PaisRow[];
} {
  const rows: PaisRow[] = [...initial];
  const repo: ReferenceRepoContract<PaisRow> = {
    async list() {
      return { data: [...rows], count: rows.length };
    },
    async search(q) {
      const term = q.trim().toLowerCase();
      const filtered = rows.filter((row) =>
        row.PaiNom.toLowerCase().includes(term),
      );
      return { data: filtered, count: filtered.length };
    },
    async advancedSearch(filters) {
      const estSubset = Array.isArray(filters.EstReg)
        ? filters.EstReg
        : undefined;
      const filtered = rows.filter((row) => {
        if (
          estSubset &&
          estSubset.length > 0 &&
          !estSubset.includes(row.PaiEstReg)
        ) {
          return false;
        }
        return true;
      });
      return { data: filtered, count: filtered.length };
    },
    async guardarOp(op: PendingOp): Promise<GuardarResult<PaisRow>> {
      if (op.kind === "adición") {
        const cod = Number(Reflect.get(op.payload, "PaiCod"));
        const nom = String(Reflect.get(op.payload, "PaiNom") ?? "").trim();
        const created: PaisRow = {
          PaiCod: asPaiCod(cod),
          PaiNom: nom,
          PaiEstReg: EST_A,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        };
        rows.push(created);
        return { ok: true, row: created };
      }
      const targetIdx = rows.findIndex((r) => r.PaiCod === op.targetCode);
      const target = rows[targetIdx];
      if (!target) {
        return { ok: false, failures: [] };
      }
      const nextState =
        op.kind === "inactivar"
          ? EST_I
          : op.kind === "reactivar"
            ? EST_A
            : target.PaiEstReg;
      const updated: PaisRow = {
        ...target,
        PaiEstReg: nextState,
      };
      rows[targetIdx] = updated;
      return { ok: true, row: updated };
    },
  };
  return { repo, rows };
}

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <IonApp>
        <IonicFeedbackProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </IonicFeedbackProvider>
      </IonApp>
    </QueryClientProvider>,
  );
}

const SAMPLE_PAISES: readonly PaisRow[] = [
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
    PaiEstReg: EST_I,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("resolveAppVariant", () => {
  it("defaults to original when unset or empty and rejects unknown variants", () => {
    expect(resolveAppVariant(undefined)).toBe("original");
    expect(resolveAppVariant("")).toBe("original");
    expect(resolveAppVariant("original")).toBe("original");
    expect(resolveAppVariant("a")).toBe("A");
    expect(resolveAppVariant("B")).toBe("B");
    expect(resolveAppVariant("c")).toBe("C");
    expect(() => resolveAppVariant("Z")).toThrow(/Unknown VITE_APP_VARIANT/);
  });
});

describe("App variant routing & style preservation", () => {
  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.variant;
  });

  it("keeps original style (no data-variant) when variant is original", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <App variant="original" initialEntries={["/"]} client={client} />,
    );
    expect(document.documentElement.dataset.variant).toBeUndefined();
    expect(
      container.querySelector("ion-app")?.getAttribute("data-variant"),
    ).toBeNull();
  });

  it("sets data-variant attribute for A, B, and C", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container: cA, unmount: unmountA } = render(
      <App variant="A" initialEntries={["/"]} client={client} />,
    );
    expect(document.documentElement.dataset.variant).toBe("A");
    expect(cA.querySelector("ion-app")?.getAttribute("data-variant")).toBe("A");
    unmountA();

    const { container: cB, unmount: unmountB } = render(
      <App variant="B" initialEntries={["/"]} client={client} />,
    );
    expect(document.documentElement.dataset.variant).toBe("B");
    expect(cB.querySelector("ion-app")?.getAttribute("data-variant")).toBe("B");
    unmountB();

    const { container: cC, unmount: unmountC } = render(
      <App variant="C" initialEntries={["/"]} client={client} />,
    );
    expect(document.documentElement.dataset.variant).toBe("C");
    expect(cC.querySelector("ion-app")?.getAttribute("data-variant")).toBe("C");
    unmountC();
  });
});

describe("Variant PAIS screens", () => {
  afterEach(() => {
    cleanup();
  });

  it("VariantAPaisPage lists countries and supports Inactivar + Guardar", async () => {
    const { repo, rows } = createTestPaisRepo(SAMPLE_PAISES);
    renderWithProviders(<VariantAPaisPage repo={repo} />);

    await waitFor(() => {
      expect(screen.getByText("Perú")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("record-row-1"));
    fireEvent.click(screen.getByTestId("op-inactivar"));
    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      expect(rows[0]?.PaiEstReg).toBe(EST_I);
    });
  });

  it("VariantBPaisPage selects a country, opens Ficha, and supports Reactivar + Guardar", async () => {
    const { repo, rows } = createTestPaisRepo(SAMPLE_PAISES);
    renderWithProviders(<VariantBPaisPage repo={repo} />);

    await waitFor(() => {
      expect(screen.getByText("Chile")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("record-row-2"));
    fireEvent.click(screen.getByTestId("variant-b-open-ficha"));

    expect(screen.getByTestId("op-reactivar")).toBeTruthy();
    fireEvent.click(screen.getByTestId("op-reactivar"));
    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      expect(rows[1]?.PaiEstReg).toBe(EST_A);
    });
  });

  it("VariantCPaisPage selects a country, opens Inspector, and supports Inactivar + Guardar", async () => {
    const { repo, rows } = createTestPaisRepo(SAMPLE_PAISES);
    renderWithProviders(<VariantCPaisPage repo={repo} />);

    await waitFor(() => {
      expect(screen.getByText("Perú")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("record-row-1"));
    fireEvent.click(screen.getByTestId("variant-c-open-inspector"));

    expect(screen.getByText("CAMPOS DEL REGISTRO")).toBeTruthy();
    fireEvent.click(screen.getByTestId("op-inactivar"));
    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      expect(rows[0]?.PaiEstReg).toBe(EST_I);
    });
  });
});
