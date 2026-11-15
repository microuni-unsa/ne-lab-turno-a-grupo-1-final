import { IonBadge } from "@ionic/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";
import {
  type CommonIonicWrapperProps,
  extractCommonDomProps,
  useIonicForwardedRef,
} from "@/components/ui/ionic-props";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-destructive-foreground focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border bg-transparent text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost:
          "bg-transparent text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "bg-transparent text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = CommonIonicWrapperProps &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    ref?: React.Ref<HTMLElement>;
  };

function SlotBadge({
  className,
  variant = "default",
  children,
  ref,
  ...props
}: Omit<BadgeProps, "asChild">) {
  const slotRef = useIonicForwardedRef<HTMLElement>(ref, props);

  return (
    <Slot.Root
      ref={slotRef}
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...extractCommonDomProps(props)}
    >
      {children}
    </Slot.Root>
  );
}

function IonicBadge({
  className,
  variant = "default",
  children,
  ref,
  ...props
}: Omit<BadgeProps, "asChild">) {
  const ionicRef = useIonicForwardedRef<HTMLIonBadgeElement, HTMLElement>(
    ref,
    props,
  );

  return (
    <IonBadge
      ref={ionicRef}
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...extractCommonDomProps(props)}
    >
      {children}
    </IonBadge>
  );
}

function Badge({ asChild = false, ...props }: BadgeProps) {
  if (asChild) {
    return <SlotBadge {...props} />;
  }
  return <IonicBadge {...props} />;
}

export type { BadgeProps };
export { Badge, badgeVariants };
