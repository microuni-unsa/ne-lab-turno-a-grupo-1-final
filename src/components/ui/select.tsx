import { IonItem, IonLabel, IonList, IonModal } from "@ionic/react";
import { cn } from "cn";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import * as React from "react";

interface SelectContextValue {
  value: string | undefined;
  open: boolean;
  disabled: boolean;
  labels: Record<string, React.ReactNode>;
  setOpen: (open: boolean) => void;
  selectOption: (value: string) => void;
  registerLabel: (value: string, label: React.ReactNode) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) {
    throw new Error("Select components must be used within <Select>");
  }
  return ctx;
}

function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  children?: React.ReactNode;
}) {
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>(
    {},
  );

  const isValueControlled = controlledValue !== undefined;
  const isOpenControlled = controlledOpen !== undefined;
  const value = isValueControlled ? controlledValue : uncontrolledValue;
  const open = isOpenControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (disabled && next) return;
      if (!isOpenControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [disabled, isOpenControlled, onOpenChange],
  );

  const selectOption = React.useCallback(
    (nextValue: string) => {
      if (!isValueControlled) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(nextValue);
      setOpen(false);
    },
    [isValueControlled, onValueChange, setOpen],
  );

  const registerLabel = React.useCallback(
    (optionValue: string, label: React.ReactNode) => {
      setLabels((prev) => {
        if (prev[optionValue] === label) return prev;
        return { ...prev, [optionValue]: label };
      });
    },
    [],
  );

  const ctxValue = React.useMemo<SelectContextValue>(
    () => ({
      value,
      open,
      disabled,
      labels,
      setOpen,
      selectOption,
      registerLabel,
    }),
    [value, open, disabled, labels, setOpen, selectOption, registerLabel],
  );

  return (
    <SelectContext.Provider value={ctxValue}>{children}</SelectContext.Provider>
  );
}

function SelectGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-group"
      className={cn("py-1", className)}
      {...props}
    />
  );
}

function SelectValue({
  placeholder,
  children,
}: {
  placeholder?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { value, labels } = useSelectContext();
  const hasValue = value !== undefined && value !== "";
  const resolved =
    children ?? (hasValue ? (labels[value] ?? value) : placeholder);

  return (
    <span
      data-slot="select-value"
      data-placeholder={!hasValue ? "" : undefined}
      className={cn(
        "line-clamp-1 flex items-center gap-2 text-left",
        !hasValue && "text-muted-foreground",
      )}
    >
      {resolved}
    </span>
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  disabled: triggerDisabled,
  onClick,
  ...props
}: React.ComponentProps<"button"> & {
  size?: "sm" | "default";
}) {
  const { disabled: rootDisabled, open, setOpen } = useSelectContext();
  const isDisabled = rootDisabled || triggerDisabled;

  return (
    <button
      type="button"
      data-slot="select-trigger"
      data-size={size}
      aria-expanded={open}
      disabled={isDisabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen(true);
        }
      }}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-base whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[size=default]:min-h-11 data-[size=sm]:min-h-11 dark:bg-input/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-4 opacity-50" />
    </button>
  );
}

function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  position?: "item-aligned" | "popper";
  align?: "start" | "center" | "end";
}) {
  const { open, setOpen } = useSelectContext();

  return (
    <IonModal
      data-slot="select-content"
      isOpen={open}
      onDidDismiss={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
      initialBreakpoint={0.5}
      breakpoints={[0, 0.5, 0.85]}
      handle={true}
      keepContentsMounted={true}
    >
      <div
        className={cn(
          "flex max-h-[46dvh] flex-col overflow-y-auto overscroll-contain bg-background px-2 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground",
          className,
        )}
        {...props}
      >
        <IonList lines="none" className="bg-transparent p-0">
          {children}
        </IonList>
      </div>
    </IonModal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn(
        "px-3 py-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SelectItem({
  className,
  value,
  disabled = false,
  children,
}: {
  className?: string;
  value: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const {
    value: selectedValue,
    selectOption,
    registerLabel,
  } = useSelectContext();
  const isSelected = selectedValue === value;

  React.useEffect(() => {
    registerLabel(value, children);
  }, [value, children, registerLabel]);

  return (
    <IonItem
      button={true}
      detail={false}
      disabled={disabled}
      data-slot="select-item"
      data-selected={isSelected ? "" : undefined}
      onClick={() => {
        if (!disabled) {
          selectOption(value);
        }
      }}
      className={cn(
        "min-h-11 rounded-md",
        isSelected && "bg-accent text-accent-foreground",
        className,
      )}
    >
      <IonLabel className="text-sm font-normal">{children}</IonLabel>
      {isSelected && (
        <CheckIcon slot="end" className="size-4 shrink-0 text-primary" />
      )}
    </IonItem>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-separator"
      className={cn("pointer-events-none my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-scroll-up-button"
      className={cn("hidden", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </div>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-scroll-down-button"
      className={cn("hidden", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </div>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
