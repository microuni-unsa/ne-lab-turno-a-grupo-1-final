import { setupSupabaseMock } from "@e2e/support/supabase-mock";
import { expect, type Page, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const noOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);
}

async function dismissAlertWithTexts(page: Page, expectedSnippets: string[]) {
  const alert = page.locator("ion-alert");
  await expect(alert).toBeVisible();
  for (const snippet of expectedSnippets) {
    await expect(alert).toContainText(snippet);
  }
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(alert).toBeHidden();
}

async function pickCalendarDate(
  page: Page,
  fieldName: string,
  year: string,
  monthZeroBased: string,
  dayNumber: string,
) {
  await page.getByTestId(`calendar-trigger-${fieldName}`).click();
  const panel = page.getByTestId(`calendar-panel-${fieldName}`);
  await expect(panel).toBeVisible();
  await panel.locator("select.rdp-years_dropdown").selectOption(year);
  await panel
    .locator("select.rdp-months_dropdown")
    .selectOption(monthZeroBased);
  await panel
    .locator("button[data-day]")
    .filter({ hasText: new RegExp(`^${dayNumber}$`) })
    .first()
    .click();
  await expect(panel).toBeHidden();
}

async function pickGselOption(
  page: Page,
  fieldName: string,
  valueCode: number,
  searchTerm?: string,
) {
  await page.getByTestId(`gsel-trigger-${fieldName}`).click();
  const panel = page.getByTestId(`gsel-panel-${fieldName}`);
  await expect(panel).toBeVisible();
  if (searchTerm) {
    await page.getByTestId(`gsel-search-${fieldName}`).fill(searchTerm);
  }
  await page.getByTestId(`gsel-option-${fieldName}-${valueCode}`).click();
  await expect(panel).toBeHidden();
}

test.describe("Fase 9: Mantenimiento completo PERSONAL (§5.3–§11.3)", () => {
  test("360x640: orden PerCod/PerNom, búsqueda simple, Adición R22/calendario/G-SEL, homónimo R5, E-DUP, Ocultar y Salir", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await setupSupabaseMock(page);
    await page.goto("/");
    await page.getByTestId("nav-personal").click();
    await expect(page).toHaveURL(/\/personal$/);

    const perPage = page.locator("#personal-maintenance-page");
    await expect(perPage.locator("ion-title")).toContainText("Personal");
    await expect(perPage.getByTestId("active-ordering-label")).toContainText(
      "Código (1→N)",
    );

    const rows = perPage.getByTestId("record-list-rows").locator("button");
    await expect(rows.nth(0)).toContainText("Juan Pérez");
    await expect(rows.nth(1)).toContainText("María Gómez");
    await expect(rows.nth(2)).toContainText("Luis Torres");
    await expectNoHorizontalOverflow(page);

    // Toggle ordering to Nombre (A→Z), Código and back
    await perPage.getByTestId("btn-toggle-ordering").click();
    await expect(perPage.getByTestId("active-ordering-label")).toContainText(
      "Nombre (A→Z), Código",
    );
    await expect(rows.nth(0)).toContainText("Juan Pérez");
    await expect(rows.nth(1)).toContainText("Luis Torres");
    await expect(rows.nth(2)).toContainText("María Gómez");
    await perPage.getByTestId("btn-toggle-ordering").click();
    await expect(rows.nth(1)).toContainText("María Gómez");

    // Simple search by DNI y Nombre (§11.2; código exacto se verifica tras Adición #40 sin colisión con DNIs seed)
    const simpleInput = perPage
      .getByTestId("input-simple-search")
      .locator("input");
    await simpleInput.fill("42345678");
    await perPage.getByTestId("btn-simple-search").click();
    await expect(perPage.getByTestId("record-row-2")).toBeVisible();
    await expect(perPage.getByTestId("record-row-1")).toHaveCount(0);

    await simpleInput.fill("juan");
    await perPage.getByTestId("btn-simple-search").click();
    await expect(perPage.getByTestId("record-row-1")).toBeVisible();
    await expect(perPage.getByTestId("record-row-2")).toHaveCount(0);

    await perPage.getByTestId("btn-clear-search").click();
    await expect(perPage.getByTestId("record-row-1")).toBeVisible();
    await expect(perPage.getByTestId("record-row-2")).toBeVisible();
    await expect(perPage.getByTestId("record-row-3")).toBeVisible();

    // Adición: R22 simultaneous errors preserve draft -> Calendar (<18 E-RANGE -> >=18) + G-SEL -> E-DUP DNI -> Homonym R5
    await perPage.getByTestId("op-adicionar").click();
    await expect(page.getByTestId("personal-form-title")).toContainText(
      "Adicionar Personal",
    );

    const codInput = page.locator('input[name="PerCod"]');
    const nomInput = page.locator('input[name="PerNom"]');
    const dniInput = page.locator('input[name="PerDNI"]');

    await codInput.fill("40");
    await nomInput.fill("A");
    await dniInput.fill("12a");
    await pickCalendarDate(page, "PerFecNac", "2012", "0", "15");
    await page.getByTestId("form-guardar").click();
    await dismissAlertWithTexts(page, [
      "[E-RANGE] Nombre de Personal",
      "[E-FORMAT] DNI",
      "[E-RANGE] Fecha de Nacimiento",
      "[E-REQUIRED] País",
    ]);

    // Draft retained cleanly
    await expect(codInput).toHaveValue("40");
    await expect(nomInput).toHaveValue("A");
    await expect(dniInput).toHaveValue("12a");

    // Cancel calendar keeps selected draft intact, then pick adult date
    await page.getByTestId("calendar-trigger-PerFecNac").click();
    await page.getByTestId("calendar-cancelar-PerFecNac").click();
    await pickCalendarDate(page, "PerFecNac", "2000", "5", "15");

    // G-SEL cancels without clearing, then binds active FK values
    await page.getByTestId("gsel-trigger-PerPaiCod").click();
    await expect(page.getByTestId("gsel-panel-PerPaiCod")).toBeVisible();
    await page.getByTestId("gsel-cancelar-PerPaiCod").click();
    await pickGselOption(page, "PerPaiCod", 1, "Per");
    await pickGselOption(page, "PerDepCod", 1);
    await pickGselOption(page, "PerCarCod", 1);

    // Duplicate DNI -> [E-DUP]
    await nomInput.fill("Juan Pérez"); // R5 homonym
    await dniInput.fill("41234567");
    await page.getByTestId("form-guardar").click();
    await dismissAlertWithTexts(page, ["[E-DUP]", "DNI"]);

    // Unique DNI with Homonym PerNom -> Ocultar/Salir E-PENDING -> Reopen -> Guardar
    await dniInput.fill("49876543");
    await page.getByTestId("drawer-hide").click();
    await expect(perPage.getByTestId("pending-form-banner")).toBeVisible();
    await perPage.getByTestId("toolbar-salir").click();
    await dismissAlertWithTexts(page, ["[E-PENDING]"]);
    await perPage.getByTestId("btn-reopen-form-drawer").click();
    await page.getByTestId("form-guardar").click();

    await expect(perPage.getByTestId("record-row-40")).toContainText(
      "Juan Pérez",
    );
    await expect(perPage.getByTestId("record-row-40")).toContainText(
      "49876543",
    );

    // Simple search by exact PerCod (#40) (§11.2)
    await simpleInput.fill("40");
    await perPage.getByTestId("btn-simple-search").click();
    await expect(perPage.getByTestId("record-row-40")).toBeVisible();
    await expect(perPage.getByTestId("record-row-1")).toHaveCount(0);
    await perPage.getByTestId("btn-clear-search").click();
    await expectNoHorizontalOverflow(page);

    await perPage.getByTestId("op-salir").click();
    await expect(page).toHaveURL(/\/$/);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("390x844: búsqueda avanzada §11.3 completa, R7 FK inactiva, E-REF-STATE, Modificación R2/R8, ciclo I/A/* y E-TRANSITION", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const ts = "2026-01-01T00:00:00.000Z";
    await setupSupabaseMock(page, {
      pais: [
        {
          PaiCod: 1,
          PaiNom: "Perú",
          PaiEstReg: 1,
          created_at: ts,
          updated_at: ts,
        },
        {
          PaiCod: 2,
          PaiNom: "Chile",
          PaiEstReg: 2, // Inactivo for R7 + E-REF-STATE check
          created_at: ts,
          updated_at: ts,
        },
      ],
      dependencia: [
        {
          DepCod: 1,
          DepNom: "Sistemas",
          DepEstReg: 1,
          created_at: ts,
          updated_at: ts,
        },
        {
          DepCod: 2,
          DepNom: "Contabilidad",
          DepEstReg: 1,
          created_at: ts,
          updated_at: ts,
        },
      ],
      cargo: [
        {
          CarCod: 1,
          CarNom: "Analista de Sistemas",
          CarEstReg: 1,
          created_at: ts,
          updated_at: ts,
        },
        {
          CarCod: 2,
          CarNom: "Contador General",
          CarEstReg: 1,
          created_at: ts,
          updated_at: ts,
        },
      ],
      personal: [
        {
          PerCod: 1,
          PerNom: "Ana Ríos",
          PerDNI: "71110001",
          PerFecNac: "1995-03-10",
          PerPaiCod: 1,
          PerDepCod: 1,
          PerCarCod: 1,
          PerEstReg: 1,
          created_at: ts,
          updated_at: ts,
        },
        {
          PerCod: 2,
          PerNom: "María Gómez",
          PerDNI: "72220002",
          PerFecNac: "1991-07-22",
          PerPaiCod: 2, // Referencia a País Inactivo #2 (R7)
          PerDepCod: 2,
          PerCarCod: 2,
          PerEstReg: 2,
          created_at: ts,
          updated_at: ts,
        },
        {
          PerCod: 3,
          PerNom: "Ana Ríos", // Homónimo para tiebreak PerNom ASC, PerCod ASC
          PerDNI: "71110099",
          PerFecNac: "1999-11-05",
          PerPaiCod: 1,
          PerDepCod: 2,
          PerCarCod: 1,
          PerEstReg: 1,
          created_at: ts,
          updated_at: ts,
        },
      ],
    });

    await page.goto("/personal");
    const perPage = page.locator("#personal-maintenance-page");

    // R7: Subtitle resolves Inactive FK with (Inactivo)
    await expect(perPage.getByTestId("record-row-2")).toContainText(
      "Chile (Inactivo)",
    );
    await expectNoHorizontalOverflow(page);

    // Advanced Search §11.3 combined AND filters (DNI prefix + FecNac range + G-SEL Pai/Dep + EstReg)
    await perPage.getByTestId("btn-open-advanced").click();
    await page.locator('input[name="advDni"]').fill("7111");
    await page.locator('input[name="advFecNacFrom"]').fill("1997-01-01");
    await page.locator('input[name="advFecNacTo"]').fill("2001-12-31");
    await pickGselOption(page, "advPaiCod", 1);
    await pickGselOption(page, "advDepCod", 2);
    await page.getByTestId("adv-est-2").click();
    await page.getByTestId("adv-btn-apply").click();

    await expect(perPage.getByTestId("record-row-3")).toBeVisible();
    await expect(perPage.getByTestId("record-row-1")).toHaveCount(0);
    await expect(perPage.getByTestId("record-row-2")).toHaveCount(0);

    // Select filtered row cleanly (R21) & test clearing individual FK filter
    await perPage.getByTestId("record-row-3").click();
    await perPage.getByTestId("btn-open-advanced").click();
    await page.getByTestId("adv-clear-pai").click();
    await page.getByTestId("adv-btn-reset").click();
    await expect(perPage.getByTestId("record-row-2")).toBeVisible();

    // Modificación on #2 (Inactivo + FK Inactiva #2): checks R2, R8, R7, E-REF-STATE -> G-SEL active Perú #1
    await perPage.getByTestId("record-row-2").click();
    await perPage.getByTestId("op-modificar").click();
    await expect(page.locator('input[name="PerCod"]')).toHaveAttribute(
      "readonly",
      "",
    );
    await expect(page.getByTestId("form-estreg-readonly")).toContainText(
      "I · Inactivo",
    );
    await expect(page.getByTestId("gsel-trigger-PerPaiCod")).toContainText(
      "Chile (Inactivo)",
    );

    // Saving without fixing inactive FK -> [E-REF-STATE]
    await page.getByTestId("form-guardar").click();
    await dismissAlertWithTexts(page, ["[E-REF-STATE]"]);

    // Open G-SEL -> Inactive Chile #2 excluded; select active Perú #1 -> Save succeeds & keeps EstReg=I
    await page.getByTestId("gsel-trigger-PerPaiCod").click();
    await expect(page.getByTestId("gsel-option-PerPaiCod-1")).toBeVisible();
    await expect(page.getByTestId("gsel-option-PerPaiCod-2")).toHaveCount(0);
    await page.getByTestId("gsel-option-PerPaiCod-1").click();
    await expect(page.getByTestId("gsel-panel-PerPaiCod")).toBeHidden();
    const editNomInput = page.locator('input[name="PerNom"]');
    await editNomInput.click();
    await editNomInput.fill("María Gómez Senior");
    await expect(editNomInput).toHaveValue("María Gómez Senior");
    await page.getByTestId("form-guardar").click();

    await expect(perPage.getByTestId("record-row-2")).toContainText(
      "María Gómez Senior",
    );
    await expect(perPage.getByTestId("record-row-2")).toContainText("Perú");
    await expect(perPage.getByTestId("record-row-2")).toContainText(
      "I · Inactivo",
    );

    // Lifecycle I -> A -> I -> * & E-TRANSITION terminal state R13
    await perPage.getByTestId("op-reactivar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(perPage.getByTestId("record-row-2")).toContainText(
      "A · Activo",
    );

    await perPage.getByTestId("op-inactivar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(perPage.getByTestId("record-row-2")).toContainText(
      "I · Inactivo",
    );

    await perPage.getByTestId("op-eliminar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(perPage.getByTestId("record-row-2")).toContainText(
      "* · Eliminado",
    );

    await perPage.getByTestId("op-modificar").click();
    await dismissAlertWithTexts(page, ["[E-TRANSITION]"]);
    await perPage.getByTestId("op-inactivar").click();
    await dismissAlertWithTexts(page, ["[E-TRANSITION]"]);
    await perPage.getByTestId("op-reactivar").click();
    await dismissAlertWithTexts(page, ["[E-TRANSITION]"]);

    await expectNoHorizontalOverflow(page);
    await perPage.getByTestId("op-salir").click();
    await expect(page).toHaveURL(/\/$/);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
