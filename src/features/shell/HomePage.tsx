import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from "@ionic/react";
import {
  BriefcaseIcon,
  Building2Icon,
  ChevronRightIcon,
  GlobeIcon,
  UsersIcon,
} from "lucide-react";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { getSupabaseEnvStatus, useNetworkStatus } from "@/lib/supabase-status";

interface ModuleRouteCard {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly summary: string;
  readonly icon: React.ComponentType<{ readonly className?: string }>;
}

const CATALOG_MODULES: readonly ModuleRouteCard[] = [
  {
    id: "nav-pais",
    path: "/pais",
    title: "Países",
    summary: "Catálogo de países",
    icon: GlobeIcon,
  },
  {
    id: "nav-dependencia",
    path: "/dependencia",
    title: "Dependencias",
    summary: "Áreas de la empresa",
    icon: Building2Icon,
  },
  {
    id: "nav-cargo",
    path: "/cargo",
    title: "Cargos",
    summary: "Catálogo de puestos laborales",
    icon: BriefcaseIcon,
  },
  {
    id: "nav-personal",
    path: "/personal",
    title: "Personal",
    summary: "Registro maestro de colaboradores",
    icon: UsersIcon,
  },
];

/**
 * Hub principal mobile-first de Maestro de Personal — Soluciones Móviles S.A.C.
 */
export function HomePage() {
  const ionRouter = useIonRouter();
  const envStatus = React.useMemo(() => getSupabaseEnvStatus(), []);
  const isOnline = useNetworkStatus();

  const navigateTo = (path: string) => {
    if (ionRouter.routeInfo !== undefined) {
      ionRouter.push(path, "forward", "push");
    }
  };

  return (
    <IonPage id="maestro-personal-shell">
      <IonHeader>
        <IonToolbar>
          <IonTitle className="px-4 font-semibold">
            Maestro de Personal
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <main className="mx-auto flex w-full max-w-md flex-col gap-3 py-3 pb-8">
          <header className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 shadow-sm">
            <h1 className="m-0 text-xl font-bold tracking-tight text-foreground">
              Maestro de Personal
            </h1>
            <p className="m-0 text-sm font-medium text-muted-foreground">
              Soluciones Móviles S.A.C.
            </p>

            {!envStatus.configured && (
              <p
                data-testid="home-missing-env-notice"
                className="m-0 mt-1 text-xs break-words text-destructive"
              >
                Faltan credenciales requeridas:{" "}
                {envStatus.missingVars.join(", ")}.
              </p>
            )}

            {!isOnline && (
              <p
                data-testid="home-offline-notice"
                className="m-0 mt-1 text-xs text-destructive"
              >
                No existe modo offline: verifica tu conexión a Internet antes de
                consultar o guardar registros.
              </p>
            )}
          </header>

          <section
            aria-label="Mantenimientos disponibles"
            className="flex flex-col gap-3"
          >
            {CATALOG_MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Card key={mod.id} className="overflow-hidden py-0">
                  <button
                    type="button"
                    data-testid={mod.id}
                    onClick={() => navigateTo(mod.path)}
                    className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 active:bg-muted/70"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-base font-semibold text-foreground">
                          {mod.title}
                        </span>
                        <span className="text-xs leading-snug text-muted-foreground">
                          {mod.summary}
                        </span>
                      </div>
                    </div>

                    <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
                  </button>
                </Card>
              );
            })}
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
}
