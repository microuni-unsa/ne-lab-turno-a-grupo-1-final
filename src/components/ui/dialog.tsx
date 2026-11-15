import { IonModal } from "@ionic/react";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import { Button } from "@/components/ui/button";

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error("Dialog components must be used within <Dialog>");
  }
  return ctx;
}

function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const value = React.useMemo(() => ({ open, setOpen }), [open, setOpen]);

  return (
    <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
  );
}

function DialogTrigger({
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useDialogContext();

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(true);
    }
  };

  if (asChild) {
    return (
      <Slot.Root data-slot="dialog-trigger" onClick={handleClick} {...props} />
    );
  }

  return (
    <button
      type="button"
      data-slot="dialog-trigger"
      onClick={handleClick}
      {...props}
    />
  );
}

function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DialogClose({
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useDialogContext();

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(false);
    }
  };

  if (asChild) {
    return (
      <Slot.Root data-slot="dialog-close" onClick={handleClick} {...props} />
    );
  }

  return (
    <button
      type="button"
      data-slot="dialog-close"
      onClick={handleClick}
      {...props}
    />
  );
}

function DialogOverlay({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-overlay"
      className={cn("hidden", className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  const { open, setOpen } = useDialogContext();

  return (
    <IonModal
      data-slot="dialog"
      isOpen={open}
      onDidDismiss={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        data-slot="dialog-content"
        className={cn(
          "relative grid max-h-[85dvh] w-full gap-4 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-foreground",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <Button
            variant="ghost"
            size="icon-lg"
            data-slot="dialog-close"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 text-muted-foreground"
          >
            <XIcon />
          </Button>
        )}
      </div>
    </IonModal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 pr-10 text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  const { setOpen } = useDialogContext();

  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <Button variant="outline" onClick={() => setOpen(false)}>
          Cerrar
        </Button>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("m-0 text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn("m-0 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
