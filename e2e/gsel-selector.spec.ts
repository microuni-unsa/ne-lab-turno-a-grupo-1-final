import {
  createDefaultSeed,
  setupSupabaseMock,
} from "@e2e/support/supabase-mock";
import { expect, type Page, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const noOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);
}

test.describe("G-SEL Selector Alfabético Activo-Only (/personal)", () => {
  test("lista solo Activos ordenados por Nom ASC, soporta filtro/Cancelar sin persistir y respeta R7 en Modificación", async ({
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

    const baseSeed = createDefaultSeed();
    const mockState = await setupSupabaseMock(page, {
      ...baseSeed,
      personal: [
        ...baseSeed.personal,
        {
          PerCod: 4,
          PerNom: "Carlos Ruiz",
          PerDNI: "44567890",
          PerFecNac: "1993-02-10",
          PerPaiCod: 3, // Colombia (EstReg = I) para verificar R7
          PerDepCod: 1,
          PerCarCod: 1,
          PerEstReg: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    await page.goto("/personal");
    await expect(page.getByTestId("record-row-4")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // 1. Modo Adición: abrir selector de País (PerPaiCod)
    await page.getByTestId("op-adicionar").click();
    await expect(page.getByTestId("personal-form-title")).toContainText(
      "Adicionar Personal",
    );

    await page.getByTestId("gsel-trigger-PerPaiCod").click();
    const paiPanel = page.getByTestId("gsel-panel-PerPaiCod");
    await expect(paiPanel).toBeVisible();

    // Orden alfabético Activo-only: Bolivia (#5) primero; inactivo Colombia (#3) y eliminado Ecuador (#4) excluidos
    const paiOptions = paiPanel.locator(
      '[data-testid^="gsel-option-PerPaiCod-"]',
    );
    await expect(paiOptions).toHaveCount(3);
    await expect(paiOptions.nth(0)).toContainText("Bolivia");
    await expect(paiOptions.nth(1)).toContainText("Chile");
    await expect(paiOptions.nth(2)).toContainText("Perú");
    await expect(page.getByTestId("gsel-option-PerPaiCod-3")).toHaveCount(0);
    await expect(page.getByTestId("gsel-option-PerPaiCod-4")).toHaveCount(0);

    // Filtro por búsqueda + seleccionar Perú (#1)
    await page.getByTestId("gsel-search-PerPaiCod").fill("per");
    await expect(paiOptions).toHaveCount(1);
    await page.getByTestId("gsel-option-PerPaiCod-1").click();
    await expect(paiPanel).toBeHidden();
    await expect(page.getByTestId("gsel-trigger-PerPaiCod")).toContainText(
      "Perú",
    );

    // Cancelar en selector conserva la selección previa (#1 Perú)
    await page.getByTestId("gsel-trigger-PerPaiCod").click();
    await expect(paiPanel).toBeVisible();
    await page.getByTestId("gsel-cancelar-PerPaiCod").click();
    await expect(paiPanel).toBeHidden();
    await expect(page.getByTestId("gsel-trigger-PerPaiCod")).toContainText(
      "Perú",
    );

    // Dependencia y Cargo activos vinculan códigos sin invocar guardar_*
    await page.getByTestId("gsel-trigger-PerDepCod").click();
    await expect(page.getByTestId("gsel-option-PerDepCod-3")).toHaveCount(0);
    await page.getByTestId("gsel-option-PerDepCod-2").click();
    await expect(page.getByTestId("gsel-panel-PerDepCod")).toBeHidden();
    await expect(page.getByTestId("gsel-trigger-PerDepCod")).toContainText(
      "Contabilidad",
    );

    await page.getByTestId("gsel-trigger-PerCarCod").click();
    await expect(page.getByTestId("gsel-option-PerCarCod-3")).toHaveCount(0);
    await page.getByTestId("gsel-option-PerCarCod-2").click();
    await expect(page.getByTestId("gsel-panel-PerCarCod")).toBeHidden();
    await expect(page.getByTestId("gsel-trigger-PerCarCod")).toContainText(
      "Contador General",
    );

    expect(
      mockState.requests.filter((r) => r.url.includes("/rest/v1/rpc/guardar_")),
    ).toEqual([]);

    // 2. Modo Modificación con FK inactiva heredada (R7: #4 Carlos Ruiz con Colombia Inactivo)
    await page.getByTestId("drawer-cancelar").click();
    await page.getByTestId("record-row-4").click();
    await page.getByTestId("op-modificar").click();

    await expect(page.getByTestId("gsel-trigger-PerPaiCod")).toContainText(
      "Colombia (Inactivo)",
    );
    await page.getByTestId("gsel-trigger-PerPaiCod").click();
    await expect(page.getByTestId("gsel-panel-PerPaiCod")).toBeVisible();
    await expect(page.getByTestId("gsel-option-PerPaiCod-3")).toHaveCount(0);
    await page.getByTestId("gsel-cancelar-PerPaiCod").click();
    await expect(page.getByTestId("gsel-panel-PerPaiCod")).toBeHidden();
    await expect(page.getByTestId("gsel-trigger-PerPaiCod")).toContainText(
      "Colombia (Inactivo)",
    );

    await page.getByTestId("drawer-cancelar").click();
    await expectNoHorizontalOverflow(page);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
