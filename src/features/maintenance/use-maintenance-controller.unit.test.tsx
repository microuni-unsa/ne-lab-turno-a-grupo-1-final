import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  asPaiCod,
  createFailure,
  ERROR_CODES,
  EST_A,
  EST_I,
  EST_X,
  type FieldFailure,
  type GuardarResult,
  type PaisRow,
  type PendingOp,
  TABLE_PAIS,
} from "@/core";
import {
  applyFieldFailuresToForm,
  type RepoWriter,
  useMaintenanceController,
} from "@/features/maintenance/use-maintenance-controller";
import type { FeedbackPort } from "@/lib/feedback";

function makePais(
  code: number,
  nom: string,
  est: PaisRow["PaiEstReg"],
): PaisRow {
  return {
    PaiCod: asPaiCod(code),
    PaiNom: nom,
    PaiEstReg: est,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function createFeedbackMock() {
  const port: FeedbackPort = {
    notifySuccess: vi.fn(),
    notifyWarning: vi.fn(),
    notifyBatchErrors: vi.fn(),
    notifyNetworkError: vi.fn(),
    confirmAction: vi.fn(async () => true),
    alertPending: vi.fn(),
  };
  return port;
}

function createWrapper(client: QueryClient) {
  return ({ children }: { readonly children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useMaintenanceController", () => {
  it("impide doble inicio con E-PENDING y bloquea Salir cuando hay operación pendiente", () => {
    const queryClient = new QueryClient();
    const feedback = createFeedbackMock();
    const repo: RepoWriter<PaisRow> = {
      guardarOp: vi.fn(
        async (): Promise<GuardarResult<PaisRow>> => ({
          ok: true,
          row: makePais(10, "Uruguay", EST_A),
        }),
      ),
    };

    const { result } = renderHook(
      () =>
        useMaintenanceController({
          table: TABLE_PAIS,
          repo,
          feedback,
          queryClient,
          getRowCode: (row) => row.PaiCod,
          getRowState: (row) => row.PaiEstReg,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.hasPending).toBe(false);
    expect(result.current.salir()).toBe(true);

    act(() => {
      const startRes = result.current.startAdicion({
        PaiCod: 10,
        PaiNom: "Uruguay",
      });
      expect(startRes.ok).toBe(true);
    });

    expect(result.current.hasPending).toBe(true);
    expect(result.current.pending?.kind).toBe("adición");

    act(() => {
      const second = result.current.startModificacion();
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.failures[0]?.code).toBe(ERROR_CODES.PENDING);
      }
    });

    expect(feedback.alertPending).toHaveBeenCalledTimes(1);
    expect(result.current.pending?.kind).toBe("adición");

    const canExit = result.current.salir();
    expect(canExit).toBe(false);
    expect(feedback.alertPending).toHaveBeenCalledTimes(2);
    expect(result.current.hasPending).toBe(true);
  });

  it("rechaza transiciones prohibidas (§6.1) con E-TRANSITION antes de armar pendiente", () => {
    const queryClient = new QueryClient();
    const feedback = createFeedbackMock();
    const repo: RepoWriter<PaisRow> = {
      guardarOp: vi.fn(
        async (): Promise<GuardarResult<PaisRow>> => ({ ok: true }),
      ),
    };

    const { result } = renderHook(
      () =>
        useMaintenanceController({
          table: TABLE_PAIS,
          repo,
          feedback,
          queryClient,
          getRowCode: (row) => row.PaiCod,
          getRowState: (row) => row.PaiEstReg,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    // Activo -> Reactivar => E-TRANSITION
    act(() => {
      result.current.selectRow(makePais(1, "Perú", EST_A));
    });
    act(() => {
      const res = result.current.startReactivar();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.failures[0]?.code).toBe(ERROR_CODES.TRANSITION);
      }
    });
    expect(result.current.hasPending).toBe(false);

    // Inactivo -> Inactivar => E-TRANSITION
    act(() => {
      result.current.selectRow(makePais(2, "Chile", EST_I));
    });
    act(() => {
      const res = result.current.startInactivar();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.failures[0]?.code).toBe(ERROR_CODES.TRANSITION);
      }
    });

    // Eliminado (*) -> Modificar / Inactivar / Reactivar / Eliminar => E-TRANSITION
    act(() => {
      result.current.selectRow(makePais(3, "Ecuador", EST_X));
    });
    act(() => {
      expect(result.current.startModificacion().ok).toBe(false);
      expect(result.current.startInactivar().ok).toBe(false);
      expect(result.current.startReactivar().ok).toBe(false);
      expect(result.current.startEliminar().ok).toBe(false);
    });

    expect(result.current.hasPending).toBe(false);
    expect(feedback.notifyBatchErrors).toHaveBeenCalledTimes(6);
  });

  it("al fallar guardar() conserva pending abierto y propaga errores R22 al formulario; guardar sin pending es noop", async () => {
    const queryClient = new QueryClient();
    const feedback = createFeedbackMock();
    const onApplyFieldErrors = vi.fn();
    const repoFailures: FieldFailure[] = [
      createFailure(ERROR_CODES.DUP, "PaiCod"),
      createFailure(ERROR_CODES.DUP, "PaiNom"),
    ];

    const guardarOp = vi.fn(
      async (_op: PendingOp): Promise<GuardarResult<PaisRow>> => ({
        ok: false,
        failures: repoFailures,
      }),
    );

    const { result } = renderHook(
      () =>
        useMaintenanceController({
          table: TABLE_PAIS,
          repo: { guardarOp },
          feedback,
          queryClient,
          onApplyFieldErrors,
          getRowCode: (row) => row.PaiCod,
          getRowState: (row) => row.PaiEstReg,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    // Guardar sin pendiente => noop silencioso
    let noopRes: GuardarResult<PaisRow> | undefined;
    await act(async () => {
      noopRes = await result.current.guardar();
    });
    expect(noopRes).toEqual({ ok: true, noop: true });
    expect(guardarOp).not.toHaveBeenCalled();

    // Armar Adición y fallar en repo => conserva pending y reporta errores
    act(() => {
      result.current.startAdicion({ PaiCod: 1, PaiNom: "Perú" });
    });

    let failRes: GuardarResult<PaisRow> | undefined;
    await act(async () => {
      failRes = await result.current.guardar({ PaiCod: 1, PaiNom: "Perú" });
    });
    expect(failRes?.ok).toBe(false);
    expect(result.current.hasPending).toBe(true);
    expect(result.current.pending?.kind).toBe("adición");
    expect(onApplyFieldErrors).toHaveBeenCalledWith(repoFailures);
    expect(feedback.notifyBatchErrors).toHaveBeenCalledWith(repoFailures);

    // Cancelar descarta pendiente sin tocar repo
    act(() => {
      result.current.cancelar();
    });
    expect(result.current.hasPending).toBe(false);
    expect(guardarOp).toHaveBeenCalledTimes(1);
  });

  it("maneja fallos de red en guardar() con notifyNetworkError conservando pending, y mapea fallos RHF sin duplicar campo", async () => {
    const queryClient = new QueryClient();
    const feedback = createFeedbackMock();
    const repo: RepoWriter<PaisRow> = {
      guardarOp: vi.fn(async () => {
        throw new Error("Failed to fetch");
      }),
    };

    const { result } = renderHook(
      () =>
        useMaintenanceController({
          table: TABLE_PAIS,
          repo,
          feedback,
          queryClient,
          getRowCode: (row) => row.PaiCod,
          getRowState: (row) => row.PaiEstReg,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startAdicion({ PaiCod: 20, PaiNom: "Paraguay" });
    });
    await act(async () => {
      const res = await result.current.guardar();
      expect(res.ok).toBe(false);
    });

    expect(result.current.hasPending).toBe(true);
    expect(feedback.notifyNetworkError).toHaveBeenCalledTimes(1);

    const fieldErrors: Array<[string, string]> = [];
    applyFieldFailuresToForm(
      [
        createFailure(ERROR_CODES.FORMAT, "PerDNI"),
        createFailure(ERROR_CODES.RANGE, "PerDNI"),
        createFailure(ERROR_CODES.PENDING, "session"),
      ],
      (field, message) => {
        fieldErrors.push([field, message]);
      },
    );
    expect(fieldErrors).toHaveLength(1);
    expect(fieldErrors[0]?.[0]).toBe("PerDNI");
    expect(fieldErrors[0]?.[1]).toContain("[E-FORMAT]");
  });
});
