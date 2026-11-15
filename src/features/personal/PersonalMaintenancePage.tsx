import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";
import {
  type GuardarResult,
  type PendingOp,
  type PersonalRow,
  TABLE_PERSONAL,
  validatePersonalRow,
} from "@/core";
import { PersonalRepo } from "@/data";
import { MaintenancePageScaffold } from "@/features/maintenance/components/MaintenancePageScaffold";
import { getLocalIsoDate } from "@/features/maintenance/use-maintenance-controller";
import type { RepoReader } from "@/features/maintenance/use-maintenance-list";
import { useMaintenanceScreen } from "@/features/maintenance/use-maintenance-screen";
import { PersonalAdvancedFilters } from "@/features/personal/components/PersonalAdvancedFilters";
import { PersonalFormDrawer } from "@/features/personal/components/PersonalFormDrawer";
import {
  createPersonalGselBindings,
  formatPersonalSubtitle,
  type PersonalCatalogRepos,
  personalRowToPayload,
  usePersonalCatalogLabels,
} from "@/features/personal/personal-structure";

export interface PersonalRepoContract extends RepoReader<PersonalRow> {
  guardarOp(op: PendingOp): Promise<GuardarResult<PersonalRow>>;
}

export interface PersonalMaintenancePageProps {
  readonly client?: SupabaseClient;
  readonly repo?: PersonalRepoContract;
  readonly catalogRepos?: PersonalCatalogRepos;
  readonly getTodayLocal?: () => string;
}

/**
 * Full Maintenance Screen for PERSONAL (`SPEC §5.3–§5.4`, `§8`, `§9`, `§11`, `R1`–`R22`).
 * Default ordering is `PerCod ASC` with toggle to `PerNom ASC, PerCod ASC`.
 */
export function PersonalMaintenancePage({
  client,
  repo: repoOverride,
  catalogRepos,
  getTodayLocal,
}: PersonalMaintenancePageProps) {
  const repo = React.useMemo(
    () => repoOverride ?? new PersonalRepo(client, getTodayLocal),
    [client, getTodayLocal, repoOverride],
  );

  const screen = useMaintenanceScreen({
    table: TABLE_PERSONAL,
    repo,
    defaultOrdering: "default",
    getRowCode: (row) => row.PerCod,
    getRowState: (row) => row.PerEstReg,
    rowToPayload: personalRowToPayload,
    validatePayload: (payload, isUpdate, todayLocal) =>
      validatePersonalRow(payload, { isUpdate, todayLocal }),
    getTodayLocal,
  });

  const gselBindings = React.useMemo(
    () => createPersonalGselBindings(screen.queryClient, catalogRepos, client),
    [catalogRepos, client, screen.queryClient],
  );

  const searchCatalogBindings = React.useMemo(
    () =>
      createPersonalGselBindings(screen.queryClient, catalogRepos, client, {
        includeAllStates: true,
      }),
    [catalogRepos, client, screen.queryClient],
  );

  const catalogLabels = usePersonalCatalogLabels(catalogRepos, client);
  const todayLocal = getTodayLocal ? getTodayLocal() : getLocalIsoDate();

  return (
    <MaintenancePageScaffold
      id="personal-maintenance-page"
      title="Personal"
      subtitle="Maestro PERSONAL · orden por código o nombre, DNI y edad ≥ 18"
      singularLabel="Personal"
      tableLabel="PERSONAL"
      searchPlaceholder="Buscar por nombre, DNI o código..."
      emptyMessage="No se encontró personal con los criterios actuales."
      screen={screen}
      getRowCode={(row) => row.PerCod}
      getRowTitle={(row) => row.PerNom}
      getRowSubtitle={(row) => formatPersonalSubtitle(row, catalogLabels)}
      getRowState={(row) => row.PerEstReg}
      renderFormDrawer={() =>
        screen.isFormPending ? (
          <PersonalFormDrawer
            open={screen.formDrawerOpen}
            onOpenChange={screen.setFormDrawerOpen}
            sessionKey={screen.formSessionKey}
            mode={screen.formMode}
            todayLocal={todayLocal}
            bindings={gselBindings}
            draft={screen.formDraft}
            onDraftChange={screen.setFormDraft}
            estReg={screen.drawerEstReg}
            externalFailures={screen.externalFailures}
            isSaving={screen.controller.isSaving}
            submitTriggerRef={screen.submitTriggerRef}
            onSubmitPayload={screen.handleSubmitPayload}
            onNotifyBatchErrors={(failures) =>
              screen.feedback.notifyBatchErrors(failures)
            }
            onCancelPending={screen.handleCancelPending}
            onHideDrawer={() => screen.setFormDrawerOpen(false)}
            onSalir={screen.handleSalir}
          />
        ) : null
      }
      renderExtraFilters={(draft, patchDraft) => (
        <PersonalAdvancedFilters
          draft={draft}
          patchDraft={patchDraft}
          bindings={searchCatalogBindings}
        />
      )}
    />
  );
}
