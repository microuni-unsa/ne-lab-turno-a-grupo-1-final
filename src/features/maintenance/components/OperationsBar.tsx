import { cn } from "cn";
import {
  BanIcon,
  CheckIcon,
  LogOutIcon,
  PauseCircleIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";

export interface OperationsBarProps {
  readonly hasPending: boolean;
  readonly isSaving?: boolean;
  readonly searchOpen?: boolean;
  readonly onAdicionar: () => void;
  readonly onModificar: () => void;
  readonly onEliminar: () => void;
  readonly onInactivar: () => void;
  readonly onReactivar: () => void;
  readonly onGuardar: () => void;
  readonly onCancelar: () => void;
  readonly onBuscar: () => void;
  readonly onSalir: () => void;
  readonly className?: string;
}

interface OperationButtonSpec {
  readonly id:
    | "adicionar"
    | "modificar"
    | "eliminar"
    | "inactivar"
    | "reactivar"
    | "buscar"
    | "guardar"
    | "cancelar"
    | "salir";
  readonly label:
    | "Adicionar"
    | "Modificar"
    | "Eliminar"
    | "Inactivar"
    | "Reactivar"
    | "Buscar"
    | "Guardar"
    | "Cancelar"
    | "Salir";
  readonly variant: "default" | "outline" | "secondary" | "destructive";
  readonly icon: React.ComponentType<{ readonly className?: string }>;
  readonly getHandler: (props: OperationsBarProps) => () => void;
  readonly isDisabled?: (props: OperationsBarProps) => boolean;
}

const OPERATIONS_GRID: readonly OperationButtonSpec[] = [
  {
    id: "adicionar",
    label: "Adicionar",
    variant: "outline",
    icon: PlusIcon,
    getHandler: (props) => props.onAdicionar,
  },
  {
    id: "modificar",
    label: "Modificar",
    variant: "outline",
    icon: PencilIcon,
    getHandler: (props) => props.onModificar,
  },
  {
    id: "eliminar",
    label: "Eliminar",
    variant: "destructive",
    icon: Trash2Icon,
    getHandler: (props) => props.onEliminar,
  },
  {
    id: "inactivar",
    label: "Inactivar",
    variant: "outline",
    icon: PauseCircleIcon,
    getHandler: (props) => props.onInactivar,
  },
  {
    id: "reactivar",
    label: "Reactivar",
    variant: "outline",
    icon: RotateCcwIcon,
    getHandler: (props) => props.onReactivar,
  },
  {
    id: "buscar",
    label: "Buscar",
    variant: "outline",
    icon: SearchIcon,
    getHandler: (props) => props.onBuscar,
  },
  {
    id: "guardar",
    label: "Guardar",
    variant: "default",
    icon: CheckIcon,
    getHandler: (props) => props.onGuardar,
    isDisabled: (props) => Boolean(props.isSaving),
  },
  {
    id: "cancelar",
    label: "Cancelar",
    variant: "secondary",
    icon: BanIcon,
    getHandler: (props) => props.onCancelar,
    isDisabled: (props) => Boolean(props.isSaving),
  },
  {
    id: "salir",
    label: "Salir",
    variant: "outline",
    icon: LogOutIcon,
    getHandler: (props) => props.onSalir,
    isDisabled: (props) => Boolean(props.isSaving),
  },
];

/**
 * Compact 3x3 mobile operation dock preserving the 9 exact lab labels (PRODUCT.md / SPEC §8).
 * Starting a second operation while pending stays enabled so controller fires E-PENDING as specified.
 */
export function OperationsBar(props: OperationsBarProps) {
  return (
    <section
      aria-label="Operaciones de mantenimiento"
      data-testid="operations-bar"
      className={cn(
        "rounded-xl border border-border bg-card p-2.5 shadow-sm",
        props.className,
      )}
    >
      <div className="grid grid-cols-3 gap-2">
        {OPERATIONS_GRID.map((op) => {
          const Icon = op.icon;
          const activeVariant =
            op.id === "buscar" && props.searchOpen ? "default" : op.variant;
          const disabled = op.isDisabled ? op.isDisabled(props) : false;

          return (
            <Button
              key={op.id}
              type="button"
              variant={activeVariant}
              disabled={disabled}
              data-testid={`op-${op.id}`}
              aria-pressed={op.id === "buscar" ? props.searchOpen : undefined}
              onClick={op.getHandler(props)}
              className={cn(
                "min-h-11 w-full justify-center gap-1.5 px-2 text-xs font-semibold sm:text-sm",
                op.id === "guardar" &&
                  props.hasPending &&
                  "ring-2 ring-primary/35",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{op.label}</span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
