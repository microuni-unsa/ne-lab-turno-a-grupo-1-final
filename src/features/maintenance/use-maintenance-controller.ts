import type { QueryClient } from "@tanstack/react-query";
import * as React from "react";
import {
  createFailure,
  ERROR_CODES,
  type EstReg,
  type FieldFailure,
  type GuardarResult,
  MaintenanceSession,
  type PendingOp,
  type PendingOpKind,
  type SessionOpResult,
  type TableName,
  type TablePayload,
} from "@/core";
import type { BaseRepo } from "@/data";
import { invalidateTableQueries } from "@/features/maintenance/query-keys";
import { deduplicateFailures, formatFieldFailure } from "@/lib/error-catalog";
import type { FeedbackPort } from "@/lib/feedback";

export type RepoWriter<TRow> = Pick<BaseRepo<TRow>, "guardarOp">;

export interface UseMaintenanceControllerOptions<
  TTable extends TableName,
  TRow,
  TPayload extends TablePayload = Record<string, unknown>,
> {
  readonly table: TTable;
  readonly repo: RepoWriter<TRow>;
  readonly feedback: FeedbackPort;
  readonly queryClient: QueryClient;
  readonly getTodayLocal?: () => string;
  readonly validatePayload?: (
    op: PendingOp<TTable>,
    todayLocal: string,
  ) => Promise<readonly FieldFailure[]> | readonly FieldFailure[];
  readonly onApplyFieldErrors?: (failures: readonly FieldFailure[]) => void;
  readonly getRowCode: (row: TRow) => string;
  readonly getRowState: (row: TRow) => EstReg;
  readonly rowToPayload?: (row: TRow) => TPayload;
}

export interface MaintenanceController<
  TTable extends TableName,
  TRow,
  TPayload extends TablePayload = Record<string, unknown>,
> {
  readonly pending: PendingOp<TTable> | null;
  readonly hasPending: boolean;
  readonly selectedRow: TRow | null;
  readonly getSelectedRow: () => TRow | null;
  readonly isSaving: boolean;
  readonly selectRow: (row: TRow | null) => boolean;
  readonly startAdicion: (initialPayload?: TPayload) => SessionOpResult;
  readonly startModificacion: (overridePayload?: TPayload) => SessionOpResult;
  readonly startInactivar: () => SessionOpResult;
  readonly startReactivar: (supervisorCode?: string) => SessionOpResult;
  readonly startEliminar: () => SessionOpResult;
  readonly cancelar: () => { readonly ok: true };
  readonly guardar: (
    overridePayload?: TPayload,
  ) => Promise<GuardarResult<TRow>>;
  readonly salir: () => boolean;
}

const SAVE_SUCCESS_MESSAGES: Record<PendingOpKind, string> = {
  adición: "Registro adicionado correctamente.",
  modificación: "Registro modificado correctamente.",
  inactivar: "Registro inactivado correctamente.",
  reactivar: "Registro reactivado correctamente.",
  eliminación: "Registro eliminado lógicamente.",
};

/**
 * Formats the local calendar date as YYYY-MM-DD using wall-clock year, month, and day.
 */
export function getLocalIsoDate(referenceDate: Date = new Date()): string {
  const year = String(referenceDate.getFullYear());
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Maps domain FieldFailure items onto form field error setters using the shared catalog.
 */
export function applyFieldFailuresToForm(
  failures: readonly FieldFailure[],
  setFieldError: (field: string, message: string) => void,
): void {
  const byField = new Map<string, string[]>();
  for (const failure of deduplicateFailures(failures)) {
    if (failure.field === "session" || failure.field === "general") {
      continue;
    }
    const existing = byField.get(failure.field) ?? [];
    existing.push(formatFieldFailure(failure).summaryLine);
    byField.set(failure.field, existing);
  }
  for (const [field, messages] of byField.entries()) {
    setFieldError(field, messages.join(" · "));
  }
}

/**
 * Stateful session coordinator wrapping MaintenanceSession (@/core), FeedbackPort,
 * BaseRepo.guardarOp, and TanStack Query cache invalidation.
 */
export function useMaintenanceController<
  TTable extends TableName,
  TRow,
  TPayload extends TablePayload = Record<string, unknown>,
>(
  options: UseMaintenanceControllerOptions<TTable, TRow, TPayload>,
): MaintenanceController<TTable, TRow, TPayload> {
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const [, setRevision] = React.useState(0);
  const [selectedRow, setSelectedRow] = React.useState<TRow | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const selectedRowRef = React.useRef<TRow | null>(null);
  selectedRowRef.current = selectedRow;
  const savingRef = React.useRef(false);

  const bumpRevision = React.useCallback(() => {
    setRevision((prev) => prev + 1);
  }, []);

  const sessionRef = React.useRef<MaintenanceSession<TTable, TRow> | null>(
    null,
  );
  if (
    sessionRef.current === null ||
    sessionRef.current.table !== options.table
  ) {
    sessionRef.current = new MaintenanceSession<TTable, TRow>(options.table, {
      validate: async (op) => {
        const validator = optionsRef.current.validatePayload;
        if (!validator) {
          return [];
        }
        const todayLocal =
          optionsRef.current.getTodayLocal?.() ?? getLocalIsoDate();
        return validator(op, todayLocal);
      },
      commit: async (op) => {
        const result = await optionsRef.current.repo.guardarOp(op);
        if (!result.ok) {
          // Throw FieldFailure[] so MaintenanceSession.guardar keeps _pending intact (SPEC §8.4).
          throw result.failures;
        }
        if (result.row === undefined) {
          throw new Error("El repositorio no devolvió el registro guardado.");
        }
        return result.row;
      },
    });
  }

  const getSession = React.useCallback((): MaintenanceSession<TTable, TRow> => {
    const active = sessionRef.current;
    if (!active) {
      throw new Error("Sesión de mantenimiento no inicializada.");
    }
    return active;
  }, []);

  const selectRow = React.useCallback(
    (row: TRow | null): boolean => {
      const session = getSession();
      if (session.hasPending) {
        optionsRef.current.feedback.alertPending();
        return false;
      }
      setSelectedRow(row);
      selectedRowRef.current = row;
      return true;
    },
    [getSession],
  );

  const reportStartFailure = React.useCallback((result: SessionOpResult) => {
    if (result.ok) {
      return;
    }
    const isPendingFailure = result.failures.some(
      (failure) => failure.code === ERROR_CODES.PENDING,
    );
    if (isPendingFailure) {
      optionsRef.current.feedback.alertPending();
      return;
    }
    optionsRef.current.feedback.notifyBatchErrors(result.failures);
  }, []);

  const startAdicion = React.useCallback(
    (initialPayload?: TPayload): SessionOpResult => {
      const session = getSession();
      const payload: TablePayload = initialPayload ?? {};
      const result = session.start({
        kind: "adición",
        table: optionsRef.current.table,
        payload,
      });
      if (!result.ok) {
        reportStartFailure(result);
        return result;
      }
      bumpRevision();
      return result;
    },
    [bumpRevision, getSession, reportStartFailure],
  );

  const startTargetedOp = React.useCallback(
    (
      kind: "modificación" | "inactivar" | "reactivar" | "eliminación",
      overridePayload?: TPayload,
      supervisorCode?: string,
    ): SessionOpResult => {
      const session = getSession();
      if (session.hasPending) {
        const pendingResult: SessionOpResult = {
          ok: false,
          failures: [createFailure(ERROR_CODES.PENDING, "session")],
        };
        reportStartFailure(pendingResult);
        return pendingResult;
      }

      const target = selectedRowRef.current;
      if (!target) {
        optionsRef.current.feedback.notifyWarning(
          "Seleccione primero un registro de la lista.",
        );
        return {
          ok: false,
          failures: [createFailure(ERROR_CODES.REQUIRED, "general")],
        };
      }

      const targetCode = optionsRef.current.getRowCode(target);
      const targetState = optionsRef.current.getRowState(target);
      const modificationPayload: TablePayload =
        overridePayload ?? optionsRef.current.rowToPayload?.(target) ?? {};

      const op: PendingOp<TTable> =
        kind === "modificación"
          ? {
              kind: "modificación",
              table: optionsRef.current.table,
              targetCode,
              payload: modificationPayload,
            }
          : kind === "reactivar"
            ? {
                kind: "reactivar",
                table: optionsRef.current.table,
                targetCode,
                ...(supervisorCode !== undefined ? { supervisorCode } : {}),
              }
            : {
                kind,
                table: optionsRef.current.table,
                targetCode,
              };

      const result = session.start(op, targetState);
      if (!result.ok) {
        reportStartFailure(result);
        return result;
      }

      bumpRevision();
      return result;
    },
    [bumpRevision, getSession, reportStartFailure],
  );

  const startModificacion = React.useCallback(
    (overridePayload?: TPayload) =>
      startTargetedOp("modificación", overridePayload),
    [startTargetedOp],
  );

  const startInactivar = React.useCallback(
    () => startTargetedOp("inactivar"),
    [startTargetedOp],
  );

  const startReactivar = React.useCallback(
    (supervisorCode?: string) =>
      startTargetedOp("reactivar", undefined, supervisorCode),
    [startTargetedOp],
  );

  const startEliminar = React.useCallback(
    () => startTargetedOp("eliminación"),
    [startTargetedOp],
  );

  const cancelar = React.useCallback((): { readonly ok: true } => {
    if (savingRef.current) {
      return { ok: true };
    }
    const session = getSession();
    const res = session.cancelar();
    bumpRevision();
    return res;
  }, [bumpRevision, getSession]);

  const guardar = React.useCallback(
    async (overridePayload?: TPayload): Promise<GuardarResult<TRow>> => {
      if (savingRef.current) {
        return { ok: true, noop: true };
      }

      const session = getSession();
      const activePending = session.pending;
      if (!activePending) {
        return { ok: true, noop: true };
      }

      if (
        overridePayload !== undefined &&
        (activePending.kind === "adición" ||
          activePending.kind === "modificación")
      ) {
        session.updatePayload(overridePayload);
      }

      savingRef.current = true;
      setIsSaving(true);
      try {
        let result: GuardarResult<TRow>;
        try {
          result = await session.guardar();
        } catch (error: unknown) {
          optionsRef.current.feedback.notifyNetworkError(error);
          bumpRevision();
          return { ok: false, failures: [] };
        }

        if (!result.ok) {
          optionsRef.current.onApplyFieldErrors?.(result.failures);
          optionsRef.current.feedback.notifyBatchErrors(result.failures);
          bumpRevision();
          return result;
        }

        if (result.row !== undefined) {
          setSelectedRow(result.row);
          selectedRowRef.current = result.row;
        }

        bumpRevision();
        optionsRef.current.feedback.notifySuccess(
          SAVE_SUCCESS_MESSAGES[activePending.kind],
        );

        try {
          await invalidateTableQueries(
            optionsRef.current.queryClient,
            optionsRef.current.table,
          );
        } catch {
          // Post-commit query refresh failure must not mask the committed DB write as E-NETWORK.
        }
        return result;
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [bumpRevision, getSession],
  );

  const salir = React.useCallback((): boolean => {
    if (savingRef.current) {
      optionsRef.current.feedback.alertPending();
      return false;
    }
    const session = getSession();
    const result = session.salir();
    if (!result.ok) {
      optionsRef.current.feedback.alertPending();
      return false;
    }
    return true;
  }, [getSession]);

  const getSelectedRow = React.useCallback(() => selectedRowRef.current, []);

  const currentSession = getSession();

  return {
    pending: currentSession.pending,
    hasPending: currentSession.hasPending,
    selectedRow,
    getSelectedRow,
    isSaving,
    selectRow,
    startAdicion,
    startModificacion,
    startInactivar,
    startReactivar,
    startEliminar,
    cancelar,
    guardar,
    salir,
  };
}
