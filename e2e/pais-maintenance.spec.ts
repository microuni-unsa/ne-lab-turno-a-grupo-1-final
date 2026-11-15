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

async function dismissAlertWithCode(page: Page, expectedCode: string) {
  const alert = page.locator("ion-alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(expectedCode);
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(alert).toBeHidden();
}

test.describe("Fase 6: Mantenimiento completo PAIS (/pais)", () => {
  test("recorre todos los flujos CRUD, validaciones R22, estados A/I/*, R11, ocultar drawer y búsqueda/orden", async ({
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

    await setupSupabaseMock(page);
    await page.goto("/pais");

    // 1. Ordenamiento inicial Nombre (A→Z), Código con estados A / I / * (R18, R19)
    await expect(page.getByText("Países")).toBeVisible();
    await expect(page.getByTestId("active-ordering-label")).toContainText(
      "Nombre (A→Z), Código",
    );
    const firstRow = page
      .getByTestId("record-list-rows")
      .locator("button")
      .first();
    await expect(firstRow).toContainText("Bolivia");
    await expect(page.getByTestId("record-row-3")).toContainText(
      "I · Inactivo",
    );
    await expect(page.getByTestId("record-row-4")).toContainText(
      "* · Eliminado",
    );
    await expectNoHorizontalOverflow(page);

    // Toggle a Código (1→N) y regreso a Nombre
    await page.getByTestId("btn-toggle-ordering").click();
    await expect(page.getByTestId("active-ordering-label")).toContainText(
      "Código (1→N)",
    );
    await expect(firstRow).toContainText("Perú");
    await page.getByTestId("btn-toggle-ordering").click();
    await expect(firstRow).toContainText("Bolivia");

    // 2. Acciones que requieren fila sin selección muestran aviso sin abrir drawer
    for (const opId of [
      "op-modificar",
      "op-inactivar",
      "op-reactivar",
      "op-eliminar",
    ] as const) {
      await page.getByTestId(opId).click();
      await expect(page.getByTestId("reference-form-title")).toHaveCount(0);
      await expect(page.getByTestId("state-op-confirm-card")).toHaveCount(0);
    }

    // 3. Adición inválida -> batch R22 con código vacío + nombre corto preserva borrador
    await page.getByTestId("op-adicionar").click();
    await expect(page.getByTestId("reference-form-title")).toContainText(
      "Adicionar País",
    );
    await expect(page.getByTestId("form-estreg-readonly")).toContainText(
      "A · Activo",
    );
    const codInput = page.locator('input[name="PaiCod"]');
    const nomInput = page.locator('input[name="PaiNom"]');
    await nomInput.fill("X");
    await page.getByTestId("form-guardar").click();
    await dismissAlertWithCode(page, "[E-REQUIRED]");
    await expect(nomInput).toHaveValue("X");

    // 4. Duplicidad case/whitespace E-DUP preserva borrador y mantiene pending activo
    await codInput.fill("1");
    await nomInput.fill("  perú  ");
    await page.getByTestId("form-guardar").click();
    await dismissAlertWithCode(page, "[E-DUP]");
    await expect(codInput).toHaveValue("1");
    await expect(nomInput).toHaveValue("  perú  ");

    // 5. Ocultar Drawer mantiene borrador y E-PENDING bloquea segunda operación / Salir
    await codInput.fill("77");
    await nomInput.fill("Paraguay");
    await page.getByTestId("drawer-hide").click();
    await expect(page.getByTestId("pending-form-banner")).toBeVisible();

    await page.getByTestId("op-modificar").click();
    await dismissAlertWithCode(page, "[E-PENDING]");
    await page.getByTestId("toolbar-salir").click();
    await dismissAlertWithCode(page, "[E-PENDING]");

    await page.getByTestId("btn-reopen-form-drawer").click();
    await expect(codInput).toHaveValue("77");
    await expect(nomInput).toHaveValue("Paraguay");

    // 6. Guardar Adición válida inserta Paraguay en orden alfabético
    await page.getByTestId("form-guardar").click();
    await expect(page.locator("ion-toast")).toBeVisible();
    await expect(page.getByTestId("record-row-77")).toContainText("Paraguay");
    await expect(page.getByTestId("record-row-77")).toContainText("A · Activo");

    // 7. Modificación de fila Activa e Inactiva (R8: código readonly y EstReg conservado)
    await page.getByTestId("record-row-3").click();
    await page.getByTestId("op-modificar").click();
    await expect(page.getByTestId("reference-form-title")).toContainText(
      "Modificar País",
    );
    await expect(codInput).toHaveAttribute("readonly", "");
    await expect(page.getByTestId("form-estreg-readonly")).toContainText(
      "I · Inactivo",
    );
    await nomInput.fill("Colombia Editada");
    await page.getByTestId("form-guardar").click();
    await expect(page.getByTestId("record-row-3")).toContainText(
      "Colombia Editada",
    );
    await expect(page.getByTestId("record-row-3")).toContainText(
      "I · Inactivo",
    );

    // 8. Ciclo de estados: Inactivar -> doble Inactivar [E-TRANSITION] -> Reactivar -> doble Reactivar [E-TRANSITION]
    await page.getByTestId("record-row-77").click();
    await page.getByTestId("op-inactivar").click();
    await expect(page.getByTestId("state-op-confirm-card")).toBeVisible();
    await expect(
      page.getByTestId("state-op-confirm-card").locator("input"),
    ).toHaveCount(0);
    await page.getByTestId("op-guardar").click();
    await expect(page.getByTestId("record-row-77")).toContainText(
      "I · Inactivo",
    );

    await page.getByTestId("op-inactivar").click();
    await dismissAlertWithCode(page, "[E-TRANSITION]");

    await page.getByTestId("op-reactivar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(page.getByTestId("record-row-77")).toContainText("A · Activo");

    await page.getByTestId("op-reactivar").click();
    await dismissAlertWithCode(page, "[E-TRANSITION]");

    // 9. Eliminación lógica: Perú referenciado -> [E-REF-BLOCKED]; Paraguay sin refs -> *; terminal * bloquea cambios
    await page.getByTestId("record-row-1").click();
    await page.getByTestId("op-eliminar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await dismissAlertWithCode(page, "[E-REF-BLOCKED]");
    await page.getByTestId("state-confirm-cancelar").click();
    await expect(page.getByTestId("record-row-1")).toContainText("A · Activo");

    await page.getByTestId("record-row-77").click();
    await page.getByTestId("op-eliminar").click();
    await page.getByTestId("state-confirm-guardar").click();
    await expect(page.getByTestId("record-row-77")).toContainText(
      "* · Eliminado",
    );

    await page.getByTestId("op-reactivar").click();
    await dismissAlertWithCode(page, "[E-TRANSITION]");

    // 10. Búsqueda simple, avanzada y cancelación conservando filtros y orden (§8.5, §11.2, §11.3)
    const simpleSearchInput = page
      .getByTestId("input-simple-search")
      .locator("input");
    await simpleSearchInput.fill("per");
    await page.getByTestId("btn-simple-search").click();
    await expect(page.getByTestId("record-row-1")).toBeVisible();
    await expect(page.getByTestId("record-row-2")).toHaveCount(0);

    await page.getByTestId("btn-clear-search").click();
    await expect(page.getByTestId("record-row-2")).toBeVisible();

    await page.getByTestId("btn-toggle-ordering").click();
    await page.getByTestId("btn-open-advanced").click();
    await page.getByTestId("adv-est-1").click();
    await page.getByTestId("adv-est-3").click();
    await page.getByTestId("adv-btn-apply").click();

    await expect(page.getByTestId("record-row-3")).toBeVisible();
    await expect(page.getByTestId("record-row-1")).toHaveCount(0);

    await page.getByTestId("record-row-3").click();
    await page.getByTestId("op-modificar").click();
    await page.getByTestId("drawer-cancelar").click();

    await expect(page.getByTestId("active-ordering-label")).toContainText(
      "Código (1→N)",
    );
    await expect(page.getByTestId("record-row-3")).toBeVisible();
    await expect(page.getByTestId("record-row-1")).toHaveCount(0);

    await page.getByTestId("btn-clear-search").click();
    await expectNoHorizontalOverflow(page);

    // Salida limpia a Home (/)
    await page.getByTestId("op-salir").click();
    await expect(page).toHaveURL(/\/$/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
