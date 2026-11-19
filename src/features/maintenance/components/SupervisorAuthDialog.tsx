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
  readonly onAuthorize: (
    code: string,
  ) =>
    | Promise<
        { readonly ok: boolean; readonly error?: string } | boolean | void
      >
    | { readonly ok: boolean; readonly error?: string }
    | boolean
    | void;
}

/**
 * One-time supervisor authorization prompt required to reactivate
 * an Eliminado (*) record back to Activo (A).
 * Validates the authorization code immediately upon clicking Autorizar.
 */
export function SupervisorAuthDialog({
  open,
  onOpenChange,
  recordLabel,
  onAuthorize,
}: SupervisorAuthDialogProps) {
  const [code, setCode] = React.useState("");
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setCode("");
      setIsVerifying(false);
      setErrorMessage(null);
    }
  }, [open]);

  const trimmed = code.trim();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmed.length === 0 || isVerifying) {
      return;
    }

    setErrorMessage(null);
    setIsVerifying(true);
    try {
      const result = await onAuthorize(trimmed);
      if (result === false) {
        setErrorMessage("Código de supervisor inválido.");
        return;
      }
      if (typeof result === "object" && result !== null && !result.ok) {
        setErrorMessage(result.error ?? "Código de supervisor inválido.");
        return;
      }
      setCode("");
    } catch {
      setErrorMessage("No se pudo validar el código de supervisor.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="supervisor-auth-dialog"
        className="max-w-sm rounded-xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
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

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supervisor-auth-input" className="text-xs">
              Código de autorización
            </Label>
            <input
              id="supervisor-auth-input"
              name="supervisorCode"
              type="password"
              autoComplete="off"
              disabled={isVerifying}
              placeholder="Ingrese código de supervisor"
              data-testid="input-supervisor-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
              }}
              className="flex h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            />
            {errorMessage && (
              <p
                role="alert"
                data-testid="supervisor-auth-error"
                className="m-0 text-xs font-medium text-destructive"
              >
                {errorMessage}
              </p>
            )}
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isVerifying}
              onClick={() => onOpenChange(false)}
              className="h-11 min-h-11"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={trimmed.length === 0 || isVerifying}
              data-testid="btn-confirm-supervisor-auth"
              className="h-11 min-h-11"
            >
              {isVerifying ? "Verificando..." : "Autorizar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
