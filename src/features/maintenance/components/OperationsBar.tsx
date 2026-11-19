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
        "rounded-xl border border-border bg-card p-2 shadow-sm",
        props.className,
      )}
    >
      <div className="grid grid-cols-4 gap-2">
        {OPERATIONS_GRID.map((op) => {
          const Icon = op.icon;
          const disabled = op.isDisabled ? op.isDisabled(props) : false;
          const isCommit = op.id === "guardar";
          const isDanger = op.id === "eliminar";

          return (
            <Button
              key={op.id}
              type="button"
              variant={
                disabled ? "secondary" : isCommit ? "default" : op.variant
              }
              disabled={disabled}
              data-testid={`op-${op.id}`}
              onClick={op.getHandler(props)}
              className={cn(
                "h-12 min-h-12 w-full flex-col items-center justify-center gap-1 px-1 py-1.5 text-xs leading-none font-semibold transition-colors",
                !disabled &&
                  isCommit &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                !disabled &&
                  isDanger &&
                  "border-destructive/35 bg-destructive/5 text-destructive hover:bg-destructive/10",
                !disabled &&
                  !isCommit &&
                  !isDanger &&
                  "border-border bg-card text-foreground hover:bg-accent",
                disabled &&
                  "border-transparent bg-muted/60 text-muted-foreground opacity-50",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{op.label}</span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
