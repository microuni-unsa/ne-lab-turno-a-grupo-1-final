import { cn } from "cn";
import {
  BanIcon,
  CheckIcon,
  LogOutIcon,
  PauseCircleIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { EST_A, EST_I, EST_X, type EstReg } from "@/core";

export interface OperationsBarProps {
  readonly hasPending: boolean;
  readonly selectedState?: EstReg | null;
  readonly isSaving?: boolean;
  readonly searchOpen?: boolean;
  readonly onAdicionar: () => void;
  readonly onModificar: () => void;
  readonly onEliminar: () => void;
  readonly onInactivar: () => void;
  readonly onReactivar: () => void;
  readonly onGuardar: () => void;
  readonly onCancelar: () => void;
  readonly onBuscar?: () => void;
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
    | "guardar"
    | "cancelar"
    | "salir";
  readonly label:
    | "Adicionar"
    | "Modificar"
    | "Eliminar"
    | "Inactivar"
    | "Reactivar"
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
    isDisabled: (props) => Boolean(props.isSaving) || props.hasPending,
  },
  {
    id: "modificar",
    label: "Modificar",
    variant: "outline",
    icon: PencilIcon,
    getHandler: (props) => props.onModificar,
    isDisabled: (props) =>
      Boolean(props.isSaving) ||
      props.hasPending ||
      props.selectedState !== EST_A,
  },
  {
    id: "eliminar",
    label: "Eliminar",
    variant: "outline",
    icon: Trash2Icon,
    getHandler: (props) => props.onEliminar,
    isDisabled: (props) =>
      Boolean(props.isSaving) ||
      props.hasPending ||
      props.selectedState === null ||
      props.selectedState === undefined ||
      props.selectedState === EST_X,
  },
  {
    id: "inactivar",
    label: "Inactivar",
    variant: "outline",
    icon: PauseCircleIcon,
    getHandler: (props) => props.onInactivar,
    isDisabled: (props) =>
      Boolean(props.isSaving) ||
      props.hasPending ||
      props.selectedState !== EST_A,
  },
  {
    id: "reactivar",
    label: "Reactivar",
    variant: "outline",
    icon: RotateCcwIcon,
    getHandler: (props) => props.onReactivar,
    isDisabled: (props) =>
      Boolean(props.isSaving) ||
      props.hasPending ||
      (props.selectedState !== EST_I && props.selectedState !== EST_X),
  },
  {
    id: "cancelar",
    label: "Cancelar",
    variant: "outline",
    icon: BanIcon,
    getHandler: (props) => props.onCancelar,
    isDisabled: (props) =>
      Boolean(props.isSaving) ||
      (!props.hasPending &&
        (props.selectedState === null || props.selectedState === undefined)),
  },
  {
    id: "guardar",
    label: "Guardar",
    variant: "outline",
    icon: CheckIcon,
    getHandler: (props) => props.onGuardar,
    isDisabled: (props) => Boolean(props.isSaving) || !props.hasPending,
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
 * Fixed 4x2 bottom operation dock for the 8 maintenance operations (Buscar lives in the top search bar).
 * Buttons dynamically enable/disable (gray out) according to selection and pending state.
 */
export function OperationsBar(props: OperationsBarProps) {
  return (
    <section
      aria-label="Operaciones de mantenimiento"
      data-testid="operations-bar"
      className={cn(
        "rounded-xl border border-border bg-card p-1.5 shadow-sm",
        props.className,
      )}
    >
      <div className="grid grid-cols-4 gap-1.5">
        {OPERATIONS_GRID.map((op) => {
          const Icon = op.icon;
          const disabled = op.isDisabled ? op.isDisabled(props) : false;

          return (
            <Button
              key={op.id}
              type="button"
              variant={disabled ? "secondary" : op.variant}
              disabled={disabled}
              data-testid={`op-${op.id}`}
              onClick={op.getHandler(props)}
              className={cn(
                "min-h-10 w-full justify-center gap-1 px-1.5 text-[11px] font-semibold transition-colors sm:text-xs",
                !disabled &&
                  "border-sky-200 bg-sky-50/90 text-sky-950 hover:bg-sky-100",
                disabled &&
                  "border-transparent bg-muted text-muted-foreground opacity-55",
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
