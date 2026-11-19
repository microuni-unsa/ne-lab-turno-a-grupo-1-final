import { cn } from "cn";
import * as React from "react";
import { Button } from "@/components/ui/button";
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
      <DrawerContent initialBreakpoint={0.75} breakpoints={[0, 0.75, 0.9]}>
        <DrawerHeader className="px-0 pb-2">
          <DrawerTitle className="text-base font-semibold">
            Búsqueda avanzada · {tableLabel}
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex max-h-[52dvh] flex-col gap-3 overflow-y-auto overscroll-contain pb-2">
          <div className="flex flex-col gap-1">
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
              value={draft.codText}
              placeholder="Ej. PER"
              data-testid="adv-filter-cod"
              onChange={(event) => patchDraft({ codText: event.target.value })}
              className="min-h-10 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
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
              placeholder="Ej. Perú"
              data-testid="adv-filter-nom"
              onChange={(event) => patchDraft({ nomText: event.target.value })}
              className="min-h-10 text-sm"
            />
          </div>

          {visibleEstOptions.length > 0 && (
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
              <legend className="p-0 text-xs font-medium text-foreground">
                Estado de registro
              </legend>
              <div
                className={cn(
                  "grid gap-1.5",
                  visibleEstOptions.length === 1
                    ? "grid-cols-1"
                    : visibleEstOptions.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-3",
                )}
              >
                {visibleEstOptions.map((opt) => {
                  const isSelected = draft.estReg.includes(opt.value);
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      data-testid={`adv-est-${opt.value}`}
                      aria-pressed={isSelected}
                      onClick={() => toggleEstado(opt.value)}
                      className="min-h-10 w-full justify-center text-xs font-medium"
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {renderExtraFilters?.(draft, patchDraft)}
        </div>

        <DrawerFooter className="grid grid-cols-2 gap-2 px-0 pt-2">
          <Button
            type="button"
            variant="outline"
            data-testid="adv-btn-reset"
            onClick={handleReset}
            className="min-h-10 w-full text-xs font-semibold"
          >
            Limpiar filtros
          </Button>
          <Button
            type="button"
            variant="default"
            data-testid="adv-btn-apply"
            onClick={handleApply}
            className="min-h-10 w-full text-xs font-semibold"
          >
            Aplicar filtros
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
