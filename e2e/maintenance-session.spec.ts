import { setupSupabaseMock } from "@e2e/support/supabase-mock";
import { expect, test } from "@playwright/test";

test("Motor de sesión móvil en /pais: arma pendiente, bloquea con E-PENDING, preserva borrador al fallar y descarta en Cancelar", async ({
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
  await expect(page.getByText("Países")).toBeVisible();

  const noOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);

  // 1. Armar Adición y escribir datos en el formulario AppStructForm (código generado por identidad)
  await page.getByTestId("op-adicionar").click();
  await expect(page.getByTestId("reference-form-title")).toContainText(
    "Adicionar País",
  );

  const nomInput = page.locator('input[name="PaiNom"]');
  await nomInput.fill("Perú");

  // 2. Ocultar formulario y pulsar segunda acción (Modificar) o Salir => E-PENDING y preserva inputs
  await page.getByTestId("drawer-hide").click();
  await expect(page.getByTestId("pending-form-banner")).toBeVisible();

  await page.getByTestId("op-modificar").click();
  const alert = page.locator("ion-alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("[E-PENDING]");
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(alert).toBeHidden();

  await page.getByTestId("op-salir").click();
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("[E-PENDING]");
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(alert).toBeHidden();

  await page.getByTestId("btn-reopen-form-drawer").click();
  await expect(nomInput).toHaveValue("Perú");

  // 3. Guardar con nombre duplicado (Perú) falla con E-DUP y mantiene pendiente + inputs visibles
  await page.getByTestId("form-guardar").click();
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("[E-DUP]");
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(alert).toBeHidden();
  await expect(nomInput).toHaveValue("Perú");

  // 4. Cancelar descarta pendiente sin escribir
  await page.getByTestId("drawer-cancelar").click();
  await expect(page.getByTestId("pending-form-banner")).toHaveCount(0);

  // 5. Reintentar con nombre libre (Uruguay) => Guardar exitoso (código generado max+1 = 6) + Toast + Salir limpio permitido
  await page.getByTestId("op-adicionar").click();
  await page.locator('input[name="PaiNom"]').fill("Uruguay");
  await page.getByTestId("form-guardar").click();

  await expect(page.locator("ion-toast")).toBeVisible();
  await expect(page.getByTestId("record-row-6")).toContainText("Uruguay");

  await page.getByTestId("op-salir").click();
  await expect(page.getByTestId("nav-pais")).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
