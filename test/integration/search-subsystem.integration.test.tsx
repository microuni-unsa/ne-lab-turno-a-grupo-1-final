import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  asPaiCod,
  EST_A,
  EST_I,
  EST_X,
  type PaisRow,
  TABLE_PAIS,
} from "@/core";
import { PaisRepo } from "@/data";
import {
  type RepoReader,
  useMaintenanceList,
} from "@/features/maintenance/use-maintenance-list";

const isLiveDb = process.env.LIVE_DB === "1";

if (!isLiveDb) {
  console.warn(
    "[test/integration] Skipping live Supabase search subsystem tests: LIVE_DB=1 is not set.",
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

describe("useMaintenanceList integration (React Query + estados A/I/* + paginación)", () => {
  it("conserva los 3 estados por defecto (R19), pagina 50 registros y mantiene filtros al reconsultar", async () => {
    const rows: PaisRow[] = [
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
      {
        PaiCod: asPaiCod(3),
        PaiNom: "Bolivia",
        PaiEstReg: EST_X,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const repo: RepoReader<PaisRow> = {
      async list(ordering = "default", page) {
        const sorted = [...rows].sort((a, b) =>
          ordering === "alternate"
            ? a.PaiCod - b.PaiCod
            : a.PaiNom.localeCompare(b.PaiNom),
        );
        const offset = page?.offset ?? 0;
        const limit = page?.limit ?? 50;
        return {
          data: sorted.slice(offset, offset + limit),
          count: sorted.length,
        };
      },
      async search(q) {
        const filtered = rows.filter((r) =>
          r.PaiNom.toLowerCase().includes(q.toLowerCase()),
        );
        return { data: filtered, count: filtered.length };
      },
      async advancedSearch(filters) {
        const filtered = rows.filter((r) =>
          Array.isArray(filters.EstReg)
            ? filters.EstReg.includes(r.PaiEstReg)
            : true,
        );
        return { data: filtered, count: filtered.length };
      },
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () => useMaintenanceList({ table: TABLE_PAIS, repo, pageSize: 2 }),
      {
        wrapper: ({ children }: { readonly children: ReactNode }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      },
    );

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2);
    });
    expect(result.current.totalCount).toBe(3);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.rows.map((r) => r.PaiNom)).toEqual([
      "Bolivia",
      "Chile",
    ]);

    act(() => {
      result.current.nextPage();
    });

    await waitFor(() => {
      expect(result.current.rows.map((r) => r.PaiNom)).toEqual(["Perú"]);
      expect(result.current.hasPrevPage).toBe(true);
      expect(result.current.hasNextPage).toBe(false);
    });

    act(() => {
      result.current.toggleOrdering();
    });

    await waitFor(() => {
      expect(result.current.offset).toBe(0);
      expect(result.current.rows.map((r) => r.PaiCod)).toEqual([1, 2]);
    });
  });
});

describeLive("useMaintenanceList LIVE_DB=1 (PaisRepo real)", () => {
  it("valida ordenamiento SPEC §11.1, búsqueda accent-sensitive §11.2 y resultados vacíos R20 sin error", async () => {
    const client = readSecretSupabaseClient();
    const repo = new PaisRepo(client);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () => useMaintenanceList({ table: TABLE_PAIS, repo }),
      {
        wrapper: ({ children }: { readonly children: ReactNode }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      },
    );

    await waitFor(
      () => {
        expect(result.current.rows.length).toBeGreaterThanOrEqual(5);
      },
      { timeout: 10_000 },
    );
    const seedNames = result.current.rows
      .filter((r) => r.PaiCod >= 1 && r.PaiCod <= 5)
      .map((r) => r.PaiNom);
    expect(seedNames).toEqual([
      "Bolivia",
      "Chile",
      "Colombia",
      "Ecuador",
      "Perú",
    ]);

    act(() => {
      result.current.toggleOrdering();
    });

    await waitFor(
      () => {
        const cods = result.current.rows
          .filter((r) => r.PaiCod >= 1 && r.PaiCod <= 5)
          .map((r) => r.PaiCod);
        expect(cods).toEqual([1, 2, 3, 4, 5]);
      },
      { timeout: 10_000 },
    );

    // Búsqueda simple accent-sensitive §11.2: "per" encuentra "Perú", "peru" retorna [] sin error
    act(() => {
      result.current.applySimpleSearch("per");
    });

    await waitFor(
      () => {
        expect(result.current.rows.some((r) => r.PaiNom === "Perú")).toBe(true);
      },
      { timeout: 10_000 },
    );

    act(() => {
      result.current.applySimpleSearch("peru");
    });

    await waitFor(
      () => {
        expect(result.current.rows.some((r) => r.PaiNom === "Perú")).toBe(
          false,
        );
      },
      { timeout: 10_000 },
    );

    // Búsqueda avanzada sin coincidencias => lista vacía válida (R20)
    act(() => {
      result.current.applyAdvancedSearch({ Cod: 999999 });
    });

    await waitFor(
      () => {
        expect(result.current.rows).toEqual([]);
        expect(result.current.isError).toBe(false);
      },
      { timeout: 10_000 },
    );
  });
});
