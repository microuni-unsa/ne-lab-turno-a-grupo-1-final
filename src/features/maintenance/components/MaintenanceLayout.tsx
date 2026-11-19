import {
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { AlertTriangleIcon, ArrowLeftIcon, WifiOffIcon } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGuardedExit } from "@/features/maintenance/use-guarded-exit";
import { getSupabaseEnvStatus, useNetworkStatus } from "@/lib/supabase-status";

export { useGuardedExit };

export interface MaintenanceLayoutProps {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly onSalir: () => boolean;
  readonly onExitAllowed?: () => void;
  readonly pendingLabel?: string | null;
  readonly onRegisterScrollToTop?: (scrollToTop: () => void) => void;
  readonly footer?: React.ReactNode;
  readonly children: React.ReactNode;
}

/**
 * Mobile IonPage frame for all maintenance screens with explicit guarded Salir button
 * and honest offline/configuration indicator (SPEC §8.7, §14).
 */
export function MaintenanceLayout({
  id,
  title,
  onSalir,
  onExitAllowed,
  onRegisterScrollToTop,
  footer,
  children,
}: MaintenanceLayoutProps) {
  const handleExit = useGuardedExit(onSalir, onExitAllowed);
  const envStatus = React.useMemo(() => getSupabaseEnvStatus(), []);
  const isOnline = useNetworkStatus();
  const contentRef = React.useRef<HTMLIonContentElement | null>(null);

  React.useEffect(() => {
    if (!onRegisterScrollToTop) {
      return;
    }
    onRegisterScrollToTop(() => {
      const el = contentRef.current;
      if (el && typeof el.scrollToTop === "function") {
        void el.scrollToTop(300);
      }
    });
  }, [onRegisterScrollToTop]);

  return (
    <IonPage id={id}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Volver"
              data-testid="toolbar-salir"
              onClick={handleExit}
              className="min-h-11 min-w-11"
            >
              <ArrowLeftIcon className="size-4 shrink-0" />
            </Button>
          </IonButtons>

          <IonTitle>
            <h1 className="m-0 truncate text-base font-semibold">{title}</h1>
          </IonTitle>

          {(!envStatus.configured || !isOnline) && (
            <IonButtons slot="end" className="pr-2">
              {!envStatus.configured ? (
                <Badge
                  variant="destructive"
                  data-testid="network-status-badge"
                  className="gap-1 text-xs"
                >
                  <AlertTriangleIcon className="size-3.5" />
                  <span>Sin config.</span>
                </Badge>
              ) : (
                <Badge
                  variant="destructive"
                  data-testid="network-status-badge"
                  className="gap-1 text-xs"
                >
                  <WifiOffIcon className="size-3.5" />
                  <span>Sin red</span>
                </Badge>
              )}
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef}>
        <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pt-5 pb-5">
          {!isOnline && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <WifiOffIcon className="size-4 shrink-0" />
              <span>
                Sin conexión a Internet. Este módulo requiere red para operar
                con Supabase.
              </span>
            </div>
          )}

          {children}
        </main>
      </IonContent>

      {footer && (
        <IonFooter className="ion-no-border border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-md px-3 py-2">{footer}</div>
        </IonFooter>
      )}
    </IonPage>
  );
}
