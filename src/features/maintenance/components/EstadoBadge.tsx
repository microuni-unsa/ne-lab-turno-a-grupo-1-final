import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { EST_A, EST_I, EST_X, type EstReg } from "@/core";

interface EstadoDisplayMeta {
  readonly symbol: "A" | "I" | "*";
  readonly label: "Activo" | "Inactivo" | "Eliminado";
  readonly variant: "default" | "secondary" | "destructive";
  readonly className: string;
}

const ESTADO_META_MAP: Readonly<Record<EstReg, EstadoDisplayMeta>> = {
  [EST_A]: {
    symbol: "A",
    label: "Activo",
    variant: "default",
    className: "bg-emerald-700 text-white border-emerald-800",
  },
  [EST_I]: {
    symbol: "I",
    label: "Inactivo",
    variant: "secondary",
    className: "bg-amber-100 text-amber-950 border-amber-300",
  },
  [EST_X]: {
    symbol: "*",
    label: "Eliminado",
    variant: "destructive",
    className: "bg-destructive text-white border-destructive",
  },
};

export interface EstadoBadgeProps {
  readonly state: EstReg;
  readonly compact?: boolean;
  readonly className?: string;
}

/**
 * Renders the normative record-state indicator (A / I / *) with high contrast.
 */
export function EstadoBadge({
  state,
  compact = false,
  className,
}: EstadoBadgeProps) {
  const meta = ESTADO_META_MAP[state];
  const text = compact ? meta.symbol : `${meta.symbol} · ${meta.label}`;

  return (
    <Badge
      variant={meta.variant}
      data-slot="estado-badge"
      data-estado={meta.symbol}
      aria-label={`Estado ${meta.symbol}: ${meta.label}`}
      className={cn(
        "min-h-6 px-2.5 py-0.5 text-xs font-semibold tracking-tight",
        meta.className,
        className,
      )}
    >
      {text}
    </Badge>
  );
}
