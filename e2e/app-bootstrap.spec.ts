import { expect, test } from "@playwright/test";

test("Fase 1: carga shell Ionic móvil sin errores ni scroll horizontal", async ({
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

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Maestro de Personal" }),
  ).toBeVisible();
  await expect(page.getByText("Soluciones Móviles S.A.C.")).toBeVisible();

  const noHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
  expect(noHorizontalOverflow).toBe(true);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
