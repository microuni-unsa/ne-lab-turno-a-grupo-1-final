import { zodResolver } from "@hookform/resolvers/zod";
import { createFormDefaults } from "@microx-technologies/microform";
import * as React from "react";
import { type FieldValues, useForm } from "react-hook-form";
import { type EstReg, type FieldFailure, MAX_NAME, MIN_NAME } from "@/core";
import {
  MaintenanceFormDrawerShell,
  MaintenanceFormFooter,
} from "@/features/maintenance/components/MaintenanceFormDrawerShell";
import { useMaintenanceFormSession } from "@/features/maintenance/use-maintenance-form-session";
import type { ReferenceMaintenanceConfig } from "@/features/reference/reference-config";
import { createReferenceSchema } from "@/features/reference/reference-schema";
import { AppStructForm, type AppStructure } from "@/lib/microform";

export interface ReferenceFormDrawerProps<TRow> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly sessionKey: number;
  readonly mode: "adición" | "modificación";
  readonly config: ReferenceMaintenanceConfig<TRow>;
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

function ReferenceFormSessionBody<TRow>({
  mode,
  config,
  draft,
  externalFailures,
  isSaving,
  submitTriggerRef,
  onDraftChange,
  onSubmitPayload,
  onNotifyBatchErrors,
  onCancelPending,
  onSalir,
  inline = false,
}: Omit<
  ReferenceFormDrawerProps<TRow>,
  "open" | "onOpenChange" | "sessionKey" | "estReg" | "onHideDrawer"
> & { readonly inline?: boolean }) {
  const isUpdate = mode === "modificación";

  const schema = React.useMemo(
    () =>
      createReferenceSchema({
        codeField: config.codeField,
        nomField: config.nomField,
        isUpdate,
      }),
    [config.codeField, config.nomField, isUpdate],
  );

  const structure = React.useMemo<AppStructure<string, FieldValues>>(
    () => [
      {
        fields: [
          ...(isUpdate
            ? [
                {
                  type: "text" as const,
                  name: config.codeField,
                  label: config.codeLabel,
                  placeholder: "Código inmutable",
                  readonly: true,
                  colspan: 12 as const,
                },
              ]
            : []),
          {
            type: "text",
            name: config.nomField,
            label: config.nomLabel,
            placeholder: `${MIN_NAME} a ${MAX_NAME} caracteres`,
            maxLength: MAX_NAME,
            colspan: 12,
          },
        ],
      },
    ],
    [
      config.codeField,
      config.codeLabel,
      config.nomField,
      config.nomLabel,
      isUpdate,
    ],
  );

  const [frozenDefaults] = React.useState<FieldValues>(() => ({
    ...createFormDefaults(schema),
    ...draft,
  }));

  const form = useForm<FieldValues>({
    resolver: zodResolver(schema),
    defaultValues: frozenDefaults,
  });

  const validateCleaned = React.useCallback(
    (cleaned: Record<string, unknown>) =>
      config.validatePayload(cleaned, isUpdate),
    [config, isUpdate],
  );

  const toFieldPath = React.useCallback((fieldName: string) => fieldName, []);

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

export function ReferenceInlineForm<TRow>({
  sessionKey,
  mode,
  config,
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
  ReferenceFormDrawerProps<TRow>,
  "open" | "onOpenChange" | "estReg" | "onHideDrawer"
>) {
  return (
    <ReferenceFormSessionBody
      key={`${mode}-${sessionKey}`}
      mode={mode}
      config={config}
      draft={draft}
      externalFailures={externalFailures}
      isSaving={isSaving}
      submitTriggerRef={submitTriggerRef}
      onDraftChange={onDraftChange}
      onSubmitPayload={onSubmitPayload}
      onNotifyBatchErrors={onNotifyBatchErrors}
      onCancelPending={onCancelPending}
      onSalir={onSalir}
      inline
    />
  );
}

/**
 * Bottom Drawer form built on AppStructForm for reference catalogs (Adición / Modificación).
 * Enforces R2/R8 readonly code during Modificación and R9 read-only EstReg display.
 */
export function ReferenceFormDrawer<TRow>({
  open,
  onOpenChange,
  sessionKey,
  mode,
  config,
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
}: ReferenceFormDrawerProps<TRow>) {
  const isUpdate = mode === "modificación";

  return (
    <MaintenanceFormDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      onHideDrawer={onHideDrawer}
      titleTestId="reference-form-title"
      title={
        isUpdate
          ? `Modificar ${config.singularLabel}`
          : `Adicionar ${config.singularLabel}`
      }
      description={
        isUpdate
          ? `${config.codeLabel} inmutable en modificación (R2).`
          : `Ingresa ${config.nomLabel} para crear un registro Activo. El código se asigna al guardar.`
      }
      estFieldLabel={config.estField}
      estReg={estReg}
      isUpdate={isUpdate}
      initialBreakpoint={0.75}
      breakpoints={[0, 0.55, 0.75, 0.92]}
    >
      {open && (
        <ReferenceFormSessionBody
          key={`${mode}-${sessionKey}`}
          mode={mode}
          config={config}
          draft={draft}
          externalFailures={externalFailures}
          isSaving={isSaving}
          submitTriggerRef={submitTriggerRef}
          onDraftChange={onDraftChange}
          onSubmitPayload={onSubmitPayload}
          onNotifyBatchErrors={onNotifyBatchErrors}
          onCancelPending={onCancelPending}
          onSalir={onSalir}
        />
      )}
    </MaintenanceFormDrawerShell>
  );
}
