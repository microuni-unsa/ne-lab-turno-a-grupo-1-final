import fs from "node:fs";
import path from "node:path";
import { zodResolver } from "@hookform/resolvers/zod";
import { IonApp } from "@ionic/react";
import { cleanVars, createFormDefaults } from "@microx-technologies/microform";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import {
  asPaiCod,
  createFailure,
  ERROR_CODES,
  EST_A,
  EST_I,
  type GuardarResult,
  type PaisRow,
  type PendingOp,
  TABLE_CARGO,
  TABLE_PAIS,
} from "@/core";
import { DEFAULT_PAGE_LIMIT, PaisRepo } from "@/data";
import { maintenanceKeys } from "@/features/maintenance/query-keys";
import { createReferenceSchema } from "@/features/maintenance/schemas";
import {
  applyFieldFailuresToForm,
  type RepoWriter,
  useMaintenanceController,
} from "@/features/maintenance/use-maintenance-controller";
import {
  type FeedbackAlertSnapshot,
  type FeedbackOverlayAdapter,
  type FeedbackPort,
  IonicFeedbackProvider,
  useFeedback,
} from "@/lib/feedback";
import { AppStructForm, type AppStructure } from "@/lib/microform";

const isLiveDb = process.env.LIVE_DB === "1";

if (!isLiveDb) {
  console.warn(
    "[test/integration] Skipping live Supabase controller integration test: LIVE_DB=1 is not set.",
  );
}

const describeLive = isLiveDb ? describe : describe.skip;

function makePaisRow(
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

const PAIS_INSERT_SCHEMA = createReferenceSchema({
  codeField: "PaiCod",
  nomField: "PaiNom",
  isUpdate: false,
});

const PAIS_TEST_STRUCTURE: AppStructure<"PaiCod" | "PaiNom"> = [
  {
    fields: [
      { type: "number", name: "PaiCod", label: "Código", colspan: 4 },
      { type: "text", name: "PaiNom", label: "Nombre", colspan: 8 },
    ],
  },
];

function ControllerHarness({
  repo,
  onListFetch,
  onGselFetch,
  onCargoFetch,
}: {
  readonly repo: RepoWriter<PaisRow>;
  readonly onListFetch: () => void;
  readonly onGselFetch: () => void;
  readonly onCargoFetch: () => void;
}) {
  const feedback = useFeedback();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(PAIS_INSERT_SCHEMA),
    defaultValues: createFormDefaults(PAIS_INSERT_SCHEMA),
  });

  const controller = useMaintenanceController<
    typeof TABLE_PAIS,
    PaisRow,
    Record<string, unknown>
  >({
    table: TABLE_PAIS,
    repo,
    feedback,
    queryClient,
    onApplyFieldErrors: (failures) => {
      applyFieldFailuresToForm(failures, (field, message) => {
        if (field === "PaiCod" || field === "PaiNom") {
          form.setError(field, { type: "domain", message });
        }
      });
    },
    getRowCode: (row) => row.PaiCod,
    getRowState: (row) => row.PaiEstReg,
  });

  const listQuery = useQuery({
    queryKey: maintenanceKeys.list(TABLE_PAIS, {
      ordering: "default",
      searchMode: "none",
      offset: 0,
      limit: DEFAULT_PAGE_LIMIT,
    }),
    queryFn: async () => {
      onListFetch();
      return [];
    },
  });

  const gselQuery = useQuery({
    queryKey: maintenanceKeys.gsel(TABLE_PAIS),
    queryFn: async () => {
      onGselFetch();
      return [];
    },
  });

  const cargoQuery = useQuery({
    queryKey: maintenanceKeys.list(TABLE_CARGO, {
      ordering: "default",
      searchMode: "none",
      offset: 0,
      limit: DEFAULT_PAGE_LIMIT,
    }),
    queryFn: async () => {
      onCargoFetch();
      return [];
    },
  });

  return (
    <div>
      <span data-testid="pending-flag">
        {controller.hasPending ? "yes" : "no"}
      </span>
      <span data-testid="list-count">{listQuery.data?.length ?? 0}</span>
      <span data-testid="gsel-count">{gselQuery.data?.length ?? 0}</span>
      <span data-testid="cargo-count">{cargoQuery.data?.length ?? 0}</span>

      <button
        type="button"
        data-testid="btn-start-add"
        onClick={() => {
          form.reset(createFormDefaults(PAIS_INSERT_SCHEMA));
          controller.startAdicion();
        }}
      >
        Adicionar
      </button>

      <button
        type="button"
        data-testid="btn-cancel"
        onClick={() => {
          controller.cancelar();
          form.reset(createFormDefaults(PAIS_INSERT_SCHEMA));
        }}
      >
        Cancelar
      </button>

      {controller.pending && (
        <AppStructForm
          form={form}
          schema={PAIS_INSERT_SCHEMA}
          structure={PAIS_TEST_STRUCTURE}
          onSubmit={async (values) => {
            await controller.guardar(cleanVars(values));
          }}
          renderSubmit={({ isSubmitting, disabled }) => (
            <button
              type="submit"
              data-testid="btn-save"
              disabled={disabled || isSubmitting}
            >
              Guardar
            </button>
          )}
        />
      )}
    </div>
  );
}

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

describe("useMaintenanceController integration (React Query + RHF + FeedbackPort)", () => {
  it("invalida list y gsel de PAIS al guardar exitosamente sin tocar CARGO ni invalidar en Cancelar, y mapea FieldFailure[] a form.setError", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const alerts: FeedbackAlertSnapshot[] = [];
    const adapter: FeedbackOverlayAdapter = {
      presentAlert(snapshot) {
        alerts.push(snapshot);
      },
    };

    const onListFetch = vi.fn();
    const onGselFetch = vi.fn();
    const onCargoFetch = vi.fn();

    let callIndex = 0;
    const repo: RepoWriter<PaisRow> = {
      guardarOp: vi.fn(
        async (_op: PendingOp): Promise<GuardarResult<PaisRow>> => {
          callIndex += 1;
          if (callIndex === 1) {
            return {
              ok: false,
              failures: [createFailure(ERROR_CODES.DUP, "PaiNom")],
            };
          }
          return {
            ok: true,
            row: makePaisRow(88, "Costa Rica", EST_A),
          };
        },
      ),
    };

    render(
      <QueryClientProvider client={queryClient}>
        <IonApp>
          <IonicFeedbackProvider adapter={adapter}>
            <ControllerHarness
              repo={repo}
              onListFetch={onListFetch}
              onGselFetch={onGselFetch}
              onCargoFetch={onCargoFetch}
            />
          </IonicFeedbackProvider>
        </IonApp>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(onListFetch).toHaveBeenCalledTimes(1);
      expect(onGselFetch).toHaveBeenCalledTimes(1);
      expect(onCargoFetch).toHaveBeenCalledTimes(1);
    });

    // 1. Armar Adición + Cancelar no invalida cachés ni escribe
    fireEvent.click(screen.getByTestId("btn-start-add"));
    expect(screen.getByTestId("pending-flag").textContent).toBe("yes");
    fireEvent.click(screen.getByTestId("btn-cancel"));
    expect(screen.getByTestId("pending-flag").textContent).toBe("no");
    expect(onListFetch).toHaveBeenCalledTimes(1);
    expect(onGselFetch).toHaveBeenCalledTimes(1);

    // 2. Fallo E-DUP de repo mantiene pending y muestra error en RHF (form.setError) + IonAlert
    fireEvent.click(screen.getByTestId("btn-start-add"));
    const codeInput = document.getElementById("PaiCod");
    const nomInput = document.getElementById("PaiNom");
    if (!codeInput || !nomInput) {
      throw new Error(
        `Expected form inputs (#PaiCod, #PaiNom), got slots: ${document.querySelectorAll('[data-slot="input"]').length}`,
      );
    }
    codeInput.dispatchEvent(
      new CustomEvent("ionInput", {
        bubbles: true,
        detail: { value: "88", event: new Event("input") },
      }),
    );
    nomInput.dispatchEvent(
      new CustomEvent("ionInput", {
        bubbles: true,
        detail: { value: "Costa Rica", event: new Event("input") },
      }),
    );
    fireEvent.click(screen.getByTestId("btn-save"));

    await waitFor(() => {
      expect(alerts).toHaveLength(1);
      expect(screen.getByText(/E-DUP/)).toBeDefined();
    });
    expect(screen.getByTestId("pending-flag").textContent).toBe("yes");
    expect(onListFetch).toHaveBeenCalledTimes(1);

    // 3. Reintentar Guardar exitoso => limpia pending e invalida list + gsel de PAIS sin invalidar CARGO
    fireEvent.click(screen.getByTestId("btn-save"));

    await waitFor(() => {
      expect(screen.getByTestId("pending-flag").textContent).toBe("no");
      expect(onListFetch).toHaveBeenCalledTimes(2);
      expect(onGselFetch).toHaveBeenCalledTimes(2);
    });
    expect(onCargoFetch).toHaveBeenCalledTimes(1);
  });
});

describeLive("useMaintenanceController LIVE_DB=1 (PaisRepo real)", () => {
  it("ejecuta ciclo crear e inactivar contra Supabase preservando created_at", async () => {
    const client = readSecretSupabaseClient();
    const repo = new PaisRepo(client);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const feedback: FeedbackPort = {
      notifySuccess: vi.fn(),
      notifyWarning: vi.fn(),
      notifyBatchErrors: vi.fn(),
      notifyNetworkError: vi.fn(),
      confirmAction: vi.fn(async () => true),
      alertPending: vi.fn(),
    };
    const scratchCode = 31991;
    const scratchNom = `PaisFase3_${Date.now()}`;

    await client.from("pais").delete().eq("PaiCod", scratchCode);

    try {
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
        {
          wrapper: ({ children }: { readonly children: ReactNode }) =>
            createElement(
              QueryClientProvider,
              { client: queryClient },
              children,
            ),
        },
      );

      act(() => {
        result.current.startAdicion({
          PaiCod: scratchCode,
          PaiNom: scratchNom,
        });
      });

      let created: GuardarResult<PaisRow> | undefined;
      await act(async () => {
        created = await result.current.guardar();
      });
      expect(created?.ok).toBe(true);
      if (!created?.ok || !created.row) {
        throw new Error("Expected created row");
      }

      act(() => {
        result.current.startInactivar();
      });

      let inactivated: GuardarResult<PaisRow> | undefined;
      await act(async () => {
        inactivated = await result.current.guardar();
      });
      expect(inactivated?.ok).toBe(true);
      if (!inactivated?.ok || !inactivated.row) {
        throw new Error("Expected inactivated row");
      }
      expect(inactivated.row.PaiEstReg).toBe(EST_I);
      expect(inactivated.row.created_at).toBe(created.row.created_at);
    } finally {
      await client.from("pais").delete().eq("PaiCod", scratchCode);
    }
  });
});
