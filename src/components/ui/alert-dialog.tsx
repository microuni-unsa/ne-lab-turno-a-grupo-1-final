import { IonModal } from "@ionic/react";
import { cn } from "cn";
import { Slot } from "radix-ui";
import * as React from "react";

import { Button } from "@/components/ui/button";

interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(
  null,
);

function useAlertDialogContext() {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) {
    throw new Error("AlertDialog components must be used within <AlertDialog>");
  }
  return ctx;
}

function AlertDialog({
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
    <AlertDialogContext.Provider value={value}>
      {children}
    </AlertDialogContext.Provider>
  );
}

function AlertDialogTrigger({
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useAlertDialogContext();

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(true);
    }
  };

  if (asChild) {
    return (
      <Slot.Root
        data-slot="alert-dialog-trigger"
        onClick={handleClick}
        {...props}
      />
    );
  }

  return (
    <button
      type="button"
      data-slot="alert-dialog-trigger"
      onClick={handleClick}
      {...props}
    />
  );
}

function AlertDialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-overlay"
      className={cn("hidden", className)}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm";
}) {
  const { open, setOpen } = useAlertDialogContext();

  return (
    <IonModal
      data-slot="alert-dialog"
      data-size={size}
      isOpen={open}
      backdropDismiss={false}
      onDidDismiss={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "group/alert-dialog-content grid max-h-[85dvh] w-full gap-4 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </IonModal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="alert-dialog-title"
      className={cn("m-0 text-base leading-snug font-semibold", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-dialog-description"
      className={cn("m-0 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-14 items-center justify-center rounded-md bg-muted *:[svg:not([class*='size-'])]:size-7",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { setOpen } = useAlertDialogContext();

  return (
    <Button
      data-slot="alert-dialog-action"
      variant={variant}
      size={size}
      className={cn("w-full", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen(false);
        }
      }}
      {...props}
    />
  );
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { setOpen } = useAlertDialogContext();

  return (
    <Button
      data-slot="alert-dialog-cancel"
      variant={variant}
      size={size}
      className={cn("w-full", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen(false);
        }
      }}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
