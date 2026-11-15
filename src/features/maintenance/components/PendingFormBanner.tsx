import { PencilLineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface PendingFormBannerProps {
  readonly pendingKind: string | undefined;
  readonly onReopen: () => void;
}

/**
 * Sticky resume banner rendered when a pending Adición/Modificación drawer is hidden
 * (`Ocultar`), preserving draft state cleanly until Guardar or Cancelar.
 */
export function PendingFormBanner({
  pendingKind,
  onReopen,
}: PendingFormBannerProps) {
  return (
    <Card
      data-testid="pending-form-banner"
      className="border-amber-500/60 bg-amber-50/70"
    >
      <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs">
        <span className="font-medium text-amber-950">
          Operación pendiente ({pendingKind}) — borrador conservado.
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onReopen}
          data-testid="btn-reopen-form-drawer"
          className="min-h-11 gap-1.5"
        >
          <PencilLineIcon className="size-3.5" />
          <span>Abrir formulario</span>
        </Button>
      </CardContent>
    </Card>
  );
}
