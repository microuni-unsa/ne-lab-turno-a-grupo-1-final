import { cn } from "cn";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { EST_A, EST_I, EST_X, type EstReg, type PendingOpKind } from "@/core";

export interface RecordDetailCardProps {
  readonly pendingKind?: PendingOpKind;
  readonly selectedCode: number | null;
  readonly selectedTitle: string | null;
  readonly selectedSubtitle?: string | null;
  readonly selectedState: EstReg | null;
  readonly codeLabel?: string;
  readonly nameLabel?: string;
  readonly renderInlineForm?: () => React.ReactNode;
}

const MODE_LABELS: Readonly<Record<PendingOpKind, string>> = {
  adición: "MODO ADICIÓN",
  modificación: "MODO MODIFICACIÓN",
  inactivar: "MODO INACTIVAR",
  reactivar: "MODO REACTIVAR",
  eliminación: "MODO ELIMINACIÓN",
};

const STATE_DISPLAY: Readonly<
  Record<EstReg, { readonly text: string; readonly className: string }>
> = {
  [EST_A]: {
    text: "A - Activo",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  [EST_I]: {
    text: "I - Inactivo",
    className: "border-amber-300 bg-amber-50 text-amber-900",
  },
  [EST_X]: {
    text: "* - Eliminado",
    className: "border-rose-300 bg-rose-50 text-rose-800",
  },
};

function getTargetStateForOp(
  pendingKind: PendingOpKind | undefined,
  currentState: EstReg | null,
): EstReg | null {
  switch (pendingKind) {
    case "adición":
      return EST_A;
    case "inactivar":
      return EST_I;
    case "reactivar":
      return EST_A;
    case "eliminación":
      return EST_X;
    case "modificación":
    case undefined:
      return currentState;
  }
}

/**
 * Always-visible inline "Datos del registro" card matching the approved
 * reference layout and keeping Consulta, Adición, Modificación, Inactivar,
 * Reactivar, and Eliminación on a single consistent surface.
 */
export function RecordDetailCard({
  pendingKind,
  selectedCode,
  selectedTitle,
  selectedSubtitle,
  selectedState,
  codeLabel = "Código",
  nameLabel = "Nombre / Descripción",
  renderInlineForm,
}: RecordDetailCardProps) {
  const isFormMode =
    pendingKind === "adición" || pendingKind === "modificación";
  const modeLabel = pendingKind ? MODE_LABELS[pendingKind] : "MODO CONSULTA";
  const nextState = getTargetStateForOp(pendingKind, selectedState);
  const currentMeta = selectedState ? STATE_DISPLAY[selectedState] : null;
  const nextMeta = nextState ? STATE_DISPLAY[nextState] : null;
  const isTransition =
    pendingKind === "inactivar" ||
    pendingKind === "reactivar" ||
    pendingKind === "eliminación";

  const formattedCode =
    selectedCode !== null ? String(selectedCode).padStart(2, "0") : "—";

  return (
    <section
      aria-label="Datos del registro"
      data-testid="record-detail-card"
      className="rounded-xl border border-border bg-card p-3 shadow-sm"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="m-0 text-xs font-semibold tracking-wide text-foreground">
          Datos del registro
        </h2>
        <Badge
          variant={pendingKind ? "default" : "secondary"}
          data-testid="record-mode-badge"
          className={cn(
            "px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
            !pendingKind && "bg-primary/10 text-primary border-primary/20",
          )}
        >
          {modeLabel}
        </Badge>
      </div>

      {isFormMode && renderInlineForm ? (
        <div className="flex flex-col gap-2">
          {nextMeta && (
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5 text-xs">
              <span className="font-medium text-muted-foreground">
                Estado de registro
              </span>
              <span
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                  nextMeta.className,
                )}
              >
                {nextMeta.text}
              </span>
            </div>
          )}
          {renderInlineForm()}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="flex min-w-20 flex-col gap-0.5 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5">
              <span className="text-[10px] font-medium text-muted-foreground">
                {codeLabel}
              </span>
              <span
                data-testid="detail-code-value"
                className="text-sm font-semibold tabular-nums text-foreground"
              >
                {formattedCode}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">
                Estado de registro
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {isTransition && currentMeta && nextMeta ? (
                  <span
                    data-testid="detail-state-value"
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                      nextMeta.className,
                    )}
                  >
                    {currentMeta.text} → {nextMeta.text}
                  </span>
                ) : currentMeta ? (
                  <span
                    data-testid="detail-state-value"
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                      currentMeta.className,
                    )}
                  >
                    {currentMeta.text}
                  </span>
                ) : (
                  <span
                    data-testid="detail-state-value"
                    className="text-xs text-muted-foreground"
                  >
                    Sin selección
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">
              {nameLabel}
            </span>
            <span
              data-testid="detail-name-value"
              className="text-sm font-medium text-foreground break-words"
            >
              {selectedTitle ?? "Seleccione un registro de la lista"}
            </span>
            {selectedSubtitle && (
              <span className="text-xs text-muted-foreground break-words">
                {selectedSubtitle}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
