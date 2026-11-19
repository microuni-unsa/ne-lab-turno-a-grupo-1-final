import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  asPaiCod,
  EST_A,
  EST_I,
  EST_X,
  type PaisRow,
  TABLE_PAIS,
} from "@/core";
import type { AdvancedSearchFilters } from "@/data";
import { AdvancedSearchDrawer } from "@/features/maintenance/components/AdvancedSearchDrawer";
import { RecordListView } from "@/features/maintenance/components/RecordListView";
import { SearchControlsBar } from "@/features/maintenance/components/SearchControlsBar";
import {
  type RepoReader,
  useMaintenanceList,
} from "@/features/maintenance/use-maintenance-list";
import { createReferenceListColumns } from "@/features/reference/ReferenceMaintenancePage";
import { paisConfig } from "@/features/reference/reference-config";

const ROWS: readonly PaisRow[] = [
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
  {
    PaiCod: asPaiCod(3),
    PaiNom: "Argentina",
    PaiEstReg: EST_X,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

function createMockRepo(): RepoReader<PaisRow> {
  return {
    async list(ordering = "default") {
      const isCodeSort =
        ordering === "alternate" ||
        (typeof ordering === "object" && ordering.column === "PaiCod");
      const sorted = [...ROWS].sort((a, b) =>
        isCodeSort ? a.PaiCod - b.PaiCod : a.PaiNom.localeCompare(b.PaiNom),
      );
      return { data: sorted, count: sorted.length };
    },
    async search(q) {
      const filtered = ROWS.filter((r) =>
        r.PaiNom.toLowerCase().includes(q.toLowerCase()),
      );
      return { data: filtered, count: filtered.length };
    },
    async advancedSearch(filters: AdvancedSearchFilters) {
      const filtered = ROWS.filter((r) => {
        if (typeof filters.Nom === "string") {
          if (!r.PaiNom.toLowerCase().includes(filters.Nom.toLowerCase())) {
            return false;
          }
        }
        if (Array.isArray(filters.EstReg)) {
          if (!filters.EstReg.includes(r.PaiEstReg)) {
            return false;
          }
        }
        return true;
      });
      return { data: filtered, count: filtered.length };
    },
  };
}

function SearchHarness({
  repo,
  onSelect,
}: {
  readonly repo: RepoReader<PaisRow>;
  readonly onSelect: (row: PaisRow) => void;
}) {
  const [simpleInput, setSimpleInput] = React.useState("");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedCode, setSelectedCode] = React.useState<number | null>(null);

  const list = useMaintenanceList({ table: TABLE_PAIS, repo });

  return (
    <div>
      <SearchControlsBar
        simpleInput={simpleInput}
        onSimpleInputChange={setSimpleInput}
        onSubmitSimpleSearch={(term) => list.applySimpleSearch(term)}
        onClearSearch={() => list.clearSearch()}
        searchMode={list.searchMode}
        orderingLabel={list.orderingLabel}
        onToggleOrdering={() => list.toggleOrdering()}
        onOpenAdvanced={() => setDrawerOpen(true)}
      />

      <RecordListView
        rows={list.rows}
        totalCount={list.totalCount}
        isLoading={list.isLoading}
        isError={list.isError}
        orderingLabel={list.orderingLabel}
        selectedCode={selectedCode}
        columns={createReferenceListColumns(paisConfig)}
        getRowCode={(row) => row.PaiCod}
        getRowState={(row) => row.PaiEstReg}
        onSelectRow={(row) => {
          setSelectedCode(row.PaiCod);
          onSelect(row);
        }}
        offset={list.offset}
        limit={list.limit}
        pageIndex={list.pageIndex}
        totalPages={list.totalPages}
        hasPrevPage={list.hasPrevPage}
        hasNextPage={list.hasNextPage}
        onPrevPage={list.prevPage}
        onNextPage={list.nextPage}
      />

      <AdvancedSearchDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        filters={list.advancedFilters}
        onApply={(next) => list.applyAdvancedSearch(next)}
        onReset={() => list.clearSearch()}
        tableLabel="PAIS"
      />
    </div>
  );
}

describe("Fase 5: SearchControlsBar, RecordListView y AdvancedSearchDrawer", () => {
  it("cambia entre ordering default y alternate (R18), muestra estado vacío sin error (R20) y permite seleccionar fila filtrada (R21)", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const onSelect = vi.fn<(row: PaisRow) => void>();
    const repo = createMockRepo();

    render(
      <QueryClientProvider client={queryClient}>
        <SearchHarness repo={repo} onSelect={onSelect} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("record-row-3")).toBeTruthy();
    });

    // Ordering inicial es Nombre (ASC): Argentina (#3), Bolivia (#2), Perú (#1)
    expect(screen.getByTestId("active-ordering-label").textContent).toContain(
      "Nombre (ASC)",
    );
    const initialOrder = Array.from(
      screen.getByTestId("record-list-rows").querySelectorAll("button"),
    ).map((el) => el.getAttribute("data-testid"));
    expect(initialOrder).toEqual([
      "record-row-3",
      "record-row-2",
      "record-row-1",
    ]);

    // Toggle a Código (ASC)
    fireEvent.click(screen.getByTestId("btn-toggle-ordering"));
    await waitFor(() => {
      expect(screen.getByTestId("active-ordering-label").textContent).toContain(
        "Código (ASC)",
      );
      const nextOrder = Array.from(
        screen.getByTestId("record-list-rows").querySelectorAll("button"),
      ).map((el) => el.getAttribute("data-testid"));
      expect(nextOrder).toEqual([
        "record-row-1",
        "record-row-2",
        "record-row-3",
      ]);
    });

    // Búsqueda simple sin coincidencias => vista vacía válida sin estado error (R20)
    const searchInput = document.getElementById("simple-search-input");
    if (!searchInput) {
      throw new Error("Expected simple search input");
    }
    fireEvent(
      searchInput,
      new CustomEvent("ionInput", {
        bubbles: true,
        detail: { value: "inexistente", event: new Event("input") },
      }),
    );
    fireEvent.click(screen.getByTestId("btn-simple-search"));

    await waitFor(() => {
      expect(screen.getByTestId("empty-list-state")).toBeTruthy();
      expect(screen.queryByTestId("list-error-state")).toBeNull();
    });

    // Limpiar y filtrar a Bolivia para seleccionar fila filtrada (R21)
    fireEvent(
      searchInput,
      new CustomEvent("ionInput", {
        bubbles: true,
        detail: { value: "bol", event: new Event("input") },
      }),
    );
    fireEvent.click(screen.getByTestId("btn-simple-search"));

    const filteredRow = await screen.findByTestId("record-row-2");
    fireEvent.click(filteredRow);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]?.PaiNom).toBe("Bolivia");
    expect(filteredRow.getAttribute("aria-pressed")).toBe("true");
  });

  it("filtra por EstReg=[I] desde AdvancedSearchDrawer y permite limpiar filtros", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const onSelect = vi.fn<(row: PaisRow) => void>();
    const repo = createMockRepo();

    render(
      <QueryClientProvider client={queryClient}>
        <SearchHarness repo={repo} onSelect={onSelect} />
      </QueryClientProvider>,
    );

    await screen.findByTestId("record-row-1");

    fireEvent.click(screen.getByTestId("btn-open-advanced"));

    const checkA = screen.getByTestId("adv-est-1");
    const checkX = screen.getByTestId("adv-est-3");
    fireEvent.click(checkA);
    fireEvent.click(checkX);

    fireEvent.click(screen.getByTestId("adv-btn-apply"));

    await waitFor(() => {
      expect(screen.queryByTestId("record-row-1")).toBeNull();
      expect(screen.getByTestId("record-row-2")).toBeTruthy();
      expect(screen.queryByTestId("record-row-3")).toBeNull();
    });

    fireEvent.click(screen.getByTestId("btn-clear-search"));
    await waitFor(() => {
      expect(screen.getByTestId("record-row-1")).toBeTruthy();
      expect(screen.getByTestId("record-row-2")).toBeTruthy();
      expect(screen.getByTestId("record-row-3")).toBeTruthy();
    });
  });

  it("usa max-content por defecto y permite redimensionar columnas", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const onSelect = vi.fn<(row: PaisRow) => void>();
    const repo = createMockRepo();

    render(
      <QueryClientProvider client={queryClient}>
        <SearchHarness repo={repo} onSelect={onSelect} />
      </QueryClientProvider>,
    );

    await screen.findByTestId("record-row-1");
    const grid = screen.getByTestId("record-list-grid");
    expect(grid.style.gridTemplateColumns).toBe(
      "max-content minmax(max-content, 1fr) max-content",
    );

    const resizeHandle = screen.getByTestId("record-resize-PaiCod");
    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });
    expect(grid.style.gridTemplateColumns).toBe(
      "64px minmax(max-content, 1fr) max-content",
    );

    fireEvent.keyDown(resizeHandle, { key: "ArrowLeft" });
    expect(grid.style.gridTemplateColumns).toBe(
      "48px minmax(max-content, 1fr) max-content",
    );

    fireEvent.doubleClick(resizeHandle);
    expect(grid.style.gridTemplateColumns).toBe(
      "max-content minmax(max-content, 1fr) max-content",
    );
  });
});
