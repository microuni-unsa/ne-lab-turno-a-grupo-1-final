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

test("Ordenamiento R18, búsqueda simple §11.2, drawer avanzado §11.3, R21 y §8.5 en móvil (/pais)", async ({
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

  await setupSupabaseMock(page, {
    pais: [
      {
        PaiCod: 1,
        PaiNom: "Perú",
        PaiEstReg: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        PaiCod: 2,
        PaiNom: "Chile",
        PaiEstReg: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        PaiCod: 3,
        PaiNom: "Colombia",
        PaiEstReg: 2,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        PaiCod: 4,
        PaiNom: "Ecuador",
        PaiEstReg: 3,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        PaiCod: 5,
        PaiNom: "Bolivia",
        PaiEstReg: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        PaiCod: 6,
        PaiNom: "Venezuela",
        PaiEstReg: 2,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  await page.goto("/pais");

  // Ordenamiento inicial: Nombre (A→Z), Código => Bolivia (#5) primero en página 1
  await expect(page.getByTestId("active-ordering-label")).toContainText(
    "Nombre (A→Z), Código",
  );
  const rowsContainer = page.getByTestId("record-list-rows");
  await expect(rowsContainer.locator("button").first()).toContainText(
    "Bolivia",
  );
  await expectNoHorizontalOverflow(page);

  // Toggle ordenamiento a Código (1→N) => Perú (#1) primero
  await page.getByTestId("btn-toggle-ordering").click();
  await expect(page.getByTestId("active-ordering-label")).toContainText(
    "Código (1→N)",
  );
  await expect(rowsContainer.locator("button").first()).toContainText("Perú");

  // Búsqueda simple §11.2 => filtrar por "col" muestra Colombia y soporta limpiar
  const simpleInput = page.getByTestId("input-simple-search").locator("input");
  await simpleInput.fill("col");
  await page.getByTestId("btn-simple-search").click();
  await expect(page.getByTestId("record-row-3")).toContainText("Colombia");
  await expect(page.getByTestId("record-row-1")).toHaveCount(0);

  await page.getByTestId("btn-clear-search").click();
  await expect(page.getByTestId("record-row-1")).toBeVisible();

  // Drawer Búsqueda Avanzada §11.3 => filtrar EstReg = [I] (desmarcar A y *)
  await page.getByTestId("btn-open-advanced").click();
  await expect(page.getByTestId("adv-filter-cod")).toBeVisible();
  await page.getByTestId("adv-est-1").click();
  await page.getByTestId("adv-est-3").click();
  await page.getByTestId("adv-btn-apply").click();

  await expect(page.getByTestId("record-row-3")).toContainText("I · Inactivo");
  await expect(page.getByTestId("record-row-6")).toContainText("I · Inactivo");
  await expect(page.getByTestId("record-row-1")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  // Seleccionar fila filtrada (R21), iniciar Modificar y Cancelar => preserva filtro avanzado y orden (§8.5)
  await page.getByTestId("record-row-3").click();
  await expect(page.getByTestId("record-row-3")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByTestId("op-modificar").click();
  await expect(page.getByTestId("reference-form-title")).toContainText(
    "Modificar País",
  );
  await expect(page.getByTestId("layout-pending-badge")).toContainText(
    "modificación",
  );
  await page.getByTestId("drawer-cancelar").click();

  await expect(page.getByTestId("layout-pending-badge")).toHaveCount(0);
  await expect(page.getByTestId("active-ordering-label")).toContainText(
    "Código (1→N)",
  );
  await expect(page.getByTestId("record-row-3")).toBeVisible();
  await expect(page.getByTestId("record-row-1")).toHaveCount(0);

  // Limpiar filtros vuelve a listar activos/inactivos/eliminados completos
  await page.getByTestId("btn-clear-search").click();
  await expect(page.getByTestId("record-row-1")).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
