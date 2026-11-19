import { ShieldCheckIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export interface SupervisorAuthDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly recordLabel?: string;
  readonly onAuthorize: (code: string) => void;
}

/**
 * One-time supervisor authorization prompt required to reactivate
 * an Eliminado (*) record back to Activo (A).
 */
export function SupervisorAuthDialog({
  open,
  onOpenChange,
  recordLabel,
  onAuthorize,
}: SupervisorAuthDialogProps) {
  const [code, setCode] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setCode("");
    }
  }, [open]);

  const trimmed = code.trim();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmed.length === 0) {
      return;
    }
    onAuthorize(trimmed);
    setCode("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="supervisor-auth-dialog"
        className="max-w-sm rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheckIcon className="size-4 text-primary" />
            <span>Autorización de supervisor</span>
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {recordLabel
              ? `El registro "${recordLabel}" está eliminado (*). `
              : "El registro seleccionado está eliminado (*). "}
            Ingrese el código de autorización de un solo uso para reactivarlo a
            Activo (A).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supervisor-auth-input" className="text-xs">
              Código de autorización
            </Label>
            <input
              id="supervisor-auth-input"
              name="supervisorCode"
              type="password"
              autoComplete="off"
              placeholder="Ingrese código de supervisor"
              data-testid="input-supervisor-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-11"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={trimmed.length === 0}
              data-testid="btn-confirm-supervisor-auth"
              className="min-h-11"
            >
              Autorizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
