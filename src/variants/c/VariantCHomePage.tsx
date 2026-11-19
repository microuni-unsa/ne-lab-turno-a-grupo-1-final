import { IonContent, IonPage, useIonRouter } from "@ionic/react";
import { ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { getSupabaseEnvStatus, useNetworkStatus } from "@/lib/supabase-status";

interface ConsoleModuleRow {
  readonly id: string;
  readonly name: string;
  readonly schemaTable: string;
  readonly code: string;
  readonly path: string | null;
}

const CONSOLE_MODULES: readonly ConsoleModuleRow[] = [
  {
    id: "nav-pais",
    name: "PAÍS",
    schemaTable: "public.pais",
    code: "T01",
    path: "/pais",
  },
  {
    id: "nav-dependencia-disabled",
    name: "DEPENDENCIA",
    schemaTable: "public.dependencia",
    code: "T02",
    path: null,
  },
  {
    id: "nav-cargo-disabled",
    name: "CARGO",
    schemaTable: "public.cargo",
    code: "T03",
    path: null,
  },
  {
    id: "nav-personal-disabled",
    name: "PERSONAL",
    schemaTable: "public.personal",
    code: "T04",
    path: null,
  },
];

export function VariantCHomePage() {
  const ionRouter = useIonRouter();
  const envStatus = React.useMemo(() => getSupabaseEnvStatus(), []);
  const isOnline = useNetworkStatus();

  const navigateTo = (path: string) => {
    if (ionRouter.routeInfo !== undefined) {
      ionRouter.push(path, "forward", "push");
    }
  };

  return (
    <IonPage id="variant-c-home">
      <IonContent className="ion-padding">
        <main className="mx-auto flex w-full max-w-md flex-col gap-4 py-4 pb-10">
          <header className="flex flex-col gap-1">
            <div className="variant-c-mono flex items-center justify-between text-[11px] text-muted-foreground">
              <span>NE-PRODUCT / CONSOLA</span>
              <span>VARIANTE C · PAÍS</span>
            </div>
            <h1 className="m-0 text-3xl font-bold tracking-tight text-foreground">
              Consola de Personal
            </h1>
            <p className="m-0 text-xs text-muted-foreground">
              Mantenimiento de tablas maestras · sesión única
            </p>
          </header>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="variant-c-mono flex items-center justify-between border-b border-border px-3.5 py-2.5 text-[11px]">
              <span className="font-semibold text-muted-foreground">
                ESTADO DEL SISTEMA
              </span>
              <span
                data-testid="home-connectivity-status"
                className="inline-flex items-center gap-1.5 font-semibold text-primary"
              >
                <span className="size-1.5 rounded-full bg-primary" />
                {!envStatus.configured
                  ? "SIN CONFIGURAR"
                  : !isOnline
                    ? "SIN RED"
                    : "EN LÍNEA"}
              </span>
            </div>

            <div className="variant-c-mono divide-y divide-border text-xs">
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-muted-foreground">SUPABASE</span>
                <span className="text-primary">
                  {envStatus.configured
                    ? "En línea · esquema public"
                    : "Faltan variables"}
                </span>
                <span className="text-primary">
                  {envStatus.configured ? "OK" : "ERR"}
                </span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-muted-foreground">RED</span>
                <span className="text-amber-400">
                  {isOnline ? "Requerida para operar" : "Sin conexión"}
                </span>
                <span className="text-amber-400">REQ</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-muted-foreground">SESIÓN</span>
                <span className="text-foreground">Sin operación pendiente</span>
                <span className="text-muted-foreground">—</span>
              </div>
            </div>
          </section>

          <section aria-label="Módulos" className="flex flex-col gap-2">
            <div className="variant-c-mono flex items-center justify-between text-[11px] text-muted-foreground">
              <span>MÓDULOS / 1 ACTIVO</span>
              <span>SOLO PAÍS</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="variant-c-mono grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border px-3.5 py-2 text-[10px] text-muted-foreground">
                <span>TABLA</span>
                <span>CÓD.</span>
                <span>ESTADO</span>
              </div>
              <div className="divide-y divide-border">
                {CONSOLE_MODULES.map((mod) => {
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
                      className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 px-3.5 py-3.5 text-left transition-colors ${
                        enabled
                          ? "hover:bg-accent/60"
                          : "cursor-not-allowed opacity-35"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">
                          {mod.name}
                        </span>
                        <span className="variant-c-mono text-[11px] text-muted-foreground">
                          {mod.schemaTable}
                        </span>
                      </div>
                      <span className="variant-c-mono text-xs text-muted-foreground">
                        {mod.code}
                      </span>
                      <span className="variant-c-mono inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        {enabled ? (
                          <>
                            ACTIVO
                            <ChevronRightIcon className="size-3.5" />
                          </>
                        ) : (
                          <span className="text-muted-foreground">N/D</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-3.5">
            <div className="border-l-2 border-amber-400 pl-3">
              <span className="variant-c-mono block text-[11px] font-semibold text-amber-400">
                GUARDIA DE SESIÓN
              </span>
              <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground">
                Una operación pendiente a la vez. Guardar confirma y Cancelar
                descarta; Salir se bloquea mientras existan cambios sin guardar.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-3.5">
            <span className="variant-c-mono block text-[11px] text-muted-foreground">
              ENTORNO DE EJECUCIÓN
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-xs">
              <div>
                <span className="variant-c-mono block text-[10px] text-muted-foreground">
                  CLIENTE
                </span>
                <span className="font-medium text-foreground">
                  Ionic + React
                </span>
              </div>
              <div>
                <span className="variant-c-mono block text-[10px] text-muted-foreground">
                  DATOS
                </span>
                <span className="font-medium text-foreground">Supabase</span>
              </div>
              <div>
                <span className="variant-c-mono block text-[10px] text-muted-foreground">
                  ALCANCE
                </span>
                <span className="font-medium text-primary">PAIS · 9 op.</span>
              </div>
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
}
