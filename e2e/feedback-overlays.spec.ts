import { setupSupabaseMock } from "@e2e/support/supabase-mock";
import { expect, test } from "@playwright/test";

test("Overlays de feedback móvil (IonToast, IonAlert R22/E-PENDING, Drawers anidados y confirmación) en rutas productivas", async ({
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
  await page.goto("/personal");
  await expect(page.getByText("Personal", { exact: true })).toBeVisible();

  const noOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);

  // 1. Drawer Búsqueda Avanzada abre y se cierra táctilmente con Reset/Cancelar
  await page.getByTestId("btn-open-advanced").click();
  await expect(page.getByTestId("adv-filter-cod")).toBeVisible();
  await page.getByTestId("adv-est-2").click();
  await page.getByTestId("adv-btn-apply").click();
  await expect(page.getByTestId("adv-filter-cod")).toBeHidden();
  await page.getByTestId("btn-clear-search").click();

  // 2. IonAlert batch R22 desde formulario de Adición en /personal (Nom/DNI inválidos + Fecha requerida + FKs)
  await page.getByTestId("op-adicionar").click();
  await expect(page.getByTestId("personal-form-title")).toBeVisible();
  await page.locator('input[name="PerNom"]').fill("X");
  await page.locator('input[name="PerDNI"]').fill("12A");
  await page.getByTestId("form-guardar").click();

  const batchAlert = page.locator("ion-alert");
  await expect(batchAlert).toBeVisible();
  await expect(batchAlert).toContainText("[E-RANGE]");
  await expect(batchAlert).toContainText("[E-FORMAT]");
  await expect(batchAlert).toContainText("[E-REQUIRED]");
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(batchAlert).toBeHidden();

  // 3. Drawers anidados (Calendar + G-SEL) abren/cierran sin tumbar el formulario padre
  await page.getByTestId("calendar-trigger-PerFecNac").click();
  await expect(page.getByTestId("calendar-panel-PerFecNac")).toBeVisible();
  await page.getByTestId("calendar-cancelar-PerFecNac").click();
  await expect(page.getByTestId("calendar-panel-PerFecNac")).toBeHidden();
  await expect(page.getByTestId("personal-form-title")).toBeVisible();

  // 4. Ocultar drawer y comprobar E-PENDING al iniciar otra operación
  await page.getByTestId("drawer-hide").click();
  await expect(page.getByTestId("pending-form-banner")).toBeVisible();
  await page.getByTestId("op-modificar").click();
  await expect(page.locator("ion-alert")).toContainText("[E-PENDING]");
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(page.locator("ion-alert")).toBeHidden();
  await page.getByTestId("op-cancelar").click();

  // 5. IonToast al guardar operación válida en /pais y cierre manual del botón Cerrar
  await page.goto("/pais");
  await page.getByTestId("record-row-2").click();
  await page.getByTestId("op-inactivar").click();
  await expect(page.getByTestId("state-op-confirm-card")).toBeVisible();
  await page.getByTestId("state-confirm-cancelar").click();
  await expect(page.getByTestId("state-op-confirm-card")).toBeHidden();

  await page.getByTestId("op-inactivar").click();
  await page.getByTestId("state-confirm-guardar").click();
  const toast = page.locator("ion-toast");
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Registro inactivado correctamente.");
  await toast.getByRole("button", { name: "Cerrar" }).click();
  await expect(toast).toBeHidden();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
