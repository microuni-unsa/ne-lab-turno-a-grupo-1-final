import { IonModal } from "@ionic/react";
import { cn } from "cn";
import { Slot } from "radix-ui";
import * as React from "react";

interface DrawerContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

function useDrawerContext() {
  const ctx = React.useContext(DrawerContext);
  if (!ctx) {
    throw new Error("Drawer components must be used within <Drawer>");
  }
  return ctx;
}

function Drawer({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  shouldScaleBackground?: boolean;
  direction?: "top" | "bottom" | "left" | "right";
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
    <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
  );
}

function DrawerTrigger({
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useDrawerContext();

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(true);
    }
  };

  if (asChild) {
    return (
      <Slot.Root data-slot="drawer-trigger" onClick={handleClick} {...props} />
    );
  }

  return (
    <button
      type="button"
      data-slot="drawer-trigger"
      onClick={handleClick}
      {...props}
    />
  );
}

function DrawerPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DrawerClose({
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useDrawerContext();

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(false);
    }
  };

  if (asChild) {
    return (
      <Slot.Root data-slot="drawer-close" onClick={handleClick} {...props} />
    );
  }

  return (
    <button
      type="button"
      data-slot="drawer-close"
      onClick={handleClick}
      {...props}
    />
  );
}

function DrawerOverlay({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-overlay"
      className={cn("hidden", className)}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  initialBreakpoint = 0.75,
  breakpoints = [0, 0.5, 0.75, 0.95],
  ...props
}: React.ComponentProps<"div"> & {
  initialBreakpoint?: number;
  breakpoints?: number[];
}) {
  const { open, setOpen } = useDrawerContext();

  return (
    <IonModal
      data-slot="drawer"
      isOpen={open}
      onDidDismiss={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
      initialBreakpoint={initialBreakpoint}
      breakpoints={breakpoints}
      handle={true}
    >
      <div
        data-slot="drawer-content"
        className={cn(
          "flex max-h-[78dvh] flex-col overflow-y-auto overscroll-contain bg-background px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </IonModal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1 pb-3 text-left", className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("flex flex-col gap-2 pt-3", className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="drawer-title"
      className={cn("m-0 text-base font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="drawer-description"
      className={cn("m-0 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
