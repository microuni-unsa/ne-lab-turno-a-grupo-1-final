import { IonContent, IonHeader, IonPage, IonToolbar } from "@ionic/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpDownIcon,
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
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

export interface VariantBPaisPageProps {
  readonly client?: SupabaseClient;
  readonly repo?: ReferenceRepoContract<PaisRow>;
}

function stateBadgeStyle(estReg: EstReg): string {
  switch (estReg) {
    case EST_A:
      return "bg-emerald-100 text-emerald-900";
    case EST_I:
      return "bg-amber-100 text-amber-900";
    case EST_X:
      return "bg-rose-100 text-rose-900";
  }
}

export function VariantBPaisPage({ client, repo }: VariantBPaisPageProps) {
  const { config, screen, activeSingleStateFilter, applySingleStateFilter } =
    usePaisVariantScreen({ client, repo });

  const [viewMode, setViewMode] = React.useState<"buscador" | "ficha">(
    "buscador",
  );

  const selectedRow = screen.controller.selectedRow;
  const hasPending = screen.controller.hasPending;
  const isSaving = screen.controller.isSaving;

  React.useEffect(() => {
    if (!selectedRow && viewMode === "ficha" && !hasPending) {
      setViewMode("buscador");
    }
  }, [hasPending, selectedRow, viewMode]);

  return (
    <IonPage id="variant-b-pais-page">
      <IonHeader className="ion-no-border border-b border-border bg-background">
        <IonToolbar>
          <div className="mx-auto flex w-full max-w-md items-center justify-between px-3 py-2">
            <button
              type="button"
              onClick={() => {
                if (viewMode === "ficha") {
                  setViewMode("buscador");
                } else {
                  screen.handleSalir();
                }
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <ArrowLeftIcon className="size-4" />
              <span className="variant-b-serif text-lg">
                {viewMode === "ficha" ? "Países" : "Búsqueda"}
              </span>
            </button>

            <div className="flex items-center gap-2">
              {selectedRow && (
                <button
                  type="button"
                  data-testid="variant-b-toggle-view"
                  onClick={() =>
                    setViewMode((prev) =>
                      prev === "buscador" ? "ficha" : "buscador",
                    )
                  }
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-primary"
                >
                  {viewMode === "buscador" ? "Ver Ficha" : "Buscador"}
                </button>
              )}

              <button
                type="button"
                data-testid="op-salir"
                onClick={screen.handleSalir}
                className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                {hasPending && <LockIcon className="size-3 text-primary" />}
                Salir
              </button>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4 pb-10">
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

          {viewMode === "buscador" ? (
            <>
              <header className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                    PAIS ·{" "}
                    {activeSingleStateFilter === "ALL"
                      ? "TODOS LOS ESTADOS"
                      : `ESTADO ${getStateMeta(activeSingleStateFilter).code}`}
                  </span>
                  <button
                    type="button"
                    data-testid="toggle-ordering-btn"
                    onClick={() => screen.list.toggleOrdering()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                  >
                    <ArrowUpDownIcon className="size-3.5" />
                    {screen.list.orderingLabel}
                  </button>
                </div>
                <h1 className="variant-b-serif m-0 text-3xl font-normal text-foreground">
                  Buscar países
                </h1>
                <p className="m-0 text-xs text-muted-foreground">
                  Búsqueda simple por nombre o filtros avanzados por código y
                  estado.
                </p>
              </header>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  screen.list.applySimpleSearch(screen.simpleInput);
                }}
                className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-2xs"
              >
                <SearchIcon className="ml-2 size-4 shrink-0 text-muted-foreground" />
                <input
                  type="search"
                  value={screen.simpleInput}
                  onChange={(e) => screen.setSimpleInput(e.target.value)}
                  placeholder={config.searchPlaceholder}
                  aria-label={config.searchPlaceholder}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="button"
                  data-testid="open-advanced-search-btn"
                  onClick={() => screen.setAdvancedOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-secondary px-2.5 py-1.5 text-xs font-semibold text-primary"
                >
                  <SlidersHorizontalIcon className="size-3.5" />
                  Filtros
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { key: "ALL", label: "Todos" },
                    { key: EST_A, label: "A Activo" },
                    { key: EST_I, label: "I Inactivo" },
                    { key: EST_X, label: "* Eliminado" },
                  ] as const
                ).map((chip) => {
                  const active = activeSingleStateFilter === chip.key;
                  return (
                    <button
                      key={String(chip.key)}
                      type="button"
                      onClick={() => applySingleStateFilter(chip.key)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-secondary"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">
                  {screen.list.totalCount} REGISTROS
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    data-testid="op-adicionar"
                    disabled={hasPending || isSaving}
                    onClick={screen.handleStartAdicion}
                    className="inline-flex items-center gap-1 font-semibold text-primary disabled:opacity-45"
                  >
                    <PlusIcon className="size-3.5" />
                    Adicionar
                  </button>
                  {selectedRow && (
                    <button
                      type="button"
                      onClick={() => screen.controller.selectRow(null)}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="size-3.5" />
                      Limpiar selección
                    </button>
                  )}
                </div>
              </div>

              <section
                aria-label="Resultados de países"
                className="flex flex-col gap-2.5"
              >
                {screen.list.isLoading ? (
                  <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                    Cargando países...
                  </div>
                ) : screen.list.rows.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                    {config.emptyMessage}
                  </div>
                ) : (
                  screen.list.rows.map((row) => {
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
                        className={`relative flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                          isSelected
                            ? "border-primary bg-card shadow-xs"
                            : "border-border bg-card/80 hover:border-primary/40"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex size-11 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-semibold ${
                              isSelected
                                ? "border-primary bg-secondary text-primary"
                                : "border-border bg-muted text-muted-foreground"
                            }`}
                          >
                            {formatPaisCode(code)}
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="variant-b-serif truncate text-lg text-foreground">
                                {nom}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stateBadgeStyle(est)}`}
                              >
                                {meta.code} {meta.label}
                              </span>
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">
                              PaiCod {code}
                            </span>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <CheckIcon className="size-4" />
                          </span>
                        ) : (
                          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })
                )}
              </section>

              {selectedRow && (
                <button
                  type="button"
                  data-testid="variant-b-open-ficha"
                  onClick={() => setViewMode("ficha")}
                  className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-xs text-emerald-950"
                >
                  <span>
                    <strong>{config.getRowNom(selectedRow)}</strong>{" "}
                    seleccionado · abrir ficha para operar
                  </span>
                  <ArrowRightIcon className="size-4 shrink-0" />
                </button>
              )}
            </>
          ) : (
            selectedRow && (
              <>
                <section className="flex items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-secondary font-mono text-xl font-semibold text-primary">
                    {formatPaisCode(config.getRowCode(selectedRow))}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                      REGISTRO {formatPaisCode(config.getRowCode(selectedRow))}{" "}
                      · PAIS
                    </span>
                    <h1 className="variant-b-serif m-0 truncate text-3xl font-normal text-foreground">
                      {config.getRowNom(selectedRow)}
                    </h1>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stateBadgeStyle(
                          config.getRowState(selectedRow),
                        )}`}
                      >
                        {getStateMeta(config.getRowState(selectedRow)).code}{" "}
                        {getStateMeta(config.getRowState(selectedRow)).label}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        Código {config.getRowCode(selectedRow)}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold tracking-widest uppercase">
                    <span className="text-muted-foreground">
                      Trayectoria del estado
                    </span>
                    <span className="text-emerald-800">
                      Actual ·{" "}
                      {getStateMeta(config.getRowState(selectedRow)).label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-2 rounded-2xl border border-border bg-card p-3">
                    {(
                      [
                        { state: EST_A, code: "A", label: "Activo" },
                        { state: EST_I, code: "I", label: "Inactivo" },
                        { state: EST_X, code: "*", label: "Eliminado" },
                      ] as const
                    ).map((step) => {
                      const current =
                        config.getRowState(selectedRow) === step.state;
                      return (
                        <div
                          key={step.code}
                          className="flex items-center gap-2"
                        >
                          <span
                            className={`flex size-8 items-center justify-center rounded-full border text-xs font-bold ${
                              current
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-muted text-muted-foreground"
                            }`}
                          >
                            {step.code}
                          </span>
                          <span
                            className={`text-xs ${
                              current
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section
                  aria-label="Operaciones de ficha"
                  className="grid grid-cols-3 gap-2.5"
                >
                  <button
                    type="button"
                    data-testid="op-adicionar"
                    disabled={hasPending || isSaving}
                    onClick={screen.handleStartAdicion}
                    className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-45"
                  >
                    <PlusIcon className="size-4" />
                    Adicionar
                  </button>
                  <button
                    type="button"
                    data-testid="op-modificar"
                    disabled={hasPending || isSaving}
                    onClick={screen.handleStartModificacion}
                    className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-xs font-semibold text-foreground disabled:opacity-45"
                  >
                    <PencilIcon className="size-4" />
                    Modificar
                  </button>
                  <button
                    type="button"
                    data-testid="op-eliminar"
                    disabled={hasPending || isSaving}
                    onClick={() => screen.controller.startEliminar()}
                    className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-800 disabled:opacity-45"
                  >
                    <Trash2Icon className="size-4" />
                    Eliminar
                  </button>
                  <button
                    type="button"
                    data-testid="op-inactivar"
                    disabled={hasPending || isSaving}
                    onClick={() => screen.controller.startInactivar()}
                    className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-xs font-semibold text-foreground disabled:opacity-45"
                  >
                    <PauseCircleIcon className="size-4" />
                    Inactivar
                  </button>
                  <button
                    type="button"
                    data-testid="op-reactivar"
                    disabled={hasPending || isSaving}
                    onClick={() => screen.controller.startReactivar()}
                    className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-xs font-semibold text-foreground disabled:opacity-45"
                  >
                    <RotateCcwIcon className="size-4" />
                    Reactivar
                  </button>
                  <button
                    type="button"
                    data-testid="op-buscar"
                    disabled={isSaving}
                    onClick={() => screen.setAdvancedOpen(true)}
                    className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-xs font-semibold text-foreground disabled:opacity-45"
                  >
                    <SearchIcon className="size-4" />
                    Buscar
                  </button>
                  <button
                    type="button"
                    data-testid="op-guardar"
                    disabled={!hasPending || isSaving}
                    onClick={() => void screen.handleGuardarAction()}
                    className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-xs font-semibold text-primary disabled:opacity-45"
                  >
                    <CheckIcon className="size-4" />
                    Guardar
                  </button>
                  <button
                    type="button"
                    data-testid="op-cancelar"
                    disabled={!hasPending || isSaving}
                    onClick={screen.handleCancelPending}
                    className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-xs font-semibold text-foreground disabled:opacity-45"
                  >
                    <XIcon className="size-4" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={screen.handleSalir}
                    className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-xs font-semibold text-foreground"
                  >
                    <LogOutIcon className="size-4" />
                    Salir
                  </button>
                </section>

                <button
                  type="button"
                  onClick={() => setViewMode("buscador")}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
                >
                  <span className="inline-flex items-center gap-2">
                    <SearchIcon className="size-4 text-primary" />
                    Buscar otro registro
                  </span>
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    {screen.list.totalCount} registros
                    <ArrowRightIcon className="size-4" />
                  </span>
                </button>
              </>
            )
          )}
        </main>
      </IonContent>

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
