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

test.describe("Fase 7: Mantenimiento DEPENDENCIA y CARGO", () => {
  test("recorre ciclo completo CRUD, R11, E-DUP, ocultar drawer, filtros y orden en /dependencia", async ({
    page,
  }) => {
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

    const mockState = await setupSupabaseMock(page);
    await page.goto("/dependencia");

    const depPage = page.locator("#dependencia-maintenance-page");
    await expect(depPage.locator("ion-title")).toContainText("Dependencias");
    await expect(depPage.getByTestId("active-ordering-label")).toContainText(
      "Nombre (A→Z), Código",
    );
    const rows = depPage.getByTestId("record-list-rows").locator("button");
    await expect(rows.nth(0)).toContainText("Almacen");
    await expect(rows.nth(1)).toContainText("Contabilidad");
    await expect(rows.nth(3)).toContainText("Sistemas");
    await expect(depPage.getByTestId("record-row-3")).toContainText(
      "I · Inactivo",
    );
    await expect(depPage.getByTestId("record-row-4")).toContainText(
      "* · Eliminado",
    );
    await expectNoHorizontalOverflow(page);

    // Toggle orden a Código (1→N) y regreso
    await depPage.getByTestId("btn-toggle-ordering").click();
    await expect(rows.first()).toContainText("Sistemas");
    await depPage.getByTestId("btn-toggle-ordering").click();
    await expect(rows.first()).toContainText("Almacen");

    // Adición inválida R22 -> E-DUP case/whitespace -> Ocultar/E-PENDING -> Adición válida
    await depPage.getByTestId("op-adicionar").click();
    await expect(page.getByTestId("reference-form-title")).toContainText(
      "Adicionar Dependencia",
    );
    const codInput = page.locator('input[name="DepCod"]');
    const nomInput = page.locator('input[name="DepNom"]');
    await nomInput.fill("A");
    await page.getByTestId("form-guardar").click();
    await dismissAlertWithTexts(page, [
      "[E-REQUIRED]",
      "Código de Dependencia",
    ]);

    await codInput.fill("1");
    await nomInput.fill("  sistemas ");
    await page.getByTestId("form-guardar").click();
    await dismissAlertWithTexts(page, ["[E-DUP]", "Nombre de Dependencia"]);

    await codInput.fill("55");
    await nomInput.fill("Tesorería");
    await page.getByTestId("drawer-hide").click();
    await expect(depPage.getByTestId("pending-form-banner")).toBeVisible();
    await depPage.getByTestId("toolbar-salir").click();
    await dismissAlertWithTexts(page, ["[E-PENDING]"]);
    await depPage.getByTestId("btn-reopen-form-drawer").click();
    await page.getByTestId("form-guardar").click();

    await expect(depPage.getByTestId("record-row-55")).toContainText(
      "Tesorería",
    );

    // Modificación en I preserva DepCod readonly y EstReg=I
    await depPage.getByTestId("record-row-3").click();
    await depPage.getByTestId("op-modificar").click();
    await expect(codInput).toHaveAttribute("readonly", "");
    await expect(page.getByTestId("form-estreg-readonly")).toContainText(
      "I · Inactivo",
    );
    await nomInput.fill("Almacén Central");
    await page.getByTestId("form-guardar").click();
    await expect(depPage.getByTestId("record-row-3")).toContainText(
      "Almacén Central",
    );
    await expect(depPage.getByTestId("record-row-3")).toContainText(
      "I · Inactivo",
    );

    // Inactivar -> segunda Inactivación [E-TRANSITION] -> Reactivar -> Eliminar R11 en #1 -> Eliminar #55
    await depPage.getByTestId("record-row-55").click();
    await depPage.getByTestId("op-inactivar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(depPage.getByTestId("record-row-55")).toContainText(
      "I · Inactivo",
    );
    await depPage.getByTestId("op-inactivar").click();
    await dismissAlertWithTexts(page, ["[E-TRANSITION]"]);

    await depPage.getByTestId("op-reactivar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(depPage.getByTestId("record-row-55")).toContainText(
      "A · Activo",
    );

    // R11 bloquea Eliminar #1 Sistemas vs R12 permite Inactivar/Reactivar #1 referenciado
    await depPage.getByTestId("record-row-1").click();
    await depPage.getByTestId("op-eliminar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await dismissAlertWithTexts(page, [
      "[E-REF-BLOCKED]",
      "Código de Dependencia",
    ]);
    await page.getByTestId("state-confirm-cancelar").click();
    expect(
      mockState.requests.some(
        (req) => req.method === "HEAD" && req.url.includes("PerDepCod=eq.1"),
      ),
    ).toBe(true);

    await depPage.getByTestId("op-inactivar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(depPage.getByTestId("record-row-1")).toContainText(
      "I · Inactivo",
    );
    await depPage.getByTestId("op-reactivar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(depPage.getByTestId("record-row-1")).toContainText(
      "A · Activo",
    );

    await depPage.getByTestId("record-row-55").click();
    await depPage.getByTestId("op-eliminar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(depPage.getByTestId("record-row-55")).toContainText(
      "* · Eliminado",
    );

    await depPage.getByTestId("op-salir").click();
    await expect(page).toHaveURL(/\/$/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("navega desde Home a /cargo y recorre CRUD, R11, filtros y salir en viewport 360x640", async ({
    page,
  }) => {
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

    const mockState = await setupSupabaseMock(page);
    await page.goto("/");
    await page.getByTestId("nav-cargo").click();
    await expect(page).toHaveURL(/\/cargo$/);

    const carPage = page.locator("#cargo-maintenance-page");
    await expect(carPage.locator("ion-title")).toContainText("Cargos");
    await expect(
      carPage.getByTestId("record-list-rows").locator("button").first(),
    ).toContainText("Analista de Sistemas");
    await expectNoHorizontalOverflow(page);

    // Adición válida #66 Arquitecto Cloud
    await carPage.getByTestId("op-adicionar").click();
    await expect(page.getByTestId("reference-form-title")).toContainText(
      "Adicionar Cargo",
    );
    const codInput = page.locator('input[name="CarCod"]');
    const nomInput = page.locator('input[name="CarNom"]');
    await codInput.fill("66");
    await nomInput.fill("contador general");
    await page.getByTestId("form-guardar").click();
    await dismissAlertWithTexts(page, ["[E-DUP]", "Nombre de Cargo"]);

    await nomInput.fill("Arquitecto Cloud");
    await page.getByTestId("form-guardar").click();
    await expect(carPage.getByTestId("record-row-66")).toContainText(
      "Arquitecto Cloud",
    );

    // Modificación preservando CarCod readonly y estado I en #3
    await carPage.getByTestId("record-row-3").click();
    await carPage.getByTestId("op-modificar").click();
    await expect(codInput).toHaveAttribute("readonly", "");
    await expect(page.getByTestId("form-estreg-readonly")).toContainText(
      "I · Inactivo",
    );
    await nomInput.fill("Asistente Contable Senior");
    await page.getByTestId("form-guardar").click();
    await expect(carPage.getByTestId("record-row-3")).toContainText(
      "Asistente Contable Senior",
    );
    await expect(carPage.getByTestId("record-row-3")).toContainText(
      "I · Inactivo",
    );

    // R11 bloquea Eliminar Cargo #1 vs R12 permite Inactivar/Reactivar Cargo #1 referenciado
    await carPage.getByTestId("record-row-1").click();
    await carPage.getByTestId("op-eliminar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await dismissAlertWithTexts(page, ["[E-REF-BLOCKED]", "Código de Cargo"]);
    await page.getByTestId("state-confirm-cancelar").click();
    expect(
      mockState.requests.some(
        (req) => req.method === "HEAD" && req.url.includes("PerCarCod=eq.1"),
      ),
    ).toBe(true);

    await carPage.getByTestId("op-inactivar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(carPage.getByTestId("record-row-1")).toContainText(
      "I · Inactivo",
    );
    await carPage.getByTestId("op-reactivar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(carPage.getByTestId("record-row-1")).toContainText(
      "A · Activo",
    );

    // Eliminar #66 y filtrar avanzada/simple conservando orden
    await carPage.getByTestId("record-row-66").click();
    await carPage.getByTestId("op-eliminar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(carPage.getByTestId("record-row-66")).toContainText(
      "* · Eliminado",
    );

    await carPage.getByTestId("btn-open-advanced").click();
    await page.getByTestId("adv-est-1").click();
    await page.getByTestId("adv-est-2").click();
    await page.getByTestId("adv-btn-apply").click();
    await expect(carPage.getByTestId("record-row-66")).toBeVisible();
    await expect(carPage.getByTestId("record-row-1")).toHaveCount(0);

    await carPage.getByTestId("btn-clear-search").click();
    await expect(carPage.getByTestId("record-row-1")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await carPage.getByTestId("op-salir").click();
    await expect(page).toHaveURL(/\/$/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
