import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { EST_A, EST_I, EST_X, type EstReg, type PendingOpKind } from "@/core";

export interface RecordDetailField {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly testId?: string;
}

export interface RecordDetailCardProps {
  readonly pendingKind?: PendingOpKind;
  readonly selectedCode: string | null;
  readonly selectedTitle: string | null;
  readonly selectedSubtitle?: string | null;
  readonly selectedState: EstReg | null;
  readonly codeLabel?: string;
  readonly nameLabel?: string;
  readonly readonlyFields?: readonly RecordDetailField[];
  readonly renderInlineForm?: () => React.ReactNode;
}

const MODE_LABELS: Readonly<Record<PendingOpKind, string>> = {
  adición: "MODO ADICIÓN",
  modificación: "MODO MODIFICACIÓN",
  inactivar: "MODO INACTIVAR",
  reactivar: "MODO REACTIVAR",
  eliminación: "MODO ELIMINACIÓN",
};

const STATE_PLAIN_LABELS: Readonly<Record<EstReg, string>> = {
  [EST_A]: "Activo",
  [EST_I]: "Inactivado",
  [EST_X]: "Eliminado",
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
 * Inline "Datos del registro" card rendered only during a pending
 * create/edit (or state op) or while a tapped row keeps it visible.
 */
export function RecordDetailCard({
  pendingKind,
  selectedCode,
  selectedTitle,
  selectedSubtitle,
  selectedState,
  codeLabel = "Código",
  nameLabel = "Nombre",
  readonlyFields,
  renderInlineForm,
}: RecordDetailCardProps) {
  const isFormMode =
    pendingKind === "adición" || pendingKind === "modificación";
  const modeLabel = pendingKind ? MODE_LABELS[pendingKind] : "MODO CONSULTA";
  const nextState = getTargetStateForOp(pendingKind, selectedState);
  const currentStateText = selectedState
    ? STATE_PLAIN_LABELS[selectedState]
    : null;
  const nextStateText = nextState ? STATE_PLAIN_LABELS[nextState] : null;
  const isTransition =
    pendingKind === "inactivar" ||
    pendingKind === "reactivar" ||
    pendingKind === "eliminación";

  const stateDisplayText =
    isTransition && currentStateText && nextStateText
      ? `${currentStateText} → ${nextStateText}`
      : (currentStateText ?? "Sin selección");

  const fieldsToRender: readonly RecordDetailField[] = readonlyFields ?? [
    {
      id: "readonly-detail-code",
      label: codeLabel,
      value: selectedCode ?? "",
      placeholder: "—",
      testId: "detail-code-value",
    },
    {
      id: "readonly-detail-name",
      label: nameLabel,
      value: selectedTitle ?? "",
      placeholder: "Seleccione un registro de la lista",
      testId: "detail-name-value",
    },
  ];

  return (
    <section
      aria-label="Datos del registro"
      data-testid="record-detail-card"
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold text-foreground">
          Datos del registro
        </h2>
        <Badge
          variant="secondary"
          data-testid="record-mode-badge"
          className="border border-border bg-muted px-2.5 py-0.5 text-xs font-bold tracking-wide text-foreground"
        >
          {modeLabel}
        </Badge>
      </div>

      {isFormMode && renderInlineForm ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5 text-xs">
            <span className="font-medium text-muted-foreground">
              Estado de registro
            </span>
            <span
              data-testid="detail-state-value"
              className="font-semibold text-foreground"
            >
              {nextStateText ?? "Activo"}
            </span>
          </div>
          {renderInlineForm()}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5 text-xs">
            <span className="font-medium text-muted-foreground">
              Estado de registro
            </span>
            <span
              data-testid="detail-state-value"
              className="font-semibold text-foreground"
            >
              {stateDisplayText}
            </span>
          </div>

          {fieldsToRender.map((field) => (
            <div key={field.id} className="flex flex-col gap-1.5">
              <Label
                htmlFor={field.id}
                className="text-xs font-medium text-foreground"
              >
                {field.label}
              </Label>
              <input
                id={field.id}
                type="text"
                readOnly
                tabIndex={-1}
                data-testid={field.testId}
                value={field.value}
                placeholder={field.placeholder ?? "—"}
                className="flex h-11 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          ))}

          {!readonlyFields && selectedSubtitle && (
            <p className="m-0 pt-0.5 text-xs break-words text-muted-foreground">
              {selectedSubtitle}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
