import { CheckIcon, EyeOffIcon, LogOutIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EST_A, type EstReg } from "@/core";
import { EstadoBadge } from "@/features/maintenance/components/EstadoBadge";

export interface MaintenanceFormFooterProps {
  readonly busy: boolean;
  readonly onTriggerSubmit: () => void;
  readonly onCancelPending: () => void;
  readonly onSalir: () => void;
}

/**
 * Shared mobile bottom action bar (`Guardar` / `Cancelar` / `Salir`) inside
 * Adición/Modificación form drawers with 44px touch targets.
 */
export function MaintenanceFormFooter({
  busy,
  onTriggerSubmit,
  onCancelPending,
  onSalir,
}: MaintenanceFormFooterProps) {
  return (
    <DrawerFooter className="px-0 pb-1 pt-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          disabled={busy}
          onClick={onTriggerSubmit}
          data-testid="form-guardar"
          className="min-h-11 flex-1 gap-1.5"
        >
          <CheckIcon className="size-4 shrink-0" />
          <span>{busy ? "Guardando..." : "Guardar"}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancelPending}
          data-testid="drawer-cancelar"
          className="min-h-11 gap-1.5"
        >
          <XIcon className="size-4 shrink-0" />
          <span>Cancelar</span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onSalir}
          data-testid="drawer-salir"
          className="min-h-11 gap-1.5"
        >
          <LogOutIcon className="size-4 shrink-0" />
          <span>Salir</span>
        </Button>
      </div>
    </DrawerFooter>
  );
}

export interface MaintenanceFormDrawerShellProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onHideDrawer: () => void;
  readonly title: string;
  readonly titleTestId: string;
  readonly description: string;
  readonly estFieldLabel: string;
  readonly estReg: EstReg;
  readonly isUpdate: boolean;
  readonly initialBreakpoint?: number;
  readonly breakpoints?: number[];
  readonly bodyClassName?: string;
  readonly children: React.ReactNode;
}

/**
 * Shared Ionic Drawer shell for Reference & Personal Adición/Modificación forms:
 * unified header with `Ocultar` (`drawer-hide`) and read-only `EstReg` banner (`R8`/`R9`).
 */
export function MaintenanceFormDrawerShell({
  open,
  onOpenChange,
  onHideDrawer,
  title,
  titleTestId,
  description,
  estFieldLabel,
  estReg,
  isUpdate,
  initialBreakpoint = 0.85,
  breakpoints = [0, 0.65, 0.85, 0.95],
  bodyClassName = "space-y-4 overflow-y-auto overscroll-contain px-1 pb-2 max-h-[62dvh]",
  children,
}: MaintenanceFormDrawerShellProps) {
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onHideDrawer();
        return;
      }
      onOpenChange(true);
    },
    [onHideDrawer, onOpenChange],
  );

  const displayedState = isUpdate ? estReg : EST_A;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent
        initialBreakpoint={initialBreakpoint}
        breakpoints={breakpoints}
      >
        <DrawerHeader className="px-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <DrawerTitle data-testid={titleTestId}>{title}</DrawerTitle>
              <DrawerDescription>{description}</DrawerDescription>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onHideDrawer}
              data-testid="drawer-hide"
              className="min-h-11 shrink-0 gap-1"
            >
              <EyeOffIcon className="size-4 shrink-0" />
              <span>Ocultar</span>
            </Button>
          </div>
        </DrawerHeader>

        <div className={bodyClassName}>
          <div
            data-testid="form-estreg-readonly"
            className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
          >
            <span className="font-medium text-muted-foreground">
              Estado de Registro ({estFieldLabel})
            </span>
            <div className="flex items-center gap-2">
              <EstadoBadge state={displayedState} />
              <span className="text-muted-foreground">
                {isUpdate ? "Conservado (R8)" : "Fijo Activo (R9)"}
              </span>
            </div>
          </div>

          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
