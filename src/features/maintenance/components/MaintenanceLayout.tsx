import {
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
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
  readonly footer?: React.ReactNode;
  readonly children: React.ReactNode;
}

/**
 * Mobile IonPage frame for all maintenance screens with explicit guarded Salir button
 * and honest network/configuration indicator (SPEC §8.7, §14).
 */
export function MaintenanceLayout({
  id,
  title,
  onSalir,
  onExitAllowed,
  footer,
  children,
}: MaintenanceLayoutProps) {
  const handleExit = useGuardedExit(onSalir, onExitAllowed);
  const envStatus = React.useMemo(() => getSupabaseEnvStatus(), []);
  const isOnline = useNetworkStatus();

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

          <IonButtons slot="end" className="pr-2">
            {!envStatus.configured ? (
              <Badge
                variant="destructive"
                data-testid="network-status-badge"
                className="gap-1 text-[11px]"
              >
                <AlertTriangleIcon className="size-3" />
                <span>Sin config.</span>
              </Badge>
            ) : !isOnline ? (
              <Badge
                variant="destructive"
                data-testid="network-status-badge"
                className="gap-1 text-[11px]"
              >
                <WifiOffIcon className="size-3" />
                <span>Sin red</span>
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                data-testid="network-status-badge"
                className="gap-1 text-[11px]"
              >
                <WifiIcon className="size-3 text-emerald-700" />
                <span>En línea</span>
              </Badge>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-3 pb-6">
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
