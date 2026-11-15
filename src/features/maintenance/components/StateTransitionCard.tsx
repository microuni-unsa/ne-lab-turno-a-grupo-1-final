import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EST_A, EST_I, EST_X, type EstReg } from "@/core";
import { EstadoBadge } from "@/features/maintenance/components/EstadoBadge";
import type { StateTransitionOpKind } from "@/features/maintenance/use-maintenance-screen";

export type { StateTransitionOpKind };

export interface StateTransitionCardProps {
  readonly kind: StateTransitionOpKind;
  readonly singularLabel: string;
  readonly rowCode: number;
  readonly rowNom: string;
  readonly currentState: EstReg;
  readonly isSaving: boolean;
  readonly onConfirmGuardar: () => void;
  readonly onCancelar: () => void;
}

const TARGET_STATE_MAP: Record<StateTransitionOpKind, EstReg> = {
  inactivar: EST_I,
  reactivar: EST_A,
  eliminación: EST_X,
};

const TITLE_MAP: Record<StateTransitionOpKind, string> = {
  inactivar: "Confirmar Inactivación",
  reactivar: "Confirmar Reactivación",
  eliminación: "Confirmar Eliminación Lógica (*)",
};

/**
 * Inline confirmation card for Inactivar, Reactivar and Eliminación (§8.3).
 * Keeps zero editable fields and leaves bottom OperationsBar directly clickable.
 */
export function StateTransitionCard({
  kind,
  singularLabel,
  rowCode,
  rowNom,
  currentState,
  isSaving,
  onConfirmGuardar,
  onCancelar,
}: StateTransitionCardProps) {
  const targetState = TARGET_STATE_MAP[kind];
  const isEliminacion = kind === "eliminación";

  return (
    <Card
      data-testid="state-op-confirm-card"
      className={
        isEliminacion
          ? "border-destructive/60 bg-destructive/5"
          : "border-primary/40 bg-primary/5"
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {isEliminacion && (
            <AlertTriangleIcon className="size-4 shrink-0 text-destructive" />
          )}
          <span>{TITLE_MAP[kind]}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {singularLabel} seleccionado
          </span>
          <span
            className="font-semibold text-foreground"
            data-testid="state-op-target-row"
          >
            #{rowCode} · {rowNom}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Transición de estado:</span>
          <EstadoBadge state={currentState} />
          <ArrowRightIcon className="size-3.5 text-muted-foreground" />
          <EstadoBadge state={targetState} />
        </div>

        <p className="m-0 text-xs text-muted-foreground">
          {isEliminacion
            ? "La eliminación lógica marca el registro como * (terminal) y será bloqueada si existe Personal activo o inactivo asociado (R11). Pulsa Guardar para aplicar o Cancelar para descartar."
            : "Pulsa Guardar aquí o en la barra inferior para confirmar el cambio de estado, o Cancelar para mantener el estado actual."}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={isEliminacion ? "destructive" : "default"}
            disabled={isSaving}
            onClick={onConfirmGuardar}
            data-testid="state-confirm-guardar"
            className="min-h-11 gap-1.5"
          >
            <CheckIcon className="size-4 shrink-0" />
            <span>{isSaving ? "Guardando..." : "Guardar cambio"}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onCancelar}
            data-testid="state-confirm-cancelar"
            className="min-h-11 gap-1.5"
          >
            <XIcon className="size-4 shrink-0" />
            <span>Cancelar</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
