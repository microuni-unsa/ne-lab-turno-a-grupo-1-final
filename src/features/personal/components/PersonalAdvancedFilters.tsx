import { InferFieldInput } from "@microx-technologies/microform/react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DNI_LEN } from "@/core";
import type { AdvancedFilterDraft } from "@/features/maintenance/use-maintenance-list";
import type { GselBinding } from "@/features/personal/gsel-source";
import type { PersonalGselBindings } from "@/features/personal/personal-structure";
import { microform } from "@/lib/microform";

export interface PersonalAdvancedFiltersProps {
  readonly draft: AdvancedFilterDraft;
  readonly patchDraft: (patch: Partial<AdvancedFilterDraft>) => void;
  readonly bindings: PersonalGselBindings;
}

interface FkFilterItem {
  readonly fieldName: string;
  readonly label: string;
  readonly placeholder: string;
  readonly emptyMessage: string;
  readonly clearTestId: string;
  readonly value: string | undefined;
  readonly binding: Pick<GselBinding<unknown>, "asyncSource" | "resolveLabel">;
  readonly onChange: (nextVal: string | undefined) => void;
}

/**
 * PERSONAL-specific Advanced Search filters (`SPEC §11.3`) slotted declaratively into
 * AdvancedSearchDrawer: DNI prefix/exact, FecNac range (`from`/`to`), and clearable G-SEL FKs.
 */
export function PersonalAdvancedFilters({
  draft,
  patchDraft,
  bindings,
}: PersonalAdvancedFiltersProps) {
  const fkFilters: readonly FkFilterItem[] = [
    {
      fieldName: "advPaiCod",
      label: "País (G-SEL)",
      placeholder: "Cualquier país",
      emptyMessage: "Sin países activos",
      clearTestId: "adv-clear-pai",
      value: draft.paiCod,
      binding: bindings.pai,
      onChange: (paiCod) => patchDraft({ paiCod }),
    },
    {
      fieldName: "advDepCod",
      label: "Dependencia (G-SEL)",
      placeholder: "Cualquier dependencia",
      emptyMessage: "Sin dependencias activas",
      clearTestId: "adv-clear-dep",
      value: draft.depCod,
      binding: bindings.dep,
      onChange: (depCod) => patchDraft({ depCod }),
    },
    {
      fieldName: "advCarCod",
      label: "Cargo (G-SEL)",
      placeholder: "Cualquier cargo",
      emptyMessage: "Sin cargos activos",
      clearTestId: "adv-clear-car",
      value: draft.carCod,
      binding: bindings.car,
      onChange: (carCod) => patchDraft({ carCod }),
    },
  ];

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex flex-col gap-1">
        <Label
          htmlFor="adv-filter-dni"
          className="text-xs font-medium text-foreground"
        >
          DNI exacto o prefijo
        </Label>
        <Input
          id="adv-filter-dni"
          name="advDni"
          type="text"
          inputMode="numeric"
          maxLength={DNI_LEN}
          value={draft.dniText}
          placeholder="Ej. 7000"
          data-testid="adv-filter-dni"
          onChange={(event) => patchDraft({ dniText: event.target.value })}
          className="min-h-10 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="adv-filter-fec-from"
            className="text-xs font-medium text-foreground"
          >
            Nacimiento desde
          </Label>
          <Input
            id="adv-filter-fec-from"
            name="advFecNacFrom"
            type="date"
            value={draft.fecNacFrom}
            data-testid="adv-filter-fec-from"
            onChange={(event) => patchDraft({ fecNacFrom: event.target.value })}
            className="min-h-10 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label
            htmlFor="adv-filter-fec-to"
            className="text-xs font-medium text-foreground"
          >
            Nacimiento hasta
          </Label>
          <Input
            id="adv-filter-fec-to"
            name="advFecNacTo"
            type="date"
            value={draft.fecNacTo}
            data-testid="adv-filter-fec-to"
            onChange={(event) => patchDraft({ fecNacTo: event.target.value })}
            className="min-h-10 text-sm"
          />
        </div>
      </div>

      {fkFilters.map((fk) => (
        <div key={fk.fieldName} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor={fk.fieldName}
              className="text-xs font-medium text-foreground"
            >
              {fk.label}
            </Label>
            {fk.value !== undefined && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid={fk.clearTestId}
                onClick={() => fk.onChange(undefined)}
                className="min-h-8 gap-1 px-2 text-xs text-muted-foreground"
              >
                <XIcon className="size-3.5" />
                <span>Limpiar</span>
              </Button>
            )}
          </div>
          <InferFieldInput<string | undefined>
            type="async_combobox"
            name={fk.fieldName}
            value={fk.value}
            onChange={(nextVal: string | undefined) =>
              fk.onChange(
                typeof nextVal === "string" && nextVal.trim().length > 0
                  ? nextVal.trim()
                  : undefined,
              )
            }
            microform={microform}
            fieldProps={{
              label: fk.label,
              placeholder: fk.placeholder,
              asyncSource: fk.binding.asyncSource,
              resolveLabel: fk.binding.resolveLabel,
              valueType: "string",
              emptyMessage: fk.emptyMessage,
            }}
          />
        </div>
      ))}
    </div>
  );
}
