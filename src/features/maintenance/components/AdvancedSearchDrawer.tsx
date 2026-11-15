import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
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
  readonly label: string;
}[] = [
  { value: EST_A, label: "A · Activo" },
  { value: EST_I, label: "I · Inactivo" },
  { value: EST_X, label: "* · Eliminado" },
];

export interface AdvancedSearchDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly filters: AdvancedSearchFilters;
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
 * Shares Cod, Nom and EstReg ⊆ {A, I, *} filters with an OCP slot for PERSONAL extra fields.
 */
export function AdvancedSearchDrawer({
  open,
  onOpenChange,
  filters,
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

  const toggleEstado = (state: EstReg, checked: boolean) => {
    setDraft((prev) => {
      const nextSet = new Set(prev.estReg);
      if (checked) {
        nextSet.add(state);
      } else {
        nextSet.delete(state);
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
        <DrawerHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <DrawerTitle>Búsqueda avanzada · {tableLabel}</DrawerTitle>
              <DrawerDescription>
                Combina filtros opcionales (AND). Los campos vacíos se omiten.
              </DrawerDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              data-testid="adv-filter-close"
              className="min-h-11 shrink-0"
            >
              Cerrar
            </Button>
          </div>
        </DrawerHeader>

        <div className="flex max-h-[46dvh] flex-col gap-3.5 overflow-y-auto overscroll-contain px-4 pb-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-filter-cod">Código exacto</Label>
            <Input
              id="adv-filter-cod"
              name="advCod"
              type="text"
              inputMode="numeric"
              value={draft.codText}
              placeholder="Ej. 1"
              data-testid="adv-filter-cod"
              onChange={(event) => patchDraft({ codText: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-filter-nom">Nombre contiene</Label>
            <Input
              id="adv-filter-nom"
              name="advNom"
              type="text"
              value={draft.nomText}
              placeholder="Ej. Perú"
              data-testid="adv-filter-nom"
              onChange={(event) => patchDraft({ nomText: event.target.value })}
            />
          </div>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-sm font-medium text-foreground">
              Estado de registro (EstReg)
            </legend>
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-border p-2.5">
              {ESTREG_OPTIONS.map((opt) => {
                const isChecked = draft.estReg.includes(opt.value);
                return (
                  <div key={opt.value} className="flex items-center">
                    <Checkbox
                      id={`adv-est-${opt.value}`}
                      data-testid={`adv-est-${opt.value}`}
                      checked={isChecked}
                      onCheckedChange={(nextState) =>
                        toggleEstado(opt.value, nextState === true)
                      }
                      className="size-auto min-h-11 w-full justify-start"
                    >
                      <span className="text-sm font-medium">{opt.label}</span>
                    </Checkbox>
                  </div>
                );
              })}
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              Por defecto o sin selección específica se consultan los 3 estados
              (A, I y *).
            </p>
          </fieldset>

          {renderExtraFilters?.(draft, patchDraft)}
        </div>

        <DrawerFooter className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid="adv-btn-reset"
            onClick={handleReset}
            className="min-h-11 w-full"
          >
            Limpiar filtros
          </Button>
          <Button
            type="button"
            variant="default"
            data-testid="adv-btn-apply"
            onClick={handleApply}
            className="min-h-11 w-full"
          >
            Aplicar filtros
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
