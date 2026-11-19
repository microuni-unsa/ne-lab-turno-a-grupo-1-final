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
  readonly ordering?: "default" | "alternate";
  readonly isCodeDefault?: boolean;
  readonly onToggleOrdering?: () => void;
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
  ordering = "default",
  isCodeDefault = false,
  onToggleOrdering,
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

  const isOrderedByCode = isCodeDefault
    ? ordering === "default"
    : ordering === "alternate";

  return (
    <section
      aria-label="Listado de registros"
      data-testid="record-list-view"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-xs text-muted-foreground">
        {onToggleOrdering ? (
          <fieldset
            aria-label="Ordenar por"
            className="m-0 flex items-center gap-2 border-0 p-0"
          >
            <span className="font-medium text-foreground">Ordenar por:</span>
            <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted">
              <input
                type="radio"
                name="record-sort-order"
                checked={isOrderedByCode}
                data-testid="btn-sort-code"
                onChange={() => {
                  if (!isOrderedByCode) {
                    onToggleOrdering();
                  }
                }}
                className="sr-only"
              />
              <span
                className={cn(
                  "flex size-3.5 items-center justify-center rounded-full border",
                  isOrderedByCode
                    ? "border-primary bg-primary/10"
                    : "border-muted-foreground/50",
                )}
              >
                {isOrderedByCode && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
              </span>
              <span>Código</span>
            </label>
            <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted">
              <input
                type="radio"
                name="record-sort-order"
                checked={!isOrderedByCode}
                data-testid="btn-sort-name"
                onChange={() => {
                  if (isOrderedByCode) {
                    onToggleOrdering();
                  }
                }}
                className="sr-only"
              />
              <span
                className={cn(
                  "flex size-3.5 items-center justify-center rounded-full border",
                  !isOrderedByCode
                    ? "border-primary bg-primary/10"
                    : "border-muted-foreground/50",
                )}
              >
                {!isOrderedByCode && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
              </span>
              <span>Nombre</span>
            </label>
            <span data-testid="active-ordering-label" className="sr-only">
              Orden activo: {orderingLabel}
            </span>
          </fieldset>
        ) : (
          <span data-testid="active-ordering-label" className="font-medium">
            Orden activo: {orderingLabel}
          </span>
        )}
        <span data-testid="list-total-summary" className="tabular-nums">
          {totalCount !== null
            ? `${totalCount} registro(s)`
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
        <div
          className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          data-testid="record-list-rows"
        >
          <div className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
            <span>Código</span>
            <span>Nombre / Descripción</span>
            <span className="text-right">Estado</span>
          </div>
          <div className="divide-y divide-border">
            {rows.map((row) => {
              const code = getRowCode(row);
              const title = getRowTitle(row);
              const subtitle = getRowSubtitle?.(row);
              const state = getRowState(row);
              const isSelected = selectedCode !== null && selectedCode === code;

              return (
                <button
                  key={code}
                  type="button"
                  data-testid={`record-row-${code}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectRow(row)}
                  className={cn(
                    "grid min-h-12 w-full grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "bg-amber-50/90 ring-1 ring-inset ring-amber-300"
                      : "hover:bg-muted/40",
                  )}
                >
                  <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                    {String(code).padStart(2, "0")}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="break-words text-sm font-medium leading-snug text-foreground">
                      {title}
                    </span>
                    {subtitle && (
                      <span className="line-clamp-2 break-words text-xs leading-snug tabular-nums text-muted-foreground">
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
