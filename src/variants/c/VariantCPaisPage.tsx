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
  ArrowRightIcon,
  ArrowUpDownIcon,
  CheckIcon,
  LogOutIcon,
  PauseCircleIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import * as React from "react";
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

export interface VariantCPaisPageProps {
  readonly client?: SupabaseClient;
  readonly repo?: ReferenceRepoContract<PaisRow>;
}

function consoleBadgeClasses(estReg: EstReg): string {
  switch (estReg) {
    case EST_A:
      return "border-primary/60 bg-primary/10 text-primary";
    case EST_I:
      return "border-amber-500/60 bg-amber-500/10 text-amber-400";
    case EST_X:
      return "border-rose-500/60 bg-rose-500/10 text-rose-400";
  }
}

export function VariantCPaisPage({ client, repo }: VariantCPaisPageProps) {
  const {
    config,
    screen,
    stateCounts,
    activeSingleStateFilter,
    applySingleStateFilter,
  } = usePaisVariantScreen({ client, repo });

  const [viewMode, setViewMode] = React.useState<"grid" | "inspector">("grid");

  const selectedRow = screen.controller.selectedRow;
  const hasPending = screen.controller.hasPending;
  const isSaving = screen.controller.isSaving;

  React.useEffect(() => {
    if (!selectedRow && viewMode === "inspector" && !hasPending) {
      setViewMode("grid");
    }
  }, [hasPending, selectedRow, viewMode]);

  return (
    <IonPage id="variant-c-pais-page">
      <IonHeader className="ion-no-border border-b border-border bg-background">
        <IonToolbar>
          <div className="mx-auto flex w-full max-w-md items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Volver"
                onClick={() => {
                  if (viewMode === "inspector") {
                    setViewMode("grid");
                  } else {
                    screen.handleSalir();
                  }
                }}
                className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-accent"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <div className="flex flex-col">
                <span className="variant-c-mono text-[10px] text-muted-foreground">
                  {viewMode === "inspector"
                    ? "MAESTRO / PAÍS / INSPECTOR"
                    : "MAESTRO / PAÍS"}
                </span>
                <h1 className="m-0 text-lg font-bold text-foreground">
                  {viewMode === "inspector" && selectedRow
                    ? `Ficha ${formatPaisCode(config.getRowCode(selectedRow))}`
                    : config.title}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedRow && (
                <button
                  type="button"
                  data-testid="variant-c-toggle-view"
                  onClick={() =>
                    setViewMode((prev) =>
                      prev === "grid" ? "inspector" : "grid",
                    )
                  }
                  className="variant-c-mono rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-primary"
                >
                  {viewMode === "grid" ? "INSPECTOR" : "GRID"}
                </button>
              )}
              <span className="variant-c-mono inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                PAIS
              </span>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 py-3 pb-6">
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

          {viewMode === "grid" ? (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  screen.list.applySimpleSearch(screen.simpleInput);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
                  <input
                    type="search"
                    value={screen.simpleInput}
                    onChange={(e) => screen.setSimpleInput(e.target.value)}
                    placeholder={config.searchPlaceholder}
                    aria-label={config.searchPlaceholder}
                    className="variant-c-mono h-10 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  data-testid="open-advanced-search-btn"
                  aria-label="Búsqueda avanzada"
                  onClick={() => screen.setAdvancedOpen(true)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-accent"
                >
                  <SlidersHorizontalIcon className="size-4" />
                </button>
              </form>

              <div className="flex items-center justify-between gap-2">
                <div className="variant-c-mono flex flex-wrap items-center gap-1.5 text-[11px]">
                  {(
                    [
                      {
                        key: "ALL",
                        label: `TODOS ${screen.list.totalCount}`,
                      },
                      { key: EST_A, label: `A ${stateCounts.active}` },
                      { key: EST_I, label: `I ${stateCounts.inactive}` },
                      { key: EST_X, label: `* ${stateCounts.deleted}` },
                    ] as const
                  ).map((chip) => {
                    const active = activeSingleStateFilter === chip.key;
                    return (
                      <button
                        key={String(chip.key)}
                        type="button"
                        onClick={() => applySingleStateFilter(chip.key)}
                        className={`rounded-md border px-2.5 py-1 font-semibold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  data-testid="toggle-ordering-btn"
                  onClick={() => screen.list.toggleOrdering()}
                  className="variant-c-mono inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <ArrowUpDownIcon className="size-3" />
                  {screen.list.orderingLabel}
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="variant-c-mono grid grid-cols-[44px_1fr_auto] gap-2 border-b border-border px-3 py-2 text-[10px] text-muted-foreground">
                  <span>COD</span>
                  <span>PAÍS</span>
                  <span>ESTADO</span>
                </div>

                {screen.list.isLoading ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Cargando países...
                  </div>
                ) : screen.list.rows.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    {config.emptyMessage}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {screen.list.rows.map((row) => {
                      const code = config.getRowCode(row);
                      const nom = config.getRowNom(row);
                      const est = config.getRowState(row);
                      const meta = getStateMeta(est);
                      const isSelected = screen.selectedCode === code;

                      return (
                        <button
                          key={code}
                          type="button"
                          data-testid={`record-row-${code}`}
                          onClick={() => screen.controller.selectRow(row)}
                          className={`relative grid w-full grid-cols-[44px_1fr_auto] items-center gap-2 px-3 py-3 text-left transition-colors ${
                            isSelected ? "bg-accent" : "hover:bg-accent/50"
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-1.5 bottom-1.5 left-0 w-1 bg-primary" />
                          )}
                          <span
                            className={`variant-c-mono text-xs font-bold ${
                              isSelected
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatPaisCode(code)}
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {nom}
                            </span>
                            <span className="variant-c-mono text-[11px] text-muted-foreground">
                              public.pais · PaiCod {code}
                            </span>
                          </div>
                          <span
                            className={`variant-c-mono flex size-7 items-center justify-center rounded-md border text-xs font-bold ${consoleBadgeClasses(est)}`}
                          >
                            {meta.code}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedRow && (
                <button
                  type="button"
                  data-testid="variant-c-open-inspector"
                  onClick={() => setViewMode("inspector")}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5 text-left"
                >
                  <div className="flex flex-col">
                    <span className="variant-c-mono text-[10px] text-muted-foreground">
                      SELECCIONADO ·{" "}
                      {formatPaisCode(config.getRowCode(selectedRow))}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {config.getRowNom(selectedRow)}
                    </span>
                  </div>
                  <span className="variant-c-mono inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    INSPECTOR
                    <ArrowRightIcon className="size-3.5" />
                  </span>
                </button>
              )}
            </>
          ) : (
            selectedRow && (
              <>
                <section className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-1">
                    <span className="variant-c-mono text-xs text-primary">
                      CÓDIGO {formatPaisCode(config.getRowCode(selectedRow))}
                    </span>
                    <h2 className="m-0 text-2xl font-bold text-foreground">
                      {config.getRowNom(selectedRow)}
                    </h2>
                    <span className="variant-c-mono text-xs text-muted-foreground">
                      public.pais ·{" "}
                      {getStateMeta(config.getRowState(selectedRow)).label}
                    </span>
                  </div>
                  <span
                    className={`variant-c-mono flex size-12 items-center justify-center rounded-lg border text-lg font-bold ${consoleBadgeClasses(
                      config.getRowState(selectedRow),
                    )}`}
                  >
                    {getStateMeta(config.getRowState(selectedRow)).code}
                  </span>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="variant-c-mono flex items-center justify-between border-b border-border px-3.5 py-2 text-[10px] text-muted-foreground">
                    <span>CAMPOS DEL REGISTRO</span>
                    <span>3 CAMPOS</span>
                  </div>
                  <div className="variant-c-mono divide-y divide-border text-xs">
                    <div className="grid grid-cols-[90px_1fr_auto] items-center px-3.5 py-2.5">
                      <span className="text-muted-foreground">código</span>
                      <span className="text-foreground">
                        {formatPaisCode(config.getRowCode(selectedRow))}
                      </span>
                      <span className="text-[10px] text-primary">FIJO</span>
                    </div>
                    <div className="grid grid-cols-[90px_1fr_auto] items-center px-3.5 py-2.5">
                      <span className="text-muted-foreground">nombre</span>
                      <span className="truncate text-foreground">
                        {config.getRowNom(selectedRow)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        EDIT
                      </span>
                    </div>
                    <div className="grid grid-cols-[90px_1fr_auto] items-center px-3.5 py-2.5">
                      <span className="text-muted-foreground">estado</span>
                      <span className="text-primary">
                        {getStateMeta(config.getRowState(selectedRow)).code} ·{" "}
                        {getStateMeta(config.getRowState(selectedRow)).label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        OPS
                      </span>
                    </div>
                  </div>
                </section>
              </>
            )
          )}
        </main>
      </IonContent>

      <IonFooter className="border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-md flex-col gap-1.5 px-3 py-2.5">
          <div className="variant-c-mono flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {hasPending
                ? `PENDIENTE · ${screen.pendingKind?.toUpperCase()}`
                : "SIN OPERACIÓN PENDIENTE"}
            </span>
            <span>{hasPending ? "GUARDAR LISTO" : "GUARDAR BLOQUEADO"}</span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            <button
              type="button"
              data-testid="op-adicionar"
              disabled={hasPending || isSaving}
              onClick={screen.handleStartAdicion}
              className="flex h-10 items-center justify-center gap-1 rounded-lg bg-primary px-1 text-xs font-bold text-primary-foreground disabled:opacity-40"
            >
              <PlusIcon className="size-3.5" />
              <span>Adicionar</span>
            </button>
            <button
              type="button"
              data-testid="op-modificar"
              disabled={hasPending || isSaving}
              onClick={screen.handleStartModificacion}
              className="flex h-10 items-center justify-center gap-1 rounded-lg border border-border bg-card px-1 text-[11px] font-medium text-foreground disabled:opacity-40"
            >
              <PencilIcon className="size-3" />
              <span>Modificar</span>
            </button>
            <button
              type="button"
              data-testid="op-eliminar"
              disabled={hasPending || isSaving}
              onClick={() => screen.controller.startEliminar()}
              className="flex h-10 items-center justify-center gap-1 rounded-lg border border-border bg-card px-1 text-[11px] font-medium text-rose-400 disabled:opacity-40"
            >
              <Trash2Icon className="size-3" />
              <span>Eliminar</span>
            </button>
            <button
              type="button"
              data-testid="op-inactivar"
              disabled={hasPending || isSaving}
              onClick={() => screen.controller.startInactivar()}
              className="flex h-10 items-center justify-center gap-1 rounded-lg border border-border bg-card px-1 text-[11px] font-medium text-foreground disabled:opacity-40"
            >
              <PauseCircleIcon className="size-3" />
              <span>Inactivar</span>
            </button>
            <button
              type="button"
              data-testid="op-reactivar"
              disabled={hasPending || isSaving}
              onClick={() => screen.controller.startReactivar()}
              className="flex h-10 items-center justify-center gap-1 rounded-lg border border-border bg-card px-1 text-[11px] font-medium text-foreground disabled:opacity-40"
            >
              <RotateCcwIcon className="size-3" />
              <span>Reactivar</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              data-testid="op-buscar"
              disabled={isSaving}
              onClick={() => screen.setAdvancedOpen(true)}
              className="flex h-9 items-center justify-center gap-1 rounded-lg border border-border bg-card text-xs font-medium text-foreground disabled:opacity-40"
            >
              <SearchIcon className="size-3.5" />
              <span>Buscar</span>
            </button>
            <button
              type="button"
              data-testid="op-guardar"
              disabled={!hasPending || isSaving}
              onClick={() => void screen.handleGuardarAction()}
              className="flex h-9 items-center justify-center gap-1 rounded-lg border border-border bg-card text-xs font-semibold text-primary disabled:opacity-40"
            >
              <CheckIcon className="size-3.5" />
              <span>Guardar</span>
            </button>
            <button
              type="button"
              data-testid="op-cancelar"
              disabled={!hasPending || isSaving}
              onClick={screen.handleCancelPending}
              className="flex h-9 items-center justify-center gap-1 rounded-lg border border-border bg-card text-xs font-medium text-foreground disabled:opacity-40"
            >
              <XIcon className="size-3.5" />
              <span>Cancelar</span>
            </button>
            <button
              type="button"
              data-testid="op-salir"
              onClick={screen.handleSalir}
              className="flex h-9 items-center justify-center gap-1 rounded-lg border border-border bg-card text-xs font-medium text-foreground"
            >
              <LogOutIcon className="size-3.5" />
              <span>Salir</span>
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
