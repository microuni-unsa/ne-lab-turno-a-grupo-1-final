import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
} from "@ionic/react";
import { cn } from "cn";
import type * as React from "react";
import {
  type CommonIonicWrapperProps,
  extractCommonDomProps,
  useIonicForwardedRef,
} from "@/components/ui/ionic-props";

type CardProps = CommonIonicWrapperProps & {
  button?: boolean;
  ref?: React.Ref<HTMLIonCardElement>;
};

function Card({ className, button, ref, children, ...props }: CardProps) {
  const ionicRef = useIonicForwardedRef<HTMLIonCardElement>(ref, props);
  return (
    <IonCard
      ref={ionicRef}
      data-slot="card"
      button={button ?? Boolean(props.onClick)}
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card py-4 text-card-foreground shadow-sm",
        className,
      )}
      {...extractCommonDomProps(props)}
    >
      {children}
    </IonCard>
  );
}

type CardHeaderProps = CommonIonicWrapperProps & {
  ref?: React.Ref<HTMLIonCardHeaderElement>;
};

function CardHeader({ className, ref, children, ...props }: CardHeaderProps) {
  const ionicRef = useIonicForwardedRef<HTMLIonCardHeaderElement>(ref, props);
  return (
    <IonCardHeader
      ref={ionicRef}
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-4 py-0 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4",
        className,
      )}
      {...extractCommonDomProps(props)}
    >
      {children}
    </IonCardHeader>
  );
}

type CardTitleProps = CommonIonicWrapperProps & {
  ref?: React.Ref<HTMLIonCardTitleElement>;
};

function CardTitle({ className, ref, children, ...props }: CardTitleProps) {
  const ionicRef = useIonicForwardedRef<HTMLIonCardTitleElement>(ref, props);
  return (
    <IonCardTitle
      ref={ionicRef}
      data-slot="card-title"
      className={cn(
        "text-base leading-snug font-semibold text-card-foreground",
        className,
      )}
      {...extractCommonDomProps(props)}
    >
      {children}
    </IonCardTitle>
  );
}

type CardDescriptionProps = CommonIonicWrapperProps & {
  ref?: React.Ref<HTMLIonCardSubtitleElement>;
};

function CardDescription({
  className,
  ref,
  children,
  ...props
}: CardDescriptionProps) {
  const ionicRef = useIonicForwardedRef<HTMLIonCardSubtitleElement>(ref, props);
  return (
    <IonCardSubtitle
      ref={ionicRef}
      data-slot="card-description"
      className={cn("text-sm font-normal text-muted-foreground", className)}
      {...extractCommonDomProps(props)}
    >
      {children}
    </IonCardSubtitle>
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

type CardContentProps = CommonIonicWrapperProps & {
  ref?: React.Ref<HTMLIonCardContentElement>;
};

function CardContent({ className, ref, children, ...props }: CardContentProps) {
  const ionicRef = useIonicForwardedRef<HTMLIonCardContentElement>(ref, props);
  return (
    <IonCardContent
      ref={ionicRef}
      data-slot="card-content"
      className={cn(
        "px-4 py-0 text-sm leading-normal text-card-foreground",
        className,
      )}
      {...extractCommonDomProps(props)}
    >
      {children}
    </IonCardContent>
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-4 [.border-t]:pt-4", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
