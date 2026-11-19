import { EraserIcon } from "lucide-react";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type EstReg, TABLE_PERSONAL, type TableName } from "@/core";
import { AdvancedSearchDrawer } from "@/features/maintenance/components/AdvancedSearchDrawer";
import { MaintenanceLayout } from "@/features/maintenance/components/MaintenanceLayout";
import { OperationsBar } from "@/features/maintenance/components/OperationsBar";
import { RecordDetailCard } from "@/features/maintenance/components/RecordDetailCard";
import { RecordListView } from "@/features/maintenance/components/RecordListView";
import { SupervisorAuthDialog } from "@/features/maintenance/components/SupervisorAuthDialog";
import type { AdvancedFilterDraft } from "@/features/maintenance/use-maintenance-list";
import type { useMaintenanceScreen } from "@/features/maintenance/use-maintenance-screen";

export interface MaintenancePageScaffoldProps<TTable extends TableName, TRow> {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly singularLabel: string;
  readonly tableLabel: string;
  readonly searchPlaceholder: string;
  readonly emptyMessage: string;
  readonly screen: ReturnType<typeof useMaintenanceScreen<TTable, TRow>>;
  readonly getRowCode: (row: TRow) => number;
  readonly getRowTitle: (row: TRow) => string;
  readonly getRowSubtitle?: (row: TRow) => string | undefined;
  readonly getRowState: (row: TRow) => EstReg;
  readonly renderFormDrawer: () => React.ReactNode;
  readonly renderExtraFilters?: (
    draft: AdvancedFilterDraft,
    patchDraft: (patch: Partial<AdvancedFilterDraft>) => void,
  ) => React.ReactNode;
}

/**
 * Shared scaffold for Reference and Personal maintenance screens (DRY / OCP):
 * renders inline RecordDetailCard ("Datos del registro"), ordering/count + paged
 * RecordListView with column headers, Buscar-triggered AdvancedSearchDrawer,
 * SupervisorAuthDialog for * -> A, and fixed 3x3 OperationsBar in IonFooter.
 */
export function MaintenancePageScaffold<TTable extends TableName, TRow>({
  id,
  title,
  subtitle,
  tableLabel,
  emptyMessage,
  screen,
  getRowCode,
  getRowTitle,
  getRowSubtitle,
  getRowState,
  renderFormDrawer,
  renderExtraFilters,
}: MaintenancePageScaffoldProps<TTable, TRow>) {
  const selectedRow = screen.controller.selectedRow;
  const isCodeDefault =
    screen.table === TABLE_PERSONAL || screen.table === "PERSONAL";

  return (
    <MaintenanceLayout
      id={id}
      title={title}
      subtitle={subtitle}
      onSalir={screen.controller.salir}
      pendingLabel={screen.pendingKind ?? null}
      footer={
        <OperationsBar
          hasPending={screen.controller.hasPending}
          selectedState={screen.selectedState}
          isSaving={screen.controller.isSaving}
          searchOpen={screen.advancedOpen}
          onAdicionar={screen.handleStartAdicion}
          onModificar={screen.handleStartModificacion}
          onEliminar={() => {
            screen.controller.startEliminar();
          }}
          onInactivar={() => {
            screen.controller.startInactivar();
          }}
          onReactivar={screen.handleRequestReactivar}
          onGuardar={() => {
            void screen.handleGuardarAction();
          }}
          onCancelar={screen.handleCancelPending}
          onBuscar={() => screen.setAdvancedOpen(true)}
          onSalir={screen.handleSalir}
        />
      }
    >
      <RecordDetailCard
        pendingKind={screen.pendingKind}
        selectedCode={selectedRow ? getRowCode(selectedRow) : null}
        selectedTitle={selectedRow ? getRowTitle(selectedRow) : null}
        selectedSubtitle={
          selectedRow && getRowSubtitle
            ? getRowSubtitle(selectedRow)
            : undefined
        }
        selectedState={selectedRow ? getRowState(selectedRow) : null}
        renderInlineForm={renderFormDrawer}
      />

      {screen.list.searchMode !== "none" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs">
          <Badge variant="secondary" data-testid="active-search-badge">
            {screen.list.searchMode === "advanced"
              ? "Filtro avanzado activo"
              : `Buscando: "${screen.list.simpleTerm}"`}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="btn-clear-search"
            onClick={() => {
              screen.setSimpleInput("");
              screen.list.clearSearch();
            }}
            className="min-h-8 gap-1 px-2 text-xs text-muted-foreground"
          >
            <EraserIcon className="size-3.5" />
            <span>Limpiar</span>
          </Button>
        </div>
      )}

      <RecordListView
        rows={screen.list.rows}
        totalCount={screen.list.totalCount}
        isLoading={screen.list.isLoading}
        isFetching={screen.list.isFetching}
        isError={screen.list.isError}
        orderingLabel={screen.list.orderingLabel}
        ordering={screen.list.ordering}
        isCodeDefault={isCodeDefault}
        onToggleOrdering={() => screen.list.toggleOrdering()}
        selectedCode={screen.selectedCode}
        getRowCode={getRowCode}
        getRowTitle={getRowTitle}
        getRowSubtitle={getRowSubtitle}
        getRowState={getRowState}
        onSelectRow={(row) => screen.controller.selectRow(row)}
        offset={screen.list.offset}
        limit={screen.list.limit}
        pageIndex={screen.list.pageIndex}
        totalPages={screen.list.totalPages}
        hasPrevPage={screen.list.hasPrevPage}
        hasNextPage={screen.list.hasNextPage}
        onPrevPage={screen.list.prevPage}
        onNextPage={screen.list.nextPage}
        onRetry={() => {
          void screen.list.refetch();
        }}
        onClearFilters={
          screen.list.searchMode !== "none"
            ? () => {
                screen.setSimpleInput("");
                screen.list.clearSearch();
              }
            : undefined
        }
        emptyMessage={emptyMessage}
      />

      <AdvancedSearchDrawer
        open={screen.advancedOpen}
        onOpenChange={screen.setAdvancedOpen}
        tableLabel={tableLabel}
        filters={screen.list.advancedFilters}
        onApply={(filters) => {
          screen.setSimpleInput("");
          screen.list.applyAdvancedSearch(filters);
        }}
        onReset={() => {
          screen.setSimpleInput("");
          screen.list.clearSearch();
        }}
        renderExtraFilters={renderExtraFilters}
      />

      <SupervisorAuthDialog
        open={screen.supervisorDialogOpen}
        onOpenChange={screen.setSupervisorDialogOpen}
        recordLabel={selectedRow ? getRowTitle(selectedRow) : undefined}
        onAuthorize={screen.handleConfirmSupervisorReactivar}
      />
    </MaintenanceLayout>
  );
}
