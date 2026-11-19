import { cn } from "cn";
import { EST_A, EST_I, EST_X, type EstReg } from "@/core";

interface EstadoDisplayMeta {
  readonly symbol: "A" | "I" | "*";
  readonly label: "Activo" | "Inactivo" | "Eliminado";
  readonly textClassName: string;
}

const ESTADO_META_MAP: Readonly<Record<EstReg, EstadoDisplayMeta>> = {
  [EST_A]: {
    symbol: "A",
    label: "Activo",
    textClassName: "text-foreground",
  },
  [EST_I]: {
    symbol: "I",
    label: "Inactivo",
    textClassName: "text-muted-foreground",
  },
  [EST_X]: {
    symbol: "*",
    label: "Eliminado",
    textClassName: "text-destructive",
  },
};

export interface EstadoBadgeProps {
  readonly state: EstReg;
  readonly compact?: boolean;
  readonly className?: string;
}

/**
 * Renders the normative record-state indicator (Activo / Inactivo / Eliminado) as plain text without a pill.
 */
export function EstadoBadge({
  state,
  compact = false,
  className,
}: EstadoBadgeProps) {
  const meta = ESTADO_META_MAP[state];
  const text = compact ? meta.label : meta.label;

  return (
    <span
      data-slot="estado-badge"
      data-estado={meta.symbol}
      aria-label={`Estado ${meta.symbol}: ${meta.label}`}
      className={cn(
        "inline-block text-xs font-medium tracking-tight",
        meta.textClassName,
        className,
      )}
    >
      {text}
    </span>
  );
}
