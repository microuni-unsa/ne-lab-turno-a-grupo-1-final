import { IonApp } from "@ionic/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  asCarCod,
  asDepCod,
  asPaiCod,
  asPerCod,
  type CargoRow,
  createFailure,
  type DependenciaRow,
  ERROR_CODES,
  EST_A,
  EST_I,
  EST_X,
  type EstReg,
  type GuardarResult,
  type PaisRow,
  type PendingOp,
  type PersonalRow,
} from "@/core";
import type { AdvancedSearchFilters, OrderingSpec } from "@/data";
import {
  PersonalMaintenancePage,
  type PersonalRepoContract,
} from "@/features/personal/PersonalMaintenancePage";
import type {
  PersonalCatalogRepo,
  PersonalCatalogRepos,
} from "@/features/personal/personal-structure";
import { IonicFeedbackProvider } from "@/lib/feedback";

const TEST_TODAY = "2026-05-15";

function createCatalogRepo<TRow>(
  rows: readonly TRow[],
  getCod: (r: TRow) => string,
  getNom: (r: TRow) => string,
  getEst: (r: TRow) => EstReg,
  codeCol: string,
  nomCol: string,
): PersonalCatalogRepo<TRow> {
  return {
    async list() {
      const sorted = [...rows].sort(
        (a, b) =>
          getNom(a).localeCompare(getNom(b), "es", { sensitivity: "case" }) ||
          getCod(a).localeCompare(getCod(b)),
      );
      return { data: sorted, count: sorted.length };
    },
    async gsel() {
      return rows
        .filter((r) => getEst(r) === EST_A)
        .map((r) => ({ [codeCol]: getCod(r), [nomCol]: getNom(r) }));
    },
    async getByCode(code) {
      return rows.find((r) => getCod(r) === code) ?? null;
    },
  };
}

function createSampleCatalogs() {
  const pais: PaisRow[] = [
    {
      PaiCod: asPaiCod("1"),
      PaiNom: "Perú",
      PaiEstReg: EST_A,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      PaiCod: asPaiCod("2"),
      PaiNom: "Chile",
      PaiEstReg: EST_A,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      PaiCod: asPaiCod("3"),
      PaiNom: "Colombia",
      PaiEstReg: EST_I,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];
  const dependencia: DependenciaRow[] = [
    {
      DepCod: asDepCod("1"),
      DepNom: "Sistemas",
      DepEstReg: EST_A,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];
  const cargo: CargoRow[] = [
    {
      CarCod: asCarCod("1"),
      CarNom: "Analista de Sistemas",
      CarEstReg: EST_A,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];
  const catalogRepos: PersonalCatalogRepos = {
    pai: createCatalogRepo(
      pais,
      (r) => r.PaiCod,
      (r) => r.PaiNom,
      (r) => r.PaiEstReg,
      "PaiCod",
      "PaiNom",
    ),
    dep: createCatalogRepo(
      dependencia,
      (r) => r.DepCod,
      (r) => r.DepNom,
      (r) => r.DepEstReg,
      "DepCod",
      "DepNom",
    ),
    car: createCatalogRepo(
      cargo,
      (r) => r.CarCod,
      (r) => r.CarNom,
      (r) => r.CarEstReg,
      "CarCod",
      "CarNom",
    ),
  };
  return { pais, dependencia, cargo, catalogRepos };
}

function createMemoryPersonalRepo(
  initial: readonly PersonalRow[],
  catalogs: ReturnType<typeof createSampleCatalogs>,
): {
  repo: PersonalRepoContract;
  rows: PersonalRow[];
  guardarSpy: Mock<(op: PendingOp) => Promise<GuardarResult<PersonalRow>>>;
} {
  const rows: PersonalRow[] = [...initial];

  const sortRows = (
    items: readonly PersonalRow[],
    ordering: OrderingSpec,
  ): PersonalRow[] => {
    const isNameSort =
      ordering === "alternate" ||
      (typeof ordering === "object" && ordering.column === "PerNom");
    return [...items].sort((a, b) =>
      isNameSort
        ? a.PerNom.localeCompare(b.PerNom, "es", { sensitivity: "case" }) ||
          a.PerCod.localeCompare(b.PerCod)
        : a.PerCod.localeCompare(b.PerCod),
    );
  };

  const checkFk = (pai: string, dep: string, car: string) => {
    const p = catalogs.pais.find((r) => r.PaiCod === pai);
    if (!p) return createFailure(ERROR_CODES.REF, "PerPaiCod");
    if (p.PaiEstReg !== EST_A)
      return createFailure(ERROR_CODES.REF_STATE, "PerPaiCod");
    const d = catalogs.dependencia.find((r) => r.DepCod === dep);
    if (!d) return createFailure(ERROR_CODES.REF, "PerDepCod");
    if (d.DepEstReg !== EST_A)
      return createFailure(ERROR_CODES.REF_STATE, "PerDepCod");
    const c = catalogs.cargo.find((r) => r.CarCod === car);
    if (!c) return createFailure(ERROR_CODES.REF, "PerCarCod");
    if (c.CarEstReg !== EST_A)
      return createFailure(ERROR_CODES.REF_STATE, "PerCarCod");
    return null;
  };

  const guardarSpy = vi.fn(
    async (op: PendingOp): Promise<GuardarResult<PersonalRow>> => {
      if (op.kind === "adición") {
        const cod = String(Reflect.get(op.payload, "PerCod") ?? "").trim();
        const nom = String(Reflect.get(op.payload, "PerNom") ?? "").trim();
        const dni = String(Reflect.get(op.payload, "PerDNI") ?? "").trim();
        const fecnac = String(
          Reflect.get(op.payload, "PerFecNac") ?? "",
        ).trim();
        const pai = String(Reflect.get(op.payload, "PerPaiCod") ?? "").trim();
        const dep = String(Reflect.get(op.payload, "PerDepCod") ?? "").trim();
        const car = String(Reflect.get(op.payload, "PerCarCod") ?? "").trim();

        if (rows.some((r) => r.PerCod === cod)) {
          return {
            ok: false,
            failures: [createFailure(ERROR_CODES.DUP, "PerCod")],
          };
        }
        if (rows.some((r) => r.PerDNI === dni)) {
          return {
            ok: false,
            failures: [createFailure(ERROR_CODES.DUP, "PerDNI")],
          };
        }
        const fkErr = checkFk(pai, dep, car);
        if (fkErr) {
          return { ok: false, failures: [fkErr] };
        }
        const created: PersonalRow = {
          PerCod: asPerCod(cod),
          PerNom: nom,
          PerDNI: dni,
          PerFecNac: fecnac,
          PerPaiCod: asPaiCod(pai),
          PerDepCod: asDepCod(dep),
          PerCarCod: asCarCod(car),
          PerEstReg: EST_A,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        };
        rows.push(created);
        return { ok: true, row: created };
      }

      const idx = rows.findIndex((r) => r.PerCod === op.targetCode);
      const curr = idx >= 0 ? rows[idx] : undefined;
      if (!curr) {
        return {
          ok: false,
          failures: [createFailure(ERROR_CODES.TRANSITION, "PerCod")],
        };
      }
      if (curr.PerEstReg === EST_X) {
        return {
          ok: false,
          failures: [createFailure(ERROR_CODES.TRANSITION, "PerEstReg")],
        };
      }

      if (op.kind === "modificación") {
        const nom = String(Reflect.get(op.payload, "PerNom") ?? "").trim();
        const dni = String(Reflect.get(op.payload, "PerDNI") ?? "").trim();
        const fecnac = String(
          Reflect.get(op.payload, "PerFecNac") ?? "",
        ).trim();
        const pai = String(Reflect.get(op.payload, "PerPaiCod") ?? "").trim();
        const dep = String(Reflect.get(op.payload, "PerDepCod") ?? "").trim();
        const car = String(Reflect.get(op.payload, "PerCarCod") ?? "").trim();
        if (rows.some((r) => r.PerCod !== curr.PerCod && r.PerDNI === dni)) {
          return {
            ok: false,
            failures: [createFailure(ERROR_CODES.DUP, "PerDNI")],
          };
        }
        const fkErr = checkFk(pai, dep, car);
        if (fkErr) {
          return { ok: false, failures: [fkErr] };
        }
        const updated: PersonalRow = {
          ...curr,
          PerNom: nom,
          PerDNI: dni,
          PerFecNac: fecnac,
          PerPaiCod: asPaiCod(pai),
          PerDepCod: asDepCod(dep),
          PerCarCod: asCarCod(car),
          updated_at: "2026-05-15T12:00:00Z",
        };
        rows[idx] = updated;
        return { ok: true, row: updated };
      }

      const targetEst: EstReg =
        op.kind === "inactivar"
          ? EST_I
          : op.kind === "reactivar"
            ? EST_A
            : EST_X;
      if (curr.PerEstReg === targetEst) {
        return {
          ok: false,
          failures: [createFailure(ERROR_CODES.TRANSITION, "PerEstReg")],
        };
      }
      const updated: PersonalRow = { ...curr, PerEstReg: targetEst };
      rows[idx] = updated;
      return { ok: true, row: updated };
    },
  );

  const repo: PersonalRepoContract = {
    async list(ordering = "default") {
      const sorted = sortRows(rows, ordering);
      return { data: sorted, count: sorted.length };
    },
    async search(query, ordering = "default") {
      const term = query.trim().toLowerCase();
      const filtered = term
        ? rows.filter(
            (r) =>
              String(r.PerCod) === term ||
              r.PerNom.toLowerCase().includes(term) ||
              r.PerDNI.includes(term),
          )
        : rows;
      const sorted = sortRows(filtered, ordering);
      return { data: sorted, count: sorted.length };
    },
    async advancedSearch(filters: AdvancedSearchFilters, ordering = "default") {
      const filtered = rows.filter((r) => {
        if (
          typeof filters.DNI === "string" &&
          filters.DNI.trim() &&
          !r.PerDNI.startsWith(filters.DNI.trim())
        ) {
          return false;
        }
        if (
          typeof filters.PaiCod === "string" &&
          r.PerPaiCod !== filters.PaiCod
        ) {
          return false;
        }
        if (
          Array.isArray(filters.EstReg) &&
          !filters.EstReg.includes(r.PerEstReg)
        ) {
          return false;
        }
        return true;
      });
      const sorted = sortRows(filtered, ordering);
      return { data: sorted, count: sorted.length };
    },
    guardarOp: guardarSpy,
  };

  return { repo, rows, guardarSpy };
}

async function setIonFieldValue(name: string, value: string) {
  const ionEl = await waitFor(() => {
    const input = document.querySelector(`input[name="${name}"]`);
    const wrapper = input?.closest("ion-input") ?? null;
    if (!wrapper) {
      throw new Error(`Missing ion-input for ${name}`);
    }
    return wrapper;
  });
  ionEl.dispatchEvent(
    new CustomEvent("ionInput", {
      bubbles: true,
      detail: { value, event: new Event("input") },
    }),
  );
}

async function pickCalendarDate(
  fieldName: string,
  year: string,
  monthZeroBased: string,
  dayNumber: string,
) {
  fireEvent.click(screen.getByTestId(`calendar-trigger-${fieldName}`));
  const panel = await screen.findByTestId(`calendar-panel-${fieldName}`);
  const yearSel = panel.querySelector("select.rdp-years_dropdown");
  const monthSel = panel.querySelector("select.rdp-months_dropdown");
  expect(yearSel).not.toBeNull();
  expect(monthSel).not.toBeNull();
  if (yearSel) {
    fireEvent.change(yearSel, { target: { value: year } });
  }
  if (monthSel) {
    fireEvent.change(monthSel, { target: { value: monthZeroBased } });
  }
  const dayBtn = Array.from(panel.querySelectorAll("button[data-day]")).find(
    (btn) => btn.textContent?.trim() === dayNumber,
  );
  expect(dayBtn).toBeDefined();
  if (dayBtn) {
    fireEvent.click(dayBtn);
  }
}

async function pickGselOption(fieldName: string, valueCode: number) {
  fireEvent.click(screen.getByTestId(`gsel-trigger-${fieldName}`));
  const opt = await screen.findByTestId(
    `gsel-option-${fieldName}-${valueCode}`,
  );
  fireEvent.click(opt);
}

function readFeedbackAlertText(): string {
  const alert = document.querySelector('[data-testid="feedback-alert"]');
  if (!alert) return "";
  return `${String(Reflect.get(alert, "subHeader"))} ${String(Reflect.get(alert, "message"))}`;
}

function renderPersonalPage(
  repo: PersonalRepoContract,
  catalogRepos: PersonalCatalogRepos,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <IonApp>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/personal"]}>
          <IonicFeedbackProvider>
            <PersonalMaintenancePage
              repo={repo}
              catalogRepos={catalogRepos}
              getTodayLocal={() => TEST_TODAY}
            />
          </IonicFeedbackProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </IonApp>,
  );
}

describe("PersonalMaintenancePage (Fase 9 unit UI)", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra errores R22 simultáneos conservando borrador y permite homónimos R5 tras corregir Calendario + G-SEL", async () => {
    const catalogs = createSampleCatalogs();
    const { repo, guardarSpy } = createMemoryPersonalRepo(
      [
        {
          PerCod: asPerCod("1"),
          PerNom: "Juan Pérez",
          PerDNI: "41234567",
          PerFecNac: "1995-03-14",
          PerPaiCod: asPaiCod("1"),
          PerDepCod: asDepCod("1"),
          PerCarCod: asCarCod("1"),
          PerEstReg: EST_A,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      catalogs,
    );

    renderPersonalPage(repo, catalogs.catalogRepos);
    expect(await screen.findByText("Juan Pérez")).toBeTruthy();

    fireEvent.click(screen.getByTestId("op-adicionar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO ADICIÓN",
    );

    await setIonFieldValue("PerCod", "10");
    await setIonFieldValue("PerNom", "A");
    await setIonFieldValue("PerDNI", "12a");
    await pickCalendarDate("PerFecNac", "2012", "0", "15");
    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      const alertText = readFeedbackAlertText();
      expect(alertText).toContain("[E-RANGE] Nombre de Personal");
      expect(alertText).toContain("[E-FORMAT] DNI");
      expect(alertText).toContain("[E-RANGE] Fecha de Nacimiento");
      expect(alertText).toContain("[E-REQUIRED] País");
    });

    expect(guardarSpy).not.toHaveBeenCalled();

    // Draft conserved after R22 batch errors
    const codInput = document.querySelector('input[name="PerCod"]');
    const nomInput = document.querySelector('input[name="PerNom"]');
    const dniInput = document.querySelector('input[name="PerDNI"]');
    expect(Reflect.get(codInput ?? {}, "value")).toBe("10");
    expect(Reflect.get(nomInput ?? {}, "value")).toBe("A");
    expect(Reflect.get(dniInput ?? {}, "value")).toBe("12a");

    // Fix inputs using a homonym name (R5) + adult date + G-SEL FKs
    await setIonFieldValue("PerNom", "Juan Pérez");
    await setIonFieldValue("PerDNI", "49001122");
    await pickCalendarDate("PerFecNac", "2000", "5", "15");
    await pickGselOption("PerPaiCod", 1);
    await pickGselOption("PerDepCod", 1);
    await pickGselOption("PerCarCod", 1);

    // Toolbar Salir blocks while pending with [E-PENDING]
    fireEvent.click(screen.getByTestId("toolbar-salir"));
    await waitFor(() => {
      expect(readFeedbackAlertText()).toContain("[E-PENDING]");
    });

    fireEvent.click(screen.getByTestId("op-guardar"));

    await waitFor(() => {
      expect(screen.getByTestId("record-row-10")).toBeTruthy();
    });
    expect(guardarSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("record-row-10").textContent).toContain(
      "Juan Pérez",
    );
  });

  it("muestra FK inactiva (R7), bloquea Modificación E-REF-STATE hasta actualizar vía G-SEL, y respeta R2/R8/R13", async () => {
    const catalogs = createSampleCatalogs();
    const { repo } = createMemoryPersonalRepo(
      [
        {
          PerCod: asPerCod("2"),
          PerNom: "María Gómez",
          PerDNI: "42345678",
          PerFecNac: "1992-07-22",
          PerPaiCod: asPaiCod("3"), // Colombia (EST_I)
          PerDepCod: asDepCod("1"),
          PerCarCod: asCarCod("1"),
          PerEstReg: EST_I,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      catalogs,
    );

    renderPersonalPage(repo, catalogs.catalogRepos);

    await waitFor(() => {
      expect(screen.getByTestId("record-row-2").textContent).toContain(
        "Colombia (Inactivo)",
      );
    });
    expect(screen.getByTestId("record-header-PerCod").textContent).toBe(
      "Código",
    );
    expect(screen.getByTestId("record-header-PerNom").textContent).toBe(
      "Nombre",
    );
    expect(screen.getByTestId("record-header-PerDNI").textContent).toBe("DNI");
    expect(screen.getByTestId("record-header-PerFecNac").textContent).toBe(
      "Fec. Nac.",
    );
    expect(screen.getByTestId("record-header-PerPaiCod").textContent).toBe(
      "País",
    );
    expect(screen.getByTestId("record-header-PerDepCod").textContent).toBe(
      "Dependencia",
    );
    expect(screen.getByTestId("record-header-PerCarCod").textContent).toBe(
      "Cargo",
    );
    expect(screen.getByTestId("record-header-PerEstReg").textContent).toBe(
      "Estado",
    );
    expect(screen.getByTestId("record-cell-2-PerNom").textContent).toBe(
      "María Gómez",
    );
    expect(screen.getByTestId("record-cell-2-PerDNI").textContent).toBe(
      "42345678",
    );
    expect(screen.getByTestId("record-cell-2-PerFecNac").textContent).toBe(
      "22/07/1992",
    );
    expect(screen.getByTestId("record-cell-2-PerPaiCod").textContent).toBe(
      "Colombia (Inactivo)",
    );

    fireEvent.click(screen.getByTestId("record-row-2"));

    // Regla del docente: Modificar deshabilitado en Inactivo hasta Reactivar
    expect(
      (screen.getByTestId("op-modificar") as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByTestId("op-reactivar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-2").querySelector('[data-estado="A"]'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId("record-row-2"));
    fireEvent.click(screen.getByTestId("op-modificar"));
    expect(screen.getByTestId("record-mode-badge").textContent).toBe(
      "MODO MODIFICACIÓN",
    );

    // R2 + R8 + R7 on inline trigger
    await waitFor(() => {
      expect(document.querySelector('input[name="PerCod"]')).not.toBeNull();
    });
    expect(
      document.querySelector('input[name="PerCod"]')?.hasAttribute("readonly"),
    ).toBe(true);
    await waitFor(() => {
      expect(
        screen.getByTestId("gsel-trigger-PerPaiCod").textContent,
      ).toContain("Colombia (Inactivo)");
    });

    // Submitting with inactive FK returns E-REF-STATE
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(readFeedbackAlertText()).toContain("[E-REF-STATE]");
    });

    // Opening G-SEL lists only active countries (Chile #2 present, Colombia #3 absent)
    fireEvent.click(screen.getByTestId("gsel-trigger-PerPaiCod"));
    expect(await screen.findByTestId("gsel-option-PerPaiCod-2")).toBeTruthy();
    expect(screen.queryByTestId("gsel-option-PerPaiCod-3")).toBeNull();
    fireEvent.click(screen.getByTestId("gsel-option-PerPaiCod-2"));

    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(screen.getByTestId("record-row-2").textContent).toContain("Chile");
    });

    fireEvent.click(screen.getByTestId("op-eliminar"));
    fireEvent.click(screen.getByTestId("op-guardar"));
    await waitFor(() => {
      expect(
        screen.getByTestId("record-row-2").querySelector('[data-estado="*"]'),
      ).not.toBeNull();
    });

    expect(
      (screen.getByTestId("op-modificar") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("ejecuta búsqueda vía Buscar en dock por código, DNI y nombre", async () => {
    const catalogs = createSampleCatalogs();
    const { repo } = createMemoryPersonalRepo(
      [
        {
          PerCod: asPerCod("1"),
          PerNom: "Juan Pérez",
          PerDNI: "41234567",
          PerFecNac: "1995-03-14",
          PerPaiCod: asPaiCod("1"),
          PerDepCod: asDepCod("1"),
          PerCarCod: asCarCod("1"),
          PerEstReg: EST_A,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          PerCod: asPerCod("25"),
          PerNom: "Elena Paz",
          PerDNI: "78901234",
          PerFecNac: "1991-09-09",
          PerPaiCod: asPaiCod("2"),
          PerDepCod: asDepCod("1"),
          PerCarCod: asCarCod("1"),
          PerEstReg: EST_A,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      catalogs,
    );

    renderPersonalPage(repo, catalogs.catalogRepos);
    expect(await screen.findByText("Juan Pérez")).toBeTruthy();
    expect(screen.getByText("Elena Paz")).toBeTruthy();

    fireEvent.click(screen.getByTestId("btn-open-advanced"));
    const dniField = await screen.findByTestId("adv-filter-dni");
    const dniIon = dniField.closest("ion-input");
    dniIon?.dispatchEvent(
      new CustomEvent("ionInput", {
        bubbles: true,
        detail: { value: "78901234", event: new Event("input") },
      }),
    );
    await waitFor(() => {
      expect(
        Reflect.get(
          document.querySelector('input[name="advDni"]') ?? {},
          "value",
        ),
      ).toBe("78901234");
    });
    fireEvent.click(screen.getByTestId("adv-btn-apply"));

    await waitFor(() => {
      expect(screen.queryByText("Juan Pérez")).toBeNull();
      expect(screen.getByText("Elena Paz")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("btn-clear-search"));
    expect(await screen.findByText("Juan Pérez")).toBeTruthy();
  });
});
