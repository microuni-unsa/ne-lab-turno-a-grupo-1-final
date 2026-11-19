import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EST_A, EST_I, EST_X, type EstReg } from "@/core";
import type { AdvancedSearchFilters } from "@/data";
import {
  type AdvancedFilterDraft,
  ALL_ESTREG_STATES,
  advancedFiltersToDraft,
  draftToAdvancedFilters,
  EMPTY_ADVANCED_FILTER_DRAFT,
} from "@/features/maintenance/use-maintenance-list";

const ESTREG_OPTIONS: readonly {
  readonly value: EstReg;
  readonly symbol: "A" | "I" | "*";
  readonly label: string;
}[] = [
  { value: EST_A, symbol: "A", label: "Activo" },
  { value: EST_I, symbol: "I", label: "Inactivo" },
  { value: EST_X, symbol: "*", label: "Eliminado" },
];

export interface AdvancedSearchDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly filters: AdvancedSearchFilters;
  readonly availableEstRegs?: readonly EstReg[];
  readonly onApply: (filters: AdvancedSearchFilters) => void;
  readonly onReset: () => void;
  readonly tableLabel: string;
  readonly renderExtraFilters?: (
    draft: AdvancedFilterDraft,
    patchDraft: (patch: Partial<AdvancedFilterDraft>) => void,
  ) => React.ReactNode;
}

/**
 * Mobile bottom Drawer for SPEC §11.3 Advanced Search.
 * Shares Cod, Nom and available EstReg filters with an OCP slot for PERSONAL extra fields.
 */
export function AdvancedSearchDrawer({
  open,
  onOpenChange,
  filters,
  availableEstRegs = ALL_ESTREG_STATES,
  onApply,
  onReset,
  tableLabel,
  renderExtraFilters,
}: AdvancedSearchDrawerProps) {
  const [draft, setDraft] = React.useState<AdvancedFilterDraft>(() =>
    advancedFiltersToDraft(filters),
  );

  React.useEffect(() => {
    if (open) {
      setDraft(advancedFiltersToDraft(filters));
    }
  }, [open, filters]);

  const patchDraft = React.useCallback(
    (patch: Partial<AdvancedFilterDraft>) => {
      setDraft((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const visibleEstOptions = React.useMemo(
    () => ESTREG_OPTIONS.filter((opt) => availableEstRegs.includes(opt.value)),
    [availableEstRegs],
  );

  const toggleEstado = (state: EstReg) => {
    setDraft((prev) => {
      const nextSet = new Set(prev.estReg);
      if (nextSet.has(state)) {
        nextSet.delete(state);
      } else {
        nextSet.add(state);
      }
      const nextList = ALL_ESTREG_STATES.filter((item) => nextSet.has(item));
      return {
        ...prev,
        estReg: nextList,
      };
    });
  };

  const handleApply = () => {
    onApply(draftToAdvancedFilters(draft));
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraft(EMPTY_ADVANCED_FILTER_DRAFT);
    onReset();
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        initialBreakpoint={1}
        breakpoints={[0, 1]}
        autoHeight
        className="pt-4"
      >
        <DrawerHeader className="px-0 pb-4">
          <DrawerTitle>Búsqueda avanzada · {tableLabel}</DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col gap-4 overflow-visible pb-1">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="adv-filter-cod"
              className="text-xs font-medium text-foreground"
            >
              Código exacto
            </Label>
            <Input
              id="adv-filter-cod"
              name="advCod"
              type="text"
              inputMode="numeric"
              value={draft.codText}
              placeholder="Ej. 1"
              data-testid="adv-filter-cod"
              onChange={(event) => patchDraft({ codText: event.target.value })}
              className="h-11 min-h-11 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="adv-filter-nom"
              className="text-xs font-medium text-foreground"
            >
              Nombre contiene
            </Label>
            <Input
              id="adv-filter-nom"
              name="advNom"
              type="text"
              value={draft.nomText}
              placeholder="Ej. Ana"
              data-testid="adv-filter-nom"
              onChange={(event) => patchDraft({ nomText: event.target.value })}
              className="h-11 min-h-11 text-sm"
            />
          </div>

          {visibleEstOptions.length > 0 && (
            <fieldset className="m-0 flex flex-col border-0 p-0">
              <legend className="mb-2 p-0 text-xs font-medium text-foreground">
                Estado de registro
              </legend>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-1 py-1">
                {visibleEstOptions.map((opt) => {
                  const isSelected = draft.estReg.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={isSelected}
                      data-testid={`adv-est-${opt.value}`}
                      onClick={() => toggleEstado(opt.value)}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 active:bg-muted"
                    >
                      <Checkbox
                        checked={isSelected}
                        tabIndex={-1}
                        aria-hidden
                        className="pointer-events-none"
                      />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {renderExtraFilters?.(draft, patchDraft)}
        </div>

        <DrawerFooter className="grid grid-cols-2 gap-2 px-0 pt-4">
          <Button
            type="button"
            variant="outline"
            data-testid="adv-btn-reset"
            onClick={handleReset}
            className="h-11 min-h-11 w-full text-sm font-semibold"
          >
            Limpiar filtros
          </Button>
          <Button
            type="button"
            variant="default"
            data-testid="adv-btn-apply"
            onClick={handleApply}
            className="h-11 min-h-11 w-full text-sm font-semibold"
          >
            Aplicar filtros
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
