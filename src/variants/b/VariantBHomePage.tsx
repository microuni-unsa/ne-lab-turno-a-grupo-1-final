import { IonContent, IonPage, useIonRouter } from "@ionic/react";
import { ArrowUpRightIcon, ShieldCheckIcon } from "lucide-react";
import * as React from "react";
import { getSupabaseEnvStatus, useNetworkStatus } from "@/lib/supabase-status";

interface DirectoryRow {
  readonly num: string;
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string | null;
}

const DIRECTORY_ROWS: readonly DirectoryRow[] = [
  {
    num: "01",
    id: "nav-pais",
    title: "País",
    subtitle: "Catálogo maestro PAIS · CRUD completo y estados A / I / *.",
    path: "/pais",
  },
  {
    num: "02",
    id: "nav-personal-disabled",
    title: "Personal",
    subtitle: "Fuera de alcance en esta variante.",
    path: null,
  },
  {
    num: "03",
    id: "nav-dependencia-disabled",
    title: "Dependencia",
    subtitle: "Fuera de alcance en esta variante.",
    path: null,
  },
  {
    num: "04",
    id: "nav-cargo-disabled",
    title: "Cargo",
    subtitle: "Fuera de alcance en esta variante.",
    path: null,
  },
];

export function VariantBHomePage() {
  const ionRouter = useIonRouter();
  const envStatus = React.useMemo(() => getSupabaseEnvStatus(), []);
  const isOnline = useNetworkStatus();

  const navigateTo = (path: string) => {
    if (ionRouter.routeInfo !== undefined) {
      ionRouter.push(path, "forward", "push");
    }
  };

  return (
    <IonPage id="variant-b-home">
      <IonContent className="ion-padding">
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 py-4 pb-10">
          <header className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-widest uppercase">
              <span className="text-muted-foreground">
                SOLUCIONES MÓVILES S.A.C.
              </span>
              <span
                data-testid="home-connectivity-status"
                className="font-mono text-primary"
              >
                {!envStatus.configured
                  ? "SIN CONFIGURAR"
                  : !isOnline
                    ? "SIN RED"
                    : "EN LÍNEA · SUPABASE"}
              </span>
            </div>

            <h1 className="variant-b-serif m-0 text-4xl leading-tight font-normal tracking-tight text-foreground">
              Maestro de
              <br />
              Personal
            </h1>
            <p className="m-0 text-sm text-muted-foreground">
              Mantenimiento de tablas maestras · Variante B (PAÍS)
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                <strong className="font-semibold text-emerald-800">A</strong>{" "}
                Activo
              </span>
              <span>
                <strong className="font-semibold text-amber-700">I</strong>{" "}
                Inactivo
              </span>
              <span>
                <strong className="font-semibold text-rose-700">*</strong>{" "}
                Eliminado
              </span>
              <span className="text-muted-foreground/70">
                — Toque una fila para abrir
              </span>
            </div>
          </header>

          <section aria-label="Directorio de tablas" className="flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-2 text-[11px] font-semibold tracking-widest uppercase">
              <span className="text-muted-foreground">
                Directorio de tablas
              </span>
              <span className="text-primary">1 módulo activo</span>
            </div>

            <div className="divide-y divide-border">
              {DIRECTORY_ROWS.map((row) => {
                const enabled = row.path !== null;
                return (
                  <button
                    key={row.id}
                    type="button"
                    data-testid={row.id}
                    disabled={!enabled}
                    onClick={() => {
                      if (row.path) {
                        navigateTo(row.path);
                      }
                    }}
                    className={`flex w-full items-center justify-between gap-4 py-5 text-left transition-opacity ${
                      enabled
                        ? "hover:opacity-80"
                        : "cursor-not-allowed opacity-40"
                    }`}
                  >
                    <div className="flex items-baseline gap-4">
                      <span className="variant-b-serif text-3xl text-primary">
                        {row.num}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className="variant-b-serif text-xl text-foreground">
                          {row.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.subtitle}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className="font-mono">
                        {enabled ? "PAIS" : "N/D"}
                      </span>
                      {enabled && (
                        <ArrowUpRightIcon className="size-4 text-primary" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xs">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              <ShieldCheckIcon className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                Una operación pendiente a la vez
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                Guardar confirma y Cancelar descarta. Salir se bloquea mientras
                exista un cambio sin guardar.
              </span>
            </div>
          </section>

          <footer className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-mono">Variante B · Solo PAIS</span>
            <span>Español formal</span>
          </footer>
        </main>
      </IonContent>
    </IonPage>
  );
}
