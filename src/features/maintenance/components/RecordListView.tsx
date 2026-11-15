import { cn } from "cn";
import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { EstReg } from "@/core";
import { EstadoBadge } from "@/features/maintenance/components/EstadoBadge";

export interface RecordListViewProps<TRow> {
  readonly rows: readonly TRow[];
  readonly totalCount: number | null;
  readonly isLoading: boolean;
  readonly isFetching?: boolean;
  readonly isError?: boolean;
  readonly orderingLabel: string;
  readonly selectedCode: number | null;
  readonly getRowCode: (row: TRow) => number;
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
 * Touch-friendly paged Card list (50 rows per page) preserving row selection across filters (R18-R21).
 */
export function RecordListView<TRow>({
  rows,
  totalCount,
  isLoading,
  isFetching = false,
  isError = false,
  orderingLabel,
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

  return (
    <section
      aria-label="Listado de registros"
      data-testid="record-list-view"
      className="flex flex-col gap-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span data-testid="active-ordering-label" className="font-medium">
          Orden activo: {orderingLabel}
        </span>
        <span data-testid="list-total-summary">
          {totalCount !== null
            ? `${totalCount} registros`
            : `${rows.length} visibles`}
          {isFetching && !isLoading ? " · actualizando..." : ""}
        </span>
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
                className="min-h-11 gap-1.5"
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
              <div className="h-12 w-full animate-pulse rounded-md bg-muted/60" />
              <div className="h-12 w-full animate-pulse rounded-md bg-muted/50" />
              <div className="h-12 w-full animate-pulse rounded-md bg-muted/40" />
            </div>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card data-testid="empty-list-state">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4 text-sm text-muted-foreground">
            <span>{emptyMessage}</span>
            {onClearFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="min-h-11"
              >
                Limpiar búsqueda
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2" data-testid="record-list-rows">
          {rows.map((row) => {
            const code = getRowCode(row);
            const title = getRowTitle(row);
            const subtitle = getRowSubtitle?.(row);
            const state = getRowState(row);
            const isSelected = selectedCode !== null && selectedCode === code;

            return (
              <Card
                key={code}
                className={cn(
                  "overflow-hidden py-0 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "hover:border-muted-foreground/40",
                )}
              >
                <button
                  type="button"
                  data-testid={`record-row-${code}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectRow(row)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-foreground">
                        #{code}
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">
                        {title}
                      </span>
                    </div>
                    {subtitle && (
                      <span className="line-clamp-2 break-words text-xs leading-snug tabular-nums text-muted-foreground">
                        {subtitle}
                      </span>
                    )}
                  </div>

                  <EstadoBadge state={state} className="shrink-0" />
                </button>
              </Card>
            );
          })}
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
            className="min-h-11 gap-1 px-3"
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
            className="min-h-11 gap-1 px-3"
          >
            <span>Siguiente</span>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      )}
    </section>
  );
}
