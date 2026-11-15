import { IonButton } from "@ionic/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";
import {
  type CommonIonicWrapperProps,
  extractCommonDomProps,
  useIonicForwardedRef,
} from "@/components/ui/ionic-props";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const VARIANT_TO_ION_FILL = {
  default: "solid",
  destructive: "solid",
  outline: "outline",
  secondary: "solid",
  ghost: "clear",
  link: "clear",
} as const;

type ButtonProps = CommonIonicWrapperProps &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    expand?: "full" | "block";
    name?: string;
    value?: string;
    ref?: React.Ref<HTMLElement>;
  };

function SlotButton({
  className,
  variant = "default",
  size = "default",
  disabled,
  ref,
  children,
  ...props
}: Omit<ButtonProps, "asChild" | "expand">) {
  const slotRef = useIonicForwardedRef<HTMLElement>(ref, {
    ...props,
    ...(disabled ? { "aria-disabled": true } : {}),
  });

  return (
    <Slot.Root
      ref={slotRef}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...extractCommonDomProps(props)}
    >
      {children}
    </Slot.Root>
  );
}

function IonicButton({
  className,
  variant = "default",
  size = "default",
  type = "button",
  disabled,
  expand,
  ref,
  children,
  ...props
}: Omit<ButtonProps, "asChild">) {
  const ionicRef = useIonicForwardedRef<HTMLIonButtonElement, HTMLElement>(
    ref,
    props,
  );
  const resolvedVariant = variant ?? "default";

  return (
    <IonButton
      ref={ionicRef}
      data-slot="button"
      data-variant={resolvedVariant}
      data-size={size}
      fill={VARIANT_TO_ION_FILL[resolvedVariant]}
      type={type}
      disabled={disabled}
      expand={expand}
      className={cn(
        buttonVariants({ variant: resolvedVariant, size, className }),
      )}
      {...extractCommonDomProps(props)}
    >
      <span className="inline-flex w-full items-center justify-[inherit] gap-1.5">
        {children}
      </span>
    </IonButton>
  );
}

function Button({ asChild = false, ...props }: ButtonProps) {
  if (asChild) {
    return <SlotButton {...props} />;
  }
  return <IonicButton {...props} />;
}

export type { ButtonProps };
export { Button, buttonVariants };
