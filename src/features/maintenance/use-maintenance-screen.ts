import { cleanVars } from "@microx-technologies/microform";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import {
  EST_A,
  EST_X,
  type EstReg,
  type FieldFailure,
  type PendingOpKind,
  type TableName,
} from "@/core";
import {
  verifySupervisorCode as defaultVerifySupervisorCode,
  type OrderingToggle,
} from "@/data";
import { useGuardedExit } from "@/features/maintenance/use-guarded-exit";
import {
  getLocalIsoDate,
  type RepoWriter,
  useMaintenanceController,
} from "@/features/maintenance/use-maintenance-controller";
import { toPlainRecord } from "@/features/maintenance/use-maintenance-form-session";
import {
  type RepoReader,
  useMaintenanceList,
} from "@/features/maintenance/use-maintenance-list";
import { useFeedback } from "@/lib/feedback";

export type StateTransitionOpKind = Extract<
  PendingOpKind,
  "inactivar" | "reactivar" | "eliminación"
>;

export interface UseMaintenanceScreenOptions<TTable extends TableName, TRow> {
  readonly table: TTable;
  readonly repo: RepoReader<TRow> & RepoWriter<TRow>;
  readonly defaultOrdering?: OrderingToggle;
  readonly pageSize?: number;
  readonly getRowCode: (row: TRow) => number;
  readonly getRowState: (row: TRow) => EstReg;
  readonly rowToPayload: (row: TRow) => Record<string, unknown>;
  readonly validatePayload: (
    payload: Record<string, unknown>,
    isUpdate: boolean,
    todayLocal: string,
  ) => readonly FieldFailure[];
  readonly getTodayLocal?: () => string;
  readonly verifySupervisor?: (code: string) => Promise<boolean>;
}

export function isStateTransitionOp(
  kind: string | undefined,
): kind is StateTransitionOpKind {
  return kind === "inactivar" || kind === "reactivar" || kind === "eliminación";
}

function normalizeRecordPayload(raw: unknown): Record<string, unknown> {
  const plain = toPlainRecord(raw);
  const trimmed: Record<string, unknown> = {};
  for (const key of Object.keys(plain)) {
    const val = plain[key];
    trimmed[key] = typeof val === "string" ? val.trim() : val;
  }
  return cleanVars(trimmed) ?? {};
}

/**
 * Shared stateful orchestrator combining MaintenanceController, MaintenanceList,
 * guarded Salir navigation, and form drawer session lifecycle for any table screen.
 */
export function useMaintenanceScreen<TTable extends TableName, TRow>({
  table,
  repo,
  defaultOrdering,
  pageSize,
  getRowCode,
  getRowState,
  rowToPayload,
  validatePayload,
  getTodayLocal,
  verifySupervisor,
}: UseMaintenanceScreenOptions<TTable, TRow>) {
  const feedback = useFeedback();
  const queryClient = useQueryClient();

  const [simpleInput, setSimpleInput] = React.useState("");
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [supervisorDialogOpen, setSupervisorDialogOpen] = React.useState(false);
  const [formDrawerOpen, setFormDrawerOpen] = React.useState(false);
  const [formSessionKey, setFormSessionKey] = React.useState(0);
  const [formDraft, setFormDraft] = React.useState<Record<string, unknown>>({});
  const [externalFailures, setExternalFailures] = React.useState<
    readonly FieldFailure[]
  >([]);

  const submitTriggerRef = React.useRef<(() => void) | null>(null);
  const pendingKindRef = React.useRef<PendingOpKind | undefined>(undefined);
  const scrollToTopRef = React.useRef<(() => void) | null>(null);
  const [detailReplayKey, setDetailReplayKey] = React.useState(0);

  const registerScrollToTop = React.useCallback((fn: () => void) => {
    scrollToTopRef.current = fn;
  }, []);

  const triggerScrollToTop = React.useCallback(() => {
    scrollToTopRef.current?.();
  }, []);
  const controller = useMaintenanceController<TTable, TRow>({
    table,
    repo,
    feedback,
    queryClient,
    getRowCode,
    getRowState,
    getTodayLocal,
    validatePayload: (op, todayLocal) => {
      if (op.kind !== "adición" && op.kind !== "modificación") {
        return [];
      }
      return validatePayload(
        normalizeRecordPayload(op.payload),
        op.kind === "modificación",
        todayLocal,
      );
    },
    onApplyFieldErrors: (failures) => {
      if (
        pendingKindRef.current === "adición" ||
        pendingKindRef.current === "modificación"
      ) {
        setExternalFailures(failures);
        setFormDrawerOpen(true);
      }
    },
  });

  const list = useMaintenanceList({
    table,
    repo,
    initialOrdering: defaultOrdering,
    pageSize,
  });

  const pendingKind = controller.pending?.kind;
  pendingKindRef.current = pendingKind;
  const isFormPending =
    pendingKind === "adición" || pendingKind === "modificación";

  const formMode: "adición" | "modificación" =
    pendingKind === "modificación" ? "modificación" : "adición";

  const drawerEstReg: EstReg =
    formMode === "modificación" && controller.selectedRow
      ? getRowState(controller.selectedRow)
      : EST_A;

  const handleStartAdicion = React.useCallback(() => {
    const started = controller.startAdicion();
    if (!started.ok) {
      return;
    }
    setFormDraft({});
    setExternalFailures([]);
    setFormSessionKey((prev) => prev + 1);
    setFormDrawerOpen(true);
    triggerScrollToTop();
  }, [controller, triggerScrollToTop]);

  const handleStartModificacion = React.useCallback(() => {
    const started = controller.startModificacion();
    const row = controller.getSelectedRow();
    if (!started.ok || !row) {
      return;
    }
    setFormDraft(rowToPayload(row));
    setExternalFailures([]);
    setFormSessionKey((prev) => prev + 1);
    setFormDrawerOpen(true);
    triggerScrollToTop();
  }, [controller, rowToPayload, triggerScrollToTop]);

  const handleDraftChange = React.useCallback(
    (nextDraft: Record<string, unknown>) => {
      setFormDraft((prevDraft) => {
        setExternalFailures((prevFailures) => {
          if (prevFailures.length === 0) {
            return prevFailures;
          }
          const changedFields = new Set<string>();
          for (const key of new Set([
            ...Object.keys(prevDraft),
            ...Object.keys(nextDraft),
          ])) {
            if (prevDraft[key] !== nextDraft[key]) {
              changedFields.add(key);
            }
          }
          if (changedFields.size === 0) {
            return prevFailures;
          }
          return prevFailures.filter((f) => !changedFields.has(f.field));
        });
        return nextDraft;
      });
    },
    [],
  );

  const handleSubmitPayload = React.useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      setExternalFailures([]);
      const result = await controller.guardar(payload);
      if (result.ok) {
        setFormDrawerOpen(false);
        setFormDraft({});
        setExternalFailures([]);
      }
      return result.ok;
    },
    [controller],
  );

  const handleGuardarAction = React.useCallback(async () => {
    if (isFormPending) {
      if (submitTriggerRef.current) {
        if (!formDrawerOpen) {
          setFormDrawerOpen(true);
        }
        submitTriggerRef.current();
        return;
      }
      const cleaned = normalizeRecordPayload(formDraft);
      const isUpdate = pendingKind === "modificación";
      const todayLocal = getTodayLocal ? getTodayLocal() : getLocalIsoDate();
      const failures = validatePayload(cleaned, isUpdate, todayLocal);
      if (failures.length > 0) {
        feedback.notifyBatchErrors(failures);
        setExternalFailures(failures);
        setFormDrawerOpen(true);
        return;
      }
      await handleSubmitPayload(cleaned);
      return;
    }

    await controller.guardar();
  }, [
    controller,
    feedback,
    formDraft,
    formDrawerOpen,
    getTodayLocal,
    handleSubmitPayload,
    isFormPending,
    pendingKind,
    validatePayload,
  ]);

  const handleSelectRow = React.useCallback(
    (row: TRow | null) => {
      const result = controller.selectRow(row);
      if (result.ok && result.detailOpened) {
        if (result.reselected) {
          setDetailReplayKey((prev) => prev + 1);
        }
        triggerScrollToTop();
      }
    },
    [controller, triggerScrollToTop],
  );

  const handleCancelPending = React.useCallback(() => {
    if (controller.isSaving) {
      return;
    }
    if (controller.hasPending) {
      controller.cancelar();
      setFormDrawerOpen(false);
      setFormDraft({});
      setExternalFailures([]);
      triggerScrollToTop();
      return;
    }
    controller.selectRow(null);
  }, [controller, triggerScrollToTop]);
  const handleStartInactivar = React.useCallback(() => {
    const res = controller.startInactivar();
    if (res.ok) {
      triggerScrollToTop();
    }
  }, [controller, triggerScrollToTop]);

  const handleStartEliminar = React.useCallback(() => {
    const res = controller.startEliminar();
    if (res.ok) {
      triggerScrollToTop();
    }
  }, [controller, triggerScrollToTop]);

  const handleRequestReactivar = React.useCallback(() => {
    const selected = controller.getSelectedRow();
    if (selected && getRowState(selected) === EST_X && !controller.hasPending) {
      setSupervisorDialogOpen(true);
      return;
    }
    const res = controller.startReactivar();
    if (res.ok) {
      triggerScrollToTop();
    }
  }, [controller, getRowState, triggerScrollToTop]);

  const handleConfirmSupervisorReactivar = React.useCallback(
    async (
      supervisorCode: string,
    ): Promise<{ readonly ok: boolean; readonly error?: string }> => {
      const trimmed = supervisorCode.trim();
      if (trimmed.length === 0) {
        return { ok: false, error: "Ingrese el código de autorización." };
      }

      try {
        const verifyFn = verifySupervisor ?? defaultVerifySupervisorCode;
        const isValid = await verifyFn(trimmed);
        if (!isValid) {
          return {
            ok: false,
            error: "Código de supervisor inválido.",
          };
        }
      } catch {
        return {
          ok: false,
          error:
            "No se pudo validar el código con el servidor. Verifique su conexión.",
        };
      }

      setSupervisorDialogOpen(false);
      const res = controller.startReactivar(trimmed);
      if (res.ok) {
        triggerScrollToTop();
      }
      return { ok: true };
    },
    [controller, triggerScrollToTop, verifySupervisor],
  );

  const handleToggleViewScope = React.useCallback(() => {
    if (controller.hasPending) {
      return;
    }
    controller.selectRow(null);
    setSimpleInput("");
    list.toggleViewScope();
  }, [controller, list]);

  const handleSalir = useGuardedExit(controller.salir);

  return {
    table,
    feedback,
    queryClient,
    controller,
    list,
    simpleInput,
    setSimpleInput,
    advancedOpen,
    setAdvancedOpen,
    supervisorDialogOpen,
    setSupervisorDialogOpen,
    formDrawerOpen,
    setFormDrawerOpen,
    formSessionKey,
    formDraft,
    setFormDraft: handleDraftChange,
    externalFailures,
    submitTriggerRef,
    registerScrollToTop,
    detailReplayKey,
    pendingKind,
    isFormPending,
    formMode,
    drawerEstReg,
    selectedCode: controller.selectedRow
      ? getRowCode(controller.selectedRow)
      : null,
    selectedState: controller.selectedRow
      ? getRowState(controller.selectedRow)
      : null,
    handleStartAdicion,
    handleStartModificacion,
    handleStartInactivar,
    handleStartEliminar,
    handleRequestReactivar,
    handleConfirmSupervisorReactivar,
    handleToggleViewScope,
    handleSubmitPayload,
    handleGuardarAction,
    handleSelectRow,
    handleCancelPending,
    handleSalir,
  };
}
