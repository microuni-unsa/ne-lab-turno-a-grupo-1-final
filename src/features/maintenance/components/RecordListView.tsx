import { cn } from "cn";
import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
} from "lucide-react";
import * as React from "react";
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

const MIN_COLUMN_WIDTH_PX = 48;
const KEYBOARD_RESIZE_STEP_PX = 16;

export interface RecordListColumn<TRow> {
  readonly id: string;
  readonly header: string;
  readonly width?: string;
  readonly align?: "left" | "right";
  readonly renderCell: (row: TRow) => React.ReactNode;
}

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
  readonly selectedCode: number | null;
  readonly columns: readonly RecordListColumn<TRow>[];
  readonly getRowCode: (row: TRow) => number;
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
  columns,
  getRowCode,
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
  const [columnWidths, setColumnWidths] = React.useState<
    Readonly<Record<string, number>>
  >({});
  const headerRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const cleanupResizeRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    return () => {
      cleanupResizeRef.current?.();
    };
  }, []);

  const gridTemplateColumns = columns
    .map((col) => {
      const customWidth = columnWidths[col.id];
      if (customWidth !== undefined) {
        return `${customWidth}px`;
      }
      return col.width ?? "max-content";
    })
    .join(" ");

  const measureColumnWidth = (colId: string): number => {
    const existing = columnWidths[colId];
    if (existing !== undefined) {
      return existing;
    }
    const headerEl = headerRefs.current[colId];
    if (!headerEl) {
      return MIN_COLUMN_WIDTH_PX;
    }
    return Math.max(
      MIN_COLUMN_WIDTH_PX,
      Math.ceil(headerEl.getBoundingClientRect().width),
    );
  };

  const resetColumnWidth = (colId: string) => {
    setColumnWidths((prev) => {
      if (prev[colId] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[colId];
      return next;
    });
  };

  const handleResizePointerDown = (
    colId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    cleanupResizeRef.current?.();

    const startWidth = measureColumnWidth(colId);
    const startX = event.clientX;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = Math.max(
        MIN_COLUMN_WIDTH_PX,
        Math.round(startWidth + deltaX),
      );
      setColumnWidths((prev) => ({ ...prev, [colId]: nextWidth }));
    };

    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      cleanupResizeRef.current = null;
    };

    cleanupResizeRef.current = stopResize;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  };

  const handleResizeKeyDown = (
    colId: string,
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const nextWidth = Math.max(
        MIN_COLUMN_WIDTH_PX,
        measureColumnWidth(colId) - KEYBOARD_RESIZE_STEP_PX,
      );
      setColumnWidths((prev) => ({ ...prev, [colId]: nextWidth }));
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextWidth = measureColumnWidth(colId) + KEYBOARD_RESIZE_STEP_PX;
      setColumnWidths((prev) => ({ ...prev, [colId]: nextWidth }));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      resetColumnWidth(colId);
    }
  };

  return (
    <section
      aria-label="Listado de registros"
      data-testid="record-list-view"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-1.5 px-0.5 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          {sortableColumns.length > 0 && onSortColumnChange ? (
            <span className="text-xs font-medium text-foreground">
              Ordenar por
            </span>
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

        <div className="flex items-center justify-between gap-2">
          {sortableColumns.length > 0 && onSortColumnChange ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Select
                value={sortColumn ?? sortableColumns[0]?.column}
                onValueChange={onSortColumnChange}
              >
                <SelectTrigger
                  aria-label="Ordenar por columna"
                  data-testid="select-sort-column"
                  className="h-11 min-h-11 w-full max-w-40 bg-card text-xs font-medium text-foreground"
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
                  className="h-11 min-h-11 shrink-0 gap-1 px-2.5 text-xs font-medium text-foreground"
                >
                  {sortDirection === "asc" ? (
                    <ArrowUpIcon className="size-3.5" />
                  ) : (
                    <ArrowDownIcon className="size-3.5" />
                  )}
                  <span>{sortDirection === "asc" ? "ASC" : "DESC"}</span>
                </Button>
              )}
              <span data-testid="active-ordering-label" className="sr-only">
                Orden activo: {orderingLabel}
              </span>
            </div>
          ) : (
            <div />
          )}

          {onToggleViewScope && (
            <Button
              type="button"
              variant={isDeletedScope ? "default" : "outline"}
              size="sm"
              disabled={hasPending}
              data-testid="btn-toggle-deleted-scope"
              aria-pressed={isDeletedScope}
              onClick={onToggleViewScope}
              className="h-11 min-h-11 shrink-0 gap-1.5 px-2.5 text-xs font-medium"
            >
              <ArchiveIcon className="size-3.5 shrink-0" />
              <span>
                {isDeletedScope ? "Ver principales" : "Ver eliminados"}
              </span>
            </Button>
          )}
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
                className="h-11 min-h-11 gap-1.5"
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
                className="h-11 min-h-11"
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
          <div
            data-testid="record-list-grid"
            style={{ gridTemplateColumns }}
            className="grid w-max min-w-full"
          >
            <div className="col-span-full grid grid-cols-subgrid items-center border-b border-border bg-muted/40 py-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {columns.map((col) => (
                <div
                  key={col.id}
                  ref={(el) => {
                    headerRefs.current[col.id] = el;
                  }}
                  data-testid={`record-header-${col.id}`}
                  className={cn(
                    "relative flex min-w-0 items-center px-3",
                    col.align === "right" && "justify-end",
                  )}
                >
                  <span className="truncate whitespace-nowrap">
                    {col.header}
                  </span>
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label={`Redimensionar columna ${col.header}`}
                    aria-valuemin={MIN_COLUMN_WIDTH_PX}
                    aria-valuenow={columnWidths[col.id] ?? MIN_COLUMN_WIDTH_PX}
                    data-testid={`record-resize-${col.id}`}
                    onPointerDown={(event) =>
                      handleResizePointerDown(col.id, event)
                    }
                    onDoubleClick={() => resetColumnWidth(col.id)}
                    onKeyDown={(event) => handleResizeKeyDown(col.id, event)}
                    className="group/resize absolute top-0 right-0 bottom-0 flex w-2.5 translate-x-1/2 cursor-col-resize touch-none items-center justify-center focus-visible:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-px bg-muted-foreground/40 transition-colors group-hover/resize:w-0.5 group-hover/resize:bg-primary group-focus-visible/resize:w-0.5 group-focus-visible/resize:bg-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="col-span-full grid grid-cols-subgrid divide-y divide-border">
              {rows.map((row) => {
                const code = getRowCode(row);
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
                      "col-span-full grid min-h-11 w-full grid-cols-subgrid items-center py-2 text-left text-xs transition-colors",
                      isInactive &&
                        "bg-muted/25 text-muted-foreground opacity-65",
                      isSelected
                        ? "bg-accent ring-1 ring-inset ring-primary/40 opacity-100"
                        : "hover:bg-muted/40",
                    )}
                  >
                    {columns.map((col) => (
                      <div
                        key={col.id}
                        data-testid={`record-cell-${code}-${col.id}`}
                        className={cn(
                          "min-w-0 overflow-hidden px-3",
                          col.align === "right" && "flex justify-end",
                        )}
                      >
                        {col.renderCell(row)}
                      </div>
                    ))}
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
            className="h-11 min-h-11 gap-1 px-3"
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
            className="h-11 min-h-11 gap-1 px-3"
          >
            <span>Siguiente</span>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      )}
    </section>
  );
}
