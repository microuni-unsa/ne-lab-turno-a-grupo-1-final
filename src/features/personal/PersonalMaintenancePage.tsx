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
import { EstadoBadge } from "@/features/maintenance/components/EstadoBadge";
import { MaintenancePageScaffold } from "@/features/maintenance/components/MaintenancePageScaffold";
import type { RecordListColumn } from "@/features/maintenance/components/RecordListView";
import { getLocalIsoDate } from "@/features/maintenance/use-maintenance-controller";
import type { RepoReader } from "@/features/maintenance/use-maintenance-list";
import { useMaintenanceScreen } from "@/features/maintenance/use-maintenance-screen";
import { PersonalAdvancedFilters } from "@/features/personal/components/PersonalAdvancedFilters";
import { PersonalInlineForm } from "@/features/personal/components/PersonalFormDrawer";
import {
  createPersonalGselBindings,
  formatCatalogRef,
  formatDisplayDate,
  formatPersonalDetailFields,
  type PersonalCatalogLabelMaps,
  type PersonalCatalogRepos,
  personalRowToPayload,
  usePersonalCatalogLabels,
} from "@/features/personal/personal-structure";

export function createPersonalListColumns(
  labels: PersonalCatalogLabelMaps,
): readonly RecordListColumn<PersonalRow>[] {
  return [
    {
      id: "PerCod",
      header: "Código",
      width: "max-content",
      renderCell: (row) => (
        <span className="block truncate whitespace-nowrap font-mono text-xs font-semibold text-foreground">
          {row.PerCod}
        </span>
      ),
    },
    {
      id: "PerNom",
      header: "Nombre",
      width: "minmax(max-content,1fr)",
      renderCell: (row) => (
        <span className="block truncate whitespace-nowrap text-xs font-medium text-foreground">
          {row.PerNom}
        </span>
      ),
    },
    {
      id: "PerDNI",
      header: "DNI",
      width: "max-content",
      renderCell: (row) => (
        <span className="block truncate whitespace-nowrap font-mono text-xs tabular-nums text-foreground">
          {row.PerDNI}
        </span>
      ),
    },
    {
      id: "PerFecNac",
      header: "Fec. Nac.",
      width: "max-content",
      renderCell: (row) => (
        <span className="block truncate whitespace-nowrap text-xs tabular-nums text-foreground">
          {formatDisplayDate(row.PerFecNac)}
        </span>
      ),
    },
    {
      id: "PerPaiCod",
      header: "País",
      width: "max-content",
      renderCell: (row) => (
        <span className="block truncate whitespace-nowrap text-xs text-foreground">
          {formatCatalogRef(row.PerPaiCod, labels.pai, "País")}
        </span>
      ),
    },
    {
      id: "PerDepCod",
      header: "Dependencia",
      width: "max-content",
      renderCell: (row) => (
        <span className="block truncate whitespace-nowrap text-xs text-foreground">
          {formatCatalogRef(row.PerDepCod, labels.dep, "Dep")}
        </span>
      ),
    },
    {
      id: "PerCarCod",
      header: "Cargo",
      width: "max-content",
      renderCell: (row) => (
        <span className="block truncate whitespace-nowrap text-xs text-foreground">
          {formatCatalogRef(row.PerCarCod, labels.car, "Cargo")}
        </span>
      ),
    },
    {
      id: "PerEstReg",
      header: "Estado",
      width: "max-content",
      renderCell: (row) => <EstadoBadge state={row.PerEstReg} compact />,
    },
  ];
}

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
  const columns = React.useMemo(
    () => createPersonalListColumns(catalogLabels),
    [catalogLabels],
  );
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
      columns={columns}
      getRowCode={(row) => row.PerCod}
      getRowTitle={(row) => row.PerNom}
      getRowState={(row) => row.PerEstReg}
      getDetailFields={(row) => formatPersonalDetailFields(row, catalogLabels)}
      renderFormDrawer={() =>
        screen.isFormPending ? (
          <PersonalInlineForm
            sessionKey={screen.formSessionKey}
            mode={screen.formMode}
            todayLocal={todayLocal}
            bindings={gselBindings}
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
