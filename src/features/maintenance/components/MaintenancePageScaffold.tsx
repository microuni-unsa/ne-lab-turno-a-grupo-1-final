import {
  EraserIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EstReg, TableName } from "@/core";
import { AdvancedSearchDrawer } from "@/features/maintenance/components/AdvancedSearchDrawer";
import { MaintenanceLayout } from "@/features/maintenance/components/MaintenanceLayout";
import { OperationsBar } from "@/features/maintenance/components/OperationsBar";
import {
  RecordDetailCard,
  type RecordDetailField,
} from "@/features/maintenance/components/RecordDetailCard";
import {
  type RecordListColumn,
  RecordListView,
} from "@/features/maintenance/components/RecordListView";
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
  readonly columns: readonly RecordListColumn<TRow>[];
  readonly getRowCode: (row: TRow) => string;
  readonly getRowTitle: (row: TRow) => string;
  readonly getRowState: (row: TRow) => EstReg;
  readonly getDetailFields?: (row: TRow | null) => readonly RecordDetailField[];
  readonly renderFormDrawer: () => React.ReactNode;
  readonly renderExtraFilters?: (
    draft: AdvancedFilterDraft,
    patchDraft: (patch: Partial<AdvancedFilterDraft>) => void,
  ) => React.ReactNode;
}

/**
 * Shared scaffold for Reference and Personal maintenance screens (DRY / OCP):
 * renders top simple search bar + Advanced Search button, inline RecordDetailCard
 * ("Datos del registro"), sortable/scoped RecordListView, AdvancedSearchDrawer,
 * SupervisorAuthDialog for * -> A, and fixed 4x2 OperationsBar in IonFooter.
 */
export function MaintenancePageScaffold<TTable extends TableName, TRow>({
  id,
  title,
  subtitle,
  tableLabel,
  searchPlaceholder,
  emptyMessage,
  screen,
  columns,
  getRowCode,
  getRowTitle,
  getRowState,
  getDetailFields,
  renderFormDrawer,
  renderExtraFilters,
}: MaintenancePageScaffoldProps<TTable, TRow>) {
  const selectedRow = screen.controller.selectedRow;

  const handleSimpleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    screen.list.applySimpleSearch(screen.simpleInput);
  };

  return (
    <MaintenanceLayout
      id={id}
      title={title}
      subtitle={subtitle}
      onSalir={screen.controller.salir}
      pendingLabel={screen.pendingKind ?? null}
      onRegisterScrollToTop={screen.registerScrollToTop}
      footer={
        <OperationsBar
          hasPending={screen.controller.hasPending}
          selectedState={screen.selectedState}
          isSaving={screen.controller.isSaving}
          onAdicionar={screen.handleStartAdicion}
          onModificar={screen.handleStartModificacion}
          onEliminar={screen.handleStartEliminar}
          onInactivar={screen.handleStartInactivar}
          onReactivar={screen.handleRequestReactivar}
          onGuardar={() => {
            void screen.handleGuardarAction();
          }}
          onCancelar={screen.handleCancelPending}
          onSalir={screen.handleSalir}
        />
      }
    >
      <div data-testid="top-search-bar" className="flex items-center gap-2">
        <form
          onSubmit={handleSimpleSubmit}
          className="relative flex min-w-0 flex-1 items-center gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <Input
              id="simple-search-input"
              name="simpleSearch"
              type="search"
              value={screen.simpleInput}
              placeholder={searchPlaceholder}
              aria-label="Búsqueda simple"
              data-testid="input-simple-search"
              disabled={screen.controller.hasPending}
              onChange={(event) => {
                const nextVal = event.target.value;
                screen.setSimpleInput(nextVal);
                if (
                  nextVal.trim().length === 0 &&
                  screen.list.searchMode === "simple"
                ) {
                  screen.list.clearSearch();
                }
              }}
              className="h-11 min-h-11 text-sm"
            />
          </div>

          {screen.simpleInput.trim().length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="btn-reset-simple-input"
              aria-label="Limpiar texto"
              onClick={() => {
                screen.setSimpleInput("");
                if (screen.list.searchMode === "simple") {
                  screen.list.clearSearch();
                }
              }}
              className="h-11 w-11 min-h-11 min-w-11 shrink-0"
            >
              <XIcon className="size-4" />
            </Button>
          )}

          <Button
            type="submit"
            variant="outline"
            size="icon"
            data-testid="btn-simple-search"
            aria-label="Buscar"
            disabled={screen.controller.hasPending}
            className="h-11 w-11 min-h-11 min-w-11 shrink-0"
          >
            <SearchIcon className="size-4" />
          </Button>
        </form>

        <Button
          type="button"
          variant={
            screen.list.searchMode === "advanced" ? "default" : "outline"
          }
          size="icon"
          data-testid="btn-open-advanced"
          aria-label="Búsqueda avanzada"
          disabled={screen.controller.hasPending}
          onClick={() => screen.setAdvancedOpen(true)}
          className="h-11 w-11 min-h-11 min-w-11 shrink-0"
        >
          <SlidersHorizontalIcon className="size-4" />
        </Button>
      </div>

      {screen.controller.isDetailVisible && (
        <RecordDetailCard
          pendingKind={screen.pendingKind}
          selectedCode={selectedRow ? getRowCode(selectedRow) : null}
          selectedTitle={selectedRow ? getRowTitle(selectedRow) : null}
          selectedState={selectedRow ? getRowState(selectedRow) : null}
          readonlyFields={
            getDetailFields ? getDetailFields(selectedRow) : undefined
          }
          renderInlineForm={renderFormDrawer}
        />
      )}

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
            className="h-8 min-h-8 gap-1 px-2 text-xs text-muted-foreground"
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
        sortColumn={screen.list.sortSpec.column}
        sortDirection={screen.list.sortSpec.direction}
        sortableColumns={screen.list.sortableColumns}
        onSortColumnChange={screen.list.setSortColumn}
        onToggleSortDirection={screen.list.toggleSortDirection}
        viewScope={screen.list.viewScope}
        onToggleViewScope={screen.handleToggleViewScope}
        hasPending={screen.controller.hasPending}
        selectedCode={screen.selectedCode}
        columns={columns}
        getRowCode={getRowCode}
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
        availableEstRegs={screen.list.availableEstRegs}
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
