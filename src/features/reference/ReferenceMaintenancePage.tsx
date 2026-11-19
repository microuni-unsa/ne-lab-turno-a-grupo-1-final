import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";
import { MaintenancePageScaffold } from "@/features/maintenance/components/MaintenancePageScaffold";
import { useMaintenanceScreen } from "@/features/maintenance/use-maintenance-screen";
import { ReferenceInlineForm } from "@/features/reference/components/ReferenceFormDrawer";
import type {
  ReferenceMaintenanceConfig,
  ReferenceRepoContract,
} from "@/features/reference/reference-config";

export interface ReferenceMaintenancePageProps<TRow> {
  readonly config: ReferenceMaintenanceConfig<TRow>;
  readonly client?: SupabaseClient;
  readonly repo?: ReferenceRepoContract<TRow>;
}

/**
 * Reusable Maintenance Screen for reference tables (PAIS, DEPENDENCIA, CARGO).
 * Driven declaratively by ReferenceMaintenanceConfig (OCP).
 */
export function ReferenceMaintenancePage<TRow>({
  config,
  client,
  repo: repoOverride,
}: ReferenceMaintenancePageProps<TRow>) {
  const repo = React.useMemo(
    () => repoOverride ?? config.createRepo(client),
    [client, config, repoOverride],
  );

  const screen = useMaintenanceScreen({
    table: config.table,
    repo,
    defaultOrdering: config.defaultOrdering ?? "default",
    getRowCode: config.getRowCode,
    getRowState: config.getRowState,
    rowToPayload: config.rowToPayload,
    validatePayload: (payload, isUpdate) =>
      config.validatePayload(payload, isUpdate),
  });

  return (
    <MaintenancePageScaffold
      id={config.id}
      title={config.title}
      subtitle={`Catálogo ${config.tableLabel} · estados A / I / *`}
      singularLabel={config.singularLabel}
      tableLabel={config.tableLabel}
      searchPlaceholder={config.searchPlaceholder}
      emptyMessage={config.emptyMessage}
      screen={screen}
      getRowCode={config.getRowCode}
      getRowTitle={config.getRowNom}
      getRowState={config.getRowState}
      getDetailFields={(row) => [
        {
          id: "readonly-detail-code",
          label: config.codeLabel,
          value: row ? config.getRowCode(row) : "",
          placeholder: "—",
          testId: "detail-code-value",
        },
        {
          id: "readonly-detail-name",
          label: config.nomLabel,
          value: row ? config.getRowNom(row) : "",
          placeholder: "Seleccione un registro de la lista",
          testId: "detail-name-value",
        },
      ]}
      renderFormDrawer={() =>
        screen.isFormPending ? (
          <ReferenceInlineForm
            sessionKey={screen.formSessionKey}
            mode={screen.formMode}
            config={config}
            draft={screen.formDraft}
            onDraftChange={screen.setFormDraft}
            externalFailures={screen.externalFailures}
            isSaving={screen.controller.isSaving}
            submitTriggerRef={screen.submitTriggerRef}
            onSubmitPayload={screen.handleSubmitPayload}
            onNotifyBatchErrors={(failures) =>
              screen.feedback.notifyBatchErrors(failures)
            }
            onCancelPending={screen.handleCancelPending}
            onSalir={screen.handleSalir}
          />
        ) : null
      }
    />
  );
}
