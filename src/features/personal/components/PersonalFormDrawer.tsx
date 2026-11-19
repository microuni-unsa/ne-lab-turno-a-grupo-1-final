import { zodResolver } from "@hookform/resolvers/zod";
import { createFormDefaults } from "@microx-technologies/microform";
import * as React from "react";
import { useForm } from "react-hook-form";
import { type EstReg, type FieldFailure, validatePersonalRow } from "@/core";
import {
  MaintenanceFormDrawerShell,
  MaintenanceFormFooter,
} from "@/features/maintenance/components/MaintenanceFormDrawerShell";
import { useMaintenanceFormSession } from "@/features/maintenance/use-maintenance-form-session";
import {
  createPersonalSchema,
  type PersonalFormValues,
} from "@/features/personal/personal-schema";
import {
  createPersonalStructure,
  PERSONAL_FORM_FIELDS,
  type PersonalFieldName,
  type PersonalGselBindings,
} from "@/features/personal/personal-structure";
import { AppStructForm } from "@/lib/microform";

export interface PersonalFormDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly sessionKey: number;
  readonly mode: "adición" | "modificación";
  readonly todayLocal: string;
  readonly bindings: PersonalGselBindings;
  readonly draft: Record<string, unknown>;
  readonly onDraftChange: (nextDraft: Record<string, unknown>) => void;
  readonly estReg: EstReg;
  readonly externalFailures: readonly FieldFailure[];
  readonly isSaving: boolean;
  readonly submitTriggerRef: React.MutableRefObject<(() => void) | null>;
  readonly onSubmitPayload: (
    payload: Record<string, unknown>,
  ) => Promise<boolean>;
  readonly onNotifyBatchErrors: (failures: readonly FieldFailure[]) => void;
  readonly onCancelPending: () => void;
  readonly onHideDrawer: () => void;
  readonly onSalir: () => void;
}

function isPersonalFieldName(name: string): name is PersonalFieldName {
  return PERSONAL_FORM_FIELDS.has(name);
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function buildInitialPersonalValues(
  defaults: Record<string, unknown>,
  draft: Record<string, unknown>,
): Partial<PersonalFormValues> {
  const merged: Record<string, unknown> = { ...defaults, ...draft };
  return {
    PerCod: toOptionalNumber(merged.PerCod),
    PerNom: toOptionalString(merged.PerNom) ?? "",
    PerDNI: toOptionalString(merged.PerDNI) ?? "",
    PerFecNac: toOptionalString(merged.PerFecNac) ?? "",
    PerPaiCod: toOptionalNumber(merged.PerPaiCod),
    PerDepCod: toOptionalNumber(merged.PerDepCod),
    PerCarCod: toOptionalNumber(merged.PerCarCod),
  };
}

function PersonalFormSession({
  mode,
  todayLocal,
  bindings,
  draft,
  onDraftChange,
  externalFailures,
  isSaving,
  submitTriggerRef,
  onSubmitPayload,
  onNotifyBatchErrors,
  onCancelPending,
  onSalir,
  inline = false,
}: Omit<
  PersonalFormDrawerProps,
  "open" | "onOpenChange" | "sessionKey" | "estReg" | "onHideDrawer"
> & { readonly inline?: boolean }) {
  const isUpdate = mode === "modificación";

  const schema = React.useMemo(
    () => createPersonalSchema({ isUpdate, todayLocal }),
    [isUpdate, todayLocal],
  );

  const structure = React.useMemo(
    () => createPersonalStructure({ isUpdate, todayLocal, bindings }),
    [bindings, isUpdate, todayLocal],
  );

  const [frozenDefaults] = React.useState<Partial<PersonalFormValues>>(() =>
    buildInitialPersonalValues(createFormDefaults(schema), draft),
  );

  const form = useForm<PersonalFormValues>({
    resolver: zodResolver(schema),
    defaultValues: frozenDefaults,
  });

  const validateCleaned = React.useCallback(
    (cleaned: Record<string, unknown>) =>
      validatePersonalRow(cleaned, { todayLocal, isUpdate }),
    [isUpdate, todayLocal],
  );

  const toFieldPath = React.useCallback(
    (fieldName: string): PersonalFieldName | null =>
      isPersonalFieldName(fieldName) ? fieldName : null,
    [],
  );

  const { handleValid, triggerSubmit } = useMaintenanceFormSession({
    form,
    externalFailures,
    submitTriggerRef,
    onDraftChange,
    validateCleaned,
    toFieldPath,
    onSubmitPayload,
    onNotifyBatchErrors,
  });

  return (
    <AppStructForm
      form={form}
      schema={schema}
      structure={structure}
      onSubmit={handleValid}
      renderSubmit={({ isSubmitting, disabled }) =>
        inline ? null : (
          <MaintenanceFormFooter
            busy={isSaving || isSubmitting || disabled}
            onTriggerSubmit={triggerSubmit}
            onCancelPending={onCancelPending}
            onSalir={onSalir}
          />
        )
      }
    />
  );
}

export function PersonalInlineForm({
  sessionKey,
  mode,
  todayLocal,
  bindings,
  draft,
  onDraftChange,
  externalFailures,
  isSaving,
  submitTriggerRef,
  onSubmitPayload,
  onNotifyBatchErrors,
  onCancelPending,
  onSalir,
}: Omit<
  PersonalFormDrawerProps,
  "open" | "onOpenChange" | "estReg" | "onHideDrawer"
>) {
  return (
    <PersonalFormSession
      key={`${mode}-${sessionKey}`}
      mode={mode}
      todayLocal={todayLocal}
      bindings={bindings}
      draft={draft}
      onDraftChange={onDraftChange}
      externalFailures={externalFailures}
      isSaving={isSaving}
      submitTriggerRef={submitTriggerRef}
      onSubmitPayload={onSubmitPayload}
      onNotifyBatchErrors={onNotifyBatchErrors}
      onCancelPending={onCancelPending}
      onSalir={onSalir}
      inline
    />
  );
}

/**
 * Bottom Drawer form built on AppStructForm for PERSONAL (`SPEC §5.3–§5.4`, `§9`, `R22`).
 */
export function PersonalFormDrawer({
  open,
  onOpenChange,
  sessionKey,
  mode,
  todayLocal,
  bindings,
  draft,
  onDraftChange,
  estReg,
  externalFailures,
  isSaving,
  submitTriggerRef,
  onSubmitPayload,
  onNotifyBatchErrors,
  onCancelPending,
  onHideDrawer,
  onSalir,
}: PersonalFormDrawerProps) {
  const isUpdate = mode === "modificación";

  return (
    <MaintenanceFormDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      onHideDrawer={onHideDrawer}
      titleTestId="personal-form-title"
      title={isUpdate ? "Modificar Personal" : "Adicionar Personal"}
      description={
        isUpdate
          ? "Código bloqueado en modificación (R2). FKs solo por G-SEL."
          : "Completa los datos y selecciona País, Dependencia y Cargo vía G-SEL."
      }
      estFieldLabel="PerEstReg · no editable"
      estReg={estReg}
      isUpdate={isUpdate}
      initialBreakpoint={0.85}
      breakpoints={[0, 0.65, 0.85, 0.95]}
      bodyClassName="space-y-4 overflow-y-auto overscroll-contain px-1 pb-2 max-h-[68dvh]"
    >
      {open && (
        <PersonalFormSession
          key={`${mode}-${sessionKey}`}
          mode={mode}
          todayLocal={todayLocal}
          bindings={bindings}
          draft={draft}
          onDraftChange={onDraftChange}
          externalFailures={externalFailures}
          isSaving={isSaving}
          submitTriggerRef={submitTriggerRef}
          onSubmitPayload={onSubmitPayload}
          onNotifyBatchErrors={onNotifyBatchErrors}
          onCancelPending={onCancelPending}
          onSalir={onSalir}
        />
      )}
    </MaintenanceFormDrawerShell>
  );
}
