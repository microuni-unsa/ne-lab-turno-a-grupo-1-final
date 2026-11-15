import type * as React from "react";
import type { EstReg, TableName } from "@/core";
import { AdvancedSearchDrawer } from "@/features/maintenance/components/AdvancedSearchDrawer";
import { MaintenanceLayout } from "@/features/maintenance/components/MaintenanceLayout";
import { OperationsBar } from "@/features/maintenance/components/OperationsBar";
import { PendingFormBanner } from "@/features/maintenance/components/PendingFormBanner";
import { RecordListView } from "@/features/maintenance/components/RecordListView";
import { SearchControlsBar } from "@/features/maintenance/components/SearchControlsBar";
import { StateTransitionCard } from "@/features/maintenance/components/StateTransitionCard";
import type { AdvancedFilterDraft } from "@/features/maintenance/use-maintenance-list";
import {
  isStateTransitionOp,
  type useMaintenanceScreen,
} from "@/features/maintenance/use-maintenance-screen";

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
 * renders MaintenanceLayout with docked OperationsBar in IonFooter, sticky
 * PendingFormBanner / StateTransitionCard, SearchControlsBar, RecordListView,
 * AdvancedSearchDrawer, and the entity-specific FormDrawer slot.
 */
export function MaintenancePageScaffold<TTable extends TableName, TRow>({
  id,
  title,
  subtitle,
  singularLabel,
  tableLabel,
  searchPlaceholder,
  emptyMessage,
  screen,
  getRowCode,
  getRowTitle,
  getRowSubtitle,
  getRowState,
  renderFormDrawer,
  renderExtraFilters,
}: MaintenancePageScaffoldProps<TTable, TRow>) {
  const showStickyBanner =
    (screen.isFormPending && !screen.formDrawerOpen) ||
    (isStateTransitionOp(screen.pendingKind) &&
      screen.controller.selectedRow !== null);

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
          onReactivar={() => {
            screen.controller.startReactivar();
          }}
          onGuardar={() => {
            void screen.handleGuardarAction();
          }}
          onCancelar={screen.handleCancelPending}
          onBuscar={() => screen.setAdvancedOpen(true)}
          onSalir={screen.handleSalir}
        />
      }
    >
      <SearchControlsBar
        simpleInput={screen.simpleInput}
        onSimpleInputChange={screen.setSimpleInput}
        onSubmitSimpleSearch={(term) => screen.list.applySimpleSearch(term)}
        onClearSearch={() => {
          screen.setSimpleInput("");
          screen.list.clearSearch();
        }}
        searchMode={screen.list.searchMode}
        orderingLabel={screen.list.orderingLabel}
        onToggleOrdering={() => screen.list.toggleOrdering()}
        onOpenAdvanced={() => screen.setAdvancedOpen(true)}
        searchPlaceholder={searchPlaceholder}
      />

      {showStickyBanner && (
        <div className="sticky top-0 z-20 flex flex-col gap-2 bg-background py-1">
          {screen.isFormPending && !screen.formDrawerOpen && (
            <PendingFormBanner
              pendingKind={screen.pendingKind}
              onReopen={() => screen.setFormDrawerOpen(true)}
            />
          )}

          {isStateTransitionOp(screen.pendingKind) &&
            screen.controller.selectedRow && (
              <StateTransitionCard
                kind={screen.pendingKind}
                singularLabel={singularLabel}
                rowCode={getRowCode(screen.controller.selectedRow)}
                rowNom={getRowTitle(screen.controller.selectedRow)}
                currentState={getRowState(screen.controller.selectedRow)}
                isSaving={screen.controller.isSaving}
                onConfirmGuardar={() => {
                  void screen.controller.guardar();
                }}
                onCancelar={screen.handleCancelPending}
              />
            )}
        </div>
      )}

      <RecordListView
        rows={screen.list.rows}
        totalCount={screen.list.totalCount}
        isLoading={screen.list.isLoading}
        isFetching={screen.list.isFetching}
        isError={screen.list.isError}
        orderingLabel={screen.list.orderingLabel}
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
        emptyMessage={emptyMessage}
        onClearFilters={
          screen.list.searchMode !== "none"
            ? () => {
                screen.setSimpleInput("");
                screen.list.clearSearch();
              }
            : undefined
        }
      />

      {renderFormDrawer()}

      <AdvancedSearchDrawer
        open={screen.advancedOpen}
        onOpenChange={screen.setAdvancedOpen}
        filters={screen.list.advancedFilters}
        onApply={(next) => {
          screen.setSimpleInput("");
          screen.list.applyAdvancedSearch(next);
        }}
        onReset={() => {
          screen.setSimpleInput("");
          screen.list.clearSearch();
        }}
        tableLabel={tableLabel}
        renderExtraFilters={renderExtraFilters}
      />
    </MaintenanceLayout>
  );
}
