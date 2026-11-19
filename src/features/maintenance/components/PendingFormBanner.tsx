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
      className="border-primary/30 bg-primary/5"
    >
      <CardContent className="flex flex-col gap-2.5 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <span className="font-medium text-foreground">
          Operación pendiente ({pendingKind}) — borrador conservado.
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onReopen}
          data-testid="btn-reopen-form-drawer"
          className="h-11 min-h-11 w-full gap-1.5 bg-background sm:w-auto"
        >
          <PencilLineIcon className="size-3.5" />
          <span>Abrir formulario</span>
        </Button>
      </CardContent>
    </Card>
  );
}
