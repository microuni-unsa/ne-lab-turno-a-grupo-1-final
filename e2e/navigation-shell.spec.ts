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

test("Fase 4: hub Maestro de Personal, rutas estáticas y guard Salir en viewport móvil", async ({
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
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Maestro de Personal" }),
  ).toBeVisible();
  await expect(page.getByText("Soluciones Móviles S.A.C.")).toBeVisible();
  await expect(page.getByTestId("home-connectivity-status")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const routes = [
    {
      cardTestId: "nav-pais",
      pageSelector: "#pais-maintenance-page",
      titleText: "Países",
      urlPart: "/pais",
    },
    {
      cardTestId: "nav-dependencia",
      pageSelector: "#dependencia-maintenance-page",
      titleText: "Dependencias",
      urlPart: "/dependencia",
    },
    {
      cardTestId: "nav-cargo",
      pageSelector: "#cargo-maintenance-page",
      titleText: "Cargos",
      urlPart: "/cargo",
    },
    {
      cardTestId: "nav-personal",
      pageSelector: "#personal-maintenance-page",
      titleText: "Personal",
      urlPart: "/personal",
    },
  ] as const;

  for (const route of routes) {
    const activePage = page.locator(route.pageSelector);
    await page.getByTestId(route.cardTestId).click();
    await expect(page).toHaveURL(new RegExp(`${route.urlPart}$`));
    await expect(activePage.locator("ion-title")).toContainText(
      route.titleText,
    );
    await expectNoHorizontalOverflow(page);

    if (route.urlPart === "/pais") {
      await activePage.getByTestId("op-adicionar").click();
      await expect(
        activePage.getByTestId("layout-pending-badge"),
      ).toContainText("Pendiente: adición");

      await page.getByTestId("drawer-salir").click();
      const pendingAlert = page.locator("ion-alert");
      await expect(pendingAlert).toBeVisible();
      await expect(pendingAlert).toContainText("[E-PENDING]");
      await page.getByRole("button", { name: "Entendido" }).click();
      await expect(pendingAlert).toBeHidden();
      await expect(page).toHaveURL(/\/pais$/);

      await page.getByTestId("drawer-cancelar").click();
      await expect(activePage.getByTestId("layout-pending-badge")).toHaveCount(
        0,
      );
    }

    await activePage.getByTestId("toolbar-salir").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("nav-pais")).toBeVisible();
  }

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
