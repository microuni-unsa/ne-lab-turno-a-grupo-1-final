import {
  ArrowUpDownIcon,
  EraserIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchMode } from "@/features/maintenance/query-keys";

export interface SearchControlsBarProps {
  readonly simpleInput: string;
  readonly onSimpleInputChange: (nextValue: string) => void;
  readonly onSubmitSimpleSearch: (term: string) => void;
  readonly onClearSearch: () => void;
  readonly searchMode: SearchMode;
  readonly orderingLabel: string;
  readonly onToggleOrdering: () => void;
  readonly onOpenAdvanced: () => void;
  readonly searchPlaceholder?: string;
}

/**
 * Compact mobile search bar supporting simple contains search (§11.2),
 * ordering toggle (R18) and opening the advanced filter drawer (§11.3).
 */
export function SearchControlsBar({
  simpleInput,
  onSimpleInputChange,
  onSubmitSimpleSearch,
  onClearSearch,
  searchMode,
  orderingLabel,
  onToggleOrdering,
  onOpenAdvanced,
  searchPlaceholder = "Buscar por nombre...",
}: SearchControlsBarProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmitSimpleSearch(simpleInput);
  };

  return (
    <section
      aria-label="Controles de búsqueda y ordenamiento"
      data-testid="search-controls-bar"
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm"
    >
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            id="simple-search-input"
            name="simpleSearch"
            type="search"
            value={simpleInput}
            placeholder={searchPlaceholder}
            aria-label="Búsqueda simple"
            data-testid="input-simple-search"
            onChange={(event) => {
              const nextVal = event.target.value;
              onSimpleInputChange(nextVal);
              if (nextVal.trim().length === 0 && searchMode === "simple") {
                onClearSearch();
              }
            }}
          />
        </div>

        {simpleInput.trim().length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="btn-reset-simple-input"
            aria-label="Limpiar texto"
            onClick={() => {
              onSimpleInputChange("");
              if (searchMode === "simple") {
                onClearSearch();
              }
            }}
            className="min-h-11 min-w-11 shrink-0"
          >
            <XIcon className="size-4" />
          </Button>
        )}

        <Button
          type="button"
          variant="default"
          data-testid="btn-simple-search"
          onClick={() => onSubmitSimpleSearch(simpleInput)}
          className="min-h-11 shrink-0 gap-1.5 px-3"
        >
          <SearchIcon className="size-4 shrink-0" />
          <span>Buscar</span>
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="btn-toggle-ordering"
          onClick={onToggleOrdering}
          className="min-h-11 max-w-full flex-1 justify-start gap-1.5 px-2.5 text-xs"
        >
          <ArrowUpDownIcon className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">Orden: {orderingLabel}</span>
        </Button>

        <Button
          type="button"
          variant={searchMode === "advanced" ? "default" : "outline"}
          size="sm"
          data-testid="btn-open-advanced"
          onClick={onOpenAdvanced}
          className="min-h-11 shrink-0 gap-1.5 px-3 text-xs font-medium"
        >
          <SlidersHorizontalIcon className="size-3.5 shrink-0" />
          <span>Avanzada</span>
          {searchMode === "advanced" && (
            <Badge
              variant="secondary"
              className="ml-0.5 px-1.5 py-0 text-[10px]"
            >
              Activa
            </Badge>
          )}
        </Button>

        {searchMode !== "none" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="btn-clear-search"
            aria-label="Limpiar filtros activos"
            onClick={() => {
              onSimpleInputChange("");
              onClearSearch();
            }}
            className="min-h-11 shrink-0 gap-1 px-2.5 text-xs text-muted-foreground"
          >
            <EraserIcon className="size-3.5" />
            <span>Limpiar</span>
          </Button>
        )}
      </div>
    </section>
  );
}
