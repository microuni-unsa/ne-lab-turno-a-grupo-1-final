import { cn } from "cn";
import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EST_I, type EstReg } from "@/core";
import type { SortableColumnOption, SortDirection, ViewScope } from "@/data";
import { EstadoBadge } from "@/features/maintenance/components/EstadoBadge";

export interface RecordListViewProps<TRow> {
  readonly rows: readonly TRow[];
  readonly totalCount: number | null;
  readonly isLoading: boolean;
  readonly isFetching?: boolean;
  readonly isError?: boolean;
  readonly orderingLabel: string;
  readonly sortColumn?: string;
  readonly sortDirection?: SortDirection;
  readonly sortableColumns?: readonly SortableColumnOption[];
  readonly onSortColumnChange?: (column: string) => void;
  readonly onToggleSortDirection?: () => void;
  readonly viewScope?: ViewScope;
  readonly onToggleViewScope?: () => void;
  readonly hasPending?: boolean;
  readonly selectedCode: string | null;
  readonly getRowCode: (row: TRow) => string;
  readonly getRowTitle: (row: TRow) => string;
  readonly getRowSubtitle?: (row: TRow) => string | undefined;
  readonly getRowState: (row: TRow) => EstReg;
  readonly onSelectRow: (row: TRow) => void;
  readonly offset: number;
  readonly limit: number;
  readonly pageIndex: number;
  readonly totalPages: number | null;
  readonly hasPrevPage: boolean;
  readonly hasNextPage: boolean;
  readonly onPrevPage: () => void;
  readonly onNextPage: () => void;
  readonly onRetry?: () => void;
  readonly onClearFilters?: () => void;
  readonly emptyMessage?: string;
}

/**
 * Touch-friendly paged record table (50 rows per page) with all-column ASC/DESC sorting,
 * main/deleted view toggle, horizontal overflow scrolling, and plain state display.
 */
export function RecordListView<TRow>({
  rows,
  totalCount,
  isLoading,
  isFetching = false,
  isError = false,
  orderingLabel,
  sortColumn,
  sortDirection = "asc",
  sortableColumns = [],
  onSortColumnChange,
  onToggleSortDirection,
  viewScope = "main",
  onToggleViewScope,
  hasPending = false,
  selectedCode,
  getRowCode,
  getRowTitle,
  getRowSubtitle,
  getRowState,
  onSelectRow,
  offset,
  limit,
  pageIndex,
  totalPages,
  hasPrevPage,
  hasNextPage,
  onPrevPage,
  onNextPage,
  onRetry,
  onClearFilters,
  emptyMessage = "No se encontraron registros con los criterios actuales.",
}: RecordListViewProps<TRow>) {
  const showPaging = hasPrevPage || hasNextPage || (totalCount ?? 0) > limit;
  const isDeletedScope = viewScope === "deleted";

  return (
    <section
      aria-label="Listado de registros"
      data-testid="record-list-view"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-2 px-0.5 text-xs text-muted-foreground">
        <div className="flex items-end justify-between gap-2">
          {sortableColumns.length > 0 && onSortColumnChange ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                Ordenar por
              </span>
              <div className="flex items-center gap-1.5">
                <Select
                  value={sortColumn ?? sortableColumns[0]?.column}
                  onValueChange={onSortColumnChange}
                >
                  <SelectTrigger
                    aria-label="Ordenar por columna"
                    data-testid="select-sort-column"
                    className="h-9 min-h-9 w-full max-w-44 bg-card text-xs font-medium text-foreground"
                  >
                    <SelectValue placeholder="Columna" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortableColumns.map((col) => (
                      <SelectItem
                        key={col.column}
                        value={col.column}
                        data-testid={`sort-option-${col.column}`}
                      >
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {onToggleSortDirection && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="btn-toggle-sort-dir"
                    aria-label={
                      sortDirection === "asc"
                        ? "Orden ascendente"
                        : "Orden descendente"
                    }
                    onClick={onToggleSortDirection}
                    className="h-9 min-h-9 shrink-0 gap-1 px-2.5 text-xs font-medium text-foreground"
                  >
                    {sortDirection === "asc" ? (
                      <ArrowUpIcon className="size-3.5" />
                    ) : (
                      <ArrowDownIcon className="size-3.5" />
                    )}
                    <span>{sortDirection === "asc" ? "ASC" : "DESC"}</span>
                  </Button>
                )}
              </div>
              <span data-testid="active-ordering-label" className="sr-only">
                Orden activo: {orderingLabel}
              </span>
            </div>
          ) : (
            <span data-testid="active-ordering-label" className="font-medium">
              Orden activo: {orderingLabel}
            </span>
          )}

          <div className="flex shrink-0 flex-col items-end gap-1">
            {onToggleViewScope && (
              <Button
                type="button"
                variant={isDeletedScope ? "default" : "outline"}
                size="sm"
                disabled={hasPending}
                data-testid="btn-toggle-deleted-scope"
                aria-pressed={isDeletedScope}
                onClick={onToggleViewScope}
                className="h-9 min-h-9 gap-1.5 px-2.5 text-xs font-medium"
              >
                <ArchiveIcon className="size-3.5 shrink-0" />
                <span>
                  {isDeletedScope ? "Ver principales" : "Ver eliminados"}
                </span>
              </Button>
            )}
            <span data-testid="list-total-summary" className="tabular-nums">
              {totalCount !== null
                ? `${totalCount} registro(s)`
                : `${rows.length} visibles`}
              {isFetching && !isLoading ? " · actualizando..." : ""}
            </span>
          </div>
        </div>
      </div>

      {isError ? (
        <Card data-testid="list-error-state" className="border-destructive/50">
          <CardContent className="flex flex-col items-start gap-2 pt-4 text-sm text-destructive">
            <p className="m-0">
              No se pudo consultar los registros desde el servidor. Verifique su
              conexión de red.
            </p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="min-h-10 gap-1.5"
              >
                <RefreshCwIcon className="size-3.5" />
                <span>Reintentar</span>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card data-testid="list-loading-state">
          <CardContent className="flex flex-col gap-2.5 pt-4 text-sm text-muted-foreground">
            <span>Cargando registros...</span>
            <div className="flex flex-col gap-2" aria-hidden="true">
              <div className="h-11 w-full animate-pulse rounded-md bg-muted/60" />
              <div className="h-11 w-full animate-pulse rounded-md bg-muted/50" />
              <div className="h-11 w-full animate-pulse rounded-md bg-muted/40" />
            </div>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card data-testid="empty-list-state">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4 text-sm text-muted-foreground">
            <span>
              {isDeletedScope ? "No hay registros eliminados." : emptyMessage}
            </span>
            {onClearFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="min-h-10"
              >
                Limpiar búsqueda
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"
          data-testid="record-list-rows"
        >
          <div className="min-w-[20rem]">
            <div className="grid grid-cols-[4.5rem_minmax(10rem,1fr)_5rem] items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              <span>Código</span>
              <span>Nombre</span>
              <span className="text-right">Estado</span>
            </div>
            <div className="divide-y divide-border">
              {rows.map((row) => {
                const code = getRowCode(row);
                const title = getRowTitle(row);
                const subtitle = getRowSubtitle?.(row);
                const state = getRowState(row);
                const isInactive = state === EST_I;
                const isSelected =
                  selectedCode !== null && selectedCode === code;

                return (
                  <button
                    key={code}
                    type="button"
                    data-testid={`record-row-${code}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelectRow(row)}
                    className={cn(
                      "grid min-h-11 w-full grid-cols-[4.5rem_minmax(10rem,1fr)_5rem] items-center gap-2 px-3 py-2 text-left transition-colors",
                      isInactive &&
                        "bg-muted/25 text-muted-foreground opacity-65",
                      isSelected
                        ? "bg-amber-50/90 ring-1 ring-inset ring-amber-300 opacity-100"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <span className="truncate font-mono text-xs font-semibold text-foreground">
                      {code}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="break-words text-sm font-medium leading-snug text-foreground">
                        {title}
                      </span>
                      {subtitle && (
                        <span className="line-clamp-2 break-words text-xs leading-snug text-muted-foreground">
                          {subtitle}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <EstadoBadge state={state} compact />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showPaging && (
        <div
          data-testid="list-pagination-bar"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasPrevPage}
            data-testid="btn-page-prev"
            onClick={onPrevPage}
            className="min-h-10 gap-1 px-3"
          >
            <ChevronLeftIcon className="size-4" />
            <span>Anterior</span>
          </Button>

          <span className="text-xs font-medium text-muted-foreground">
            Pág. {pageIndex + 1}
            {totalPages !== null ? ` / ${totalPages}` : ""}
            {rows.length > 0 ? ` (${offset + 1}–${offset + rows.length})` : ""}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            data-testid="btn-page-next"
            onClick={onNextPage}
            className="min-h-10 gap-1 px-3"
          >
            <span>Siguiente</span>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      )}
    </section>
  );
}
