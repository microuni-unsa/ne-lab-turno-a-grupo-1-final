import {
  IonContent,
  IonFooter,
  IonHeader,
  IonPage,
  IonToolbar,
} from "@ionic/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowLeftIcon,
  ArrowUpDownIcon,
  CheckCircle2Icon,
  LogOutIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import { EST_A, EST_I, EST_X, type EstReg, type PaisRow } from "@/core";
import { AdvancedSearchDrawer } from "@/features/maintenance/components/AdvancedSearchDrawer";
import { PendingFormBanner } from "@/features/maintenance/components/PendingFormBanner";
import { StateTransitionCard } from "@/features/maintenance/components/StateTransitionCard";
import { isStateTransitionOp } from "@/features/maintenance/use-maintenance-screen";
import { ReferenceFormDrawer } from "@/features/reference/components/ReferenceFormDrawer";
import type { ReferenceRepoContract } from "@/features/reference/reference-config";
import {
  formatPaisCode,
  getStateMeta,
  usePaisVariantScreen,
} from "@/variants/shared/use-pais-variant-screen";

export interface VariantAPaisPageProps {
  readonly client?: SupabaseClient;
  readonly repo?: ReferenceRepoContract<PaisRow>;
}

function statePillClasses(estReg: EstReg): string {
  switch (estReg) {
    case EST_A:
      return "bg-emerald-100 text-emerald-800";
    case EST_I:
      return "bg-amber-100 text-amber-800";
    case EST_X:
      return "bg-rose-100 text-rose-700";
  }
}

export function VariantAPaisPage({ client, repo }: VariantAPaisPageProps) {
  const { config, screen, stateCounts } = usePaisVariantScreen({
    client,
    repo,
  });

  const selectedRow = screen.controller.selectedRow;
  const hasPending = screen.controller.hasPending;
  const isSaving = screen.controller.isSaving;

  return (
    <IonPage id="variant-a-pais-page">
      <IonHeader className="ion-no-border border-b border-border bg-background">
        <IonToolbar>
          <div className="mx-auto flex w-full max-w-md items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Volver"
                onClick={screen.handleSalir}
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-2xs hover:bg-muted"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <h1 className="m-0 text-xl font-bold tracking-tight text-foreground">
                {config.title}
              </h1>
            </div>

            <button
              type="button"
              data-testid="op-salir-header"
              onClick={screen.handleSalir}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <LogOutIcon className="size-3.5" />
              Salir
            </button>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 py-3 pb-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary">
                PAIS
              </span>
              <span className="text-xs text-muted-foreground">
                {screen.list.totalCount} registros
              </span>
            </div>

            <button
              type="button"
              data-testid="toggle-ordering-btn"
              onClick={() => screen.list.toggleOrdering()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs hover:bg-muted"
            >
              <ArrowUpDownIcon className="size-3.5" />
              {screen.list.orderingLabel}
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              screen.list.applySimpleSearch(screen.simpleInput);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={screen.simpleInput}
                onChange={(e) => screen.setSimpleInput(e.target.value)}
                placeholder={config.searchPlaceholder}
                aria-label={config.searchPlaceholder}
                className="h-11 w-full rounded-xl border border-border bg-card pr-9 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              {screen.simpleInput.length > 0 && (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  onClick={() => {
                    screen.setSimpleInput("");
                    screen.list.clearSearch();
                  }}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              data-testid="open-advanced-search-btn"
              aria-label="Búsqueda avanzada"
              onClick={() => screen.setAdvancedOpen(true)}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-2xs hover:bg-muted"
            >
              <SlidersHorizontalIcon className="size-4" />
            </button>
          </form>

          {screen.isFormPending && !screen.formDrawerOpen && (
            <PendingFormBanner
              pendingKind={screen.pendingKind}
              onReopen={() => screen.setFormDrawerOpen(true)}
            />
          )}

          {isStateTransitionOp(screen.pendingKind) && selectedRow && (
            <StateTransitionCard
              kind={screen.pendingKind}
              singularLabel={config.singularLabel}
              rowCode={config.getRowCode(selectedRow)}
              rowNom={config.getRowNom(selectedRow)}
              currentState={config.getRowState(selectedRow)}
              isSaving={isSaving}
              onConfirmGuardar={() => {
                void screen.handleGuardarAction();
              }}
              onCancelar={screen.handleCancelPending}
            />
          )}

          <div className="flex items-center justify-between px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <div className="flex items-center gap-4">
              <span>Cód.</span>
              <span>Nombre</span>
            </div>
            <span>Estado</span>
          </div>

          <section
            aria-label="Lista de países"
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
          >
            {screen.list.isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Cargando países...
              </div>
            ) : screen.list.isError ? (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <p className="m-0 text-sm text-destructive">
                  Error al consultar países.
                </p>
                <button
                  type="button"
                  onClick={() => void screen.list.refetch()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Reintentar
                </button>
              </div>
            ) : screen.list.rows.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {config.emptyMessage}
              </div>
            ) : (
              <ul className="m-0 divide-y divide-border p-0">
                {screen.list.rows.map((row) => {
                  const code = config.getRowCode(row);
                  const nom = config.getRowNom(row);
                  const est = config.getRowState(row);
                  const stateMeta = getStateMeta(est);
                  const isSelected = screen.selectedCode === code;

                  return (
                    <li key={code} className="list-none">
                      <button
                        type="button"
                        data-testid={`record-row-${code}`}
                        onClick={() => screen.controller.selectRow(row)}
                        className={`relative flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors ${
                          isSelected
                            ? "bg-secondary/80"
                            : "bg-card hover:bg-muted/50"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-2 bottom-2 left-1 w-1 rounded-full bg-primary" />
                        )}
                        <div className="flex min-w-0 items-center gap-4">
                          <span className="w-7 shrink-0 font-mono text-sm font-semibold text-muted-foreground">
                            {formatPaisCode(code)}
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {nom}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {isSelected
                                ? "Seleccionado para operar"
                                : "Registro de catálogo"}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statePillClasses(est)}`}
                        >
                          {stateMeta.code} · {stateMeta.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>{screen.list.rows.length} visibles</span>
            <div className="flex items-center gap-3 font-medium">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-600" />
                {stateCounts.active} A
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-amber-600" />
                {stateCounts.inactive} I
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-rose-600" />
                {stateCounts.deleted} *
              </span>
            </div>
          </div>
        </main>
      </IonContent>

      <IonFooter className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-3 py-2.5">
          {selectedRow && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/70 px-3 py-1.5 text-xs">
              <div className="flex min-w-0 items-center gap-1.5 text-foreground">
                <CheckCircle2Icon className="size-3.5 shrink-0 text-primary" />
                <span className="text-muted-foreground">Seleccionado</span>
                <span className="truncate font-semibold">
                  #{config.getRowCode(selectedRow)} ·{" "}
                  {config.getRowNom(selectedRow)}
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statePillClasses(
                  config.getRowState(selectedRow),
                )}`}
              >
                {getStateMeta(config.getRowState(selectedRow)).code} ·{" "}
                {getStateMeta(config.getRowState(selectedRow)).label}
              </span>
            </div>
          )}

          <div className="grid grid-cols-5 gap-1.5">
            <button
              type="button"
              data-testid="op-adicionar"
              disabled={hasPending || isSaving}
              onClick={screen.handleStartAdicion}
              className="h-10 rounded-xl bg-primary px-1 text-xs font-semibold text-primary-foreground disabled:opacity-45"
            >
              Adicionar
            </button>
            <button
              type="button"
              data-testid="op-modificar"
              disabled={hasPending || isSaving}
              onClick={screen.handleStartModificacion}
              className="h-10 rounded-xl border border-border bg-card px-1 text-xs font-medium text-foreground disabled:opacity-45"
            >
              Modificar
            </button>
            <button
              type="button"
              data-testid="op-inactivar"
              disabled={hasPending || isSaving}
              onClick={() => screen.controller.startInactivar()}
              className="h-10 rounded-xl border border-border bg-card px-1 text-xs font-medium text-foreground disabled:opacity-45"
            >
              Inactivar
            </button>
            <button
              type="button"
              data-testid="op-reactivar"
              disabled={hasPending || isSaving}
              onClick={() => screen.controller.startReactivar()}
              className="h-10 rounded-xl border border-border bg-card px-1 text-xs font-medium text-foreground disabled:opacity-45"
            >
              Reactivar
            </button>
            <button
              type="button"
              data-testid="op-eliminar"
              disabled={hasPending || isSaving}
              onClick={() => screen.controller.startEliminar()}
              className="h-10 rounded-xl bg-rose-50 px-1 text-xs font-semibold text-rose-700 disabled:opacity-45"
            >
              Eliminar
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              data-testid="op-buscar"
              disabled={isSaving}
              onClick={() => screen.setAdvancedOpen(true)}
              className="h-10 rounded-xl border border-border bg-card text-xs font-semibold text-foreground disabled:opacity-45"
            >
              Buscar
            </button>
            <button
              type="button"
              data-testid="op-guardar"
              disabled={!hasPending || isSaving}
              onClick={() => void screen.handleGuardarAction()}
              className="h-10 rounded-xl bg-secondary text-xs font-semibold text-primary disabled:opacity-45"
            >
              Guardar
            </button>
            <button
              type="button"
              data-testid="op-cancelar"
              disabled={!hasPending || isSaving}
              onClick={screen.handleCancelPending}
              className="h-10 rounded-xl border border-border bg-card text-xs font-semibold text-foreground disabled:opacity-45"
            >
              Cancelar
            </button>
            <button
              type="button"
              data-testid="op-salir"
              onClick={screen.handleSalir}
              className="h-10 rounded-xl border border-border bg-card text-xs font-semibold text-foreground"
            >
              Salir
            </button>
          </div>
        </div>
      </IonFooter>

      <AdvancedSearchDrawer
        open={screen.advancedOpen}
        onOpenChange={screen.setAdvancedOpen}
        tableLabel={config.tableLabel}
        filters={screen.list.advancedFilters}
        onApply={(filters) => {
          screen.setSimpleInput("");
          screen.list.applyAdvancedSearch(filters);
        }}
        onReset={() => {
          screen.setSimpleInput("");
          screen.list.clearSearch();
        }}
      />

      {screen.isFormPending && (
        <ReferenceFormDrawer
          open={screen.formDrawerOpen}
          onOpenChange={screen.setFormDrawerOpen}
          sessionKey={screen.formSessionKey}
          mode={screen.formMode}
          config={config}
          draft={screen.formDraft}
          onDraftChange={screen.setFormDraft}
          estReg={screen.drawerEstReg}
          externalFailures={screen.externalFailures}
          isSaving={isSaving}
          submitTriggerRef={screen.submitTriggerRef}
          onSubmitPayload={screen.handleSubmitPayload}
          onNotifyBatchErrors={(failures) =>
            screen.feedback.notifyBatchErrors(failures)
          }
          onCancelPending={screen.handleCancelPending}
          onHideDrawer={() => screen.setFormDrawerOpen(false)}
          onSalir={screen.handleSalir}
        />
      )}
    </IonPage>
  );
}
