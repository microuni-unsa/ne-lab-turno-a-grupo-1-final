import { setupSupabaseMock } from "@e2e/support/supabase-mock";
import { expect, type Locator, type Page, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const noOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);
}

async function dismissAlertWithSnippets(
  page: Page,
  expectedSnippets: readonly string[],
) {
  const alert = page.locator("ion-alert");
  await expect(alert).toBeVisible();
  for (const snippet of expectedSnippets) {
    await expect(alert).toContainText(snippet);
  }
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(alert).toBeHidden();
}

async function dismissToastIfVisible(page: Page) {
  const toast = page.locator("ion-toast");
  await expect(toast).toBeVisible();
  const closeButton = toast.getByRole("button", { name: "Cerrar" });
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }
  await expect(toast).toBeHidden();
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

async function runStateOp(activePage: Locator, page: Page, opId: string) {
  await activePage.getByTestId(opId).click();
  await expect(activePage.getByTestId("state-op-confirm-card")).toBeVisible();
  await activePage.getByTestId("state-confirm-guardar").click();
  await dismissToastIfVisible(page);
}

test.describe("Fase 10: Replay final e integridad PWA/Red (SPEC §14–§15)", () => {
  test("390x844: valida manifest PWA, íconos 192/512, recuperación ante fallos de red en consulta y Guardar", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await setupSupabaseMock(page);
    await page.goto("/");
    await expect(page.getByTestId("nav-pais")).toBeVisible();
    await expect(page.getByTestId("home-offline-notice")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    // 1. Verificar manifest.webmanifest HTTP 200 e íconos reales (192x192 y 512x512)
    const manifestResponse = await page.request.get("/manifest.webmanifest");
    expect(manifestResponse.status()).toBe(200);
    const manifestJson: unknown = await manifestResponse.json();
    expect(manifestJson).toMatchObject({
      name: "Maestro de Personal",
      short_name: "Personal",
      display: "standalone",
      start_url: ".",
    });

    const iconDims = await page.evaluate(async () => {
      const checkIcon = (src: string) =>
        new Promise<{ status: number; width: number; height: number }>(
          (resolve, reject) => {
            fetch(src)
              .then((res) => {
                const status = res.status;
                const img = new Image();
                img.onload = () =>
                  resolve({ status, width: img.width, height: img.height });
                img.onerror = () =>
                  reject(new Error(`Failed loading icon: ${src}`));
                img.src = src;
              })
              .catch(reject);
          },
        );
      return Promise.all([
        checkIcon("/icons/icon-192.png"),
        checkIcon("/icons/icon-512.png"),
      ]);
    });
    expect(iconDims).toEqual([
      { status: 200, width: 192, height: 192 },
      { status: 200, width: 512, height: 512 },
    ]);

    // 2. Fallo de red persistente mientras el servicio esté caído en Supabase (/rest/v1/pais) -> Reintentar recupera listado
    let blockPaisList = true;
    let blockedPaisListRequests = 0;
    await page.route("**/rest/v1/pais*", async (route) => {
      if (route.request().method() === "GET" && blockPaisList) {
        blockedPaisListRequests += 1;
        await route.abort("failed");
        return;
      }
      await route.fallback();
    });

    await page.getByTestId("nav-pais").click();
    const paisPage = page.locator("#pais-maintenance-page");
    await expect(paisPage.getByTestId("list-error-state")).toBeVisible();
    expect(blockedPaisListRequests).toBeGreaterThanOrEqual(2);
    blockPaisList = false;
    await paisPage
      .getByTestId("list-error-state")
      .getByRole("button", { name: "Reintentar" })
      .click();
    await expect(paisPage.getByTestId("record-row-1")).toBeVisible();

    // 3. Fallo transitorio en Guardar (guardar_pais) -> E-NETWORK conservando pendiente y borrador; reintento guarda
    let rpcFailuresRemaining = 1;
    await page.route("**/rest/v1/rpc/guardar_pais", async (route) => {
      if (rpcFailuresRemaining > 0) {
        rpcFailuresRemaining -= 1;
        await route.abort("failed");
        return;
      }
      await route.fallback();
    });

    await paisPage.getByTestId("op-adicionar").click();
    const nomInput = page.locator('input[name="PaiNom"]');
    await nomInput.fill("Uruguay");
    await page.getByTestId("form-guardar").click();

    await dismissAlertWithSnippets(page, ["E-NETWORK"]);
    await expect(nomInput).toHaveValue("Uruguay");

    await page.getByTestId("form-guardar").click();
    await dismissToastIfVisible(page);
    await expect(paisPage.getByTestId("record-row-6")).toContainText("Uruguay");
    await paisPage.getByTestId("toolbar-salir").click();

    expect(pageErrors).toEqual([]);
  });

  test("360x640: replay continuo de evaluación sobre Países, Dependencias, Cargos y Personal con liberación R11", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 360, height: 640 });

    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await setupSupabaseMock(page);
    await page.goto("/");
    await expectNoHorizontalOverflow(page);

    // ------------------------------------------------------------------
    // 1. Home -> Países: orden A→Z, E-DUP, Modificación R2, A/I/*, E-REF-BLOCKED en Perú
    // ------------------------------------------------------------------
    await page.getByTestId("nav-pais").click();
    const paisPage = page.locator("#pais-maintenance-page");
    await expect(paisPage.getByTestId("record-row-5")).toBeVisible();
    await expect(
      paisPage.getByTestId("record-list-rows").locator("button").first(),
    ).toContainText("Bolivia");
    await expectNoHorizontalOverflow(page);

    await paisPage.getByTestId("op-adicionar").click();
    await page.locator('input[name="PaiNom"]').fill("Perú");
    await page.getByTestId("form-guardar").click();
    await dismissAlertWithSnippets(page, ["[E-DUP]"]);

    await page.locator('input[name="PaiNom"]').fill("Paraguay");
    await page.getByTestId("form-guardar").click();
    await dismissToastIfVisible(page);
    await expect(paisPage.getByTestId("record-row-6")).toContainText(
      "Paraguay",
    );

    await paisPage.getByTestId("record-row-6").click();
    await paisPage.getByTestId("op-modificar").click();
    await expect(page.locator('input[name="PaiCod"]')).toHaveAttribute(
      "readonly",
      "",
    );
    await page.locator('input[name="PaiNom"]').fill("Paraguay Sur");
    await page.getByTestId("form-guardar").click();
    await dismissToastIfVisible(page);
    await expect(paisPage.getByTestId("record-row-6")).toContainText(
      "Paraguay Sur",
    );

    await paisPage.getByTestId("record-row-6").click();
    await runStateOp(paisPage, page, "op-inactivar");
    await expect(paisPage.getByTestId("record-row-6")).toContainText(
      "I · Inactivo",
    );

    await runStateOp(paisPage, page, "op-reactivar");
    await expect(paisPage.getByTestId("record-row-6")).toContainText(
      "A · Activo",
    );

    await runStateOp(paisPage, page, "op-eliminar");
    await expect(paisPage.getByTestId("record-row-6")).toContainText(
      "* · Eliminado",
    );

    // Perú (#1) bloqueado por R11
    await paisPage.getByTestId("record-row-1").click();
    await paisPage.getByTestId("op-eliminar").click();
    await paisPage.getByTestId("state-confirm-guardar").click();
    await dismissAlertWithSnippets(page, ["[E-REF-BLOCKED]"]);
    await paisPage.getByTestId("state-confirm-cancelar").click();
    await expect(paisPage.getByTestId("record-row-1")).toContainText(
      "A · Activo",
    );

    await paisPage.getByTestId("toolbar-salir").click();
    await expect(page.getByTestId("nav-dependencia")).toBeVisible();

    // ------------------------------------------------------------------
    // 2. Home -> Dependencias: semillas, E-REF-BLOCKED en Sistemas y R12 Inactivar/Reactivar
    // ------------------------------------------------------------------
    await page.getByTestId("nav-dependencia").click();
    const depPage = page.locator("#dependencia-maintenance-page");
    await expect(depPage.getByTestId("record-row-1")).toContainText("Sistemas");
    await expect(depPage.getByTestId("record-row-2")).toContainText(
      "Contabilidad",
    );
    await expect(depPage.getByTestId("record-row-3")).toContainText("Almacen");

    await depPage.getByTestId("record-row-1").click();
    await depPage.getByTestId("op-eliminar").click();
    await depPage.getByTestId("state-confirm-guardar").click();
    await dismissAlertWithSnippets(page, ["[E-REF-BLOCKED]"]);
    await depPage.getByTestId("state-confirm-cancelar").click();

    await depPage.getByTestId("record-row-1").click();
    await runStateOp(depPage, page, "op-inactivar");
    await expect(depPage.getByTestId("record-row-1")).toContainText(
      "I · Inactivo",
    );
    await runStateOp(depPage, page, "op-reactivar");
    await expect(depPage.getByTestId("record-row-1")).toContainText(
      "A · Activo",
    );

    await depPage.getByTestId("toolbar-salir").click();
    await expect(page.getByTestId("nav-cargo")).toBeVisible();

    // ------------------------------------------------------------------
    // 3. Home -> Cargos: crear Cargo temporal #20 y validar edición + ciclo A/I/A
    // ------------------------------------------------------------------
    await page.getByTestId("nav-cargo").click();
    const cargoPage = page.locator("#cargo-maintenance-page");
    await expect(cargoPage.getByTestId("record-row-1")).toBeVisible();

    await cargoPage.getByTestId("op-adicionar").click();
    await page.locator('input[name="CarNom"]').fill("Auditor Móvil");
    await page.getByTestId("form-guardar").click();
    await dismissToastIfVisible(page);
    await expect(cargoPage.getByTestId("record-row-5")).toContainText(
      "Auditor Móvil",
    );

    await cargoPage.getByTestId("record-row-5").click();
    await cargoPage.getByTestId("op-modificar").click();
    await expect(page.locator('input[name="CarCod"]')).toHaveAttribute(
      "readonly",
      "",
    );
    await page.locator('input[name="CarNom"]').fill("Auditor QA");
    await page.getByTestId("form-guardar").click();
    await dismissToastIfVisible(page);

    await cargoPage.getByTestId("record-row-5").click();
    await runStateOp(cargoPage, page, "op-inactivar");
    await runStateOp(cargoPage, page, "op-reactivar");
    await expect(cargoPage.getByTestId("record-row-5")).toContainText(
      "A · Activo",
    );

    await cargoPage.getByTestId("toolbar-salir").click();
    await expect(page.getByTestId("nav-personal")).toBeVisible();

    // ------------------------------------------------------------------
    // 4. Home -> Personal: Adición R22 + Calendario >=18 + G-SEL + Buscar/Orden + Modificación + A/I/*
    // ------------------------------------------------------------------
    await page.getByTestId("nav-personal").click();
    const perPage = page.locator("#personal-maintenance-page");
    await expect(perPage.getByTestId("record-row-1")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await perPage.getByTestId("op-adicionar").click();
    await page.locator('input[name="PerNom"]').fill("X");
    await page.locator('input[name="PerDNI"]').fill("12A");
    await page.getByTestId("form-guardar").click();
    await dismissAlertWithSnippets(page, [
      "[E-RANGE]",
      "[E-FORMAT]",
      "[E-REQUIRED]",
    ]);
    await pickCalendarDate(page, "PerFecNac", "1996", "4", "15");
    await page.getByTestId("gsel-trigger-PerPaiCod").click();
    await expect(page.getByTestId("gsel-panel-PerPaiCod")).toBeVisible();
    await page.getByTestId("gsel-cancelar-PerPaiCod").click();
    await expect(page.getByTestId("gsel-panel-PerPaiCod")).toBeHidden();

    await pickGselOption(page, "PerPaiCod", 1, "Per");
    await pickGselOption(page, "PerDepCod", 1);
    await pickGselOption(page, "PerCarCod", 5);

    await page.locator('input[name="PerNom"]').fill("Elena Quispe");
    await page.locator('input[name="PerDNI"]').fill("47890123");
    await page.getByTestId("form-guardar").click();
    await dismissToastIfVisible(page);
    await expect(perPage.getByTestId("record-row-4")).toContainText(
      "Elena Quispe",
    );

    // Buscar simple, toggle ordenamiento y búsqueda avanzada
    await perPage.getByTestId("btn-toggle-ordering").click();
    await expect(perPage.getByTestId("active-ordering-label")).toContainText(
      "Nombre (A→Z), Código",
    );

    await perPage
      .getByTestId("input-simple-search")
      .locator("input")
      .fill("47890123");
    await perPage.getByTestId("btn-simple-search").click();
    await expect(perPage.getByTestId("record-row-4")).toBeVisible();
    await expect(perPage.getByTestId("record-row-1")).toHaveCount(0);
    await perPage.getByTestId("btn-clear-search").click();

    await perPage.getByTestId("btn-open-advanced").click();
    await page.getByTestId("adv-filter-cod").locator("input").fill("4");
    await page.getByTestId("adv-btn-apply").click();
    await expect(perPage.getByTestId("record-row-4")).toBeVisible();
    await expect(perPage.getByTestId("record-row-1")).toHaveCount(0);
    await perPage.getByTestId("btn-clear-search").click();

    // Modificación (#4) con PerCod readonly + ciclo Inactivar/Reactivar
    await perPage.getByTestId("record-row-4").click();
    await perPage.getByTestId("op-modificar").click();
    await expect(page.locator('input[name="PerCod"]')).toHaveAttribute(
      "readonly",
      "",
    );
    await page.locator('input[name="PerNom"]').fill("Elena Quispe Vega");
    await page.getByTestId("form-guardar").click();
    await dismissToastIfVisible(page);
    await expect(perPage.getByTestId("record-row-4")).toContainText(
      "Elena Quispe Vega",
    );

    await perPage.getByTestId("record-row-4").click();
    await runStateOp(perPage, page, "op-inactivar");
    await runStateOp(perPage, page, "op-reactivar");

    // Verificar bloqueo R11 en Cargo #5 mientras Personal #4 está vivo
    await perPage.getByTestId("toolbar-salir").click();
    await page.getByTestId("nav-cargo").click();
    await cargoPage.getByTestId("record-row-5").click();
    await cargoPage.getByTestId("op-eliminar").click();
    await cargoPage.getByTestId("state-confirm-guardar").click();
    await dismissAlertWithSnippets(page, ["[E-REF-BLOCKED]"]);
    await cargoPage.getByTestId("state-confirm-cancelar").click();
    await cargoPage.getByTestId("toolbar-salir").click();

    // Volver a Personal, probar E-PENDING al Salir con pendiente, Cancelar y Eliminar #4
    await page.getByTestId("nav-personal").click();
    await perPage.getByTestId("record-row-4").click();
    await perPage.getByTestId("op-modificar").click();
    await page.getByTestId("drawer-hide").click();
    await perPage.getByTestId("toolbar-salir").click();
    await dismissAlertWithSnippets(page, ["[E-PENDING]"]);
    await perPage.getByTestId("btn-reopen-form-drawer").click();
    await page.getByTestId("drawer-cancelar").click();

    await perPage.getByTestId("record-row-4").click();
    await runStateOp(perPage, page, "op-eliminar");
    await expect(perPage.getByTestId("record-row-4")).toContainText(
      "* · Eliminado",
    );
    await perPage.getByTestId("toolbar-salir").click();

    // ------------------------------------------------------------------
    // 5. Home -> Cargos: verificar liberación de R11 tras eliminar Personal #4
    // ------------------------------------------------------------------
    await page.getByTestId("nav-cargo").click();
    await cargoPage.getByTestId("record-row-5").click();
    await runStateOp(cargoPage, page, "op-eliminar");
    await expect(cargoPage.getByTestId("record-row-5")).toContainText(
      "* · Eliminado",
    );

    await cargoPage.getByTestId("toolbar-salir").click();
    await expect(page.getByTestId("nav-personal")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
