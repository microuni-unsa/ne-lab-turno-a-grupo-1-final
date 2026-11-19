import { IonContent, IonPage, useIonRouter } from "@ionic/react";
import {
  AlertTriangleIcon,
  BriefcaseIcon,
  Building2Icon,
  ChevronRightIcon,
  GlobeIcon,
  ShieldCheckIcon,
  UsersIcon,
  WifiOffIcon,
} from "lucide-react";
import * as React from "react";
import { getSupabaseEnvStatus, useNetworkStatus } from "@/lib/supabase-status";

interface VariantAModuleCard {
  readonly id: string;
  readonly path: string | null;
  readonly title: string;
  readonly summary: string;
  readonly tag: string;
  readonly footerNote: string;
  readonly icon: React.ComponentType<{ readonly className?: string }>;
}

const VARIANT_A_MODULES: readonly VariantAModuleCard[] = [
  {
    id: "nav-pais",
    path: "/pais",
    title: "Países",
    summary: "Catálogo de países",
    tag: "PAIS",
    footerNote: "Activo · CRUD completo",
    icon: GlobeIcon,
  },
  {
    id: "nav-dependencia-disabled",
    path: null,
    title: "Dependencias",
    summary: "Unidades orgánicas",
    tag: "DEPENDENCIA",
    footerNote: "Fuera de alcance",
    icon: Building2Icon,
  },
  {
    id: "nav-cargo-disabled",
    path: null,
    title: "Cargos",
    summary: "Puestos de trabajo",
    tag: "CARGO",
    footerNote: "Fuera de alcance",
    icon: BriefcaseIcon,
  },
  {
    id: "nav-personal-disabled",
    path: null,
    title: "Personal",
    summary: "Legajos del personal",
    tag: "PERSONAL",
    footerNote: "Fuera de alcance",
    icon: UsersIcon,
  },
];

export function VariantAHomePage() {
  const ionRouter = useIonRouter();
  const envStatus = React.useMemo(() => getSupabaseEnvStatus(), []);
  const isOnline = useNetworkStatus();

  const navigateTo = (path: string) => {
    if (ionRouter.routeInfo !== undefined) {
      ionRouter.push(path, "forward", "push");
    }
  };

  return (
    <IonPage id="variant-a-home">
      <IonContent className="ion-padding">
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 py-4 pb-10">
          <header className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                SOLUCIONES MÓVILES S.A.C.
              </span>
              {!envStatus.configured ? (
                <span
                  data-testid="home-connectivity-status"
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700"
                >
                  <AlertTriangleIcon className="size-3.5" />
                  Sin configurar
                </span>
              ) : !isOnline ? (
                <span
                  data-testid="home-connectivity-status"
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700"
                >
                  <WifiOffIcon className="size-3.5" />
                  Sin red
                </span>
              ) : (
                <span
                  data-testid="home-connectivity-status"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
                >
                  <span className="size-2 rounded-full bg-emerald-600" />
                  En línea · Supabase
                </span>
              )}
            </div>

            <h1 className="m-0 text-3xl font-bold tracking-tight text-foreground">
              Maestro de Personal
            </h1>
            <p className="m-0 text-sm text-muted-foreground">
              Mantenimiento de las tablas maestras · Variante A (PAÍS)
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>1 tabla activa · 9 operaciones</span>
              <span className="font-mono font-medium text-foreground">
                A / I / *
              </span>
            </div>
          </header>

          <section aria-label="Mantenimientos" className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <span>Mantenimientos</span>
              <span>Solo PAIS</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {VARIANT_A_MODULES.map((mod) => {
                const Icon = mod.icon;
                const enabled = mod.path !== null;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    data-testid={mod.id}
                    disabled={!enabled}
                    onClick={() => {
                      if (mod.path) {
                        navigateTo(mod.path);
                      }
                    }}
                    className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                      enabled
                        ? "border-border bg-card shadow-sm hover:border-primary/40 active:scale-[0.99]"
                        : "cursor-not-allowed border-border/60 bg-muted/40 opacity-55"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                        <Icon className="size-5" />
                      </div>
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary">
                        {mod.tag}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col gap-0.5">
                      <span className="text-base font-bold text-foreground">
                        {mod.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {mod.summary}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{mod.footerNote}</span>
                      {enabled && (
                        <ChevronRightIcon className="size-4 text-foreground" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  1
                </span>
                <span className="text-xs font-semibold text-foreground">
                  Selecciona
                </span>
                <span className="text-[11px] text-muted-foreground">
                  un registro
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  2
                </span>
                <span className="text-xs font-semibold text-foreground">
                  Elige
                </span>
                <span className="text-[11px] text-muted-foreground">
                  la operación
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  3
                </span>
                <span className="text-xs font-semibold text-foreground">
                  Guardar
                </span>
                <span className="text-[11px] text-muted-foreground">
                  o Cancelar
                </span>
              </div>
            </div>
          </section>

          <section className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/70 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-xs">
              <ShieldCheckIcon className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                Una operación pendiente a la vez
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                Guardar confirma, Cancelar descarta. Salir se bloquea mientras
                haya cambios sin guardar.
              </span>
            </div>
          </section>

          <footer className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
            Variante A · Solo tabla PAIS
          </footer>
        </main>
      </IonContent>
    </IonPage>
  );
}
